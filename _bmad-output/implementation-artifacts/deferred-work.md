# Deferred work

**One item is open, and it is an addition to the published surface rather than a repair.** Epic 9's
third adversarial review found that `ProbeTargetPolicy` has a single authorization shape and that
every field in it is HTTP: scheme, host, port, resolved addresses, methods, safe methods, redirect
count, and request and response byte caps. So a `cli` interface cannot be authorized at all, AD-35's
rule that "an adapter denies by default and permits only what that mapping names" has nothing to
name for the mechanism epic 9 adds, and the published conformance suite has no command arm because
there is no policy for one to certify against. Closing it is a declaration first: a command
authorization naming a permitted executable, the subcommand paths and environment keys it may
carry, and its own elapsed and output-byte caps; then the assertions -- an executable no mapping
names, a refusal to accept a pre-built argument vector, a non-zero exit as an observation rather
than a fault, each cap enforced. The gap is stated in `src/testing/probe-conformance.ts`'s own
header and in the release disclosure, so no adopter concludes from a green nineteen-of-nineteen run
that a command adapter has been certified. What the review round did repair is the suite's silence:
it now checks that an observation echoes its request's `kind`, so an api adapter can no longer pass
by answering a command request with an HTTP observation.

Epic 9 closed the sixteen items this file carried, on the instruction that no
work be left owed; the closure narrative for those sixteen is at the end, under "How to use this
file". The prose immediately below records how each past item closed. Epic 7's reviews
filed fifteen; this file's own closure narrative below accounts for the other four. Story 8.2's
review closed one Story-8.1-routed item (the operationId collision) and opened two of its own, a
net gain of one over the seventeen story 8.1's reviews left open. Story 8.3 closed both of Story
8.2's own routed items (`checkModeAgreement` now called for real, `ScoredOutcomesAndVerdict`
widened) and closed the comparator half of the private-artifact-manifest entry Story 8.1's review
opened, reassigning that entry's port-awaiting half and the coupled `isolationManifestArtifact`
entry to story 8.4 -- a net loss of two, and its own review opened one (the `qualifiedProbe` fixture's
schema-invalid `probeId`), a net loss of one over the story's own start. Story 8.4 closed both
reassigned entries: `application/score.ts` is the first caller to await `CorpusPort.resolve`, so
each `--private-manifest` entry's digest and the private-storage `isolationManifestArtifact`
reference's digest are both now checked against their resolved bytes -- a net loss of two, leaving
the two Story-8.1-review entries with no owner (the empty-violation-string gap and the
`IsolationManifest.contractId` match) as that section's only remaining items.

The adversarial review of the evaluate layer filed one item on 2026-09-08 and it closed the same
day, restoring the count above to sixteen. A `{ referenceSet }` operand in `set-membership`'s set
position resolved to the declared members themselves, so `setMembership` compared a whole object
against the scalar the value operand had resolved to: this repository's own Gate C oracle O-006
answered `false` against a correct page, and the negated spelling, which is how "none of these
appear" is written, answered `true` for every page forever. `resolveSetMembershipNode`
(`src/core/evaluate/resolution.ts`) now projects such an operand to the set's single declared key
before the operator sees it, and `checkOperandLegality`'s new `onSetOperand` guard fires
`malformed-operator-expression` when a reference set in that position declares more than one key or
carries a member missing the declared key, which is what makes the projection total. The declared
keys reach the resolution site as a `ReferenceSetKeys` record threaded through `resolveCheck`,
`PreflightPlan`, and the score stage. The grammar did not move, so no `schemaVersion` bumped and no
published schema drifted; the `memberKey` field the entry named as the symmetric alternative is
recorded as the option turned down, with its reasoning, in `projectSetOperand`'s own comment. The
entry's two siblings closed with it: `containment`'s docstring now states that a reference-set
candidate matches whole declared members and steers an author to `covers-by-key` or the projected
`set-membership`, and `checkOperandLegality` now rejects a `covers-by-key` member missing
`expectedKey`, the shape that made `coversByKey` answer `false` for a whole collection while the
compiler walked past it. The closing condition is met: `tests/evaluate/resolution.test.ts`'s O-006
block reads `gate-c-contract.ts`'s declared object members off the fixture, the flat-string
substitution and its deferral comment are gone, and the block carries the negated-polarity case and
a row-with-extra-fields case beside the two it already had. Nothing in the entry turned out to be
wrong.

Story 7.10 opened five items and one of them closed the same day, 2026-09-03, wider than it was
filed. The entry said two of epic 7's nine `schemaVersion` bumps carried no bump note in the driving
field's own `.describe()`, which is where AD-11 says the record belongs. A recount against source
found five: the eval contract's 2 -> 3 (`TestData.principals`, `TestData.resources`), the sealed
brief's 1 -> 2 (`principals`), the evidence artifact's 1 -> 2 (`ScoringVersionInputs.mode`), the
probe's 1 -> 2 (`qualification`, `defectSignature`), and the scoring policy's 1 -> 2
(`catchThreshold`). All five now carry the note, and `schemas/eval-contract.schema.json`,
`schemas/sealed-evaluator-brief.schema.json`, `schemas/evidence-artifact.schema.json`,
`schemas/probe.schema.json`, and `schemas/scoring-policy.schema.json` are regenerated from them, so
the same release's CHANGELOG claim that every bump is recorded in the field's own description is
true of all nine. The entry's "no in-repo record" was also too strong for three of the five: the
brief's bump is in a code comment at `src/core/seal/seal.ts:95-98`, and the probe's and the evidence
artifact's are in their artifact-level `.meta` descriptions, which do export. The scoring policy was
the only one with no record anywhere in its module. The edit is additive text on six existing
`.describe()` calls, so no `schemaVersion` moved and no field changed shape; the reasoning lives in
`7-10-the-epics-disclosed-breaks-and-the-non-comparability-statement.md`'s review record.

The other four items Story 7.10 opened all closed the same week, once epic 7's own stories were
done and a dedicated cleanup pass could touch what a documentation-only story's frozen Never
clause could not.

The two stale-stamp items closed by code, not by argument: `scripts/worked-example-target.ts`'s
`AUTHORED_CONTRACT.schemaVersion` moved from `1` to `3`, matching the shape it was already
re-authored against, and `spike-worked-example/`'s five files were regenerated
(`npm run generate:worked-example`), correcting the `contractSchemaVersion: 1` the published
evidence artifact carried against an eval contract the same release discloses at 3. The dev-corpus
stamp traced to one line: `tests/coverage/fixtures/satisfaction-contracts.ts`'s seed literal, which
every one of the nineteen corpus contracts spreads from, so a single-line fix and a
`npm run generate:dev-corpus` regeneration corrected all nineteen files plus the compiled-and-sealed
example at once. Closing it required first fixing `scripts/dev-corpus-target.ts`'s
`assertLineageRoot`, which had hard-required `schemaVersion === 1` as part of what makes a contract
a lineage root: a stale assumption from when every schema was still at version 1, and a
misattribution to AD-29, whose actual Rule text (`ARCHITECTURE-SPINE.md:439`) governs only
`parentDigest` and `revisionCount`. The guard now checks AD-29's own pair alone; verified still live
against a mutated `revisionCount` and a set `parentDigest`, and correctly silent against a
`schemaVersion` other than 1. A sweep for the same pattern (an `EvalContract` literal already
shaped to the current schema but still stamped 1) found three more unshipped test fixtures
(`tests/schemas/fixtures/relevance-contracts.ts`'s `absentContract`, which
`explicitlyEmptyContract` spreads, `tests/schemas/fixtures/gate-c-contract.ts`, and
`tests/preflight/fixtures/observations.ts`'s preflight contract) and corrected all three in the same
pass, though none of them ships or is asserted against a version anywhere, so their staleness was
cosmetic rather than a caller-facing break. The sweep is complete: the only `schemaVersion: 1`
literals left in the repository are the five artifacts genuinely still at version 1 (the rubric, the
isolation manifest, the evaluator configuration, the private artifact manifest, and the pre-flight
verdict) and `worked-example-artifacts.ts`'s deliberately frozen pre-regeneration transcriptions.

Five literals carried the stale stamp, and the arithmetic is worth stating plainly because the
pattern kept recurring: two generator seeds that reach published bytes
(`scripts/worked-example-target.ts`'s `AUTHORED_CONTRACT` and
`tests/coverage/fixtures/satisfaction-contracts.ts`'s seed, the second of which the whole dev corpus
spreads from) and three unshipped fixtures found by the sweep above. Before any of those, the
committed `spike-worked-example/eval-contract.json` carried it too, since Story 7.9 re-authored that
contract whole against the current schema and re-stamped it `1` in the same pass; it is the output
of the first seed and was corrected with it. Every copy was found by hand, across three separate
passes.

The mechanism that let it happen is now closed. `tests/schemas/eval-contract-version.test.ts` pins
the eval contract's current version in one place and asserts every authored literal, every member of
`CORPUS_CONTRACTS`, every contract `buildDevCorpus` emits, and the worked example's own contract
against it. Verified by reverting the corpus seed to `1`, which reddens twenty-one of its
twenty-eight cases and names the seed and every corpus member, and by reverting the worked example's
constant, which reddens the emitted-chain case alone. This is the check `check:corpus` and
`check:worked-example` cannot be: both rebuild through the same literal they compare the commit
against, so a wrong stamp and its check agree with each other, while the expected value here is
written down once and nowhere else. It is also the shape every other lineage-bearing artifact already
has, since `artifact-fixtures.ts` calls each of its fixtures "the only place a ... version number is
written down, which is what makes each bump visible"; the eval contract was the one artifact with
seven such places and no pin. An earlier draft of this entry argued that closing this needed a
per-artifact current-version registry and that a registry contradicts
`src/core/schemas/eval-contract.ts`'s published statement that no reader in this version declares an
expected version constant. That statement is about ingest-side readers, and a test-side pin is not
one, so the argument did not reach as far as it was asked to. Nothing about the shipped reader
changed.

A fourth published copy of the same value turned up in review, outside `corpus/`, and the branch's
own claim that "the only corpus bytes to move are the twenty stamps and the digests over them" was
therefore one artifact short. `docs/tutorials/getting-started.md` publishes the example brief's
`contractDigest` as the output of a `seal` command and then tells the reader the repository ships
the brief that command produces, so a user following the page saw a digest the package no longer
emits. It had been stale since epic 7 story 2 and went stale a third time here. Neither doc gate
catches it: `check:docs` does not scan `docs/`, and `check-doc-invocations.mjs` compares a page's
transcribed output only where the page declares the exit code it expects, which leaves a digest
quoted in prose beyond it. The value is corrected, and
`tests/architecture/dev-corpus.test.ts`'s case 162, which already recomputes `seal(compile(contract))`
and compares it to the shipped brief, now also asserts the tutorial carries that brief's digest.
Verified by restoring the stale value, which reddens the case.

The two remaining Story 7.10 items closed by argument, not by code, because both are spine-text
completeness gaps rather than defects: nothing reads wrong today, and both would need someone to
write new normative architecture text. This repository has no epic retrospectives, and the practice
it does record points the other way: `epic-7-context.md:45` says an ambiguity found mid-story is
settled by construction in that story rather than escalated into a new spine revision. Neither of
these two is such an ambiguity. Each is a proposal to add a rule the spine does not currently make,
which is the one thing that guidance does not cover and the one thing an incidental finding from an
unrelated story is worst placed to decide. AD-11's enumerated disclosure surface having no automated
drift check is real and Story 7.10 found it by hand, but the fix is a new checker script deriving the
list from `INTERCHANGE_ARTIFACTS`, which is new tooling scope disproportionate to what surfaced it,
not a correction to anything currently wrong. AD-11's rule text having no explicit "added a required
field is breaking" case is also real and the reading Story 7.10 used is correct, cited, and now
published in `CHANGELOG.md`; writing that case into AD-11's Rule paragraph itself, rather than into
its disclosure-surface sentence (which Story 7.10 was already authorized to edit), is a change to
the architecture's own normative text, and stays a recorded observation rather than a spine edit no
single story's incidental finding should make alone.

All five items Story 4.2's own step-04 review opened were closed the same day, 2026-08-25, once
pushed on rather than left queued:

- **AD-16's two forbidden-input checks had no thrower.** Closed in `src/core/compile/forbidden-
  inputs.ts`. `checkForbiddenInputFloor` checks all seven mandatory floor members, and
  `checkScopedResourceReferences` rejects any populated scoped resource list, matching the schema's
  declared failure shape. `tests/compile/forbidden-inputs.test.ts` covers every floor member plus
  null, empty, and populated scoped resources.
- **Unbounded recursion depth over nested `not`/`all`/`any` expressions.** Closed as out of v0's
  stated scope, not as unaddressed: the spine states plainly, twice, that "the package treats a
  caller as a possibly-buggy integration, not as an adversary," that an adversarial trust model
  "would require independent attestation or a runner boundary the package owns," ruled out for v0 by
  ADR-004, and that "upgrading the trust model is a spine amendment, not a hardening exercise." A
  stack-depth guard against an adversarially deep `check` tree is exactly that hardening; it is not
  this or any other v0 story's work to add quietly. Revisit only alongside an actual trust-model
  change.
- **`buildPlanIndex`/`parseEvidenceTarget` could throw a raw `TypeError` on a schema-legal duplicate
  `operationId`.** Closed: `plan-index.ts`'s `buildPlanIndex` now takes a `duplicateIds: 'throw' |
  'unresolved'` option (default `'throw'`, preserving every existing strict caller); Story 4.2's two
  new checks already selected `'unresolved'`, and `reachability.ts`'s `checkEvidenceReachability` now
  does too, so every `core/compile/` caller is total against this schema-legal shape. Its own
  `evaluatePointerReachability` already handled an unresolved step or operation gracefully as
  `unreachable`, so this was a one-line extension of infrastructure already proven correct, not a new
  design. `tests/seal/plan-index.test.ts` covers the option directly.
- **`checkOracleAlignment`'s relation-containment read as near-vacuous for a connective/quantifier
  relation, with nothing proving otherwise.** Closed by demonstration, not by redesign: the "appears
  anywhere in check" semantics are AD-3's own stated rule ("check may be stronger than the
  direction"), not an oversight, so the fix was closing the missing-fixture gap the entry actually
  named. `tests/compile/oracle-alignment.test.ts` now asserts `direction.relation` set to `for-all`,
  `all`, or `not` against a check naming only `for-any`/`existence` still throws — proving the
  containment check is not vacuous, it correctly rejects a relation that is genuinely absent even
  among several other connective/quantifier ops — alongside a positive case where the relation is
  genuinely present, nested one level down.
- **`checkQuantifierOverNonCollection` silently skipped a nested quantifier's own `@`-prefixed
  collection pointer.** Closed: it now walks with the same bound-element substitution
  `oracle-alignment.ts`'s `collectTargets` already threads for direction/check alignment (that file's
  `substitutePointer` is now exported for this reuse), so a nested quantifier's own collection
  pointer resolves to an absolute one before its declared type is checked, rather than being skipped.
  `tests/compile/expression-legality.test.ts` covers both the general substitution case and the bare
  `@/` special case.

The `in-review`/`review` status-vocabulary drift between story files' own `Status:` line and
`sprint-status.yaml`'s `development_status` field was investigated on 2026-08-24 and found to be by
design, not closed by rule change: the two fields are owned by different mechanisms for different
purposes (the story file's `Status:` is the BMad build skill's own internal routing state, which
includes the transient `in-review`; `sprint-status.yaml`'s `development_status` is a coarser
human-facing tracker that was only ever designed to distinguish in-progress/awaiting-review/done),
the same dual-vocabulary shape already normalized here for the `Status: done` /
`development_status: review` pairing, and nothing in the codebase cross-validates the two fields.

`regexMatchStepBudget` being unvalidated where `resolveCheck`/`regexMatch` consume it was
investigated on 2026-08-24 and found to be by design: `ScoringPolicy.regexMatchStepBudget`
(`core/schemas/scoring-policy.ts`) is already `z.int().min(1)`, a guard that shipped in Story 3.1
before the deferring story (3.2) was even written, forecloses the `NaN`/negative/non-integer failure
modes at the only place a `ScoringPolicy` is ever constructed, and matches this codebase's own
convention of validating numeric policy fields once at the schema boundary with no re-validation at
downstream consumers.

`evaluatePointerReachability`'s root-collection carve-out never checking a literal array index
against the declared collection's own `expectedCardinality` was closed on 2026-08-24: the carve-out
in `src/core/compile/reachability.ts` now resolves the actual `CollectionLocation` and returns
unreachable when the index is at or past its bound (`exact.count`, or `at-most`/`page-bounded`'s
`max`), the same treatment Decision 8 already gives `stdout`/`stderr`. The fix and its reasoning live
in that function's own comment, with `tests/compile/reachability.test.ts`'s new fixture 38b covering
all three `expectedCardinality` modes both in-bounds and out-of-bounds.

Story 2.3 carried three items, all closed on 2026-08-21 in the same pass a second-round peer review
found them trivially fixable rather than genuinely deferrable: `SealedEvaluatorBrief.directions`
gained `behaviors`' own `.min(1)`; `BriefDirection` gained the `export type` alias every other schema
in the file already has; and the story's own Task 2 now names the `npm run build:shareable` step
explicitly. All three fixes and their reasoning live in
`2-3-the-emitted-brief-scripting-audit.md`'s Completion Notes.

Story 2.2 carried two items, both closed on 2026-08-21 by
`spec-harden-seal-exclusion-guarantee.md`. The fixes and their reasoning live
in `spec-2-2-brief-assembly-exclusions-and-canonical-ordering.md`'s Spec
Change Log: the module-boundary guard's file list and `seal()`'s missing
runtime self-validation.

Story 2.1 carried one item, closed on 2026-08-21: `groupResolvedTargets`'s chain-collapse logic
dropped legal disjoint pairings for after-chains of four or more steps. The fix and its reasoning
live in `2-1-the-direction-prose-generator.md`'s Decision log.

The `check-docs.mjs` ROOTS gap (carried from Story 3.2) was closed on 2026-08-24: `_bmad-output/project-knowledge`
was added to `ROOTS` alongside `_bmad-output/planning-artifacts`, raising the checked-file count from 53 to 55
with no new failures.

Epic 1 itself closed with an empty ledger. Four items were carried here and all four were closed on
2026-08-20. Each one's reasoning lives with the work rather than in this file, which is a queue and not
a record:

- Shareable HTML links usable without repository access, and validation that the export is current
  and canonical: `spec-condense-readme.md`, "Follow-up hardening, closed 2026-08-20".
- Digest-path throughput over large observation and score arrays: story 1.2, Completion Notes
  decision 25. Measured, and closed with no code change.
- Amortising the generated mutant corpus: story 1.5, Review Findings. Cached, and the cost claim
  corrected by measurement.

## How to use this file

An entry belongs here only when the work cannot be done in the pass that found it and the decision
to defer is deliberate. Give it a `source_spec`, a one-line `summary`, and the `evidence` a later
reader needs to pick it up cold. When it is done, delete the entry itself; a terse pointer to where
the outcome and reasoning live (the source spec) may stay in the closure prose above, the way every
closure on record here already does it, so a later reader is not left to guess what was once open.
The rule is about the entry, not about erasing that something was once open.


**Nothing is open.** Epic 9 closed the sixteen entries this file carried, on the
instruction that no work be left owed. The closures are recorded below in one
line each, naming where the outcome and the reasoning now live, which is what
the rule above asks for when an entry is deleted.

Four had already been closed by later stories and the entries had not been
removed: the trial-set reducer's unknown-state guard, its `catchThreshold`
range check, and `outcomesByProbeId`'s duplicate handling were all written when
`score.ts` first called the reducer for real, and each carries its own comment
saying so.

Five were defects and are fixed. `atOrAboveFloor` compared two `indexOf`
results and read `-1 >= -1` as "at or above the floor" for two severities on no
ladder at all; both operands are looked up before they are compared now.
`classStrengthOf` counted a repeated probe identifier twice on both sides of one
ratio; it counts identifiers rather than entries. `IsolationManifest.violation`
admitted an empty string, which invalidated a run while naming nothing, and its
three observed-value arrays admitted empty elements that rendered a basis line
with nothing after the colon; all four are non-empty now. `seal` threw a bare
`TypeError` when two steps of one direction rendered to the same derived
reference, which is the one authoring fault in the tree that reached a caller as
a stack trace; it throws `irreducible-step-reference`, AD-5's twenty-fifth code,
and `checkStepReferenceReducibility` reports it at compile time so a caller
never meets it at seal. The shared `qualifiedProbe` fixture's `probeId` did not
match `ProbeId`'s own shape and is now `P-901`, so the local override that
worked around it is a naming choice rather than a workaround.

Two were missing capability and are built. The sealed run record carries
`principal`, the field owed item 3's cross-user case needed: a `{ principal }`
binding is presence-only by construction, so two steps of one operation binding
`owner` and `other-user` both resolved `several` against a record that exercised
both, and the two critical-severity cross-user behaviours were unscoreable.
AD-17's record-decidable half is enforced: a rubric criterion scored twice is a
`duplicate-record-identifier` condition under a fourth subject, `judge-result`.

Three were true and are now stated where they belong rather than tracked here.
The published-schema census numbers live in one module, `tests/schemas/published-census.ts`,
which the five files that assert on them import, so a schema change moves one
number rather than five. Cross-trial identifier reuse is not a collision, and
`score.ts` says why: a trial set is n independent runs of one contract, and a
harness that names its first observation `obs-1` names it that every time, so
reporting the second run for it would make a repeated run Invalid by
construction. The severity-floor override's scope is AD-7's own, whose words are
that a contract missing a floor-level behaviour "never dominates" one that
caught it; that constrains dominance and says nothing about equivalence, and
`compareDominance` records the asymmetry as a decision.

Two were boundaries rather than gaps and are declared as such. `mode` must
appear in an evidence artifact's `callerAttestedInputs` and no JSON Schema
keyword can say so without a Zod/ajv disagreement the differential exists to
catch, so the constraint ledger carries entry `evidence-mode-caller-attested`
and `core/emit` names it unconditionally. `IsolationManifest.contractId`
promised a match nothing could perform, since no artifact in ingest's inputs
carries a contract identifier to compare it against; its description now says
it is a label and names the three fields the two artifacts actually agree on.

The other half of AD-17 stays outside this package and is stated in
`JudgeResult.score`'s own description rather than tracked: that a scored
criterion is one the cited rubric declares needs the rubric artifact, no stage
row names it as an input, and the check is the caller's on the same terms AD-12
already states for the remediation cap.
