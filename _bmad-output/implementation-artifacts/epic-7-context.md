# Epic 7 Context: the score reference implementation

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 7 opens v1 by closing the seven items the architecture spine's "Owed to the reference implementation" section names as open defects in the score half of the product. It implements AD-21, AD-33, and AD-40 as pure reference functions with generated fixtures, run against the worked chain plus synthetic records; the tables are emitted by the implementation rather than promised in prose. This makes the `score` stage (epic 8) buildable: repeated trials get a reducer, observation selection stops being ambiguous, cross-step and cross-user identity become expressible, each scoring mode gets its own ladder, uncited defect findings get a rung, and the stage-signature table's mode gap closes. `stage-table.ts` still carries `module: null` for `score` and `emit` when the epic ends; those stages and a `score` CLI command are epic 8's work. Two shipped surfaces change here: the generated AD-21 ladder gains an exit code and a `--strict`-promotion column per rung, and mode entering `ScoringVersionInputs` makes every scoring version computed before this epic non-comparable with every version after it.

## Stories

- Story 7.1: The run-mode source and the sealed run record's mode field
- Story 7.2: A monotonic observation sequence and declared selector cardinality
- Story 7.3: Captured-value matchers and test-data bindings
- Story 7.4: The AD-40 defect signature, corpus qualification, and the witness match
- Story 7.5: AD-33 as a total reference decision procedure with generated fixtures
- Story 7.6: The trial-set reducer and the AD-7 rate vector
- Story 7.7: Mode separation with two input types and two generated ladders
- Story 7.8: A rung for uncited defect findings, and the record it writes
- Story 7.9: Regenerate the worked chain and its probe corpus entry
- Story 7.10: The epic's disclosed breaks and the non-comparability statement

## Requirements & Constraints

- Mode is required on the sealed run record, supplied by the caller at ingest only, never derived or defaulted afterward; an absent mode fails ingest as a schema error.
- Every observation carries a required strictly-increasing `sequence`; ordering is read from it, never from array position. Every interaction step declares a selector cardinality (`exactly-one`, `at-most-one`, `any`); several matches under a single-valued cardinality is a named ambiguity, never silently resolved.
- Input bindings gain a fourth form: a cycle-free captured-value matcher over an earlier step's scalar output, plus `testData` principal and resource bindings for cross-user oracles. Principal bindings carry an opaque label only, no credential value.
- Every non-canary probe declares an AD-9 qualification record and an AD-40 defect signature (interface kind, home operation, observable channel, discriminating condition); an unqualified probe cannot enter a sealed corpus.
- Outcome-state resolution, the trial-set reducer, the rate vector, and both verdict ladders are each pure, total reference functions whose tables are generated in CI rather than hand-maintained.
- Production and contract-scoring modes get separate input types and separate ladders; cross-mode comparison is rejected as an AD-32 cross-artifact disagreement.
- An evaluator-discovered defect finding citing no oracle moves a verdict: at least CONCERNS in production mode, a dedicated `UncitedFindingGap` record in contract-scoring mode.
- Five interchange schemas change across the epic (sealed run record, eval contract, probe, evidence artifact, sealed evaluator brief); each touching story carries its own `schemaVersion` bump, `generate:schemas` regeneration, and AD-13's four CI checks, so no story depends on a later one to be releasable.
- Two new AD-5 codes, `binding-cycle` and `captured-channel-undeclared`, are appended to the registry table in the same diff that mints them, preserving `check:ad5-registry`'s set-and-order equality.
- The worked example is regenerated from the reference functions as a CI-checked command; no hand-filled downstream value is permitted.

## Technical Decisions

- **AD-6:** twelve closed outcome states, assigned only by AD-33's procedure. `unwitnessed-claim` (Story 7.4) routes to AD-21's Invalid rung, never to `missed`.
- **AD-33:** the outcome-state procedure reads ingested findings, per-oracle disposition, the AD-40 match result, Story 7.2's selection result, AD-4's three-valued check resolution, probe class, `expectedClean`, waiver state, AD-17's judge-conduct state, and AD-26's evaluation-fault signal. `bypassed` (a waiver applied without its condition met) and each outcome's corroboration value (`agrees`, `disagrees`, `not-evaluable`, kept distinct from AD-4's `insufficient-evidence`) are decided by construction in this epic. A satisfied `zero-action` probe resolves `caught`, never `passed-clean-control`.
- **AD-40:** detection is a deterministic witness match between a probe's discriminating condition (an AD-39 selector plus an AD-4 predicate over AD-26 response channels) and cited observations, with method and path-template comparison erasing parameter names first. Five results: `matched`, `manifested-unclaimed`, `unwitnessed-claim`, `unexercised`, `vacuous`; `unexercised` resolves `not-applicable` and `vacuous` resolves `infrastructure-error` under AD-6.
- **AD-9:** every non-canary probe qualifies by class (`defect`, `gameability`, `zero-action`, `canary`) plus `expectedClean` and a machine-readable defect signature; Story 7.4 builds the qualification gate AD-40's rule needs to fire against.
- **AD-7:** the reducer collapses a trial set to one result per `(probeId, trialIndex)`, then per probe by strict majority of valid trials; pass-if-any is rejected in code as the retry anti-pattern AD-6 forbids. The rate vector is unweighted, per probe class, four-valued dominance; a contract missing a floor-severity behaviour never dominates one that caught it. Comparability is the scoring-policy digest plus corpus digest restricted to shared probes.
- **AD-21 / AD-11:** mode fixes before ingest and enters identity as a sixth `ScoringVersionInputs` field, superseding the prior five-field statement. Production and contract-scoring get separate types (`ProductionAssessment`, `ContractAssessment`) and separate total, first-match-wins ladders with a closed exit-code table; `--strict` never promotes an all-evidence-condition CONCERNS.
- **AD-23 / AD-26:** defect findings carry cited observation identifiers and verbatim quoted evidence with channel. Absent evidence stays an observation rather than an error, which is why a captured pointer resolving `absent` makes the referencing step select `none` rather than fault.
- **AD-31 and AD-12 stay out of scope.** AD-31's predicates already run against a compile-side fixture corpus (Story 5.3); AD-12's validated half already shipped in `chain.ts`. Neither is reopened here.
- Ambiguities found mid-story are settled by construction in that story's dev notes rather than escalated into a new spine revision: Story 7.2's selector-ambiguity routing, Story 7.3's cross-step and principal-identity resolution, and Story 7.8's gap-record distinction from AD-31's `CoverageGap` are the epic preamble's own named examples.

## Cross-Story Dependencies

- Story 7.2's declared cardinality feeds Story 7.3's candidate-tuple resolution and is an input to both Story 7.5's decision procedure and Story 7.7's Invalid rung.
- Story 7.4's signature and witness match feed Story 7.5 directly; `unwitnessed-claim` routes to Story 7.7's Invalid rung, never to `missed`.
- Story 7.7 depends on Story 7.1's mode field, Story 7.2's ambiguity condition, and Story 7.4's `unwitnessed-claim` to keep AD-21's rung list closed.
- Story 7.8's uncited-finding rung lands in both ladders Story 7.7 builds.
- Story 7.9 regenerates the worked chain only once Stories 7.1 through 7.8 exist, as the first end-to-end evidence the reference functions agree with each other.
- Story 7.10 collects only the epic-level disclosure (NFR8's break statement, the non-comparability statement) each of Stories 7.1 through 7.8 already states locally via its own `schemaVersion` bump.
