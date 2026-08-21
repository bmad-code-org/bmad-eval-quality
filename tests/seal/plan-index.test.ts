import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { InteractionPointer } from '../../src/core/schemas/pointer.ts'
import {
	buildPlanIndex,
	parseEvidenceTarget,
	resolveOperation,
	resolveStep,
} from '../../src/core/seal/plan-index.ts'
import { gateCInteractionPlan, gateCPermittedInterfaces } from './fixtures.ts'

describe('parseEvidenceTarget', () => {
	it('parses a scalar response-status channel with no tail', () => {
		expect(parseEvidenceTarget('/interactions/poll/response-status')).toEqual({
			stepId: 'poll',
			channel: 'response-status',
			transportChannel: null,
			tail: [],
		})
	})

	it('parses a scalar exit-code channel with no tail', () => {
		expect(parseEvidenceTarget('/interactions/run/exit-code')).toEqual({
			stepId: 'run',
			channel: 'exit-code',
			transportChannel: null,
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
			transportChannel: null,
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
			transportChannel: 'path',
			tail: ['id'],
		})
		expect(
			parseEvidenceTarget('/interactions/submit/call-inputs/query/limit'),
		).toMatchObject({ transportChannel: 'query', tail: ['limit'] })
		expect(
			parseEvidenceTarget(
				'/interactions/submit/call-inputs/header/Idempotency-Key',
			),
		).toMatchObject({ transportChannel: 'header', tail: ['Idempotency-Key'] })
		expect(
			parseEvidenceTarget('/interactions/submit/call-inputs/body/filters'),
		).toMatchObject({ transportChannel: 'body', tail: ['filters'] })
	})

	it('parses a call-inputs pointer targeting the whole transport channel, with no tail', () => {
		expect(
			parseEvidenceTarget('/interactions/submit/call-inputs/body'),
		).toEqual({
			stepId: 'submit',
			channel: 'call-inputs',
			transportChannel: 'body',
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

	it('throws TypeError on a call-inputs pointer with no transport channel', () => {
		expect(() => parseEvidenceTarget('/interactions/x/call-inputs')).toThrow(
			TypeError,
		)
	})

	it('throws TypeError on a call-inputs pointer whose next segment is not a transport channel', () => {
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
		if (firstInterface === undefined)
			throw new Error('fixture missing an interface')
		const duplicated = [...gateCPermittedInterfaces, firstInterface]
		expect(() => buildPlanIndex(gateCInteractionPlan, duplicated)).toThrow(
			TypeError,
		)
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
		expect(resolveOperation(index, 'get-export').method).toBe('GET')
	})

	it('resolveOperation throws TypeError on an operation the interfaces do not declare', () => {
		expect(() => resolveOperation(index, 'nope')).toThrow(TypeError)
	})
})

// A structural boundary check, not a `core/` logic test: AD-30's in-memory-
// fixtures-only convention protects `core/`'s pure FUNCTIONS from filesystem
// and network I/O so scoring stays deterministic and fast, and this asserts a
// fact about the SOURCE TEXT itself (an architectural import boundary) rather
// than exercising any of `core/seal/`'s runtime behavior: the same category
// as a lint rule, which this project already runs as `biome check` rather
// than as an in-memory unit test. There is no way to answer "does this module
// import from core/compile" without reading its source text somehow, since
// ES modules expose no runtime reflection over their own import graph, and
// adding a new `scripts/check-*.ts` for one two-line assertion would need a
// new `npm run validate` entry this story's own scope (AC 5) rules out. Kept
// here, in `tests/seal/`, as the pragmatic middle ground: driven by
// `readdirSync` over `src/core/seal/` rather than a hand-written file list
// (patch 12's review found the prior version checked only `plan-index.ts`,
// and story 2.2's own fix of hand-extending the array to four files repeated
// the same defect the guard's purpose already disclaims: "the whole
// directory, not a fixed list"; the next file landing in `core/seal/` is
// scanned automatically with no test edit required), and reading each file's
// `import ... from '...'` specifiers precisely rather than a blanket
// substring search over the whole file, so a comment merely mentioning
// "compile" cannot produce a false positive and an import specifier is what
// is actually checked. Full transitive resolution through `../schemas/*` is
// not attempted: the Structural Seed states `core/` imports `core/schemas`
// only, and Epic 4 has not built `core/compile/` at all yet, so there is
// nothing for a schema module to import from it today.
describe('module boundary', () => {
	it('none of the core/seal/ modules imports from a not-yet-built core/compile/, directly or via its own import specifiers', () => {
		const sealDir = new URL('../../src/core/seal/', import.meta.url)
		// `withFileTypes` + `isFile()` rather than a bare name-based filter, so a
		// hypothetical future subdirectory whose name happens to end in `.ts`
		// (e.g. a nested `fixtures.ts/` directory) can't reach `readFileSync`
		// and throw `EISDIR`.
		const files = readdirSync(sealDir, { withFileTypes: true })
			.filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
			.map((entry) => entry.name)
		expect(files.length).toBeGreaterThan(0)
		for (const file of files) {
			const source = readFileSync(new URL(file, sealDir), 'utf-8')
			const specifiers = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(
				(match) => match[1],
			)
			expect(specifiers.length).toBeGreaterThan(0)
			for (const specifier of specifiers) {
				expect(specifier).not.toMatch(/core\/compile/)
			}
		}
	})
})
