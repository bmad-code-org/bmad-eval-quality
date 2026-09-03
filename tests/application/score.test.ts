/**
 * `runScore` (Story 8.4): the one orchestration call chaining `ingest` ->
 * `score` -> `emit`, plus the two port-awaiting digest checks Story 8.1 and
 * 8.3 routed here. One clean fixture chain reused across every I/O Matrix
 * row, mutated one field at a time -- see `fixtures/score-fixtures.ts`.
 */
import { describe, expect, it, vi } from 'vitest'
import { runScore } from '../../src/application/score.ts'
import * as emitModule from '../../src/core/emit/emit.ts'
import * as ingestModule from '../../src/core/ingest/index.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import * as scoreModule from '../../src/core/score/score.ts'
import type { CorpusPort } from '../../src/ports/corpus-port.ts'
import {
	corpusDigestFixture,
	evaluatorConfigurationFixture,
	isolationManifestBytes,
	isolationManifestBytesDigest,
	isolationManifestFixtureForScore,
	passingPreflightVerdictForScore,
	privateArtifactManifestFixtureForScore,
	privateEntryBytes,
	scoreContractFixture,
	scoreProbeFixture,
	scoringPolicyFixtureForScore,
	sealedRunRecordFixtureForScore,
} from './fixtures/score-fixtures.ts'

/** A hand-written fake, never the real adapter (AD-30). */
const fakeCorpusPort = (
	bytesByRef: Readonly<Record<string, Uint8Array<ArrayBuffer>>>,
): CorpusPort => ({
	resolve: vi.fn(async (request: { privateRef: string }) => {
		const bytes = bytesByRef[request.privateRef]
		if (bytes === undefined) {
			throw new Error(
				`the fake corpus has no privateRef "${request.privateRef}"`,
			)
		}
		return { privateRef: request.privateRef, bytes }
	}),
})

const DEFAULT_PORT = fakeCorpusPort({
	'opaque:isolation-manifest-1': isolationManifestBytes,
	'opaque:private-entry-1': privateEntryBytes,
})

const run = (overrides: Partial<Parameters<typeof runScore>[0]> = {}) =>
	runScore({
		record: sealedRunRecordFixtureForScore,
		manifest: isolationManifestFixtureForScore,
		configuration: evaluatorConfigurationFixture,
		contract: scoreContractFixture,
		probe: scoreProbeFixture,
		preflightVerdict: passingPreflightVerdictForScore,
		policy: scoringPolicyFixtureForScore,
		privateManifest: null,
		corpusDigest: corpusDigestFixture,
		port: DEFAULT_PORT,
		signal: new AbortController().signal,
		...overrides,
	})

const faultOf = async (act: () => Promise<unknown>): Promise<RuntimeFault> => {
	let thrown: unknown
	try {
		await act()
	} catch (error) {
		thrown = error
	}
	expect(thrown).toBeInstanceOf(RuntimeFault)
	return thrown as RuntimeFault
}

describe('runScore: the boundary parses every declared input', () => {
	it('throws schema-parse-failure naming SealedRunRecord on an unparseable record', async () => {
		const fault = await faultOf(() =>
			run({ record: { not: 'a record' } as never }),
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('SealedRunRecord')
	})

	it('throws schema-parse-failure naming EvalContract on an unparseable contract', async () => {
		const fault = await faultOf(() =>
			run({ contract: { not: 'a contract' } as never }),
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('EvalContract')
	})

	it('throws schema-parse-failure naming Probe on an unparseable probe', async () => {
		const fault = await faultOf(() =>
			run({ probe: { not: 'a probe' } as never }),
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('Probe')
	})

	it('throws schema-parse-failure naming IsolationManifest on an unparseable manifest', async () => {
		const fault = await faultOf(() =>
			run({ manifest: { not: 'a manifest' } as never }),
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('IsolationManifest')
	})

	it('throws schema-parse-failure naming ScoringVersionInputs.corpusDigest on a malformed digest', async () => {
		const fault = await faultOf(() => run({ corpusDigest: 'not-a-digest' }))
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('ScoringVersionInputs.corpusDigest')
	})

	it('accepts null for manifest and configuration alike', async () => {
		// `evaluator-configuration-absent` and `isolation-manifest-absent` are
		// AD-16/AD-24 Invalid conditions, not parse failures: a `null` for
		// either arrives declared, and the run invalidates rather than crashes.
		const result = await run({ manifest: null, configuration: null })
		expect(result.artifact).toBeNull()
		expect(result.ladder.verdict).toBeNull()
		expect(result.ladder.exitCode).toBe(3)
	})
})

describe('runScore: the full chain over the I/O & Edge-Case Matrix', () => {
	it('Full chain, PASS: writes an artifact and resolves exit 0', async () => {
		const result = await run()
		expect(result.ladder).toEqual({
			verdict: 'PASS',
			exitCode: 0,
			strictPromotable: true,
			basis: [],
		})
		expect(result.artifact).not.toBeNull()
		expect(result.artifact?.mode).toBe('production')
		if (result.artifact?.mode === 'production') {
			expect(result.artifact.productionVerdict).toBe('PASS')
		}
		expect(result.artifact?.exitCode).toBe(0)
		expect(result.artifact?.scoringVersionInputs.corpusDigest).toBe(
			corpusDigestFixture,
		)
		// AD-11: `fixtureDigest` is `preflightVerdict.fixtureDigest`, restated.
		expect(result.artifact?.scoringVersionInputs.fixtureDigest).toBe(
			passingPreflightVerdictForScore.fixtureDigest,
		)
		expect(
			result.artifact?.scoringVersionInputs.evaluatorConfigurationDigest,
		).toBe(sealedRunRecordFixtureForScore.evaluatorConfigurationDigest)
	})

	it('FAIL verdict: an ingested FAIL recommendation resolves exit 2', async () => {
		const result = await run({
			record: {
				...sealedRunRecordFixtureForScore,
				evaluatorRecommendation: 'FAIL',
			},
		})
		expect(result.ladder.verdict).toBe('FAIL')
		expect(result.ladder.exitCode).toBe(2)
		expect(result.artifact).not.toBeNull()
	})

	it('CONCERNS + evidence-conditions-only: below the declared minimum trial count alone, exit 0 unpromoted', async () => {
		const result = await run({
			policy: { ...scoringPolicyFixtureForScore, minimumTrialCount: 2 },
		})
		expect(result.ladder.verdict).toBe('CONCERNS')
		expect(result.ladder.exitCode).toBe(0)
		expect(result.ladder.strictPromotable).toBe(false)
		expect(result.artifact).not.toBeNull()
	})

	it('CONCERNS, non-evidence-only: a coverage gap at or above a lowered floor, promotable', async () => {
		const result = await run({
			policy: { ...scoringPolicyFixtureForScore, severityFloor: 'low' },
		})
		expect(result.ladder.verdict).toBe('CONCERNS')
		expect(result.ladder.exitCode).toBe(0)
		expect(result.ladder.strictPromotable).toBe(true)
		expect(result.artifact).not.toBeNull()
	})

	it('Invalid rung: a failed pre-flight resolves exit 3 and mints no artifact', async () => {
		const result = await run({
			preflightVerdict: { ...passingPreflightVerdictForScore, passed: false },
		})
		expect(result.ladder.verdict).toBeNull()
		expect(result.ladder.exitCode).toBe(3)
		expect(result.ladder.strictPromotable).toBe(true)
		// `emit`'s own precondition: a run reaching Invalid is the signal to
		// stop before minting an artifact at all.
		expect(result.artifact).toBeNull()
	})
})

describe('runScore: the two digest-verification obligations', () => {
	it('a private-artifact-manifest entry whose resolved bytes disagree invalidates the run', async () => {
		const port = fakeCorpusPort({
			'opaque:isolation-manifest-1': isolationManifestBytes,
			'opaque:private-entry-1': new TextEncoder().encode('wrong bytes'),
		})
		const fault = await faultOf(() =>
			run({ privateManifest: privateArtifactManifestFixtureForScore, port }),
		)
		expect(fault.code).toBe('digest-mismatch')
		expect(fault.artifactPath).toBe('PrivateArtifactManifest.entries[0]')
	})

	it('a private-artifact-manifest entry whose resolved bytes agree lets the chain proceed', async () => {
		const result = await run({
			privateManifest: privateArtifactManifestFixtureForScore,
		})
		expect(result.artifact).not.toBeNull()
		expect(DEFAULT_PORT.resolve).toHaveBeenCalled()
	})

	it('a private-storage isolationManifestArtifact whose resolved bytes disagree invalidates the run', async () => {
		const port = fakeCorpusPort({
			'opaque:isolation-manifest-1': new TextEncoder().encode('wrong bytes'),
		})
		const fault = await faultOf(() => run({ port }))
		expect(fault.code).toBe('digest-mismatch')
		expect(fault.artifactPath).toBe('SealedRunRecord.isolationManifestArtifact')
	})

	it('a public-storage isolationManifestArtifact needs no port at all (Decision 3)', async () => {
		const result = await run({
			record: {
				...sealedRunRecordFixtureForScore,
				isolationManifestArtifact: {
					storage: 'public',
					path: 'evidence/manifest.json',
					privateRef: null,
					digest: isolationManifestBytesDigest,
				},
			},
			port: undefined,
		})
		expect(result.artifact).not.toBeNull()
	})

	// Round 2 peer review, blocking finding 1: `PrivateArtifactManifest.entries`
	// carries no `.min(1)`, so a `--private-manifest` with zero entries is
	// legal input with nothing to resolve, and demanding a port for it anyway
	// crashed with an unhandled TypeError instead of proceeding cleanly.
	it('an empty --private-manifest needs no port at all, even with none supplied', async () => {
		const result = await run({
			record: {
				...sealedRunRecordFixtureForScore,
				isolationManifestArtifact: {
					storage: 'public',
					path: 'evidence/manifest.json',
					privateRef: null,
					digest: isolationManifestBytesDigest,
				},
			},
			privateManifest: {
				schemaVersion: 1,
				parentDigest: null,
				revisionCount: 0,
				entries: [],
			},
			port: undefined,
		})
		expect(result.artifact).not.toBeNull()
	})

	it('a private reference with no CorpusPort supplied throws a bypass-only TypeError, never a RuntimeFault', async () => {
		await expect(run({ port: undefined })).rejects.toThrow(TypeError)
	})
})

describe('runScore: the orchestration order and the two hardcoded value parameters', () => {
	it('calls ingest, then score, then emit, exactly once each, in that order', async () => {
		const ingestSpy = vi.spyOn(ingestModule, 'ingest')
		const scoreSpy = vi.spyOn(scoreModule, 'score')
		const emitSpy = vi.spyOn(emitModule, 'emit')
		try {
			await run()
			expect(ingestSpy).toHaveBeenCalledTimes(1)
			expect(scoreSpy).toHaveBeenCalledTimes(1)
			expect(emitSpy).toHaveBeenCalledTimes(1)
			const ingestOrder = ingestSpy.mock.invocationCallOrder[0] as number
			const scoreOrder = scoreSpy.mock.invocationCallOrder[0] as number
			const emitOrder = emitSpy.mock.invocationCallOrder[0] as number
			expect(ingestOrder).toBeLessThan(scoreOrder)
			expect(scoreOrder).toBeLessThan(emitOrder)
		} finally {
			vi.restoreAllMocks()
		}
	})

	it('calls score with waiver "none" and evaluationFault false: neither has a declared-input source (Decision 9)', async () => {
		const scoreSpy = vi.spyOn(scoreModule, 'score')
		try {
			await run()
			const call = scoreSpy.mock.calls[0]
			expect(call?.[5]).toBe('none')
			expect(call?.[6]).toBe(false)
		} finally {
			vi.restoreAllMocks()
		}
	})
})
