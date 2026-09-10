import { describe, expect, it } from 'vitest'
import {
	isApiOperation,
	isMcpOperation,
} from '../../src/core/declared-inputs.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { PermittedInterface } from '../../src/core/schemas/interface.ts'
import { InteractionPointer } from '../../src/core/schemas/pointer.ts'
import {
	buildPlanIndex,
	parseEvidenceTarget,
	resolveOperation,
	resolveStep,
} from '../../src/core/seal/plan-index.ts'
import { commandContract } from '../schemas/fixtures/command-contract.ts'
import { mcpContract } from '../schemas/fixtures/mcp-contract.ts'
import { gateCInteractionPlan, gateCPermittedInterfaces } from './fixtures.ts'

describe('parseEvidenceTarget', () => {
	it('parses a scalar response-status channel with no tail', () => {
		expect(parseEvidenceTarget('/interactions/poll/response-status')).toEqual({
			stepId: 'poll',
			channel: 'response-status',
			inputChannel: null,
			artifactId: null,
			tail: [],
		})
	})

	it('parses a scalar exit-code channel with no tail', () => {
		expect(parseEvidenceTarget('/interactions/run/exit-code')).toEqual({
			stepId: 'run',
			channel: 'exit-code',
			inputChannel: null,
			artifactId: null,
			tail: [],
		})
	})

	it('parses a tail-bearing response-body channel with a multi-token tail', () => {
		expect(
			parseEvidenceTarget(
				'/interactions/first-page/response-body/rows/retractedAt',
			),
		).toEqual({
			stepId: 'first-page',
			channel: 'response-body',
			inputChannel: null,
			artifactId: null,
			tail: ['rows', 'retractedAt'],
		})
	})

	it('parses response-headers, stdout, and stderr, each with and without a tail', () => {
		expect(
			parseEvidenceTarget('/interactions/x/response-headers/etag'),
		).toMatchObject({
			channel: 'response-headers',
			tail: ['etag'],
		})
		expect(
			parseEvidenceTarget('/interactions/x/response-headers'),
		).toMatchObject({
			channel: 'response-headers',
			tail: [],
		})
		expect(parseEvidenceTarget('/interactions/x/stdout/line')).toMatchObject({
			channel: 'stdout',
			tail: ['line'],
		})
		expect(parseEvidenceTarget('/interactions/x/stdout')).toMatchObject({
			channel: 'stdout',
			tail: [],
		})
		expect(parseEvidenceTarget('/interactions/x/stderr/line')).toMatchObject({
			channel: 'stderr',
			tail: ['line'],
		})
		expect(parseEvidenceTarget('/interactions/x/stderr')).toMatchObject({
			channel: 'stderr',
			tail: [],
		})
	})

	it('parses every transport channel under call-inputs', () => {
		expect(
			parseEvidenceTarget('/interactions/submit/call-inputs/path/id'),
		).toEqual({
			stepId: 'submit',
			channel: 'call-inputs',
			inputChannel: 'path',
			artifactId: null,
			tail: ['id'],
		})
		expect(
			parseEvidenceTarget('/interactions/submit/call-inputs/query/limit'),
		).toMatchObject({ inputChannel: 'query', tail: ['limit'] })
		expect(
			parseEvidenceTarget(
				'/interactions/submit/call-inputs/header/Idempotency-Key',
			),
		).toMatchObject({ inputChannel: 'header', tail: ['Idempotency-Key'] })
		expect(
			parseEvidenceTarget('/interactions/submit/call-inputs/body/filters'),
		).toMatchObject({ inputChannel: 'body', tail: ['filters'] })
	})

	it('parses a call-inputs pointer targeting the whole transport channel, with no tail', () => {
		expect(
			parseEvidenceTarget('/interactions/submit/call-inputs/body'),
		).toEqual({
			stepId: 'submit',
			channel: 'call-inputs',
			inputChannel: 'body',
			artifactId: null,
			tail: [],
		})
	})

	it('decodes RFC 6901 escapes in tail tokens', () => {
		// ~1 decodes to "/" and ~0 decodes to "~"; a raw "/" cannot appear inside
		// a token, so the escaped forms are the only way to name such a key.
		expect(
			parseEvidenceTarget('/interactions/x/response-body/a~1b~0c'),
		).toMatchObject({ tail: ['a/b~c'] })
	})

	it('throws TypeError on a pointer that is not interaction-rooted', () => {
		expect(() => parseEvidenceTarget('/contract/referenceSets/x')).toThrow(
			TypeError,
		)
	})

	it('throws TypeError on an unrecognized channel', () => {
		expect(() => parseEvidenceTarget('/interactions/x/not-a-channel')).toThrow(
			TypeError,
		)
	})

	it('throws TypeError on a call-inputs pointer with no input channel', () => {
		expect(() => parseEvidenceTarget('/interactions/x/call-inputs')).toThrow(
			TypeError,
		)
	})

	it('throws TypeError on a call-inputs pointer whose next segment is not an input channel', () => {
		expect(() =>
			parseEvidenceTarget('/interactions/x/call-inputs/nope'),
		).toThrow(TypeError)
	})

	it('rejects a tail on a scalar channel, matching the schema exactly rather than accepting a flatter grammar', () => {
		// response-status is scalar (SCALAR_CHANNELS): the schema's own
		// INTERACTION_POINTER_PATTERN gives it no tail branch at all, so a
		// trailing segment here is a reject, not a tail to discard silently.
		expect(() =>
			parseEvidenceTarget('/interactions/poll/response-status/oops'),
		).toThrow(TypeError)
		expect(() =>
			parseEvidenceTarget('/interactions/run/exit-code/oops'),
		).toThrow(TypeError)
	})

	it('agrees with InteractionPointer.safeParse on acceptance for the scalar-channel-with-tail case: both reject it', () => {
		const pointer = '/interactions/poll/response-status/oops'
		expect(InteractionPointer.safeParse(pointer).success).toBe(false)
		expect(() => parseEvidenceTarget(pointer)).toThrow(TypeError)
	})

	it('agrees with InteractionPointer.safeParse on acceptance for a well-formed tail-bearing pointer: both accept it', () => {
		const pointer = '/interactions/poll/response-body/state'
		expect(InteractionPointer.safeParse(pointer).success).toBe(true)
		expect(() => parseEvidenceTarget(pointer)).not.toThrow()
	})
})

describe('buildPlanIndex', () => {
	const index = buildPlanIndex(gateCInteractionPlan, gateCPermittedInterfaces)

	it('resolves a known step and a known operation', () => {
		expect(index.stepOf('poll')).toMatchObject({
			stepId: 'poll',
			operationId: 'get-export',
		})
		expect(index.operationOf('get-export')).toMatchObject({
			operationId: 'get-export',
		})
	})

	it('returns undefined for an unresolvable step or operation id', () => {
		expect(index.stepOf('does-not-exist')).toBeUndefined()
		expect(index.operationOf('does-not-exist')).toBeUndefined()
	})

	it('groups steps sharing an operation id under stepsUsing, and returns empty for an unused operation', () => {
		const sharingGetExport = index
			.stepsUsing('get-export')
			.map((step) => step.stepId)
		expect(sharingGetExport.sort()).toEqual(['poll', 'unknown-job-read'])
		expect(index.stepsUsing('does-not-exist')).toEqual([])
	})

	it('throws TypeError on a duplicate stepId', () => {
		const firstStep = gateCInteractionPlan[0]
		if (firstStep === undefined) throw new Error('fixture missing a step')
		const duplicated = [...gateCInteractionPlan, firstStep]
		expect(() => buildPlanIndex(duplicated, gateCPermittedInterfaces)).toThrow(
			TypeError,
		)
	})

	it('throws TypeError on a duplicate operationId across permitted interfaces', () => {
		const firstInterface = gateCPermittedInterfaces[0]
		const firstOperation = firstInterface?.operations[0]
		if (firstInterface === undefined || firstOperation === undefined)
			throw new Error('fixture missing an interface or operation')
		const duplicated = [...gateCPermittedInterfaces, firstInterface]
		// The message names the id, so the throw is attributable to the
		// collision rather than to any other precondition in the builder.
		expect(() => buildPlanIndex(gateCInteractionPlan, duplicated)).toThrow(
			`duplicate operation id across permitted interfaces: ${firstOperation.operationId}`,
		)
	})

	// The duplicate bookkeeping is shared by all three kind arms, so a
	// collision across two kinds has to clear every map. Left per-arm, a
	// tool-call operation and an api operation sharing an id would each stay
	// resolvable from its own accessor and `anyOperationOf` would answer with
	// whichever map it reads first.
	it('clears an operation id two interfaces of different kinds both declare', () => {
		const firstInterface = gateCPermittedInterfaces[0]
		const firstOperation = firstInterface?.operations[0]
		if (firstInterface === undefined || firstOperation === undefined)
			throw new Error('fixture missing an interface or operation')
		const draft = structuredClone(mcpContract.permittedInterfaces[0]) as {
			operations: { operationId: string }[]
		}
		const firstTool = draft.operations[0]
		if (firstTool === undefined)
			throw new Error('the mcp fixture declares a tool')
		firstTool.operationId = firstOperation.operationId
		const collidingTool = PermittedInterface.parse(draft)
		const index = buildPlanIndex(
			gateCInteractionPlan,
			[...gateCPermittedInterfaces, collidingTool],
			{ duplicateIds: 'unresolved' },
		)
		expect(index.operationOf(firstOperation.operationId)).toBeUndefined()
		expect(index.mcpOperationOf(firstOperation.operationId)).toBeUndefined()
		expect(index.commandOperationOf(firstOperation.operationId)).toBeUndefined()
		expect(index.interfaceKindOf(firstOperation.operationId)).toBeUndefined()
		// The positive control: an index that built nothing would satisfy the
		// four assertions above.
		const untouched = firstInterface.operations[1]
		if (untouched === undefined)
			throw new Error('the fixture declares a second operation')
		expect(index.operationOf(untouched.operationId)?.operationId).toBe(
			untouched.operationId,
		)
		const survivingTool = collidingTool.operations[1]
		if (survivingTool === undefined)
			throw new Error('the mcp fixture declares a second tool')
		expect(index.mcpOperationOf(survivingTool.operationId)?.operationId).toBe(
			survivingTool.operationId,
		)
	})

	it('can mark duplicate step and operation IDs unresolved for total structural checks', () => {
		const firstStep = gateCInteractionPlan[0]
		const firstInterface = gateCPermittedInterfaces[0]
		if (firstStep === undefined || firstInterface === undefined) {
			throw new Error('fixture missing a step or interface')
		}
		const index = buildPlanIndex(
			[...gateCInteractionPlan, firstStep],
			[...gateCPermittedInterfaces, firstInterface],
			{ duplicateIds: 'unresolved' },
		)
		expect(index.stepOf(firstStep.stepId)).toBeUndefined()
		const firstOperation = firstInterface.operations[0]
		if (firstOperation === undefined)
			throw new Error('fixture missing operation')
		expect(index.operationOf(firstOperation.operationId)).toBeUndefined()
	})
})

describe('resolveStep / resolveOperation', () => {
	const index = buildPlanIndex(gateCInteractionPlan, gateCPermittedInterfaces)

	it('resolveStep returns the declared step', () => {
		expect(resolveStep(index, 'poll').operationId).toBe('get-export')
	})

	it('resolveStep throws TypeError on a step the plan does not declare', () => {
		expect(() => resolveStep(index, 'nope')).toThrow(TypeError)
	})

	it('resolveOperation returns the declared operation', () => {
		const operation = resolveOperation(index, 'get-export')
		expect(isApiOperation(operation)).toBe(true)
		if (!isApiOperation(operation)) throw new Error('fixture is api-shaped')
		expect(operation.method).toBe('GET')
	})

	// It read `operationOf` alone and threw for any kind that declares its own
	// operation shape, with a message saying the interfaces do not declare the
	// operation. They do; a different accessor held it.
	it('resolveOperation returns a command operation rather than throwing', () => {
		const commandIndex = buildPlanIndex(
			EvalContract.parse(commandContract).interactionPlan,
			EvalContract.parse(commandContract).permittedInterfaces,
		)
		expect(resolveOperation(commandIndex, 'select-fragments').operationId).toBe(
			'select-fragments',
		)
	})

	it('resolveOperation returns a tool call rather than throwing', () => {
		const parsed = EvalContract.parse(mcpContract)
		const mcpIndex = buildPlanIndex(
			parsed.interactionPlan,
			parsed.permittedInterfaces,
		)
		const operation = resolveOperation(mcpIndex, 'search-notes')
		expect(operation.operationId).toBe('search-notes')
		expect(isMcpOperation(operation)).toBe(true)
		if (!isMcpOperation(operation)) throw new Error('fixture is a tool call')
		expect(operation.toolName).toBe('search_notes')
	})

	it('resolveOperation throws TypeError on an operation the interfaces do not declare', () => {
		expect(() => resolveOperation(index, 'nope')).toThrow(TypeError)
	})
})

// The old filesystem-backed `core/seal/` -> `core/compile/` guard that lived
// here is gone: it regex-matched the literal substring "core/compile" and
// missed the normal relative import spelling real code uses. Story 4.4's
// `npm run check:layers` (`scripts/dependency-direction.ts`) supersedes it,
// parsing every file under `src/` and enforcing the whole layer graph.

describe('parseEvidenceTarget: the artifact channel', () => {
	it('parses an artifact pointer into its identifier and its tail', () => {
		expect(
			parseEvidenceTarget('/interactions/review/artifact/verdict/findings/0'),
		).toEqual({
			stepId: 'review',
			channel: 'artifact',
			inputChannel: null,
			artifactId: 'verdict',
			tail: ['findings', '0'],
		})
	})

	it('parses an artifact pointer addressing the whole file, with no tail', () => {
		expect(parseEvidenceTarget('/interactions/review/artifact/report')).toEqual(
			{
				stepId: 'review',
				channel: 'artifact',
				inputChannel: null,
				artifactId: 'report',
				tail: [],
			},
		)
	})

	// The identifier segment is mandatory, for the reason AD-26 gives for
	// `call-inputs`: a channel naming one of several things has nothing to
	// resolve against without it.
	it('rejects an artifact pointer naming no artifact', () => {
		expect(() => parseEvidenceTarget('/interactions/review/artifact')).toThrow(
			TypeError,
		)
	})
})
