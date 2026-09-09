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
import { freezeArtifact } from '../lineage/freeze.ts'
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
 * the published conformance suite ships `probe/observe-anomalous-status`, and
 * an api observation's `status` is bounded to 100-599 at the port.
 */
const ANOMALOUS_STATUS = 400

/**
 * What makes a control leg anomalous, in the vocabulary of the kind it ran
 * against, or `null` when nothing does. A command's analogue of a 4xx is a
 * non-zero exit: both are the system saying the call did not go through, and
 * AD-10's clean-control check is about exactly that.
 */
function anomalyOf(observation: ProbeObservation): string | null {
	if (observation.kind === 'api') {
		return observation.status >= ANOMALOUS_STATUS
			? `status ${observation.status}`
			: null
	}
	return observation.exitCode === 0 ? null : `exit code ${observation.exitCode}`
}

type LegState = {
	readonly leg: PlannedLeg
	readonly observation: ProbeObservation
	readonly projected: ProjectedObservation
	readonly evidence: Observation
}

/**
 * Whether the observation answers the mechanism the leg asked about.
 *
 * `kind` alone, and deliberately not `interfaceId` or `operationId`: those two
 * are already read by the `interface-present` check, which reports a mismatch
 * as a failed verdict rather than a fault, and reclassifying them here would
 * turn a shipped verdict into a thrown fault. `kind` has no such reader. An
 * observation of the wrong mechanism is not a weaker answer to the question, it
 * is an answer to a different one, and every check below would read it as the
 * leg's own result.
 */
function kindMismatch(
	leg: PlannedLeg,
	observation: ProbeObservation,
): string | undefined {
	if (leg.request.kind === observation.kind) return undefined
	return `leg "${leg.legId}" asked for a "${leg.request.kind}" probe and was answered with a "${observation.kind}" observation, so the port answered a question nobody asked`
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
 * The canonical digest of one value, or `null` where the value holds something
 * RFC 8785 cannot serialise. `JsonValue` admits an integer outside the safe
 * range and a lone surrogate, and a 64-bit identifier in a query parameter is
 * ordinary, so this is reachable from a contract that parses. A verdict is what
 * this stage owes its caller, and `null` compares equal to nothing, so a value
 * that cannot be digested leaves the two sides distinguishable and the check
 * still reads the leg.
 */
const digestOrNull = (value: unknown): string | null => {
	try {
		return digestArtifact(value, PREFLIGHT_ARTIFACT_PATH)
	} catch (error) {
		if (error instanceof RuntimeFault) return null
		throw error
	}
}

/**
 * Whether two legs issued one request and received one answer, which makes them
 * one probe under two labels. A manifestation witness firing on such a leg is
 * the fault leg's own manifestation read a second time, and it establishes
 * nothing about where the defect is scoped.
 *
 * Both halves are required. Answers alone would drop AD-10's own worked example,
 * two distinct nonexistent identifiers both returning 404: those legs ask
 * different questions and are exactly the legs this check exists to read.
 * Requests alone are what the plan can see, and identical requests can still be
 * answered differently, which is why the comparison lives here where the
 * answers are in hand.
 *
 * The answer half compares the evidence, which is everything a relation can
 * address: two legs with equal evidence resolve one relation to one value. It
 * carries AD-11's projected body, so a field the operation declares volatile is
 * already out of it and a server-minted identifier stops being a difference,
 * which is what makes the same request to a mutating operation comparable at
 * all. The raw observation is the wrong side of this comparison for that exact
 * reason: two writes to one collection differ on a minted id by design, and
 * reading that as a difference puts the false failure this check just lost back
 * one stage over.
 *
 * The correlation identifiers are neutralised on both sides, since they are the
 * leg id and differ by construction. A digest that comes back `null` matches
 * nothing, so a pair that cannot be compared stays a pair the check reads.
 */
const answeredAlike = (left: LegState, right: LegState): boolean => {
	const request = (state: LegState): string | null =>
		digestOrNull({ ...state.leg.request, probeId: '' })
	const answer = (state: LegState): string | null =>
		digestOrNull({ ...state.evidence, observationId: '' })
	const leftRequest = request(left)
	const leftAnswer = answer(left)
	return (
		leftRequest !== null &&
		leftAnswer !== null &&
		leftRequest === request(right) &&
		leftAnswer === answer(right)
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
		plan.referenceSetKeys,
		artifactPath,
	).resolution
}

export const reducePreflight: ReduceStage<
	PreflightPlan,
	PreflightObservations,
	PreflightVerdict
> = (plan, { observations }) => {
	const byProbeId = new Map<string, ProbeObservation>()
	for (const observation of observations) {
		// A repeated `probeId` is a broken echo: `ProbeRequest.probeId` comes
		// back unchanged by contract, so two observations claiming one leg means
		// the port answered a request nobody made. Left as a last-write-wins
		// `Map` it would also make the verdict depend on array order, which is
		// the class AD-30's permutation family exists to catch.
		if (byProbeId.has(observation.probeId)) {
			throw new RuntimeFault(
				'port-contract-violation',
				PREFLIGHT_ARTIFACT_PATH,
				`two observations echoed the probe id "${observation.probeId}", so one leg was answered twice`,
			)
		}
		byProbeId.set(observation.probeId, observation)
	}

	const states = new Map<string, LegState>()
	for (const leg of plan.legs) {
		const observation = byProbeId.get(leg.legId)
		if (observation === undefined) continue
		// The echo is checked, not assumed. Both port messages are unions, so a
		// port can answer a command leg with a schema-valid HTTP observation and
		// every check below reads it as the leg's own result: a command contract
		// then passes pre-flight with four checks satisfied and no command ever
		// run. `probeId` alone binds the two together and says nothing about
		// whether the answer is to this question.
		const mismatch = kindMismatch(leg, observation)
		if (mismatch !== undefined) {
			throw new RuntimeFault(
				'port-contract-violation',
				PREFLIGHT_ARTIFACT_PATH,
				mismatch,
			)
		}
		const projected = projectObservation(
			observation,
			leg.operation,
			PREFLIGHT_ARTIFACT_PATH,
		)
		states.set(leg.legId, {
			leg,
			observation,
			projected,
			evidence: evidenceOf(projected, observation, leg.inputs, leg.operation),
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
					plan.referenceSetKeys,
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
					const anomaly = anomalyOf(state.observation)
					if (anomaly !== null)
						return check(
							planned.kind,
							null,
							'failed',
							`control leg "${legId}" observed ${anomaly}`,
						)
				}
				return check(planned.kind, null, 'satisfied', null)
			}
			case 'seeded-faults-scoped': {
				const { witness, defectId } = planned
				const fault = states.get(witness.legId)
				// The legs that answered a different question than the fault leg's, and
				// the legs dropped for answering the same one.
				const examined: string[] = []
				const dropped: string[] = []
				for (const legId of planned.cleanLegIds) {
					const state = states.get(legId)
					if (
						state !== undefined &&
						fault !== undefined &&
						answeredAlike(state, fault)
					) {
						dropped.push(legId)
						continue
					}
					examined.push(legId)
				}
				// Emptiness is tested on what survived the drop. A check over no clean
				// leg examined nothing, and a check that examined nothing has
				// established nothing, which is the rule the `input-sensitivity` row
				// above already runs on. Satisfied here would certify scoping from zero
				// evidence on the three contracts least able to afford it: one whose
				// defect names the only leg its operation has, one whose every other leg
				// repeats the fault leg's probe, and one where the plan named legs and
				// the drop took all of them. The note says which.
				if (examined.length === 0) {
					const named = dropped.map((legId) => `"${legId}"`).join(', ')
					return check(
						planned.kind,
						witness.operationId,
						'failed',
						dropped.length === 0
							? `${defectId}: the operation has no leg besides the fault leg, so nothing here establishes that the defect is scoped to it`
							: `${defectId}: every other leg of the operation issued the fault leg's own request and received its answer (${named}), so nothing here establishes that the defect is scoped to it`,
					)
				}
				for (const legId of examined) {
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
	return freezeArtifact({
		// A pre-flight verdict is an origin artifact, so AD-29's lineage fields
		// carry their origin values.
		schemaVersion: 1,
		parentDigest: null,
		revisionCount: 0,
		runId: plan.runId,
		fixtureDigest: fixtureDigest(projections, PREFLIGHT_ARTIFACT_PATH),
		passed: checks.every((entry) => entry.outcome !== 'failed'),
		checks,
	})
}
