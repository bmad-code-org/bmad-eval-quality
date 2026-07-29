---
title: Phase 2 block 1 result, contract-authoring discipline
status: scored
date: 2026-07-27
---

# Phase 2 block 1: contract-authoring discipline

Public-safe. Corpus source, harness, fixtures, contracts, and raw arm output live in the private
evidence root per the plan's public/private boundary.

Preregistration: `preregistration-contract-discipline.md` in the private evidence root. Gates,
metrics, and the binary decision rule were fixed before results were read and are unchanged.

## Verdict

**CONTRACT-DISCIPLINE NOT SUPPORTED.** Four of five preregistered gates passed. The safety gate
failed, and the rule is all-gates.

This is a block-level verdict on 19 scored repetitions. It is not a refutation of the hypothesis,
and the distinction is load-bearing: the gate that failed did so because of a defect in the
measurement harness, not because the disciplined contract misjudged the system.

## What was measured

Real bug-fix commits from one system's history. Each case is the commit before a fix, with the fix's
own test set as the ground-truth oracle, so every defect source is natural. Two sealed evaluator
arms per case at equal model, budget, and black-box access, three repetitions each. The single
manipulated variable is how the Eval Contract was authored. Neither contract names the defect.

| Case | Defect as seen through the interface | Plain contract | Disciplined contract |
| --- | --- | --- | --- |
| C1 | A partly-unresolvable request reports success and returns a body that both warns of the omission and states nothing matched | 1.00 (3/3) | 1.00 (3/3) |
| C2 | Identifier inputs accept path separators, relative-path segments, and percent-encoded forms without boundary rejection | **0.00 (0/3)** | **1.00 (3/3)** |
| C3 | Returned records omit the navigable reference needed to open the underlying record | **0.00 (0/3)** | **1.00 (3/3)** |
| Pooled | | **0.33** | **1.00** |

Secondary measure, defect findings per repetition: 1.67 plain, 3.44 disciplined.

## Gate table

| Gate | Result |
| --- | --- |
| 1. Disciplined pooled detection exceeds plain by at least 0.33 | **PASS**, delta 0.67 |
| 2. At least 3 natural defects each detected in at least 2 of 3 repetitions | **PASS**, 3 of 3 cases |
| 3. Zero false FAIL from the disciplined arm on fixed-code controls | **FAIL**, 1 of 1 control |
| 4. Disciplined verdict stability at least 2 of 3 per case | **PASS**, 3/3 on every case |
| 5. Zero isolation violations | **PASS**, 0 across 19 runs |

## The two results worth keeping

**Contract authoring moved detection, and the mechanism is visible in the transcripts.** On C2 all
three plain repetitions returned FAIL for unrelated reasons and none raised the validation gap; one
explicitly recorded the acceptance of a traversal-shaped identifier as a confirmation that the tool
handles adversarial input gracefully. All three disciplined repetitions caught it, and all three
independently identified that one identifier parameter was strictly constrained while its sibling
was not, which is what the real fix addressed. On C3 the plain arm missed the missing reference
three times out of three while the disciplined arm found it three times out of three. Same model,
same budget, same system, different contract.

**Every failure in this experiment was in the measurement layer.** The harness produced a spurious
critical defect on C2 through a missing upstream route, contaminated C3 through three further
fixture gaps, and caused the only false FAIL in the block. Two of eighteen mined fix commits turned
out to be test-blind, their own tests passing at the parent commit. Earlier rounds produced a
tautological test, a flaky baseline, a schema that could never validate, and a schema that would not
compile. The product code under test was clean wherever it was not deliberately broken.

That is now the most repeatedly confirmed finding of the whole effort, across two independent
experimental designs. The scarce and difficult asset is a trustworthy oracle, not working code.

## Limits, stated plainly

- Three cases, one system, one model, three repetitions. Not a basis for a general claim.
- Two of three cases carried harness confounds affecting both arms equally. The paired comparison
  survives, and the absolute precision figures do not.
- One clean control was run rather than three. The other two were not executed.
- Ground truth is a shipped test rather than an independent rater. That is stronger than an
  adjudicated opinion for defect existence and says nothing about severity judgement.

## Rule added for the next block

A hermetic environment must be defect-free except for the seeded defect. Before any arm runs,
exercise every tool the contract can reach and confirm the only anomalous response is the seeded
one. Treat every unexplained anomaly as a harness defect until proven otherwise. This one rule
would have converted this block from four-of-five to a clean scored result.

## Next block, if it runs

Author complete per-case fixtures for the 12 remaining qualified candidates, verify the full happy
path per case, then repeat the same two-arm design at three repetitions with all three clean
controls. The design needs no change. The instrument does.
