/**
 * The observation half of the tool-call kind: the branches `McpProbeObservation`
 * forces in `projectObservation`, `evidenceOf`, and `anomalyOf`, and the oracle
 * those branches make addressable.
 *
 * The fourth file of the `plan.test.ts`, `command-plan.test.ts`, and
 * `mcp-plan.test.ts` set, and the one `mcp-plan.test.ts` stopped short of: it
 * ended at what an api or a cli answer to an mcp leg gets, because nothing
 * could answer one correctly.
 */
import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import { isMcpOperation } from '../../src/core/declared-inputs.ts'
import { planPreflight } from '../../src/core/preflight/plan.ts'
import {
	fixtureDigest,
	PREFLIGHT_ARTIFACT_PATH,
	projectObservation,
} from '../../src/core/preflight/projection.ts'
import { reducePreflight } from '../../src/core/preflight/reduce.ts'
import {
	evidenceOf,
	resolveWitnessRelation,
} from '../../src/core/preflight/witness-evidence.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import type { Expression } from '../../src/core/schemas/expression.ts'
import type { McpOperation } from '../../src/core/schemas/interface.ts'
import { operationsOf } from '../../src/core/schemas/interface.ts'
import type {
	McpProbeObservation,
	ProbeObservedBody,
} from '../../src/core/schemas/port-messages.ts'
import type { McpWitnessInputs } from '../../src/core/schemas/sensitivity-witness.ts'
import { mcpContract } from '../schemas/fixtures/mcp-contract.ts'
import { jsonBody, mcpObservationsFor } from './fixtures/observations.ts'

const RUN_ID = 'mcp-run-0001'

const contract = compile(EvalContract.parse(mcpContract), { strict: true })

const toolNamed = (operationId: string): McpOperation => {
	const [declared] = contract.permittedInterfaces
	const found =
		declared === undefined
			? undefined
			: operationsOf(declared)
					.filter(isMcpOperation)
					.find((candidate) => candidate.operationId === operationId)
	if (found === undefined)
		throw new Error(`the fixture declares no tool "${operationId}"`)
	return found
}

const searchNotes = toolNamed('search-notes')

const SEARCH_RESULT = jsonBody({
	ok: true,
	matches: [{ noteId: 'n-1' }],
	totalCount: 1,
})

const observation = (
	isError: boolean,
	result: ProbeObservedBody = SEARCH_RESULT,
): McpProbeObservation => ({
	probeId: 'search',
	interfaceId: 'notes-tool-server',
	operationId: 'search-notes',
	kind: 'mcp',
	isError,
	result,
})

const TOOL_CALL_INPUTS: McpWitnessInputs = { arguments: { query: 'alpha' } }

const evidenceFor = (
	isError: boolean,
	result: ProbeObservedBody = SEARCH_RESULT,
) => {
	const raw = observation(isError, result)
	return evidenceOf(
		projectObservation(raw, searchNotes, PREFLIGHT_ARTIFACT_PATH),
		raw,
		TOOL_CALL_INPUTS,
		searchNotes,
	)
}

describe('projectObservation over a tool call', () => {
	it('projects the structured result as the body, since it is the kind’s one descriptor channel', () => {
		const projected = projectObservation(
			observation(false),
			searchNotes,
			PREFLIGHT_ARTIFACT_PATH,
		)
		expect(projected.body).toEqual(SEARCH_RESULT)
		expect(projected.legId).toBe('search')
		expect(projected.interfaceId).toBe('notes-tool-server')
		expect(projected.operationId).toBe('search-notes')
	})

	// One field per kind, each null off its own kind. A tool call has neither a
	// transport status nor a process exit code.
	it('reads the tool error flag and leaves status and exitCode null', () => {
		expect(
			projectObservation(
				observation(true),
				searchNotes,
				PREFLIGHT_ARTIFACT_PATH,
			),
		).toMatchObject({ status: null, exitCode: null, toolError: true })
		expect(
			projectObservation(
				observation(false),
				searchNotes,
				PREFLIGHT_ARTIFACT_PATH,
			),
		).toMatchObject({ status: null, exitCode: null, toolError: false })
	})

	// The reason the flag is in the projection at all. Without it two legs that
	// returned the same body digest identically when one errored and one did
	// not, and the state-reset check reports a reset that never happened. The
	// assertion is over the digest itself, since that is the value the check
	// compares.
	it('digests differently for two legs whose bodies agree and whose flags do not', () => {
		const digestFor = (isError: boolean) =>
			fixtureDigest(
				[
					projectObservation(
						observation(isError),
						searchNotes,
						PREFLIGHT_ARTIFACT_PATH,
					),
				],
				PREFLIGHT_ARTIFACT_PATH,
			)
		expect(digestFor(true)).toMatch(/^sha256:[0-9a-f]{64}$/)
		expect(digestFor(true)).not.toBe(digestFor(false))
		expect(digestFor(true)).toBe(digestFor(true))
	})
})

describe('evidenceOf over a tool call', () => {
	it('puts the structured result on responseBody and leaves the command channels unobserved', () => {
		const evidence = evidenceFor(false)
		expect(evidence.responseBody).toEqual({
			ok: true,
			matches: [{ noteId: 'n-1' }],
			totalCount: 1,
		})
		expect(evidence.stdout).toEqual({ kind: 'absent' })
		expect(evidence.stderr).toEqual({ kind: 'absent' })
		expect(evidence.exitCode).toBeNull()
		expect(evidence.artifacts).toEqual({})
	})

	// `null` is the only truthful value for a transport with no header map, and
	// Story 11.5's reachability refusal is what keeps an oracle off the channel.
	it('writes responseHeaders as null', () => {
		expect(evidenceFor(false).responseHeaders).toBeNull()
	})

	// AD-26 fixed `response-status` as a number before this kind existed, so the
	// envelope's flag is spelled there as 0 and 1.
	it('writes responseStatus as 1 for a reported error and 0 otherwise', () => {
		expect(evidenceFor(true).responseStatus).toBe(1)
		expect(evidenceFor(false).responseStatus).toBe(0)
	})

	it('fills the ninth call-inputs channel with the arguments the leg sent', () => {
		expect(evidenceFor(false).callInputs.arguments).toEqual({ query: 'alpha' })
	})

	it('records an absent structured result as a null responseBody', () => {
		expect(evidenceFor(false, { kind: 'absent' }).responseBody).toBeNull()
	})
})

describe('an oracle over the tool error flag', () => {
	const asserts = (literal: number): Expression => ({
		op: 'equality',
		operands: [
			{ pointer: '/interactions/search/response-status' },
			{ literal },
		],
	})

	const resolve = (isError: boolean, literal: number) =>
		resolveWitnessRelation(
			asserts(literal),
			{ search: evidenceFor(isError) },
			searchNotes,
			{},
			{},
			PREFLIGHT_ARTIFACT_PATH,
		).resolution

	// The one thing the MCP envelope offers beyond the result itself. Left as
	// `null`, `foreignChannels` would be handing a tool-use signature a
	// permitted channel every observation writes empty.
	it('resolves true against a clean call and false against an errored one', () => {
		expect(resolve(false, 0)).toBe('true')
		expect(resolve(true, 0)).toBe('false')
	})

	it('resolves the errored value the same way, in the other direction', () => {
		expect(resolve(true, 1)).toBe('true')
		expect(resolve(false, 1)).toBe('false')
	})
})

describe('anomalyOf over a tool call', () => {
	const planOf = () => planPreflight({ contract, probes: [], runId: RUN_ID })

	const cleanControlOf = (isError: boolean) => {
		const plan = planOf()
		const observations = mcpObservationsFor(plan.legs, {})
		const verdict = reducePreflight(plan, {
			observations: observations.map((each) =>
				each.kind === 'mcp'
					? { ...each, isError, result: SEARCH_RESULT }
					: each,
			),
		})
		return verdict.checks.filter((check) => check.kind === 'clean-control')
	}

	// A tool error is what a 4xx and a non-zero exit already are: the system
	// saying the call did not go through.
	it('fails the clean-control check on a control leg the tool reported an error for', () => {
		const failed = cleanControlOf(true)
		expect(failed.length).toBeGreaterThan(0)
		for (const check of failed) expect(check.outcome).toBe('failed')
		expect(failed.some((check) => check.note?.includes('tool error'))).toBe(
			true,
		)
	})

	it('satisfies it when the tool reported none', () => {
		const satisfied = cleanControlOf(false)
		expect(satisfied.length).toBeGreaterThan(0)
		for (const check of satisfied) expect(check.outcome).toBe('satisfied')
	})
})
