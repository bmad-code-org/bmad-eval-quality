/**
 * What the state-reset check compares for one leg once an operation declares
 * `stateResetPointers`, over the three kinds of interface. The reducer tests in
 * `reduce.test.ts` drive the api kind through a whole verdict; these hold the
 * transport fields of the command and tool-call kinds, and the edges of the
 * pointer read, at the projection itself.
 */
import { describe, expect, it } from 'vitest'
import { digestArtifact } from '../../src/core/canonical/digest.ts'
import { compile } from '../../src/core/compile/compile.ts'
import {
	isCommandOperation,
	isMcpOperation,
} from '../../src/core/declared-inputs.ts'
import {
	PREFLIGHT_ARTIFACT_PATH,
	projectObservation,
	stateResetProjection,
} from '../../src/core/preflight/projection.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import type { AnyOperation } from '../../src/core/schemas/interface.ts'
import { operationsOf } from '../../src/core/schemas/interface.ts'
import type {
	CommandProbeObservation,
	McpProbeObservation,
	ProbeObservation,
	ProbeObservedBody,
} from '../../src/core/schemas/port-messages.ts'
import { commandContract } from '../schemas/fixtures/command-contract.ts'
import { mcpContract } from '../schemas/fixtures/mcp-contract.ts'
import { jsonBody } from './fixtures/observations.ts'

const operationOf = (
	raw: unknown,
	match: (operation: AnyOperation) => boolean,
): AnyOperation => {
	const contract = compile(EvalContract.parse(raw), { strict: true })
	for (const declared of contract.permittedInterfaces)
		for (const operation of operationsOf(declared))
			if (match(operation)) return operation
	throw new Error('the fixture declares no such operation')
}

const withPointers = (
	operation: AnyOperation,
	stateResetPointers: string[] | undefined,
): AnyOperation => ({ ...operation, stateResetPointers }) as AnyOperation

const search = operationOf(mcpContract, isMcpOperation)
const select = operationOf(commandContract, isCommandOperation)

const digestOf = (observation: ProbeObservation, operation: AnyOperation) =>
	digestArtifact(
		stateResetProjection(
			projectObservation(observation, operation, PREFLIGHT_ARTIFACT_PATH),
			operation,
		),
		PREFLIGHT_ARTIFACT_PATH,
	)

const tool = (
	operation: AnyOperation,
	patch: Partial<McpProbeObservation>,
): McpProbeObservation => ({
	probeId: 'leg',
	interfaceId: 'notes-tool-server',
	operationId: operation.operationId,
	kind: 'mcp',
	isError: false,
	result: jsonBody({ ok: true, matches: [], totalCount: 1 }),
	...patch,
})

const run = (
	operation: AnyOperation,
	patch: Partial<CommandProbeObservation>,
): CommandProbeObservation => ({
	probeId: 'leg',
	interfaceId: 'fragment-selection-runner',
	operationId: operation.operationId,
	kind: 'cli',
	exitCode: 0,
	stdout: jsonBody({ fragments: ['a'] }),
	stderr: { kind: 'absent' },
	artifacts: {},
	...patch,
})

describe('the tool-call kind', () => {
	const declared = withPointers(search, ['/ok'])

	it('fails on the error flag even when every listed pointer agrees', () => {
		expect(digestOf(tool(declared, { isError: false }), declared)).not.toBe(
			digestOf(
				tool(declared, {
					isError: true,
					result: jsonBody({ ok: true, matches: [], totalCount: 1 }),
				}),
				declared,
			),
		)
	})

	it('agrees when only the body outside the listed pointers differs', () => {
		expect(
			digestOf(
				tool(declared, { result: jsonBody({ ok: true, totalCount: 1 }) }),
				declared,
			),
		).toBe(
			digestOf(
				tool(declared, { result: jsonBody({ ok: true, totalCount: 9 }) }),
				declared,
			),
		)
	})
})

describe('the command kind', () => {
	const declared = withPointers(select, ['/fragments'])

	it('fails on the exit code even when every listed pointer agrees', () => {
		expect(digestOf(run(declared, { exitCode: 0 }), declared)).not.toBe(
			digestOf(run(declared, { exitCode: 1 }), declared),
		)
	})

	it('agrees when only the stderr text differs', () => {
		expect(
			digestOf(
				run(declared, { stderr: { kind: 'text', value: 'a' } }),
				declared,
			),
		).toBe(
			digestOf(
				run(declared, { stderr: { kind: 'text', value: 'b' } }),
				declared,
			),
		)
	})
})

describe('the pointer read', () => {
	const declared = withPointers(search, ['/ok'])
	const bodyOf = (result: ProbeObservedBody) =>
		digestOf(tool(declared, { result }), declared)

	it('keeps null and absent apart, so a field that went missing is a difference', () => {
		expect(bodyOf(jsonBody({ ok: null }))).not.toBe(bodyOf(jsonBody({})))
	})

	it('reads only own keys, so an inherited name resolves to nothing without a fault', () => {
		const inherited = withPointers(search, ['/constructor'])
		const read = (result: ProbeObservedBody) =>
			digestOf(tool(inherited, { result }), inherited)
		expect(read(jsonBody({ a: 1 }))).toBe(read(jsonBody({ a: 2 })))
	})

	it('digests the whole projection when the operation declares no pointers', () => {
		const whole = withPointers(search, undefined)
		expect(
			digestOf(tool(whole, { result: jsonBody({ ok: true, x: 1 }) }), whole),
		).not.toBe(
			digestOf(tool(whole, { result: jsonBody({ ok: true, x: 2 }) }), whole),
		)
	})
})
