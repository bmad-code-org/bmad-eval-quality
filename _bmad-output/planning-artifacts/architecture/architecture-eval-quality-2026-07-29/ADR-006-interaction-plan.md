---
id: ADR-006
title: An oracle addresses observations through a declared interaction plan, which selects and never instructs
status: accepted
date: 2026-07-29
amends: ADR-003
---

# ADR-006: An oracle addresses observations through a declared interaction plan, which selects and never instructs

## Status

Accepted 2026-07-29. Recorded separately from ADR-005 because it turns on a distinction that, drawn
wrongly, would dismantle the product's central experimental result while looking like a routine schema
improvement. Enforced by AD-4, AD-16, AD-19, AD-26, and AD-39 of spine revision 3.

## Context

Revision 2 fixed evidence roots at `response-body`, `response-status`, `call-inputs`, and four others.
Every one of them names a single response. Nobody noticed for ten review passes.

Then the first contract was written by hand, against a toy API whose seeded defect is a `PATCH` that
returns 200 with the updated note and never persists it. That defect is chosen so that only an
independent read-back can catch it: the write's own response is indistinguishable from a correct one.

The oracle is inexpressible. It has to compare the title sent to the write against the title returned by a
*later* read, and no pointer can name the other call. Nor could three of the seven discipline rules —
malformed input, sibling cross-check, and state-change read-back are all inherently multi-observation, and
omission and completeness becomes so as soon as the reference set comes from a second call. Three of five
oracles in the toy contract had no writable `check`, and since AD-3 requires `check` and AD-5 makes a
missing one a structural error, **the contract did not compile**. The architecture could not compile a
contract for the defect class it had been extended to catch hours earlier.

The obvious fix — let the contract declare named steps and let pointers root at them — collides with a
prohibition that is not decoration. AD-4 forbids `ordering` from encoding a sequence of actions the
evaluator must perform, and AD-16 keeps a prescribed action sequence out of the sealed brief. Those exist
because prescribing the path is what the scripted arm did, and an independent evaluator choosing its own
path is what beat it. A declared plan of ordered steps is, read carelessly, exactly the scripted arm
returning through the schema.

## Decision

**An interaction step is a selector over observations the evaluator produced. It is not an instruction.**

A step declares an identifier, the operation it refers to, and a selection predicate over that operation's
observations composed of an input binding and an optional temporal clause naming an earlier step. Pointers
root at `/interactions/{stepId}/` followed by the closed channel vocabulary. Three enforced consequences
keep the distinction real rather than asserted:

1. **The plan never reaches the evaluator.** The sealed brief carries behaviours, oracle intents,
   interfaces, and permitted resources. Step identifiers stay with the compiler and the scorer, so no
   ordering can be read off the brief. This is the mechanical guarantee; the rest is interpretation.
2. **Matching is by content, never by position.** A step matches an observation by operation and input
   binding, and by recorded relation to another observation where a temporal clause applies. The evaluator
   remains free to obtain the observations in any order, with any number of additional calls, by any route
   it chooses.
3. **An unproduced step is not a failure.** An oracle whose steps the evaluator never exercised resolves
   `unreached`, which routes through AD-21 as an evidence condition. "The evaluator did not do the thing"
   is not "the system is broken", and a contract declaring steps no evaluator would plausibly reach is a
   coverage problem to surface rather than a script to enforce.

The temporal clause was not in the first draft of this decision and was forced by continuing to exercise
the example: the baseline read and the read-back are the same operation with the same input binding, so
without a temporal relation they cannot be told apart, and the original inexpressibility returns in a new
costume. It survives the prohibition because ordering here is part of what the behaviour *means* — "did
the write persist" is inherently "read after write" — rather than a route to obtaining it.

Two smaller decisions accompany it. The operator set gains the collection quantifiers `for-all` and
`for-any` with a bound element addressed by a relative pointer, because per-record verification — one of
the five *original* measured rules — was otherwise inexpressible and only spot-checking could be written.
And input-binding values admit the closed matchers `any` and `type-violating`, so a malformed-input oracle
can select the malformed call without the contract dictating the malformed value.

## Consequences

- The grammar is now uniformly step-rooted, so single-observation oracles name a step too. More verbose in
  the simple case, and worth it: one form, no default step for two implementers to disagree about, and no
  ambiguity when a contract observes the same operation more than once.
- A bound element variable is a deliberate step toward the expression language AD-26 refuses. It is fenced
  explicitly: one level of nesting, the bound element as the only relative addressing, no arithmetic, no
  projection, no user-defined functions. That fence is the whole safety argument and should be treated as
  load-bearing rather than stylistic.
- The compiler gains real work: resolving step references, rejecting a temporal clause that cannot be
  satisfied, and reporting an oracle whose steps are unreachable through the declared interfaces. The
  scorer gains observation matching, which is the first genuinely non-trivial algorithm in the package.
- The first epic's compiler stories change shape, which is the point of finding this before the epic
  rather than during it.
- The five `check` expressions in `spike-worked-example/` are the first ever written in this language.
  They are the only evidence that it can express what the discipline rules require, and any change to the
  grammar should be re-checked against them.
