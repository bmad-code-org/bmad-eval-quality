/**
 * The one place a pre-flight probe is awaited (AD-34: `application/` is the
 * only layer that awaits). Parses its inputs, plans, issues every leg through
 * the environment-probe port in plan order, reduces, and parses the verdict.
 *
 * `preflightFromObservations` is the same verdict for a caller that probed by
 * some other means: it plans, skips the awaiting, and reduces over the
 * observations it is handed. Both entry points land on one `reducePreflight`
 * and return one `PreflightVerdict`.
 *
 * No decision logic lives here: every branch is a parse, an await, or a rethrow.
 * A failed pre-flight is a verdict and a failed probe is a fault, so a
 * `RuntimeFault` from a leg propagates.
 */
import { freezeArtifact } from '../core/lineage/freeze.ts'
import { planPreflight } from '../core/preflight/plan.ts'
import { reducePreflight } from '../core/preflight/reduce.ts'
import { EvalContract } from '../core/schemas/eval-contract.ts'
import { RuntimeFault } from '../core/schemas/faults.ts'
import { ProbeObservation } from '../core/schemas/port-messages.ts'
import { PreflightVerdict } from '../core/schemas/preflight-verdict.ts'
import { Probe } from '../core/schemas/probe.ts'
import {
	type EnvironmentProbePort,
	probeParsers,
} from '../ports/environment-probe-port.ts'
import { type DiagnosticSink, emit } from './diagnostics.ts'
import { invokePort } from './invoke-port.ts'

export type RunPreflightOptions = {
	readonly contract: EvalContract
	readonly probes: readonly Probe[]
	readonly runId: string
	readonly port: EnvironmentProbePort
	readonly signal: AbortSignal
	readonly sink?: DiagnosticSink
}

export type PreflightFromObservationsOptions = {
	readonly contract: EvalContract
	readonly probes: readonly Probe[]
	readonly runId: string
	readonly observations: readonly ProbeObservation[]
	readonly sink?: DiagnosticSink
}

/** Artifacts are validated in both directions (AD-28), probes included. */
function parseProbes(input: readonly Probe[]): Probe[] {
	const parsed = Probe.array().safeParse(input)
	if (!parsed.success) {
		throw new RuntimeFault(
			'schema-parse-failure',
			'Probe',
			'input does not conform to the Probe schema',
			{ cause: parsed.error },
		)
	}
	return parsed.data
}

function parseContract(input: EvalContract): EvalContract {
	const parsed = EvalContract.safeParse(input)
	if (!parsed.success) {
		throw new RuntimeFault(
			'schema-parse-failure',
			'EvalContract',
			'input does not conform to the EvalContract schema',
			{ cause: parsed.error },
		)
	}
	return parsed.data
}

function parseObservations(
	input: readonly ProbeObservation[],
): ProbeObservation[] {
	const parsed = ProbeObservation.array().safeParse(input)
	if (!parsed.success) {
		throw new RuntimeFault(
			'schema-parse-failure',
			'ProbeObservation',
			'input does not conform to the ProbeObservation schema',
			{ cause: parsed.error },
		)
	}
	return parsed.data
}

/**
 * Frozen again after the outbound parse: `safeParse` returns a fresh object,
 * so the core stage's freeze does not survive boundary validation.
 */
function parseVerdict(verdict: PreflightVerdict): PreflightVerdict {
	const parsed = PreflightVerdict.safeParse(verdict)
	if (!parsed.success) {
		throw new RuntimeFault(
			'schema-parse-failure',
			'PreflightVerdict',
			'the reduced verdict does not conform to the PreflightVerdict schema',
			{ cause: parsed.error },
		)
	}
	return freezeArtifact(parsed.data)
}

const plannedLine = (legId: string): string => `leg "${legId}": planned`
const observedLine = (legId: string): string => `leg "${legId}": observed`
const closingLine = (legCount: number, passed: boolean): string =>
	`reduced ${legCount} leg(s): ${passed ? 'passed' : 'failed'}`

export async function runPreflight(
	options: RunPreflightOptions,
): Promise<PreflightVerdict> {
	const { runId, port, signal, sink } = options
	const parsedContract = parseContract(options.contract)
	const parsedProbes = parseProbes(options.probes)

	const plan = planPreflight({
		contract: parsedContract,
		probes: parsedProbes,
		runId,
	})

	// Sequential: the control legs are ordered by construction, and a parallel
	// run would reset the fixture underneath another operation's witness.
	const observations: ProbeObservation[] = []
	for (const leg of plan.legs) {
		emit(sink, { runId, stage: 'preflight', message: plannedLine(leg.legId) })
		observations.push(
			await invokePort({
				request: leg.request,
				requestParser: probeParsers.request,
				responseParser: probeParsers.response,
				port: port.probe,
				signal,
				requestPath: 'ProbeRequest',
				responsePath: 'ProbeObservation',
			}),
		)
		// `invokePort` either returns an observation or throws, so every leg
		// reaching here was answered and the unobserved line is unreachable.
		emit(sink, { runId, stage: 'preflight', message: observedLine(leg.legId) })
	}

	const verdict = parseVerdict(reducePreflight(plan, { observations }))
	emit(sink, {
		runId,
		stage: 'preflight',
		message: closingLine(plan.legs.length, verdict.passed),
	})
	return verdict
}

/**
 * The same pre-flight verdict for a caller who probed by some other means:
 * plans, skips the awaiting, reduces over observations it is handed.
 */
export function preflightFromObservations(
	options: PreflightFromObservationsOptions,
): PreflightVerdict {
	const { runId, sink } = options
	const parsedContract = parseContract(options.contract)
	const parsedProbes = parseProbes(options.probes)
	const parsedObservations = parseObservations(options.observations)

	const plan = planPreflight({
		contract: parsedContract,
		probes: parsedProbes,
		runId,
	})

	// `reducePreflight` binds an observation to a leg by `probeId`, so the
	// emitted lines are keyed the same way rather than by array position.
	const answered = new Set(
		parsedObservations.map((observation) => observation.probeId),
	)
	for (const leg of plan.legs) {
		emit(sink, { runId, stage: 'preflight', message: plannedLine(leg.legId) })
		emit(sink, {
			runId,
			stage: 'preflight',
			message: answered.has(leg.legId)
				? observedLine(leg.legId)
				: `leg "${leg.legId}": no observation`,
		})
	}

	const verdict = parseVerdict(
		reducePreflight(plan, { observations: parsedObservations }),
	)
	emit(sink, {
		runId,
		stage: 'preflight',
		message: closingLine(plan.legs.length, verdict.passed),
	})
	return verdict
}
