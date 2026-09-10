/**
 * AD-35's extra assertions for the environment-probe port, one arm per
 * mechanism. The subject supplies its policy and one request per denial,
 * since only it knows how its own interface-to-target mapping is wired.
 *
 * `runEnvironmentProbePortConformance` is the `api` arm: thirteen assertions,
 * every scenario HTTP (redirects, methods, schemes, an anomalous status).
 * `runCommandLineProbeConformance` is the `cli` arm, added once
 * `CommandTargetPolicy` gave the mechanism something to authorize: an
 * unmapped interface, an unmapped executable, an unauthorized subcommand path,
 * a non-zero exit read as an observation, a shell-metacharacter argument
 * proven to reach the process as one literal token rather than a shell
 * expansion, a declared artifact captured, and both caps enforced. The two
 * arms are separate functions rather than one, because their subjects need
 * disjoint fixtures (an HTTP redirect chain has no command analogue, and a
 * subcommand allowlist has no HTTP one) and a subject presenting for one
 * mechanism is not asked to fake the other's scenarios.
 *
 * Each assertion in either arm builds its own `'resolves'` subject and reads
 * `underlyingCalls()` from a counter starting at zero, so every count below is
 * absolute.
 */
import type {
	ProbeObservation,
	ProbeRequest,
} from '../core/schemas/port-messages.ts'
import type {
	CommandTargetPolicy,
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
					: `observed ${observation.kind === 'api' ? `status ${observation.status}` : `a "${observation.kind}" observation`}, expected status 500`,
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

/** Reads only `id` and `title`, so both arms' assertion shapes satisfy it structurally. */
function checkRejected(
	assertion: { readonly id: string; readonly title: string },
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

/**
 * The `cli` arm's subject. Every field is a request `evaluateCommandTarget`
 * decides one specific way against the subject's own `policy`, the same
 * division `ProbeSubject` draws for the `api` arm: the subject knows how its
 * mapping is wired, the suite only knows what each request should produce.
 */
export type CommandProbeSubject = PortSubject<ProbeRequest> & {
	readonly policy: CommandTargetPolicy
	/** a request the policy ALLOWS, run against the subject's own fixture executable. */
	readonly authorizedRequest: ProbeRequest
	/** an interfaceId no authorization names. */
	readonly unmappedInterfaceRequest: ProbeRequest
	/** an interfaceId the policy names, paired with an executable it never names. */
	readonly unmappedExecutableRequest: ProbeRequest
	/** an interface-executable pair the policy names, with a subcommandPath no authorization for it permits. */
	readonly unauthorizedSubcommandRequest: ProbeRequest
	/** authorized, and answered by the fixture exiting non-zero. */
	readonly nonZeroExitRequest: ProbeRequest
	/** authorized, carrying a shell-metacharacter value on one argument channel key. */
	readonly injectionRequest: ProbeRequest
	/** the exact literal value `injectionRequest` carries, so the assertion can confirm the fixture received it byte for byte. */
	readonly injectionArgumentValue: string
	/** authorized, and its authorization declares one artifact identifier the fixture writes when run. */
	readonly artifactRequest: ProbeRequest
	readonly artifactId: string
	readonly artifactExpectedText: string
	/** authorized against a maxElapsedMs the fixture is made to sleep past. */
	readonly overElapsedRequest: ProbeRequest
	/** authorized against a maxOutputBytes the fixture is made to write past. */
	readonly overOutputRequest: ProbeRequest
}

/** Unlike `Expectation`, `check` also reads `subject`: two of the seven command assertions check a value only the subject's own fixtures know (an artifact's expected bytes, an injected argument's literal text). */
type CommandExpectation =
	| {
			readonly kind: 'resolves'
			readonly check?: (
				observation: ProbeObservation,
				subject: CommandProbeSubject,
			) => string | undefined
	  }
	| { readonly kind: 'rejects'; readonly code: string }

type CommandAssertion = {
	readonly id: string
	readonly title: string
	readonly request: (subject: CommandProbeSubject) => ProbeRequest
	readonly expectation: CommandExpectation
	readonly expectedCalls?: (subject: CommandProbeSubject) => number | string
}

const COMMAND_ASSERTIONS: readonly CommandAssertion[] = [
	{
		id: 'command/allow-authorized-invocation',
		title: 'an explicitly authorized command runs and is observed',
		request: (subject) => subject.authorizedRequest,
		expectation: { kind: 'resolves' },
	},
	{
		id: 'command/observe-nonzero-exit',
		title:
			'a non-zero exit from an authorized command is an observation, not a fault',
		request: (subject) => subject.nonZeroExitRequest,
		expectation: {
			kind: 'resolves',
			check: (observation) =>
				observation.kind === 'cli' && observation.exitCode !== 0
					? undefined
					: `observed ${observation.kind === 'cli' ? `exit code ${observation.exitCode}` : `a "${observation.kind}" observation`}, expected a non-zero exit`,
		},
	},
	{
		id: 'command/deny-unmapped-interface',
		title:
			'an interface no authorization names is refused before a process spawns',
		request: (subject) => subject.unmappedInterfaceRequest,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: () => 0,
	},
	{
		id: 'command/deny-unmapped-executable',
		title:
			'an executable the interface is never paired with is refused before a process spawns',
		request: (subject) => subject.unmappedExecutableRequest,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: () => 0,
	},
	{
		id: 'command/deny-unauthorized-subcommand',
		title:
			'a subcommand path outside the authorized set is refused before a process spawns',
		request: (subject) => subject.unauthorizedSubcommandRequest,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: () => 0,
	},
	{
		// The strongest available proof that no shell ever reads a channel value:
		// an argument built to look like a command substitution, checked to reach
		// the process as the one, unmodified literal token it was declared as.
		id: 'command/argument-passed-literally',
		title:
			'a shell-metacharacter argument reaches the process as one unmodified literal token, never a shell expansion',
		request: (subject) => subject.injectionRequest,
		expectation: {
			kind: 'resolves',
			check: (observation, subject) => {
				if (observation.kind !== 'cli' || observation.stdout.kind !== 'json') {
					return 'the observation carries no parsed stdout to check the received argument against'
				}
				const argv = (observation.stdout.value as { argv?: unknown }).argv
				const received = Array.isArray(argv) ? argv : []
				return received.length === 1 &&
					received[0] === subject.injectionArgumentValue
					? undefined
					: `the process observed argv ${JSON.stringify(received)}, expected exactly one element equal to the declared literal`
			},
		},
	},
	{
		id: 'command/capture-declared-artifact',
		title:
			"a declared artifact identifier reads the file the run wrote, keyed by the operation's own identifier",
		request: (subject) => subject.artifactRequest,
		expectation: {
			kind: 'resolves',
			check: (observation, subject) => {
				if (observation.kind !== 'cli') {
					return 'the observation is not a command observation'
				}
				const artifact = observation.artifacts[subject.artifactId]
				return artifact?.kind === 'text' &&
					artifact.value === subject.artifactExpectedText
					? undefined
					: `artifacts["${subject.artifactId}"] was ${JSON.stringify(artifact)}, expected the fixture's declared text`
			},
		},
	},
	{
		id: 'command/cap-elapsed',
		title: 'a process past maxElapsedMs is capped, not left to finish',
		request: (subject) => subject.overElapsedRequest,
		expectation: { kind: 'rejects', code: CAPPED },
	},
	{
		id: 'command/cap-output-bytes',
		title:
			'output past maxOutputBytes is capped, not silently truncated and returned',
		request: (subject) => subject.overOutputRequest,
		expectation: { kind: 'rejects', code: CAPPED },
	},
]

function checkCommandResolved(
	assertion: CommandAssertion,
	expectation: Extract<CommandExpectation, { kind: 'resolves' }>,
	value: unknown,
	request: ProbeRequest,
	subject: CommandProbeSubject,
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
	const mismatch = echoMismatch(request, parsed.data)
	if (mismatch !== undefined) {
		return titledOutcome(assertion.id, assertion.title, false, mismatch)
	}
	const complaint = expectation.check?.(parsed.data, subject)
	return titledOutcome(
		assertion.id,
		assertion.title,
		complaint === undefined,
		complaint ?? '',
	)
}

/** `checkCalls`'s own logic, typed against `CommandAssertion`/`CommandProbeSubject` rather than the `api` arm's pair: a function parameter type is checked contravariantly, so the two assertion shapes cannot share one checker. */
function checkCommandCalls<Request>(
	assertion: CommandAssertion,
	subject: CommandProbeSubject,
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

async function runCommandAssertion(
	assertion: CommandAssertion,
	subject: CommandProbeSubject,
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
				? checkCommandResolved(
						assertion,
						assertion.expectation,
						settled.value,
						request,
						subject,
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

	result = checkCommandCalls(assertion, subject, run.built, result)
	return withDispose(result, await disposeScenario(run.built))
}

/**
 * Fifteen outcomes: the six shared assertions plus the nine above. Unlike the
 * `api` arm, every cap here has an assertion: a command subject's fixture
 * script can be told to overrun a byte cap directly, with no oversize-request
 * problem to work around.
 */
export async function runCommandLineProbeConformance(
	subject: CommandProbeSubject,
): Promise<ConformanceReport> {
	const shared = await runSharedAssertions(
		'probe',
		subject,
		probeParsers.response,
	)
	const additional: ConformanceOutcome[] = []
	for (const assertion of COMMAND_ASSERTIONS) {
		additional.push(await runCommandAssertion(assertion, subject))
	}
	return reportOf(subject.name, 'command-probe', [...shared, ...additional])
}
