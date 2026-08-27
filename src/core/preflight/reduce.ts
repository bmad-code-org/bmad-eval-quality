/**
 * AD-34's reducing half: the plan plus the observations the port returned,
 * reduced to a `PreflightVerdict`. Pure over the observations, and the only
 * place AD-10's verdict semantics live.
 *
 * Observations are indexed by `probeId` (NFR9), and one `PreflightCheck` is
 * emitted per `PlannedCheck`, so a verdict carries only the kinds its plan
 * asked for.
 */
import { digestArtifact } from '../canonical/digest.ts'
import { declaresNoRequestKeys } from '../declared-inputs.ts'
import { RuntimeFault } from '../schemas/faults.ts'
import type { ProbeObservation } from '../schemas/port-messages.ts'
import type {
	PreflightCheck,
	PreflightVerdict,
} from '../schemas/preflight-verdict.ts'
import type { Observation } from '../schemas/sealed-run-record.ts'
import type { ManifestationWitness } from '../schemas/sensitivity-witness.ts'
import type { ReduceStage } from '../stage-contracts.ts'
import type { PlannedCheck, PlannedLeg, PreflightPlan } from './plan.ts'
import {
	fixtureDigest,
	PREFLIGHT_ARTIFACT_PATH,
	type ProjectedObservation,
	projectObservation,
} from './projection.ts'
import { evidenceOf, resolveWitnessRelation } from './witness-evidence.ts'

export type PreflightObservations = {
	readonly observations: readonly ProbeObservation[]
}

/**
 * AD-10 names no threshold, and this is the one the repository already speaks:
 * Story 6.1's conformance suite ships `probe/observe-anomalous-status`, and
 * `ProbeObservation.status` is bounded to 100-599 at the port, so HTTP is
 * already assumed at that boundary.
 */
const ANOMALOUS_STATUS = 400

type LegState = {
	readonly leg: PlannedLeg
	readonly observation: ProbeObservation
	readonly projected: ProjectedObservation
	readonly evidence: Observation
}

const check = (
	kind: PreflightCheck['kind'],
	operationId: string | null,
	outcome: PreflightCheck['outcome'],
	note: string | null,
): PreflightCheck => ({ kind, operationId, outcome, note })

/**
 * Two projections describe the same fixture state. `legId` is excluded because
 * it is the one field that necessarily differs between the two legs compared, so
 * deep-equality over the whole projection could never be satisfied.
 *
 * Compared through the canonical digest, because `JSON.stringify` is key-order
 * sensitive: two adapters serialising one body's keys in different orders
 * describe the same fixture, and failing there would invalidate a run over a
 * difference that is not one.
 */
const sameFixtureState = (
	left: ProjectedObservation,
	right: ProjectedObservation,
): boolean => {
	const state = ({ legId: _legId, ...rest }: ProjectedObservation): unknown =>
		rest
	return (
		digestArtifact(state(left), PREFLIGHT_ARTIFACT_PATH) ===
		digestArtifact(state(right), PREFLIGHT_ARTIFACT_PATH)
	)
}

/**
 * Resolves a manifestation witness against one leg. Returns `null` when that
 * leg produced no observation, which the two seeded-fault rows read
 * differently: the fired row fails on it, the scoped row has nothing to
 * contradict.
 */
const resolveAgainst = (
	witness: ManifestationWitness,
	state: LegState | undefined,
	plan: PreflightPlan,
	artifactPath: string,
): 'true' | 'false' | 'insufficient-evidence' | null => {
	if (state === undefined) return null
	// Keyed by the witness's own leg id, since the relation addresses
	// `/interactions/{witness.legId}/…`. The scoped row asks whether that same
	// relation would fire on a clean leg's observation.
	return resolveWitnessRelation(
		witness.relation,
		{ [witness.legId]: state.evidence },
		state.leg.operation,
		plan.referenceSets,
		artifactPath,
	).resolution
}

export const reducePreflight: ReduceStage<
	PreflightPlan,
	PreflightObservations,
	PreflightVerdict
> = (plan, { observations }) => {
	const byProbeId = new Map<string, ProbeObservation>()
	for (const observation of observations)
		byProbeId.set(observation.probeId, observation)

	const states = new Map<string, LegState>()
	for (const leg of plan.legs) {
		const observation = byProbeId.get(leg.legId)
		if (observation === undefined) continue
		const projected = projectObservation(
			observation,
			leg.operation,
			PREFLIGHT_ARTIFACT_PATH,
		)
		states.set(leg.legId, {
			leg,
			observation,
			projected,
			evidence: evidenceOf(projected, observation, leg.inputs),
		})
	}

	const reduceCheck = (planned: PlannedCheck): PreflightCheck => {
		switch (planned.kind) {
			case 'interface-present': {
				for (const legId of planned.legIds) {
					const state = states.get(legId)
					if (state === undefined)
						return check(
							planned.kind,
							planned.operationId,
							'failed',
							`leg "${legId}" produced no observation`,
						)
					const { request } = state.leg
					const echoed = state.observation
					if (
						echoed.probeId !== request.probeId ||
						echoed.interfaceId !== request.interfaceId ||
						echoed.operationId !== request.operationId
					)
						return check(
							planned.kind,
							planned.operationId,
							'failed',
							`leg "${legId}" echoed an identifier the request did not carry`,
						)
				}
				return check(planned.kind, planned.operationId, 'satisfied', null)
			}
			case 'input-sensitivity': {
				const { witness, operation } = planned
				if (witness === null)
					return check(
						planned.kind,
						planned.operationId,
						declaresNoRequestKeys(operation) ? 'exempt' : 'failed',
						declaresNoRequestKeys(operation)
							? 'The operation declares no inputs in any channel.'
							: 'The operation declares request keys and no sensitivity witness.',
					)
				const evidence: Record<string, Observation> = {}
				for (const leg of witness.legs) {
					const state = states.get(leg.legId)
					if (state === undefined)
						return check(
							planned.kind,
							planned.operationId,
							'failed',
							`witness leg "${leg.legId}" produced no observation`,
						)
					evidence[leg.legId] = state.evidence
				}
				const { resolution } = resolveWitnessRelation(
					witness.relation,
					evidence,
					operation,
					plan.referenceSets,
					PREFLIGHT_ARTIFACT_PATH,
				)
				// AD-10's own sentence, and the most load-bearing line here: a
				// sensitivity check that examined nothing has established nothing,
				// so `insufficient-evidence` fails.
				if (resolution === 'insufficient-evidence')
					return check(
						planned.kind,
						planned.operationId,
						'failed',
						'The witness relation resolved insufficient-evidence.',
					)
				return check(
					planned.kind,
					planned.operationId,
					resolution === 'true' ? 'satisfied' : 'failed',
					resolution === 'true' ? null : 'The witness relation resolved false.',
				)
			}
			case 'state-reset': {
				const [firstId, lastId] = planned.legIds
				const first = states.get(firstId)
				const last = states.get(lastId)
				if (first === undefined || last === undefined)
					return check(
						planned.kind,
						null,
						'failed',
						'a control-observe leg produced no observation',
					)
				return sameFixtureState(first.projected, last.projected)
					? check(planned.kind, null, 'satisfied', null)
					: check(
							planned.kind,
							null,
							'failed',
							`the projections of "${firstId}" and "${lastId}" differ`,
						)
			}
			case 'clean-control': {
				for (const legId of planned.legIds) {
					const state = states.get(legId)
					if (state === undefined)
						return check(
							planned.kind,
							null,
							'failed',
							`control leg "${legId}" produced no observation`,
						)
					if (state.observation.status >= ANOMALOUS_STATUS)
						return check(
							planned.kind,
							null,
							'failed',
							`control leg "${legId}" observed status ${state.observation.status}`,
						)
				}
				return check(planned.kind, null, 'satisfied', null)
			}
			case 'seeded-faults-scoped': {
				const { witness, defectId } = planned
				for (const legId of planned.cleanLegIds) {
					const resolved = resolveAgainst(
						witness,
						states.get(legId),
						plan,
						PREFLIGHT_ARTIFACT_PATH,
					)
					if (resolved === 'true')
						return check(
							planned.kind,
							witness.operationId,
							'failed',
							`${defectId}: the manifestation witness fires on clean leg "${legId}"`,
						)
				}
				return check(planned.kind, witness.operationId, 'satisfied', defectId)
			}
			case 'seeded-fault-fired': {
				const { witness, defectId } = planned
				if (witness === null)
					return check(
						planned.kind,
						null,
						'failed',
						`${defectId}: the defect declares no manifestation witness, so it cannot be observed to fire`,
					)
				const resolved = resolveAgainst(
					witness,
					states.get(witness.legId),
					plan,
					PREFLIGHT_ARTIFACT_PATH,
				)
				if (resolved === 'true')
					return check(planned.kind, witness.operationId, 'satisfied', defectId)
				return check(
					planned.kind,
					witness.operationId,
					'failed',
					resolved === null
						? `${defectId}: the fault leg produced no observation`
						: `${defectId}: the manifestation witness resolved ${resolved} on its own fault leg`,
				)
			}
		}
	}

	// The plan named legs and not one observation answered to a planned
	// `probeId`. `ProbeRequest.probeId` is echoed unchanged by contract, so the
	// port broke that contract and there is no observation to digest a fixture
	// from. Thrown here as a typed fault: `fixtureDigest` would otherwise raise
	// an untyped throw from inside the returned object literal, discarding the
	// checks already computed.
	if (states.size === 0) {
		throw new RuntimeFault(
			'port-contract-violation',
			PREFLIGHT_ARTIFACT_PATH,
			`no observation echoed any of the ${plan.legs.length} planned probe ids, so no fixture was observed`,
		)
	}

	const checks = plan.checks.map(reduceCheck)
	const projections = [...states.values()].map((state) => state.projected)
	return {
		// A pre-flight verdict is an origin artifact; AD-29's revision machinery
		// belongs to the story that revises one.
		schemaVersion: 1,
		parentDigest: null,
		revisionCount: 0,
		runId: plan.runId,
		fixtureDigest: fixtureDigest(projections, PREFLIGHT_ARTIFACT_PATH),
		passed: checks.every((entry) => entry.outcome !== 'failed'),
		checks,
	}
}
