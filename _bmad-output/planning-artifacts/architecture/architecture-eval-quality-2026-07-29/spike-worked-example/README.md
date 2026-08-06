# Not a conforming example. Read this before copying anything here.

These artifacts were hand-authored to find out what spine revision 2 could not express. They succeeded at
that — three of five oracles turned out to be inexpressible, which is why ADR-006 and AD-39 exist — and they
are kept for that purpose only.

**The chain is known to be internally inconsistent and is deliberately left uncorrected.** Three defects,
each verified by re-running a matcher over these files:

1. The `malformed-write` step matches **zero** observations in `sealed-run-record.json`, yet O-005 is recorded
   `confirmed`/`agrees` in `evidence-artifact.json`, and its disposition narrates a 400 rejection that appears
   in no observation.
2. The `baseline-read` and `read-back` steps each match **two** observations with identical operation and
   inputs, so two conforming scorers can bind different evidence and reach opposite answers from this one
   sealed record.
3. O-004's `for-all` runs over an empty collection and is vacuously true, certifying per-record completeness
   over zero records while this contract's own `testData.setup` declares three seeded notes.

Spine revision 4 fixes defect 3 at the grammar level — AD-4 now resolves an empty-collection `for-all` to
false. Defects 1 and 2 are downstream of observation-selection semantics that revision 4 records as open in
*Owed to the reference implementation*, so hand-patching them would fabricate conformance rather than
demonstrate it. The chain gets regenerated from the reference reducer once that exists, with hand-filled
downstream values forbidden, or not at all.

`FINDINGS.md` carries the full retraction and the ten findings this exercise produced. `system-under-test.md`
describes the toy API and its seeded defect.

The one honest lesson to take from this folder: executing a decision procedure over an artifact chain finds
things that reading it cannot, and that includes reading it yourself. The consistency checker written to
validate this chain reported success, because it checked shape and never asked whether the content supported
its own claims.
