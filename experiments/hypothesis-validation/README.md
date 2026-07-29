# The experiments behind the decision

This directory is the complete public-safe record of the two experiment rounds that produced
`eval-quality`'s product decision. It is closed. Nothing here is scheduled to run again.

The decision it fed is
`../../_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-22/ADR-002-contract-authoring-discipline.md`.
Operational detail, system identity, absolute paths, and credentials live in the owner-controlled
private evidence root and never in this tree.

## What was asked

Two questions. Whether an isolated black-box evaluator, given only a sealed Eval Contract, finds more
real defects than a builder's own evaluation. Whether custom semantic evaluators add value beyond
existing eval engines. The frozen protocol, gates, and decision rules are in
`HYPOTHESIS_VALIDATION_PLAN.md` in this directory, which the records here cite by section number.

## What was found

**Round 1, independent black-box evaluation: `DARK-FACTORY REJECTED`.** Under the binary all-gates
rule, multiple frozen gates failed: zero unique independent catches against a bar of three, recall
0.50 against 0.80, no cross-system coverage, and incomplete isolation manifests. The reduced corpus
also carried no naturally occurring defects, which narrows external validity without converting a
failed gate into a pass. Its sharpest single result was causal: changing one oracle in a sealed
contract, holding everything else fixed, flipped an evaluator from missing a defect to catching it.

**Round 2, contract-authoring discipline: `CONTRACT-DISCIPLINE NOT SUPPORTED`.** Four of five gates
passed. Pooled detection was 0.33 for plainly authored contracts against 1.00 for discipline-authored
contracts, over three naturally occurring defects, three repetitions per arm, 19 scored runs, equal
model and budget, 3 of 3 verdict stability, zero isolation violations. The safety gate failed on the
block's only clean control, a false FAIL traced to a measurement-harness gap rather than to the
contract misjudging.

## What the two rounds established

- Contract oracle authoring changes what a sealed evaluator finds, by a large margin on this sample.
  On two of three cases the plainly authored contract detected nothing across three repetitions, and
  in one of those it recorded the defective behaviour as a confirmation that the system handled it
  well.
- Evaluator isolation is not the source of the advantage. Two designs agree on this from opposite
  failure directions: in one round a self-evaluator instructed to verify empirically matched the
  sealed evaluator, and in the other a sealed evaluator with an underspecified oracle lost to both
  self arms.
- Coding agents do not leave naturally occurring defects in small, well-specified tasks. A corpus of
  natural defects has to be mined from version-control history.
- Ground truth for defect existence can be mechanical, using the fix's own test, once that test is
  shown to fail at the parent commit and pass at the fix. Two of eighteen mined commits failed that
  check, so the qualification step is what earns a case its status.
- Failures concentrate in the measurement layer. Across both rounds: a tautological test, a flaky
  baseline, two schemas that could not validate or compile, four environment fixture gaps, and two
  shipped fix commits whose own tests cannot detect the defect they were written for. The code under
  test was clean wherever it was not deliberately broken.

## Why it stopped here

A block 2 was designed to make the result conclusive: twelve qualified cases, all clean controls,
three repetitions, and a second model on a subset. It was fully preregistered on the corrected
instrument at ten cases and 144 sealed arms, and it was never run. The product owner judged that
round 2's evidence plus the diagnosed and fixed harness defects already settled what to build, and
that 144 more paid arms would serve an external certification claim rather than the decision. The
frozen block-2 preregistration stays in the private evidence root as a record rather than as a queued
run. Experimentation is closed and no certification pass is planned.

Phase C, the semantic-evaluator arm, never entered scope, so `DECISION.md` section 2 records no
evaluator-pack decision. ADR-002 defers those four hypotheses until the contract-authoring discipline
is in real use. [`agentevals-dev/agentevals`](https://github.com/agentevals-dev/agentevals) and
[Promptfoo](https://www.promptfoo.dev/) were named as the engine and baseline comparator for that
arm; no version was ever pinned and `preregistration/semantic.yaml` was never written.

## Reading the record

Start with `STATUS.md`, then `DECISION.md` sections 1, 1a, and 1b, then `results/summary.md`.
`PHASE2-RESULTS.md` holds round 2's gate table. Frozen controls live under `preregistration/`, raw
arm output under `results/raw/`, and the schemas every record validates against under `schemas/`.

## Public systems under test

- `couture-cast`: conventional system. Local checkout: `~/opensource/couture-cast`.
- `agentic-system`: agentic system. Public identifier only; real identity, path, and commands stay in
  the owner-controlled private input record. See `execution-inputs.yaml` for the opaque `privateRef`
  and digest.

## Validation

The closure amendment and public YAML parse cleanly, and both checksum packages verify. They use
different base directories, so each has its own command:

```bash
# from experiments/hypothesis-validation/
shasum -a 256 -c preregistration/h0-amendment-02-contract-quality.checksums.sha256

# from experiments/hypothesis-validation/preregistration/
shasum -a 256 -c h0-decision-amendment-03-binary-closure.checksums.sha256
```

The final schema sweep used Ajv 8.17.1 with `ajv-formats`, strict mode, and all eight schemas
registered by `$id`. All schemas compile. The seven mut2 schema-bound artifacts and three
contract-quality schema-bound artifacts validate with matching public artifact digests. The six
earliest run results and one earliest ground-truth record remain invalid because they contain
placeholder digests and missing artifact references. Treat those records as excluded unless they are
repaired. Details are in `STATUS.md` and `DECISION.md`.

`biome.json` excludes `experiments/` entirely from formatting. Byte-level formatting changes to the
Eval Contracts, labels, raw results, isolation manifests, and the digest-recorded H0 ground-truth
schema would invalidate their recorded SHA-256 values. Schema and artifact validation remains the
quality gate for those files.
