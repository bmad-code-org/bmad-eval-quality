#!/usr/bin/env node
/**
 * Convenience orchestrator for eval-quality.
 * Runs compile, seal, and preflight in a single pass.
 *
 * Usage:
 *   node scripts/run-eval.mjs --contract contract.json --out ./eval-out
 *   node scripts/run-eval.mjs --contract contract.json --probes probes.json --observations obs.json --out ./eval-out
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
	compile,
	preflightFromObservations,
	seal,
	serializeArtifact,
} from '../dist/application/index.js'

function parseArgs(argv) {
	const args = {
		contract: null,
		probes: null,
		observations: null,
		out: './eval-out',
		runId: `run-${Date.now()}`,
	}
	for (let i = 2; i < argv.length; i++) {
		const arg = argv[i]
		if (arg === '--contract' && argv[i + 1]) args.contract = argv[++i]
		else if (arg === '--probes' && argv[i + 1]) args.probes = argv[++i]
		else if (arg === '--observations' && argv[i + 1])
			args.observations = argv[++i]
		else if (arg === '--out' && argv[i + 1]) args.out = argv[++i]
		else if (arg === '--run-id' && argv[i + 1]) args.runId = argv[++i]
	}
	return args
}

const args = parseArgs(process.argv)

if (!args.contract) {
	console.error('eval-quality: error: --contract <path> is required')
	console.error(
		'Usage: node scripts/run-eval.mjs --contract <contract.json> [--probes <probes.json>] [--observations <obs.json>] [--out <dir>]',
	)
	process.exit(64)
}

const contractPath = resolve(args.contract)
if (!existsSync(contractPath)) {
	console.error(`eval-quality: error: contract file not found: ${contractPath}`)
	process.exit(64)
}

const outDir = resolve(args.out)
if (!existsSync(outDir)) {
	mkdirSync(outDir, { recursive: true })
}

console.log(
	`[eval-quality] 1/3 Compiling & Sealing contract ${args.contract}...`,
)
const rawContract = JSON.parse(readFileSync(contractPath, 'utf8'))
const compiledContract = compile(rawContract)
const sealedBrief = seal(compiledContract)

const compiledOutPath = join(outDir, 'eval-contract.json')
const briefOutPath = join(outDir, 'sealed-evaluator-brief.json')

writeFileSync(
	compiledOutPath,
	serializeArtifact(compiledContract, 'eval-contract.json'),
)
writeFileSync(
	briefOutPath,
	serializeArtifact(sealedBrief, 'sealed-evaluator-brief.json'),
)
console.log(`  ✓ Compiled contract saved to: ${compiledOutPath}`)
console.log(`  ✓ Sealed evaluator brief saved to: ${briefOutPath}`)

if (args.probes && args.observations) {
	console.log(
		`[eval-quality] 2/3 Executing preflight checks for run ${args.runId}...`,
	)
	const probes = JSON.parse(readFileSync(resolve(args.probes), 'utf8'))
	const observations = JSON.parse(
		readFileSync(resolve(args.observations), 'utf8'),
	)

	const verdict = preflightFromObservations({
		contract: compiledContract,
		probes,
		observations,
		runId: args.runId,
	})

	const verdictOutPath = join(outDir, 'preflight-verdict.json')
	writeFileSync(
		verdictOutPath,
		serializeArtifact(verdict, 'preflight-verdict.json'),
	)
	console.log(`  ✓ Preflight verdict saved to: ${verdictOutPath}`)
	console.log(`  ✓ Preflight status: ${verdict.status}`)

	if (verdict.status !== 'passed') {
		console.error(
			`[eval-quality] ❌ Preflight failed with status: ${verdict.status}`,
		)
		process.exit(3)
	}
} else {
	console.log(
		'[eval-quality] ℹ️ Skipping preflight step (no --probes and --observations provided).',
	)
}

console.log('[eval-quality] 🎉 Single-pass workflow complete!')
