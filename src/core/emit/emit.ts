/**
 * AD-24's emit stage: `score`'s widened product plus the three caller-
 * attested digests AD-11 fixes, minting the `EvidenceArtifact` this package
 * has never built until now. Pure per AD-1/AD-2, and total the way every
 * other stage in this package is: nothing here throws for a domain input.
 *
 * `comparabilityKey`, `strength`, and `remediation` are lifted verbatim from
 * `scripts/worked-example-target.ts`'s own hand-assembly (its former
 * lines 1432-1487), the field-by-field precedent this module generalises
 * from one caller-assembled record to `score`'s own widened product.
 */
import { digestArtifact } from '../canonical/digest.ts'
import { freezeArtifact } from '../lineage/freeze.ts'
import type {
	EvidenceArtifact,
	SCORING_VERSION_INPUT_NAMES,
} from '../schemas/evidence-artifact.ts'
import type { Verdict } from '../schemas/verdict.ts'
import { checkModeAgreement } from '../score/mode-agreement.ts'
import type { ScoredOutcomesAndVerdict } from '../score/score.ts'
import { buildStrengthVector } from '../score/strength.ts'
import type { EmitStage } from '../stage-contracts.ts'

const SCORING_POLICY_ARTIFACT_PATH = 'ScoringPolicy'
const SCORING_VERSION_INPUTS_ARTIFACT_PATH = 'ScoringVersionInputs'
const COMPARABILITY_KEY_ARTIFACT_PATH = 'ComparabilityKey'

/**
 * `mode` joins AD-11's three caller-attested digest names as a fourth
 * member: like them, it has no artifact source anywhere in this pipeline and
 * can only ever be caller-supplied, never re-derived by `score`.
 */
const CALLER_ATTESTED_INPUTS: readonly (typeof SCORING_VERSION_INPUT_NAMES)[number][] =
	['corpusDigest', 'fixtureDigest', 'evaluatorConfigurationDigest', 'mode']

/**
 * The stage. Builds `scoringVersionInputs`/`scoringVersion`/
 * `comparabilityKey`/the strength block/the remediation block once, shared
 * between the two mode branches, then the mode-discriminated artifact
 * literal, then calls `checkModeAgreement` immediately before returning.
 */
export const emit: EmitStage<ScoredOutcomesAndVerdict> = (
	scored,
	corpusDigest,
	fixtureDigest,
	evaluatorConfigurationDigest,
) => {
	const scoringPolicyDigest = digestArtifact(
		scored.policy,
		SCORING_POLICY_ARTIFACT_PATH,
	)

	// AD-7's declared key: the scoring policy digest plus the corpus digest
	// restricted to the probes both results cover -- here, the admitted probe
	// identifiers, sorted so array order never enters the digest.
	const comparabilityKey = digestArtifact(
		{
			scoringPolicyDigest,
			probeIds: scored.sealedProbes.admitted
				.map((entry) => entry.probe.probeId)
				.sort(),
		},
		COMPARABILITY_KEY_ARTIFACT_PATH,
	)
	const excludedProbeIds = scored.sealedProbes.rejected.map(
		(entry) => entry.probe.probeId,
	)

	const { trials, outcomes: scoredOutcomes } = scored.assessment.outcomeState
	const trialCount = `${trials.completed} completed trial${trials.completed === 1 ? '' : 's'}`
	const unreachedOracles = scoredOutcomes.filter(
		(outcome) => outcome.resolution.state === 'unreached',
	)
	// AD-21: a run that resolved `unreached` or completed fewer trials than
	// the policy's declared minimum marks the vector non-comparable rather
	// than silently comparing it.
	const comparable =
		trials.completed >= trials.declaredMinimum && unreachedOracles.length === 0
	const strengthNote = [
		`${scored.sealedProbes.admitted.length} admitted probe over ${trialCount}.`,
		trials.completed < trials.declaredMinimum
			? `Below the declared minimum of ${trials.declaredMinimum}.`
			: null,
		unreachedOracles.length > 0
			? `${unreachedOracles.map((outcome) => outcome.oracleId).join(', ')} resolved unreached.`
			: null,
		comparable ? null : 'The vector is reported and marked non-comparable.',
	]
		.filter((part): part is string => part !== null)
		.join(' ')
	const vector = buildStrengthVector(
		scored.sealedProbes.admitted,
		new Map([[scored.probe.probeId, scored.trialSetResult]]),
	)

	// `scored.ladder.verdict` is `Verdict | null`: `null` is AD-21's Invalid
	// rung, which "never becomes a contract verdict" -- a run reaching that
	// rung is the caller's own signal to stop before minting an artifact at
	// all, exactly as `scripts/worked-example-target.ts`'s own
	// `if (ladder.verdict === null) fail(...)` guard, immediately before its
	// call into this stage, already enforces. `emit` throws nothing for a
	// domain input (the one throw this stage carries is the mode-agreement
	// check below), so a verdict-less ladder reaching this point is a
	// precondition violation the same way `seal()`'s own null-direction
	// guard is one call earlier in the pipeline: trusted rather than
	// re-checked a second time.
	const verdict = scored.ladder.verdict as Verdict

	const commonFields = {
		schemaVersion: 3,
		parentDigest: null,
		// v0 mints no revision path for an evidence artifact: every `emit`
		// call is a lineage root, matching `seal.ts`'s own root-artifact
		// precedent for the one other `lineage: 'mints'` stage with a built
		// module.
		revisionCount: 0,
		runId: scored.runId,
		comparabilityKey,
		excludedProbeIds,
		exitCode: scored.ladder.exitCode,
		verdictBasis: [...scored.ladder.basis],
		callerAttestedInputs: [...CALLER_ATTESTED_INPUTS],
		trials,
		outcomes: [...scored.outcomes],
		uncitedFindings: [...scored.uncitedFindings],
		coverageGaps: [...scored.assessment.coverageGaps],
		strength: {
			denominator: `unique qualified probe identifiers exercised per class, across ${trialCount}`,
			// `matchProbeWitness` is the only reachable producer of a
			// `Strength.basis` value and it always returns `'measured'`;
			// `'reconstructed'`'s one producer is dead code in v0. No live
			// second value to select between, so this is a constant.
			basis: 'measured' as const,
			vector,
			comparable,
			note: strengthNote,
		},
		remediation: {
			// AD-12's REMEDIATION count, distinct from this artifact's own root
			// `revisionCount` above; the two are named identically only because
			// they nest at different depths.
			revisionCount: scored.contract.revisionCount,
			cap: scored.policy.remediationCap,
			// AD-12 states the package validates the cap rather than enforcing
			// it; there is no second legal value.
			capSource: 'caller-attested' as const,
			// `remediationState` is already declared `LineageChain` (`ladder.ts`):
			// reused from the assessment, never recomputed here.
			lineageChain: scored.assessment.remediationState,
		},
	}

	/**
	 * Runs the one real check this stage carries, then freezes and returns.
	 * AD-29: a stage freezes the artifact it owns, matching `seal.ts`/
	 * `preflight/reduce.ts`'s own precedent for the other two minting stages.
	 */
	const finalize = (artifact: EvidenceArtifact): EvidenceArtifact => {
		const agreement = checkModeAgreement(
			{ mode: scored.assessment.mode },
			{ mode: artifact.mode },
		)
		if (!agreement.agrees) {
			// Reachable only through a type-system bypass: `artifact.mode` is
			// stamped from `scored.assessment.mode` two lines above in every
			// branch this function builds, so the two can disagree only if a
			// caller assembled `scored` from two independently-sourced values
			// -- the future caller this check exists for, mirroring
			// `reduceTrialSet`'s own `TypeError`-for-bypass-only-input
			// precedent.
			throw new TypeError(
				`emit(): assembled an artifact whose mode ("${agreement.artifactMode}") disagrees with the assessment mode ("${agreement.recordMode}") it was built from`,
			)
		}
		return freezeArtifact(artifact)
	}

	if (scored.assessment.mode === 'production') {
		const scoringVersionInputs = {
			contractSchemaVersion: scored.contract.schemaVersion,
			corpusDigest,
			fixtureDigest,
			evaluatorConfigurationDigest,
			scoringPolicyDigest,
			mode: 'production' as const,
		}
		const artifact: Extract<EvidenceArtifact, { mode: 'production' }> = {
			...commonFields,
			mode: 'production',
			scoringVersionInputs,
			scoringVersion: digestArtifact(
				scoringVersionInputs,
				SCORING_VERSION_INPUTS_ARTIFACT_PATH,
			),
			productionVerdict: verdict,
		}
		return finalize(artifact)
	}

	const scoringVersionInputs = {
		contractSchemaVersion: scored.contract.schemaVersion,
		corpusDigest,
		fixtureDigest,
		evaluatorConfigurationDigest,
		scoringPolicyDigest,
		mode: 'contract-scoring' as const,
	}
	const artifact: Extract<EvidenceArtifact, { mode: 'contract-scoring' }> = {
		...commonFields,
		mode: 'contract-scoring',
		scoringVersionInputs,
		scoringVersion: digestArtifact(
			scoringVersionInputs,
			SCORING_VERSION_INPUTS_ARTIFACT_PATH,
		),
		contractVerdict: verdict,
		uncitedFindingGaps: [...scored.assessment.uncitedDefectFindings],
		systemRecommendationRecorded:
			scored.assessment.systemRecommendationRecorded,
		systemRecommendationNote: scored.assessment.systemRecommendationNote,
	}
	return finalize(artifact)
}
