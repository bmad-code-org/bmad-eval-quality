/**
 * AD-35's thirteen extra assertions, for the environment-probe port only. The
 * subject supplies its policy and one request per denial, since only it knows
 * how its own interface-to-target mapping is wired.
 *
 * Each of the thirteen builds its own `'resolves'` subject and reads
 * `underlyingCalls()` from a counter starting at zero, so every count below is
 * absolute.
 */
import type {
	ProbeObservation,
	ProbeRequest,
} from '../core/schemas/port-messages.ts'
import type {
	ProbeTargetAuthorization,
	ProbeTargetPolicy,
} from '../core/schemas/probe-policy.ts'
import { probeParsers } from '../ports/environment-probe-port.ts'
import type {
	BuiltSubject,
	ConformanceOutcome,
	ConformanceReport,
	PortSubject,
} from './conformance.ts'
import {
	buildScenario,
	countCalls,
	describeThrown,
	disposeScenario,
	faultView,
	reportOf,
	runSharedAssertions,
	settle,
	titledOutcome,
	withDispose,
} from './conformance.ts'

export type ProbeSubject = PortSubject<ProbeRequest> & {
	readonly policy: ProbeTargetPolicy
	/** a request the policy ALLOWS, pointed at the subject's own fixture server. */
	readonly authorizedRequest: ProbeRequest
	/** a request whose interfaceId the policy does not name at all. */
	readonly unmappedRequest: ProbeRequest
	/** requests whose mapped target resolves into each denied class. */
	readonly deniedAddressRequests: {
		readonly loopback: ProbeRequest
		readonly private: ProbeRequest
		readonly linkLocal: ProbeRequest
		readonly metadata: ProbeRequest
	}
	readonly unauthorizedMethodRequest: ProbeRequest
	readonly unauthorizedSchemeRequest: ProbeRequest
	/** answered with a redirect to a target the policy denies. */
	readonly redirectingRequest: ProbeRequest
	/** answered with a chain of authorized redirects longer than `maxRedirects`. */
	readonly overRedirectRequest: ProbeRequest
	/** answered past `maxResponseBytes`. */
	readonly oversizeResponseRequest: ProbeRequest
	/** answered after `maxElapsedMs`. */
	readonly slowRequest: ProbeRequest
	/** answered 500 by an authorized target. */
	readonly faultingRequest: ProbeRequest
}

/**
 * What one assertion expects back. `resolves` also requires `check` to pass.
 * `rejects` pins the AD-28 code: conflate a denial with a cap and an operator
 * reads "forbidden target" when an authorized one answered too much or too
 * slowly.
 */
type Expectation =
	| {
			readonly kind: 'resolves'
			readonly check?: (observation: ProbeObservation) => string | undefined
	  }
	| { readonly kind: 'rejects'; readonly code: string }

type ProbeAssertion = {
	readonly id: string
	readonly title: string
	readonly request: (subject: ProbeSubject) => ProbeRequest
	readonly expectation: Expectation
	/** the absolute `underlyingCalls()` this assertion pins, or `undefined` when it pins none. */
	readonly expectedCalls?: (subject: ProbeSubject) => number | string
}

function authorizationFor(
	subject: ProbeSubject,
	request: ProbeRequest,
): ProbeTargetAuthorization | undefined {
	return subject.policy.authorizations.find(
		(each: ProbeTargetAuthorization) =>
			each.interfaceId === request.interfaceId,
	)
}

const DENIED = 'forbidden-target'
const CAPPED = 'budget-exhausted'

const PROBE_ASSERTIONS: readonly ProbeAssertion[] = [
	{
		// Without this one, a subject that denies everything scores twelve of
		// twelve on default-deny while being useless. AD-35 spends a clause on
		// why a blanket loopback ban is wrong.
		id: 'probe/allow-authorized-loopback',
		title: 'an explicitly authorized target is reached and observed',
		request: (subject) => subject.authorizedRequest,
		expectation: { kind: 'resolves' },
	},
	{
		// A subject that throws on 5xx fails here and nowhere else, and it makes
		// AD-10's seeded-fault check unimplementable.
		id: 'probe/observe-anomalous-status',
		title: 'a 500 from an authorized target is an observation, not a fault',
		request: (subject) => subject.faultingRequest,
		expectation: {
			kind: 'resolves',
			check: (observation) =>
				observation.status === 500
					? undefined
					: `observed status ${observation.status}, expected 500`,
		},
	},
	{
		id: 'probe/deny-unmapped-interface',
		title:
			'an interface the mapping does not name is refused before a packet leaves',
		request: (subject) => subject.unmappedRequest,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: () => 0,
	},
	{
		id: 'probe/deny-unauthorized-loopback',
		title: 'a loopback address no authorization names is denied',
		request: (subject) => subject.deniedAddressRequests.loopback,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: () => 0,
	},
	{
		id: 'probe/deny-private',
		title: 'a private RFC 1918 address is denied',
		request: (subject) => subject.deniedAddressRequests.private,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: () => 0,
	},
	{
		id: 'probe/deny-link-local',
		title: 'a link-local address is denied',
		request: (subject) => subject.deniedAddressRequests.linkLocal,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: () => 0,
	},
	{
		id: 'probe/deny-metadata',
		title: 'a cloud metadata address is denied',
		request: (subject) => subject.deniedAddressRequests.metadata,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: () => 0,
	},
	{
		id: 'probe/deny-unauthorized-method',
		title: 'a method the authorization does not list is denied',
		request: (subject) => subject.unauthorizedMethodRequest,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: () => 0,
	},
	{
		id: 'probe/deny-unauthorized-scheme',
		title: 'a scheme the authorization does not name is denied',
		request: (subject) => subject.unauthorizedSchemeRequest,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: () => 0,
	},
	{
		// The first hop is authorized and happens. The redirect target is
		// revalidated and refused, so the second hop never runs. An adapter that
		// follows the redirect resolves, and fails here.
		id: 'probe/deny-on-redirect',
		title: 'a redirect to a denied target is revalidated and refused',
		request: (subject) => subject.redirectingRequest,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: () => 1,
	},
	{
		// Every hop is authorized, so only the count can refuse it. That is the
		// half `deny-on-redirect` cannot reach.
		id: 'probe/cap-redirects',
		title: 'a chain of authorized redirects past maxRedirects is capped',
		request: (subject) => subject.overRedirectRequest,
		expectation: { kind: 'rejects', code: CAPPED },
		expectedCalls: (subject) => {
			const authorization = authorizationFor(
				subject,
				subject.overRedirectRequest,
			)
			return authorization === undefined
				? "the subject's policy names no authorization for overRedirectRequest.interfaceId, so maxRedirects is unknown"
				: authorization.maxRedirects + 1
		},
	},
	{
		id: 'probe/cap-response-bytes',
		title: 'a response past maxResponseBytes is a cap, not a policy denial',
		request: (subject) => subject.oversizeResponseRequest,
		expectation: { kind: 'rejects', code: CAPPED },
	},
	{
		id: 'probe/cap-elapsed',
		title: 'a response past maxElapsedMs is a cap, not an abort',
		request: (subject) => subject.slowRequest,
		expectation: { kind: 'rejects', code: CAPPED },
	},
]

function checkResolved(
	assertion: ProbeAssertion,
	expectation: Extract<Expectation, { kind: 'resolves' }>,
	value: unknown,
): ConformanceOutcome {
	const parsed = probeParsers.response.safeParse(value)
	if (!parsed.success) {
		return titledOutcome(
			assertion.id,
			assertion.title,
			false,
			'the resolved value is not a schema-valid ProbeObservation',
		)
	}
	const complaint = expectation.check?.(parsed.data)
	return titledOutcome(
		assertion.id,
		assertion.title,
		complaint === undefined,
		complaint ?? '',
	)
}

function checkRejected(
	assertion: ProbeAssertion,
	expectedCode: string,
	error: unknown,
): ConformanceOutcome {
	const view = faultView(error)
	if (view === undefined) {
		return titledOutcome(
			assertion.id,
			assertion.title,
			false,
			`rejected with ${describeThrown(error)}, which carries no declared AD-28 code`,
		)
	}
	return titledOutcome(
		assertion.id,
		assertion.title,
		view.code === expectedCode,
		`rejected with code "${view.code}", expected "${expectedCode}"`,
	)
}

function checkCalls<Request>(
	assertion: ProbeAssertion,
	subject: ProbeSubject,
	built: BuiltSubject<Request>,
	base: ConformanceOutcome,
): ConformanceOutcome {
	if (assertion.expectedCalls === undefined) return base
	const expected = assertion.expectedCalls(subject)
	if (typeof expected === 'string') {
		return { ...base, passed: false, detail: expected }
	}
	const actual = countCalls(built)
	if (typeof actual === 'string') {
		return { ...base, passed: false, detail: actual }
	}
	if (actual === expected) return base
	return {
		...base,
		passed: false,
		detail: `${base.passed ? '' : `${base.detail}; `}underlyingCalls() was ${actual}, expected ${expected}`,
	}
}

async function runProbeAssertion(
	assertion: ProbeAssertion,
	subject: ProbeSubject,
): Promise<ConformanceOutcome> {
	const run = await buildScenario(subject, 'resolves')
	if (!run.ok) {
		return titledOutcome(assertion.id, assertion.title, false, run.detail)
	}
	const settled = await settle(
		run.built.port(assertion.request(subject), new AbortController().signal),
	)

	let result: ConformanceOutcome
	if (assertion.expectation.kind === 'resolves') {
		result =
			settled.kind === 'resolved'
				? checkResolved(assertion, assertion.expectation, settled.value)
				: titledOutcome(
						assertion.id,
						assertion.title,
						false,
						`rejected with ${describeThrown(settled.error)} instead of returning an observation`,
					)
	} else {
		result =
			settled.kind === 'rejected'
				? checkRejected(assertion, assertion.expectation.code, settled.error)
				: titledOutcome(
						assertion.id,
						assertion.title,
						false,
						`resolved instead of rejecting with "${assertion.expectation.code}"`,
					)
	}

	result = checkCalls(assertion, subject, run.built, result)
	return withDispose(result, await disposeScenario(run.built))
}

/**
 * Nineteen outcomes: the six shared assertions plus AD-35's thirteen.
 * `maxRequestBytes` is the one cap with no assertion; the request shape is the
 * suite's own, so the suite cannot make a subject emit an oversize request. It
 * stays declared and adapter-enforced.
 */
export async function runEnvironmentProbePortConformance(
	subject: ProbeSubject,
): Promise<ConformanceReport> {
	const shared = await runSharedAssertions(
		'probe',
		subject,
		probeParsers.response,
	)
	const additional: ConformanceOutcome[] = []
	for (const assertion of PROBE_ASSERTIONS) {
		additional.push(await runProbeAssertion(assertion, subject))
	}
	return reportOf(subject.name, 'environment-probe', [...shared, ...additional])
}
