/**
 * Evidence artifacts minted by the real `runScore` chain, one per probe, for
 * the cases that must hold against what the engine actually emits and not
 * against a builder written beside the aggregation. The records come from the
 * `score` command's own fixture chain; only the probe identity and the trial
 * outcomes vary.
 */

import { POLICY } from '../../../scripts/worked-example-shared.ts'
import { runScore } from '../../../src/application/score.ts'
import { digestBytes } from '../../../src/core/canonical/digest.ts'
import type { EvidenceArtifact } from '../../../src/core/schemas/evidence-artifact.ts'
import type { Probe } from '../../../src/core/schemas/probe.ts'
import type { ScoringPolicy } from '../../../src/core/schemas/scoring-policy.ts'
import {
	corpusDigestFixture,
	evaluatorConfigurationFixture,
	isolationManifestBytes,
	isolationManifestFixtureForScore,
	passingPreflightVerdictForScore,
	scoreContractFixture,
	scoreProbeFixture,
	sealedRunRecordFixtureForScore,
} from '../../application/fixtures/score-fixtures.ts'
import { cleanControlProbe } from '../../schemas/fixtures/artifact-fixtures.ts'
import {
	defectFinding,
	defectFired,
} from '../../score/fixtures/probe-witness.ts'

/** The default policy: three trials, caught by a strict majority. */
export const REAL_POLICY: ScoringPolicy = POLICY

const trial = (probeId: string, trialIndex: number, caught: boolean) => ({
	...sealedRunRecordFixtureForScore,
	trialIndex,
	runId: `run-${probeId.toLowerCase()}`,
	oracleDispositions: [
		{
			oracleId: 'O-001',
			disposition: 'violated' as const,
			observationIds: ['obs-2'],
			note: null,
		},
	],
	findings: caught ? [defectFinding(['obs-2'], { probeId })] : [],
	observations: [defectFired],
})

/**
 * Scores one defect probe over `outcomes.length` trials, each caught or
 * missed, and returns the artifact the engine emitted.
 */
export async function scoreDefectProbe(
	probeId: string,
	outcomes: readonly boolean[],
	options: { readonly policy?: ScoringPolicy } = {},
): Promise<EvidenceArtifact> {
	const probe: Probe = { ...scoreProbeFixture, probeId }
	const result = await runScore({
		record: outcomes.map((caught, index) => trial(probeId, index + 1, caught)),
		manifest: {
			...isolationManifestFixtureForScore,
			runId: `run-${probeId.toLowerCase()}`,
		},
		configuration: evaluatorConfigurationFixture,
		contract: scoreContractFixture,
		probe,
		preflightVerdict: passingPreflightVerdictForScore,
		policy: options.policy ?? REAL_POLICY,
		privateManifest: null,
		corpusDigest: corpusDigestFixture,
		port: {
			resolve: async (request: { privateRef: string }) => ({
				privateRef: request.privateRef,
				bytes: isolationManifestBytes,
			}),
		},
		signal: new AbortController().signal,
	})
	if (result.artifact === null) {
		throw new Error(`the fixture chain scored ${probeId} to the Invalid rung`)
	}
	return result.artifact
}

/** The digest of the bytes the fixture's isolation-manifest reference declares. */
export const ISOLATION_MANIFEST_BYTES_DIGEST = digestBytes(
	isolationManifestBytes,
)

/**
 * Scores one clean control, `expectedClean: true`, over `trials` clean trials
 * and returns the artifact the engine emitted. Its oracles resolve
 * `passed-clean-control`, and its strength vector is all null.
 */
export async function scoreCleanControl(
	probeId: string,
	trials = 3,
): Promise<EvidenceArtifact> {
	const probe: Probe = { ...cleanControlProbe, probeId }
	const result = await runScore({
		record: Array.from({ length: trials }, (_, index) => ({
			...sealedRunRecordFixtureForScore,
			trialIndex: index + 1,
			runId: `run-${probeId.toLowerCase()}`,
		})),
		manifest: {
			...isolationManifestFixtureForScore,
			runId: `run-${probeId.toLowerCase()}`,
		},
		configuration: evaluatorConfigurationFixture,
		contract: scoreContractFixture,
		probe,
		preflightVerdict: passingPreflightVerdictForScore,
		policy: REAL_POLICY,
		privateManifest: null,
		corpusDigest: corpusDigestFixture,
		port: {
			resolve: async (request: { privateRef: string }) => ({
				privateRef: request.privateRef,
				bytes: isolationManifestBytes,
			}),
		},
		signal: new AbortController().signal,
	})
	if (result.artifact === null) {
		throw new Error(`the fixture chain scored ${probeId} to the Invalid rung`)
	}
	return result.artifact
}
