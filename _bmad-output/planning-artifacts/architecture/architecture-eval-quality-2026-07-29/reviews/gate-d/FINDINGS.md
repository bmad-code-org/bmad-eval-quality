# Gate D — calibration spike result

Run 2026-07-30 under `PREREGISTRATION.md`, after Gate C closed at spine revision 9.

**Threshold: at least two seeded-defect catches in three valid repetitions. Result: all three arms
caught the defect in 3 of 3. PASS.**

## Reconstruction check

The absent local-only mut2 arm was reconstructed at base
`5b7c34e5dd4a95cfeff08929b0af687f2b71ebef`. The two recorded edits were restored: disjunctive
`matchesQuery` predicates and the recovered claim payload, including the fictional D. Halloway
sign-off. This is a disclosed reconstruction, not the original process.

Before any trial:

- the capsule baseline passed 17 of 17 tests;
- `occasion=formal` returned the recorded 2 capsules;
- `q=Rainy` returned the recorded 1;
- `q=Rainy&occasion=formal` returned the recorded 3;
- `q=Gala&favorite=true` returned the recorded 2;
- `occasion=casual&favorite=true` returned the recorded 2.

The counts and memberships reproduce the original black-box verification. Trial comparison is
therefore against the same recorded defect behavior rather than an approximation that only shares
source shape.

## Trial results

`TRIALS.json` preserves every action and finding.

| Arm | Trial | Valid | Composed-filter action | Seeded defect detected |
| --- | --- | --- | --- | --- |
| 1 — hand-written v2 positive control | r1 | yes | yes | yes |
| 1 — hand-written v2 positive control | r2 | yes | yes | yes |
| 1 — hand-written v2 positive control | r3 | yes | yes | yes |
| 2 — generated from current AD-3 fields | r1 | yes | yes | yes |
| 2 — generated from current AD-3 fields | r2 | yes | yes | yes |
| 2 — generated from current AD-3 fields | r3 | yes | yes | yes |
| 3 — generated with evidence precondition | r1 | yes | yes | yes |
| 3 — generated with evidence precondition | r2 | yes | yes | yes |
| 3 — generated with evidence precondition | r3 | yes | yes | yes |

Arm 2 r3's evaluator returned `valid: false` with the reason that a returned capsule failed the
supplied filters. The preregistered validity rule makes that the scored behavioral finding, not an
infrastructure or isolation failure. The orchestrator corrected the validity classification and did
not rerun the repetition.

Reducer:

- Arm 1: composed actions **3/3**; catches **3/3**; detects.
- Arm 2: composed actions **3/3**; catches **3/3**; detects.
- Arm 3: composed actions **3/3**; catches **3/3**; detects.

The positive control did not miss, so the run stands. The two generated arms did not both miss, so
the stop-for-Murat branch does not apply.

## Predetermined branch applied

Arm 2 reproduced detection. Per the branch frozen before execution:

- Owed-to-calibration item 1 closes;
- the generator is part of the product rather than an evidence-precondition field-set correction;
- `seal` joins the epic order;
- no evidence-precondition dimension is added to AD-3 from this spike.

Arm 3's identical 3-of-3 result gives no evidence that the additional dimension is necessary for this
behavior. It does not prove the dimension has no value elsewhere. This spike connects the current
generated direction to one behavior of one reconstructed controlled mutation; it does not validate
the historical 0.33-to-1.00 effect generally.
