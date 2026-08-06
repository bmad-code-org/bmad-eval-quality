# Gate C — falsification by execution

Run 2026-07-29 against spine revision 7, by hand-authoring rather than by reading. Both tests carry
a number and both are repeatable. Fixes made in consequence are listed at the end, and the spine is
revision 8 as a result.

## Test 1 — hand-author one contract for a system unlike the toy API

**Threshold: zero blocking. Result: zero blocking. PASS.**

System under test in `system-under-test.md`, contract in `eval-contract.json`: a cursor-paginated,
soft-delete-filtered, 202-then-poll asynchronous export API. Two of the gate's three suggested
shapes at once, because the seams between features are where the ambiguities were.

Nine points required stopping and guessing. Classification is by whether authoring could proceed:
blocking means no conforming contract could be written, ambiguous means two conforming authors
write different things, friction means the cost is real and the AD states it.

| # | Point | Class | Where |
| --- | --- | --- | --- |
| 1 | `expectedCardinality` is required per collection location and has no value space. No integer is true for a page of 20 drawn from 97. | ambiguous | AD-19 |
| 2 | A reference set's *declaration* has no shape. AD-26 specifies the operand to its single key; nothing says where the declaration lives or what a member is. | ambiguous | AD-19, AD-26 |
| 3 | Channel roles are read by AD-31 as a declaration AD-19 requires, and AD-19 does not enumerate them. | ambiguous | AD-19, AD-31 |
| 4 | Polarity is declared twice, once on the direction and once on the check, and no AD says the oracle carries two fields. | ambiguous | AD-3, AD-33 |
| 5 | `set-membership`'s set operand is stated legal for a reference set; whether a `{literal: […]}` array is also legal is unstated, and a four-value state enum is not a reference set. | ambiguous | AD-4, AD-26 |
| 6 | The response descriptor is per interface, so three operations returning disjoint bodies force `requiredKeys` empty and rule 2 reads nothing. | ambiguous | AD-19, AD-20 |
| 7 | `volatilePointers` are response-shape-relative while every evidence operand is interaction-rooted, so one contract carries two pointer grammars. | ambiguous | AD-11, AD-26 |
| 8 | A three-phase causal chain (submit, poll, page) needs two `after` levels and `nested-temporal-clause` forbids it. Re-rooting the third step on the first preserved every oracle. | friction | AD-39 |
| 9 | The `Idempotency-Key` header is declarable and its oracle is not writable, idempotency being out of v0 for want of call-sequence declarations. | friction | AD-20 |

Points 1, 2, 3 and 6 are one class, and it is F2's: a declaration named or cited without a shape,
read by a published predicate. Point 3 is the fourth instance of the exact signature AD-40 carried
in round four, and the first found by a script rather than a reviewer — the spine linter's new
declaration-citation rule reports it once the rule reads plain-prose enumerations, which is how
AD-31 spells the claim.

Points 8 and 9 are the architecture working. AD-39 states the depth bound and its reasoning, and
the workaround cost nothing: the completeness oracle needs "the page read after the job was
created", not "after the poll that followed the creation".

## Test 2 — re-derive AD-31's fourteen predicates over named contract fields

**Threshold: 14 of 14 declaration-only. Result: 13 of 14. FAIL**, against 11 of 14 in round four.

Each predicate below is written as a decision procedure over declarations only. Reading a run
record would disqualify it, since these predicates back a blocking compile code and must run
before any run exists.

| Rule | Predicate | Reads | Class |
| --- | --- | --- | --- |
| 1 relevance | `successIndicator` is declared and at least one other pointer carries a channel role | success indicator, channel roles | declaration-only |
| 1 satisfaction | some oracle's direction targets both the indicator pointer and a pointer whose role is not `success-indicator`, and `check` contains both | direction, check, channel roles | declaration-only |
| 2 relevance | the response descriptor declares more than one pointer | response descriptor | declaration-only |
| 2 satisfaction | *no denominator exists.* Per-interface scope makes `requiredKeys` empty for a multi-shape interface, so any coverage fraction is over an empty set | — | **underspecified** |
| 3 relevance | some operation declares a request shape with at least one typed key | request shape channels | declaration-only |
| 3 satisfaction | some plan step binds a `type-violating` matcher and some oracle's `check` addresses that step | interaction plan, check | declaration-only |
| 4 relevance | the descriptor declares at least one collection location | collection locations | declaration-only |
| 4 satisfaction | some `check` carries a quantifier whose collection operand is a declared collection location | check, collection locations | declaration-only |
| 5 relevance | a sibling group over operations or parameters is non-empty; an explicit empty group is an answer | sibling groups | declaration-only |
| 5 satisfaction | some oracle's direction targets two members of one declared sibling group, and `check` contains both | direction, check, sibling groups | declaration-only |
| 6 relevance | a declared collection location names a reference set | collection locations, reference sets | declaration-only |
| 6 satisfaction | branch on `expectedCardinality.mode`: `exact` requires `covers-by-key` against the reference set; `page-bounded` or `at-most` requires the injection form, a quantifier over the page whose predicate is `set-membership` against the reference set | expected cardinality, reference sets, check | declaration-only |
| 7 relevance | some operation declares `stateChangeMarker: true` | operation inventory | declaration-only |
| 7 satisfaction | some `check` relates a pointer under the state-changing step's `call-inputs` to a pointer under a different step's `response-body`, that step's operation declaring `stateChangeMarker: false` and carrying a temporal clause naming the first | interaction plan, operation inventory, check | declaration-only |

Round four's three failures were rule 2 satisfaction, rule 3 satisfaction, and rule 7 relevance.

Rule 7 relevance is closed by F2's fix: `stateChangeMarker` exists and the predicate reads it.

Rule 3 satisfaction is derivable and round four's objection does not survive contact with the plan
grammar. The objection was that malformed-input content lives in the direction's negative domain,
which AD-3 exempts from alignment. True, and irrelevant: satisfaction does not have to run through
alignment. AD-39's `type-violating` matcher is a declaration, and an oracle addressing the step that
carries it is a declaration, so the pair decides the rule without reading prose or a run.

Rule 6 satisfaction was derivable only after `expectedCardinality` got a mode. Without one the
predicate has to guess which of two forms the contract owed, and the two report opposite outcomes
on one contract: a bijection against a page of a larger set resolves false against a correct
server, which is the defect the injection form was admitted to fix.

Rule 2 satisfaction stands open, and it is a schema-shape decision rather than a repair. Both fixes
work and they cost differently, so it is recorded as **Owed to the calibration re-run item 4** and
gates nothing.

## What was changed in consequence

Revision 8 of the spine, all mechanical:

- AD-3, AD-10 and AD-38 now cite `unsupported-interface-kind` where they had stated a compile-time
  rejection with no code. Found by the linter's code-citation rule, not by reading.
- AD-19 enumerates a channel role per declared pointer, and supplies value spaces for channel
  roles, expected cardinality, and the reference-set declaration.
- Owed to the calibration re-run gains item 4, declared non-gating for the same reason ADR-009 had
  to exempt the spike: a section that forbids the work closing it produces another review round.

Points 4, 5 and 7 above are left open deliberately. Each is an authoring coin flip that blocks no
predicate, and each is settled by construction the moment the Zod schema is written, which is the
first epic. Settling them in prose first would be a fifth review round wearing a schema's clothes.

## Second pass — 2026-07-30, spine revision 9

This pass appends to rather than replaces the 2026-07-29 record. It applies the accepted product
decision that every operation declares its own response descriptor, re-authors the same export API
contract against that shape, and re-derives the same fourteen AD-31 predicates. It is mechanical
closure of Gate C, not another architecture review.

### Test 1 — re-author the export API contract

**Threshold: zero blocking. Result: zero blocking. PASS.**

`eval-contract.json` now carries a response descriptor, channel roles, nominated success indicator,
collection locations, and volatile pointers on each operation. The interface-wide union descriptor is
gone. `POST /exports` and `GET /exports/{jobId}` declare their job-resource bodies independently;
`GET /exports/{jobId}/rows` declares the row page; error fields remain operation-local diagnostics.

Four authoring points still require a choice: zero blocking, two ambiguous, and two friction. The two
remaining ambiguities are the already-recorded polarity duplication and literal-array spelling for
`set-membership`. The two friction points remain the bounded temporal plan and idempotency's deliberate
v0 exclusion. The prior response-descriptor ambiguity is closed, as is volatile-pointer scope: both now
resolve through the operation named by an interaction-plan step. No new blocking point appeared.

### Test 2 — re-derive AD-31's predicates

**Threshold: 14 of 14 declaration-only. Result: 14 of 14. PASS.**

The thirteen predicates that were declaration-only in the first pass are unchanged. Rule 2 satisfaction
is now declaration-only as well:

| Rule | Predicate | Reads | Class |
| --- | --- | --- | --- |
| 2 satisfaction | for every addressed interaction-plan step, the direction and `check` cover every required key in the response descriptor belonging to the operation that step invokes | interaction plan, per-operation response descriptor, direction, check | declaration-only |

The denominator is never the permitted-key set and never an interface-wide union. The export contract
therefore cannot satisfy whole-body coverage by reading nothing: each invoked operation contributes its
own non-empty required-key set.

### Gate C closure

- Blocking authoring points: **0**.
- Declaration-only predicates: **14 of 14**.
- Owed-to-calibration item 4: **closed** by the per-operation response descriptor decision.
- Historical worked example: **unchanged**. Its revision-8 shape remains deliberately inconsistent and
  awaits regeneration by the reference reducer.
