/**
 * AD-35's thirteen extra assertions, for the environment-probe port only. The
 * subject supplies its policy and one request per denial, since only it knows
 * how its own interface-to-target mapping is wired.
 *
 * Each of the thirteen builds its own `'resolves'` subject and reads
 * `underlyingCalls()` from a counter starting at zero, so every count below is
 * absolute.
 *
 * **This suite certifies an adapter for the `api` mechanism and says nothing
 * about the `cli` one.** Every scenario is HTTP: redirects, methods, schemes,
 * an anomalous status. `ProbeSubject` requires an unauthorized-method request,
 * a redirecting request and a not-found request, none of which a command
 * adapter has. So an adapter that runs commands cannot present a subject here,
 * and an adapter that passes all nineteen has been shown nothing about whether
 * it can run one safely: it may deny an unmapped executable or execute a shell
 * string, and this suite cannot tell the difference.
 *
 * That is a real gap in the published surface and it is wider than this suite.
 * `ProbeTargetPolicy` has one authorization shape and every field in it is
 * HTTP: scheme, host, port, resolved addresses, methods, safe methods,
 * redirects, request and response byte caps. **A command interface cannot be
 * authorized at all**, so AD-35's "an adapter denies by default and permits
 * only what that mapping names" has nothing to name for the mechanism this
 * release adds, and a conformance arm built on top of a policy that cannot
 * express a command authorization would certify against nothing.
 *
 * Closing it is a declaration first and a suite second: a command
 * authorization naming a permitted executable, the subcommand paths and
 * environment keys it may carry, and its own elapsed and output-byte caps;
 * then the denials to certify — an executable no mapping names, a refusal to
 * accept a pre-built argument vector, a non-zero exit as an observation rather
 * than a fault, each cap enforced. That is a design addition to the published
 * surface rather than a repair, and it is not made here. Until it exists an
 * adopter writing a command adapter has no policy to declare and no harness to
 * run, and this comment is here so nobody concludes from a green run that they
 * have either.
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
				observation.kind === 'api' && observation.status === 500
					? undefined
					: `observed ${observation.kind === 'api' ? `status ${observation.status}` : 'a command observation'}, expected status 500`,
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
	request: ProbeRequest,
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
	// Schema validity is not correlation. Both messages are unions now, so an
	// adapter can answer a command request with a schema-valid HTTP observation
	// and satisfy every assertion below without running a command or consulting
	// a policy. The four echoed fields are what tie one answer to one question,
	// and `ProbeRequest.probeId`'s own description already says the port returns
	// them unchanged.
	const mismatch = echoMismatch(request, parsed.data)
	if (mismatch !== undefined) {
		return titledOutcome(assertion.id, assertion.title, false, mismatch)
	}
	const complaint = expectation.check?.(parsed.data)
	return titledOutcome(
		assertion.id,
		assertion.title,
		complaint === undefined,
		complaint ?? '',
	)
}

/**
 * Which of the four echoed fields the observation failed to return unchanged,
 * or `undefined` when it answered the question it was asked.
 */
function echoMismatch(
	request: ProbeRequest,
	observation: ProbeObservation,
): string | undefined {
	const echoed = [
		['kind', request.kind, observation.kind],
		['probeId', request.probeId, observation.probeId],
		['interfaceId', request.interfaceId, observation.interfaceId],
		['operationId', request.operationId, observation.operationId],
	] as const
	for (const [field, asked, answered] of echoed) {
		if (asked === answered) continue
		return `observed ${field} "${answered}" for a request carrying "${asked}", so the answer does not correlate with the question`
	}
	return undefined
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
	const request = assertion.request(subject)
	const settled = await settle(
		run.built.port(request, new AbortController().signal),
	)

	let result: ConformanceOutcome
	if (assertion.expectation.kind === 'resolves') {
		result =
			settled.kind === 'resolved'
				? checkResolved(
						assertion,
						assertion.expectation,
						settled.value,
						request,
					)
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
