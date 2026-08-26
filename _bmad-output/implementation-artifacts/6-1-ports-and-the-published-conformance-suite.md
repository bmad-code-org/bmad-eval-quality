# Story 6.1: Ports and the published conformance suite

Status: review

Epic: 6 (ports, pre-flight, and the library and CLI surface)
Story key: `6-1-ports-and-the-published-conformance-suite`
Implements: FR16 (AD-37), FR13's port half (AD-35), NFR1, NFR2, NFR9's order-independence
requirement on the observation array, NFR7's fixture rules.

## Story

As the first external adapter author,
I want every port defined by an executable conformance suite,
so that the load-bearing boundary is implementable against something checkable.

## Acceptance Criteria

### AC 1: Scope, module locations, and what this story does not build

This story is the whole port boundary: the four port types, the Zod message shapes they carry, the
one pure module AD-35's default-deny rule needs, the three shipped adapters, the published
conformance suite, and the in-repository probe adapter that exists only as the suite's subject.

**Every ```ts block in this file is labelled either `VERBATIM` (copy it into source as written; it
compiles and Biome does not reflow it) or `SKETCH` (declarations only, showing the exported surface;
the dev writes the bodies).**

**New files under `src/`:**

| Path | Layer | Holds |
| --- | --- | --- |
| `src/core/schemas/port-messages.ts` | `core-schemas` | the request and response shape of every port method |
| `src/core/schemas/probe-policy.ts` | `core-schemas` | AD-35's target-authorization declaration |
| `src/core/probe/target-policy.ts` | `core` | the address parser, the classifier, and the pure default-deny evaluator |
| `src/ports/corpus-port.ts` | `ports` | `CorpusPort` |
| `src/ports/environment-probe-port.ts` | `ports` | `EnvironmentProbePort` |
| `src/ports/clock-port.ts` | `ports` | `ClockPort` |
| `src/ports/file-system-port.ts` | `ports` | `FileSystemPort` |
| `src/adapters/node-file-system-adapter.ts` | `adapters` | `createNodeFileSystemAdapter` |
| `src/adapters/local-corpus-adapter.ts` | `adapters` | `createLocalCorpusAdapter` |
| `src/adapters/system-clock-adapter.ts` | `adapters` | `createSystemClockAdapter` |
| `src/testing/conformance.ts` | `testing` (new) | the report shape, the subject shape, the six shared assertions |
| `src/testing/probe-conformance.ts` | `testing` (new) | AD-35's thirteen additional assertions |
| `src/testing/index.ts` | `testing` (new) | the published subpath's surface |

**Edited files:**

- `src/ports/port.ts`: its header comment currently says "Story 6.1 owns `CorpusPort`,
  `EnvironmentProbePort`, `ClockPort`, `FileSystemPort`, their adapters, and their conformance
  suite." That sentence stops being a forward reference. Rewrite it to describe what `port.ts` holds
  now that those files exist. Nothing else in the file changes: `BoundaryParser`, `PortMethod`, and
  `InvokePortOptions` are unchanged, and `invokePort` is untouched.
- `scripts/dependency-direction.ts`: the `testing` layer (AC 10, six edits).
- `package.json`: the `./conformance` export subpath and the `test:conformance` script (AC 13).
- `README.md` and `_bmad-output/shareable/` (AC 13, Task 9).
- `.github/workflows/pr-checks.yml`: the named conformance step, on the two matrix jobs (AC 13).
- `tests/architecture/dependency-direction.test.ts`: the layer matrices (AC 12).

**This story does not build:**

1. **`core/preflight/`.** The probe plan and the pure verdict are Story 6.2. This story defines the
   probe port's request and observation shapes because `ports/` is this story's, and 6.2 consumes
   them unchanged, which is why Decision 9 settles the correlation field here rather than leaving
   6.2 to discover it is missing.
2. **A network adapter.** AD-2 (spine 169-174) is explicit that "v0 ships no network adapter at
   all". The probe subject the suite runs against lives under `tests/` and is excluded from
   `tsconfig-build.json`, so it cannot reach `dist/`.
3. **The AD-24 stage-signature table.** Story 6.4.
4. **Rubric compile checks, artifact immutability enforcement, the CLI, the root barrel's export
   surface.** Stories 6.3, 6.4, and 6.5. `src/index.ts` is not touched.
5. **New AD-5 or AD-28 codes.** Every denial in this story throws an existing AD-28 code. See
   Decision 7.
6. **A new dependency, runtime or development.** Nothing here needs one. Adding one is a Stack
   change under NFR4, a licence scan under NFR3, and a seven-day publication-age wait under NFR5,
   none of which is a story decision. `node:http`, `node:fs/promises`, `node:path`, and `node:os`
   are Node builtins used only under `src/adapters/` and `tests/`, where they are legal.
7. **A coverage provider.** NFR7's 90 percent `core/` floor is Story 6.5's acceptance criterion, and
   measuring it needs `@vitest/coverage-v8`, which is not installed. 6.5 inherits both the
   dependency decision and the measurement; this story's proxy is AC 12's fixture list, matching
   every prior story.

### AC 2: `src/core/schemas/port-messages.ts`  (VERBATIM)

One file, not four. The four ports' messages are one vocabulary (what crosses the AD-28 boundary),
and splitting a twenty-line shape per port adds four imports for no reader. Nothing here is added to
`INTERCHANGE_ARTIFACTS`: a port message is a boundary message, not an interchange artifact, so
`schemas/` stays at twelve documents and `check:schemas` stays at 12 (Decision 5).

```ts
/** the request and response shape of every AD-28 port method. */
import { z } from 'zod'
import { HttpMethod, PathTemplate } from './interface.ts'
import { Identifier, JsonValue, KeyName, Rfc3339Utc } from './primitives.ts'

// AD-8: the corpus port resolves an opaque reference to bytes from a
// caller-owned location. It does not check the digest: AD-8 puts digest
// recomputation in the core ("the core recomputes every per-artifact digest
// from the resolved bytes"), and an adapter that checked it would be trusting
// the manifest label AD-8 says is never trusted.
export const CorpusResolveRequest = z.strictObject({
	privateRef: z.string().min(1),
})

export const CorpusResolveResponse = z.strictObject({
	privateRef: z
		.string()
		.min(1)
		.describe(
			'Echoed back so a response cannot be silently bound to a different request. Nothing else in the response identifies what was resolved, and bytes carry no self-identity.',
		),
	bytes: z.instanceof(Uint8Array),
})

// AD-1 forbids a clock read under `core/`, so a timestamp arrives through a
// port. The request is an empty strict object rather than `void`: every
// `PortMethod` takes a request, and `invokePort` parses it, so a port with
// nothing to ask still needs a shape that parses.
export const ClockReadRequest = z.strictObject({})

export const ClockReadResponse = z.strictObject({
	now: Rfc3339Utc,
})

export const FileReadRequest = z.strictObject({
	path: z.string().min(1),
})

export const FileReadResponse = z.strictObject({
	path: z.string().min(1),
	bytes: z.instanceof(Uint8Array),
})

export const FileWriteRequest = z.strictObject({
	path: z.string().min(1),
	bytes: z.instanceof(Uint8Array),
})

export const FileWriteResponse = z.strictObject({
	path: z.string().min(1),
	byteLength: z.int().min(0),
})

/**
 * A request body and an observed body are both tagged. AD-28 exists to stop
 * two adapter authors resolving one boundary differently, and an untagged
 * `JsonValue` cannot tell a JSON string response from a `text/html` one,
 * because `JsonValue` accepts a bare string. `absent` is a branch rather than
 * `null`, since `null` is itself a legal JSON body.
 */
export const ProbeRequestBody = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('json'), value: JsonValue }),
	z.strictObject({ kind: z.literal('absent') }),
])

export const ProbeObservedBody = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('json'), value: JsonValue }),
	z.strictObject({ kind: z.literal('text'), value: z.string() }),
	z.strictObject({ kind: z.literal('absent') }),
])

/**
 * AD-35: the request names a logical interface identifier and never a URL,
 * host, or port. Mapping the identifier to an authorized target is the
 * adapter's, from configuration outside the contract.
 *
 * No credential appears here. AD-18 forbids a credential value in a
 * declaration, and the values that reach this shape come from a declaration;
 * authorization material is the adapter's, supplied by the same mapping that
 * authorizes the target.
 */
export const ProbeRequest = z.strictObject({
	probeId: Identifier.describe(
		'An opaque correlation label minted by the pre-flight plan and echoed unchanged on the observation. Two witnesses of one operation, and the three observations a state-reset differential needs, are otherwise distinguishable only by array position, which NFR9 forbids any stage from reading.',
	),
	interfaceId: Identifier,
	operationId: Identifier,
	method: HttpMethod,
	pathTemplate: PathTemplate,
	channels: z.strictObject({
		path: z.record(KeyName, JsonValue),
		query: z.record(KeyName, JsonValue),
		header: z
			.record(KeyName, z.string())
			.describe(
				'String-valued because a header value is a string on the wire; the other channels carry the declared JSON value.',
			),
		body: ProbeRequestBody,
	}),
})

/**
 * What the adapter observed. Deliberately response content only: no elapsed
 * time, no redirect count, no retry count. AD-35's caps are safety limits, so
 * exceeding one is a thrown `budget-exhausted` fault rather than a field on a
 * successful observation, and AD-10's verdict stays a function of what the
 * system returned rather than of how long the network took.
 *
 * Every response the system returns is an observation, at any status. Only a
 * policy denial, a cap, an abort, or a transport failure throws; a 500 is the
 * payload AD-10's seeded-fault check reads, never an error.
 */
export const ProbeObservation = z.strictObject({
	probeId: Identifier,
	interfaceId: Identifier,
	operationId: Identifier,
	status: z.int().min(100).max(599),
	headers: z
		.record(KeyName, z.string())
		.describe(
			'Repeated headers are joined with ", " per RFC 9110 before they reach this shape. `set-cookie` is the one header that rule is wrong for, and it is dropped rather than mangled: nothing in AD-10 reads it, and a joined `set-cookie` is a value no consumer can split back.',
		),
	body: ProbeObservedBody,
})

export type CorpusResolveRequest = z.infer<typeof CorpusResolveRequest>
export type CorpusResolveResponse = z.infer<typeof CorpusResolveResponse>
export type ClockReadRequest = z.infer<typeof ClockReadRequest>
export type ClockReadResponse = z.infer<typeof ClockReadResponse>
export type FileReadRequest = z.infer<typeof FileReadRequest>
export type FileReadResponse = z.infer<typeof FileReadResponse>
export type FileWriteRequest = z.infer<typeof FileWriteRequest>
export type FileWriteResponse = z.infer<typeof FileWriteResponse>
export type ProbeRequestBody = z.infer<typeof ProbeRequestBody>
export type ProbeObservedBody = z.infer<typeof ProbeObservedBody>
export type ProbeRequest = z.infer<typeof ProbeRequest>
export type ProbeObservation = z.infer<typeof ProbeObservation>
```

`z.instanceof(Uint8Array)` reads a global, not an import, so `core/schemas` still imports zod alone
and `check:layers` stays clean. It is also why these shapes must never join
`INTERCHANGE_ARTIFACTS`: `z.toJSONSchema` throws "Custom types cannot be represented in JSON Schema"
on it, and `generate-schemas.ts` walks that registry. A Node `Buffer` satisfies it, since `Buffer`
subclasses `Uint8Array`; that is harmless, because `digestBytes` feeds it straight to
`createHash().update()`.

### AC 3: `src/core/schemas/probe-policy.ts`  (VERBATIM)

AD-35's authorization declaration, as data. This is adapter configuration, not a port message, which
is why it is its own file.

```ts
/** AD-35's default-deny target authorization, as a declared mapping. */
import { z } from 'zod'
import { HttpMethod } from './interface.ts'
import { Identifier } from './primitives.ts'

/**
 * One authorized target. AD-35: "An adapter denies by default and permits only
 * what that mapping names." Every field is required and none has a default:
 * an omitted cap is an unbounded cap, which is the failure this declaration
 * exists to prevent.
 */
export const ProbeTargetAuthorization = z.strictObject({
	interfaceId: Identifier.describe(
		'The logical identifier the contract names. This mapping is where it becomes a target, outside the contract.',
	),
	scheme: z.enum(['http', 'https']),
	host: z.string().min(1),
	port: z.int().min(1).max(65535),
	addresses: z
		.array(z.string().min(1))
		.min(1)
		.describe(
			'The exact resolved addresses this authorization permits, compared after parsing rather than as strings. AD-35 requires every resolved address and every redirect to be revalidated, and requires a loopback, private, link-local, or metadata address to be authorized explicitly rather than by class, so the authorization names addresses rather than a range.',
		),
	methods: z.array(HttpMethod).min(1),
	safeMethods: z
		.array(HttpMethod)
		.describe(
			'AD-35: "Differential body-sensitivity probes use only methods the mapping marks safe for that target." Empty is legal and means no method is safe for a differential here; it is not a synonym for "all of them".',
		),
	maxRedirects: z.int().min(0),
	maxElapsedMs: z.int().min(1),
	maxRequestBytes: z.int().min(1),
	maxResponseBytes: z.int().min(1),
})

export const ProbeTargetPolicy = z.strictObject({
	authorizations: z
		.array(ProbeTargetAuthorization)
		.describe(
			'An empty array is legal and authorizes nothing, which is the default-deny base case and must stay representable.',
		),
})

export type ProbeTargetAuthorization = z.infer<typeof ProbeTargetAuthorization>
export type ProbeTargetPolicy = z.infer<typeof ProbeTargetPolicy>
```

Not refined: that `safeMethods` is a subset of `methods`. No AD-5 code names that contradiction, and
this is runtime configuration rather than a compiled artifact, so it joins the cross-field rules the
repository states rather than encodes (the same treatment `KeyedShapeDescriptor.permittedKeys`
already gets in `primitives.ts`). `evaluateTarget` reads `methods` for authorization and
`safeMethods` only for the differential question, so the two never contradict at a decision point.

### AC 4: `src/core/probe/target-policy.ts`  (SKETCH)

Pure, synchronous, no DNS, no network. The adapter resolves an address and hands it in; this module
decides. This is what makes AD-35's rule provable by fixture rather than only by a network subject,
and it is what stops every external adapter author from re-deriving IPv4 and IPv6 range arithmetic.

`src/core/probe/` is a new `core/` submodule. The Structural Seed does not list it, and does not need
to: the seed states its own shape is "provisional" and "nothing here is amendment-controlled".

```ts
/** AD-35's default-deny decision over a resolved target, as a pure function. */
import type {
	ProbeTargetAuthorization,
	ProbeTargetPolicy,
} from '../schemas/probe-policy.ts'

/**
 * The closed set of address classes AD-35 names, plus `public` for everything
 * else and `unparseable` for an address this module cannot parse.
 * `unparseable` denies: an address the parser cannot read is one it cannot
 * prove is outside the denied classes.
 */
export const ADDRESS_CLASSES = [
	'loopback',
	'private',
	'link-local',
	'metadata',
	'public',
	'unparseable',
] as const

export type AddressClass = (typeof ADDRESS_CLASSES)[number]

/**
 * The closed set of reasons a target is denied. These are detail, not codes:
 * every one is thrown as the single AD-28 `forbidden-target` fault, so this
 * list adds nothing to either registry and `check:ad28-registry` stays at ten.
 */
export const DENIAL_REASONS = [
	'interface-not-authorized',
	'scheme-not-authorized',
	'host-not-authorized',
	'port-not-authorized',
	'address-not-authorized',
	'address-unparseable',
	'method-not-authorized',
] as const

export type DenialReason = (typeof DENIAL_REASONS)[number]

export type ParsedAddress =
	| {
			readonly ok: true
			readonly family: 4 | 6
			/** the one spelling both sides of every comparison are reduced to. */
			readonly canonical: string
			readonly addressClass: AddressClass
	  }
	| { readonly ok: false }

export type ResolvedTarget = {
	readonly interfaceId: string
	readonly scheme: string
	readonly host: string
	readonly port: number
	readonly address: string
	readonly method: string
}

export type PolicyDecision =
	| {
			readonly allowed: true
			readonly authorization: ProbeTargetAuthorization
			readonly addressClass: AddressClass
			readonly canonicalAddress: string
	  }
	| {
			readonly allowed: false
			readonly reason: DenialReason
			readonly detail: string
			readonly addressClass: AddressClass
	  }

export function parseAddress(address: string): ParsedAddress
export function classifyAddress(address: string): AddressClass
export function evaluateTarget(
	policy: ProbeTargetPolicy,
	target: ResolvedTarget,
): PolicyDecision
export function isSafeMethod(
	authorization: ProbeTargetAuthorization,
	method: string,
): boolean
```

**`parseAddress` is the whole security surface.** It reduces every spelling of one address to a
single `canonical` form and classifies it. `classifyAddress` is `parseAddress(a).addressClass`, or
`'unparseable'`. Before parsing, three wrappers are stripped, in this order: a surrounding bracket
pair (`[::1]`, which is what `new URL('http://[::1]/').hostname` returns in Node), a `%zone` suffix
(`fe80::1%eth0`), and then an `::ffff:` IPv4-mapped prefix, **which is unwrapped to the embedded
IPv4 address and classified as that address, in both the dotted (`::ffff:127.0.0.1`) and hex
(`::ffff:7f00:1`) spellings.** IPv6 is normalized to its fully expanded form, so `fe80::1` and
`fe80:0:0:0:0:0:0:1` produce one `canonical` string.

Classes, in the order they are tested. **Order matters twice and both cases are real:**

| Range or value | Class |
| --- | --- |
| `169.254.169.254`, `fd00:ec2::254` | `metadata` |
| `127.0.0.0/8`, `::1`, `0.0.0.0`, `::` | `loopback` |
| `169.254.0.0/16`, `fe80::/10` | `link-local` |
| `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`, `fc00::/7` | `private` |
| anything else that parsed | `public` |
| anything that did not parse | `unparseable` |

`metadata` is tested first because `169.254.169.254` is inside `169.254.0.0/16` and `fd00:ec2::254`
is inside `fc00::/7`; either later ordering silently reclassifies a cloud metadata endpoint as
something less alarming in a denial `detail`. `0.0.0.0` and `::` are `loopback` because the
unspecified address routes to local on every stack this package runs on.

**`evaluateTarget`'s order,** which the fixtures pin one step at a time so a reordering is visible:

1. No authorization whose `interfaceId` equals the target's: `interface-not-authorized`. This is the
   default-deny base case and it is checked first, so an unmapped interface never reaches address
   arithmetic.
2. `scheme` mismatch: `scheme-not-authorized`.
3. `host` mismatch: `host-not-authorized`. Both sides are lowercased and a single trailing dot is
   stripped before comparing, because DNS is case-insensitive and `example.test.` and `example.test`
   are one name; a mixed-case or dot-suffixed redirect target is otherwise a bypass.
4. `port` mismatch: `port-not-authorized`.
5. `parseAddress(target.address).ok === false`: `address-unparseable`.
6. **No entry of `authorization.addresses` whose own `parseAddress(...).canonical` equals the
   target's**: `address-not-authorized`. The comparison is between parsed addresses, never between
   strings. This is what makes `parseAddress` load-bearing: an authorization naming `127.0.0.1` is
   matched by a redirect to `::ffff:127.0.0.1` and to `[::ffff:127.0.0.1]`, which a string
   comparison would treat as three different addresses and a class-only check would not catch at
   all. It is also the rule behind AD-35's loopback carve-out: a loopback address is permitted when
   and only when an authorization names it, which is AD-35's "a fixture on localhost is the normal
   case and a blanket loopback ban would make the product untestable, while an implicit loopback
   allowance is what lets a pull-requested contract reach an unintended local service."
7. `authorization.methods` does not contain the method: `method-not-authorized`.
8. Otherwise allowed, carrying the matched authorization so the adapter reads its caps from the same
   object the decision was made against, and carrying `canonicalAddress` so the adapter connects to
   the address that was validated (AC 5).

When more than one authorization matches on `interfaceId`, every one is tried in declaration order
and the first that allows wins; if none allows, the denial reported is the one from the **first**
matching authorization, so the reason a reader sees names a target the mapping actually declares. A
denial `detail` always names the offending value and, for every address denial, the parsed class.

### AC 5: the four port declarations under `src/ports/`  (VERBATIM)

`ports/` imports `core/schemas` only and may not import an external module or a Node builtin. Each
file is a type declaration plus the parser pair the boundary needs, and nothing else.

```ts
/** AD-8's corpus-provider port: an opaque reference in, resolved bytes out. */
import {
	CorpusResolveRequest,
	CorpusResolveResponse,
} from '../core/schemas/port-messages.ts'
import type { PortMethod } from './port.ts'

export type CorpusPort = {
	readonly resolve: PortMethod<CorpusResolveRequest, CorpusResolveResponse>
}

/** the boundary parsers `application/` and the conformance suite validate with. */
export const corpusResolveParsers = {
	request: CorpusResolveRequest,
	response: CorpusResolveResponse,
} as const
```

`clock-port.ts` (`ClockPort.read`), `file-system-port.ts` (`FileSystemPort.readFile`,
`FileSystemPort.writeFile`), and `environment-probe-port.ts` (`EnvironmentProbePort.probe`) follow
the same two-export shape. A Zod schema satisfies `BoundaryParser` structurally, which is why
`port.ts` declares `BoundaryParser` structurally in the first place; exporting the schema objects
rather than a wrapper keeps `ports/` free of a zod import.

**`environment-probe-port.ts` additionally carries a doc comment stating four rules an implementation
MUST follow.** They are prose here because `ports/` holds no logic; AC 7's assertions are the
executable half.

1. AD-35's policy is applied before any network call, and again against every redirect target.
2. **The request is issued against the address the policy validated** (`canonicalAddress`), with the
   original host preserved in the `Host` header and TLS verified against that host. A hostname is
   never re-resolved after validation. Without this the control is defeated by re-resolution between
   the check and the connection, which is the classic bypass of exactly this kind of allowlist.
   Where a host resolves to several addresses, each is validated and only a validated one is
   connected to.
3. A policy denial throws `forbidden-target`; a cap throws `budget-exhausted`; an abort throws
   `aborted`; a transport failure throws `port-failure`.
4. **Every response the server returns is an observation, at any status.** A 4xx or 5xx resolves to
   a schema-valid `ProbeObservation`, because AD-10's "every declared seeded fault being observed to
   fire" reads the status as payload. Throwing on a non-2xx makes a seeded fault invisible and the
   whole pre-flight vacuous.

### AC 6: `src/testing/conformance.ts`  (SKETCH)

The published suite. Framework-free by construction: it imports no test runner, returns a report, and
never calls an assertion library. Vitest is a devDependency, and a published module that imported it
would either make it a runtime dependency (a Stack change under NFR4) or fail to load for every
adopter who does not use vitest (Decision 1).

**`src/testing/` may import `ports/` and `core/schemas` only.** It may not import `core/probe/`, so
the suite never calls `evaluateTarget`: it asserts what a subject *does*, and a suite sharing the
subject's decision procedure would pass any subject that shared it too. AC 10 makes this mechanical.

```ts
import type {
	ClockReadRequest,
	CorpusResolveRequest,
	FileReadRequest,
	FileWriteRequest,
} from '../core/schemas/port-messages.ts'

export type ConformanceOutcome = {
	/** `<method>/<assertion>`, e.g. `readFile/typed-fault`. Unique within a report. */
	readonly id: string
	readonly title: string
	readonly passed: boolean
	readonly detail: string
}

export type ConformancePort =
	| 'corpus'
	| 'clock'
	| 'file-system'
	| 'environment-probe'

/** how many outcomes a complete run of each port produces. Asserted as literals by fixture 58. */
export const CONFORMANCE_OUTCOME_COUNTS = {
	corpus: 6,
	clock: 6,
	'file-system': 12,
	'environment-probe': 19,
} as const

export type ConformanceReport = {
	readonly subject: string
	readonly port: ConformancePort
	readonly outcomes: readonly ConformanceOutcome[]
	readonly passed: boolean
}

export type ScenarioKind = 'resolves' | 'fails' | 'in-band-error' | 'hangs'

export type BuiltSubject<Request> = {
	readonly port: (request: Request, signal: AbortSignal) => Promise<unknown>
	readonly underlyingCalls: () => number
	readonly dispose?: () => Promise<void>
}

export type PortSubject<Request> = {
	readonly name: string
	readonly sampleRequest: Request
	/**
	 * A FRESH instance per scenario. The call counter must count the
	 * underlying mechanism (the filesystem call, the HTTP request), never the
	 * port invocation, or the retry assertion counts the wrong thing and
	 * passes for every adapter.
	 */
	readonly build: (scenario: ScenarioKind) => Promise<BuiltSubject<Request>>
	/** how long "promptly" is for this subject. Default 1000. */
	readonly abortBudgetMs?: number
}

export function formatConformanceReport(report: ConformanceReport): string

export function runCorpusPortConformance(
	subject: PortSubject<CorpusResolveRequest>,
): Promise<ConformanceReport>
export function runClockPortConformance(
	subject: PortSubject<ClockReadRequest>,
): Promise<ConformanceReport>
export function runFileSystemPortConformance(
	readSubject: PortSubject<FileReadRequest>,
	writeSubject: PortSubject<FileWriteRequest>,
): Promise<ConformanceReport>
```

`runEnvironmentProbePortConformance` lives in `probe-conformance.ts` (AC 7) and is the fourth.

**The six shared assertions, run for every port method.** AD-37 names four minimums. One of the four
splits into two ids (Decision 11), and one more is added: `no-in-band-error`, the in-band half of
AD-28's "a port never returns a partial success or an in-band error value", which AD-37's first
clause names and which no other assertion reaches. Six ids, four AD-37 clauses.

| id | Scenario | Passes when |
| --- | --- | --- |
| `typed-fault` | `fails` | the promise rejects; the rejection is a `RuntimeFault`; its `code` is a member of `RUNTIME_FAULT_CODES`; its `artifactPath` is a non-empty string. A resolved promise fails, and so does a rejection with a plain `Error`. |
| `single-underlying-call-on-success` | `resolves` | `underlyingCalls()` is exactly 1 after the call settles. |
| `single-underlying-call-on-failure` | `fails` | `underlyingCalls()` is exactly 1 after the rejection. **This is the assertion that catches an internal retry**, because a retrying adapter retries on failure and not on success. Splitting the AD-37 clause into two ids is deliberate: one id would report a retrying adapter and a double-dispatching adapter identically. |
| `prompt-abort` | `hangs` | the signal is aborted after the call is in flight; the promise rejects within `abortBudgetMs`; the rejection is a `RuntimeFault` with code `aborted`. A promise that never settles fails on the budget. |
| `no-in-band-error` | `in-band-error` | the promise rejects with a `RuntimeFault` rather than resolving. The code is not pinned: an adapter may recognize its own mechanism's error shape and throw `port-failure` before the boundary parser sees it, and both are conforming. Resolving is not. |
| `schema-valid-return` | `resolves` | the resolved value parses against the port's response schema, which the suite holds and the subject does not supply. |

**Outcome ids are namespaced by method**, because `runFileSystemPortConformance` produces twelve
outcomes from six ids and a report cannot carry `typed-fault` twice. The prefix is the port method's
name: `resolve/`, `read/`, `readFile/`, `writeFile/`, `probe/`. Every fixture that names an outcome
names the qualified id.

**What each scenario means for a subject**, stated once so four adapters do not each invent it:
`resolves` makes the underlying mechanism return a value the port turns into a schema-valid
response; `fails` makes it throw its own mechanism's error (an `ENOENT`, a socket error), never a
`RuntimeFault`, so the adapter's translation is what is under test; `in-band-error` makes it return
a value the response schema rejects, such as a partial result or an object with an `error` member;
`hangs` makes it return a promise that never settles on its own.

`schema-valid-return` and `single-underlying-call-on-success` share one `resolves` build, so a
subject stands up four instances per port method.

Every assertion is wrapped so a subject that throws during `build` or `dispose` becomes a failed
outcome naming the throw, never an escaping exception: a suite that crashes on a broken subject tells
an adapter author less than a report naming which assertion could not run.

`report.passed` is `outcomes.every((outcome) => outcome.passed)` **and** `outcomes.length` equal to
`CONFORMANCE_OUTCOME_COUNTS[port]`. An empty or short outcome list must never read as a pass.

### AC 7: `src/testing/probe-conformance.ts`  (SKETCH)

AD-35's additions, run only for the environment-probe port. The subject supplies its policy and one
request per denial, because only the subject knows how its own mapping is wired:

```ts
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

export function runEnvironmentProbePortConformance(
	subject: ProbeSubject,
): Promise<ConformanceReport>
```

**Each of these thirteen assertions builds its own `'resolves'` subject** and reads
`underlyingCalls()` from a counter that starts at zero, so the counts below are absolute rather than
deltas. With the shared assertions' four builds, a probe subject stands up seventeen instances.

| id | Passes when |
| --- | --- |
| `probe/allow-authorized-loopback` | `authorizedRequest` resolves to a schema-valid `ProbeObservation`. **This assertion exists so the deny assertions cannot pass vacuously.** A subject that denies everything would otherwise score twelve of twelve on default-deny while being useless, and AD-35 spends a clause on why a blanket loopback ban is wrong. |
| `probe/observe-anomalous-status` | `faultingRequest` resolves to a schema-valid observation with `status: 500`. A subject that throws on 5xx fails here and nowhere else, and it would make AD-10's seeded-fault check unimplementable. |
| `probe/deny-unmapped-interface` | rejects with `forbidden-target`, `underlyingCalls()` is 0. Zero, not one: a target the mapping does not name must be refused before a packet leaves. |
| `probe/deny-unauthorized-loopback` | rejects with `forbidden-target`, 0 underlying calls. |
| `probe/deny-private` | rejects with `forbidden-target`, 0 underlying calls. AD-35 names four denied classes; a private RFC 1918 address is the commonest SSRF target inside a CI network. |
| `probe/deny-link-local` | rejects with `forbidden-target`, 0 underlying calls. |
| `probe/deny-metadata` | rejects with `forbidden-target`, 0 underlying calls. |
| `probe/deny-unauthorized-method` | rejects with `forbidden-target`, 0 underlying calls. |
| `probe/deny-unauthorized-scheme` | rejects with `forbidden-target`, 0 underlying calls. |
| `probe/deny-on-redirect` | `redirectingRequest` rejects with `forbidden-target`; `underlyingCalls()` is exactly 1. The first hop is authorized and happens; the redirect target is revalidated and refused; the second hop does not. An adapter that follows the redirect resolves instead and fails. |
| `probe/cap-redirects` | `overRedirectRequest` rejects with `budget-exhausted`; `underlyingCalls()` is exactly `maxRedirects + 1`. Every hop is authorized, so only the count can refuse it, which is the half `deny-on-redirect` does not reach. |
| `probe/cap-response-bytes` | `oversizeResponseRequest` rejects with `budget-exhausted`, not `forbidden-target`. AD-35 caps response bytes as a safety limit and AD-28 assigns safety limits `budget-exhausted`; conflating the two would tell an operator a policy violation happened when a cap fired. |
| `probe/cap-elapsed` | `slowRequest` rejects with `budget-exhausted`, not `aborted`. The signal was never aborted; the adapter's own cap fired. |

Nineteen outcomes for the probe port: the six shared plus these thirteen. Six for the corpus port and
six for the clock port, each having one method; twelve for the file-system port, which has two.

`maxRequestBytes` is the one AD-35 cap with no assertion: the suite has no way to make a subject emit
an oversize request, since the request shape is the suite's. It stays declared and enforced by the
adapter, and this sentence is the record that it is unasserted rather than forgotten.

### AC 8: `src/testing/index.ts`  (SKETCH)

The published subpath's whole surface, in one barrel:

- the four `run*Conformance` functions, `formatConformanceReport`, and
  `CONFORMANCE_OUTCOME_COUNTS`;
- the report, outcome, scenario, subject, and port types;
- **the four port types and their parser pairs**, re-exported from `ports/`. An adapter author
  cannot implement `CorpusPort` without the type, and `src/index.ts` stays untouched in this story,
  so the conformance subpath is where the boundary vocabulary is published. Story 6.5 decides
  whether the root barrel also re-exports it;
- the port message types from `core/schemas/port-messages.ts` and the policy types from
  `core/schemas/probe-policy.ts`.

**Type re-exports use `export type { ... }`.** `biome.json` sets `style.useExportType: "error"` with
an override for `**/*.d.ts` only, so a value-shaped re-export of a type fails `npm run lint`. The
parser pairs, the `run*` functions, and `CONFORMANCE_OUTCOME_COUNTS` are value exports.

**`src/testing/` never imports `src/adapters/` or `src/core/probe/`.** The subject arrives as a
parameter, which is what makes the suite runnable against an adapter living outside this repository.
AC 10 makes both prohibitions mechanical.

### AC 9: the three shipped adapters  (SKETCH)

Each is a factory taking its underlying mechanism, defaulting to the real one. **The injectable
mechanism is not a testing convenience, it is what makes the adapter conformance-checkable at all:**
AD-37's retry assertion counts underlying calls, and there is no way to count calls into `node:fs`
from outside it.

**Every mechanism's return type is `unknown`, and every mechanism takes an `AbortSignal`.**

```ts
export type FileSystemMechanism = {
	readonly readFile: (path: string, signal: AbortSignal) => Promise<unknown>
	readonly writeFile: (
		path: string,
		bytes: Uint8Array,
		signal: AbortSignal,
	) => Promise<unknown>
}

export type CorpusMechanism = (
	resolvedPath: string,
	signal: AbortSignal,
) => Promise<unknown>

export type ClockMechanism = (signal: AbortSignal) => Promise<unknown>

export function createNodeFileSystemAdapter(
	mechanism?: FileSystemMechanism,
): FileSystemPort
export function createLocalCorpusAdapter(options: {
	readonly root: string
	readonly mechanism?: CorpusMechanism
}): CorpusPort
export function createSystemClockAdapter(mechanism?: ClockMechanism): ClockPort
```

`unknown` is what makes step 4 below load-bearing. A mechanism typed `Promise<Uint8Array>` lets the
adapter assemble a response from a value it already holds, so the response parse can never reject and
`no-in-band-error` and `schema-valid-return` are vacuous for every shipped adapter. With `unknown`,
the `in-band-error` scenario is constructible without an `as any` cast, which is the scenario AD-28's
in-band clause exists for.

Every adapter's method body is these five steps and nothing else:

1. `if (signal.aborted) throw new RuntimeFault('aborted', <requestPath>, ...)`.
2. Parse the request with the port's request parser; on failure throw `schema-parse-failure`.
3. **Race the mechanism call against the abort.** Register an `abort` listener `{ once: true }` on
   the signal that rejects with `RuntimeFault('aborted', <responsePath>, ...)`, `Promise.race` it
   against exactly one mechanism call, and remove the listener in a `finally` so nothing leaks. Call
   the mechanism **exactly once**; on a throw, rethrow a `RuntimeFault` unchanged, translate an
   abort mid-flight to `aborted`, and translate anything else to `port-failure`.
4. Parse the mechanism's `unknown` result with the response parser, or with the shape the response
   is assembled from; on failure throw `port-contract-violation`.
5. Return the parsed response.

**Step 3 is the one place these adapters deliberately differ from `invoke-port.ts`.** `invokePort`
awaits the port and inspects `signal.aborted` only in its `catch`, so a mechanism that never settles
makes `invokePort` never settle. That is correct for `invokePort`, whose subject is a caller-supplied
port that AD-28 already obliges to honour the signal itself; it is not sufficient for an adapter,
which is the thing that obligation lands on. Fixture 54 asserts exactly this: `invokePort` wrapped as
a subject passes the five non-abort shared assertions and fails `prompt-abort`. Steps 1, 2, 4, and 5
still agree with `invokePort` code for code, which is what fixture 54's five passes pin.

Every fault's `artifactPath` is the message schema's own name (`'CorpusResolveRequest'`,
`'FileWriteResponse'`, `'ProbeObservation'`), matching `invokePort`'s `requestPath`/`responsePath`
convention and `application/compile.ts`'s `'EvalContract'`.

Defaults:

- `createSystemClockAdapter`'s default mechanism returns `new Date().toISOString()`, the one clock
  read in the package, in the layer where a clock read is legal.
- `createNodeFileSystemAdapter`'s default reads and writes through `node:fs/promises`.
- `createLocalCorpusAdapter` resolves a `privateRef` to bytes under a caller-supplied root.

**The corpus adapter's escape check is two checks at two times, and the story says so because the
first draft of this sentence claimed a filesystem check happened before touching the filesystem:**

- **Lexical, before any filesystem call:** after `posix.normalize`, a `privateRef` that is absolute
  or still contains a `..` segment throws `port-failure` and the mechanism is never called.
- **Real-path, after:** the resolved path's `realpath` must be inside the root's own `realpath`, or
  it throws `port-failure`. This is filesystem access and it necessarily happens after, which is
  what catches a symlink inside the root pointing outside it.

AD-8 calls the reference opaque and AD-18 forbids a private path entering an artifact. An opaque
handle that can be spelled `../../etc/passwd` is neither.

`adapters/` may import `ports/` and `core/schemas` only, and is unrestricted for external modules and
Node builtins, so `node:fs/promises` and `node:path` are legal here and only here.

### AC 10: the `testing` layer in `scripts/dependency-direction.ts`

Six edits, all in the file's existing shapes:

1. `Layer` (line 23) gains `'testing'`.
2. `LAYER_LABELS` (39) gains `testing: 'testing/'`.
3. `classifyLayer` (50) gains `if (file.startsWith('src/testing/')) return 'testing'`, with the
   other `src/` prefixes.
4. `isAllowedEdge` (68) gains `case 'testing': return to === 'ports' || to === 'core-schemas'`.
5. `checkExternalSpecifier` (201) restricts `testing` exactly as it restricts `ports`: **no external
   module and no Node builtin.** This is the mechanical half of AC 6's framework-free rule; without
   it, "the published suite does not import vitest" is a comment nothing checks. The rule string is
   `'testing/ may import ports/ and core/schemas only; the published conformance suite may not
   import a test framework, an external module, or a Node builtin'`. **The block goes immediately
   after the `ports` block and before line 227's `if (layer !== 'core') return`**, which is an early
   return that would make a block appended after it dead code.
6. `checkExternalSpecifier`'s doc comment (193-200) currently ends "`adapters/` and `cli/` are
   deliberately unrestricted". Extend it to say why `testing/` is not.

Nothing may import `testing/`: it appears in no other layer's allowed set, and absence of an edge is
the prohibition, so no special case is needed. `testing -> core` is likewise forbidden by absence,
which is what stops the suite reaching `core/probe/target-policy.ts` (AC 6).

`testing/` awaits port methods, which is correct and unchecked: `purityScoped` at `scanFile`'s line
508 is `layer === 'core' || layer === 'core-schemas'`, so `testing/` is outside the purity scan and
that line does not change. AD-34's "`application/` is the only place a port is awaited" governs the
pipeline stages that produce artifacts; AD-37 requires the suite to execute its subject, and a suite
that could not await one could not exist.

### AC 11: the in-repository probe subject, `tests/adapters/probe-subject.ts`

AD-37: "Continuous integration runs the suite ... against an in-repository probe adapter that exists
only as the suite's own subject, since AD-2 ships no network adapter and an unexercised suite rots."

It lives under `tests/`, which `tsconfig-build.json` excludes, so it never reaches `dist/` and AD-2's
"v0 ships no network adapter at all" stays literally true. AD-30's carve-out ("no network I/O beyond
a loopback fixture server it started itself, that carve-out exists solely for AD-37's suite") is the
one place in the repository that is exercised.

**The interface-to-target map is a separate argument from the policy.** This is what AD-35 actually
describes ("the caller maps those identifiers to authorized targets through configuration outside the
contract"), and it is the only shape in which a scheme, host, or port denial is producible at all: if
the adapter derived the target from the authorization it is validating against, `ResolvedTarget`'s
scheme, host, and port would always equal the authorization's and AC 4's steps 2, 3, and 4 would be
unreachable.

```ts
export type SubjectTarget = {
	readonly scheme: string
	readonly host: string
	readonly port: number
}

export function createProbeSubjectAdapter(options: {
	readonly policy: ProbeTargetPolicy
	readonly targets: Record<string, SubjectTarget>
	readonly resolveAddress: (host: string) => string
	readonly mechanism?: ProbeMechanism
}): EnvironmentProbePort

export function startFixtureServer(): Promise<{
	readonly port: number
	readonly address: string
	readonly close: () => Promise<void>
}>
```

`startFixtureServer` binds a `node:http` server to `127.0.0.1:0` and reads the port back from
`server.address()`; never a fixed port, which collides under parallel vitest workers. Routes:

| Route | Answers |
| --- | --- |
| `/ok` | 200, a small JSON body |
| `/fault` | 500, a small JSON body (the `observe-anomalous-status` subject) |
| `/redirect` | 302 with `Location` pointing at a target the policy denies |
| `/redirect-twice` | a chain of 302s to authorized targets, longer than `maxRedirects` |
| `/oversize` | a body larger than `maxResponseBytes` |
| `/slow` | answers only after `maxElapsedMs` |
| `/hang` | never answers (the `hangs` scenario) |

The subject's wiring, which fixture 87 pins:

- `policy` authorizes **exactly one** target: the fixture server's parsed `127.0.0.1` on its
  ephemeral port, `GET` and `HEAD` only, scheme `http`, `maxRedirects: 1`, and small
  `maxElapsedMs`/`maxResponseBytes`/`maxRequestBytes`.
- `targets` names **eight** interfaces: the authorized one, plus one each for the unmapped case, the
  four denied address classes, the unauthorized method, and the unauthorized scheme. Seven of the
  eight are absent from `policy.authorizations` or violate one of its fields, which is what makes
  each denial reachable.
- `resolveAddress` is injected, keyed by host, so a denied class is exercised without a DNS lookup
  or a real packet toward `169.254.169.254`.

The adapter calls `evaluateTarget` before every request and again for every redirect target, throws
`forbidden-target` on a denial, enforces the four caps as `budget-exhausted`, connects to
`decision.canonicalAddress` with the original host in the `Host` header, and counts its underlying
HTTP requests.

The server is started in `beforeAll` and closed in `afterAll`; every `dispose` closes its own
sockets. A leaked handle makes vitest hang rather than fail, which is the worst failure mode here.

### AC 12: fixtures and tests

**One `it` per numbered fixture,** except fixture 89, which is a generated matrix and is called out
below. Six new test files, one new non-test helper.

**`tests/probe/target-policy.test.ts`** (fixtures 1-40).

Parser and classifier, 1-20:

| # | Fixture |
| --- | --- |
| 1 | `127.0.0.1` is `loopback` |
| 2 | `127.5.5.5` (anywhere in `127.0.0.0/8`) is `loopback` |
| 3 | `::1` is `loopback` |
| 4 | `0.0.0.0` and `::` are `loopback` |
| 5 | `10.0.0.1` is `private` |
| 6 | `172.16.0.1` is `private` and `172.32.0.1` is `public` (the `/12` boundary, both sides) |
| 7 | `192.168.1.1` is `private` |
| 8 | `100.64.0.1` is `private` and `100.128.0.1` is `public` (carrier-grade NAT, both sides) |
| 9 | `fc00::1` is `private` |
| 10 | `169.254.1.1` is `link-local` |
| 11 | `fe80::1` is `link-local` |
| 12 | `169.254.169.254` is `metadata`, **not** `link-local` (the ordering, IPv4) |
| 13 | `fd00:ec2::254` is `metadata`, **not** `private` (the ordering, IPv6) |
| 14 | `93.184.216.34` is `public` |
| 15 | `2606:2800:220:1:248:1893:25c8:1946` is `public` |
| 16 | `example`, `1.2.3`, `999.1.1.1`, and the empty string are all `unparseable` |
| 17 | `::ffff:127.0.0.1`, `::ffff:7f00:1`, `::ffff:169.254.169.254`, and `::ffff:10.0.0.1` unwrap to `loopback`, `loopback`, `metadata`, `private` (the unwrap rule across four classes, not one spelling) |
| 18 | `[::1]` and `[::ffff:127.0.0.1]` strip brackets and classify as `loopback` |
| 19 | `fe80::1%eth0` strips the zone and is `link-local` |
| 20 | `fe80::1` and `fe80:0:0:0:0:0:0:1` produce the same `canonical` string |

Policy, 21-40:

| # | Fixture |
| --- | --- |
| 21 | `ADDRESS_CLASSES` and `DENIAL_REASONS` are the exact literal tuples AC 4 states, written as literals rather than re-derived |
| 22 | an empty policy denies with `interface-not-authorized` |
| 23 | an unmapped `interfaceId` denies with `interface-not-authorized` against an address that would otherwise be authorized |
| 24 | scheme mismatch |
| 25 | host mismatch |
| 26 | host matches case-insensitively (`EXAMPLE.test` against `example.test`) |
| 27 | a single trailing dot (`example.test.`) matches `example.test` |
| 28 | port mismatch |
| 29 | an unparseable address denies with `address-unparseable` |
| 30 | an authorized address is allowed and the decision carries the matched authorization |
| 31 | **loopback authorized explicitly is allowed** (the carve-out, positive) |
| 32 | **loopback not named in `addresses` is denied** with `address-not-authorized` (the carve-out, negative) |
| 33 | a metadata address not named is denied and the decision's `addressClass` reads `metadata` |
| 34 | **`::ffff:127.0.0.1` is allowed by an authorization naming `127.0.0.1`** (the real content of Decision 13: without the unwrap, a redirect to the mapped form bypasses the allowlist entry) |
| 35 | an authorization naming `fe80::1` allows a target address of `[fe80:0:0:0:0:0:0:1%eth0]` (bracket, zone, and expansion, all three, against one entry) |
| 36 | a method not in `methods` denies with `method-not-authorized` |
| 37 | a request violating scheme **and** method reports `scheme-not-authorized`, pinning AC 4's order |
| 38 | two authorizations for one `interfaceId`, the second allows: allowed, carrying the second |
| 39 | two authorizations, neither allows: the denial is the first's |
| 40 | `isSafeMethod` is false for a method in `methods` but not in `safeMethods`, and false for an empty `safeMethods` |

**`tests/testing/conformance.test.ts`** (fixtures 41-72) is the story's non-vacuity proof. It drives
the suite with synthetic subjects, one conforming and one deliberately broken per assertion, and
asserts **which qualified outcome id** flipped:

| # | Subject | Expected |
| --- | --- | --- |
| 41 | conforming synthetic corpus subject | passed, six outcomes |
| 42 | conforming clock subject | passed, six outcomes |
| 43 | conforming file-system subject | passed, twelve outcomes, ids namespaced `readFile/` and `writeFile/` |
| 44 | resolves instead of throwing under `fails` | only `typed-fault` fails |
| 45 | throws a plain `Error` under `fails` | only `typed-fault` fails |
| 46 | throws a `RuntimeFault` with an empty `artifactPath` | only `typed-fault` fails |
| 47 | **retries once on failure** (2 underlying calls under `fails`, 1 under `resolves`) | only `single-underlying-call-on-failure` fails |
| 48 | calls the mechanism twice on success | only `single-underlying-call-on-success` fails |
| 49 | ignores the abort signal | only `prompt-abort` fails, within `abortBudgetMs` |
| 50 | rejects on abort with `port-failure` rather than `aborted` | only `prompt-abort` fails |
| 51 | returns the in-band error object under `in-band-error` | only `no-in-band-error` fails |
| 52 | returns a value missing a required response field | only `schema-valid-return` fails |
| 53 | `build` throws | every outcome needing that scenario fails naming the throw; nothing escapes |
| 54 | **`invokePort` wrapped as a subject** | the five non-abort shared assertions pass for every port; `prompt-abort` fails. This is AC 9 step 3's divergence, asserted rather than assumed |
| 55 | `formatConformanceReport` | names every failed qualified id and no passing one |
| 56 | `report.passed` | false when `outcomes` is empty |
| 57 | `report.passed` | false when every present outcome passes but `outcomes.length` is one short of the port's expected count |
| 58 | `CONFORMANCE_OUTCOME_COUNTS` | equals `{corpus: 6, clock: 6, 'file-system': 12, 'environment-probe': 19}` as literals |
| 59 | conforming synthetic probe subject | passed, nineteen outcomes |
| 60 | allows an unmapped interface | only `probe/deny-unmapped-interface` fails |
| 61 | allows an unauthorized loopback | only `probe/deny-unauthorized-loopback` fails |
| 62 | allows a private address | only `probe/deny-private` fails |
| 63 | allows a link-local address | only `probe/deny-link-local` fails |
| 64 | allows a metadata address | only `probe/deny-metadata` fails |
| 65 | allows an unauthorized method | only `probe/deny-unauthorized-method` fails |
| 66 | allows an unauthorized scheme | only `probe/deny-unauthorized-scheme` fails |
| 67 | follows a redirect to a denied target | only `probe/deny-on-redirect` fails |
| 68 | throws `forbidden-target` instead of `budget-exhausted` on the oversize response | only `probe/cap-response-bytes` fails |
| 69 | follows more redirects than `maxRedirects` and resolves | only `probe/cap-redirects` fails |
| 70 | answers past `maxElapsedMs` and resolves | only `probe/cap-elapsed` fails |
| 71 | throws on a 500 | only `probe/observe-anomalous-status` fails |
| 72 | **denies the authorized request too** | only `probe/allow-authorized-loopback` fails |

Fixture 72 is the one that proves the twelve deny-and-cap assertions are not satisfiable by a subject
that refuses everything.

**`tests/adapters/`** (fixtures 73-88):

| # | Fixture |
| --- | --- |
| 73 | `runFileSystemPortConformance` against `createNodeFileSystemAdapter`: passed, twelve outcomes |
| 74 | the default mechanism reads and writes a real file inside a `mkdtemp` directory, removed in `afterEach` |
| 75 | a write reports `byteLength` equal to the input length |
| 76 | a mechanism returning `{ error: 'nope' }` through the real read adapter throws `port-contract-violation` with `artifactPath` `'FileReadResponse'` (step 4 is load-bearing on a shipped adapter, not only on a synthetic one) |
| 77 | `runCorpusPortConformance` against `createLocalCorpusAdapter`: passed, six outcomes |
| 78 | resolves a real file under a `mkdtemp` root, bytes byte-identical |
| 79 | a `privateRef` of `../outside` throws `port-failure`; the mechanism is never called (the lexical check) |
| 80 | an absolute `privateRef` throws `port-failure`; the mechanism is never called (the lexical check) |
| 81 | a symlink inside the root pointing outside it throws `port-failure` (the real-path check, which necessarily ran after a filesystem call) |
| 82 | the response echoes the requested `privateRef` |
| 83 | `runClockPortConformance` against `createSystemClockAdapter`: passed, six outcomes |
| 84 | the default mechanism returns a string `Rfc3339Utc` accepts |
| 85 | `runEnvironmentProbePortConformance` against the in-repository subject: passed, nineteen outcomes, over a real loopback server |
| 86 | two `startFixtureServer()` calls get different ports and both answer |
| 87 | the subject's `targets` map's authorized entry equals `server.address()`, and `policy.authorizations` has exactly one entry naming that address; asserted against the live server rather than against the constant the subject was built from |
| 88 | the adapter connects to the validated address with the original host in the `Host` header, and calls `resolveAddress` no more times than it validates (no re-resolution between check and connect) |

**`tests/architecture/dependency-direction.test.ts`** (edited, fixtures 89-91):

| # | Fixture |
| --- | --- |
| 89 | the generated edge matrix over all eight layers, `testing` included. **This is one fixture and 63 `it`s**: the existing loop is `for (const from of LAYERS) for (const to of LAYERS)` skipping `root -> root`, so it widens from 7x7-1 = 48 to 8x8-1 = 63 |
| 90 | `src/testing/x.ts` importing `vitest`, `node:http`, or `zod` is a violation naming AC 10's rule string |
| 91 | `src/testing/x.ts` importing `src/adapters/y.ts`, `src/application/y.ts`, or `src/core/probe/y.ts` is a violation |

The transcribed `ALLOWED` map at lines 54-61 is the specification copy and must be extended from
AC 10's text, never copied from `isAllowedEdge`, or fixtures 89-91 stop asserting anything.

### AC 13: the documented subpath, the CI steps, and the README

**`package.json`:**

```jsonc
"exports": {
  ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
  "./conformance": {
    "types": "./dist/testing/index.d.ts",
    "default": "./dist/testing/index.js"
  }
}
```

and one script: `"test:conformance": "vitest run tests/adapters tests/testing"`.

`files` already ships `dist`, so nothing there changes. `validate` already runs `test`, which covers
these files; the separate script exists so CI can name the gate, matching the comment already in
`pr-checks.yml` ("Named so a red build says which gate failed ... deliberate redundancy rather than
the only wiring").

**`.github/workflows/pr-checks.yml`: the same step on the two matrix jobs, and on neither canary.**
In `validate-and-build` (line 14) before its `Validate` step, and in `floor` (line 68) beside its
existing named steps, because spine 606 requires CI to run "at the exact runtime floor and at the
development version" and the abort race in AC 9 step 3 is exactly the kind of thing a runtime version
changes.

The file also carries eight `canary-*` jobs, each a single negative control proving one gate fails on
one mutation. **The conformance step goes on none of them**: a canary asserts that a named check
rejects a named mutation, and appending an unrelated suite to one would make its red ambiguous. Every
job in this file sets `persist-credentials: false` on its checkout and the workflow sets
`permissions: contents: read`; the two new steps inherit both and add nothing.

```yaml
      - name: Port conformance suite (every shipped adapter plus the in-repository probe subject)
        run: npm run test:conformance
```

**`README.md`:** two edits in `## Development` (line 193, running to `## Contributing` at 225).

1. A paragraph documenting the subpath: the literal import path `eval-quality/conformance`, what a
   conforming adapter is, and that running the suite is the definition rather than reading prose. "A
   documented subpath" that never spells the path is not documented.
2. The `validate` comment in the `bash` block now reads "# typecheck, lint, docs, spine, vectors,
   schemas, registries, AD-31 table, tests". PR #32 refreshed it partway; it still omits
   `check:shareable` and `check:layers`, both of which `validate` runs. Finish it in the same edit,
   since `build:shareable` has to be rerun anyway.

`build:shareable` must be rerun after any README edit, or `check:shareable` fails the build.
`check:docs` stays at 55 files: nothing new lands under its `ROOTS`.

### AC 14: the gate

`npm run validate` passes. Expected numbers after this story:

| Gate | Before | After |
| --- | --- | --- |
| `check:layers` | 59 files, 0 violations | **72** files (59 + the thirteen in AC 1's table), 0 violations |
| `check:schemas` | 12 committed schemas | **12**, unchanged |
| `check:ad5-registry` | 21 codes | **21**, unchanged |
| `check:ad28-registry` | 10 codes | **10**, unchanged |
| `check:ad31-table` | 19 corpus contracts, 28 cells | **19 / 28**, unchanged |
| `check:docs` | 55 files OK | **55**, unchanged |
| `check:shareable` | 21 committed pages | **21**, unchanged (the README page is regenerated, not added to) |
| `npm run test` | 55 files, 2160 tests | **61** files (55 + 6), **2265** tests (2160 + 105) |

The test delta is broken into its parts so the next drift is diagnosable rather than a single wrong
total:

| Source | Tests |
| --- | --- |
| `tests/probe/target-policy.test.ts`, fixtures 1-40 | +40 |
| `tests/testing/conformance.test.ts`, fixtures 41-72 | +32 |
| `tests/adapters/*`, fixtures 73-88 | +16 |
| fixture 89: the matrix loop widening from 7x7-1 to 8x8-1 | +15 |
| fixtures 90-91 | +2 |
| **total** | **+105** |

**The `Before` column is the state after PR #32 (Story 5.3, the AD-31 coverage predicate table)
landed on `main` on 2026-08-26**, which is the commit this branch sits on (`531217b`). Every number
in it was measured on that tree, not carried forward. `tests/adapters/probe-subject.ts` is a helper
and does not match vitest's `tests/**/*.test.ts`, which is why six test files rather than seven.

Any drift in the six unchanged rows means a decision in this story was not followed: adding a
failure code, publishing a port message as an interchange artifact, adding a markdown file under
`check-docs`'s roots, or touching `src/core/coverage/` and regenerating the AD-31 table.
Investigate rather than update the number.

`npm run build` must also pass: `tsconfig-build.json` compiles `src/` with
`allowImportingTsExtensions: false` and `rewriteRelativeImportExtensions: true`, so `src/testing/`
and `src/adapters/` emit to `dist/` like every other source directory.

## Decisions taken during story creation

**1. The suite returns a report; it does not assert.** A published module cannot depend on the
consumer's test runner. Vitest is a devDependency pinned exactly under NFR4, and importing it from
`src/testing/` would either promote it to a runtime dependency (a Stack change and a licence scan,
not a story decision) or fail to load for every adopter who does not use vitest. AC 10's
external-import ban makes this mechanical rather than a convention. The repository's own tests are
the first consumer of the report, which is the same shape an external author writes.

**2. `src/testing/` is a new checker layer, importing `ports/` and `core/schemas` only.** It does not
import `application/`, so it calls the port method directly rather than through `invokePort`:
routing through `invokePort` would make every subject pass the boundary assertions on `invokePort`'s
strength rather than its own. It does not import `core/probe/` either, so the suite cannot share the
subject's own decision procedure. Fixture 54 wraps `invokePort` as a subject on purpose, and it is
where the one deliberate divergence (Decision 3) is pinned.

**3. The adapters race the abort; `invokePort` does not, and that is not a defect in either.**
`invoke-port.ts` awaits the port and reads `signal.aborted` only in its `catch`, so a port that never
settles makes `invokePort` never settle. AD-28 obliges a caller-supplied port to honour the signal
itself, so `invokePort` is entitled to assume it; an adapter *is* the thing that obligation lands on,
and AD-37's `prompt-abort` assertion is what checks it. AC 9 step 3 therefore adds a `Promise.race`
against a `{ once: true }` abort listener removed in a `finally`, and every mechanism signature takes
an `AbortSignal` (the clock's included, which is why `() => new Date().toISOString()` is not the
mechanism type). Fixture 54 asserts the divergence rather than papering over it.

**4. The adapters take an injectable mechanism returning `unknown`.** AD-37 requires counting
underlying calls, and there is no way to count calls into `node:fs` from outside the module.
`unknown` rather than a precise type, because a precisely-typed mechanism lets the adapter assemble
its response from a value it already holds, which makes the response parse unfalsifiable and
`no-in-band-error` and `schema-valid-return` vacuous for every shipped adapter. Fixture 76 is the
proof that the parse is load-bearing. Story 6.5 inherits this: the CLI constructs adapters with no
argument.

**5. Port messages are not interchange artifacts.** `schemas/` stays at twelve. A port message
crosses a process boundary inside one caller's program; an interchange artifact crosses the package
boundary and is versioned, digested, and lineage-bearing. `CorpusResolveResponse` carries a
`Uint8Array`, and `z.toJSONSchema` throws "Custom types cannot be represented in JSON Schema" on it,
so registering it would break `generate-schemas.ts` on the first run. Recorded because "the returned
artifact validates against the published schema" in AD-37 reads, at a glance, like an instruction to
publish these.

**6. Bytes are `Uint8Array`, not base64.** AD-8 has the core recompute a digest "from the resolved
bytes", and `digestBytes` in `core/canonical/digest.ts` already takes a `Uint8Array`. A base64 hop
adds a decode step and an encoding failure mode between the port and the digest, on the one path
where a wrong byte is an invalidating `digest-mismatch`.

**7. Every denial is an existing AD-28 code.** `DENIAL_REASONS` is a module-local vocabulary carried
in the fault's message and never in its `code`. AD-35 says "a denied target is a typed fault", and
AD-28 already carries `forbidden-target` "including on redirect". Adding a code would drift
`check:ad28-registry` and, under AD-28's own audit rule, would be an amendment to AD-28. Per the
standing rule that a story settles its own ambiguities rather than opening a spine revision, this is
recorded here: seven reasons, one code.

**8. AD-35's caps are `budget-exhausted`, not `forbidden-target`.** AD-28 defines `budget-exhausted`
as "an evaluation budget **or safety limit** is reached", and AD-35's four caps are safety limits.
Conflating them would tell an operator that a contract tried to reach a forbidden target when in fact
an authorized target answered too much or too slowly. `cap-response-bytes`, `cap-redirects`, and
`cap-elapsed` pin the distinction; `maxRequestBytes` is enforced and unasserted, recorded in AC 7.

**9. The observation carries response content only, plus a correlation label.** No elapsed time, no
redirect count, no retry count: AD-10 requires the verdict to be "a pure function of the returned
observations", and a timing field would make an accidental input to a verdict that must be
reproducible. But **`probeId` is required on both the request and the observation**, because AD-10's
input-sensitivity witnesses are "a pair of inputs" for one operation and its state-reset check
compares "the first and third observations" of one operation. Without a correlation label those are
distinguishable only by array position, and NFR9 is a standing constraint that every stage consuming
an observation array must produce identical outcomes under permutation. Story 6.2 would otherwise
have had to add this field and change a shape AC 1 promises it inherits unchanged.

**10. A body is tagged; headers are flattened and `set-cookie` is dropped.** `JsonValue` accepts a
bare string, so an untagged body cannot distinguish a JSON string response from a `text/html` one,
and AD-28 exists to stop two adapter authors resolving one boundary differently. Repeated headers
join with `", "` per RFC 9110; `set-cookie` is the header that rule is wrong for, nothing in AD-10
reads it, and a joined `set-cookie` is a value no consumer can split back, so it is dropped rather
than mangled. Tagging the body also removes a `.nullable()` that would have been a no-op, since
`JsonValue` already accepts `null`.

**11. `single-underlying-call` is split into two assertion ids, and every id is namespaced by
method.** AD-37 states one clause ("exactly one underlying call occurs per port invocation, which is
what catches an internal retry"); a single id would report a retrying adapter and a
double-dispatching adapter identically, and the retry case is the one AD-37 names. Namespacing is
forced by the file-system port's two methods: twelve outcomes from six ids cannot carry
`typed-fault` twice, and `formatConformanceReport` renders one line per outcome.

**12. `allow-authorized-loopback` and `observe-anomalous-status` are required probe assertions.**
Without the first, a subject that denies every request passes all twelve default-deny-and-cap
assertions, and AD-35 spends a clause on why a blanket loopback ban is wrong. Without the second, a
subject that throws on a 5xx passes everything while making AD-10's "every declared seeded fault
being observed to fire" unimplementable. Fixtures 72 and 71 are the proofs that each can fail.

**13. `unparseable` denies, and the comparison runs on parsed addresses.** `parseAddress` reduces
every spelling to one `canonical` form, and AC 4 step 6 compares canonical forms on both sides rather
than strings. This is what gives the parser a job: an exact-address allowlist compared as strings is
bypassed by a redirect to `::ffff:127.0.0.1` against an entry naming `127.0.0.1`, and it wrongly
denies the bracketed and zone-suffixed spellings Node itself produces. An address the parser cannot
read is one it cannot prove is outside the denied classes, so `unparseable` routes to a denial.
Fixture 34 is the fixture that fails if the unwrap is dropped; fixtures 1-20 exist because the
parser's output is what the denial `detail` and `PolicyDecision.addressClass` carry.

**14. `metadata` is classified before both `link-local` and `private`.** `169.254.169.254` is inside
`169.254.0.0/16` and `fd00:ec2::254` is inside `fc00::/7`. Either later ordering silently reports a
cloud metadata endpoint as something less alarming, on the one denial an operator most needs to read
correctly.

**15. The probe subject's target map is separate from its policy.** AD-35 describes exactly this
("the caller maps those identifiers to authorized targets through configuration outside the
contract"), and it is the only arrangement in which a scheme, host, or port denial is producible: a
subject deriving the target from the authorization it validates against can never present a
mismatch, so AC 4's steps 2, 3, and 4 would be unreachable and three assertions would pass only when
the adapter is wired wrong.

**16. The connection is pinned to the validated address.** AC 5's mandated doc comment and AC 11's
subject both require connecting to `decision.canonicalAddress` with the original host in the `Host`
header, and never re-resolving a hostname after validation. AD-35's "every resolved address is
revalidated against the same policy" is the sentence that implies it; without the pin, re-resolution
between the check and the connect defeats the whole control. Fixture 88 asserts it.

**17. The corpus adapter's escape check is lexical before the filesystem and real-path after.**
`..`-after-normalize and an absolute path are refused with no filesystem call at all (fixtures 79 and
80); a symlink escape needs `realpath`, which is a filesystem call and necessarily happens after
(fixture 81). Claiming one check "before touching the filesystem" covered all three would have been
false.

**18. `src/index.ts` is not touched; the port types are published through the conformance subpath.**
Every Epic 3, 4, and 5 story left the root barrel alone, and Story 6.5 owns the library surface. An
adapter author still needs `CorpusPort`, so `src/testing/index.ts` re-exports it. The `root -> ports`
edge is deliberately **not** added to the checker: 6.5 adds it if 6.5 decides the root barrel should
carry the port types too.

**19. `src/core/probe/` is a new `core/` submodule not in the Structural Seed.** The seed states its
own shape is "Provisional ... Nothing here is amendment-controlled: an AD governs a contract two
units could resolve incompatibly, and a directory name ... is not one of those." AD-35 binds the
adapters and CI, and its decision procedure is pure, so it belongs under `core/` where
`classifyLayer` already maps it with no edit, the purity scan covers it, and NFR7's floor counts it.

**20. The in-repository probe subject lives under `tests/`, not `src/adapters/`.** AD-2 forbids
shipping a network adapter; AD-37 requires CI to run the suite against one. `tsconfig-build.json`
excludes `tests`, so the subject is real, is exercised on every run, and cannot reach `dist/`. This
is the only reading under which both ADs hold.

**21. `formatConformanceReport` renders one line per outcome.** `<pass|FAIL> <id>: <title>` for a
pass and `FAIL <id>: <title> - <detail>` for a failure, with a header naming the subject, the port,
and the pass count over the total. Pinned because an adapter author's only view of a failure is this
string, and fixture 55 asserts it names every failed qualified id and no passing one.

**22. The abort budget is a number on the subject, defaulting to 1000ms.** "Promptly" with no bound
is unfalsifiable, and a bound too tight is a flaky test, which AD-30 calls a defect rather than
something to quarantine. One second is far outside any real adapter's abort latency and far inside
vitest's default timeout, and a subject with a slower mechanism raises its own.

**23. `::/96` and `64:ff9b::/96` are classified by their embedded IPv4, and only `::ffff:0:0/96`
rewrites the canonical form.** Code review finding 6: `::127.0.0.1` and `64:ff9b::169.254.169.254`
both read as `public`, which is the same wrong answer on a denial `detail` that Decision 14's
ordering exists to prevent, since both reach the embedded address on a stack that translates them.
Classification alone was changed. The canonical form stays the expanded IPv6 string, so an
authorization naming `127.0.0.1` does not permit `::127.0.0.1`: only the IPv4-mapped rewrite is
required (fixture 34), and any further widening of an exact allowlist should fail closed. `::` and
`::1` keep their own row in AC 4's table. Fixture 20a asserts the classes and the non-widening.

**24. A `%zone` suffix is accepted only on an IPv6 link-local address.** Code review finding 8: the
strip was unconditional, so `127.0.0.1%eth0` quietly became `127.0.0.1` even though a zone on an
IPv4 literal is an address on no stack. A zone scopes an address to one interface and only
`fe80::/10` needs that, so the suffix is now refused everywhere else and those spellings join
fixture 16. The residual is recorded rather than fixed: `fe80::1%eth0` and `fe80::1%eth1` still
share a canonical form, so an authorization naming one permits the other. Fixture 35 requires an
authorization naming `fe80::1` to permit `[fe80:0:0:0:0:0:0:1%eth0]`, which makes zone-insensitive
matching inside `fe80::/10` the mandated behaviour; the two cannot both hold, and the story's
fixture wins.

## Tasks / Subtasks

- [ ] **Task 1 (AC 2, 3): the schemas.** Write `src/core/schemas/port-messages.ts` and
      `src/core/schemas/probe-policy.ts`. Do not touch `artifact.ts`. Run `npm run check:schemas`
      and confirm it still reports 12.
- [ ] **Task 2 (AC 4): the pure policy.** Write `src/core/probe/target-policy.ts`, then
      `tests/probe/target-policy.test.ts` fixtures 1-40. Run `npm run check:layers` and confirm the
      new `core/` module reports no purity violation. Fixture 34 is the one to write first: if it
      passes before the unwrap rule exists, the rule is not load-bearing and Decision 13 is wrong.
- [ ] **Task 3 (AC 5): the four ports.** Write the four files under `src/ports/`, including
      `environment-probe-port.ts`'s four mandated doc-comment rules, and rewrite
      `src/ports/port.ts`'s header comment (AC 1). Confirm `check:layers` still passes: `ports/` may
      not import zod, and these files import schema objects from `core/schemas`, which is the
      allowed edge.
- [ ] **Task 4 (AC 10): the checker.** Make the six edits to `scripts/dependency-direction.ts` and
      extend `tests/architecture/dependency-direction.test.ts` (fixtures 89-91). Do this **before**
      writing `src/testing/`, so the first file written into the new layer is checked by a gate that
      already knows about it. Expect an intermediate state where `check:layers` reports 57 files and
      the `testing` layer is occupied by nothing: that is correct and nothing detects it, since
      `discoverSourceFiles` throws only on an empty `src/` walk as a whole.
- [ ] **Task 5 (AC 6, 7, 8): the suite.** Write `src/testing/conformance.ts`,
      `src/testing/probe-conformance.ts`, `src/testing/index.ts`. Then
      `tests/testing/conformance.test.ts` fixtures 41-72. Every broken subject must flip exactly the
      qualified outcome id the table names and no other; if a mutant flips two, the assertions
      overlap and one of them is not testing what its id says.
- [ ] **Task 6 (AC 9): the adapters.** Write the three files under `src/adapters/`, then
      `tests/adapters/*-adapter.test.ts` fixtures 73-84. Fixture 54 (in Task 5) is what pins steps 1,
      2, 4, and 5 against `invokePort` and pins step 3 as a deliberate divergence; if its five
      passes drop to four, the adapters diverged somewhere they should not have.
- [ ] **Task 7 (AC 11): the probe subject.** Write `tests/adapters/probe-subject.ts` and
      `tests/adapters/probe-subject.test.ts` fixtures 85-88. Verify no handle leaks: run
      `npx vitest run tests/adapters` alone and confirm the process exits rather than hanging.
- [ ] **Task 8 (AC 13): publication.** Add the `./conformance` export and the `test:conformance`
      script to `package.json`; add the named step to `validate-and-build` and `floor` in
      `.github/workflows/pr-checks.yml` and to no canary job; write the README subpath paragraph and
      finish the partly-refreshed `validate` comment. Run `npm run build` and confirm `dist/testing/index.js` and
      `dist/testing/index.d.ts` exist.
- [ ] **Task 9 (AC 13, 14): the gate.** Run `npm run build:shareable` after the README edit, then
      `npm run validate`. Check every row of AC 14's two tables against the actual output. Then
      append **Step 19** to `_bmad-output/project-knowledge/learning-path-step-by-step.md` plus its
      table row, per `learning-path-template.md` (Step 18 is Story 5.3's, added by PR #32), and set
      `_bmad-output/implementation-artifacts/sprint-status.yaml`'s
      `6-1-ports-and-the-published-conformance-suite` to `review` with `last_updated` refreshed.

## Dev Notes

### Read these files before writing anything

1. `ARCHITECTURE-SPINE.md` AD-37 (lines 489-494) in full. It is six sentences and every clause is an
   acceptance criterion in this story.
2. `ARCHITECTURE-SPINE.md` AD-28 (410-432), especially the ten-row fault table and the paragraph
   after it: "A port performs no retries and no back-off ... Every port method accepts an abort
   signal and must honour it."
3. `ARCHITECTURE-SPINE.md` AD-35 (477-482) in full, sentence by sentence. Nine of AC 7's thirteen
   probe assertions are one sentence each from this rule.
4. `ARCHITECTURE-SPINE.md` AD-2 (169-174) and AD-30 (439-446). AD-2 is why no network adapter ships;
   AD-30's second sentence is the loopback carve-out that lets the probe subject exist at all.
5. `ARCHITECTURE-SPINE.md` AD-8 (265-270) and AD-10 (277-284). AD-8 fixes what the corpus port does
   and does not do. **Read AD-10's sensitivity-witness and state-reset sentences twice**: they are
   why `probeId` exists (Decision 9), and they are what Story 6.2 will reduce over.
6. `epics.md:50` (NFR9), the standing permutation constraint. It is the other half of Decision 9's
   argument and it binds every stage that consumes an observation array.
7. `ARCHITECTURE-SPINE.md` dependency direction (133-160) and Structural Seed (580-612). The seed
   names `ports/`, `adapters/`, and `testing/` and their contents; the dependency block is what
   `scripts/dependency-direction.ts` encodes.
8. `src/ports/port.ts` in full (34 lines). It is the shape every port in this story implements, and
   its header comment names this story by number.
9. `src/application/invoke-port.ts` in full (84 lines). Steps 1, 2, 4, and 5 of AC 9 are its body;
   **step 3 is where the adapters deliberately differ**, and lines 47-69 are where you can see that
   it has no `Promise.race` and no abort listener.
10. `tests/application/invoke-port.test.ts` in full: house style for asserting a `RuntimeFault`'s
    `code`, `artifactPath`, and `cause`, and for counting calls with `vi.fn`.
11. `src/core/schemas/faults.ts` in full (41 lines). Ten codes in the spine's order, and
    `RuntimeFault`'s three-argument constructor plus its `options.cause`.
12. `src/core/schemas/interface.ts` lines 92-131: `HttpMethod`, `PATH_TEMPLATE_PATTERN`,
    `PathTemplate`. `ProbeRequest` imports all three rather than respelling them.
13. `src/core/schemas/primitives.ts` lines 95-97 (`Rfc3339Utc`), 111 (`KeyName`), 113-119 (the
    `JsonValue` type alias) and 127-145 (the schema). Note `Rfc3339Utc` rejects a numeric offset,
    which `new Date().toISOString()` satisfies, and that `JsonValue` already accepts `null`, which
    is Decision 10's reason for tagging the body instead of nulling it.
14. `src/core/schemas/preflight-verdict.ts` in full. Its six `PREFLIGHT_CHECK_KINDS` are what
    `ProbeObservation` has to be sufficient for; `input-sensitivity` and `state-reset` are the two
    that need `probeId`.
15. `scripts/dependency-direction.ts` lines 23-59 (`Layer`, `LAYER_LABELS`, `classifyLayer`), 68-90
    (`isAllowedEdge`), 193-200 (the doc comment), 201-250 (`checkExternalSpecifier`, including line
    227's early return), and 508 (`purityScoped`). Those are the six edits Task 4 makes.
16. `tests/architecture/dependency-direction.test.ts` lines 1-70: `SELF` (26-34), `OTHER` (36-44),
    and the hand-transcribed `ALLOWED` (54-61), which exists so the test asserts the specification
    rather than the implementation checking itself. Then lines 82-105, the generated matrix loop
    that fixture 89 widens from 48 `it`s to 63.
17. `src/core/canonical/digest.ts` lines 1-35: `digestBytes` takes a `Uint8Array`, which is
    Decision 6's reason.
18. `README.md` `## Development` (lines 193-224) for where the subpath paragraph goes, the house
    voice it goes in, and the partly-refreshed `validate` comment in its `bash` block.
19. `_bmad-output/project-knowledge/learning-path-template.md` in full, and
    `learning-path-step-by-step.md` line 61 (the row 18 the new row 19 follows) and lines 1271-1351
    (Step 18, the format Step 19 copies).

### Previous-story intelligence

1. **Stories 5.1 and 5.2 both took most of their review findings on fixtures that could not fail.**
   5.1 took nine then seven; 5.2's creation review found four vacuous fixtures before a line was
   written, and its highest-severity finding was a fixture whose mutation left the verdict
   unchanged. **This story's creation review found the same class three more times**, and each is
   now closed by construction: the address classifier was decorative until AC 4 step 6 started
   comparing parsed addresses (fixture 34); the shipped adapters' response parse could not reject
   until every mechanism returned `unknown` (fixture 76); and the deny assertions were satisfiable
   by a subject that refuses everything until `allow-authorized-loopback` and
   `observe-anomalous-status` joined them (fixtures 72 and 71).
2. **Story 5.1 finding 2: an assertion that re-derives its expected value from the function under
   test proves nothing.** Fixtures 21 and 58 carry their tuples and counts as literals for that
   reason, and fixture 87 asserts the probe policy against the live `server.address()` rather than
   against the constant the subject was built from.
3. **Story 4.3's Decision 7 is a standing convention: every numeric or arity comparison needs a
   paired at-bound and over-bound fixture.** This story's comparisons are the call counts (47 and 48
   over-bound, 41-43 at-bound), the two CIDR boundaries (fixtures 6 and 8 assert both sides),
   `maxRedirects` (`cap-redirects` asserts exactly `maxRedirects + 1` calls), `maxResponseBytes`
   (fixture 68), `maxElapsedMs` (fixture 70), and `outcomes.length` (fixtures 56 and 57).
4. **`npm run check:layers` has been in `validate` since Story 4.4.** Under `core/`: no `async`, no
   `await`, no `Date`, no `Math.random`, no Node builtin, no external import. `src/core/probe/` is
   `core`, so `target-policy.ts` must be entirely synchronous and pure. Confirm with `check:layers`
   rather than by reading.
5. **Story 4.1's story file still carries thirteen unchecked Review Findings items**, three verifiably
   open in `core/compile/reachability.ts` and `core/evaluate/`. This story touches neither; noted so
   the next reader finds them rather than inheriting them silently.
6. **`deferred-work.md` carries no open items and this story opens none.** If it opens one, the
   file's "No items are currently open" header prose changes with it.
7. **Recent commits, for the shape of the tree this lands on:** `95ed961` added the seven
   satisfaction predicates; `5613db6` added `src/core/coverage/`; `430d3b7` added the orchestration
   layer (`src/application/`), both registry checks, and the layer gate.
8. **Story 5.3 (`the contract fixture corpus and the regenerated table`) landed on `main` as PR #32
   while this story was being built**, and this branch was fast-forwarded onto it (`531217b`). It
   shares no source file with this one: 5.3 owns `core/coverage/`, `tests/coverage/`, the three
   `ad31-table` scripts, and `docs/ad31-coverage-predicates.generated.md`; this story owns `ports/`,
   `adapters/`, `testing/`, and `core/probe/`. What it did move is every baseline in AC 14, the
   `validate` chain (which gained `check:ad31-table`), `pr-checks.yml`'s job list, the README's
   `validate` comment, and the learning path's next step number. All five are corrected in this
   file; do not re-derive them from an older copy.

### Project structure notes

New directories: `src/core/probe/`, `src/adapters/`, `src/testing/`, `tests/probe/`,
`tests/adapters/`, `tests/testing/`. `src/adapters/` and `src/testing/` are named in the Structural
Seed; `src/core/probe/` is not, per Decision 19. `tests/` mirrors `src/`, which is why
`tests/probe/` mirrors `src/core/probe/` (the same way `tests/canonical/` mirrors
`src/core/canonical/`), and `tests/adapters/` holds both the shipped-adapter runs and the probe
subject, because both are "run the suite against an adapter".

Unchanged: `src/index.ts`, `src/core/schemas/artifact.ts`, `src/core/schemas/publish.ts`,
`schemas/`, `biome.json`, `vitest.config.ts`, both tsconfigs, `src/application/invoke-port.ts`,
`src/core/compile/`, `src/core/coverage/`, `src/core/seal/`, `src/core/evaluate/`,
`src/core/canonical/`, and every script but `dependency-direction.ts`.

**A Zod schema and its `z.infer` alias share one identifier**, so `port-messages.ts`'s exports are
imported as plain values in `ports/` and used in both type and value position: the `PortMethod`
generic reads the type, and `corpusResolveParsers` reads the value. Biome's `useImportType: error`
fires only when every use is a type, so a plain `import` is correct there and `import type` would
break the parser export. `import type { PortMethod }` from `./port.ts` is type-only and does need the
`type` keyword. In `src/testing/index.ts` the mirror rule applies: type re-exports use
`export type { ... }`, or `style.useExportType: "error"` fails the lint.

Naming: files are kebab-case, one concern per file. Zod schemas and their inferred types share a
`PascalCase` name; `as const` tuples are `SCREAMING_SNAKE`; functions are `camelCase`; adapter
constructors are `createXAdapter`. Every file opens with a doc comment carrying the AD citation and
the reason a shape was chosen, kept no longer than the declaration it documents. Imports carry the
explicit `.ts` extension.

### Testing requirements

- **One `it` per numbered fixture**, except fixture 89, which is the pre-existing generated matrix
  and contributes 63. AC 14's second table is the arithmetic.
- The fixture number opens the test name.
- `any` is permitted in `tests/` and forbidden in `src/`. `it.only` and `describe.only` are lint
  errors and therefore fail `validate`.
- No configured coverage threshold and no coverage provider is installed. Do not run `--coverage`.
  The proxy for NFR7's floor is AC 12's fixture list; Story 6.5 owns the measurement.
- **Filesystem tests use `mkdtemp` under `os.tmpdir()` and remove the directory in `afterEach`.**
  AD-30 permits no filesystem I/O outside a temporary directory. A test that writes into the
  repository is a defect even when it cleans up.
- **The fixture server binds `127.0.0.1:0` and reads the port back.** A fixed port collides under
  parallel workers and produces a flake that looks like a policy failure.
- **Close every server and socket.** A leaked handle makes vitest hang rather than fail. Assert the
  exit in Task 7 by running `tests/adapters` alone.
- **A `RuntimeFault` assertion pins `code` and `artifactPath`, never only the message.** The message
  is prose and will be reworded; the code is the contract AD-28 publishes.
- **Every conformance-report assertion pins `outcomes.length` alongside `passed`**, and every
  outcome assertion names the **qualified** id (`readFile/typed-fault`, `probe/deny-private`). A
  suite that ran three of six assertions and passed all three would otherwise report `passed: true`,
  which is the vacuity AC 6's length rule and fixtures 56-57 exist to prevent.
- Do not import across test files. `tests/adapters/probe-subject.ts` is a shared helper inside its
  own directory, matching `tests/coverage/fixtures/` and `tests/evaluate/fixtures/`; the synthetic
  subjects in `tests/testing/` stay local to that file.

### References

- Epic and story text: `_bmad-output/planning-artifacts/epics.md` lines 414-416 (Epic 6 preamble)
  and 418-428 (Story 6.1 through its `Then` clause); line 37 (FR16), line 34 (FR13), line 35 (FR14),
  lines 42-43 (NFR1, NFR2), line 48 (NFR7), line 50 (NFR9), line 14 (the spine-governs clause), line
  83 (FR16 maps to Epic 6). Neighbouring stories: 430-440 (6.2), 442-452 (6.3), 454-463 (6.4),
  465-472 (6.5).
- `ARCHITECTURE-SPINE.md`: AD-37 (489-494), AD-35 (477-482), AD-28 (410-432), AD-34 (471-476),
  AD-30 (439-446), AD-10 (277-284), AD-8 (265-270), AD-2 (169-174), AD-1 (163-168), AD-29 (433-438);
  dependency direction (133-160); Structural Seed (580-612); Capability map (613-628); the CI matrix
  sentence (606).
- Existing shapes: `src/ports/port.ts:1-34`, `src/application/invoke-port.ts:1-84` (especially
  47-69), `src/core/schemas/faults.ts:1-41`, `src/core/schemas/interface.ts:92-131`,
  `src/core/schemas/primitives.ts:95-97,111,113-119,127-145`,
  `src/core/schemas/preflight-verdict.ts:1-60`, `src/core/canonical/digest.ts:1-35`,
  `src/core/stage-contracts.ts:1-40`.
- Gates: `scripts/dependency-direction.ts:23-90,193-250,508`,
  `scripts/check-dependency-direction.ts`, `scripts/discover-source-files.ts:42-46`,
  `scripts/generate-schemas.ts:14-45`, `src/core/schemas/artifact.ts:41-100`,
  `.github/workflows/pr-checks.yml` (`validate-and-build` at 14, `floor` at 68, the eight
  `canary-*` jobs from 111), `scripts/check-shareable.mjs:1-50`,
  `scripts/check-docs.mjs:9-15`.
- House style: `tests/application/invoke-port.test.ts`, `tests/coverage/relevance.test.ts:1-40`,
  `tests/architecture/dependency-direction.test.ts:1-70,82-105`,
  `5-2-the-seven-satisfaction-predicates.md`,
  `4-4-stages-as-pure-plan-and-reduce-pairs-with-one-orchestration-layer.md`.
- Learning path: `_bmad-output/project-knowledge/learning-path-template.md` (shape),
  `learning-path-step-by-step.md` line 61 (the table row to append after) and lines 1271-1351
  (Step 18's format).

## Suggested Review Order

1. **AC 4 step 6 and fixture 34 together.** They are the story's one security-load-bearing pair: the
   comparison is between parsed addresses, and fixture 34 is what fails if the unwrap is dropped.
   Check that the fixture would actually fail, not that it looks like it would.
2. **`classifyAddress`'s table row by row, and the two ordering claims.** `metadata` before
   `link-local` and before `private`, each for a named address inside a named range. A missing class
   is visible only in the one fixture that names it.
3. **AC 9 step 3 against `invoke-port.ts:47-69`, and Decision 3.** The adapters diverge from
   `invokePort` here on purpose. If the divergence is wrong, `prompt-abort` is unpassable for every
   shipped adapter and fixture 83 is unachievable.
4. **Decision 9 against `src/core/schemas/preflight-verdict.ts`'s six check kinds and against
   NFR9.** Is `probeId` sufficient for `input-sensitivity` and `state-reset` under permutation, and
   is anything else in the observation still position-dependent?
5. **AC 6's assertion table against AD-37's four named minimums.** Every id must trace to a clause.
   `no-in-band-error` traces to AD-37's first clause read with AD-28's "never returns a partial
   success or an in-band error value"; if that trace does not hold, the assertion is invented.
6. **AC 7's `allow-authorized-loopback` and `observe-anomalous-status`, with fixtures 72 and 71.**
   They are the two assertions that stop the other twelve passing vacuously. Check each mutant flips
   only its own id.
7. **Fixtures 44 through 52 and 60 through 71, one at a time: does each mutant flip exactly the
   qualified id the table names?** If one flips two, the assertions overlap and at least one is not
   measuring what its id says. This is the check Stories 5.1 and 5.2 each paid for twice in review.
8. **AC 11's eight-entry `targets` map against AC 4's steps 2, 3, and 4.** Each scheme, host, and
   port denial must be producible; if the map cannot present a mismatch, three assertions pass only
   when the adapter is wired wrong.
9. **AC 10's six checker edits, especially item 5's position** relative to line 227's early return,
   against the transcribed `ALLOWED` map in the test. The map is written from the AC, not from
   `isAllowedEdge`.
10. **Decisions 7 and 8 against the AD-28 table.** Seven denial reasons, one code; caps are
    `budget-exhausted`. `check:ad28-registry` catches the first; only `cap-response-bytes`,
    `cap-redirects`, and `cap-elapsed` catch the second.
11. **AC 14's two tables**, each row against actual command output rather than against arithmetic.

## Story Review Record

One peer review pass against the story before implementation, in a separate Claude Code session. It
executed rather than reasoned from prose: it ran all six gates, transcribed every ```ts block into a
scratch project wired to the real `src/core/schemas/` and compiled it with the repo's own
`typescript@7.0.2` under a copy of `tsconfig.json`, formatted every block with Biome 2.5.8 against a
copy of `biome.json`, and verified Zod 4.4.3 behaviour at runtime.

**Confirmed with no change needed:** all six baselines as they stood at review time, and the
file-count arithmetic. **Those baselines were superseded hours later when PR #32 (Story 5.3) merged
to `main`**; the review measured `check:layers` 57/0 and `npm run test` 52 files / 2074 tests, and
the current tree reads 59/0 and 55 files / 2160 tests. AC 14 carries the current numbers and is the
one to trust; this paragraph records what the review actually executed against. The arithmetic the
review verified (thirteen new source files, six new test files, +105 tests) is unchanged and is what
AC 14's second table still rests on. `z.instanceof(Uint8Array)`
parses a `Uint8Array`, rejects a plain array, and satisfies the structural `BoundaryParser` by direct
assignment; `z.toJSONSchema` throws "Custom types cannot be represented in JSON Schema" on it, which
confirms Decision 5 by execution rather than by argument; `z.strictObject({})` parses `{}` and
rejects `{a:1}`. AC 2's, AC 3's, and AC 5's blocks compile clean verbatim. Every spine, epics,
learning-path, and script citation was checked and found exact, including `purityScoped` at line 508
being `core || core-schemas`, `tsconfig-build.json` excluding `tests`, and `check-docs.mjs`'s `ROOTS`
excluding `_bmad-output/implementation-artifacts`. Decisions 7, 8, 12, 18, 19, and 20 survived
scrutiny unchanged. No conflict was found with Story 6.2, 6.4, or 6.5 beyond finding 3.

**Twenty-eight findings, all addressed in this file:**

1. **High.** `classifyAddress` was not load-bearing: AC 4's order used it only to detect
   `unparseable`, and step 6 compared raw strings, so mutating the classifier flipped no decision
   and the stated security property did not exist. Step 6 now compares
   `parseAddress(...).canonical` on both sides, `parseAddress` is an exported function with a stated
   wrapper-stripping order, and Decision 13 states the property that is actually true. Fixture 34 is
   new and is the one that fails if the unwrap is dropped.
2. **High.** AC 9's adapter body had no abort race, so `prompt-abort` was unpassable for all three
   shipped adapters and `createSystemClockAdapter`'s mechanism took no signal at all. AC 9 now has
   five steps with a `Promise.race` against a `{ once: true }` abort listener removed in a
   `finally`; every mechanism type takes an `AbortSignal`; Decision 3 records that this is a
   deliberate divergence from `invokePort` and why; fixture 54 asserts the divergence rather than
   the agreement.
3. **High.** `ProbeObservation` could not be bound to the plan entry that produced it, which made
   AD-10's `input-sensitivity` and `state-reset` unimplementable as a pure reduce and broke NFR9.
   `probeId: Identifier` is now required on both `ProbeRequest` and `ProbeObservation`, Decision 9
   states why, NFR9 is on the story's `Implements:` line, and Dev Notes item 6 points at
   `epics.md:50`.
4. **High.** AC 11's probe subject had no target map separate from its policy, so
   `deny-unauthorized-scheme` was unconstructible and the address trio contradicted "exactly one
   target". `createProbeSubjectAdapter` now takes `targets` as a fourth argument, AC 11 states eight
   interfaces against one authorization, Decision 15 records the reasoning, and fixture 87 asserts
   the authorized entry against the live server.
5. **High.** AC 14's arithmetic was wrong on both terms: fixture 89 is a generated matrix worth +15,
   not +1, and AC 4's table had 12 rows numbered 1-13. AC 14 now carries a second table breaking the
   delta into five sources totalling +105, giving 2179, and the classifier table has 20 fixtures.
6. **High.** The shipped adapters' mechanisms were typed too tightly for AC 9's response parse to
   ever fail, so `no-in-band-error` and `schema-valid-return` were vacuous on every real adapter.
   Every mechanism now returns `unknown`, Decision 4 records why, and fixture 76 asserts
   `port-contract-violation` through the real adapter.
7. **Medium.** No table row produced `public`, so a classifier that never returned it passed. Rows
   14 and 15 are new.
8. **Medium.** AD-35 names four denied classes and the suite asserted three. `deny-private` is new,
   with `deniedAddressRequests.private` and fixture 62.
9. **Medium.** Outcome ids collided across the file-system port's two methods, making twelve
   outcomes from six ids and `formatConformanceReport` unsatisfiable. Ids are now namespaced by
   method, stated in AC 6 and Decision 11, and every fixture names the qualified id.
10. **Medium.** The IPv4-mapped rule was one table row rather than an unwrap rule, closing one class
    of four, and `fd00:ec2::254` sits inside `fc00::/7` so `metadata` had to precede `private` too.
    AC 4 now states the unwrap as a rule, fixture 17 covers four classes, and Decision 14 states
    both orderings.
11. **Medium.** Three of AD-35's four caps were declared, read by nothing, and asserted by nothing.
    `cap-redirects` and `cap-elapsed` are new assertions with `/redirect-twice` and `/slow` routes
    and fixtures 69 and 70; `maxRequestBytes` is now explicitly recorded as unasserted with the
    reason.
12. **Medium.** Address comparison was raw string equality, so `[::1]`, `fe80::1%eth0`, and expanded
    IPv6 all failed closed against authorizations that named them. `parseAddress` now strips
    brackets and zone, unwraps mapped form, and normalizes IPv6; fixtures 18, 19, 20, and 35 cover
    it.
13. **Medium.** Nothing required the adapter to connect to the address it validated, leaving DNS
    rebinding open. AC 5's mandated doc-comment rule 2 and AC 11's subject now require connecting to
    `decision.canonicalAddress` with the original host in the `Host` header and no re-resolution;
    Decision 16 records it and fixture 88 asserts it.
14. **Medium.** AC 9's symlink clause contradicted its own "before touching the filesystem" and had
    no fixture. The check is now split into a lexical half before any filesystem call and a
    `realpath` half after, Decision 17 records the split, and fixture 81 is new.
15. **Medium.** AC 4's, AC 6's, and AC 7's blocks did not compile and the story never distinguished
    verbatim source from signature sketch. Every block is now labelled `VERBATIM` or `SKETCH`, AC 6's
    block carries its import line, and AC 6 states that `runEnvironmentProbePortConformance` lives in
    the other file.
16. **Medium.** Nothing said a non-2xx response is an observation rather than a fault, which would
    have made AD-10's seeded-fault check vacuous. AC 5's doc-comment rule 4 states it,
    `probe/observe-anomalous-status` is a new assertion with a `/fault` route, and fixture 71 proves
    it can fail.
17. **Medium.** `headers` could not represent a repeated header and `body` could not distinguish
    JSON from text or represent absence. Both bodies are now tagged unions, and the header
    flattening rule and the `set-cookie` exception are stated on the field and in Decision 10.
18. **Medium.** AC 7 never said which built subject the probe assertions run against or that each
    needs a fresh one. AC 7 now states one `'resolves'` build per assertion and gives the total
    instance count.
19. **Medium.** Three internal count mismatches (five versus six shared assertions, seven versus
    nine additional, four versus five checker edits). Now six, thirteen, and six throughout.
20. **Low.** AC 2's four-name import was written multi-line and Biome collapses it to 78 characters.
    Collapsed.
21. **Low.** `JsonValue.nullable()` was a no-op, since `JsonValue` already unions `z.null()`.
    Removed by finding 17's tagged body.
22. **Low.** AC 10 item 5 did not say where the `testing` case goes in `checkExternalSpecifier`, and
    a block after line 227's early return is dead code. The position is now stated, and the
    function's doc comment is the sixth edit.
23. **Low.** The clock and corpus mechanism types were never declared and the clock's default could
    not produce three of the four scenarios. `ClockMechanism` and `CorpusMechanism` are now declared
    beside `FileSystemMechanism`.
24. **Low.** `ProbeRequest.channels.header` used `KeyName` and `ProbeObservation.headers` used
    `z.string()`, so an observation could carry an empty header name. Both are `KeyName`.
25. **Low.** AC 8's barrel would fail `style.useExportType: "error"` without `export type`. Stated
    in AC 8 and in the Project structure notes.
26. **Low.** The named CI step landed on `validate-and-build` only while AD-30 and spine 606 require
    the floor job too. AC 13 now adds it to both.
27. **Low.** Two citations were off: README `## Development` is 192, not 193, and the
    `primitives.ts` ranges overshot. Corrected to 192-215 and 95-97 / 111 / 113-119 / 127-145.
28. **Low.** README line 195's `validate` comment was already stale (missing `check:shareable`,
    `check:ad28-registry`, `check:layers`) and Task 8 edits that section anyway. Refreshing it is
    now part of AC 13 and Task 8.

**Three further gaps the reviewer raised outside the numbered list, all closed:** `src/testing/` may
not import `src/core/probe/`, so the suite cannot share the subject's decision procedure (AC 6, AC 8,
AC 10, fixture 91); the expected outcome count is now the exported `CONFORMANCE_OUTCOME_COUNTS`
constant asserted as literals by fixture 58 rather than an unlocated number; and Task 4 records that
the intermediate state after the checker edit is a `testing` layer nothing occupies, which is correct
and which nothing detects.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context), build session `epic6-story1-bmad-build`.

### Debug Log References

Fixture 34's tripwire was executed rather than reasoned about: deleting the `::ffff:` unwrap from
`mappedIpv4Octets` turns fixtures 34, 17, and 18 red. 17 and 18 name the unwrap explicitly, so that
is correct co-failure and not assertion overlap. Restored, re-run green.

`probe/cap-elapsed` measured at 253ms against the declared 250ms `maxElapsedMs`, confirming it fires
on the elapsed timer and not on a faster path. `npx vitest run tests/adapters` alone exits in 1.1s,
so no handle leaks. `dist/testing/index.js` loads and exports the four `run*Conformance` functions,
`formatConformanceReport`, `CONFORMANCE_OUTCOME_COUNTS`, and the five parser pairs.

### Completion Notes List

**Deviation 1: a fourteenth new file, `src/adapters/port-boundary.ts`.** AC 1's table names
thirteen and AC 14 expects `check:layers` at 72; the actual figure is **73**, and this file is the
whole difference. AC 9 specifies one five-step body, and three adapters share four port methods, so
the five steps live in one module. Reported rather than reconciled by editing the number.

**Deviation 2: same-layer imports are legal for every layer.** AC 5's own VERBATIM block has each
port file `import type { PortMethod } from './port.ts'`, and `isAllowedEdge` rejected
`ports -> ports`, so the story's verbatim code could not pass `check:layers` as written. AC 8's
barrel has the same problem for `testing -> testing`. Settled in code per the standing rule against
new spine revisions: `isAllowedEdge` gained `if (from === to) return true`, on the spine's own
statement that an import inside the `core` node "is a same-layer dependency and stays permitted
exactly as the single-node diagram already draws it", with each per-layer sentence bounding what
that layer imports outside itself. Five cells in fixture 89's matrix flip from reject to allow
(`ports`, `application`, `adapters`, `cli`, `testing` self-edges); the test count is unchanged at 63
`it`s, and nothing may still import `cli/` or `testing/`. The transcribed `ALLOWED` map was widened
from the AC text, never from `isAllowedEdge`.

**Deviation 3: fixture 88 carries two assertions in one `it`**, keeping AC 12's one-`it`-per-fixture
rule and AC 14's +16 for `tests/adapters/*`.

**Deviation 4: the VERBATIM blocks' comment prose was pruned and de-AI'd.** AC 2's and AC 3's blocks
were transcribed byte for byte, then their block comments were shortened under the repository's
standing rule that comments are lean and free of AI tells. **Every statement, expression, exported
name, and `.describe()` string is unchanged; only comment prose differs**, so a later reader diffing
an AC block against the shipped file finds the difference explained here. The same pass ran over
every other file this story adds.

**Story-text conflict resolved by reading.** Decision 21 renders a pass as
`<pass|FAIL> <id>: <title>`, while fixture 55 asks the format to name "every failed qualified id and
no passing one". Decision 21's format shipped; fixture 55 asserts on the `FAIL ` prefix, so every
failed id appears as `FAIL <id>` and no passing id does. Both statements then hold.

### Code Review Record

One peer review pass against the implementation, in a separate Claude Code session, run inline
against `git diff HEAD` plus the untracked files. It mutated in a sandboxed copy of the tree and ran
the suite there, so every claim below was executed. It confirmed all eight gate numbers
independently, including the 73.

**Fourteen findings, all fixed in this pass.** Each fix was re-verified by re-running the mutation
that exposed it.

1. **High. Fixtures 56 and 57 were vacuous.** Both built a `ConformanceReport` literal, wrote
   `passed: false` into it, and asserted it back; neither called `reportOf`. Replacing
   `outcomes.length === CONFORMANCE_OUTCOME_COUNTS[port] &&` with `true &&` left the whole suite
   green, so the length rule had no tripwire anywhere. Both now route through `reportOf`, and the
   mutation flips exactly those two.
2. **High. Fixture 88's "connects to the validated address" half was vacuous.** Returning the
   pre-canonicalization address from `validate()` left the suite green, because
   `subjectResolveAddress('localhost')` returns `127.0.0.1`, which is already its own canonical
   form. Fixture 88 now adds a stub-mechanism adapter whose resolver returns `::ffff:127.0.0.1`
   while the authorization still names `127.0.0.1`, and asserts the hop carries `127.0.0.1`.
3. **High. `maxRequestBytes` was declared and enforced by nothing**, while `probe-conformance.ts`
   claimed it was "adapter-enforced". The probe adapter now measures the request's wire form before
   the first hop and throws `budget-exhausted`. **New fixture 92** asserts it fires with zero hops.
4. **Medium. After a redirect, the caps came from the wrong authorization.** `authorization` was
   destructured once before the loop while `validated` was reassigned inside it, and the elapsed
   cap read a `.find()` by interface id, which under two authorizations for one interface is not
   the one that allowed. The destructure moved inside the loop and the elapsed cap is now armed by
   the authorization handed back from the hop that allowed. Latent in the shipped subject and
   unasserted; the subject wires one authorization per interface, so no fixture reaches it.
5. **Medium. The leading-zero hardening had no fixture.** Relaxing `IPV4_OCTET_PATTERN` to
   `/^[0-9]{1,3}$/` left the suite green. Fixture 16 now carries eleven more spellings, including
   `010.0.0.1`, `0x7f.0.0.1`, `2130706433`, and `127.1`.
6. **Medium. `::/96` and NAT64 addresses classified as `public`.** See Decision 23.
7. **Medium. `maxResponseBytes` was counted in UTF-16 code units.** `setEncoding('utf8')` plus
   `body.length` let a 256-byte cap admit 768 bytes of three-byte characters. The mechanism now
   accumulates buffers and sums `byteLength`. **New fixture 93** serves a body under the cap by code
   units and over it by bytes.
8. **Medium. Zone stripping collided two destinations.** See Decision 24.
9. **Low. `from === to` allowed `root -> root`, which the transcribed `ALLOWED` map does not**, and
   fixture 89 skips that cell, so the one divergence sat where nothing checks. Now
   `return from !== 'root'`. The cell stays unasserted because `root` is a single file and the edge
   is unconstructible, recorded here the way AC 7 records an unasserted cap.
10. **Low. A redirect `Location` with no explicit port became port 0**, denied as
    `port-not-authorized` for the wrong reason and making a default-port redirect unfollowable. Now
    defaults by scheme. Unasserted: the fixture server always emits an explicit port.
11. **Low. A dead spread in `buildSubjectPolicy`** overrode `addresses` with the value
    `deniedAuthorization` already assigns. Dropped, and the comment now names the fact doing the
    work.
12. **Low. `/slow` wrote to a response whose socket the cap had destroyed.** Guarded with
    `response.destroyed`.
13. **Low. `nodeHttpMechanism` could hang** when a server sent headers and part of a body then
    destroyed the socket: `close` returned early and neither `end` nor `error` fired. It now
    rejects when `!truncated && !response.complete`. The reviewer confirmed the `end`/`close` pair
    cannot resolve twice, since `resolve` is idempotent.
14. **Low. An unmapped redirect host threw a plain `Error`**, which `runPortMethod` turned into
    `port-failure`: a policy denial reported as a transport failure. `subjectResolveAddress` now
    throws `forbidden-target`.

**Confirmed sound, with the mutation named:** fixtures 21, 27, 39, 40, 55, 58, 73, 74, 80, 81, 82,
84, 85, 86, 87. `port-boundary.ts` is load-bearing (removing `raceAbort` turns fixtures 73, 77, and
83 red on `prompt-abort`). Fixture 75 passes under the mutation fixture 73 catches, so it is weaker
than it looks; 73 is what protects the `unknown` design. No unhandled rejections, no leaked handles,
no secrets, no new dependency, no new AD-5 or AD-28 code. The reviewer found no exploitable address
collision across 36 adversarial spellings beyond finding 8.

**The reviewer's one correction to the deviation record:** the transcribed `ALLOWED` map's comment
claimed the self-edge cells were transcribed from the ACs. No AC states
`application -> application` or `cli -> cli`; those five cells are this story's generalization of
the spine, the same generalization `isAllowedEdge` encodes, so for them the map and the
implementation are one idea written twice. The comment now says that instead of claiming a
transcription it did not do.

**Baseline note:** local `main` is stale at `95ed961`, so `git diff main` bundles PR #32. `HEAD` is
`531217b` and `git diff HEAD` is this story's true surface.

### CodeRabbit Review Record

A second automated pass on PR #33. **Seven findings: six fixed, one taken a different way.** Each
fix was verified by re-running the mutation that exposed it.

1. **Major. The request channels never reached the wire.** `nodeHttpMechanism` sent only `Host` and
   ended with no body, so `parsed.channels` fed the byte budget and nothing else. A
   body-sensitivity differential would have observed the same empty request as a body-free probe,
   which makes AD-10's `input-sensitivity` check unimplementable. `renderRequest` now renders the
   path parameters, the query string, the headers, and a `json` body, and the mechanism writes
   them. `Host` is applied last so a declared header channel cannot rewrite the name the policy and
   TLS were checked against, and `maxRequestBytes` now measures the rendered form. **New fixture
   94** asserts all four channels arrive against an `/echo` route. Neither the story review nor the
   code review caught this.
2. **Major. A relative redirect `Location` threw.** `new URL('/ok')` with no base throws, and the
   throw propagated out of `validate` into `runPortMethod`'s catch, so the adapter reported
   `port-failure` for a redirect RFC 9110 permits and that it should have followed and revalidated.
   Now resolved against the current target. **New fixture 95**, with a `/redirect-relative` route.
3. **Minor. A corpus root of `/` rejected every file beneath it**, because `${realRoot}${sep}` is
   `//` and no absolute path starts with that. Now `relative(realRoot, realTarget)`, refusing only
   an absolute result or one starting `..`. **New fixture 96** asserts both halves.
4. **Minor. `postcheck` ran outside the abort race.** An abort during the corpus adapter's
   `realpath` pair would have waited for that work and returned a response. `postcheck` now goes
   through `raceAbort`, and `raceAbort` rejects immediately when the signal is already aborted.
   Left unasserted: a `realpath` pair completes in microseconds, so a fixture racing it would be
   timing-dependent, which AD-30 calls a defect rather than something to quarantine.
5. **Minor. An empty or repeated IPv6 zone suffix was accepted.** `fe80::1%` parsed as a valid
   link-local address, so a spelling no stack accepts matched an authorization naming the bare
   address. Both spellings now return `unparseable` and both are in fixture 16.
6. **Minor. Fixture 49 read the wall clock**, so a CI scheduling pause could fail it while
   `prompt-abort` was correct. The threshold is removed rather than replaced with fake timers: the
   subject's call never settles on its own, so the run settling at all is the evidence, and the
   fixture asserts the outcome's detail names the budget.
7. **Minor, taken differently. `safeMethods` is still not refined to a subset of `methods`.** AC 3
   records that decision: runtime configuration rather than a compiled artifact, no AD-5 code names
   the contradiction, and it joins the cross-field rules this repository states rather than
   encodes, matching `KeyedShapeDescriptor.permittedKeys`. The operational trap is real, so it is
   closed at the decision point instead: **`isSafeMethod` now requires membership in both lists**,
   so a differential can never select a method `evaluateTarget` goes on to deny. That makes AC 3's
   own claim that "the two never contradict at a decision point" true rather than asserted.
   Fixture 40 covers it.

**AC 14, measured on the post-#32 tree:** `check:layers` **73** files / 0 violations (72 expected;
see deviation 1), `check:schemas` 12, `check:ad5-registry` 21, `check:ad28-registry` 10,
`check:ad31-table` 19 contracts / 28 cells, `check:docs` 55, `check:shareable` 21, `npm run test`
**61 files / 2271 tests**. `check:layers` is 73 against a stated 72 (deviation 1). The test total is
2265 as the story predicts, plus six fixtures the two reviews required: 20a, 92, and 93 from the
peer code review, and 94, 95, and 96 from CodeRabbit. File count is unchanged at 61.

**Known gaps after review.** Findings 4 and 10 are fixed and unasserted: both are unreachable
through the shipped fixture server, one needing two authorizations for a single interface and the
other a redirect to a default port. Finding 9's `root -> root` cell is unconstructible. Fixture 75
is weaker than it looks; fixture 73 is what protects the `unknown` mechanism design.

### File List

**Added under `src/`:** `core/schemas/port-messages.ts`, `core/schemas/probe-policy.ts`,
`core/probe/target-policy.ts`, `ports/corpus-port.ts`, `ports/clock-port.ts`,
`ports/file-system-port.ts`, `ports/environment-probe-port.ts`, `adapters/port-boundary.ts`,
`adapters/node-file-system-adapter.ts`, `adapters/local-corpus-adapter.ts`,
`adapters/system-clock-adapter.ts`, `testing/conformance.ts`, `testing/probe-conformance.ts`,
`testing/index.ts`.

**Added under `tests/`:** `probe/target-policy.test.ts`, `testing/conformance.test.ts`,
`adapters/node-file-system-adapter.test.ts`, `adapters/local-corpus-adapter.test.ts`,
`adapters/system-clock-adapter.test.ts`, `adapters/probe-subject.ts` (helper),
`adapters/probe-subject.test.ts`.

**Edited:** `src/ports/port.ts` (header comment only), `scripts/dependency-direction.ts`,
`tests/architecture/dependency-direction.test.ts`, `package.json`, `README.md`,
`_bmad-output/shareable/`, `.github/workflows/pr-checks.yml`,
`_bmad-output/project-knowledge/learning-path-step-by-step.md`,
`_bmad-output/implementation-artifacts/sprint-status.yaml`.
