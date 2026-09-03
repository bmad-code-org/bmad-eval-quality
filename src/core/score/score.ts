/**
 * AD-24's score stage: the one orchestration over the reference functions
 * `core/score/` already ships, closing owed item 1's remaining half (a
 * trial-set shape for `validated-observations`) and giving `score.module`
 * its first real value.
 *
 * The body lifts `scripts/worked-example-target.ts:1071-1381`'s order
 * rather than designing a second one, generalised two ways that file never
 * needed: over `readonly ValidatedObservations[]` instead of one record, and
 * without ever throwing on a domain input. Every `fail()` call that script
 * used to stop on a malformed-but-schema-legal shape (a rejected probe, a
 * clean-control or canary probe with no seeded defect, an oracle with no
 * check, a resolution naming a finding the trial does not carry) is replaced
 * here by a graceful, documented fallback: a `schema-parse-failure` already
 * happened at the application boundary before any of these values reached
 * this function, so nothing left to see here is a reason to crash.
 *
 * Two of `AssessmentCommon`'s fields have no source among this stage's five
 * declared inputs and are not among its two caller-supplied parameters
 * either: `evidenceIntegrity.disclosure` (`EvidenceDisclosure`, which lives
 * only on `SealedRunRecord`, a field `ingest`'s product does not carry
 * through) and `remediationState` (`AD-12`'s remediation chain, which needs
 * a caller-presented ancestor sequence score's five inputs never carry, only
 * the current contract). Both arrive declared with a neutral value, exactly
 * the posture `ladder.ts`'s own `EvidenceIntegrityInputs` doc comment
 * already states for `overTruncated`, `unavailable`, and
 * `internallyInconsistent`: "they arrive declared rather than derived."
 * `disclosure` and `remediationState` join them on the same reasoning
 * rather than a new one.
 */

import { walkExpression } from '../compile/expression-legality.ts'
import { evaluateCoverage } from '../coverage/coverage.ts'
import {
	makePointerDenotesCollection,
	makeResolveOperand,
} from '../evaluate/evidence-resolution.ts'
import { resolveCheck } from '../evaluate/resolution.ts'
import type { ValidatedObservations } from '../ingest/ingest.ts'
import {
	type EvalContract,
	SEVERITY_LEVELS,
	type Severity,
} from '../schemas/eval-contract.ts'
import type { Outcome } from '../schemas/evidence-artifact.ts'
import type { Expression, Operand, SetOperand } from '../schemas/expression.ts'
import type { Operation } from '../schemas/interface.ts'
import type { Probe } from '../schemas/probe.ts'
import type { ScoringPolicy } from '../schemas/scoring-policy.ts'
import type { Observation } from '../schemas/sealed-run-record.ts'
import type { EvaluatorRecommendation } from '../schemas/verdict.ts'
import { buildPlanIndex } from '../seal/plan-index.ts'
import type { ScoreStage } from '../stage-contracts.ts'
import { resolveCapturedBindings, selectWithBindings } from './bindings.ts'
import type {
	ContractAssessment,
	EvidenceIntegrityInputs,
	FindingConfidence,
	LadderResolution,
	OutcomeStateInputs,
	ProductionAssessment,
	ScoredOutcome,
} from './ladder.ts'
import { resolveContractVerdict, resolveProductionVerdict } from './ladder.ts'
import {
	type CitedFinding,
	FINDING_BUCKETS,
	type FindingBucketValue,
	type JudgeConductValue,
	type OutcomeInputs,
	resolveOutcome,
	uncitedDefectFindingGaps,
	uncitedFindingIds,
} from './outcome.ts'
import {
	resolveHomeOperation,
	type SealedProbeSet,
	sealProbeSet,
} from './qualification.ts'
import {
	reduceTrialSet,
	TRIAL_VOTE_STATES,
	type TrialSetResult,
	type TrialVote,
} from './reduce-trials.ts'
import type { StepSelection } from './selection.ts'
import { mapFindings, matchProbeWitness, type SignedProbe } from './witness.ts'

/**
 * `score`'s owned product: the assessment/ladder pairing AD-24 names, "the
 * outcome and verdict values emit serializes", widened with eight more
 * fields `emit` needs to mint an `EvidenceArtifact` and cannot re-derive from
 * that pairing alone. Every one of the eight is a value this function
 * already holds locally or already receives as a parameter; none is fetched
 * anew, only carried one step further. Still not a new artifact: a plain
 * TypeScript type with no Zod schema, matching `ValidatedObservations`'
 * precedent.
 */
export type ScoredOutcomesAndVerdict = {
	readonly assessment: ProductionAssessment | ContractAssessment
	readonly ladder: LadderResolution
	/** the trial set's own run identifier, read off the first trial the same way `mode`/`evaluatorRecommendation` are. */
	readonly runId: string
	readonly contract: EvalContract
	readonly policy: ScoringPolicy
	readonly probe: Probe
	readonly sealedProbes: SealedProbeSet
	/** this probe's own AD-7 trial-set fold, keyed by `emit` under `probe.probeId` to build the strength vector. */
	readonly trialSetResult: TrialSetResult
	/** the full `EvidenceArtifact.outcomes` shape, a parallel array to `ScoredOutcome[]` above: `ScoredOutcome` carries `resolution` but not `disposition` or the raw `CheckResolution` tree this shape needs, so the two are not reconstructible from one another. */
	readonly outcomes: readonly Outcome[]
	/** every finding across every trial citing no oracle, per `outcome.ts`'s `uncitedFindingIds`. */
	readonly uncitedFindings: readonly string[]
}

type FindingRecordPick = {
	readonly observations: Observation[]
	readonly findings: ValidatedObservations['findings'][number][]
}

/** A mutable copy of the two record-shaped arrays every witness/finding function this stage calls wants, since `ValidatedObservations`' own arrays are `readonly`. */
const recordPickOf = (trial: ValidatedObservations): FindingRecordPick => ({
	observations: [...trial.observations],
	findings: [...trial.findings],
})

/**
 * Every interaction-rooted step identifier one oracle's `check` addresses.
 * Reimplemented from `scripts/worked-example-target.ts`'s own private
 * helper of the same name: nothing in `src/` exports it, and `core/` cannot
 * import `scripts/`.
 */
function addressedSteps(expression: Expression): ReadonlySet<string> {
	const found = new Set<string>()
	const take = (operand: Operand | SetOperand): void => {
		if (!('pointer' in operand)) return
		const { pointer } = operand
		if (pointer.startsWith('@')) return
		const [, root, stepId] = pointer.split('/')
		if (root === 'interactions' && stepId !== undefined) found.add(stepId)
	}
	walkExpression(expression, 0, '', { onOperand: take, onSetOperand: take })
	return found
}

/**
 * AD-40 pairs a probe with exactly one designated oracle: the one
 * discharging the behaviour its seeded defect breaks. Anchored on
 * `probe.behaviorId` rather than `probe.defects[0]?.behaviorId` (the worked
 * example's own anchor): AD-9 puts the behaviour on the probe itself, on
 * every branch and every class, while `defects` is empty on a canary and
 * absent-shaped on a clean control, so an anchor scoped to `defects[0]`
 * cannot generalise across probe classes the way this stage's "never throw
 * on a domain input" rule requires. Returns `null`, never throws, when the
 * probe's own behaviour resolves to no oracle or to more than one: a real,
 * reportable authoring gap rather than a crash.
 */
function designatedOracleIdOf(
	probe: Probe,
	contract: EvalContract,
): string | null {
	const behavior = contract.behaviors.find(
		(entry) => entry.id === probe.behaviorId,
	)
	if (behavior === undefined) return null
	if (behavior.oracles.length !== 1) return null
	return behavior.oracles[0] ?? null
}

/** A probe on the seeding branch whose signature is present, or `null` for a clean control, a canary, or a signature-less defect probe -- none of which AD-40's witness match applies to. */
function signedProbeOf(probe: Probe): SignedProbe | null {
	if (probe.expectedClean) return null
	if (probe.defectSignature === null) return null
	return probe as SignedProbe
}

/**
 * The highest severity among every behaviour this oracle discharges, the
 * same source the worked example reads (`resolution.resolvedFrom === null`
 * case). The maximum, not the first, on `coverage.ts`'s `coverageSeverity`
 * precedent: a lower reduction would let one trivial behaviour understate a
 * shared oracle's real severity. `'low'` when no behaviour names the oracle
 * at all -- a genuine authoring gap this pure function has no better signal
 * for, and never a reason to throw.
 */
function severityOfBehaviourFor(
	contract: EvalContract,
	oracleId: string,
): Severity {
	let best: Severity | null = null
	for (const behavior of contract.behaviors) {
		if (!behavior.oracles.includes(oracleId)) continue
		if (
			best === null ||
			SEVERITY_LEVELS.indexOf(behavior.severity) > SEVERITY_LEVELS.indexOf(best)
		) {
			best = behavior.severity
		}
	}
	return best ?? 'low'
}

/**
 * `judgeConduct` derives once per run, not per oracle-criterion, since no
 * schema field maps a rubric criterion to an oracle. `'absent'` is
 * `outcome.ts:75`'s own "ordinary value" case; `'malformed'` when any trial
 * carries a `judge-result-unscored` condition; `'conforming'` otherwise.
 */
function judgeConductOf(
	contract: EvalContract,
	trials: readonly ValidatedObservations[],
): JudgeConductValue {
	if (contract.rubrics.length === 0) return 'absent'
	const anyMalformed = trials.some((trial) =>
		trial.conditions.some(
			(condition) => condition.kind === 'judge-result-unscored',
		),
	)
	return anyMalformed ? 'malformed' : 'conforming'
}

/**
 * The ninth new Invalid condition: an observation whose `operationId`
 * matches an operation declared in more than one `permittedInterfaces`
 * entry. Not an `IngestCondition` -- ingest never computes it, since it has
 * no `eval-contract` input and `Observation` carries no interface
 * qualifier -- so `score.ts` renders each basis line itself.
 */
function operationIdentifierCollisionsOf(
	contract: EvalContract,
	trials: readonly ValidatedObservations[],
): readonly string[] {
	const interfacesByOperationId = new Map<string, string[]>()
	for (const iface of contract.permittedInterfaces) {
		// Deduplicated per interface first: `PermittedInterface.operations`
		// carries no uniqueness constraint, so one interface declaring the
		// same `operationId` on two different operations must still count as
		// one interface, not two, or this row would falsely fire a collision
		// naming the same interface twice.
		const operationIdsInThisInterface = new Set(
			iface.operations.map((operation) => operation.operationId),
		)
		for (const operationId of operationIdsInThisInterface) {
			const entry = interfacesByOperationId.get(operationId)
			if (entry === undefined) {
				interfacesByOperationId.set(operationId, [iface.logicalId])
			} else {
				entry.push(iface.logicalId)
			}
		}
	}
	const collisions: string[] = []
	trials.forEach((trial, trialIndex) => {
		for (const observation of trial.observations) {
			const interfaces =
				interfacesByOperationId.get(observation.operationId) ?? []
			if (interfaces.length <= 1) continue
			collisions.push(
				`trial ${trialIndex + 1} observation ${observation.observationId}: operationId "${observation.operationId}" matches operations in ${interfaces.length} permittedInterfaces entries (${interfaces.join(', ')})`,
			)
		}
	})
	return collisions
}

/**
 * The tenth new Invalid condition: a caller assembling a trial set from
 * records that disagree on `mode` or `evaluatorRecommendation`. Every trial
 * is compared against the first: a trial set is not a genuine set once one
 * trial's own value is picked as authoritative, regardless of which one, so
 * basis lines name every disagreeing pair.
 */
function trialSetDisagreementsOf(
	trials: readonly ValidatedObservations[],
): readonly string[] {
	const first = trials[0]
	if (first === undefined) return []
	const disagreements: string[] = []
	trials.forEach((trial, index) => {
		if (index === 0) return
		if (trial.mode !== first.mode) {
			disagreements.push(
				`mode: trial 1 = "${first.mode}", trial ${index + 1} = "${trial.mode}"`,
			)
		}
		if (trial.evaluatorRecommendation !== first.evaluatorRecommendation) {
			disagreements.push(
				`evaluatorRecommendation: trial 1 = "${first.evaluatorRecommendation}", trial ${index + 1} = "${trial.evaluatorRecommendation}"`,
			)
		}
	})
	return disagreements
}

/** Every `IngestCondition` of one `kind` across every trial, in trial order. */
function conditionsAcrossTrials<
	K extends ValidatedObservations['conditions'][number]['kind'],
>(
	trials: readonly ValidatedObservations[],
	kind: K,
): readonly Extract<
	ValidatedObservations['conditions'][number],
	{ kind: K }
>[] {
	return trials.flatMap((trial) =>
		trial.conditions.filter(
			(condition): condition is Extract<typeof condition, { kind: K }> =>
				condition.kind === kind,
		),
	)
}

/**
 * Reused from `reduce-trials.ts` rather than a second literal: `resolveOutcome`
 * is the one AD-6 state assigner, and re-listing the three AD-6 invalidating
 * states here would be a second place that vocabulary could drift from the
 * reducer's own `TRIAL_VOTE_STATES.invalidating` grouping.
 */
const INVALIDATING_OUTCOME_STATES: ReadonlySet<string> = new Set(
	TRIAL_VOTE_STATES.invalidating,
)

/**
 * The stage. Signature order matches `ScoreStage`'s own: the five declared
 * artifact inputs, then `waiver` and `evaluationFault`, the two documented
 * caller-supplied parameters -- neither has a source among those five, and
 * each arrives named and explicit rather than a hardcoded literal.
 */
export const score: ScoreStage<
	ValidatedObservations,
	ScoredOutcomesAndVerdict
> = (
	contract,
	trials,
	probe,
	preflightVerdict,
	policy,
	waiver,
	evaluationFault,
) => {
	// Probe sealing: once per run, never per trial, since qualification reads
	// the probe and the contract's operation inventory alone. `probeQualified`
	// reads whichever bucket the probe actually lands in -- never a throw on
	// rejection, since a rejected probe is a legitimate domain outcome the
	// existing `unqualified-probe-in-sealed-set` condition already reports.
	const homeOperationOf = (candidate: Probe): Operation | null =>
		candidate.expectedClean || candidate.defectSignature === null
			? null
			: resolveHomeOperation(
					candidate.defectSignature,
					contract.permittedInterfaces,
				)
	const sealedProbes = sealProbeSet([probe], homeOperationOf)
	const qualifiedEntry = sealedProbes.admitted[0] ?? sealedProbes.rejected[0]
	const probeQualified =
		qualifiedEntry === undefined ? false : qualifiedEntry.result.qualified

	const signedProbe = signedProbeOf(probe)
	const designatedOracleId = designatedOracleIdOf(probe, contract)
	const probeSigned = !probe.expectedClean && probe.defectSignature !== null

	// Plan indexing and the resolvers built from it: contract-only, so built
	// once and reused across every trial. `resolveCapturedBindings` walks
	// `bindingOrder`'s own tiers internally and already degrades a cyclic
	// plan to "resolves as unlisted, filters every candidate away" without
	// throwing, so this stage does not re-run that check itself.
	// `duplicateIds: 'unresolved'` rather than `buildPlanIndex`'s own default
	// `'throw'`: two `permittedInterfaces` entries sharing an operationId is
	// exactly the domain input `operationIdentifierCollisionsOf` below
	// reports as `operation-identifier-collision`, so this stage cannot let
	// the index builder crash on the same shape its own new Invalid row
	// exists to describe.
	const index = buildPlanIndex(
		contract.interactionPlan,
		contract.permittedInterfaces,
		{
			duplicateIds: 'unresolved',
		},
	)
	const pointerDenotesCollection = makePointerDenotesCollection(contract, index)
	const referenceSets = Object.fromEntries(
		Object.entries(contract.referenceSets ?? {}).map(([id, declaration]) => [
			id,
			declaration.members,
		]),
	)

	const judgeConduct = judgeConductOf(contract, trials)

	const allOutcomes: ScoredOutcome[] = []
	// The full `EvidenceArtifact.outcomes` shape, built alongside `allOutcomes`
	// above in the same loop rather than derived from it after the fact: the
	// two carry different fields from the same per-oracle locals and neither
	// is reconstructible from the other.
	const outcomes: Outcome[] = []
	const votes: TrialVote[] = []

	for (const trial of trials) {
		const captured = resolveCapturedBindings(
			contract.interactionPlan,
			index,
			trial.observations,
		)
		const selectionOf = new Map<string, StepSelection>()
		for (const step of contract.interactionPlan) {
			selectionOf.set(
				step.stepId,
				selectWithBindings(step, trial.observations, index, captured),
			)
		}

		// One observation per step, mirroring `resolveTemporalAnchor`'s own
		// rule: one match binds, several under a declared `any` binds the
		// lowest sequence, anything else binds nothing. A step this trial
		// never selected, or whose matched id names no observation, is
		// skipped rather than failed: a check addressing that step simply
		// resolves against an absent operand, which `resolveCheck` already
		// handles.
		const observationById = new Map(
			trial.observations.map((observation) => [
				observation.observationId,
				observation,
			]),
		)
		const stepObservations: Record<string, Observation> = {}
		for (const step of contract.interactionPlan) {
			const selection = selectionOf.get(step.stepId)
			if (selection === undefined) continue
			const [first] = selection.matchedObservationIds
			if (first === undefined) continue
			if (selection.result === 'several' && step.cardinality !== 'any') continue
			const observation = observationById.get(first)
			if (observation === undefined) continue
			stepObservations[step.stepId] = observation
		}
		const resolveOperand = makeResolveOperand(stepObservations, referenceSets)

		const recordPick = recordPickOf(trial)
		const witness =
			signedProbe === null
				? null
				: matchProbeWitness(
						signedProbe,
						contract.permittedInterfaces,
						recordPick,
					)
		const findingMap = mapFindings(
			[probe],
			contract.permittedInterfaces,
			recordPick,
		)
		const bucketOf = new Map<string, FindingBucketValue>()
		for (const bucket of FINDING_BUCKETS) {
			for (const entry of findingMap[bucket])
				bucketOf.set(entry.findingId, bucket)
		}

		let designatedState: string | undefined
		let firstInvalidatingState: string | undefined
		let firstState: string | undefined

		for (const oracle of contract.oracles) {
			const check = oracle.check
			const steps = check === null ? new Set<string>() : addressedSteps(check)
			const addressed = contract.interactionPlan
				.filter((step) => steps.has(step.stepId))
				.map((step) => ({
					step,
					selection: selectionOf.get(step.stepId) ?? {
						result: 'none' as const,
						matchedObservationIds: [],
					},
				}))
			const selections = addressed.map((entry) => entry.selection)
			const selectorAmbiguity = addressed.some(
				(entry) =>
					entry.selection.result === 'several' &&
					entry.step.cardinality !== 'any',
			)
			const checkResolution =
				check === null
					? null
					: resolveCheck(
							check,
							resolveOperand,
							pointerDenotesCollection,
							policy.regexMatchStepBudget,
							`EvalContract.oracles[id=${oracle.id}].check`,
						)
			// Every disposition this trial records for this oracle, not just
			// the first: `SealedRunRecord.oracleDispositions` carries no
			// uniqueness constraint on `oracleId`, and ingest's
			// `duplicate-record-identifier` condition only advisory-flags a
			// repeat, never rejects it, so two dispositions naming one oracle
			// is a legal, ambiguous input. More than one match is treated as
			// ambiguous -- `disposition: null` -- rather than silently
			// picking the array's first entry, the same guard-rather-than-pick
			// idiom `citedFinding` below already uses.
			const matchingDispositions = trial.dispositions.filter(
				(entry) => entry.oracleId === oracle.id,
			)
			const [onlyDisposition] = matchingDispositions
			const disposition =
				matchingDispositions.length === 1 && onlyDisposition !== undefined
					? onlyDisposition
					: null
			// Every defect finding this trial cites against this oracle, not
			// just the first: two distinct findings citing the same oracle is
			// schema-legal and not caught by ingest's `duplicate-record-identifier`
			// (that one is keyed by `findingId`, not `oracleId`). Picking either
			// one arbitrarily would make the outcome depend on array order, so
			// more than one match is treated as ambiguous -- `citedFinding: null`
			// -- rather than silently choosing one, the same guard-rather-than-pick
			// idiom `outcomesByProbeId` (`strength.ts`) already uses.
			const defectFindingsForOracle = trial.findings.filter(
				(finding) =>
					finding.findingType === 'defect' && finding.oracleId === oracle.id,
			)
			const [onlyDefectFinding] = defectFindingsForOracle
			const citedFinding: CitedFinding | null =
				defectFindingsForOracle.length === 1 && onlyDefectFinding !== undefined
					? {
							findingId: onlyDefectFinding.findingId,
							// `mapFindings` buckets every defect finding in this trial, so a
							// miss here cannot happen for a finding this same trial
							// produced; the fallback is fail-closed, never a throw.
							bucket: bucketOf.get(onlyDefectFinding.findingId) ?? 'dangling',
						}
					: null

			const inputs: OutcomeInputs = {
				required: true,
				disposition,
				citedFinding,
				witness:
					designatedOracleId !== null && oracle.id === designatedOracleId
						? witness
						: null,
				selections,
				selectorAmbiguity,
				checkResolution:
					checkResolution === null ? null : checkResolution.resolution,
				polarity: oracle.polarity,
				probeClass: probe.probeClass,
				expectedClean: probe.expectedClean,
				probeSigned,
				probeQualified,
				waiver,
				judgeConduct,
				evaluationFault,
			}
			const resolution = resolveOutcome(inputs)
			// The same ambiguity guard as `disposition` and `citedFinding`
			// above: `findingId` carries no uniqueness constraint either (also
			// only advisory-flagged by `duplicate-record-identifier`, subject
			// `'finding'`), so two findings sharing `resolution.resolvedFrom`
			// is legal. Reading either one's `.severity` would make the
			// outcome depend on array order; more than one match falls
			// through to the same behaviour-severity floor a missing match
			// already uses, rather than picking one arbitrarily.
			const findingsResolvedFrom =
				resolution.resolvedFrom === null
					? []
					: trial.findings.filter(
							(finding) => finding.findingId === resolution.resolvedFrom,
						)
			const [onlyFindingResolvedFrom] = findingsResolvedFrom
			const severity =
				findingsResolvedFrom.length === 1 &&
				onlyFindingResolvedFrom !== undefined
					? onlyFindingResolvedFrom.severity
					: severityOfBehaviourFor(contract, oracle.id)

			allOutcomes.push({
				oracleId: oracle.id,
				required: true,
				severity,
				checkResolved: inputs.checkResolution !== null,
				resolution,
			})
			outcomes.push({
				oracleId: oracle.id,
				// Constant across every entry: one `score()` call scores exactly
				// one probe.
				probeId: probe.probeId,
				state: resolution.state,
				severity,
				// `ORACLE_DISPOSITIONS`' third member, `'not-attempted'`, on a
				// `null` local `disposition`: no disposition was recorded for
				// this oracle, or the ambiguity guard above fired. Both mean
				// "nothing was recorded", which is the honest reading of the
				// one closed-three member that says so.
				disposition:
					disposition === null ? 'not-attempted' : disposition.disposition,
				resolvedFrom: resolution.resolvedFrom,
				corroboration: resolution.corroboration,
				selectedObservationIds: [...resolution.selectedObservationIds],
				checkResolution,
			})

			if (firstState === undefined) firstState = resolution.state
			if (
				firstInvalidatingState === undefined &&
				INVALIDATING_OUTCOME_STATES.has(resolution.state)
			) {
				firstInvalidatingState = resolution.state
			}
			// First match only: `Oracle.id` carries no schema- or compile-time
			// uniqueness constraint, so two oracles could share
			// `id === designatedOracleId`. Guarding against overwrite here is
			// the same last-write-wins fix `outcomesByProbeId` (`strength.ts`)
			// already applies, for the identical reason.
			if (
				designatedOracleId !== null &&
				oracle.id === designatedOracleId &&
				designatedState === undefined
			) {
				designatedState = resolution.state
			}
		}

		// One vote per trial, ordinarily: the trial set's own cardinality
		// (`Trials.completed`) is `votes.length`, so a trial still
		// contributes a vote when the probe has no designated oracle (a
		// clean control, a canary, or a malformed defect chain) -- the
		// fallback order is the first invalidating state this trial's
		// oracles produced, else the first oracle's state. Every candidate
		// is a state `resolveOutcome` itself assigned this trial, never a
		// literal this module invents: `resolveOutcome` stays the one
		// assigner of an AD-6 state. `contract.oracles` declaring none at
		// all is the one shape with no state to vote with, and that trial
		// contributes no vote rather than a fabricated one.
		const voteState = designatedState ?? firstInvalidatingState ?? firstState
		if (voteState !== undefined) {
			votes.push({ state: voteState as TrialVote['state'] })
		}
	}

	const reduced = reduceTrialSet(votes, policy.catchThreshold)
	const trialsField: OutcomeStateInputs['trials'] = {
		declaredMinimum: policy.minimumTrialCount,
		completed: votes.length,
		invalidatedAttempts: [...reduced.invalidatedAttempts],
	}

	const unwitnessedQuotations = trials.flatMap(
		(trial) => trial.unwitnessedQuotations,
	)
	const isolationViolation = trials.flatMap((trial) => trial.isolationViolation)
	const findings: FindingConfidence[] = trials.flatMap((trial) =>
		trial.findings.map((finding) => ({
			findingId: finding.findingId,
			confidence: finding.confidence,
		})),
	)
	const uncitedDefectFindings = trials.flatMap((trial) =>
		uncitedDefectFindingGaps(recordPickOf(trial)),
	)
	// Every finding across every trial citing no oracle (`emit`'s own
	// `uncitedFindings` field): broader than `uncitedDefectFindings` above
	// (every finding type, not `defect` only) and thinner (an identifier
	// only), per `outcome.ts`'s own doc comment on the two functions
	// coexisting rather than one replacing the other.
	const uncitedFindings = trials.flatMap((trial) =>
		uncitedFindingIds(recordPickOf(trial)),
	)
	const coverageGaps = evaluateCoverage(contract)

	const operationIdentifierCollisions = operationIdentifierCollisionsOf(
		contract,
		trials,
	)
	const trialSetDisagreements = trialSetDisagreementsOf(trials)

	const evidenceIntegrity: EvidenceIntegrityInputs = {
		// Declared, not derived: no declared input or caller-supplied
		// parameter carries `EvidenceDisclosure`, `ingest`'s product does not
		// restate it, and the other three siblings are declared `false` for
		// the identical reason (see this module's own header comment).
		disclosure: { truncationBound: null, reportedIncomplete: false },
		overTruncated: false,
		unavailable: false,
		internallyInconsistent: false,
		isolationViolation,
		duplicateRecordIdentifiers: conditionsAcrossTrials(
			trials,
			'duplicate-record-identifier',
		),
		danglingCitations: conditionsAcrossTrials(trials, 'dangling-citation'),
		danglingDispositionCitations: conditionsAcrossTrials(
			trials,
			'dangling-disposition-citation',
		),
		forbiddenInputsNotWithheld: conditionsAcrossTrials(
			trials,
			'forbidden-input-not-withheld',
		),
		crossArtifactDisagreements: conditionsAcrossTrials(
			trials,
			'cross-artifact-disagreement',
		),
		evaluatorConfigurationAbsent: conditionsAcrossTrials(
			trials,
			'evaluator-configuration-absent',
		),
		evaluatorConfigurationDigestMismatches: conditionsAcrossTrials(
			trials,
			'evaluator-configuration-digest-mismatch',
		),
		judgeResultsUnscored: conditionsAcrossTrials(
			trials,
			'judge-result-unscored',
		),
		operationIdentifierCollisions,
		trialSetDisagreements,
	}

	// Every trial in the set is asserted to agree with the
	// first on `mode` and `evaluatorRecommendation`; a disagreement is
	// `trial-set-field-disagreement` above, never a throw. The first
	// trial's own values build the one assessment TypeScript's
	// discriminated union still requires -- non-silence comes from the
	// Invalid row's basis line, not from withholding a value. A caller
	// supplying zero trials has no first value to read; both fields fall
	// back to a neutral default, and `below-minimum-trial-count` already
	// reports zero completed trials against the declared minimum.
	const firstTrial = trials[0]
	const mode = firstTrial?.mode ?? 'production'
	const evaluatorRecommendation: EvaluatorRecommendation =
		firstTrial?.evaluatorRecommendation ?? 'PASS'
	// Same posture as `mode`/`evaluatorRecommendation` above: read off the
	// first trial, never derived or defaulted from anything richer. A caller
	// supplying zero trials has no first value to read either; the empty
	// string is the honest "no run identifier was presented" reading, on the
	// same terms `below-minimum-trial-count` already reports the shortfall.
	const runId = firstTrial?.runId ?? ''

	const commonBody = {
		outcomeState: {
			outcomes: allOutcomes,
			unwitnessedQuotations,
			trials: trialsField,
			reExecutionCap: policy.reExecutionCap,
		},
		evidenceIntegrity,
		evaluatorRecommendation,
		coverageGaps,
		uncitedDefectFindings,
		findings,
		confidenceThreshold: policy.confidenceThreshold,
		// Declared, not derived, on the same posture as `disclosure` below:
		// `AD-12`'s remediation chain needs a caller-presented ancestor
		// sequence, and score's five declared inputs carry only the current
		// contract, never a chain. `validateLineageChain([contract], {...})`
		// looks buildable from what score already has, but is not: it treats
		// the one-element array as the WHOLE chain, so any contract with
		// `revisionCount > 0` -- an ordinarily revised one -- fails the root,
		// parent-resolution, and length checks unconditionally, firing the
		// existing `lineage-chain-inconsistent` FAIL row on every such run
		// regardless of whether anything is actually wrong. The vacuously
		// true value below is what "no chain was presented to validate"
		// honestly means.
		remediationState: {
			lengthConsistent: true,
			noRepeatedDigest: true,
			noGap: true,
		},
		preflightPassed: preflightVerdict.passed,
		severityFloor: policy.severityFloor,
	}

	if (mode === 'production') {
		const assessment: ProductionAssessment = {
			mode: 'production',
			...commonBody,
		}
		return {
			assessment,
			ladder: resolveProductionVerdict(assessment),
			runId,
			contract,
			policy,
			probe,
			sealedProbes,
			trialSetResult: reduced,
			outcomes,
			uncitedFindings,
		}
	}
	const assessment: ContractAssessment = {
		mode: 'contract-scoring',
		...commonBody,
		systemRecommendationRecorded: evaluatorRecommendation,
		// No declared input or caller-supplied parameter carries authored
		// prose for this field; `null` is its own legal, honest value rather
		// than an invented note.
		systemRecommendationNote: null,
	}
	return {
		assessment,
		ladder: resolveContractVerdict(assessment),
		runId,
		contract,
		policy,
		probe,
		sealedProbes,
		trialSetResult: reduced,
		outcomes,
		uncitedFindings,
	}
}
