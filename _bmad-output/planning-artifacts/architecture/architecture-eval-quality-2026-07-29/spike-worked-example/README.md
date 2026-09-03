# The worked chain, regenerated. Not a conforming example. Read this before copying anything here.

These artifacts began as a hand-authoring exercise against spine revision 2, to find out what that
revision could not express. They succeeded at that: three of five oracles turned out to be inexpressible,
which is why ADR-006 and AD-39 exist.

**The five JSON files here are generated.** `npm run generate:worked-example` emits `eval-contract.json`,
`brief.json`, `probe.json`, `sealed-run-record.json`, and `evidence-artifact.json` by running the shipped
functions over the chain, and `npm run check:worked-example` compares the committed bytes against a rebuild
on every `npm run validate`. Do not hand-edit them; regenerate. The three prose files, this one,
`FINDINGS.md`, and `system-under-test.md`, are hand-authored, and the generator neither writes nor deletes
them.

Which functions: `compile` and `seal` from the compile half, `digestArtifact` for every digest the chain
pins itself with, `evaluateCoverage` for the coverage gaps, `validateLineageChain` for
`remediation.lineageChain`, and epic 7's score-side functions for everything else, from `sealProbeSet` and
`selectWithBindings` through `resolveOutcome` to `resolveContractVerdict`. `FINDINGS.md` lists them all.

The evaluator's own evidence is still authored, and so are nine further inputs. There is no live Notes API
in this repository, only `system-under-test.md`'s prose spec, so the contract, the probe's declarations,
and the run record's raw observations, dispositions, and findings are the evidence an evaluator is
stipulated to have collected. Beside them, `resolveOutcome` takes `waiver`, `judgeConduct`,
`evaluationFault`, and `required` per oracle, and AD-21's ladder takes `preflightPassed`, `overTruncated`,
`unavailable`, `internallyInconsistent`, and `isolationViolation`, all declared because no artifact in this
chain carries them. Several feed AD-21's Invalid tier. So the claim this folder makes is the narrower one:
every value the shipped functions can derive from the evidence is derived, and the nine declared inputs are
named in `FINDINGS.md`.

## The four defects this chain used to carry, and where each stands

1. **Closed.** The `malformed-write` step matches zero observations, and O-005's disposition cites none
   while narrating a 400 rejection that appears nowhere. It used to read `confirmed`/`agrees`. It now reads
   `unreached`/`disagrees`.
2. **Closed.** Only `baseline-read` genuinely matches two observations, and it declares `cardinality:
   "any"`. `read-back` carries `after: "write"`, and the selector floors its candidates at the anchor's
   `sequence`, so it matches exactly `obs-004` under `exactly-one`. The temporal clause is what separates
   the two reads.
3. **Fixed at the grammar level in spine revision 4, and observable in the chain for the first time here.**
   O-004's `for-all` over `notes: []` no longer certifies per-record completeness over zero records: AD-4
   resolves it `insufficient-evidence` with the `empty-collection` introduction condition, and AD-6 lands
   that on `abstained`.
4. **Closed.** The run cited `probeId: "P-001"` and nothing defined P-001. `probe.json` does: its class,
   the seeded defect D-001, an authored AD-9 qualification record, and an AD-40 defect signature. The
   generator runs the qualification gate and fails the build if P-001 is rejected.

## What must still not be copied out of here

The chain is regenerated. It is still deliberately defective in three places, and each one is kept as the
fixture some rule needs.

- **O-005's disposition narrates a rejection nothing observed.** The evaluator wrote "A tags value of the
  wrong type was rejected with 400 and ok false" and cited no observation, and no observation in the record
  shows a 400 at all. It is kept because it is the input AD-33's `disposition-unsupported` rule exists to
  catch, and deleting it would delete the fixture. Do not copy a disposition that narrates evidence it does
  not cite.
- **`obs-002` returns `notes: []` while the contract seeds three notes.** `testData.setup` declares "Seed
  exactly three notes with ids n-1, n-2, n-3", and `list-notes` declares `collectionLocations` with
  `expectedCardinality: { mode: "exact", count: 3 }`. The observation contradicts both, and the artifact
  records only O-004's abstain. That is deliberate: nothing at scoring time compares an observation against
  a declared cardinality. `expectedCardinality` is read by `compile/reachability.ts`, which bounds a
  root-collection index, and by `coverage/satisfaction.ts`, which grades declarations. No score-side
  function reads it, so a response short of its declared cardinality surfaces through whatever oracle
  happens to touch the collection, which here is an abstain. Do not read this chain as evidence that a
  declared cardinality is checked at scoring time.
- **Three AD-20 discipline rules are unsatisfied at `critical`.** `success-indicator-separation`,
  `malformed-input`, and `sibling-cross-check` all come back as unsatisfied coverage gaps.
  `FINDINGS.md`'s finding 9 says why each holds. This contract is a spike over a toy API and is not a model
  of a well-covered contract.

## The verdict moved, on evidence

The hand-typed artifact claimed CONCERNS. The regenerated one reads **FAIL**, because `abstained` is a
behavioural failure at the scoring policy's severity floor. That is the result, and it is the clearest thing
this folder now demonstrates: executing a decision procedure over an artifact chain finds what reading it
cannot, including reading it yourself. The consistency checker written to validate the original chain
reported success, because it checked shape and never asked whether the content supported its own claims.

`FINDINGS.md` carries the ten findings this exercise produced, the retraction, what closed each defect, and
three readings of the regenerated artifact that surprise a first-time reader. `system-under-test.md`
describes the toy API and its seeded defect.
