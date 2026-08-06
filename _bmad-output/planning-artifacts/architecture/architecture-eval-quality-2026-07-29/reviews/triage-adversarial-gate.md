# Triage — adversarial gate against spine revision 5

Two adversarial lenses were run against revision 5 after the round-3 revision landed, each with one
instruction: construct two implementations that obey every rule to the letter and still produce different
bytes from the same input. A counterexample, not an adjective. Both were told to ignore the two Owed
sections, so nothing below is a rediscovery of a recorded-open item.

- `review-adversarial-grammar-r3.md` — AD-3, AD-4, AD-5, AD-26, AD-39, Conventions. Nine divergences.
- `review-adversarial-measurement-r3.md` — AD-16, AD-23, AD-28, AD-39, AD-40. Eight divergences.

An earlier single-lens run covering all eight seams at once died of resource exhaustion with no output.
Splitting it in two with explicit line ranges is what produced these.

## Verification log

Every finding was checked against the spine text before disposition. Nothing below is taken on the
reviewer's word.

| Claim | Method | Result |
| --- | --- | --- |
| 13 of 17 AD-5 codes cited nowhere but the table | Counted occurrences of all 17 codes across the whole document | **Confirmed, and worse than reported.** Only `direction-check-misaligned`, `unsupported-interface-kind`, `nested-temporal-clause`, `plan-exceeds-scripting-bound` appear outside the table |
| AD-3 containment undefined over bound variables | Read AD-3's containment sentence against AD-4's quantifier rule and AD-26's relative form | Confirmed. Declared target is fully rooted; check operands are a collection pointer and `@/status`; no rule says which side normalises |
| `covers-by-key` undetermined over two empty collections | Read AD-4's stated relation and its degenerate-operand paragraph | Confirmed. The fail-closed doctrine is stated for quantifiers one paragraph above and not applied to the operator defined below it |
| AD-39 input bindings untagged | Read AD-39's binding sentence | Confirmed. Literals and the closed matchers share one value space, so `"type-violating"` is ambiguous and the literal string is unspellable |
| Reference-set operand shape underspecified | Read AD-26's second-operand paragraph | Confirmed in substance. It names two things and specifies no keys; the collection location is also redundant against `covers-by-key`'s `actual` |
| AD-40 condition grammar cannot discriminate | Read AD-40's grammar sentence against its qualification rule | **Confirmed — direct self-contradiction, both sentences from revision 5.** Grammar is request-side only; qualification demands a response channel |
| Citation and quotation unranked | Read AD-40's match rule, its AD-32 sentence, and AD-23's dual requirement | Confirmed. Three conforming readings, all three quoting this AD |
| Interface kind insufficient to bind an operation | Read AD-40's signature fields | Confirmed. Kind, not identity; two operations can share method and path template |
| Path template matched as a string | Read AD-40's resolution sentence | Confirmed. `/notes/{id}` against `/notes/{noteId}` is undetermined, and portability is what exposes it |
| `exercised` ambiguous, and its non-state | Read AD-7's denominator against AD-6's closed state set | Confirmed on both halves. "Leaves both numerator and denominator" is not one of the twelve states |
| AD-16 read-back vocabulary unsatisfiable | Read AD-16's derivation rule against AD-39's definition of a selection predicate | **Confirmed, and tighter than reported.** The temporal clause is *inside* the predicate AD-16 renders; AD-16's illustrative phrase happens to use a clause-free step, which is why it did not show |
| Unordered negative domain not byte-stable | Read AD-16's unordered-set rule against AD-27's canonicalisation | Confirmed. JCS sorts object keys and leaves array order untouched, so "unordered" had no realisation |

## Root causes

Seventeen divergences reduce to five.

1. **A registry nobody cites.** AD-5's table existed; the ADs commanding its checks described them in prose. Three commanded checks had no code at all.
2. **Grammar rules stated as prohibitions without resolutions.** Nesting bounds, degenerate operands, dangling identifiers, and untagged unions — each a sentence forbidding something with no stated failure mode or resolution.
3. **AD-40's condition grammar contradicts AD-40's qualification rule.** Introduced by revision 5.
4. **Operands and definitions left unranked or unscoped.** Citation versus quotation, exercised by whom, interface kind versus identity, template string versus template shape.
5. **A genuine impossibility in the sealed brief.** AD-16 and AD-39 make mutually unsatisfiable demands for the one case that forced the temporal clause into existence.

## Dispositions applied

| Root cause | Disposition | Where |
| --- | --- | --- |
| 1 | Three codes added (`quantifier-nesting-exceeded`, `unresolved-reference-set`, `duplicate-operation-signature`); every commanding AD now cites its codes literally; a paragraph records that the citation requirement runs both ways | AD-5, AD-3, AD-4, AD-16, AD-26 |
| 2 | Containment computed after quantifier substitution; `covers-by-key` fails closed on empty and on duplicate keys; reference-set operand fixed at `{ "referenceSet": … }`; literals and matchers tagged | AD-3, AD-4, AD-26, AD-39 |
| 3 | Condition becomes a selector plus a response predicate in AD-4's vocabulary over AD-26's channels, rooted probe-side | AD-40, ADR-009 decision 1 |
| 4 | Identifiers govern and quotation audits, with disagreement invalidating; exercised is evaluator-initiated and resolves `not-applicable`; parameter names erased before template comparison, collisions failing compilation | AD-40, AD-7, AD-6, ADR-009 decisions 2–4 |
| 5 | Withdrawn into Owed to the calibration re-run item 2 with the shape of a fix; AD-39's no-ordering claim limited to briefs needing no temporal disambiguation | AD-16, AD-39, Owed item 2, ADR-009 decision 8 |

No finding was rejected. One was tightened rather than accepted as stated: the grammar lens framed the
input-binding collision through the control-object versus `JsonValue` boundary, where the sharper and more
mechanical statement is that literals and matchers share an untagged value space. Four decisions were the
user's rather than mine, and are recorded in ADR-009.

## What this did not change

ADR-008 had already placed both halves behind the calibration re-run, so no verdict moved. Under revision 5
the catch rate was computable as 1.00 by construction, which is the measurement that re-run exists to
produce, so the value of this gate is that the experiment's output will now mean something. The gate
condition is unchanged: no epic touches `compile` until items 1 and 2 close, in that order.
