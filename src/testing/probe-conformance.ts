/**
 * AD-35's extra assertions for the environment-probe port, one arm per
 * mechanism. The subject supplies its policy and one request per denial,
 * since only it knows how its own interface-to-target mapping is wired.
 *
 * `runEnvironmentProbePortConformance` is the `api` arm: thirteen assertions,
 * every scenario HTTP (an authorized target reached, an anomalous status read
 * as an observation, an unmapped interface, four denied address classes, a
 * method, a scheme, a redirect revalidated and refused, and three caps).
 * `runCommandLineProbeConformance` is the `cli` arm: nine, over an authorized
 * invocation, a non-zero exit read as an observation, an unmapped interface, an
 * unmapped executable, an unauthorized subcommand path, a shell-metacharacter
 * argument proven to reach the process as one literal token rather than a shell
 * expansion, a declared artifact captured, and both caps.
 * `runMcpProbeConformance` is the `mcp` arm: eight, over an authorized tool
 * call, a tool-reported error read as an observation, an unmapped interface, an
 * unauthorized tool, a declared argument proven to cross the JSON-RPC frame
 * unchanged, the structured result the operation's descriptor describes, and
 * both caps.
 *
 * Every field an authorization scopes owes a denial, which is the largest term
 * in the three counts: an HTTP authorization scopes the interface, four
 * address classes, the method and the scheme; a command authorization the
 * interface, the executable and the subcommand path; a tool-server
 * authorization the interface and the tool. Each arm then adds the caps its
 * mechanism can be made to exceed and the answers it has to read as
 * observations.
 *
 * The arms are separate functions rather than one, because their subjects need
 * disjoint fixtures (an HTTP redirect chain has no command analogue, and a
 * subcommand allowlist has no tool-call one) and a subject presenting for one
 * mechanism is not asked to fake another's scenarios. What they do share is
 * the machinery below `ArmAssertion`: one assertion shape generic over the
 * subject type, one runner, one resolve-side checker and one call-count
 * checker, so a fourth mechanism writes its subject and its list and nothing
 * else.
 *
 * Each assertion in every arm builds its own `'resolves'` subject and reads
 * `underlyingCalls()` from a counter starting at zero, so every count below is
 * absolute.
 */
import type {
	ProbeObservation,
	ProbeRequest,
} from '../core/schemas/port-messages.ts'
import type {
	CommandTargetAuthorization,
	CommandTargetPolicy,
	McpTargetAuthorization,
	McpTargetPolicy,
	ProbeTargetAuthorization,
	ProbeTargetPolicy,
} from '../core/schemas/probe-policy.ts'
import { probeParsers } from '../ports/environment-probe-port.ts'
import type {
	BuiltSubject,
	ConformanceOutcome,
	ConformancePort,
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

const DENIED = 'forbidden-target'
const CAPPED = 'budget-exhausted'

/**
 * One assertion in one arm, generic over that arm's subject type.
 *
 * `resolves` also requires `check` to pass. `rejects` pins the AD-28 code:
 * conflate a denial with a cap and an operator reads "forbidden target" when
 * an authorized target answered too much or too slowly.
 *
 * `check` and `expectedCalls` both take the arm's own subject, because some
 * assertions read a value only the subject's fixtures know: an artifact's
 * expected bytes, an injected argument's literal text, a policy's declared
 * redirect bound.
 */
type ArmAssertion<Subject> = {
	readonly id: string
	readonly title: string
	readonly request: (subject: Subject) => ProbeRequest
	readonly expectation:
		| {
				readonly kind: 'resolves'
				readonly check?: (
					observation: ProbeObservation,
					subject: Subject,
				) => string | undefined
		  }
		| { readonly kind: 'rejects'; readonly code: string }
	/** the absolute `underlyingCalls()` this assertion pins, or `undefined` when it pins none. */
	readonly expectedCalls?: (subject: Subject) => number | string
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

/**
 * Schema, then correlation, then the assertion's own predicate. Generic over
 * the subject rather than written once per arm: a function parameter is
 * checked contravariantly, so an arm's `check` cannot be widened across
 * subject types, and inferring the subject here costs the assertion records no
 * type parameter of their own.
 */
function checkResolvedFor<Subject>(
	assertion: ArmAssertion<Subject>,
	check:
		| ((observation: ProbeObservation, subject: Subject) => string | undefined)
		| undefined,
	value: unknown,
	request: ProbeRequest,
	subject: Subject,
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
	// Schema validity is not correlation. Both messages are unions, so an
	// adapter can answer a command request or a tool call with a schema-valid
	// HTTP observation and satisfy every assertion below without running a
	// command, opening a session, or consulting a policy. The four echoed
	// fields are what tie one answer to one question, and `ProbeRequest.probeId`'s
	// own description already says the port returns them unchanged.
	const mismatch = echoMismatch(request, parsed.data)
	if (mismatch !== undefined) {
		return titledOutcome(assertion.id, assertion.title, false, mismatch)
	}
	const complaint = check?.(parsed.data, subject)
	return titledOutcome(
		assertion.id,
		assertion.title,
		complaint === undefined,
		complaint ?? '',
	)
}

/** Generic for `checkResolvedFor`'s reason: `expectedCalls` names its own arm's subject type. */
function checkCallCount<Subject, Request>(
	expectedCalls: ((subject: Subject) => number | string) | undefined,
	subject: Subject,
	built: BuiltSubject<Request>,
	base: ConformanceOutcome,
): ConformanceOutcome {
	if (expectedCalls === undefined) return base
	// Every branch keeps whatever the assertion's own check already said. An
	// outcome that failed its predicate AND hit a subject-side count problem
	// used to report only the second, which hid the reason the assertion was
	// looked at in the first place.
	const also = (complaint: string): ConformanceOutcome => ({
		...base,
		passed: false,
		detail: base.passed ? complaint : `${base.detail}; ${complaint}`,
	})
	const expected = expectedCalls(subject)
	if (typeof expected === 'string') return also(expected)
	const actual = countCalls(built)
	if (typeof actual === 'string') return also(actual)
	if (actual === expected) return base
	return also(`underlyingCalls() was ${actual}, expected ${expected}`)
}

async function runArmAssertion<Subject extends PortSubject<ProbeRequest>>(
	assertion: ArmAssertion<Subject>,
	subject: Subject,
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
				? checkResolvedFor(
						assertion,
						assertion.expectation.check,
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

	result = checkCallCount(assertion.expectedCalls, subject, run.built, result)
	return withDispose(result, await disposeScenario(run.built))
}

/** The six shared assertions, then the arm's own, in list order. */
async function runArm<Subject extends PortSubject<ProbeRequest>>(
	subject: Subject,
	port: ConformancePort,
	assertions: readonly ArmAssertion<Subject>[],
): Promise<ConformanceReport> {
	const shared = await runSharedAssertions(
		'probe',
		subject,
		probeParsers.response,
	)
	const additional: ConformanceOutcome[] = []
	for (const assertion of assertions) {
		additional.push(await runArmAssertion(assertion, subject))
	}
	return reportOf(subject.name, port, [...shared, ...additional])
}

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

function authorizationFor(
	subject: ProbeSubject,
	request: ProbeRequest,
): ProbeTargetAuthorization | undefined {
	return subject.policy.authorizations.find(
		(each: ProbeTargetAuthorization) =>
			each.interfaceId === request.interfaceId,
	)
}

const PROBE_ASSERTIONS: readonly ArmAssertion<ProbeSubject>[] = [
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
		//
		// The non-`api` arm of the detail below names the kind it observed. It
		// is reached when the subject declares a `faultingRequest` of another
		// kind and answers it correlated, which `ProbeSubject` admits because
		// the field is typed over the whole request union. Substituting only
		// the observation's kind does not reach it: `echoMismatch` compares
		// `kind` among the four echoed fields and short-circuits first.
		id: 'probe/observe-anomalous-status',
		title: 'a 500 from an authorized target is an observation, not a fault',
		request: (subject) => subject.faultingRequest,
		expectation: {
			kind: 'resolves',
			check: (observation) =>
				observation.kind === 'api' && observation.status === 500
					? undefined
					: `observed ${observation.kind === 'api' ? `status ${observation.status}` : `an observation of kind "${observation.kind}"`}, expected status 500`,
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

/**
 * Nineteen outcomes: the six shared assertions plus AD-35's thirteen.
 * `maxRequestBytes` is the one cap with no assertion; the request shape is the
 * suite's own, so the suite cannot make a subject emit an oversize request. It
 * stays declared and adapter-enforced.
 */
export async function runEnvironmentProbePortConformance(
	subject: ProbeSubject,
): Promise<ConformanceReport> {
	return runArm(subject, 'environment-probe', PROBE_ASSERTIONS)
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

/**
 * The authorization the subject's own command policy resolves this request to.
 * Keyed by the pair, since `CommandTargetAuthorization` is.
 *
 * The two denial assertions that call it read it for the reason
 * `mcpAuthorizationFor` exists: a subject whose "unmapped" request is in fact
 * mapped passes its own denial for the wrong reason.
 *
 * It takes the narrowed request, so each caller states what it does about a
 * subject that declared another kind there rather than inheriting a silent
 * `undefined` from here. `mcpAuthorizationFor` needs no such narrowing because
 * it reads `interfaceId`, which every member of the request union carries.
 */
function commandAuthorizationFor(
	subject: CommandProbeSubject,
	request: Extract<ProbeRequest, { kind: 'cli' }>,
): CommandTargetAuthorization | undefined {
	return subject.policy.authorizations.find(
		(each: CommandTargetAuthorization) =>
			each.interfaceId === request.interfaceId &&
			each.executable === request.executable,
	)
}

const COMMAND_ASSERTIONS: readonly ArmAssertion<CommandProbeSubject>[] = [
	{
		id: 'command/allow-authorized-invocation',
		title: 'an explicitly authorized command runs and is observed',
		request: (subject) => subject.authorizedRequest,
		expectation: { kind: 'resolves' },
	},
	{
		// The non-`cli` arm of the detail below is reached the same way the
		// `api` arm's is: `nonZeroExitRequest` is typed over the whole request
		// union, so a subject may declare another kind there and answer it
		// correlated. It names the observed kind; the binary ternary it
		// replaced called every one of them "an api observation".
		id: 'command/observe-nonzero-exit',
		title:
			'a non-zero exit from an authorized command is an observation, not a fault',
		request: (subject) => subject.nonZeroExitRequest,
		expectation: {
			kind: 'resolves',
			check: (observation) =>
				observation.kind === 'cli' && observation.exitCode !== 0
					? undefined
					: `observed ${observation.kind === 'cli' ? `exit code ${observation.exitCode}` : `an observation of kind "${observation.kind}"`}, expected a non-zero exit`,
		},
	},
	{
		id: 'command/deny-unmapped-interface',
		title:
			'an interface no authorization names is refused before a process spawns',
		request: (subject) => subject.unmappedInterfaceRequest,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: (subject) =>
			subject.policy.authorizations.some(
				(each: CommandTargetAuthorization) =>
					each.interfaceId === subject.unmappedInterfaceRequest.interfaceId,
			)
				? "the subject's policy names an authorization for unmappedInterfaceRequest.interfaceId, so the request it presents as unmapped is mapped"
				: 0,
	},
	{
		id: 'command/deny-unmapped-executable',
		title:
			'an executable the interface is never paired with is refused before a process spawns',
		request: (subject) => subject.unmappedExecutableRequest,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: (subject) => {
			const request = subject.unmappedExecutableRequest
			if (request.kind !== 'cli') {
				return `unmappedExecutableRequest declares a "${request.kind}" request, which names no executable for the policy to refuse`
			}
			return commandAuthorizationFor(subject, request) === undefined
				? 0
				: "the subject's policy pairs unmappedExecutableRequest's interface with its executable, so the pair it presents as unmapped is mapped"
		},
	},
	{
		id: 'command/deny-unauthorized-subcommand',
		title:
			'a subcommand path outside the authorized set is refused before a process spawns',
		request: (subject) => subject.unauthorizedSubcommandRequest,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: (subject) => {
			const request = subject.unauthorizedSubcommandRequest
			if (request.kind !== 'cli') {
				return `unauthorizedSubcommandRequest declares a "${request.kind}" request, which names no subcommand path for the policy to refuse`
			}
			const authorization = commandAuthorizationFor(subject, request)
			if (authorization === undefined) {
				return "the subject's policy names no authorization for unauthorizedSubcommandRequest's interface and executable, so this case cannot tell an unmapped pair from an unauthorized subcommand"
			}
			return authorization.permittedSubcommandPaths.some(
				(permitted: readonly string[]) =>
					permitted.length === request.subcommandPath.length &&
					permitted.every(
						(segment: string, at: number) =>
							segment === request.subcommandPath[at],
					),
			)
				? `the subject's policy permits subcommand path ${JSON.stringify(request.subcommandPath)}, so the request it presents as unauthorized is authorized`
				: 0
		},
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

/**
 * Fifteen outcomes: the six shared assertions plus the nine above. Unlike the
 * `api` arm, every cap here has an assertion: a command subject's fixture
 * script can be told to overrun a byte cap directly, with no oversize-request
 * problem to work around.
 */
export async function runCommandLineProbeConformance(
	subject: CommandProbeSubject,
): Promise<ConformanceReport> {
	return runArm(subject, 'command-probe', COMMAND_ASSERTIONS)
}

/**
 * The `mcp` arm's subject, on the division the other two draw: the subject
 * knows how its own mapping is wired and what its fixture server answers, the
 * suite only knows what each request should produce.
 *
 * Two of its requests carry a value the suite has to compare against
 * something, so the subject publishes that value beside the request. Both
 * comparisons read a scalar the tool returns rather than a collection: a check
 * over an empty collection resolves to insufficient evidence, so an assertion
 * spelled that way would report vacuous and could never witness a dropped
 * argument or a dropped result.
 */
export type McpProbeSubject = PortSubject<ProbeRequest> & {
	readonly policy: McpTargetPolicy
	/** a tool call the policy ALLOWS, against the subject's own fixture server. */
	readonly authorizedRequest: ProbeRequest
	/** an interfaceId no authorization names. */
	readonly unmappedInterfaceRequest: ProbeRequest
	/** an interfaceId the policy names, asking for a toolName its authorization omits. */
	readonly unauthorizedToolRequest: ProbeRequest
	/** authorized, and answered by a tool result carrying the envelope's error flag AND the content the tool reported the failure with, since the assertion checks both survived. */
	readonly errorResultRequest: ProbeRequest
	/** authorized, carrying a metacharacter-bearing value on one argument key. */
	readonly argumentEchoRequest: ProbeRequest
	/** the exact literal `argumentEchoRequest` carries, so the assertion can confirm the tool received it byte for byte. */
	readonly argumentEchoValue: string
	/** the structured-result key the fixture tool publishes that received value under. */
	readonly argumentEchoResultKey: string
	/** authorized, and answered with the structured result the operation's descriptor describes. */
	readonly structuredResultRequest: ProbeRequest
	/** the keys that result carries, so a dropped or emptied result channel fails. */
	readonly structuredResultKeys: readonly string[]
	/** authorized against a maxElapsedMs the server is made to answer past. */
	readonly overElapsedRequest: ProbeRequest
	/** authorized against a maxOutputBytes the server is made to write past. */
	readonly overResultBytesRequest: ProbeRequest
}

/**
 * The authorization the subject's own policy resolves this request to.
 *
 * The two denial assertions read it to check the subject is internally
 * consistent: a subject whose "unmapped" request is in fact mapped, or whose
 * "unauthorized" tool is in fact on the allowlist, would pass its own denial
 * for the wrong reason and certify an adapter that never refused anything.
 */
function mcpAuthorizationFor(
	subject: McpProbeSubject,
	request: ProbeRequest,
): McpTargetAuthorization | undefined {
	return subject.policy.authorizations.find(
		(each: McpTargetAuthorization) => each.interfaceId === request.interfaceId,
	)
}

/** The tool's structured result as a key map, or `undefined` when the observation carries no JSON object there. */
function structuredResultOf(
	observation: ProbeObservation,
): Record<string, unknown> | undefined {
	if (observation.kind !== 'mcp' || observation.result.kind !== 'json') {
		return undefined
	}
	const { value } = observation.result
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined
}

const MCP_ASSERTIONS: readonly ArmAssertion<McpProbeSubject>[] = [
	{
		id: 'mcp/allow-authorized-tool-call',
		title:
			'an explicitly authorized tool call reaches its server and is observed',
		request: (subject) => subject.authorizedRequest,
		expectation: { kind: 'resolves' },
	},
	{
		// The rule a tool-use adapter breaks first. A tool's own error result is
		// the payload AD-10's seeded-fault check reads, so an adapter that
		// throws on it makes every probe written to catch that refusal invisible.
		//
		// The non-`mcp` arm of the detail is reachable the way the other two
		// arms' are: `errorResultRequest` is typed over the whole request union,
		// so a subject may declare another kind there and answer it correlated,
		// which is what gets past `echoMismatch` to this check.
		id: 'mcp/observe-error-result',
		title:
			'a tool-reported error from an authorized server is an observation, not a fault',
		request: (subject) => subject.errorResultRequest,
		expectation: {
			kind: 'resolves',
			check: (observation) => {
				if (observation.kind !== 'mcp') {
					return `observed an observation of kind "${observation.kind}", expected the envelope's error flag set`
				}
				if (!observation.isError) {
					return "observed a tool call reporting no error, expected the envelope's error flag set"
				}
				// The flag alone is half the rule. An adapter that reads the
				// envelope and drops what the tool said about the failure passes a
				// flag-only check, and the seeded-fault oracle downstream then has
				// the error announced and nothing to assert on.
				//
				// The detail names the subject's obligation rather than accusing
				// the adapter, because the two are indistinguishable from here: a
				// tool reporting a failure through a prose `content` array and no
				// structured content produces the same absent channel, and the
				// kind's first version describes structured results only.
				return observation.result.kind === 'absent'
					? 'the error came back on an absent result channel; errorResultRequest has to name a tool whose failure carries structured content, since a tool that publishes none looks the same here as an adapter that dropped it'
					: undefined
			},
		},
	},
	{
		id: 'mcp/deny-unmapped-interface',
		title:
			'an interface no authorization names is refused before a server process starts',
		request: (subject) => subject.unmappedInterfaceRequest,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: (subject) =>
			mcpAuthorizationFor(subject, subject.unmappedInterfaceRequest) ===
			undefined
				? 0
				: "the subject's policy names an authorization for unmappedInterfaceRequest.interfaceId, so the request it presents as unmapped is mapped",
	},
	{
		// The tool allowlist is the second and last authorization-scoped field,
		// and it draws AD-35's disclosure boundary inside the server: a tool the
		// list omits is unreachable even when the server publishes it.
		id: 'mcp/deny-unauthorized-tool',
		title:
			'a tool outside the authorized list is refused before a server process starts',
		request: (subject) => subject.unauthorizedToolRequest,
		expectation: { kind: 'rejects', code: DENIED },
		expectedCalls: (subject) => {
			const request = subject.unauthorizedToolRequest
			if (request.kind !== 'mcp') {
				return `unauthorizedToolRequest declares a "${request.kind}" request, which names no tool for the policy to refuse`
			}
			const authorization = mcpAuthorizationFor(subject, request)
			if (authorization === undefined) {
				return "the subject's policy names no authorization for unauthorizedToolRequest.interfaceId, so this case cannot tell an unmapped interface from an unauthorized tool"
			}
			return authorization.tools.includes(request.toolName)
				? `the subject's policy permits tool "${request.toolName}" on interface "${request.interfaceId}", so the request it presents as unauthorized is authorized`
				: 0
		},
	},
	{
		// The tool-call twin of the command arm's literal-argument proof. A
		// declared value crosses a JSON-RPC frame here rather than a command
		// line, so what this catches is a value re-encoded, coerced, or
		// truncated in framing, and the metacharacters are what make a
		// re-encoding visible in the echo.
		id: 'mcp/arguments-passed-as-declared',
		title: 'a declared argument value reaches the tool byte for byte',
		request: (subject) => subject.argumentEchoRequest,
		expectation: {
			kind: 'resolves',
			check: (observation, subject) => {
				if (observation.kind !== 'mcp') {
					return `observed an observation of kind "${observation.kind}", expected a tool call`
				}
				const result = structuredResultOf(observation)
				if (result === undefined) {
					return 'the observation carries no structured result to read the received argument from'
				}
				const received = result[subject.argumentEchoResultKey]
				return received === subject.argumentEchoValue
					? undefined
					: `the tool reported receiving ${JSON.stringify(received)} on "${subject.argumentEchoResultKey}", expected the declared literal`
			},
		},
	},
	{
		// An adapter that reads the envelope and drops `structuredContent`
		// still resolves and still correlates, and every oracle over the result
		// then resolves absent. That reads as a contract nothing satisfies
		// rather than as an adapter that answered nowhere, which is the failure
		// this assertion exists to name.
		id: 'mcp/observe-declared-result-channel',
		title:
			"the tool's structured result is carried on the channel its descriptor describes",
		request: (subject) => subject.structuredResultRequest,
		expectation: {
			kind: 'resolves',
			check: (observation, subject) => {
				if (observation.kind !== 'mcp') {
					return `observed an observation of kind "${observation.kind}", expected a tool call`
				}
				const result = structuredResultOf(observation)
				if (result === undefined) {
					return `the result channel carried ${JSON.stringify(observation.result)}, expected the structured result carrying ${JSON.stringify(subject.structuredResultKeys)}`
				}
				const missing = subject.structuredResultKeys.filter(
					(key: string) => !(key in result),
				)
				return missing.length === 0
					? undefined
					: `the result channel is missing ${JSON.stringify(missing)}`
			},
		},
	},
	{
		id: 'mcp/cap-elapsed',
		title:
			'a session past maxElapsedMs is capped, not left running for the caller',
		request: (subject) => subject.overElapsedRequest,
		expectation: { kind: 'rejects', code: CAPPED },
	},
	{
		id: 'mcp/cap-result-bytes',
		title: 'a result past maxOutputBytes is capped, not returned in part',
		request: (subject) => subject.overResultBytesRequest,
		expectation: { kind: 'rejects', code: CAPPED },
	},
]

/**
 * Fourteen outcomes: the six shared assertions plus the eight above. Fewer
 * than either other arm because a tool-server authorization scopes two fields:
 * one session is opened against one server and every tool it offers belongs to
 * that server, so the interface identifier is the server identity and the tool
 * allowlist is the only thing left to deny on.
 *
 * Two rules the reference adapter follows are outside what a green run
 * certifies, and an author reading this should know which. A JSON-RPC error
 * answering `tools/call` is an observation on the same terms a tool-reported
 * error is, and the byte cap applies to the server's own stderr as well as its
 * stdout. Neither has an assertion here, because the derivation above gives
 * each arm one denial per authorization-scoped field and one assertion per cap
 * the suite can make a subject exceed, and both of these are a second spelling
 * of an assertion the arm already carries. The reference adapter's own tests
 * cover both.
 */
export async function runMcpProbeConformance(
	subject: McpProbeSubject,
): Promise<ConformanceReport> {
	return runArm(subject, 'mcp-probe', MCP_ASSERTIONS)
}
