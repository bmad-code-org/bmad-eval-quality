#!/usr/bin/env node
// The caller-side half of a tool-use evaluation, written out so a reader can
// see what the package does and what they have to supply.
//
// `eval-quality` launches nothing on its own. It plans the calls a contract
// implies and hands each one to an `EnvironmentProbePort`, and this file is
// that port: `createMcpAdapter` wrapped around an `McpTargetPolicy` that maps
// the contract's logical interface identifier to a real server on disk. The
// contract never names a command, a path, or a transport, and this mapping is
// where those live.
//
// Two modes, because a run needs two different collections of evidence.
//
//   --mode legs    issue the pre-flight legs the contract implies and write
//                  the observations the `preflight` command reduces
//   --mode steps   issue the contract's own interaction plan and write the
//                  observations a sealed run record carries
//
// Both print every tool call and the structured result it returned, so the
// exchange is visible rather than inferred from an artifact afterwards.
//
// Flags:
//   --contract <path>   the compiled contract to plan from
//   --out <path>        where the observations are written
//   --run-id <id>       the run identifier the pre-flight verdict is minted for
//   --seed-defect       launch the server with its defect planted
//
// The server's notes are reset to their seeded state at the start of every run,
// and they live beside the output file, so two runs of the same mode answer the
// same way and neither arm of a twin run inherits the other's state.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMcpAdapter } from '../../../dist/adapters/index.js'
import { runPreflight, serializeArtifact } from '../../../dist/index.js'
import { PLAN_STEPS } from './notes-store.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))

const flagValue = (name) => {
	const at = process.argv.indexOf(name)
	return at === -1 ? null : (process.argv[at + 1] ?? null)
}
const seedDefect = process.argv.includes('--seed-defect')
const contractPath = flagValue('--contract')
const outPath = flagValue('--out')
const runId = flagValue('--run-id') ?? 'tool-run-1'
const mode = flagValue('--mode') ?? 'legs'

if (contractPath === null || outPath === null) {
	console.error(
		'usage: run-tool-calls.mjs --contract <path> --out <path> [--mode legs|steps] [--run-id <id>] [--seed-defect]',
	)
	process.exit(64)
}
if (mode !== 'legs' && mode !== 'steps') {
	console.error(`run-tool-calls.mjs: unknown --mode "${mode}"`)
	process.exit(64)
}

const out = resolve(outPath)
mkdirSync(dirname(out), { recursive: true })
const storePath = join(dirname(out), 'notes-store.json')
rmSync(storePath, { force: true })

const contract = JSON.parse(readFileSync(contractPath, 'utf8'))

// AD-35's mapping, and the only place a logical interface becomes something
// launchable. The tool list is part of the authorization, so a call naming a
// tool this mapping omits is refused before the server process starts.
const policy = {
	authorizations: [
		{
			interfaceId: 'notes-tool-server',
			target: process.execPath,
			targetArgs: [
				`${here}tool-server.mjs`,
				...(seedDefect ? ['--seed-defect'] : []),
			],
			tools: ['search_notes', 'create_note'],
			cwd: here,
			// The one channel a tool call has is its arguments, so a server that
			// needs anything else takes it from the mapping that authorized it.
			serverEnvironment: { NOTES_STORE: storePath },
			maxElapsedMs: 15000,
			maxOutputBytes: 65536,
		},
	],
}

const adapter = createMcpAdapter(policy)
const signal = new AbortController().signal

const show = (label, toolName, args, result) => {
	console.log(`${label}  ${toolName}(${JSON.stringify(args)})`)
	console.log(`  -> ${JSON.stringify(result)}`)
}

// Canonical bytes, re-indented so a reader can open the file. Writing the
// canonical form is what lets the repository hold a real run against the
// committed observations byte for byte, since key order is then fixed by
// RFC 8785 rather than by the order this file happened to build an object in.
const write = (value) => {
	const canonical = serializeArtifact(value, 'ProbeObservation')
	writeFileSync(out, `${JSON.stringify(JSON.parse(canonical), null, 2)}\n`)
	console.log(`wrote ${outPath}`)
}

if (mode === 'legs') {
	// The port the pre-flight stage awaits, with a recorder around it. The stage
	// issues every planned leg in order and the recorder keeps what came back, so
	// one run yields both a verdict and the observations a later command reduces.
	const observations = []
	const recording = {
		probe: async (request, innerSignal) => {
			const observation = await adapter.probe(request, innerSignal)
			observations.push(observation)
			show(
				`leg ${request.probeId}`,
				request.toolName,
				request.channels.arguments,
				observation.result.kind === 'json' ? observation.result.value : null,
			)
			return observation
		},
	}
	const verdict = await runPreflight({
		contract,
		probes: [],
		runId,
		port: recording,
		signal,
	})
	console.log(`pre-flight passed: ${verdict.passed}`)
	for (const check of verdict.checks) {
		console.log(`  ${check.kind} ${check.operationId} ${check.outcome}`)
	}
	write(observations)
}

if (mode === 'steps') {
	// The contract's own plan, issued in declared order. The read-back step's
	// argument is the identifier the creation answered with, which is what the
	// contract's captured binding means, so it is read off an earlier answer here
	// rather than written down.
	const answers = {}
	const observations = []
	let sequence = 0
	for (const step of PLAN_STEPS) {
		const args = step.argumentsFor(answers)
		const observation = await adapter.probe(
			{
				probeId: step.stepId,
				interfaceId: 'notes-tool-server',
				operationId: step.operationId,
				kind: 'mcp',
				toolName: step.toolName,
				channels: { arguments: args },
			},
			signal,
		)
		const body =
			observation.result.kind === 'json' ? observation.result.value : null
		answers[step.stepId] = body
		show(`step ${step.stepId}`, step.toolName, args, body)
		sequence += 1
		observations.push({
			observationId: `obs-${step.stepId}`,
			sequence,
			operationId: step.operationId,
			provenance: 'evaluator-chosen',
			principal: null,
			// Eight of the nine input channels do not apply to a tool call, and a
			// recorded observation spells each of them out.
			callInputs: {
				path: null,
				query: null,
				header: null,
				body: null,
				argument: null,
				option: null,
				environment: null,
				stdin: null,
				arguments: args,
			},
			responseBody: body,
			responseHeaders: null,
			// A tool call has no transport status, so the envelope's error flag
			// lands here as 1 or 0. That is the projection the adapter documents.
			responseStatus: observation.isError ? 1 : 0,
			stdout: { kind: 'absent' },
			stderr: { kind: 'absent' },
			exitCode: null,
			artifacts: {},
		})
	}
	write(observations)
}
