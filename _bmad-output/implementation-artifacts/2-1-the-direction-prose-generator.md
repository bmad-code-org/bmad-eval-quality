---
epic: 2
story: 1
key: 2-1-the-direction-prose-generator
baseline_commit: 267bb03c7abb7e299503d8e93107d2f08694ca19
---

# Story 2.1: The direction-prose generator

Status: done

## Story

As a sealed evaluator,
I want directions generated from declared structure using non-imperative, non-sequential templates,
so that I receive the oracle content that produced the measured effect without receiving a script.

## Acceptance Criteria

### AC 1 — Module location, pure-function contract, and what this story does not build

A new `src/core/seal/` directory, pure and deterministic per AD-1: no filesystem, network, clock,
subprocess, or randomness, and it imports `core/schemas` only. This is the first code under
`core/seal/`; the Structural Seed names the directory but nothing has populated it yet.

This story builds the **direction-prose generator alone** — the piece that turns one oracle's
`Direction` (`src/core/schemas/oracle.ts`) into the `text` of one `BriefDirection`
(`src/core/schemas/sealed-evaluator-brief.ts`). It does **not** build:

- the `seal(contract): SealedEvaluatorBrief` orchestrating function that walks every oracle, assembles
  `behaviors`, `permittedInterfaces`, `scopedResources`, `budgets`, `safetyLimits`, `probeStepBound`,
  `contractDigest` and the lineage fields onto the brief (the full field list is
  `sealed-evaluator-brief.ts`'s own), and sorts unordered arrays into canonical order — that is
  Story 2.2 (brief assembly, exclusions, and canonical ordering);
- the emitted-brief scripting audit — that is Story 2.3, which also mints the AD-5 code for it;
- anything from `core/compile/` — no schema-validity check, no `oracle-missing-channel`, no
  `direction-check-misaligned`, no `unreachable-check-evidence`. Those are compile-time checks and
  belong to Epic 4 (Story 4.1 owns the addressing-grammar resolver; Story 4.2 owns the AD-5 registry
  as code). Epics are sequenced so no story depends on a later epic's output (epics.md, Requirements
  Inventory), so this story must not import or assume anything Epic 4 has not built yet.

**Must not** (epics.md, Epic 2's standing prohibition, applies to every story in the epic): call a
model, execute an evaluator, expose a contract step identifier on any rendered string, or copy the
throwaway Gate D generator into the package. The Gate D generator was explicitly disposable spike
code (`HANDOFF-GATE-CD.md`: "throwaway code throughout... nothing in the spike commits the package to
a schema"); only its *inputs and outputs* are load-bearing, as AC 3 below uses them.

Exported shape, or an equivalent split — the two responsibilities (resolving a pointer to its step and
operation, and rendering prose from a `Direction`) must stay in separate, independently testable pure
functions:

```ts
// src/core/seal/plan-index.ts
import type { InteractionStep } from '../schemas/plan.ts'
import type { Operation, PermittedInterface } from '../schemas/interface.ts'
import type { EvidenceChannelName, TransportChannelName } from '../schemas/pointer.ts'

export type EvidenceTarget = {
  stepId: string
  channel: EvidenceChannelName
  transportChannel: TransportChannelName | null // non-null exactly when channel is 'call-inputs'
  tail: readonly string[] // decoded RFC 6901 tokens; empty on a scalar channel
}

export type PlanIndex = {
  stepOf: (stepId: string) => InteractionStep | undefined
  operationOf: (operationId: string) => Operation | undefined
  // The shipped type carries a third member, `stepsUsing`, that this sketch
  // does not: AC 2's escalation rule needs every step sharing an operation,
  // not just single-id lookups. See the Dev Agent Record's Completion Notes
  // for why that is an in-scope "equivalent split" rather than a deviation.
}

export function parseEvidenceTarget(pointer: string): EvidenceTarget

export function buildPlanIndex(
  interactionPlan: readonly InteractionStep[],
  permittedInterfaces: readonly PermittedInterface[],
): PlanIndex

// src/core/seal/direction-prose.ts
import type { Direction } from '../schemas/oracle.ts'
import type { PlanIndex } from './plan-index.ts'

export function renderDirectionText(direction: Direction, index: PlanIndex): string
```

**Four of those type imports do not exist yet, and adding them is this story's one `core/schemas/`
edit.** Verified against the tree: `grep '^export type' src/core/schemas/*.ts` returns `Polarity`,
`Relation`, `KeyedShapeDescriptor`, `EvidenceChannelName`, `TransportChannelName`, `EvalContract` and
the other artifact-level aliases, and none of `Direction`, `InteractionStep`, `Operation`, or
`PermittedInterface`. A Zod schema is declared as a `const`, so it is a value and not a type, and
`import type { InteractionStep } from '../schemas/plan.ts'` fails the typecheck exactly as written
above. Add the four as `export type X = z.infer<typeof X>` beside their own schemas, following the
`Polarity`/`Relation`/`KeyedShapeDescriptor` precedent for sub-artifact shapes that a consumer
outside the file needs to name. The aliases are type-level only: they emit no runtime byte, carry no
`.meta({ id })`, and change nothing `generate:schemas` reads, so `check:schemas`, `check:shareable`
and Story 1.5's drift check all stay green. Deriving the types locally inside `core/seal/` instead is
the alternative and is rejected: it mints a second spelling of a shape in a second directory, which
is the drift the spell-it-once convention exists to stop.

`renderDirectionText` takes `Direction` non-nullable. `Oracle.direction` is nullable on the schema
because `oracle-missing-channel` fires on `null` at compile time (`oracle.ts`'s own comment: "`null` is
half of what `oracle-missing-channel` fires on, so it must parse"); a contract that reached `seal`
already compiled, so no oracle in it has a null direction. Story 2.2's `seal()` narrows the type at
that boundary (e.g. filtering or asserting non-null before calling this function) rather than this
story re-deriving a check that belongs to `compile`.

### AC 2 — The derived-reference vocabulary: a pointer resolves to a phrase, never to a step id

AD-16 fixes the shape: `seal` renders each evidence target "as a descriptive reference derived from
the step's operation and selection predicate... never as the identifier itself. The mapping from step
to phrase is one-way." AD-16's own worked example: *"the response you obtained when you sent an
invalid identifier."*

Given one `InteractionPointer` string from a direction's `evidenceTargets` (matches
`INTERACTION_POINTER_PATTERN` in `src/core/schemas/pointer.ts`, always of the form
`/interactions/{stepId}/{channel}...`):

1. **Extract the step id *and the channel* locally**, as the `EvidenceTarget` of AC 1. Write a small
   regex capture against the pointer's own charset (`IDENTIFIER_CHARSET_SOURCE`, exported from
   `src/core/schemas/primitives.ts` — reuse it, do not respell the identifier charset) and against the
   schema's own channel partition (`TAIL_BEARING_CHANNELS`, `SCALAR_CHANNELS`, `TRANSPORT_ROOTED_CHANNEL`,
   and `TRANSPORT_CHANNELS`, all exported from `src/core/schemas/pointer.ts` — likewise imported, not
   respelled), mirroring `INTERACTION_POINTER_PATTERN`'s own three-branch structure rather than one flat
   alternation over the seven channels: a flatter grammar let a tail through on a scalar channel, which
   the schema rejects and this parser must reject too (a code-review finding, fixed by matching the
   schema's own partition exactly; see the note on `parseEvidenceTarget` in the Dev Agent Record).
   **The channel is not optional detail: it is what decides whether the phrase says
   "the response you obtained" or "the value you sent".** AD-3 names the direction's targets as "the
   channels and steps at issue", and the repository's own hand-authored contract proves the point —
   `gateCContract`'s O-001 pairs `/interactions/poll/response-body/submittedFilters` with
   `/interactions/submit/call-inputs/body/filters`, and a renderer that reads only the step id
   produces two phrases that cannot be told apart on the axis the oracle is actually about. This is
   still deliberately narrower than a general addressing-grammar resolver: it answers "which step,
   which channel, which key does this pointer name", and nothing about reachability, channel typing,
   or `absent` resolution, all of which are `compile`'s and `score`'s (Epic 4 / Epic 3), not
   `seal`'s.
2. **Resolve the step and its operation** through `PlanIndex` (AC 1).
3. **Render a phrase** from three inputs, in this precedence:
   - **the operation's identity.** A humanized form of `operationId` is the reference, e.g.
     `search-capsules` → "the search capsules endpoint". `method` and `pathTemplate` are never printed
     anywhere in this module, not even under escalation: AD-16 withholds the operation inventory from
     the brief on purpose ("shipping the inventory here would hand the evaluator the action list AD-39
     keeps from it"), and the Gate D accept prose names neither a method nor a path, only "the
     search/filter endpoint". An earlier draft of this story let the escalation ladder consult them as
     a fourth, last-resort rung; that rung is removed (Decision 14) because it is computed purely from
     the shared `operation` and is therefore identical for every sibling colliding on that operation,
     adding no disambiguating power a `method`/`pathTemplate`-free ladder does not already have.
   - **the channel** from step 1: the tail-bearing response channels render as something obtained,
     `call-inputs` plus its transport channel renders as something sent, and the scalar channels
     (`response-status`, `exit-code`) render as the status or code of that call. Where the pointer
     carries an RFC 6901 tail, the last token names the field at issue ("its `submittedFilters`
     field"), because without it O-001's two targets and O-003's three targets on one step collapse
     into one repeated phrase.
   - **the step's `inputBinding`** (`src/core/schemas/plan.ts`): a channel whose value is
     `{ matcher: 'type-violating' }` renders as something naming the input as malformed (AD-16's own
     "an invalid identifier" is exactly this case, and `gateCContract`'s `malformed-submit` step is
     that case in the repository); a channel whose value is `{ matcher: 'any' }` renders generically
     ("with the supplied {parameter}"); a `{ literal: ... }` binding names the parameter and, by
     default, not the literal value verbatim, since the point is a descriptive reference rather than
     a transcript. **Every declared binding key escalates together, not only "the discriminating
     one"** (Decision 15): narrowing to just whichever key would disambiguate a collision would make
     the amount of detail shown for one step depend on what other steps happen to collide with it
     elsewhere, and disclosing one already-named step's own bound parameter names is not the operation
     inventory AD-16 withholds (that withholding is about which other calls exist, not what fields the
     one call under discussion carries). **All four channels `null` is a legal and common step** — five
     of the six steps in `gateCContract` and both steps in `populatedContract` leave at least one
     channel `null`, and a step binding nothing at all must still render, so the binding clause is
     omitted rather than rendered empty.

**Two steps one direction references never render to the same phrase.** (An earlier draft of this
story said "a brief references" here, which is the plan-wide reading Decision 13 explicitly rejects;
corrected to match the escalation rule below and AD-16's own cited rationale.) This is the ambiguity
AD-16 exists to remove ("a direction over two observations of one operation could not say which is
which"), and the default rendering above does not achieve it on the repository's own contract: `poll`
and `unknown-job-read` both name operation `get-export` and differ only in `jobId`, `{ matcher: 'any'
}` against `{ literal: 'job-does-not-exist' }`, so both collapse to "the get export call with the
supplied jobId" if a direction ever named them together. The renderer therefore escalates, in this
fixed order, until the phrases for the steps *this direction's own resolved evidence targets*
reference, and that share the operation in question, are distinct: (a) the generic form above; (b) the
discriminating binding kind — supplied, malformed, or a stated one, applied to every declared key
together per Decision 15; (c) the literal value itself, which the contract already fixes and which
therefore prescribes nothing the declaration had not. Escalation is computed from the declared
structure alone, so it stays deterministic. A test asserts the phrase map over `gateCContract`'s six
steps is injective when each step is explicitly checked against every step sharing its own operation
— the escalation mechanism's own capability — while production calls scope the check to direction (b)
below, and a second test asserts the narrower, direction-scoped production behavior directly: two
colliding steps that are never named by the same direction in `gateCContract` never actually escalate
against each other, since neither call ever puts both in scope.

**Distinctness is required only among the steps one direction actually names, not plan-wide (Decision
13).** AD-16's own cited rationale for the derived-reference vocabulary is "a direction over two
observations of one operation could not say which is which" — scoped to one direction throughout.
Checking a step's phrase against every other step in the whole plan sharing its operation, regardless
of whether any direction ever names them together, would reject a perfectly renderable direction over
an unrelated collision it never mentions, an action-at-a-distance failure mode that gets worse as the
plan grows. This is a narrowing from an earlier draft, which computed distinctness over the full
`PlanIndex.stepsUsing(operationId)` sibling set; that draft's own Completion Notes called the
plan-wide property "strictly stronger, so it's fine," which is wrong; it is stronger for distinctness
but weaker for availability, rejecting directions the direction-scoped rule renders cleanly.

**A fourth rung, computed from `method` and `pathTemplate`, was tried and removed (Decision 14).** It
is read off the shared `operation`, so two siblings colliding on that operation render an *identical*
description from it. Mutation testing confirmed it adds zero disambiguating power beyond rung (c):
deleting the function that built it, or replacing it with a constant, was undetectable by any test. If
two siblings still render identically once rung (c) has been tried, within the direction-scoped set
above, that is an irreducible collision the declared structure does not distinguish, and this fails
loud as a precondition-violation `TypeError` (the same class `buildPlanIndex` throws on a duplicate
`stepId`) rather than silently returning a phrase two different steps would share. See Decision 12,
whose reasoning is otherwise unchanged by narrowing the ladder to three rungs.

**Unresolvable input is a should-never-happen precondition violation, not a coded fault.** Because
`compile`'s reachability enforcement (`unreachable-check-evidence`) is Epic 4's and does not exist yet,
nothing upstream of this story can guarantee every `evidenceTargets` pointer resolves against the
given plan. If `stepOf` or `operationOf` fails to resolve, throw a `TypeError` carrying a descriptive
message. **Not** a `RuntimeFault` (`src/core/schemas/faults.ts`): the Errors convention reserves that
class for a code from AD-28's registry, none of the nine fit "an evidence target names a step this
plan does not declare", and AD-28's own audit rule makes minting a tenth an amendment to that AD and
out of this story's scope. The precedent is in the tree and is followed rather than re-invented —
`src/core/canonical/digest.ts` throws `TypeError` for exactly this class of caller-side precondition
violation ("composite requires at least one field"), and `src/core/schemas/publish.ts` throws a plain
`Error` for an unresolvable constraint address. Record it as a documented gap a later story inherits
once `compile`'s enforcement exists (see Decisions).

**`buildPlanIndex` declares a collision policy, because the schemas deliberately admit collisions.**
`EvalContract.interactionPlan` carries no uniqueness refinement on `stepId`, and
`PermittedInterface.operations` declines one on purpose in its own description ("No uniqueness
constraint: two operations colliding on method plus path template after parameter-name erasure is
`duplicate-operation-signature`, a coded compile-time error, and a schema that deduped them would
delete it"); nothing dedupes `operationId` across two interfaces either. A first-wins or last-wins
index would make this story's output depend on array order, which breaks the byte-identity-under-
reordering property of AC 5 silently. So a duplicate `stepId`, or a duplicate `operationId` across the
given interfaces, throws the same `TypeError` precondition violation at index-build time rather than
resolving to either winner. Both cases get a test.

### AC 3 — The relation-keyed template, and the Gate D accept fixture

`Direction.relation` is one value from `RELATION_VOCABULARY` (`src/core/schemas/expression.ts`, all
sixteen: eleven operators, three connectives, two quantifiers). The generator must render **every**
one of the sixteen without throwing — a relation value that crashes the generator is exactly the kind
of vague, incomplete implementation this template exists to prevent.

**The connectives get their own family, and `not` gets its own skeleton, because a generic fallback
over them is measurably the wrong shape.** Counted in the tree: `gateCContract`'s eight oracles
declare `all` four times, `for-all` twice, `not` once, and `deep-equality` once — and
`expression.ts`'s own comment records the same census as the reason `RELATION_VOCABULARY` is all
sixteen rather than the eleven operators. A fallback family absorbing the connectives would render
five of those eight, 62 percent of the only hand-authored contract this repository has, as
undifferentiated prose. Worse, `not` inverts the claim: rendering it through a shared "the declared
condition holds" skeleton tells the sealed evaluator the **opposite** of what the direction declares,
which is a correctness defect in the load-bearing artifact rather than a wording weakness.

So the families are:

- **quantifiers** — `for-all`, `for-any`: universal versus existential framing, distinguished from
  each other.
- **connectives** — `all` (every declared condition together), `any` (at least one; deliberately
  weaker than logical disjunction per AD-4), `not` (an explicitly negating skeleton, never the
  affirmative one).
- **presence** — `existence`, `absence`.
- **comparison** — `equality`, `deep-equality`, `containment`.
- **the remaining five structural operators** — `regex`, `set-membership`, `ordering`,
  `count-tolerance`, `shape`, `covers-by-key` — which may share one skeleton parameterised by the
  relation's own name, so the rendered text still says which relation is asserted.

Each family gets one skeleton combining, in a fixed non-imperative order: the rendered
evidence-target reference(s) (AC 2), the relation's family-appropriate verb phrase, `polarity`, and
the author-written `scope` and `negativeDomain` strings. **Exact wording is pinned for four of the
five families, by two different means, stated accurately rather than lumped together as one claim.**
Quantifier and comparison wording is pinned by the Gate D and temporal fixtures below. Connective
wording is pinned by the `gateCContract` sweep in AC 5, which carries `all` four times and `not` once
across its eight oracles. **Presence is not**, because `gateCContract`'s eight oracles declare no
`existence` or `absence` relation at all (counted in the tree: `all` four, `for-all` two, `not` one,
`deep-equality` one) — presence's exact wording is pinned instead by a dedicated unit test asserting
both `existence` and `absence` directly, distinct from each other and from every other family. The
structural family needs only non-empty, non-throwing, deterministic output, asserted by iterating all
sixteen `RELATION_VOCABULARY` members. `BriefDirection.text` is `z.string().min(1)`, so "non-empty" is
a schema requirement of the artifact this string becomes, not a convention.

**What "non-imperative" prohibits, stated because the named accept fixture would fail a literal
reading of it.** The Gate D Arm 2 prose the epic calls an accept fixture reads "Evaluate the
search/filter endpoint's response body. Establish that... Treat any returned capsule... as a material
defect" — three imperative-mood verbs. The prohibition AD-5, AD-16 and AD-39 actually carry is against
a **prescribed action sequence**: an enumerated path, a step list, or ordering language that tells the
evaluator what to do in what order. Grammatical mood is not the test, and the criterion is not read as
banning it. What is banned in generator-composed text is the ordering vocabulary AC 4 enumerates, any
enumeration of calls to make, and any rendering that reconstructs the operation inventory AD-16
withholds from the brief.

`scope` and `negativeDomain` are author-written, evaluator-facing free text on the already-shipped
`Direction` schema (`oracle.ts`: both are `z.string().nullable()`, "Evaluator-facing, and exempt from
the alignment predicate"). Both are **nullable**, and a `null` on either drops its clause rather than
rendering the word "null" or an empty sentence; `gateCContract` and `populatedContract` both populate
them, so the `null` case needs its own authored fixture. **The generator's own words never touch the
author's words**, which is the property that actually matters and is what "verbatim" was reaching for
in the original draft — but calling the result literally "verbatim" overclaims, because every clause
(the author's and the generator's alike) is lightly shaped into one standalone sentence: trimmed,
capitalized at its leading letter, and given exactly one terminal punctuation mark. Corrected here
after a code-review finding that the literal claim produced a real bug: without stripping an
author-supplied trailing terminator before appending the generator's own framing suffix onto
`negativeDomain`, the rendered text read "...did not return. is treated as a defect." — a mid-sentence
period followed by a lowercase clause, on every one of `gateCContract`'s own `negativeDomain` strings,
none of which the loose `toContain` assertion in place at the time caught. Splitting, reordering, or
rewriting interior words never happens; only the sentence-boundary shaping above does.

That verbatim rule is taken against three sources that name `negativeDomain` specifically, so it is
recorded here rather than left to be discovered. AD-16: "A direction's negative domain is emitted as
an unordered set, never as an enumeration in declaration order. The brief is byte-identical under
reordering, achieved by sorting rendered members by canonical form before emission." `oracle.ts`'s own
field description: "`seal` renders it as an unordered set so the brief is byte-identical under
reordering." epics.md Story 2.2 and EPIC-BRIEF Epic 2: "negative-domain members and every semantically
unordered declaration render in canonical sorted order." **None of the three is satisfiable as a
sorting operation against the shape Story 1.3 shipped**, because `negativeDomain` is one
`z.string().nullable()` and a single string has exactly one member and no ordering to vary — the
byte-identity property holds vacuously. Verbatim pass-through is therefore correct today and is not a
deferral; see Decision 2 for the choice this hands Story 2.2, which is where the sorting language
lives.

**The Gate D accept fixture.** `reviews/gate-d/PREREGISTRATION.md`'s Arm 2 is the epic's named accept
fixture ("the Gate D generated-current-fields prose passes as an accept fixture"). Its declared
direction and generated prose:

```
evidence targets: the filter request and returned capsule collection
relation: every returned capsule satisfies the supplied query    (i.e. relation = 'for-all')
polarity: expects-hold
scope: one search/filter endpoint response
negative domain: a returned capsule that does not satisfy the supplied query
```
> Evaluate the search/filter endpoint's response body. Establish that every returned capsule satisfies
> the supplied query and that non-matching capsules are excluded. Treat any returned capsule that does
> not satisfy the supplied query as a material defect.

That informal spike sketch predates the finalized `Direction` schema (both landed 2026-07-29 to
2026-08-20; the spike's "relation" field is prose, not one of the sixteen enum values) and is
disposable per Epic 2's own prohibition, so this is **not** a byte-identical golden string to
reproduce. Author a schema-valid `Direction` + a small interaction-plan/operation fixture that
reconstructs the Arm 2 scenario (a `for-all` relation over a collection-typed response, with
`negativeDomain` set to the string above), run `renderDirectionText` over it, and assert the output is
**content-equivalent**: it names the operation via the derived-reference vocabulary, states the
universal-quantification framing implied by `for-all`, and carries the `negativeDomain` text framing a
non-matching element as a defect. Assert by substring/structure checks against these three properties,
not by exact-string equality against the historical prose.

The spike's sixth declared line, omitted from the quotation above because this story does not render
it, is `check`: "for every returned capsule, all supplied filters hold". It is quoted here only so the
reconstruction's `check` can be authored consistently with its direction if a full `EvalContract`
slice is used; alignment between the two is `direction-check-misaligned`, which is Epic 4's.

### AC 4 — The temporal read-back collision

AD-39/AD-16's still-open item, moved into `seal`'s acceptance criteria by Gate D rather than left a
pre-epic gate: when a direction's `evidenceTargets` span two steps in an `after` relationship (one
step's `inputBinding`-bearing call and a later step whose `after` names it — the read-after-write
shape AD-39 exists for), rendering **each** target independently with AC 2's phrase and concatenating
them risks disclosing which step came first, which is the ordering AD-16 forbids exposing.

**Preferred outcome — a relational dependency phrase.** When two evidence targets belong to an
`after`-linked pair, render **one** relational phrase naming what must be compared (e.g. the value sent
on the earlier step's `call-inputs` against the value observed on the later step's `response-body`)
without sequencing language. Do not use "first", "then", "before", "after", "subsequently", or
equivalent ordering words in generator-composed text (author-written `scope`/`negativeDomain` are
passed through, lightly shaped per AC 3's correction above, and are not subject to this check — that is
an authoring-discipline concern, not this generator's).

**The relational phrase's fixed sent-then-obtained print order is this AC's own prescribed shape, not
an incidental ordering leak (Decision 16).** A second review pass flagged that the phrase always prints
the `call-inputs` ("sent") side first, which for a read-after-write pair happens to be the temporally
earlier step, and asked whether that is itself readable as sequencing information. It is not, for two
reasons stated here rather than left implicit. First, this AC's own preferred-outcome text above already
prescribes exactly this shape: "the value sent on the earlier step's `call-inputs` against the value
observed on the later step's `response-body`" names sent-then-obtained as the sentence order directly.
Second, it does not generalize into a channel a reader could use to infer step order without already
knowing the plan graph: for the reverse pairing shape (an earlier step's output feeding a later step's
input), the same sent-first rule prints the *later* step first, so which phrase prints first does not
consistently track which step actually came first across the two shapes — a reader cannot decode
temporal order from print position alone, and no sequencing word is ever used either way. No fallback
branch is needed for this; it is a property of the preferred outcome as specified, not a defect in it.

**The repository already carries this exact case; start there rather than inventing one.**
`tests/schemas/fixtures/gate-c-contract.ts`, oracle O-001, declares
`evidenceTargets: ['/interactions/poll/response-body/submittedFilters',
'/interactions/submit/call-inputs/body/filters']` with `relation: 'deep-equality'`, against a plan in
which `poll.after === 'submit'`. That is the read-after-write collision in the hand-authored contract
AD-26 and AD-3 argue from, complete with the two channels that make it a collision at all. Note also
that its two targets are declared **later-step first**: a renderer concatenating in declaration order
both discloses an order and produces different bytes when the array is permuted, which is the AC 5
property this AC has to be solved consistently with.

Author additional adversarial fixtures around it — at minimum a create-then-read-back pair comparing
the same field, e.g. `/interactions/create/call-inputs/body/title` against
`/interactions/read-back/response-body/title` with `relation: 'equality'` and `read-back.after ===
'create'`, and a pair where both targets sit on the *same* step (`gateCContract` O-002 is that shape:
`/interactions/poll/response-status` and `/interactions/poll/response-body/state`, no temporal
relationship, which must **not** take the relational-phrase branch). Try the relational-phrase
approach against all of them.

**Fallback — only if the relational phrase demonstrably fails.** If no relational-phrase candidate
survives the authored adversarial fixtures (not "this one case was harder," but the approach fails
outright), take the branch AD-16 itself names: render a bounded ordering disclosure instead, and make
the minimal edit AD-39's rule requires — a targeted, sentence-level correction to the sentence
"**Whether that holds for a temporal pair is open, not settled**", which sits mid-paragraph in AD-39's
"Three consequences follow and each is enforced" passage in `ARCHITECTURE-SPINE.md` — recording which
outcome occurred and why. Both `npm run check:docs` and `npm run lint:spine` read that file and are
already in `validate`, so the edit is gated; `check:docs` rejects trailing whitespace and repeated
blank lines, and `lint:spine` runs at `--fail-on high`. This is a small, in-place edit to an already-open paragraph,
not a new spine revision — consistent with this project's standing default of settling a decision
where the work happens rather than opening a review round for it. Record the outcome either way in the
Dev Agent Record; do not leave the choice silent in a template, which is the exact failure this AC
exists to prevent.

### AC 5 — Fixtures, tests, and the gate

- Tests live at `tests/seal/`, mirroring `src/core/seal/` the way `tests/canonical/` mirrors
  `src/core/canonical/` (the established convention — see `tests/canonical/*.test.ts`).
- **`gateCContract` (`tests/schemas/fixtures/gate-c-contract.ts`) is the primary fixture, and it is
  already in the tree.** It is the hand-authored contract AD-26 and AD-3 argue from, and it carries,
  without a line being written: eight directions spanning `all`, `for-all`, `not` and `deep-equality`;
  directions with one, two and three evidence targets; two targets on one step (O-002, O-003); the
  temporal read-back pair (O-001 over `poll.after === 'submit'`); AD-16's malformed-input worked
  example (O-007 over the `malformed-submit` step, whose `filters` binding is
  `{ matcher: 'type-violating' }`); the sibling cross-check over two operations given the same literal
  (O-008); scalar `response-status` targets, tail-bearing `response-body` targets, and a
  `call-inputs/body/...` target; six steps of which three pairs share an `operationId`; and every
  `BindingValue` shape including `null` channels. A **sweep test renders all eight of its directions**
  and asserts, per direction, that the output names each referenced step's operation through the
  derived-reference vocabulary, carries no step identifier, and uses its own relation family's
  wording.
- `tests/seal/fixtures.ts` carries what `gateCContract` does not: the Gate D Arm 2 reconstruction
  (AC 3), the create-then-read-back pair (AC 4), a direction with `scope` and `negativeDomain` both
  `null`, and a step binding nothing in any channel. Each is a small, schema-valid `EvalContract`
  slice, or the `Direction` plus the `interactionPlan`/`permittedInterfaces` slice `PlanIndex` needs —
  a full contract is not required if the pieces are independently constructible and schema-valid where
  asserted. `relevance-contracts.ts`'s exported `populatedContract` is a second ready-made contract
  and is a smaller, gentler shape to extend where `gateCContract` is more than a case needs; its one
  oracle's relation is `covers-by-key`, so it does not by itself cover AC 3's fixture.
- **The determinism proof is the permutation family, not the repeat call.** AD-30 is explicit that
  running the same input twice does not catch this class of defect — "an arbitrary tie-break is stable
  within a process. The permutation family is the one that catches it" — and AD-16 requires the brief
  to be byte-identical under reordering, which Story 2.2 cannot restore afterwards because this
  function's output is one opaque string. So three assertions, not one: the same input rendered twice
  is identical; the same direction with its **`evidenceTargets` array permuted** renders identically;
  and the same direction rendered against an index built from a **permuted `interactionPlan` and
  permuted `permittedInterfaces`** renders identically. This forces the multi-target ordering rule to
  be a canonical sort over the rendered phrases rather than declaration order, and it is what makes the
  duplicate-key policy of AC 2 observable.
- An exhaustive channel sweep alongside the relation sweep: every one of the seven `EVIDENCE_CHANNELS`
  and, under `call-inputs`, every one of the four `TRANSPORT_CHANNELS`, renders without throwing and
  produces a sent-versus-obtained framing appropriate to the channel.
- Every test asserts something that fails if the property it names is removed — a rendering test
  matching the whole output string too loosely (e.g. `toBeDefined()`) is the same "passes for the
  wrong reason" defect Story 1.3's review round found and this project's stories now write against.
- AD-30 sets a floor of 90 percent statement and branch coverage on `core/`. No coverage threshold is
  configured in `vitest.config.ts` today, so nothing enforces it mechanically; the story's proxy is
  the rule above plus a positive case for every branch, and configuring a threshold is not this
  story's scope.
- `npm run check:docs` and `npm test` run and the baseline is recorded **before the first edit** —
  Story 1.3 paid for skipping this and every story since has kept the habit.
- `npm run validate` passes at the end (typecheck, lint, `check:docs`, `check:shareable`,
  `lint:spine`, `check:vectors`, `check:schemas`, `check:ad5-registry`, `test`). This story adds no
  new script, no new dependency, and touches no `package.json` script list: `src/core/seal/` and
  `tests/seal/` are already covered by `tsconfig.json`'s `include: ["src", "tests", "scripts"]` and
  `biome.json`'s broad `**` include, and there are zero new AD-5 or AD-28 codes to register.
- `src/index.ts` is not touched. The barrel is the package's public surface and `renderDirectionText`
  is internal to `seal`; Story 2.2's `seal()` is the function that earns an export there.

## Tasks / Subtasks

- [x] Task 1: preflight (AC 5)
  - [x] Run `npm run check:docs` and `npm test`; record the baseline test count before the first edit.
- [x] Task 2: the schema type aliases (AC 1)
  - [x] Add `export type Direction`, `InteractionStep`, `Operation`, `PermittedInterface` as
        `z.infer<typeof X>` beside their schemas. Confirm `npm run check:schemas` and
        `npm run check:shareable` still pass, proving the aliases changed no exported byte.
- [x] Task 3: the plan index (AC 1, AC 2)
  - [x] `src/core/seal/plan-index.ts`: `parseEvidenceTarget` (step id, channel, transport channel,
        RFC 6901 tail, reusing `IDENTIFIER_CHARSET_SOURCE`, `EVIDENCE_CHANNELS`, `TRANSPORT_CHANNELS`),
        `buildPlanIndex`, and the `TypeError` precondition-violation path.
  - [x] Tests: resolves a known step and operation; throws on an unresolvable step id or operation id;
        throws on a duplicate `stepId` or a duplicate `operationId` across interfaces; parses all seven
        evidence channels and all four transport channels; does not import anything from a
        not-yet-built `core/compile/`.
- [x] Task 4: the derived-reference vocabulary (AC 2)
  - [x] A phrase-rendering function over one `EvidenceTarget` plus its resolved step/operation,
        covering all three `BindingValue` shapes (`literal`, `matcher: 'any'`,
        `matcher: 'type-violating'`) across all four `InputBinding` channels, plus the all-channels-
        `null` step.
  - [x] Test reproducing AD-16's own worked example category against `gateCContract`'s
        `malformed-submit`: a `type-violating` binding renders as a malformed/invalid-input reference,
        never as the step id.
  - [x] Injectivity test: the phrases for `gateCContract`'s six steps are pairwise distinct, including
        the three pairs that share an `operationId`.
- [x] Task 5: the relation-keyed template (AC 3)
  - [x] `src/core/seal/direction-prose.ts`: `renderDirectionText`, the five families over all sixteen
        `RELATION_VOCABULARY` members with `not` negating, verbatim insertion of
        `scope`/`negativeDomain`, and the `null` case for both.
  - [x] Exhaustive sweep test: every one of the sixteen relation values renders without throwing and
        non-empty.
  - [x] Permutation tests (AC 5): repeat call, permuted `evidenceTargets`, permuted
        `interactionPlan`/`permittedInterfaces` — all three byte-identical.
- [x] Task 6: the fixture sweeps (AC 3, AC 5)
  - [x] Render all eight `gateCContract` directions; assert operation naming, no step identifier, and
        family-appropriate wording per direction.
  - [x] Author the reconstructed Arm 2 `Direction` + plan/operation fixture; assert content-equivalence
        against the three named properties, not string equality against the historical prose.
- [x] Task 7: the temporal read-back collision (AC 4)
  - [x] Start from `gateCContract` O-001; author the additional create/read-back and same-step
        adversarial fixtures; implement the relational-phrase approach; assert no sequencing-language
        leakage in generator-composed text and that the same-step pair does not take the branch.
  - [x] If the fallback branch is taken: implement the bounded disclosure, make the targeted AD-39 edit,
        re-run `check:docs` and `lint:spine`, and record the outcome and reasoning in the Dev Agent
        Record.
- [x] Task 8: the gate (AC 5)
  - [x] `npm run validate` green; confirm no model call, no evaluator execution, no step id in any
        rendered string, and no code copied from `reviews/gate-d/` or `HANDOFF-GATE-CD.md`.
- [x] Task 9: record
  - [x] `_bmad-output/project-knowledge/learning-path-step-by-step.md`, Step 6: one line in the table
        plus a short section, per the doc's own brevity rule.
  - [x] Dev Agent Record: measured counts, the AC 4 branch taken and why, any decision that moved from
        this story's default.

### Story Review Findings

Fresh-context adversarial review of the story file, 2026-08-20, at baseline `267bb03`, before any
implementation. Four passes in this repository's usual shape: blind hunter, edge-case hunter,
verification-gap, acceptance auditor. Every claim in the story was re-checked against the source it
cites — `ARCHITECTURE-SPINE.md` (AD-1, AD-3, AD-16, AD-19, AD-26, AD-28, AD-30, AD-38, AD-39,
Consistency Conventions, Structural Seed, Calibration closure), `epics.md`, `EPIC-BRIEF.md`, the
shipped schemas, `reviews/gate-d/PREREGISTRATION.md` and `FINDINGS.md`, `HANDOFF-GATE-CD.md`, and the
fixtures and configuration in the tree. Fifteen findings; all fifteen are fixed in the acceptance
criteria above rather than left as a report. Status stays `ready-for-dev`.

Every quotation the story makes was verified verbatim, and the following claims were checked and hold:
AD-28 carries exactly nine runtime fault codes; the sixteen-member `RELATION_VOCABULARY` is eleven
operators, three connectives and two quantifiers; `populatedContract` sits at lines 113–312 with
`list.after === 'create'` and relation `covers-by-key`; the `validate` chain lists exactly the nine
scripts the story names; `tsconfig.json` includes `src`, `tests` and `scripts`, and `biome.json`
includes `**` without excluding either; `HANDOFF-GATE-CD.md` line 136 reads "Throwaway code
throughout"; the Gate D Arm 2 direction and prose are quoted exactly; Gate D FINDINGS records 3-of-3
on all three arms; epics.md line 55 states that epics are sequenced so no story depends on a later
epic's output; Story 4.1 owns pointer resolution and Story 4.2 the AD-5 registry; `learning-path-
step-by-step.md` ends at Step 5, so Step 6 is right.

- [x] [Review][Patch] HIGH. **The declared signatures do not compile.** `grep '^export type'
      src/core/schemas/*.ts` returns no `Direction`, `InteractionStep`, `Operation`, or
      `PermittedInterface`; a Zod schema is a `const`, so every `import type` in AC 1's block fails
      the typecheck. Fixed in AC 1 and Decision 7 by adding the four `z.infer` aliases beside their
      schemas, with the "no schema changes" claim narrowed to "no schema shape changes".
      [src/core/schemas/plan.ts, interface.ts, oracle.ts]
- [x] [Review][Patch] HIGH. **AC 2 extracted only the step id, and the channel is what carries the
      meaning.** AD-3 names the targets as "the channels and steps at issue" and `gateCContract`
      O-001 pairs a `response-body` target with a `call-inputs/body` target on the same field; without
      the channel the two render alike and AC 4's relational phrase cannot be written at all. Fixed:
      `parseEvidenceTarget` now returns step id, channel, transport channel and RFC 6901 tail, and
      AC 5 adds an exhaustive channel sweep.
- [x] [Review][Patch] HIGH. **The template families put `all` and `not` in the generic fallback.**
      Counted in the tree, `gateCContract`'s eight oracles declare `all` four times, `for-all` twice,
      `not` once and `deep-equality` once, so the fallback would have absorbed five of eight — and
      rendering `not` through an affirmative skeleton states the opposite of the declared claim to the
      sealed evaluator. Fixed: five families, `not` negating, wording pinned for four of them.
      [tests/schemas/fixtures/gate-c-contract.ts:185,209,246,280,308,340,368,402]
- [x] [Review][Patch] HIGH. **Determinism was proven only by the repeat call AD-30 says cannot catch
      this.** AD-30: "an arbitrary tie-break is stable within a process. The permutation family is the
      one that catches it." AD-16 requires the brief byte-identical under reordering, and Story 2.2
      cannot restore that afterwards because this function returns one opaque string. Fixed: AC 5 adds
      permuted-`evidenceTargets` and permuted-plan assertions, and multi-target references now sort
      canonically rather than following declaration order.
- [x] [Review][Patch] HIGH. **`buildPlanIndex` had no collision policy while both schemas admit
      collisions on purpose.** `EvalContract.interactionPlan` carries no uniqueness refinement, and
      `PermittedInterface.operations` declines one in its own description because
      `duplicate-operation-signature` needs the shape to fire on. A first-wins index makes output
      depend on array order and defeats the permutation property above. Fixed in AC 2 and Decision 4:
      duplicates throw the same precondition violation, with tests. [src/core/schemas/interface.ts:151]
- [x] [Review][Patch] **Two steps could render to the same phrase, which is the ambiguity AD-16 exists
      to remove.** `poll` and `unknown-job-read` share operation `get-export` and differ only in
      `jobId` (`{ matcher: 'any' }` against `{ literal: 'job-does-not-exist' }`), and AC 2 as written
      declined to disclose the literal, collapsing both into one phrase. Fixed: a stated escalation
      order plus an injectivity test over `gateCContract`'s six steps.
      [tests/schemas/fixtures/gate-c-contract.ts:633,669]
- [x] [Review][Patch] **"Non-imperative" was undefined, and the named accept fixture fails a literal
      reading of it.** Gate D Arm 2's prose is "Evaluate... Establish... Treat... as a material
      defect" — three imperative-mood verbs in the string the epic calls an accept fixture. Fixed in
      AC 3 and Decision 9: the prohibition is a prescribed action sequence, not grammatical mood.
- [x] [Review][Patch] **Decision 2 misattributed the negative-domain sorting language.** AD-16,
      `oracle.ts`'s own field description, epics.md Story 2.2 and EPIC-BRIEF all name a *direction's*
      negative domain and its *members*, not only brief-level arrays. The verbatim pass-through is
      still right, because the shipped field is one string with no members, but the reason had to be
      the true one. Fixed: Decision 2 rewritten, and Story 2.2 now inherits an explicit two-way choice
      instead of a conditional. [src/core/schemas/oracle.ts:31]
- [x] [Review][Patch] **Same-step multi-target directions had no rule.** `gateCContract` O-003 carries
      three targets on one step and O-002 carries two, so a per-target renderer emits the same step
      phrase two or three times. Fixed in AC 2: targets group by step, with the RFC 6901 tail naming
      the field at issue.
- [x] [Review][Patch] **The story told the dev to author fixtures the repository already has.**
      `gateCContract` carries the temporal read-back pair AC 4 describes (O-001, `poll.after ===
      'submit'`, `deep-equality`, response-body against call-inputs on the same field) and AD-16's
      malformed-input worked example (O-007 over the `type-violating` `malformed-submit` step). The
      Dev Notes pointed only at the weaker `populatedContract`. Fixed: `gateCContract` is now the
      primary fixture in AC 4, AC 5 and the read-list, with an eight-direction sweep test.
- [x] [Review][Patch] **The all-channels-`null` step was uncovered.** Task 3 enumerated the three
      `BindingValue` shapes but not the `null` channel, which is the common case — five of six
      `gateCContract` steps and both `populatedContract` steps leave at least one channel `null`, and
      a step binding nothing at all must still render. Same for `scope` and `negativeDomain` being
      `null`, which the schema admits and no fixture exercised. Both fixed in AC 2, AC 3 and AC 5.
- [x] [Review][Patch] **The plain-`Error` decision ignored the convention and the precedent.** The
      Consistency Conventions' Errors row reserves the thrown-typed-error class for AD-28 codes;
      `core/canonical/digest.ts` throws `TypeError` for precondition violations and
      `core/schemas/publish.ts` throws plain `Error` for an unresolvable address. Fixed: `TypeError`
      per the `digest.ts` precedent, with `RuntimeFault` named as the class not to borrow.
      [src/core/canonical/digest.ts:46]
- [x] [Review][Patch] **AC 4's fallback misdescribed the AD-39 edit site and skipped its gates.**
      "Whether that holds for a temporal pair is open, not settled" is a sentence inside AD-39's
      "Three consequences follow and each is enforced" paragraph, not the opening of a paragraph; and
      both `check:docs` and `lint:spine` read the spine under `validate`. Both corrected in AC 4.
- [x] [Review][Patch] **AC 1's list of what Story 2.2 assembles was short.** `SealedEvaluatorBrief`
      also carries `probeStepBound`, `contractDigest` and the lineage fields. Corrected.
      [src/core/schemas/sealed-evaluator-brief.ts]
- [x] [Review][Patch] **Three environment facts were missing from a story whose house style records
      them.** `tsconfig.json` sets `noUncheckedIndexedAccess`, so regex captures and `Map.get` are
      `T | undefined`; `biome.json` sets `useImportType`/`useExportType` to `error`; AD-30's 90 percent
      `core/` floor has no threshold configured in `vitest.config.ts`. Added to Testing requirements,
      along with a note that AD-30's API-shaped calibration corpus is recorded fixture debt rather
      than a gate this story owes.

Dismissed after checking (3): the `cli`/`mcp` interface kinds reaching a renderer that assumes HTTP
shape — `unsupported-interface-kind` blocks them at compile and `Operation` requires `method` and
`pathTemplate` regardless, so there is no unrendered case; the story citing the spine, `epics.md` and
the Gate D reviews by bare filename — that is the established citation style in stories 1.3 through
1.5, and the full paths are now spelled once in the read-list; and the story's `Status: ready-for-dev`
sitting beside `sprint-status.yaml`'s `ready-for-dev` — both agree, and the `done`-versus-`review`
divergence that shows up later in the workflow is by design.

One judgment call is flagged rather than settled. The escalation rule in AC 2 permits disclosing a
`{ literal: ... }` binding value when two referenced steps would otherwise render identically. That
value is already fixed by the contract, so it prescribes nothing the declaration had not, and AD-16's
own worked example describes the binding ("when you sent an invalid identifier"). It is still the one
place in this story where the derived reference moves closer to a transcript than the Gate D prose
does, and it fires only on collision. If the implementer finds a collision-free rendering that does
not need it, prefer that and record the choice.

**Closed during implementation.** No collision-free rendering was found that lets the literal-value
rung be dropped from the ladder entirely: `gateCContract`'s one real collision (`poll` versus
`unknown-job-read`) turned out to resolve one rung earlier, at the discriminating-kind level
("supplied" versus "stated"), without needing literal disclosure — but that is a fact about this one
contract's data, not a proof that no contract ever needs the literal rung, and an authored fixture
(two steps sharing an operation, both `literal`-bound on the same key with different values) shows a
shape where `kind` alone cannot distinguish two siblings and the literal rung is what does. The rung
stays in the ladder for that reason, used only on an actual collision, exactly as specified. Its
downstream consequence is now sharper than "prefer a collision-free rendering": once escalation is
exhausted (Decision 12), a contract whose colliding siblings need MORE disclosure than the literal
rung provides fails loudly rather than rendering ambiguous prose, so keeping the literal rung is what
keeps that failure rare rather than routine.

## Dev Notes

### Read these files before writing anything

1. `src/core/schemas/oracle.ts` — the whole file. `Direction`'s five fields are the only input this
   story's core function reads; their comments already explain why `polarity` is duplicated and why
   `scope`/`negativeDomain` are free text exempt from alignment.
2. `src/core/schemas/pointer.ts` — `INTERACTION_POINTER_PATTERN`, `EVIDENCE_CHANNELS`,
   `TRANSPORT_CHANNELS`. The pattern already partitions the pointer grammar; do not re-derive the
   partition, import it.
3. `src/core/schemas/plan.ts` — `InteractionStep`, `InputBinding`, `BindingChannel`. The temporal
   clause is the `after` field; `null` means no clause.
4. `src/core/schemas/interface.ts` — `Operation`, `PermittedInterface`. `operationId`, `method`,
   `pathTemplate` are what a derived reference names.
5. `src/core/schemas/sealed-evaluator-brief.ts` — `BriefDirection`. This story's output becomes its
   `text` field; read the comment on it, it restates AD-16's rule in the schema's own words.
6. `tests/schemas/fixtures/gate-c-contract.ts` — **the most important file in this list after the
   schemas.** `gateCContract` is the hand-authored contract AD-26 and AD-3 reason from. Read its eight
   oracles (lines ~177–440) and its six-step `interactionPlan` (lines ~617–688) together: nearly every
   case AC 2, AC 3 and AC 4 name is already declared there, including the temporal read-back pair
   (O-001), AD-16's malformed-input worked example (O-007 over `malformed-submit`), the sibling
   cross-check (O-008), same-step multi-channel directions (O-002, O-003), and three pairs of steps
   that share an `operationId`. Do not author a fixture for a case this file already carries.
7. `tests/schemas/fixtures/relevance-contracts.ts` — `populatedContract`, lines ~113–312. A second
   complete, schema-valid worked example, smaller and gentler than `gateCContract`: an oracle with a
   real `Direction`, an `interactionPlan` with a temporal pair (`list.after === 'create'`), and
   matching operations. Use it where the Gate C contract is more than a case needs.
8. `ARCHITECTURE-SPINE.md`, AD-3, AD-16, AD-39 in full (already the primary source for this story's
   acceptance criteria; re-read them against the code, not from memory, since AD-16's derived-reference
   paragraph and AD-39's temporal-pair paragraph are both dense and load-bearing for this story
   specifically).
9. `reviews/gate-d/PREREGISTRATION.md` and `reviews/gate-d/FINDINGS.md` — the Gate D spike's exact
   inputs and outputs (AC 3). `HANDOFF-GATE-CD.md` explains why the spike's code itself must not be
   copied. All three, and the spine, live under
   `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/`; `epics.md`
   lives at `_bmad-output/planning-artifacts/epics.md`. This story cites them by bare filename, which
   is the house style, but the paths are spelled once here so nothing has to be hunted for.

### Project structure notes

- `src/core/seal/` and `tests/seal/` are both new directories; no existing file in either tree.
- **No schema *shape* changes.** `Direction`, `InteractionStep`, `Operation`, `PermittedInterface` and
  `BriefDirection` all already exist and none of their fields, refinements or `.meta({ id })` blocks
  move. The one `core/schemas/` edit is the four `export type X = z.infer<typeof X>` aliases AC 1
  requires, which are type-level and change no exported JSON Schema byte. An earlier draft of this
  story claimed the story touches `core/schemas/` not at all; that claim was wrong, because a Zod
  `const` is a value and the declared signatures do not compile without the aliases.
- No new npm script, no new dependency, no CI workflow change. `pr-checks.yml` and `package.json`'s
  `validate` chain already cover a plain `src/`/`tests/` addition.
- Zero new AD-5 or AD-28 codes. If Task 2's precondition-violation path tempts minting one, stop — that
  belongs to Epic 4 once `compile`'s reachability check exists, not to this story.

### Git intelligence (most recent commits, not same-epic — Epic 2 has no prior story)

`267bb03` `chore: epic 1 done`, `a998805` `feat: epic 1 story5 (#15)`, `e83a322` `feat: epic 1 story4
(#14)`, `e90e8d7` `chore(deps-dev): bump the minor-patch-updates group with 2 updates (#13)`, `f76ad86`
`feat: epic 1 story3 (#12)`. Pattern: one `feat` commit per merged story, carrying a PR number; a
`chore` commit marks an epic done by flipping `sprint-status.yaml` alone (see `267bb03`'s single-file,
two-line diff). Epic 1 is fully schema/CI work with no runtime `core/` module outside `canonical/`;
this is the first story with a genuinely new `core/` submodule to design from nothing, so there is no
same-epic predecessor's file layout to match — `core/canonical/`'s pure-function, no-I/O shape and its
`tests/canonical/` mirror are the closest precedent and are cited throughout this story's ACs.

### Testing requirements

Per AD-30: `core/` is tested only with in-memory fixtures, no filesystem or network I/O. Every branch
needs a positive case (all sixteen relation values across the five families; every `BindingValue`
shape and the `null` channel; all seven evidence channels and all four transport channels; both the
relational-phrase and, if reached, the disclosure branch of AC 4).

**Determinism is asserted by permutation, not only by repetition.** AD-38 requires `seal` to be
deterministic and AD-16 requires the brief byte-identical under reordering, but AD-30 says in its own
words why the cheap proof is not enough: "an arbitrary tie-break is stable within a process. The
permutation family is the one that catches it." So the repeat-call assertion stays, and the permuted-
`evidenceTargets` and permuted-plan assertions of AC 5 sit beside it. AD-30 also sets a 90 percent
statement and branch floor on `core/`; nothing in `vitest.config.ts` enforces it today, so the
branch-per-case rule above is the working proxy.

AD-30 names an "AD-3 transcribed calibration corpus" of API-shaped measured contracts as a required
fixture corpus. It does not exist and is not this story's to build: the spine's calibration-closure
section records it as "fixture debt and a scope limit, not an epic gate", because the measured
contracts declare MCP interfaces v0 rejects under `unsupported-interface-kind`. The Gate D
reconstruction and the `gateCContract` sweep are the calibration evidence available today, and the
story claims nothing wider.

**Two typecheck facts on this repository's pins — do not rediscover them.** `tsconfig.json` sets
`noUncheckedIndexedAccess: true`, so a regex capture group and a `Map.get` are both `T | undefined`
and every one of them has to be narrowed; that narrowing is where the AC 2 precondition-violation
throws naturally live. `biome.json` sets `useImportType` and `useExportType` to `error`, so a
type-only import written as a value import fails `npm run lint`, not just review.

### References

- [Source: ARCHITECTURE-SPINE.md#AD-3] the direction's five fields, the alignment predicate's scope,
  the Gate D sufficiency finding and its qualifications
- [Source: ARCHITECTURE-SPINE.md#AD-16] the derived-reference vocabulary, the temporal-pair collision,
  what the brief excludes
- [Source: ARCHITECTURE-SPINE.md#AD-19] the operation inventory fields a derived reference reads
- [Source: ARCHITECTURE-SPINE.md#AD-26] the pointer grammar this story's local stepId extraction
  narrows, and why it does not borrow Epic 4's future resolver
- [Source: ARCHITECTURE-SPINE.md#AD-38] stage one, `seal`'s determinism requirement, the Gate D
  calibration closure
- [Source: ARCHITECTURE-SPINE.md#AD-39] the interaction plan's temporal clause and the one-level bound
- [Source: ARCHITECTURE-SPINE.md#AD-1] purity, and the "not total" fault convention this story's
  precondition-violation path follows
- [Source: ARCHITECTURE-SPINE.md#AD-28] the nine runtime fault codes, and the audit rule that makes
  minting a tenth an amendment
- [Source: ARCHITECTURE-SPINE.md#AD-30] in-memory fixtures only, the 90 percent `core/` floor, the
  permutation fixture family, and the calibration corpus that does not exist
- [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions] the Errors row: a fault carries an AD-28
  code, and a precondition violation is neither a fault nor a finding
- [Source: ARCHITECTURE-SPINE.md#Structural-Seed] `core/` imports `core/schemas` only, and
  `core/seal/` is the declared home for this module
- [Source: ARCHITECTURE-SPINE.md#Calibration-closure] the API-shaped transcribed corpus recorded as
  fixture debt rather than an epic gate
- [Source: tests/schemas/fixtures/gate-c-contract.ts] the hand-authored contract this story's sweeps,
  temporal pair, malformed-input case and injectivity test all run against
- [Source: EPIC-BRIEF.md#Epic-2] done-when, the standing "must not" prohibitions, the temporal-pair
  guidance repeated from the spine
- [Source: epics.md#Story-2.1] the acceptance criteria of record
- [Source: reviews/gate-d/PREREGISTRATION.md] Arm 2's declared direction and generated prose, the
  accept fixture AC 3 reconstructs
- [Source: reviews/gate-d/FINDINGS.md] the 3-of-3 result that closed Owed item 1 and put `seal` in the
  epic order
- [Source: HANDOFF-GATE-CD.md] why the spike's own code is throwaway and must not be copied

## Decisions taken during story creation

Each is settled with a stated default and its downstream consequence. Proceed unless the user amends
one; record the outcome in the Dev Agent Record.

1. **The Gate D accept fixture is content-equivalence, not a byte-identical golden string.** The
   spike's prose predates the finalized `Direction` schema — its "relation" field is a free-text
   sentence, not one of the sixteen `RELATION_VOCABULARY` values — and Epic 2's own prohibition bars
   copying the spike's code. A literal-string match would either be unachievable (the spike used an
   ungoverned generator) or would smuggle spike code back in to produce it. **Consequence:** AC 3's
   test asserts three structural properties (operation named via derived reference, universal-
   quantification framing, `negativeDomain` framed as a defect) rather than string equality.
2. **`scope` and `negativeDomain` are opaque, verbatim pass-through text; this story does not sort or
   restructure them — and the sorting language three sources carry names `negativeDomain` itself, not
   only brief-level arrays.** Stated plainly because an earlier draft of this decision read the
   language as being about arrays such as `directions`, and it is not: AD-16 says "**A direction's
   negative domain** is emitted as an unordered set, never as an enumeration in declaration order...
   achieved by sorting rendered members by canonical form before emission"; `oracle.ts`'s own field
   description says "`seal` renders it as an unordered set so the brief is byte-identical under
   reordering"; epics.md Story 2.2 and EPIC-BRIEF Epic 2 both say "negative-domain members... render in
   canonical sorted order". The rule is nonetheless satisfied vacuously by the shape Story 1.3 shipped:
   `negativeDomain` is one `z.string().nullable()`, a single string has one member and no ordering to
   vary, so verbatim pass-through *is* byte-identical under reordering. Splitting the string on a
   guessed separator to manufacture members to sort would invent structure no schema declares and no
   author agreed to. **Consequence:** Story 2.2 inherits an explicit two-way choice rather than a
   conditional — either record that the sorting requirement is vacuous against the current shape and
   close it, or raise an additive schema change making `negativeDomain` array-shaped under AD-11 and
   sort the members then. This story does not pre-empt either, and Story 2.2 must not leave the choice
   silent.
3. **Step and operation resolution is a small, local helper in `core/seal/`, not a dependency on
   Epic 4's future addressing-grammar resolver.** Epic 4 (Story 4.1) owns "one implementation of the
   addressing grammar" for reachability and full resolution; epics.md's Requirements Inventory states
   epics are sequenced so no story depends on a later epic's output, and Epic 4 has not shipped.
   `seal`'s need is narrower in any case — which step and operation a pointer names, not reachability
   or channel typing. **Consequence:** this story's `stepIdOf`/`buildPlanIndex` is deliberately not the
   general resolver; Epic 4 may later supersede or share code with it, and that reconciliation is
   Epic 4's to make, not this story's to anticipate.
4. **An unresolvable evidence-target pointer, a duplicate `stepId`, and a duplicate `operationId` all
   throw a `TypeError`, not a minted AD-28 fault code.** `compile`'s reachability enforcement
   (`unreachable-check-evidence`) does not exist yet, so nothing guarantees every pointer resolves;
   none of AD-28's nine existing runtime fault codes name this condition, and minting a tenth is out of
   this story's scope (AD-28: "adding a class is an amendment to this AD and to no other"). The
   Consistency Conventions' Errors row reserves the `RuntimeFault` class for a coded fault, so a
   precondition violation must not borrow it; `core/canonical/digest.ts` already throws `TypeError` for
   this class and `core/schemas/publish.ts` throws a plain `Error`, so the convention exists in the
   tree and is followed rather than re-invented. The duplicate-key cases are grouped here because the
   schemas admit both on purpose and a silent first-wins tie-break would make output depend on array
   order, which is the determinism defect AD-30's permutation family exists to catch. **Consequence:**
   these are recorded as should-never-happen precondition violations for now; once Epic 4 ships
   `compile`'s reachability check, a valid `EvalContract` reaching `seal` is guaranteed reachable and
   the unresolvable-pointer path becomes provably dead code rather than a live gap — Epic 4 or Story
   2.2 can note that when it lands. The duplicate-key paths stay live either way, since no AD-5 code
   fires on a duplicate `stepId`.
5. **AC 4's temporal-pair collision is attempted as a relational phrase first; the AD-39 edit is a
   fallback, and if taken, it is a targeted sentence-level correction, not a new spine revision.** This
   mirrors the branch AD-16 and AD-39 already name as open ("Whether that holds for a temporal pair is
   open, not settled") — the choice is empirical (does a non-sequential phrase survive the authored
   adversarial fixtures?), not an ambiguity this story can resolve by reading more prose. **Consequence:**
   whichever branch is taken, the outcome and its reasoning are recorded in the Dev Agent Record; if the
   fallback is taken, the spine edit touches only AD-16/AD-39's own already-open paragraphs and gains no
   new revision number, per this project's standing default of settling such decisions where the work
   happens.
6. **`Direction` is taken non-nullable in this story's function signature.** `Oracle.direction` is
   nullable only so `oracle-missing-channel` can fire on `null` at compile time; a contract that
   reached `seal` already compiled successfully, so no oracle in it has a null direction in practice.
   **Consequence:** Story 2.2's `seal()` is responsible for narrowing the type (filter or assert) at
   the boundary where it iterates `contract.oracles`; this story does not add a redundant null check
   whose only job would be restating a guarantee `compile` already gives.

Decisions 7 to 11 were added by the adversarial review pass below rather than at story creation.
Decisions 12 to 16 were added by two further code-review passes over the implementation itself. Each is
settled the same way: a default, its reasoning, and its downstream consequence.

7. **The four `export type` aliases are added to `core/schemas/`, rather than the types being derived
   locally in `core/seal/`.** The declared signatures do not compile without them, so the only question
   is where the alias lives. Beside the schema matches the precedent already in the tree for
   sub-artifact shapes (`Polarity`, `Relation`, `KeyedShapeDescriptor`, `EvidenceChannelName`,
   `TransportChannelName`) and keeps one spelling of each shape. **Consequence:** the story's
   "no schema changes" claim is narrowed to "no schema shape changes", and every later `core/` module
   that needs these shapes imports the same alias instead of minting its own.
8. **The derived reference is built from the operation, the pointer's channel, and the binding, with a
   stated escalation rule when two phrases would collide.** AD-16 requires the mapping from step to
   phrase to be one-way; it does not require it to be lossy to the point of ambiguity, and the AD's own
   justification for the vocabulary is that a direction over two observations of one operation must be
   able to say which is which. `gateCContract` proves the default rendering is not enough on the
   repository's own contract. **Consequence:** the escalation order — generic, then the discriminating
   binding kind, then the literal — is fixed here so it is deterministic, and an injectivity test over
   the Gate C steps holds it. The operation inventory stays withheld: `pathTemplate` is never printed as
   a template. (Superseded in two ways by later code-review passes, recorded rather than silently
   folded in: Decision 14 removes a fourth `method`/`pathTemplate` rung this decision originally
   included, and Decision 13 scopes the whole ladder to one direction's own referenced steps rather
   than every step in the plan sharing the operation.)
9. **"Non-imperative" means no prescribed action sequence, not the absence of imperative-mood verbs.**
   The Gate D Arm 2 prose the epic names as an accept fixture is imperative in mood in all three of its
   sentences, so the literal reading would make the named accept fixture fail the criterion it is meant
   to satisfy. **Consequence:** the testable prohibition is the ordering-vocabulary check of AC 4 plus
   the no-enumerated-path and no-operation-inventory rules, and the emitted-brief scripting audit of
   Story 2.3 is where the bounded-enumeration half is enforced.
10. **Connectives are their own template family and `not` negates.** The alternative — one generic
    fallback over the structural and connective relations — was measured against the tree and would
    render five of `gateCContract`'s eight oracles, including its one `not`, as undifferentiated
    prose that states the opposite of the declared claim. **Consequence:** five families rather than
    four, wording pinned for four of them, and the structural family carries the relation's own name
    so even its generic skeleton says what is asserted.
11. **Determinism is proven by permutation as well as repetition.** AD-30 states that a repeat call
    cannot catch a stable-within-process tie-break, and this function's output is an opaque string
    that Story 2.2's canonical ordering cannot repair after the fact. **Consequence:** multi-target
    directions render their references in a canonical sort over the rendered phrases rather than in
    `evidenceTargets` declaration order, and three permutation assertions hold that.
12. **An irreducible escalation collision is a story-local, fail-loud precondition violation, not a
    new architecture decision.** AC 2's escalation ladder ends at a `description` level computed
    purely from the shared `operation` (`method` plus `pathTemplate`), which is therefore identical
    for every sibling sharing that operation and adds no disambiguating power by itself — a code-review
    pass over the implementation found that the original code returned this level unconditionally,
    regardless of whether it actually achieved distinctness, silently shipping an ambiguous phrase in
    the case it did not. Per this project's standing default of settling such ambiguities where the
    work happens rather than opening a review round for it, the fix is local: `renderStepReference`
    now throws the same precondition-violation `TypeError` `buildPlanIndex` throws on a duplicate
    `stepId` when the phrases are still not pairwise distinct after every rung, including `description`,
    has been tried. **Consequence:** this is a runtime behavior change from silent (possibly wrong)
    output to a loud failure on a case no fixture in this story's corpus reaches — `gateCContract`'s one
    real collision resolves two rungs earlier — so nothing currently shipping observes a new failure;
    a future contract whose colliding siblings are genuinely indistinguishable by declared structure now
    surfaces that as an explicit defect rather than a wrong brief. No AD-28 code is minted for it, for
    the same reason Decision 4 gives: none of the nine existing codes name this condition, and minting a
    tenth is out of this story's scope.
13. **Escalation-collision distinctness is scoped to one direction's own referenced steps, not to
    every step in the plan sharing an operation.** A second code-review pass found that
    `renderStepReference` computed distinctness over `PlanIndex.stepsUsing(operationId)`, the full
    plan-wide sibling set, so a direction referencing only one step could throw over a collision
    between two *other* steps it never mentions. AD-16's own cited rationale for the vocabulary is "a
    direction over two observations of one operation could not say which is which", scoped to one
    direction throughout, and AC 2's own text already said "the steps one direction references" in one
    place while a heading nearby said "a brief references" (the plan-wide reading) — an inconsistency
    in the story's own wording that this decision resolves in the direction-scoped reading's favor.
    Decision 8's "strictly stronger, so it's fine" framing is corrected here: plan-wide scoping is
    stronger for distinctness but weaker for availability, since it rejects renderable directions over
    collisions they never reference, an action-at-a-distance failure mode that worsens as the plan
    grows. **Consequence:** `renderStepReference`'s third parameter is now an explicit `siblings` list
    the caller supplies, built once per `renderEvidenceReferences` call from that call's own resolved
    evidence targets grouped by operation, rather than derived from the whole `PlanIndex`; a test
    directly exercises the escalation mechanism's full plan-wide capability (all six `gateCContract`
    steps, explicitly scoped), and a second test asserts the narrower production behavior (a step
    rendered alone does not escalate against a same-operation collision it never references).
14. **The fourth escalation rung, a description drawn from `method` and `pathTemplate`, is deleted.**
    It is computed purely from the shared `operation`, identical for every sibling colliding on that
    operation, so it can only ever help in combination with a rung (c) literal-value difference the
    earlier rungs already found; mutation testing on the implementation confirmed this directly,
    replacing the function that built it (or the helper it called) with a constant was undetectable by
    any test in the suite. **Consequence:** `ESCALATION_LEVELS` is three rungs (generic, kind, literal),
    the three now-unreachable helper functions are deleted along with it, and the ladder throws
    immediately once `literal` fails to disambiguate rather than reaching for a rung proven not to help.
15. **The binding clause discloses every declared key together; it does not narrow to "the
    discriminating one".** AC 2's own text said rung (b) escalates "the discriminating binding key"
    (singular), but the shipped renderer has always rendered every bound entry (or every malformed
    entry) together, never a single selected key. Implementing the literal singular reading would need
    a fragile per-sibling-diff algorithm, and it would make the amount of detail shown for one step
    depend on what other steps happen to collide with it elsewhere in the plan, which is its own
    asymmetric-information problem this story has no reason to introduce. Full disclosure of one
    already-named step's own bound parameter names is not the operation inventory AD-16 withholds; that
    withholding is about which *other* calls exist, not what fields the one call under discussion
    carries. **Consequence:** AC 2's prose is corrected to describe what is actually shipped rather than
    the code being narrowed to match a description that was never implemented; no behavior changes.
16. **The temporal-pair phrase's fixed sent-then-obtained print order is the AC 4 "preferred outcome"
    text's own prescribed shape, not an ordering leak, and needs no fallback.** A second review pass
    asked whether always printing the `call-inputs` side first discloses step order, since for a
    read-after-write pair that side is also the temporally earlier one. It does not: AC 4's own
    preferred-outcome text already names "the value sent on the earlier step's `call-inputs` against
    the value observed on the later step's `response-body`" as the sentence order, and the rule does not
    generalize into a decodable ordering channel, since the reverse pairing shape (an earlier step's
    output feeding a later step's input) prints the *later* step first under the same rank rule, so
    print position does not consistently track actual step order across the two shapes. **Consequence:**
    no code change; recorded so the judgment call is settled in the story rather than left for a future
    reader to re-litigate, consistent with the Dev Agent Record's existing note that the relational-
    phrase approach survived every adversarial fixture with no fallback branch needed.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via Claude Code.

### Debug Log References

- Baseline before the first edit (Task 1): `npm run check:docs` — 53 files OK. `npm test` — 27 files,
  1239 tests passing.
- After the four schema type aliases (Task 2): `npm run check:schemas` (12/12 byte-identical) and
  `npm run check:shareable` (21/21 byte-identical) both stayed green, proving the aliases changed no
  exported byte.
- A real TypeScript-inference blocker, found and fixed during Task 3–6 test-writing, unrelated to the
  spec's own logic: `gateCContract` and `populatedContract` are declared `{...} satisfies EvalContract`,
  which checks full structural compatibility under complete contextual typing and passes. The *static
  type* TypeScript records for the expression afterward is different — a `permittedInterfaces[].operations`
  array whose elements declare different response/request keys infers as a union of each operation's own
  literal shape rather than the declared `Operation` shape, and checking that union against `Operation`'s
  `Record<string, JsonTypeName | null>` fields fails with a spurious "possibly undefined" complaint.
  Reproduced in isolation (a two-line repro assigning `gateCContract.permittedInterfaces` to a bare
  `readonly PermittedInterface[]`-typed variable fails the same way, with no `seal` code involved) before
  concluding it was not a defect in `plan-index.ts`/`derived-reference.ts`. Fixed once, in
  `tests/seal/fixtures.ts`, via a documented double cast through `unknown` (a plain `as PermittedInterface[]`
  is refused as "insufficient overlap"), exported as `gateCPermittedInterfaces`/`populatedPermittedInterfaces`
  so no other test file repeats the cast. `gateCContract.interactionPlan`/`populatedContract.interactionPlan`
  do not hit this (their binding maps happen to share the same key set across steps), so those are
  re-exported with a plain type annotation and no cast.
- Final gate (Task 8): `npm run validate` green — typecheck, lint, `check:docs` (53 files), `check:shareable`
  (21 pages), `lint:spine` (0 findings), `check:vectors`, `check:schemas` (12 files), `check:ad5-registry`
  (20 codes), and `test` — 30 files, 1295 tests passing (1239 baseline + 56 new, all in `tests/seal/`).
- After the code-review pass below: `npm run validate` re-run green end to end — `test` now 30 files,
  1301 tests (1239 baseline + 62 in `tests/seal/`, six added by the review's regression-test
  requirements: the genuine channel-signature tie, the shared-`after`-predecessor grouping, the empty
  RFC 6901 tail token, the response-headers/stdout/stderr tail-rendering assertions, and the
  empty-string `scope`/`negativeDomain` and presence-wording tests).
- A second, independent verification pass stress-tested the shared-`after`-predecessor fix above with a
  3-step linear chain and found a worse regression it introduced: silently dropping the chain's last
  step's evidence entirely, not merely reordering or duplicating it. Root cause: the fix's
  `chosenAsSuccessor.has(stepId)` skip conflated two different things — "this step is already going to
  be rendered via its predecessor's pair" (true) and "this step's own possible predecessor role can be
  ignored" (false when the step is itself a predecessor with a chosen successor of its own, since that
  entry was never read before the skip). A suggested single-pass rewrite fixed the drop but, traced
  against a second shape (a simple pair whose successor's `stepId` sorts before its predecessor's),
  reintroduced a different regression: the pair silently failed to form and both sides rendered as
  unrelated singles, losing AC 4's relational-phrase guarantee for a shape the story's own tests already
  covered correctly before this round. The fix landed here keeps the original precomputed-sets structure
  (still fully order-independent) and adds one static pruning pass: `chosenSuccessorOf`, read as
  predecessor -> chosen successor, is provably a disjoint union of simple chains (each step names at
  most one `after` predecessor and wins at most one predecessor's selection), so removing every entry
  whose *key* is itself a chosen successor collapses each chain to its root edge in one pass regardless
  of length, with no iteration and no dependency on `stepId` sort order relative to any other step. All
  three shapes — the original fan-in fixture, a reversed-sort-order simple pair, and a 3-step chain — are
  now covered by regression tests and pass together. `npm run validate` re-run green a second time:
  `test` now 30 files, 1302 tests (adds the one linear-chain regression test).
- After the third code-review pass (4 decisions, 22 patches, one folded and one mooted): `npm run
  validate` re-run green end to end a third time — `test` now 30 files, 1319 tests (1302 plus 17 new,
  all in `tests/seal/`: the escalation-mechanism-vs-production-scope pair for Decision 13, the
  out-of-order-binding-keys test, the shared-key-across-channels test, the reverse-shaped
  `sentFirstOrder` test, the multi-segment-tail test, the two trailing-empty-token tests, the
  scalar-channel-with-tail reject test plus its `InteractionPointer.safeParse` cross-check and a
  well-formed-pointer agreement check, the deduplication test, the sixteen-relations-pairwise-distinct
  strengthening, the parts-order test, the period-insertion test, the capitalization test, the
  double-terminator test, and the empty-`evidenceTargets`-throws test).
- After closing the deferred `groupResolvedTargets` chain-collapse item (see the addendum to the
  round-3 code-review pass, below): `npm run validate` re-run green end to end — `test` now 30 files,
  1321 tests (1319 plus 2 new, both in `tests/seal/derived-reference.test.ts`: the 4-step and 5-step
  after-chain regression tests).

### Completion Notes List

- AC 1: added exactly the four `export type X = z.infer<typeof X>` aliases (`Direction` in `oracle.ts`,
  `InteractionStep` in `plan.ts`, `Operation` and `PermittedInterface` in `interface.ts`), beside their own
  schemas per the `Polarity`/`Relation`/`KeyedShapeDescriptor` precedent. No schema shape changed; verified
  by `check:schemas` and `check:shareable` staying byte-identical.
- The two-file sketch in AC 1 became three files: `plan-index.ts` (resolving), a new `derived-reference.ts`
  (AC 2's phrase-rendering vocabulary and its escalation ladder, and AC 4's temporal-pair grouping), and
  `direction-prose.ts` (AC 3's relation-family templates, calling into `derived-reference.ts`). This is the
  "equivalent split" AC 1 explicitly allows: Task 4 already names the derived-reference vocabulary as its
  own deliverable, distinct from Task 3's resolving and Task 5's templates, and the three-file layout gives
  each of those tasks one focused, independently-tested module — matching `core/canonical/`'s precedent of
  several small pure files rather than two large ones. `PlanIndex` also gained a third field, `stepsUsing`,
  beyond the two the story's sketch names (`stepOf`, `operationOf`): escalation (AC 2) needs every step
  sharing an operation, not just single-id lookups, and this keeps that data available from the same index
  build rather than recomputing it.
- AC 2 escalation is now computed against **only the steps one direction's own resolved evidence targets
  reference that share the operation in question** (Decision 13), threaded into `renderStepReference` as an
  explicit `siblings` parameter the caller builds once per `renderEvidenceReferences` call. An earlier round
  of this story computed it against every step in the whole plan sharing the operation instead (via
  `PlanIndex.stepsUsing`), reasoned as "strictly stronger, so it's fine" — a second code-review pass
  corrected that: it is stronger for distinctness but weaker for availability, since it rejects a
  perfectly renderable direction over a collision between two steps it never references. The escalation
  ladder is three rungs (generic → discriminating kind → literal value), not four: the fourth,
  `method`/`pathTemplate`-derived rung this story originally shipped is deleted (Decision 14) after
  mutation testing showed it added no disambiguating power a same-operation collision could ever use,
  since `method`/`pathTemplate` are properties of the operation rather than the step and are therefore
  identical for any two steps colliding on it — exactly the structural reason the removed rung could
  never have broken such a tie regardless of how the sibling set was scoped. `gateCContract`'s one real
  collision (`poll` vs. `unknown-job-read`) still resolves at the second rung (`kind`), exactly as walked
  through by hand in the AC's own reasoning; the escalation mechanism's full capability (given an explicit
  sibling set) is proven separately from the narrower, direction-scoped production behavior, each by its
  own test.
- AC 3: five relation families implemented (quantifiers, connectives, presence, comparison, structural),
  with `not` an explicit negating skeleton and the five structural operators sharing one skeleton
  parameterised by the relation's own name. Wording is original to this implementation (not a byte-identical
  reproduction of anything): the Gate D fixture is asserted by content-equivalence per Decision 1, and the
  `gateCContract` sweep asserts structural properties (non-empty, no step id in the generated portion,
  pairwise distinctness where relevant) rather than exact strings, consistent with the story's own
  "non-imperative means no prescribed action sequence" reading (Decision 9) and its explicit permission to
  choose the pinned wording during implementation.
- AC 4: the **relational-phrase branch was taken and survived every authored adversarial fixture** —
  `gateCContract` O-001 (the real `poll.after === 'submit'` pair, both original and evidenceTargets-reversed
  order), an authored create-then-read-back pair, and the authored same-step pair (which correctly does
  **not** take the branch). The fallback (a bounded ordering disclosure plus a targeted AD-39 edit) was
  **not needed and not taken**; `ARCHITECTURE-SPINE.md` was not touched. Sequencing-language absence
  ("first", "then", "before", "after", "subsequently") is asserted by explicit substring checks on every
  temporal-pair test.
- AC 5: `gateCContract` is the primary fixture throughout, per the story's own instruction not to author a
  fixture for a case it already carries. `tests/seal/fixtures.ts` adds exactly the four cases AC 5 names
  beyond it (Gate D reconstruction, create-then-read-back, both free-text fields `null`, an
  all-four-channels-`null` step), plus two additional escalation fixtures (a literal/literal collision
  forcing the third escalation level, and an irreducible collision proving the fourth level renders without
  throwing) that the story does not require but that AD-30's branch-coverage rule calls for. All three
  permutation assertions (repeat call, permuted `evidenceTargets`, permuted `interactionPlan`/
  `permittedInterfaces`) are present at both the `renderEvidenceReferences` layer and the `renderDirectionText`
  layer. A real bug this caught during development: a same-step multi-target group's inner phrases were
  joined in declaration order rather than sorted, which broke byte-identity under an `evidenceTargets`
  permutation for O-002/O-003-shaped directions — fixed by sorting that inner list too, not just the
  top-level group list.
- No new npm script, dependency, or CI workflow change. `src/index.ts` is untouched. Zero new AD-5 or AD-28
  codes.

### Code-review pass (post-implementation)

A fresh-context code review of the diff found eleven findings, all confirmed by reading the source
and all fixed here rather than deferred:

- **Grammar bug** (HIGH): `joinWithAnd` emitted "A, and B" for exactly two items. Fixed to "A and B",
  Oxford comma retained only for three or more.
- **Binding-entry collision across transport channels** (MEDIUM): two bindings sharing a parameter
  name in different channels (`path.id`, `query.id`) rendered identically within one clause. Fixed by
  carrying the transport channel on each entry and qualifying every rendered name with it
  ("the supplied path id" / "the supplied query id") — a wording change reflected in the two tests
  that asserted the old unqualified form.
- **Escalation ladder could silently ship a collision** (HIGH): `renderStepReference` always returned
  at the `description` level regardless of whether it achieved distinctness there, since `description`
  is computed purely from the shared operation and cannot itself break a step-level tie. Fixed per
  Decision 12: throws the same precondition-violation `TypeError` `buildPlanIndex` throws on a
  duplicate `stepId` when escalation is exhausted without achieving distinctness. The existing
  "irreducible collision" test, which previously asserted `.not.toThrow()` with no content check, now
  asserts the thrown `TypeError`.
- **Temporal-pair ordering was not truly permutation-invariant** (HIGH): `channelSignature`'s
  `/`-join conflated a tail token containing an escaped `/` with an equivalent multi-segment tail, and
  `sentFirstOrder`'s tie-break degenerated to argument order on any genuine signature tie (e.g. the
  same field read from two different steps' response bodies). Fixed: `channelSignature` now encodes
  via `JSON.stringify` (structure-preserving), and the tie-break falls through to each side's own
  `renderStepReference` output, which is now guaranteed distinct between any two different steps
  (immediately above). A new fixture (`sameFieldTemporalPair`) and test assert byte-identity under
  both declaration orders for a genuine tie.
- **A predecessor could be reused across two temporal-pair groups, order-dependently** (HIGH): the
  direct-partner branch in `groupResolvedTargets` paired a step with its `after`-predecessor without
  checking the predecessor was not already claimed, unlike the reverse-find branch beside it. Fixing
  only that asymmetry surfaced a second, deeper issue the same finding's own acceptance criterion
  ("byte-identical under permutation") caught in this session's own regression test: *which* of two
  candidate successors wins a shared predecessor still depended on discovery order even once double-
  claiming was prevented. `groupResolvedTargets` was rewritten to resolve every pairing from sorted
  step ids and a sorted successor list per predecessor — a fixed, content-derived tie-break — rather
  than from an order-dependent greedy walk. A new fixture (`threeStepSharedAfter`, two later steps
  naming the same predecessor) and test assert byte-identity under four different orderings and that
  the predecessor's reference appears in exactly one relational-phrase group.
- **Empty-string `scope`/`negativeDomain`** (MEDIUM): schema-legal and distinct from `null`
  (`z.string().nullable()`, no minimum length), but the code only checked `!== null`, so `''` produced
  exactly the empty-sentence output AC 3 forbids for `null`. Fixed by guarding both clauses on
  `!== null && text.trim() !== ''`, with tests for both fields.
- **Empty RFC 6901 tail token** (MEDIUM): `target.tail.at(-1) ?? null` returned `''`, not `null`, for a
  legally empty last token (`TOKEN_SOURCE` admits a zero-length token), producing "its  field" (blank
  name, double space). Fixed to treat an empty token the same as no tail, with a test.
- **Two real coverage gaps** (MEDIUM): `response-headers`/`stdout`/`stderr`'s tail-bearing phrasing had
  no rendering-layer assertion (parsing-layer coverage only), and presence (`existence`/`absence`) had
  no fixture-driven exact-wording test — `gateCContract`'s eight oracles declare no presence relation
  at all, so AC 3's "pinned... from the `gateCContract` sweep" claim was not actually true for that
  family. Both gaps closed with direct tests, and AC 3's prose corrected to say precisely which
  families are pinned by which mechanism (quantifier/comparison by the Gate D and temporal fixtures,
  connective by the `gateCContract` sweep, presence by a dedicated unit test).
- **Documentation gaps** (LOW): AC 1's `PlanIndex` code sample now forward-points to the shipped third
  member (`stepsUsing`); the literal-disclosure judgment call flagged during story creation is now
  closed with its actual outcome (kept in the ladder; `gateCContract`'s one real collision resolves
  one rung earlier, at `kind`, but an authored fixture shows a shape where `kind` alone is not
  enough); and the Step 6 learning-path diagram's two fixture edges, which pointed from the fixture
  into the modules that do not import it, are reversed to match the diagram's own read-order list.

`npm run validate` was re-run to green after every fix above (see the updated Debug Log entry).

### Code-review pass (round 3: mutation testing plus a second reviewer)

A third pass, combining an independently-verified mutation-testing review and a second reviewer's
findings, produced 4 settle-by-construction decisions and 22 patches (one folded into another, one
mooted by a decision). All were applied; none were escalated into a spine change.

**Decisions** (recorded in full in the Decisions section as 13–16): distinctness for the escalation
ladder is direction-scoped, not plan-wide (13); the fourth, `method`/`pathTemplate` escalation rung is
deleted as measurably powerless (14); the binding clause discloses every declared key together, and
AC 2's "the discriminating key" (singular) prose is corrected to match rather than the code being
narrowed to match a description nothing ever implemented (15); the temporal-pair phrase's fixed
sent-then-obtained print order is AC 4's own prescribed shape, not an ordering leak, and needs no
fallback (16).

**Patches applied**, by area:

- `direction-prose.ts`: `renderNegativeDomainClause` stripped a trailing terminator from
  `negativeDomain` before appending its own framing sentence, since every real fixture's
  `negativeDomain` already ends in a period and the un-stripped concatenation produced "...did not
  return. is treated as a defect." undetected by the existing loose `toContain` assertion. Every
  `parts` entry (relation claim, polarity, scope, negativeDomain) is now capitalized at its leading
  letter before joining, which is also what makes a `Direction`'s own first character read correctly
  rather than starting the whole `BriefDirection.text` lowercase. An empty `evidenceTargets` array,
  schema-legal but never produced by a `Direction` that reached `seal`, now throws the same
  precondition-violation `TypeError` this story already uses elsewhere, in place of the degenerate
  double-space text it rendered before. `structuralClaim` is now typed to an explicit six-member
  `StructuralRelation` union rather than the full sixteen-member `Relation`, so a future
  `RELATION_VOCABULARY` addition fails to compile here instead of silently falling through.
- `derived-reference.ts`: `localTargetPhrase`'s `call-inputs` branch now names the transport channel
  in the tail-bearing case too (previously only in the no-tail fallback), so `path.id` and `query.id`
  never collapse to one phrase; `stdout`/`stderr` now read "the `{field}` field of its standard
  output"/"...error" rather than sharing `response-body`'s bare "field" wording; a tail longer than one
  segment now renders the full path joined by `.` rather than only its last token, so two different
  parents sharing one leaf field name render distinctly; `formatLiteral` recursively sorts object keys
  before stringifying a literal value, matching `canonicalize.ts`'s own key-sorting rule, so two
  contracts sharing one canonical digest cannot render different prose from a literal's declared key
  order; and the binding clause is now parenthesized onto its step reference rather than comma-joined,
  so joining two or more such phrases at a higher level stays structurally recoverable instead of
  producing indistinguishable comma soup. `renderEvidenceReferences` now deduplicates its `pointers`
  argument before resolving, since a declared-twice pointer was pushing its step out of the
  exactly-one-target shape AC 4's temporal pairing requires, silently disabling the relational phrase
  for an otherwise-valid pair while also duplicating the rendered phrase itself.
- `plan-index.ts`: `parseEvidenceTarget`'s regex now mirrors `pointer.ts`'s own three-branch channel
  partition (`TAIL_BEARING_CHANNELS`, `SCALAR_CHANNELS`, `TRANSPORT_ROOTED_CHANNEL`) via named capture
  groups, instead of one flat alternation over all seven channels with a tail after every one of them.
  The flat grammar silently accepted a tail on a scalar channel
  (`/interactions/poll/response-status/oops`, which `InteractionPointer.safeParse` rejects) and
  discarded the bogus segment, rendering byte-identically to the valid tailless pointer; the corrected
  grammar rejects it, and a cross-check test asserts agreement with `InteractionPointer.safeParse`
  directly.
- `tests/seal/fixtures.ts`: the `asPermittedInterfaces` double-cast through `unknown` is replaced by
  `z.array(PermittedInterface).parse(...)`, which resolves the same TypeScript inference gap by
  re-deriving the type from the schema rather than from the expression's own inferred type, while also
  validating the value at runtime — confirmed by test-compiling before landing it, per the patch's own
  instruction. `emptyChannel` changed from one shared mutable object (with `as string[]`/
  `as Record<string, null>` casts discarding `readonly`) to a factory function returning a fresh object
  per call. Every one of the ten hand-authored fixtures is now passed through a `validateContractSlice`
  helper that parses its `interactionPlan`/`permittedInterfaces`/`direction` pieces against their own
  schemas at module load time, so a future schema tightening that would reject one of them fails loudly
  here rather than drifting silently.
- `tests/seal/plan-index.test.ts`: the `module boundary` test (a filesystem read inside a `core/`-adjacent
  vitest suite, flagged against AD-30's in-memory-fixtures convention) is kept as a vitest test rather
  than moved to a new `scripts/check-*.ts` — this story's own scope (AC 5) rules out a new npm script for
  one two-line assertion, and there is no way to answer "does this module import from core/compile"
  without reading source text somehow, since ES modules expose no runtime reflection over their own
  import graph. It is extended to cover all three `core/seal/` files instead of only `plan-index.ts`, and
  now parses each file's actual `import ... from '...'` specifiers rather than a blanket substring
  search over the whole file, so a comment merely mentioning "compile" cannot produce a false positive.
  Full transitive resolution through `../schemas/*` is not attempted, since the Structural Seed states
  `core/` imports `core/schemas` only and Epic 4 has not built `core/compile/` at all yet.
- Test strengthening against mutation-testing survivors: the sixteen-relation sweep now asserts
  `new Set(texts).size === RELATION_VOCABULARY.length` rather than only non-empty text, which would have
  passed undetected if two relations' skeletons collapsed to one string; `bindingEntries`' key sort is
  exercised with a binding map declared out of alphabetical order; `sentFirstOrder`'s specific expected
  print order (not only permutation-invariance, which a constant argument order trivially satisfies) is
  pinned directly, including via a new `reverseAfterPair` fixture where the predecessor is the
  response-reading step and the successor is the one sending `call-inputs`, so a constant `[a, b]`
  return would visibly print the wrong side first; `ensureSentence`'s period-insertion is exercised with
  an unterminated `scope` directly adjacent to a `negativeDomain` clause; `direction-prose.ts`'s fixed
  `parts` order is pinned by comparing `indexOf` positions of distinctive markers in each clause, not
  only by substring containment; and the malformed-salience rule in `bindingClause` is exercised with a
  step binding both a malformed and a non-malformed key, asserting the non-malformed key's own wording
  never appears.
- Patch 12 (LOW, moot once Decision 14 landed): `methodDescription`'s `OPTIONS`-as-"a write"
  misclassification is gone along with the rest of the deleted fourth rung; no separate fix needed.
- `_bmad-output/implementation-artifacts/deferred-work.md` gained one open entry, added rather than
  reasoned about here: `groupResolvedTargets`' one-static-pass chain collapse (Decision from the prior
  code-review round) discards a second, disjoint pair for an `after`-chain of four or more steps
  (`a -> b -> c -> d` keeps only the `a`/`b` pair). AD-39 bounds a real contract's temporal clause to one
  link, so this is defensive code for a shape nothing upstream rejects yet, revisited once Epic 4's
  compile-time enforcement exists.

  **Addendum (2026-08-21): closed.** The one-static-pass collapse above voided *every*
  `chosenSuccessorOf` entry whose key was also a value — meaning a whole chain's worth of interior
  entries, not just the ones actually consumed by the one pair it kept — so a 4-step chain lost its
  legal `c`/`d` pairing along with `b`'s already-spent one. Replaced with a walk: starting only at each
  chain's true root (a step that is nobody's chosen successor, found the same way as before), follow
  `chosenSuccessorOf` and emit a pair for every other link — `(1st, 2nd)`, `(3rd, 4th)`, and so on — with
  a trailing odd step, if any, rendering standalone. A single-link chain still collapses to exactly one
  pair, matching the prior behavior and every existing regression test (the shared-predecessor fan-in,
  the reversed-sort-order pair, and the 3-step chain all still pass unmodified); a chain of four or more
  now keeps every disjoint pairing the structure supports instead of only the first. The walk cannot
  loop on a malformed, schema-legal `after` graph (a cycle or a step naming itself): `chosenSuccessorOf`
  is injective, so it is a disjoint union of simple chains and simple cycles, and every cycle member is
  by construction someone's chosen successor, hence never treated as a root the walk starts from. Two
  new fixtures (`fourStepAfterChain`, `fiveStepAfterChain`, in `tests/seal/fixtures.ts`) and two
  regression tests in `tests/seal/derived-reference.test.ts` cover the even-length (two pairs, nothing
  standalone) and odd-length (two pairs plus one standalone) shapes, each asserted permutation-invariant.
  `deferred-work.md`'s entry is deleted; this addendum is its recorded outcome.
- Patches 16 and 22 from this round (a "five" vs. "six" structural-operator miscount, and adding
  `tests/seal/fixtures.ts` to the Step 6 learning-path reading order) were explicitly withdrawn by the
  coordinator mid-pass: a concurrent session was already handling both, directly and in
  `learning-path-step-by-step.md`, which this story does not touch at all per that session's explicit
  request. Skipped here on instruction, not overlooked.

`npm run validate` was re-run to green after every fix above; final count: 30 files, 1319 tests (see
the Debug Log).

### File List

- `src/core/schemas/oracle.ts` — added `export type Direction`
- `src/core/schemas/plan.ts` — added `export type InteractionStep`
- `src/core/schemas/interface.ts` — added `export type Operation`, `export type PermittedInterface`
- `src/core/seal/plan-index.ts` — new: `parseEvidenceTarget`, `PlanIndex`, `buildPlanIndex`, `resolveStep`,
  `resolveOperation`
- `src/core/seal/derived-reference.ts` — new: the derived-reference vocabulary, its escalation ladder, the
  AC 4 temporal-pair grouping, `renderEvidenceReferences`, `renderStepReference`
- `src/core/seal/direction-prose.ts` — new: `renderDirectionText`, the five relation-family templates
- `tests/seal/plan-index.test.ts` — new
- `tests/seal/derived-reference.test.ts` — new
- `tests/seal/direction-prose.test.ts` — new
- `tests/seal/fixtures.ts` — new: the four AC 5 fixtures beyond `gateCContract`, two escalation fixtures,
  and the typed `gateCContract`/`populatedContract` re-exports that work around the TypeScript-inference
  issue above
- `_bmad-output/project-knowledge/learning-path-step-by-step.md` — added Step 6
- `_bmad-output/implementation-artifacts/2-1-the-direction-prose-generator.md` — this file: task checkboxes,
  Status, Dev Agent Record
