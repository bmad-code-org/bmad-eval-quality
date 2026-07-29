# Phase 2: natural-defect corpus and hermetic black-box surface

_Written 2026-07-27, after the H0 closure. Public-safe. The corpus source, harness code,
fixtures, and probe outputs live in the private evidence root, per the plan's public/private
boundary. This file records only method, counts, and verified outcomes._

## Why Phase 2 exists

H0 closed as `DARK-FACTORY REJECTED` on a sample that could not have reached
`DARK-FACTORY VALIDATED`. Gate 1 requires at least 3 defects whose adjudicated source is
`natural`, and plan section 9 bars controlled mutations from that gate. The reduced pass produced
zero natural defects, so the pass condition was unreachable before the first arm launched.

Two constraints caused that:

1. **No natural-defect supply.** Builder agents returned clean, well-tested implementations on
   3 of 4 small, well-specified tasks. Both mutation attempts on the `agentic-system` side were
   killed immediately by builder-written tests.
2. **No reproducible black-box surface for `agentic-system`.** Its evaluator arms never ran,
   blocked on an expired cloud session, and its live upstream is neither deterministic nor
   always reachable.

Phase 2 removes both.

## Method change 1: corpus mined from version-control history

Each case is a real bug-fix commit. The commit's parent is the defect-bearing implementation.
The fix's own test set is the ground-truth oracle.

- The defect source is `natural` by construction, so gate 1 becomes reachable.
- Ground truth stops being an adjudication. The oracle is a test that shipped with the fix.
  This retires the agent-only-ground-truth integrity concern recorded in `DECISION.md`
  without requiring a second rater.
- Supply is effectively unbounded relative to experiment size.

**Validation rule per case, fully mechanical:** at the parent commit, with only the fix's test
files applied, the test must fail on assertions. With the fix's source applied, it must pass.
Cases whose test cannot resolve its imports at the parent commit are rejected as unusable
rather than counted.

**Result on the `agentic-system` corpus:** 861 commits scanned, 169 bug-fix candidates,
51 of those also touch a test file, 18 triaged as behavioural fixes with real source changes,
and **16 of 18 validated as usable**.

**Byproduct finding, real rather than injected:** 2 of the 18 are `TEST_BLIND`. Their fix
commit's own tests pass at the parent commit, so those tests cannot detect the defect they were
written for. This is the same class as IF-001 from the mut2 round, now surfaced automatically by
the validation rule instead of by inspection.

## Method change 2: hermetic black-box surface

The system under test now runs against a local stub upstream instead of a live environment.

- The stub serves deterministic fixtures on the loopback address the repository's own tests
  already default to, so no cloud session, credential refresh, or shared environment is involved.
- Per-case scenario fixtures are derived from the test each fix added, so the black-box arm
  observes the same behaviour the ground-truth oracle asserts.
- A real protocol client authenticates and drives the tool interface, so an evaluator arm sees
  only the product's public surface.

**Verified:** the surface boots and serves the full tool set with no cloud dependency.

## Method change 3: black-box observability gate per case

A defect only qualifies if it is visible through the public interface. The gate is automated:
probe the tool at the parent commit, probe it at the fix, and diff the responses. A difference
qualifies the case and yields the exact observable signal an oracle must target.

**First case validated end to end:** a fix for an applied rule carrying no internal identifier.

- At the parent commit the tool reports success, warns that one applied rule could not be
  fetched, and then states that no rules matched. A caller receives a success verdict with a
  contradictory body.
- At the fix the tool reports failure with an explicit message naming the unfetched rule.
- The difference is observable through the tool interface, so the case qualifies.

That parent-commit behaviour is worth noting on its own: an agent consuming this tool would read
success and an empty result, which is exactly the class of defect a deterministic suite passes
over and a black-box evaluator can catch.

## What Phase 2 measures

The measured object moves from the evaluator to the contract. Per case, two sealed arms at equal
model, budget, and black-box access:

- **Arm A:** an Eval Contract authored plainly from the task description.
- **Arm B:** an Eval Contract authored under the oracle-authoring discipline, requiring
  composition and discriminating evidence.

The single variable is the contract-authoring method. Evaluator isolation becomes a held
control rather than the hypothesis. Self-evaluation and the deterministic suite remain as
comparison arms, so the original H0 comparison rides along on natural defects for free.

Primary metric is **contract detection rate**: the share of qualified natural defects whose
oracles cause the sealed evaluator to take the action that exposes the defect, reported per
defect class and across repetitions.

## State

- Corpus mining, case validation, hermetic surface, and the observability gate are built and
  verified.
- Case fixtures: 1 of the target set authored and confirmed observable.
- Contracts, sealed arms, preregistration, and scoring remain to be done.
- Written while the tree was excluded from git at the owner's instruction. That exclusion was lifted
  on 2026-07-28 and the experiment record is now tracked.

## Next actions, in order

1. Author scenario fixtures for the remaining qualified cases and record each observability diff.
2. Write the two contract variants per case from the observable signal, without naming the defect.
3. Preregister the block: case list, contract digests, model snapshot, budgets, arm order,
   metrics, and gates. Freeze before the first arm.
4. Run the sealed arms, one fresh session per arm, and seal every result with real digests.
5. Score, then record the verdict and revise the brief and PRD only from what passes.
