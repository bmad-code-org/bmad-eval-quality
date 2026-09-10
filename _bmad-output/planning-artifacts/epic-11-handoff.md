# Epic 11 handoff: close the fifth interface kind and make the promise true

Hand this to bmad's create-epic / create-story workflow in a fresh session against
`/Users/murat/opensource/bmad-eval-quality` at 1.4.2.

Epics 1 through 10 are done. This is Epic 11 and it is scoped to end.

Every file and line below was verified in the tree at 1.4.2.

---

## Why this epic exists

The documentation says eval-quality can be pointed at five system shapes, with a how-to guide each:

| shape | interface kind | works today |
|---|---|---|
| agent behavior | `cli` | yes |
| skill behavior | `cli` | yes |
| workflow behavior | `interactionPlan` over either kind | yes |
| end-to-end AI feature behavior | `api` | yes |
| **tool-use behavior** | **`mcp`** | **no** |

Four are true. The fifth is not: `compile` refuses `mcp`, so no contract over an MCP tool server
runs. `docs/index.md:72` says "Two interface kinds compile today" and the routing table at `:80`
carries the verdict "Declared and refused at compile", while the page frames the set as five guides
one per system shape.

That is the same defect class this project spent 9 September closing across six other sites: prose
that states what the schema will not accept. This epic closes the last one by building the feature
rather than by softening the sentence.

## Definition of done

Both halves, or the epic is not done.

1. A contract declaring an `mcp` interface compiles, seals, pre-flights, scores, and ships in the
   dev corpus, exercised by a real adapter, covered by a third conformance arm, and graded by AD-31
   in its own coverage file.
2. Every documentation page that describes what eval-quality can be pointed at is true without a
   qualifier, and the check that would have caught a stale claim actually runs.

## Explicitly out of scope

State this in the epic so it does not grow.

- **The `web` kind.** It stays refused, and AD-10's sentence stays true of it alone.
- **Proving the other four shapes with live runs.** Three guides note something unproven: no
  seeded-defect instance exists for a skill, step binding has no shipped end-to-end run, and no live
  AI feature has been evaluated. Those are evidence gaps rather than feature gaps, the library
  supports all three today, and they belong in their own epic.
- **The held-out probe corpus** and **the second experiment round**, both already recorded on the
  What Ships page, under *How far a strength number carries*, as limits on what a strength number
  means.

## One category that needs nothing, confirmed

The package boundary does not move. `src/index.ts` exports no interface kinds, no probe messages,
no adapters and no conformance runners; its header at `:14-20` grants it `root → application` and
`root → core-schemas` only. `McpProbeRequest`, `McpProbeObservation` and a third conformance arm
ride the existing `./conformance` subpath, and an MCP adapter rides `./adapters`. So `package.json`
and `tests/architecture/package-exports.test.ts:122-153` need no change. `website/src/content/docs`
is a symlink to `docs/` and `website/astro.config.mjs:120-142` autogenerates nav, so a new guide
needs no website change either.

---

## Story 11.1: Decide whether tool-use is one gap or two

**Settle this first, because it can shrink the epic.**

Two different things are called tool-use evaluation:

1. **Was my agent's tool use correct?** The system under test is your agent behind a command. If the
   runner writes the tool calls it made into a file, that file is an artifact a `CommandOperation`
   already declares (`src/core/schemas/interface.ts:239`), and an oracle can address it.
2. **Is this MCP server correct?** The system under test is the tool server. This needs the `mcp`
   kind.

Reading 1 may already work. If it does, the tool-use guide is rewritten around it, the `mcp` gap
narrows to the second reading, and the remaining stories may be deferrable.

**Acceptance:** a worked example, either compiling and scoring or demonstrably impossible, with the
evidence. Read `CommandOperation.artifacts`, and note that a defect signature cannot address a file
the command wrote, refused as `condition-artifact-channel-contract-local`, which is the constraint
most likely to decide it.

If reading 1 works, stop and re-scope before writing code.

---

## Story 11.2: Close the hole that would let a stale claim ship

**Do this before opening the kind, because it is the check that proves the epic finished.**

`docs/how-to/evaluate-tool-use-behavior.md:138` runs `node dist/cli/main.js compile --in
mcp-contract.json` and `:142` shows the `unsupported-interface-kind` rejection. The contract at
`:85-133` is a plain ` ```json ` fence rather than a `cat > … <<'EOF'` heredoc, and no
`<!-- expect-exit: N -->` is declared.

Under `scripts/check-doc-invocations.mjs:20-34` that makes the run UNFAITHFUL: the page named a file
only its reader has, so the check substitutes a stand-in and keeps the usage-error judgment only.
**Opening `mcp` will not fail `npm run validate`, and the false claim at `:142` ships silently.**

Fix: turn the contract fence into a heredoc so the file is real, and declare the expected exit. Only
two pages declare one today, `docs/how-to/author-behavioral-contracts.md:82` and
`docs/tutorials/getting-started.md:66`; follow their spelling.

**Acceptance:** `npm run check:doc-invocations` reports the run as faithful, and flipping the
expected code fails the check.

---

## Story 11.3: The response descriptor for an unstructured tool result

**This is the design decision. It shapes the schema, so it comes before the mechanical work.**

A real MCP tool result is `content: [{type: "text", text: "..."}]`, unstructured markdown.
`ResponseDescriptor` (`src/core/schemas/interface.ts:45-70`) carries `requiredKeys`,
`permittedKeys`, `types`, `successIndicator`, `channelRoles` and `collectionLocations`, and every one
is about a JSON body. AD-4's quantifiers need a JSON collection to range over, and a markdown string
is not one. `ARCHITECTURE-SPINE.md:656` records the consequence: "Bringing `mcp` into v0 remains
Deferred."

No field in the current shape closes the gap. This is why the kind was deferred rather than built.

**Acceptance:** an architecture decision recorded in `ARCHITECTURE-SPINE.md` in the register of the
existing ADs, naming the option chosen, the options turned down, and what each would have cost. It
has to answer what an oracle can assert about a markdown tool result and whether
`collectionLocations` means anything for one.

Candidates, none preferred:

- Declare the descriptor over the MCP envelope (`content`, `isError`) and treat each block's `text`
  as a scalar channel.
- Admit a parsed projection: the caller declares how markdown becomes JSON and the descriptor
  describes the projection.
- Restrict the kind's first version to tools returning structured content, and say so.

---

## Story 11.4: The operation shape for a tool call

`apiShapedInterface('mcp')` (`src/core/schemas/interface.ts:281-293`) gives `mcp` the HTTP-shaped
`Operation`, and four things about it are wrong for a tool call:

- `method` is required over the seven HTTP verbs. A tool call has no method.
- `pathTemplate` must carry the tool name, because every MCP call shares one transport identity,
  `tools/call`. Declaring two tools as `POST /tools/call` trips `duplicate-operation-signature`
  after parameter-name erasure, so the tool name has to move into the path, a spelling the kind
  ships no convention for.
- Three of the four request channels are dead. A tool call has arguments only.
- `responseDescriptor` is settled by Story 11.3.

Epic 9 solved the same problem for `cli` by giving the kind its own operation shape,
`CommandOperation`, rather than bending the HTTP one. Follow that precedent unless 11.3's decision
makes it wrong.

AD-40 resolves a defect signature by comparing method and path template
(`src/core/schemas/defect-signature.ts:154`), so whatever replaces them has to give AD-40 something
to bind against. `src/core/score/qualification.ts:759` refuses the kind for exactly this reason.

**Acceptance:** an `mcp` contract declaring two distinct tools parses, and the two do not collide
under the duplicate-signature check.

---

## Story 11.5: Compile and pre-flight admit an MCP interface

Three gates refuse the kind:

- `src/core/compile/interface-inventory.ts:31` — `SUPPORTED_INTERFACE_KINDS = ['api', 'cli']`,
  module-private and never exported, checked at `:36`. The only transcription of that literal
  outside `src/` is `docs/how-to/evaluate-tool-use-behavior.md:63`.
- `src/core/preflight/plan.ts:305` — `if (iface.kind !== 'api' && iface.kind !== 'cli')`, asserted
  again because a caller can assemble a plan by hand.
- `src/core/score/qualification.ts:759` — `signature-interface-kind-unsupported` when a probe's
  defect signature names the kind.

Also touched: `src/core/schemas/sensitivity-witness.ts:73`, whose comment names the two accepted
kinds and rejects the other two.

AD-10 closed the kinds and the same decision names the condition for opening one: probe semantics
are declared per interface kind, and a kind fails honestly under `unsupported-interface-kind` while
its semantics are undeclared. Stories 11.3 and 11.4 declare them. AD-10's sentence must stay true of
`web` afterwards.

**A consequence to state in the story.** `tests/application/preflight.test.ts:139` sets `kind =
'mcp'` deliberately, and its comment at `:136-138` explains why: a command interface compiles now,
so flipping to `cli` would be a parse failure rather than the structural one under test. Opening
`mcp` leaves `web` as the **only** remaining api-shaped mutation that can fire
`unsupported-interface-kind` end to end. That check's fireability becomes a one-kind margin, and the
epic should say so out loud rather than let the next reader discover it.

Also stale and worth fixing here: `tests/schemas/command-interface.test.ts:117` reads
`describe('the three kinds whose probe semantics are still undeclared')` while enumerating two. It
becomes one.

**Acceptance:** an `mcp` contract compiles and pre-flights. `web` still fails with the same code and
the same message.

---

## Story 11.6: The port messages and the adapter

`ProbeRequest` (`src/core/schemas/port-messages.ts:135`) and `ProbeObservation` (`:186`) are
discriminated unions over `api` and `cli` only. There is no message an MCP adapter could be handed
and none it could return.

Eight files under `src/` discriminate on the kind and stop compiling when a third branch lands. That
exhaustiveness is a feature; work through them as a checklist:

```
src/core/seal/plan-index.ts
src/core/score/qualification.ts
src/core/preflight/projection.ts
src/core/preflight/witness-evidence.ts
src/core/preflight/reduce.ts
src/core/preflight/plan.ts
src/testing/probe-conformance.ts
src/adapters/command-line-adapter.ts
```

Then the adapter. `src/adapters/command-line-adapter.ts` is the model and the most recent one added;
read it for the shape a third takes, including its deny-by-default target policy, its elapsed and
output bounds, and its rule that a non-zero exit is an observation rather than a fault. An MCP
adapter needs the equivalent decisions about what it may connect to and what bounds it enforces.
AD-35 applies: a contract names logical identifiers, never a URL, host or port, so an MCP server
address is configuration outside the contract.

What already works and needs no building: `Observation` in the sealed run record is not
discriminated on kind, and `ObservedCallInputs` is one object over both kinds' channels, so a
recorded tool call already has somewhere to live. `foreignChannels` in `qualification.ts` gives every
non-`cli` kind the API response channels, so a tool-use defect signature is confined to
`response-body`, `response-headers` and `response-status`.

**Test sites that move with this story:**

- `tests/preflight/reduce.test.ts:562-592` — fixture 129 pins the regex
  `/asked for a "api" probe and was answered with a "cli" observation/`. A third kind turns two
  mismatch pairs into six.
- `tests/testing/conformance.test.ts:483-501` and `:503-513` — the `probeRequest()` and
  `observation()` builders hard-return `kind:'api'`.
- `tests/testing/conformance.test.ts:524-539` — `breakEcho`'s kind branch hand-builds a whole `cli`
  observation, because a command observation carries stdout, stderr and an exit code instead of a
  status and headers.
- `tests/testing/conformance.test.ts:804` — `expect(detail).toMatch(/observed kind "cli"/)`.
- `tests/testing/conformance.test.ts:681-691` — per-arm counts pinned to 19.
- `tests/preflight/fixtures/probe-port.ts:35` — `echoPort()` hard-returns `kind:'api'`.

**Acceptance:** an MCP adapter passes the port conformance suite.

---

## Story 11.7: The third conformance arm, and grading the kind

`src/testing/` ships a conformance suite with one arm per kind. A third arm asserts for `mcp` what
the existing two assert for `api` and `cli`. Read both before writing it, since the arm defines what
any future adapter author has to satisfy. `package.json:81` constrains where new conformance tests
may live: `test:conformance` runs only `tests/adapters tests/testing tests/conformance`.

**The repository has a written precedent that a new kind gets graded in its own file, and it exists
because skipping it already cost a release.** `tests/coverage/coverage.test.ts` has a sibling
`tests/coverage/command-coverage.test.ts`, and that file's header records that "a whole interface
kind went ungraded while the suite stayed green", with three of the fourteen AD-31 predicates
answering "confidently and wrongly" for a full release.
`tests/coverage/fixtures/corpus.ts:548-553` states the rule: a new kind is graded in its own file
rather than through the AD-31 cell table. An `mcp` kind inherits that obligation.

The same one-file-per-kind pattern runs through the suite and implies a third file in each pair:

```
tests/preflight/plan.test.ts        ↔ tests/preflight/command-plan.test.ts
tests/adapters/probe-subject.ts     ↔ tests/adapters/command-probe-subject.ts
tests/adapters/probe-subject.test.ts ↔ tests/adapters/command-line-adapter.test.ts
tests/probe/target-policy.test.ts   ↔ tests/adapters/command-target-policy.test.ts
tests/coverage/coverage.test.ts     ↔ tests/coverage/command-coverage.test.ts
```

**Acceptance:** the suite runs three arms, the reference MCP adapter passes its own, and the AD-31
predicates are graded for `mcp` in a dedicated file.

---

## Story 11.8: The published surface, the corpus, and the census

Everything enumerating interface kinds needs its third entry. Regenerate through the `generate:`
scripts; never hand-edit a generated file.

**Schemas and census.** `npm run generate:schemas`, checked by `npm run check:schemas` (a script
rather than a test, because AD-30 forbids test filesystem I/O outside a temp dir). The frozen census
in `tests/schemas/published-census.ts` holds **six** pinned constants, not two:
`CENSUS_BY_DOCUMENT:20`, `CENSUS_BY_KEYWORD:36`, `CENSUS_TOTAL = 3023 :64`, `DEFS_BY_DOCUMENT:67`,
`REJECT_CASE_COUNTS:88`, `ACCEPT_FIXTURE_COUNTS:100` with `ACCEPT_FIXTURE_TOTAL` derived at
`:109-114`. Move each by reading the failure, following the procedure that file documents.

The census machinery that will fail: `tests/schemas/published/keyword-mutation.test.ts:119-144`
walks all 3023 mutable keyword occurrences across the twelve documents, deletes each one, and
requires the deletion to flip a verdict; `tests/schemas/published/published-rejection.test.ts:214-239`
is the union-branch census; `tests/schemas/publish.test.ts:62-66` and `:87-104` the document census;
`tests/schemas/published/differential.test.ts` the Zod-to-JSON-Schema equivalence.

**Fixtures.** `tests/schemas/fixtures/artifact-fixtures.ts:1109-1159` holds `UNION_BRANCH_FIXTURES`,
8 entries with two `cli`-only at `:1112-1117` and `:1136-1142`, going to 9 and moving
`ACCEPT_FIXTURE_COUNTS.unionBranches` 8→9 and `.distinctInstances` 22→23. `artifact-fixtures.ts:494`
notes the `cli` signature is "the only seed that reaches those keywords: a branch nothing exercises
is a branch AD-13's sweep reports as unprotected", so **an `mcp` signature branch needs its own seed
or the mutation sweep reports it unprotected**. `tests/schemas/fixtures/reject-cases.ts:134-146` and
`tests/schemas/fixtures/artifact-reject-cases.ts:1269-1278` carry `interface-kind-outside-the-four`
with constraint prose reading "the four".

**Dev corpus.** `tests/coverage/fixtures/corpus.ts:555-559` is `DEV_CORPUS_CONTRACTS`, the exact
slot a third exemplar takes. `tests/architecture/dev-corpus.test.ts:333` pins exactly 3 structural
failures. `scripts/dev-corpus-target.ts:106-113` is a README template with five spelled-out
numerals: "Twenty-one contracts and one compiled-and-sealed pair", "Nineteen are one per discipline
rule … and two describe a system under test that runs behind a command. Eighteen are published only
after … Three fail compilation by design." Mirrored byte-checked at `corpus/dev/README.md:3` and
`:9-12`. An `mcp` exemplar moves four of them, via `npm run generate:dev-corpus`.

**Worked example.** `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example/probe.json:35`
carries `"interfaceKind": "api"`, generated from `scripts/worked-example-target.ts:679` and pinned by
`npm run check:worked-example`.

**AD registries.** `check:ad5-registry`, `check:ad28-registry`, `check:ad21-table`,
`check:ad31-table`, `check:ad33-table`. Note that `scripts/check-ad5-registry.ts:96` parses the first
column only, so prose in later columns is checked by nothing; the already-stale "Fires when" text at
`ARCHITECTURE-SPINE.md:232` is an existing example and worth fixing while you are there.

**Acceptance:** `npm run validate` green, and `npm run docs:build` green separately, because validate
does not build the website.

---

## Story 11.9: The documentation says what is true

Last story, and the one that closes the epic. Story 11.2's fix is what makes this provable rather
than asserted.

- `docs/index.md:72` — "Two interface kinds compile today" becomes three.
- `docs/index.md:80` — the routing table's tool-use verdict stops reading "Declared and refused at
  compile".
- `docs/explanation/what-ships.md` — the tool-use section describes a shipped kind; its blocker list
  is gone.
- `docs/how-to/evaluate-tool-use-behavior.md` — rewritten from "what a first adopter would have to
  build" into a guide someone can follow, including `:63`'s transcription of the accepted kinds and
  the now-passing invocation at `:138`.
- `docs/reference/cli-commands.md:223` — "ships four reference adapters" becomes five. `:227` — "a
  second arm for `EnvironmentProbePort`'s two mechanisms" becomes a third and three. `:231` — corpus
  counts.
- `docs/how-to/author-behavioral-contracts.md:148` — "`kind` says which sort of interface it came
  from, `api` or `cli`" gains the third, and the six `{"kind":"api"}` observation lines at `:153-158`
  stay correct as examples.
- `docs/how-to/evaluate-ai-feature-behavior.md:234` — "Eighteen of the twenty-one contracts" moves
  with the corpus.
- `docs/reference/glossary.md` — anywhere listing which kinds compile.

The generated doc tables (`docs/ad21-*`, `ad31-*`, `ad33-*.generated.md`) contain no kind
enumerations and need nothing.

**Acceptance:** grep the docs for `unsupported-interface-kind` and for "refused at compile", and
confirm every surviving hit is about `web` alone.

---

## Standing constraints for every story

- **Prose the code contradicts is a defect.** Six were fixed on 9 September, including a published
  `.describe()` string. When a story changes behaviour, the same story fixes every sentence
  describing the old behaviour and says which ones it found.
- **Generated files are never hand-edited.** Contracts, probe corpora, schema documents, corpus
  READMEs and AD tables come from their generators, and the `check:` scripts prove it.
- **The package executes nothing.** No agent, judge or system under test runs inside it. An MCP
  adapter is a port implementation the caller drives.
- **AD-35 forbids more than a logical identifier.** No URL, host or port in a contract.
- **Every claim in a story needs a file and a line.** `epic-9-context.md` is the model for the
  register: each finding restated against the source in the tree.
- **Writing rules.** No em dash or spaced hyphen as a clause connector. No clause that exists only
  to be rejected. No hedging.

## Suggested story order

11.1 first, because it can shrink everything after it. 11.2 second, because it is the check that
proves the epic finished and it has to exist before the behaviour changes. Then 11.3, because the
design decision shapes the schema. Then 11.4 through 11.8 in order. 11.9 last.

## What this epic deliberately leaves for later

Say this out loud at the end so the next reader does not think it was missed.

- `web` stays refused, and `unsupported-interface-kind` fireability narrows to that one kind.
- The three unproven shapes stay unproven until an evidence epic runs them.
- The held-out probe corpus and the second experiment round stay owed.
