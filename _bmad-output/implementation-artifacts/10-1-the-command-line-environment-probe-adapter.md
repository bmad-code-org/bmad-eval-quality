---
title: 'The command-line environment-probe adapter'
type: 'feature'
created: '2026-09-08'
status: 'done'
review_loop_iteration: 0
context:
  - _bmad-output/implementation-artifacts/epic-10-context.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `EnvironmentProbePort`'s `cli` mechanism parses, seals, and runs through pre-flight, but
nothing can execute one. `probe-conformance.ts`'s own header comment records the exact shape of the
gap: `ProbeTargetPolicy` and `ProbeTargetAuthorization` are entirely HTTP-shaped, so AD-35's "an
adapter denies by default and permits only what that mapping names" has nothing to name for a
command target, and no adapter in `src/adapters/` implements the port at all, for either mechanism.
An adopter with a command-line system under test has the schema to describe it and no way to run a
pre-flight probe against it.

**Approach:** Add a `CommandTargetAuthorization`/`CommandTargetPolicy` pair beside the existing HTTP
ones in `core/schemas/probe-policy.ts` (additive; the HTTP shapes are untouched). Add a pure
evaluator, `evaluateCommandTarget`, that decides a `(interfaceId, executable, subcommandPath)` triple
against that policy the same way `evaluateTarget` decides an HTTP one — but living under
`src/adapters/`, not `core/probe/`, because the dependency-direction rule forbids `adapters/` from
importing `core/`. Add `createCommandLineAdapter`, a real `EnvironmentProbePort` implementation over
`node:child_process`, authorized by the policy before anything spawns. Add a second conformance
runner, `runCommandLineProbeConformance`, with its own subject type and its own nine assertions,
alongside the existing thirteen-assertion `api` arm.

## Boundaries & Constraints

**Always:**

- The adapter spawns with an argv array and `shell: false`. No channel value is ever concatenated
  into a shell string.
- A policy denial happens before any process spawns. The conformance suite pins `underlyingCalls() === 0`
  on every denial path.
- `maxElapsedMs` and `maxOutputBytes` are enforced by the adapter itself, not borrowed from the
  caller's `AbortSignal`, and both throw the shared `budget-exhausted` fault a cap already uses on
  the HTTP side.
- A non-zero exit is an observation, never a fault, mirroring AD-10's rule for an anomalous HTTP
  status.
- `evaluateCommandTarget` and everything that calls it lives under `src/adapters/`, never `core/`.
  `check:layers` enforces this mechanically.
- No source comment may contain any of `check:boundary`'s forbidden strings.

**Never:**

- No change to `ProbeTargetAuthorization`, `ProbeTargetPolicy`, `evaluateTarget`, or any other `api`-side
  shape. This story is additive only.
- No widening of `runEnvironmentProbePortConformance`'s own thirteen assertions or its outcome count.
- No spine amendment and no new ADR. Every ambiguity below is settled in this file.

## Decisions settled by construction

**Decision 1: "what's a command allowed to do" is a `(interfaceId, executable)`-keyed authorization,
not an `interfaceId`-keyed one.** `CommandInvocation` (the contract-side shape epic 9 shipped) is
declared per operation, not per interface: two operations under one CLI interface may name two
different logical executables, since AD-19 scopes the declaration at the operation. Keying the
authorization the same way the HTTP one is keyed (`interfaceId` alone) would let one entry's `target`
answer for every executable a busy interface names, which is not a mapping that names anything in
particular. So the authorization pairs `interfaceId` and `executable`, and everything else — the real
spawnable target, the permitted subcommand paths, the working directory, the per-artifact file paths,
and both caps — is shared across every subcommand of that pair, mirroring how host and port are
shared across an HTTP authorization's several methods. Downstream consequence: an adapter author
distinguishing two logical executables under one interface writes two authorization entries, not one
with a second field.

**Decision 2: subcommand authorization is an exact-match allowlist over whole paths, not a prefix or
a glob.** `permittedSubcommandPaths` is compared literally, segment by segment, the same way AD-40
already compares a command's transport identity. A prefix match was considered and turned down: it
would let an authorization for `['remote']` silently also permit `['remote', 'add', '--force']`,
which is exactly the escalation a denies-by-default mapping exists to prevent. An empty inner array
is legal and authorizes invoking the executable with no subcommand at all, which is the same
base case `methods` gets on the HTTP side by simply listing one method.

**Decision 3: no restriction on which environment keys, argument keys, or option keys an authorized
invocation may carry.** The HTTP authorization does not restrict which header keys a request may
send either; only the method is authorization-scoped, and everything else is scoped by the contract's
own declared request shape, checked at compile time. The command side follows the same division:
`argument`, `option`, `environment`, and `stdin` are the contract author's declaration to police, and
AD-18 already forbids a credential value in the environment channel at compile time. Adding a second,
adapter-level key allowlist would duplicate a check the compiler already owns and would not name
anything the contract's own declaration does not already name.

**Decision 4: argv construction is adapter-owned and documented, not left to a caller-supplied
builder.** `argument` and `option` are records, not ordered sequences, so *something* has to decide
an order and a stringification rule before a process can be spawned. The adapter builds it: options
first as `--{key}`, a boolean `true` as a bare flag, `false` omitted, anything else one value token
via `String()` for a scalar or `JSON.stringify()` otherwise; positionals after, in the record's own
key order. This is recorded here because it is the one place a wrong choice would be invisible in the
type system — any stringification rule typechecks — and `buildArgv`'s own unit test and the
conformance suite's `argument-passed-literally` assertion are what make it externally checkable
rather than merely documented.

**Decision 5: `environment` passes through as declared, plus the host process's own `PATH`.** A
command's declared environment channel is the contract author's complete, checked input — but a
`target` naming a bare command (rather than an absolute path) needs `PATH` to resolve at all, and
that is adapter plumbing, not contract content. So the adapter's base environment is `{ PATH: process.env.PATH }`,
overridden by whatever the declared channel supplies; a contract that declares its own `PATH` key
wins, since it was explicit about it. No other host environment variable leaks through.

**Decision 6: artifact identifiers resolve through the authorization, not the request.**
`CommandProbeObservation.artifacts` is a required, fully-keyed record, but `CommandProbeRequest`
carries no field naming which artifact identifiers apply to a given run — that information lives on
the operation's own `artifacts` declaration, which the adapter never sees (it sees only the resolved
`interfaceId`/`executable`/`subcommandPath`/channels). So the authorization itself carries an
`artifacts: Record<Identifier, string>` map, the same disclosure boundary AD-35 already draws around
`target`: an identifier this map does not name can never appear populated in an observation, and one
a particular run did not write resolves `absent` rather than a missing key, exactly as the schema
requires. Downstream consequence: an adapter author wiring a real contract has to keep this map in
step with the operations they authorize, the same obligation they already have for `target` and
`permittedSubcommandPaths`.

**Decision 7: `maxOutputBytes` is one number applied independently to stdout, to stderr, and to each
artifact file, not three separate caps.** The HTTP side already splits `maxRequestBytes` from
`maxResponseBytes` because a request and a response are different things sent in different
directions; stdout, stderr, and an artifact file are three instances of the same thing — output the
process produced — so one number applied per-channel is the simpler rule and there is no asymmetry
between them to name a second field for.

**Decision 8: the evaluator lives under `src/adapters/`, not beside the HTTP one under
`core/probe/`.** Discovered against the built tree rather than assumed: the dependency-direction
check failed the first draft, which had put `evaluateCommandTarget` under `core/probe/` to mirror
`target-policy.ts` exactly. `adapters/` may import `core/schemas` but not `core/`, and the HTTP
evaluator is consequently never imported by any shipped adapter either — only by the in-repository
test subject, which sits outside `src/` and outside the rule. Moving the command evaluator into
`src/adapters/command-target-policy.ts` (a same-layer, same-directory import from the adapter) is
what makes it possible to ship a real, working adapter at all rather than a second unreachable
reference implementation.

## Verification

**Commands:**

- `npm run typecheck` -- exit 0.
- `npx vitest run tests/probe tests/adapters` -- green, real child-process integration tests included
  (timeout, output cap, injection safety, artifact capture, environment pass-through, stdin, a
  non-zero exit).
- `npm run test:conformance` -- green; the new `command-probe` report is 15/15.
- `npm run check:layers` -- exit 0, 0 violations.
- `npm run check:boundary` -- exit 0, 0 violations.
- `npm run validate` -- exit 0 with no output on stderr; `test:coverage`'s `src/core/**` floor holds
  at 90/90 unaffected, since none of this story's code lives under `core/`.

## Built, and where it diverged

Built as designed; the one divergence from the first draft is Decision 8 (the evaluator's location),
found by running `check:layers` rather than assumed in advance. `docs/reference/cli-commands.md`,
`README.md`, and `docs/explanation/roadmap.md` are corrected in the same change: each stated a count
("three reference adapters", "no reference `EnvironmentProbePort`") that this story makes untrue, and
`_bmad-output/shareable/eval-quality-readme.html` is regenerated to match.

