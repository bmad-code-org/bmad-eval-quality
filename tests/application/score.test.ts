/**
 * `runScore` (Story 8.4): the one orchestration call chaining `ingest` ->
 * `score` -> `emit`, plus the two port-awaiting digest checks Story 8.1 and
 * 8.3 routed here. One clean fixture chain reused across every I/O Matrix
 * row, mutated one field at a time -- see `fixtures/score-fixtures.ts`.
 */
import { describe, expect, it, vi } from 'vitest'
import { POLICY } from '../../scripts/worked-example-shared.ts'
import {
	DesignatedOracleRefusal,
	runScore,
} from '../../src/application/score.ts'
import * as emitModule from '../../src/core/emit/emit.ts'
import * as ingestModule from '../../src/core/ingest/index.ts'
import { EVAL_CONTRACT_SCHEMA_VERSION } from '../../src/core/schemas/eval-contract.ts'
import {
	EVALUATOR_CONFIGURATION_SCHEMA_VERSION,
	EvaluatorConfiguration,
} from '../../src/core/schemas/evaluator-configuration.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import {
	ISOLATION_MANIFEST_SCHEMA_VERSION,
	IsolationManifest,
} from '../../src/core/schemas/isolation-manifest.ts'
import {
	PREFLIGHT_VERDICT_SCHEMA_VERSION,
	PreflightVerdict,
} from '../../src/core/schemas/preflight-verdict.ts'
import {
	PRIVATE_ARTIFACT_MANIFEST_SCHEMA_VERSION,
	PrivateArtifactManifest,
} from '../../src/core/schemas/private-artifact-manifest.ts'
import {
	PROBE_SCHEMA_VERSION,
	Probe as ProbeSchema,
} from '../../src/core/schemas/probe.ts'
import {
	SCORING_POLICY_SCHEMA_VERSION,
	ScoringPolicy,
} from '../../src/core/schemas/scoring-policy.ts'
import { SEALED_RUN_RECORD_SCHEMA_VERSION } from '../../src/core/schemas/sealed-run-record.ts'
import * as scoreModule from '../../src/core/score/score.ts'
import { compareDominance } from '../../src/core/score/strength.ts'
import type { CorpusPort } from '../../src/ports/corpus-port.ts'
import {
	canary,
	defectFinding,
	defectFired,
} from '../score/fixtures/probe-witness.ts'
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
	twoOracleIsolationManifestFixtureForScore,
	twoOracleScoreContractFixture,
	twoOracleSealedRunRecordFixtureForScore,
	unqualifiedProbeFixture,
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

const defectTrial = (trialIndex: number, caught: boolean) => ({
	...sealedRunRecordFixtureForScore,
	trialIndex,
	oracleDispositions: [
		{
			oracleId: 'O-001',
			disposition: 'violated' as const,
			observationIds: ['obs-2'],
			note: null,
		},
	],
	findings: caught
		? [defectFinding(['obs-2'], { probeId: scoreProbeFixture.probeId })]
		: [],
	observations: [defectFired],
})

const scoreTrials = (records: ReturnType<typeof defectTrial>[]) =>
	run({ record: records, policy: POLICY })

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

	it('rejects an empty trial set and names the record list', async () => {
		const fault = await faultOf(() => run({ record: [] }))
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('SealedRunRecord[]')
	})

	it('parses every record in a trial set', async () => {
		const fault = await faultOf(() =>
			run({
				record: [sealedRunRecordFixtureForScore, { not: 'a record' } as never],
			}),
		)
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('SealedRunRecord[]')
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

describe('runScore: the record stamp is read before the record parses', () => {
	const stale = SEALED_RUN_RECORD_SCHEMA_VERSION - 1

	it('names a record stamped one version below, with both versions, at its trial', async () => {
		const fault = await faultOf(() =>
			run({
				record: { ...sealedRunRecordFixtureForScore, schemaVersion: stale },
			}),
		)
		expect(fault.code).toBe('schema-version-mismatch')
		expect(fault.artifactPath).toBe(
			`SealedRunRecord[trialIndex=${sealedRunRecordFixtureForScore.trialIndex}].schemaVersion`,
		)
		expect(fault.message).toContain(
			`carries "schemaVersion" ${stale} where this build reads ${SEALED_RUN_RECORD_SCHEMA_VERSION}`,
		)
	})

	// The record a caller assembled against the previous build: its
	// observations name no body encoding. Parsed first it would
	// fail as an anonymous `schema-parse-failure`.
	const versionSevenRecord = () => ({
		...sealedRunRecordFixtureForScore,
		schemaVersion: 7,
		observations: sealedRunRecordFixtureForScore.observations.map(
			({ callInputs, ...rest }) => {
				const { bodyEncoding: _bodyEncoding, ...previousInputs } = callInputs
				return { ...rest, callInputs: previousInputs }
			},
		),
	})

	it('refuses a version 7 record with schema-version-mismatch naming 7 and 8, before its shape is parsed', async () => {
		const fault = await faultOf(() =>
			run({ record: [versionSevenRecord()] as never }),
		)
		expect(fault.code).toBe('schema-version-mismatch')
		expect(fault.artifactPath).toBe(
			`SealedRunRecord[trialIndex=${sealedRunRecordFixtureForScore.trialIndex}].schemaVersion`,
		)
		expect(fault.message).toContain(
			'carries "schemaVersion" 7 where this build reads 8',
		)
	})

	it('reports the stamp of a record whose shape is also the previous version', async () => {
		const { observations: _dropped, ...previousShape } =
			sealedRunRecordFixtureForScore
		const fault = await faultOf(() =>
			run({ record: { ...previousShape, schemaVersion: stale } as never }),
		)
		expect(fault.code).toBe('schema-version-mismatch')
	})

	it('reports the stamp of a previous-shape record passed as a list, the way the CLI always passes it', async () => {
		const { observations: _dropped, ...previousShape } =
			sealedRunRecordFixtureForScore
		const fault = await faultOf(() =>
			run({
				record: [{ ...previousShape, schemaVersion: stale }] as never,
			}),
		)
		expect(fault.code).toBe('schema-version-mismatch')
		expect(fault.artifactPath).toBe(
			`SealedRunRecord[trialIndex=${sealedRunRecordFixtureForScore.trialIndex}].schemaVersion`,
		)
	})

	it('names the trial index of the stale record among several, never its position', async () => {
		const fault = await faultOf(() =>
			run({
				record: [
					sealedRunRecordFixtureForScore,
					{
						...sealedRunRecordFixtureForScore,
						trialIndex: 5,
						schemaVersion: stale,
					},
				],
			}),
		)
		expect(fault.code).toBe('schema-version-mismatch')
		expect(fault.artifactPath).toBe(
			'SealedRunRecord[trialIndex=5].schemaVersion',
		)
	})

	it('names the position of a stale record that carries no numeric trial index', async () => {
		const { trialIndex: _trial, ...untrialed } = sealedRunRecordFixtureForScore
		const fault = await faultOf(() =>
			run({
				record: [
					sealedRunRecordFixtureForScore,
					{ ...untrialed, schemaVersion: stale },
				] as never,
			}),
		)
		expect(fault.code).toBe('schema-version-mismatch')
		expect(fault.artifactPath).toBe('SealedRunRecord[index=1].schemaVersion')
	})

	it.each([
		['a null record', null],
		['a list holding a null record', [null]],
	])('leaves %s to the parse', async (_name, record) => {
		const fault = await faultOf(() => run({ record: record as never }))
		expect(fault.code).toBe('schema-parse-failure')
	})

	it('leaves a record with no numeric stamp to the parse, which names the field', async () => {
		const { schemaVersion: _stamp, ...unstamped } =
			sealedRunRecordFixtureForScore
		const fault = await faultOf(() => run({ record: unstamped as never }))
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe('SealedRunRecord')
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

	it('three trials satisfy the default policy minimum and produce a comparable strength vector', async () => {
		const result = await run({
			record: [
				sealedRunRecordFixtureForScore,
				{ ...sealedRunRecordFixtureForScore, trialIndex: 2 },
				{ ...sealedRunRecordFixtureForScore, trialIndex: 3 },
			],
			policy: POLICY,
		})
		expect(result.ladder.verdict).toBe('PASS')
		expect(result.artifact?.trials).toEqual({
			completed: 3,
			completedAttempts: [1, 2, 3],
			declaredMinimum: 3,
			invalidatedAttempts: [],
		})
		expect(result.artifact?.strength.comparable).toBe(true)
		expect(result.artifact?.strength.note).toContain('3 completed trials')
		expect(result.artifact?.verdictBasis).not.toContain(
			'3 completed trials below the declared minimum of 3',
		)
	})

	it('compares the reduced majority for mixed trial states', async () => {
		const caughtMajority = await scoreTrials([
			defectTrial(1, true),
			defectTrial(2, true),
			defectTrial(3, false),
		])
		const missedMajority = await scoreTrials([
			defectTrial(1, true),
			defectTrial(2, false),
			defectTrial(3, false),
		])
		const a = caughtMajority.artifact
		const b = missedMajority.artifact
		expect(a?.reducedProbeOutcomes).toEqual([
			{
				probeId: 'P-001',
				severity: 'low',
				exercised: true,
				caught: true,
				catchThreshold: 0.5,
				trialVotes: [
					{ trialIndex: 1, state: 'caught' },
					{ trialIndex: 2, state: 'caught' },
					{ trialIndex: 3, state: 'missed' },
				],
				validCount: 3,
				caughtCount: 2,
				invalidatedAttempts: [],
			},
		])
		expect(b?.reducedProbeOutcomes[0]).toMatchObject({
			exercised: true,
			caught: false,
			validCount: 3,
			caughtCount: 1,
		})
		expect(a).not.toBeNull()
		expect(b).not.toBeNull()
		expect(compareDominance(a!, b!, 'low')).toBe('a-dominates-b')
	})

	it('emits probe severity when a selected finding has a different severity', async () => {
		const probe = { ...canary, probeId: 'P-002' }
		const result = await run({
			probe,
			record: {
				...sealedRunRecordFixtureForScore,
				oracleDispositions: [
					{
						oracleId: 'O-001',
						disposition: 'violated',
						observationIds: ['obs-1'],
						note: null,
					},
				],
				findings: [
					defectFinding(['obs-1'], {
						probeId: probe.probeId,
						quote: '200',
					}),
				],
			},
		})

		expect(result.artifact).not.toBeNull()
		expect(result.artifact?.outcomes[0]?.severity).toBe('low')
		expect(result.artifact?.reducedProbeOutcomes[0]?.severity).toBe('low')
	})

	it('keeps dominance stable when caught and missed states trade trialIndex values', async () => {
		const caughtFirst = await scoreTrials([
			defectTrial(1, true),
			defectTrial(2, true),
			defectTrial(3, false),
		])
		const missedFirst = await scoreTrials([
			defectTrial(1, false),
			defectTrial(2, true),
			defectTrial(3, true),
		])
		const other = await scoreTrials([
			defectTrial(1, true),
			defectTrial(2, false),
			defectTrial(3, false),
		])
		const a = caughtFirst.artifact
		const permutedA = missedFirst.artifact
		const b = other.artifact
		expect(a?.reducedProbeOutcomes[0]).toEqual(
			expect.objectContaining({
				exercised: true,
				caught: true,
				validCount: 3,
				caughtCount: 2,
			}),
		)
		expect(permutedA?.reducedProbeOutcomes[0]).toEqual(
			expect.objectContaining({
				exercised: true,
				caught: true,
				validCount: 3,
				caughtCount: 2,
			}),
		)
		expect(
			permutedA?.outcomes.map(({ trialIndex, state }) => [trialIndex, state]),
		).toEqual([
			[1, 'missed'],
			[2, 'caught'],
			[3, 'caught'],
		])
		expect(a).not.toBeNull()
		expect(permutedA).not.toBeNull()
		expect(b).not.toBeNull()
		expect(compareDominance(a!, b!, 'low')).toBe('a-dominates-b')
		expect(compareDominance(permutedA!, b!, 'low')).toBe('a-dominates-b')
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

	it('checks a later trial private reference and identifies its trialIndex', async () => {
		const fault = await faultOf(() =>
			run({
				record: [
					sealedRunRecordFixtureForScore,
					{
						...sealedRunRecordFixtureForScore,
						trialIndex: 7,
						isolationManifestArtifact: {
							...sealedRunRecordFixtureForScore.isolationManifestArtifact,
							digest: corpusDigestFixture,
						},
					},
				],
			}),
		)
		expect(fault.code).toBe('digest-mismatch')
		expect(fault.artifactPath).toBe(
			'SealedRunRecord[trialIndex=7].isolationManifestArtifact',
		)
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

	it('a later trial missing its CorpusPort is identified by trialIndex', async () => {
		const publicReference = {
			storage: 'public' as const,
			path: 'evidence/manifest.json',
			privateRef: null,
			digest: isolationManifestBytesDigest,
		}
		await expect(
			run({
				record: [
					{
						...sealedRunRecordFixtureForScore,
						isolationManifestArtifact: publicReference,
					},
					{ ...sealedRunRecordFixtureForScore, trialIndex: 7 },
				],
				port: undefined,
			}),
		).rejects.toThrow(
			'runScore(): SealedRunRecord[trialIndex=7].isolationManifestArtifact names a private reference, but no CorpusPort was supplied',
		)
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

	it('orders a presented record list by each record trialIndex before scoring', async () => {
		const scoreSpy = vi.spyOn(scoreModule, 'score')
		try {
			await run({
				record: [
					{ ...sealedRunRecordFixtureForScore, trialIndex: 3 },
					sealedRunRecordFixtureForScore,
					{ ...sealedRunRecordFixtureForScore, trialIndex: 2 },
				],
			})
			const trials = scoreSpy.mock.calls[0]?.[1]
			expect(trials?.map((trial) => trial.trialIndex)).toEqual([1, 2, 3])
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

describe('runScore: the probe-qualification reason reaches the caller', () => {
	it('an unqualified probe returns its closed reason codes alongside the Invalid rung', async () => {
		const result = await run({ probe: unqualifiedProbeFixture })
		expect(result.ladder.verdict).toBeNull()
		expect(result.ladder.exitCode).toBe(3)
		expect(result.artifact).toBeNull()
		expect(result.qualification.qualified).toBe(false)
		expect(
			result.qualification.failures.map((failure) => failure.code),
		).toEqual(['signature-absent'])
		// The reason names where it fired, in the probe-rooted spelling a
		// structural failure uses, so a caller can point at the field.
		expect(result.qualification.failures[0]?.artifactPath).toContain(
			'.defectSignature',
		)
	})

	it('a qualified probe returns an empty reason set on the artifact-minting branch', async () => {
		const result = await run()
		expect(result.artifact).not.toBeNull()
		expect(result.qualification).toEqual({
			qualified: true,
			failures: [],
			declarationChecksRan: true,
		})
	})
})

describe('runScore: the contract stamp is read before the contract parses', () => {
	const stale = EVAL_CONTRACT_SCHEMA_VERSION - 1
	const expectNamed = (fault: RuntimeFault) => {
		expect(fault.code).toBe('schema-version-mismatch')
		expect(fault.artifactPath).toBe('EvalContract.schemaVersion')
		expect(fault.message).toContain(
			`carries "schemaVersion" ${stale} where this build reads ${EVAL_CONTRACT_SCHEMA_VERSION}`,
		)
	}

	it('names a contract of the previous shape, which would otherwise fail as an anonymous parse failure', async () => {
		const previousShape = {
			...structuredClone(scoreContractFixture),
			schemaVersion: stale,
			interactionPlan: scoreContractFixture.interactionPlan.map(
				({ interfaceId: _interfaceId, ...rest }) => rest,
			),
		}
		expectNamed(await faultOf(() => run({ contract: previousShape as never })))
	})

	it('names a contract stamped one version below in the current shape, which would otherwise pass', async () => {
		expectNamed(
			await faultOf(() =>
				run({ contract: { ...scoreContractFixture, schemaVersion: stale } }),
			),
		)
	})
})

type StampedInput = {
	readonly name: string
	readonly option:
		| 'manifest'
		| 'configuration'
		| 'probe'
		| 'preflightVerdict'
		| 'policy'
		| 'privateManifest'
	readonly artifactPath: string
	/** The artifact path of the parse fault, which names no field. */
	readonly parsePath: string
	readonly version: number
	readonly fixture: Record<string, unknown>
	/** The schema the body must satisfy for the stale-stamp fixture to claim it fits. */
	readonly schema: { safeParse(value: unknown): { success: boolean } }
	/** A field the schema requires, dropped to build the previous shape. */
	readonly requiredField: string
	readonly nullable: boolean
}

const STAMPED_INPUTS: readonly StampedInput[] = [
	{
		name: 'isolation manifest',
		option: 'manifest',
		artifactPath: 'IsolationManifest.schemaVersion',
		parsePath: 'IsolationManifest',
		version: ISOLATION_MANIFEST_SCHEMA_VERSION,
		fixture: isolationManifestFixtureForScore,
		schema: IsolationManifest,
		requiredField: 'workspaceIdentity',
		nullable: true,
	},
	{
		name: 'evaluator configuration',
		option: 'configuration',
		artifactPath: 'EvaluatorConfiguration.schemaVersion',
		parsePath: 'EvaluatorConfiguration',
		version: EVALUATOR_CONFIGURATION_SCHEMA_VERSION,
		fixture: evaluatorConfigurationFixture,
		schema: EvaluatorConfiguration,
		requiredField: 'modelSnapshot',
		nullable: true,
	},
	{
		name: 'probe',
		option: 'probe',
		artifactPath: `Probe[probeId=${scoreProbeFixture.probeId}].schemaVersion`,
		parsePath: 'Probe',
		version: PROBE_SCHEMA_VERSION,
		fixture: scoreProbeFixture,
		schema: ProbeSchema,
		requiredField: 'qualification',
		nullable: false,
	},
	{
		name: 'preflight verdict',
		option: 'preflightVerdict',
		artifactPath: 'PreflightVerdict.schemaVersion',
		parsePath: 'PreflightVerdict',
		version: PREFLIGHT_VERDICT_SCHEMA_VERSION,
		fixture: passingPreflightVerdictForScore,
		schema: PreflightVerdict,
		requiredField: 'checks',
		nullable: false,
	},
	{
		name: 'scoring policy',
		option: 'policy',
		artifactPath: 'ScoringPolicy.schemaVersion',
		parsePath: 'ScoringPolicy',
		version: SCORING_POLICY_SCHEMA_VERSION,
		fixture: scoringPolicyFixtureForScore,
		schema: ScoringPolicy,
		requiredField: 'catchThreshold',
		nullable: false,
	},
	{
		name: 'private artifact manifest',
		option: 'privateManifest',
		artifactPath: 'PrivateArtifactManifest.schemaVersion',
		parsePath: 'PrivateArtifactManifest',
		version: PRIVATE_ARTIFACT_MANIFEST_SCHEMA_VERSION,
		fixture: privateArtifactManifestFixtureForScore,
		schema: PrivateArtifactManifest,
		requiredField: 'entries',
		nullable: true,
	},
]

describe.each(STAMPED_INPUTS.map((input) => [input.name, input] as const))(
	'runScore: the %s stamp is read before it parses',
	(_name, input) => {
		// The schema refuses a stamp below 1, so the stamp a body of the current
		// shape can carry at version 1 is a newer one.
		const fitsStamps = [
			input.version + 1,
			...(input.version > 1 ? [input.version - 1] : []),
		]
		const expectNamed = (fault: RuntimeFault, stamp: number): void => {
			expect(fault.code).toBe('schema-version-mismatch')
			expect(fault.artifactPath).toBe(input.artifactPath)
			expect(fault.message).toContain(
				`carries "schemaVersion" ${stamp} where this build reads ${input.version}`,
			)
		}
		const withInput = (value: unknown) =>
			run({ [input.option]: value as never })
		const expectParseFailure = (fault: RuntimeFault): void => {
			expect(fault.code).toBe('schema-parse-failure')
			expect(fault.artifactPath).toBe(input.parsePath)
		}

		it('scores the version this build reads', async () => {
			await expect(withInput(input.fixture)).resolves.toBeDefined()
		})

		it.each(fitsStamps)(
			'names the stamp %i on a body that parses under the current schema, which would otherwise score',
			async (stamp) => {
				const body = { ...input.fixture, schemaVersion: stamp }
				expect(input.schema.safeParse(body).success).toBe(true)
				expectNamed(await faultOf(() => withInput(body)), stamp)
			},
		)

		it.each([input.version + 1, 99])(
			'names the newer stamp %i with the version this build reads',
			async (stamp) => {
				expectNamed(
					await faultOf(() =>
						withInput({ ...input.fixture, schemaVersion: stamp }),
					),
					stamp,
				)
			},
		)

		it('names the stamp of a previous-shape body, which would otherwise fail as an anonymous parse failure', async () => {
			const { [input.requiredField]: _dropped, ...previousShape } =
				input.fixture
			expectParseFailure(await faultOf(() => withInput(previousShape)))
			expectNamed(
				await faultOf(() =>
					withInput({ ...previousShape, schemaVersion: input.version - 1 }),
				),
				input.version - 1,
			)
		})

		it('leaves a body with no numeric stamp to the parse, which names the artifact', async () => {
			const { schemaVersion: _stamp, ...unstamped } = input.fixture
			expectParseFailure(await faultOf(() => withInput(unstamped)))
			expectParseFailure(
				await faultOf(() =>
					withInput({
						...input.fixture,
						schemaVersion: String(input.version),
					}),
				),
			)
		})

		if (input.nullable) {
			it('scores a null input as before', async () => {
				await expect(withInput(null)).resolves.toBeDefined()
			})
		} else {
			it('leaves a null input to the parse, which names the artifact', async () => {
				expectParseFailure(await faultOf(() => withInput(null)))
			})
		}
	},
)

describe('runScore: the probe stamp without a probe id', () => {
	it('names the stale probe without an id in its path', async () => {
		const { probeId: _id, ...anonymous } = scoreProbeFixture
		const fault = await faultOf(() =>
			run({
				probe: {
					...anonymous,
					schemaVersion: PROBE_SCHEMA_VERSION - 1,
				} as never,
			}),
		)
		expect(fault.code).toBe('schema-version-mismatch')
		expect(fault.artifactPath).toBe('Probe.schemaVersion')
	})

	it('names a stale probe the qualification gate would reject, ahead of any rejection', async () => {
		const fault = await faultOf(() =>
			run({
				probe: {
					...unqualifiedProbeFixture,
					schemaVersion: PROBE_SCHEMA_VERSION - 1,
				},
			}),
		)
		expect(fault.code).toBe('schema-version-mismatch')
	})
})

describe('runScore: a stale private manifest is refused before any port call', () => {
	it('resolves no private reference for it', async () => {
		const port = fakeCorpusPort({})
		const fault = await faultOf(() =>
			run({
				port,
				privateManifest: {
					...privateArtifactManifestFixtureForScore,
					schemaVersion: PRIVATE_ARTIFACT_MANIFEST_SCHEMA_VERSION - 1,
				},
			}),
		)
		expect(fault.code).toBe('schema-version-mismatch')
		expect(port.resolve).not.toHaveBeenCalled()
	})
})

describe('runScore: a caller-named designated oracle', () => {
	const twoOracle = (overrides: Partial<Parameters<typeof runScore>[0]> = {}) =>
		run({
			record: twoOracleSealedRunRecordFixtureForScore,
			manifest: twoOracleIsolationManifestFixtureForScore,
			contract: twoOracleScoreContractFixture,
			...overrides,
		})
	const caughtOf = (result: Awaited<ReturnType<typeof runScore>>) =>
		result.artifact?.reducedProbeOutcomes[0]?.caught

	it('omitting it keeps the single-oracle rule: a two-oracle behavior designates none and the probe is not caught', async () => {
		expect(caughtOf(await twoOracle())).toBe(false)
	})

	it('naming the oracle that owns the probe makes the probe caught', async () => {
		expect(caughtOf(await twoOracle({ designatedOracleId: 'O-002' }))).toBe(
			true,
		)
	})

	it('hands the designation to the score stage as its trailing parameter', async () => {
		const scoreSpy = vi.spyOn(scoreModule, 'score')
		try {
			await twoOracle({ designatedOracleId: 'O-002' })
			expect(scoreSpy.mock.calls[0]?.[7]).toBe('O-002')
			scoreSpy.mockClear()
			await run()
			expect(scoreSpy.mock.calls[0]?.[7]).toBeUndefined()
		} finally {
			vi.restoreAllMocks()
		}
	})

	it('does not enter the artifact: the scoring version and attested inputs match a run without it', async () => {
		const designated = await twoOracle({ designatedOracleId: 'O-002' })
		const omitted = await twoOracle()
		expect(designated.artifact?.scoringVersionInputs).toEqual(
			omitted.artifact?.scoringVersionInputs,
		)
		expect(designated.artifact?.callerAttestedInputs).toEqual(
			omitted.artifact?.callerAttestedInputs,
		)
		expect(Object.keys(designated.artifact ?? {}).sort()).toEqual(
			Object.keys(omitted.artifact ?? {}).sort(),
		)
	})

	it('naming the one oracle a single-oracle behavior lists yields the artifact omission yields', async () => {
		const designated = await run({ designatedOracleId: 'O-001' })
		expect(JSON.stringify(designated.artifact)).toBe(
			JSON.stringify((await run()).artifact),
		)
	})

	it('the same inputs with the same designation give byte-identical artifacts', async () => {
		const first = await twoOracle({ designatedOracleId: 'O-002' })
		const second = await twoOracle({ designatedOracleId: 'O-002' })
		expect(first.artifact).not.toBeNull()
		expect(JSON.stringify(first.artifact)).toBe(JSON.stringify(second.artifact))
	})

	it.each([
		['an oracle the behavior does not list', 'O-003'],
		['a malformed identifier', 'o-002'],
		['an empty identifier', ''],
	])(
		'refuses %s with a DesignatedOracleRefusal naming the flag, before any port call or score work',
		async (_name, designatedOracleId) => {
			const port = fakeCorpusPort({})
			const scoreSpy = vi.spyOn(scoreModule, 'score')
			try {
				await expect(
					twoOracle({ designatedOracleId, port }),
				).rejects.toThrowError(DesignatedOracleRefusal)
				const refusal: unknown = await twoOracle({
					designatedOracleId,
					port,
				}).catch((error: unknown) => error)
				expect((refusal as Error).name).toBe('DesignatedOracleRefusal')
				await expect(twoOracle({ designatedOracleId, port })).rejects.toThrow(
					/--designated-oracle/,
				)
				expect(port.resolve).not.toHaveBeenCalled()
				expect(scoreSpy).not.toHaveBeenCalled()
			} finally {
				vi.restoreAllMocks()
			}
		},
	)

	it('refuses an oracle the contract does not declare', async () => {
		const undeclared = {
			...twoOracleScoreContractFixture,
			oracles: twoOracleScoreContractFixture.oracles.slice(0, 1),
		}
		await expect(
			twoOracle({ contract: undeclared, designatedOracleId: 'O-002' }),
		).rejects.toThrow(/declares no oracle O-002/)
	})
})
