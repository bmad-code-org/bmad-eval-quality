/**
 * The one place a pre-flight probe is awaited (AD-34: `application/` is the
 * only layer that awaits). Parses its inputs, plans, issues every leg through
 * the environment-probe port in plan order, reduces, and parses the verdict.
 *
 * No decision logic lives here: every branch is a parse, an await, or a rethrow.
 * A failed pre-flight is a verdict and a failed probe is a fault, so a
 * `RuntimeFault` from a leg propagates.
 */
import { planPreflight } from '../core/preflight/plan.ts'
import { reducePreflight } from '../core/preflight/reduce.ts'
import { EvalContract } from '../core/schemas/eval-contract.ts'
import { RuntimeFault } from '../core/schemas/faults.ts'
import type { ProbeObservation } from '../core/schemas/port-messages.ts'
import { PreflightVerdict } from '../core/schemas/preflight-verdict.ts'
import { Probe } from '../core/schemas/probe.ts'
import {
	type EnvironmentProbePort,
	probeParsers,
} from '../ports/environment-probe-port.ts'
import { invokePort } from './invoke-port.ts'

export type RunPreflightOptions = {
	readonly contract: EvalContract
	readonly probes: readonly Probe[]
	readonly runId: string
	readonly port: EnvironmentProbePort
	readonly signal: AbortSignal
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

export async function runPreflight(
	options: RunPreflightOptions,
): Promise<PreflightVerdict> {
	const { runId, port, signal } = options
	const parsedContract = EvalContract.safeParse(options.contract)
	if (!parsedContract.success) {
		throw new RuntimeFault(
			'schema-parse-failure',
			'EvalContract',
			'input does not conform to the EvalContract schema',
			{ cause: parsedContract.error },
		)
	}
	const parsedProbes = parseProbes(options.probes)

	const plan = planPreflight({
		contract: parsedContract.data,
		probes: parsedProbes,
		runId,
	})

	// Sequential: the control legs are ordered by construction, and a parallel
	// run would reset the fixture underneath another operation's witness.
	const observations: ProbeObservation[] = []
	for (const leg of plan.legs) {
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
	}

	const verdict = reducePreflight(plan, { observations })
	const parsedVerdict = PreflightVerdict.safeParse(verdict)
	if (!parsedVerdict.success) {
		throw new RuntimeFault(
			'schema-parse-failure',
			'PreflightVerdict',
			'the reduced verdict does not conform to the PreflightVerdict schema',
			{ cause: parsedVerdict.error },
		)
	}
	return parsedVerdict.data
}
