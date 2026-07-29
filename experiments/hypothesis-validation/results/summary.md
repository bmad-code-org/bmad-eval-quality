# H0 Results Summary — 2026-07-27 reduced-scope pass

Status: **DARK-FACTORY REJECTED**. H0 requires every frozen gate to pass. Multiple gates failed.
See `DECISION.md` and
`preregistration/h0-decision-amendment-03-binary-closure.yaml`. This file is the plan-required
"quotas, exclusions, deviations, every preregistered metric" report for what actually ran.

## Quotas vs. what actually ran

| Plan design | This run |
| --- | --- |
| 12 H0 tasks (6/system) | 4 tasks (2/system) |
| 8 defect-bearing, 4 clean | 1 controlled-mutation defect, 3 clean (natural builder output) |
| 3 repetitions per condition | 1 repetition per condition |
| Ground-truth authority | Orchestrating Test Architect. Human reviewers are not required under the owner override |
| Scripted-baseline condition | Only structurally verified (agentic-system's existing eval suite exists and is applicable); never actually run against these 2 tasks |

Every reduction above was an explicit owner decision (Murat, 2026-07-27), not a silent shrink —
see STATUS.md confidence blocks and DECISION.md for when/why each was made.

## What ran and what it found

- **cc-h0-01 (couture-cast, garment ownership), clean round:** self PASS, independent PASS. 0
  findings above low severity. Ground truth: clean.
- **cc-h0-01, mutated round (D-001 injected — list endpoint stopped scoping by user):** self FAIL
  (caught it), independent FAIL (caught it). **Not a unique catch** — self-eval caught it in its
  one repetition, which fails the H0 uniqueness bar (needs a miss in the self-eval condition).
- **cc-h0-03 (couture-cast, capsule CRUD/search):** self PASS, independent PASS. Clean, no unique
  catches (there was nothing to catch).
- **as-h0-01 (agentic-system, list-tool pagination):** builder implementation clean per
  code-read + independent deterministic-suite re-run (1000/1000 passing). Two mutation attempts
  against its logic were both caught immediately by the existing deterministic test suite and were
  reverted rather than scored. **No self/independent evaluator condition ever ran** — blocked on an
  expired AWS SSO session needed to reach live upstream data.
- **as-h0-02 (agentic-system, rule-stats exclusion filter):** same status as as-h0-01 — clean,
  deterministic-suite verified, one mutation attempt caught by tests and reverted, no live
  evaluator condition ran.

## Exclusions

- No scripted-baseline condition was actually executed (structural applicability confirmed only).
- No Phase C (semantic evaluators H1-H4) work was attempted — explicitly out of scope for this
  reduced pass.
- Deterministic condition ran once per task (matches reduced scope), not the plan's default.

## Metrics against the section 9 H0 gate

| Gate | Result |
| --- | --- |
| ≥3 unique material catches, self/baselines missed | **0.** Not met. |
| Catches span both systems | Not met (0 catches at all; agentic-system side never ran live). |
| Precision ≥0.85, recall ≥0.80 | Not computable — no catches to compute precision/recall over. |
| 4 clean cases: 0 false FAIL, ≤1 false CONCERNS | Met for the 3 clean cases actually run (cc-h0-01 clean round, cc-h0-03, and both agentic-system tasks' deterministic-only check) — all correctly PASS, no false positives. |
| ≥1 defect via evaluator-chosen action absent from a fixed baseline | Not applicable — no scripted baseline was actually run to compare against. |
| Isolation manifests complete, zero violations | Not formally instrumented this pass — self/independent context separation was maintained via fresh Agent-tool sessions per the plan's isolation intent, but no isolation-manifest JSON was generated per run (documented gap, see STATUS.md). |
| ≥1 finding changes a real ship/remediation decision | Arguably yes in spirit — the injected D-001 bug is exactly the class of thing that would block a real ship decision — but it was a controlled mutation, not a naturally-shipped defect, so it doesn't satisfy the "real" qualifier as written. |
| Stability ≥0.90 across 3 reps | N/A — single repetition only (disclosed deviation). |

**Conclusion: H0 does not clear its gate. The binary result is DARK-FACTORY REJECTED.** The reduced
sample limits generalization, while the all-gates rule still determines the product evidence
decision. eval-quality cannot claim that isolation itself creates a dark-factory advantage.

## One finding worth carrying forward regardless of H0's outcome

When a self-evaluator's prompt explicitly requires actually exercising the running system via
black-box calls (not just reading code), it performed on par with a fully isolated independent
evaluator on the one real defect this run produced. That's a real, disclosed result about prompt
design mattering — independent of whatever this experiment ultimately decides about the isolation
boundary itself.

---

# Addendum: mut2 round — 2026-07-27, later the same day

Preregistration: `preregistration/h0-amendment-01-mut2.yaml` (owner-approved, written and digested
before the mutation was applied and before any arm ran). No gate, metric, or threshold was changed.

## What mut2 tested and why

mut1 was an API authorization defect and both conditions caught it, so it produced no evidence about
the isolation boundary either way. mut2 tested a different defect class: an **unsupported-claim
defect**, where builder-side material asserts a behavior was verified and the behavior is broken.
The theory under test was that an evaluator holding the builder's artifacts would accept an
unverifiable claim at face value, where a sealed evaluator with nothing to trust would have to
establish the behavior empirically.

A third arm was added to test that theory fairly. The frozen self-evaluator prompt mandates live
black-box exercise, so it cannot be influenced by a claim. Rather than weaken it, the amendment added
a `self-review` arm representing ordinary review posture (read the diff, the tests, the author's
notes; live exercise permitted, not mandated) and ran both. Equal model snapshot and equal ceilings
across all three arms.

## The defect

`cc-h0-03`, `capsule.service.ts` `matchesQuery`: filters combined with a disjunction
(`predicates.some(Boolean)`) where the semantics require a conjunction. Single filters behave
correctly; two or more filters return capsules matching any one of them.
`?q=Rainy&occasion=formal` returns 3 where the correct answer is 0. Ground truth: D-001, B-002,
`material`, source `controlled-mutation`. Full oracle evidence:
`results/raw/mutation-verification-cc-h0-03-mut2.md`.

Verified invisible to the deterministic baseline empirically, 17/17 capsule specs green on three
consecutive runs with the mutation applied.

## Result

| Arm | Verdict | D-001 | How it was found |
| --- | --- | --- | --- |
| `deterministic` | PASS | missed | 17/17 green; the suite structurally cannot see it |
| `self` (frozen, condition of record) | FAIL | **caught** | read the diff, saw `predicates.some`, confirmed live with a combined-filter probe |
| `self-review` (exploratory, added arm) | FAIL | **caught** | read the diff, reasoned AND→OR, confirmed live; chose to exercise live though not required |
| `independent` (sealed) | **PASS** | **missed** | never sent two filter parameters in one request |

**The sealed arm produced a false PASS on a material defect, and the run is valid.** Isolation
manifest clean (`violation: null`, observed mounts limited to its own two output files, observed
network limited to `localhost:4002`), 25 of 40 tool calls used. It was not lazy: it discovered the
capsule schema by trial, discovered the `q`/`occasion`/`favorite` parameter names by probing,
exercised create-and-retrieve, the favorite round-trip, cross-user list and search, an IDOR attempt
on another user's capsule, and delete-endpoint discovery. Verified by grep across its full action
log: zero multi-filter requests.

## Why it missed, and this is the finding

B-002's frozen oracle reads: *"Create 2+ capsules with distinguishable names or tags. Call
search/filter with a query matching only one. Only the matching capsule must be returned."* That
describes a **single-filter** probe. The sealed arm executed its oracle faithfully and correctly and
passed. The oracle was underspecified for this defect class.

Both self arms found the defect by reading the diff. Neither started from the contract. The claim
payload, intended to mislead them, functioned as a **pointer to where the bug was**: both arms cited
the "every combined-filter permutation was verified" claim as what drew their attention to the
combined-filter case specifically. Isolation removed that pointer along with the deception.

The `self-review` arm additionally caught a factual error in the orchestrator's own claim payload
(the notes claim 24 capsule specs; the suite has 17), which is evidence of genuine scrutiny rather
than credulous claim acceptance.

**The limiting factor on independent-evaluator recall in this round was oracle quality, not the
isolation boundary.** A sealed evaluator can only be as thorough as its contract's oracles direct it
to be, plus whatever it improvises. Here it improvised extensively on the wrong axes (auth, IDOR,
schema discovery, delete semantics) and never on filter composition, because nothing in the contract
pointed there.

## mut2 metrics against the section 9 gate

Scoring unit is an adjudicated material-or-critical defect ID. Condition of record for
unique-catch arithmetic remains the frozen `self` arm, per the amendment.

| Metric | mut2 result |
| --- | --- |
| Independent material findings emitted | 0 (its single finding was severity `low`) |
| Independent precision | **N/A** — zero material findings emitted, so the denominator is zero. Reported as undefined rather than as a vacuous 1.00 |
| Independent recall | **0.00** — D-001 detected in 0 of 1 valid independent repetitions |
| Unique independent catch | **0** — independent missed it entirely; `self` caught it, so uniqueness fails on both counts |
| Independent task verdict vs. expected gate | PASS against `expectedGate: FAIL` — a false PASS on a defect-bearing implementation |
| Isolation manifest | **Complete and violation-free.** First real isolation manifest produced in this experiment |

## Cumulative H0 tally across the full reduced-scope pass (mut1 + mut2)

| Gate | Result |
| --- | --- |
| 1. ≥3 unique real material catches | **0.** Fails. Both mutated rounds produced zero unique catches, for opposite reasons: mut1 the self arm also caught it, mut2 the independent arm missed it |
| 2. Catches span both systems | **Fails** (0 catches; the agentic-system side still never ran live) |
| 3. Precision ≥0.85 and recall ≥0.80 | **Recall 0.50** (1 of 2 adjudicated material/critical defects). Fails regardless of precision reading |
| 4. Clean cases: 0 false FAIL, ≤1 false CONCERNS | **Passes.** Both clean rounds (cc-h0-01, cc-h0-03) returned PASS from both conditions |
| 5. ≥1 material defect via evaluator-chosen action absent from a fixed baseline | **Passes on mut1** (independent found the authz bug live where the deterministic suite structurally could not). Not satisfied by mut2 |
| 6. Every independent run has a complete violation-free isolation manifest | **Fails overall.** Satisfied for mut2; the three earlier independent runs have no manifest on disk |
| 7. ≥1 finding changes a real ship/remediation decision | Owner's judgment call. IF-001 and IF-002 below are the strongest candidates, and both are real rather than injected |
| 8. Stability ≥0.90 across 3 reps | N/A, single repetition (disclosed) |

### Note on the precision denominator

mut1's independent record emitted three findings at `material` or above, of which one mapped to a
defect; the other two were confirmations that a behavior **holds** ("upload-then-read-back works",
"persistence holds"), recorded as findings with `material` severity. Read strictly against the plan's
formula, that gives precision 1/3 = 0.33. Read charitably, excluding positive confirmations from the
denominator, 1/1 = 1.00. Both readings are reported because the underlying cause is a convention
defect worth fixing rather than arbitrating: the run-result schema has no field distinguishing "this
behavior holds" from "this behavior is broken", so confirmations and defects both land in `findings`
and silently corrupt precision. Recommend a `findingType` discriminator before any further scored
round.

## Incidental findings from the mut2 round, both real rather than injected

- **IF-001 (material, test quality).** The builder's own `combines name and occasion filters` test is
  structurally incapable of failing when the conjunction breaks: its non-matching fixture fails both
  predicates, so AND and OR produce identical result sets. It asserts inclusion of a full match
  without asserting exclusion of a partial match, making it tautological with respect to the operator
  it is named for. This is shipped code, found by inspection, and it is what made mut2 viable. The
  `self-review` arm rediscovered it independently.
- **IF-002 (flaky deterministic baseline).** `capsule.controller.spec.ts > never exposes one user
  capsules to another user (AC5)` failed once with `read ECONNRESET`, then passed three consecutive
  times with no code change. Observed flake rate 1 in 4. Not caused by the mutation (verified). This
  matters beyond hygiene: H0 scoring rests on the claim "no correct material finding from any
  applicable deterministic baseline", and a baseline that intermittently fails for transport reasons
  weakens that claim's evidentiary value.

## Artifact hygiene status

First real `ajv` validation run of this experiment (the plan required it at Phase A step 4; STATUS.md
recorded it as never done). Results:

- All 7 mut2 artifacts validate: 3 run-result records, 3 isolation manifests, 1 ground-truth record.
- The 6 pre-existing run-result records and 1 pre-existing ground-truth record **fail** validation,
  all on the same cause: placeholder digests of 61 zeros where the schema requires 64 hex characters.
- 13 artifact references across those pre-existing records point at files that do not exist on disk.
- Two additive schema corrections were required and are disclosed in the amendment: the `condition`
  enum did not include `self-review`, and `additionalProperties: false` rejected the `note` field
  that every pre-existing record already carried, meaning none of them could ever have validated.

mut2's records carry real computed digests for every artifact reference, and every referenced file
exists. Retrofitting the 7 pre-existing records is a separate owner decision.

## What mut2 can and cannot support

D-001's source is `controlled-mutation`, so per section 9 it measures recall, safety, and inter-arm
discrimination and **cannot** count toward the three-real-defect gate. No mut2 outcome could have
moved H0 to VALIDATED. What it does support is a mechanism claim: on this defect class, sealed
black-box evaluation underperformed claim-holding review, and the cause was traceable to oracle
specification rather than to the isolation boundary.

---

# Addendum: contract-quality round, 2026-07-27

Preregistration:
`preregistration/h0-amendment-02-contract-quality.yaml`. Murat explicitly approved it at
`2026-07-27T10:17:48-05:00`; the checksum package verified before launch.

## What changed

The original and strengthened Eval Contracts differ in exactly one JSON value: B-002's oracle.
The v2 oracle requires filter-composition evidence that distinguishes a full match from partial
matches. It does not name the mutation, implementation operator, known leaking query, defect ID,
ground truth, prior result, or existing test data.

The task, source-spec digest, mutation, ground truth, behavior description, risk hypotheses, prompt
template, evaluator model, budgets, credentials, and API base URL stayed fixed.

## Paired result

| Measure | Contract v1 | Contract v2 |
| --- | --- | --- |
| Run ID | `cc-h0-03-independent-mut2` | `cc-h0-03-independent-mut2-contract-v2` |
| Contract digest | `sha256:56b032a1...` | `sha256:4019461b...` |
| Valid run | yes | yes |
| Composed-filter requests | 0 | 2 total; 1 valid decisive probe |
| Verdict | PASS | **FAIL** |
| D-001 | missed | **caught by F-002** |

The decisive v2 evidence is:

1. A composed `occasion` plus `q` request returned the full-match capsule and a capsule matching
   only `occasion`.
2. The `q`-only control returned only the full match.
3. The `occasion`-only control returned both capsules.

This isolates the failure to filter composition and maps F-002 to adjudicated D-001 through B-002.

## Validity and resources

| Check | Result |
| --- | --- |
| Main evaluator model | canonical `claude-sonnet-5` on every assistant message |
| Isolation | violation-free |
| External tools | 29 local curl calls and 2 approved writes |
| Final serialization | 1 caller-internal structured-output emission |
| Total tool calls | 32 of 40 |
| Wall clock | 275.766 seconds |
| Input tokens | 697,644 including cache traffic and CLI internal overhead |
| Output tokens | 29,709 |
| Cost | $0.9307383 |
| Network | `localhost:4002` only |
| Permission denials | 0 |
| Ajv and artifact digest validation | pass |

Claude Code 2.1.220 crashed in its macOS updater helper before model contact. The installed 2.1.219
binary launched the exact preregistered model. Claude Code reported $0.002439 of auxiliary
`claude-haiku-4-5` internal overhead. No assistant message, evaluator reasoning, tool selection, or
finding came from that auxiliary model.

The agent-authored Markdown log abbreviates some long response fields. It remains unchanged. A
mechanically derived redacted HTTP JSONL trace preserves every full curl request and tool response,
so the Eval Contract's verbatim-evidence requirement is satisfied.

The final strict Ajv sweep found a latent compile defect in `h0-ground-truth.schema.json`:
`maxItems` appeared in the clean-case conditional without a local `type: array`. The root property
already declared the same type, so adding it changes no accepted record. After correction, all
8 schemas compile in strict mode and all 7 mut2 artifacts plus the 3 contract-quality schema-bound
artifacts validate with matching public references. This is recorded as IF-005 in `DECISION.md`.

## Metrics

Every v2 finding carries the new `findingType` discriminator:

| Finding type | Count | Precision treatment |
| --- | ---: | --- |
| `defect` | 1 | enters denominator |
| `confirmation` | 3 | excluded |
| `observation` | 1 | excluded |

F-002 is the only alleged defect and correctly maps to D-001. Case-level defect precision is
**1/1 = 1.00**. D-001 recall changes from **0/1 under contract v1** to **1/1 under contract v2** for
this paired case.

## Decision impact

Amendment 02's causal-support rule passes. The stronger oracle caused the sealed evaluator to take
the missing composition action and catch D-001. The prior oracle-quality explanation is now directly
demonstrated for one case.

The frozen H0 metrics do not change:

- Unique independent catches remain **0**.
- Frozen-condition recall remains **0.50** across mut1 and mut2.
- D-001 remains a controlled mutation and cannot satisfy the real-defect gate.
- The contract-quality run is a post-mut2 mechanism test. It cannot be retroactively substituted
  for the original frozen condition.
- H0 remains **DARK-FACTORY REJECTED** under the binary all-gates rule.

The supported scope is narrow: contract and oracle authoring controlled recall for this mutation,
task, and repetition. Reliability across repetitions and generalization across defects, tasks, and
systems remain untested.

## Cleanup residue

The v2 arm created two clearly named capsules. It attempted three cleanup routes; all returned 404
because no DELETE route is exposed through the permitted capsule API. Both records remain under
`guardian-1` with favorite state false. Their IDs and exact cleanup attempts are in the action trace.

Evidence:

- `results/raw/cc-h0-03-independent-mut2-contract-v2.json`
- `results/raw/cc-h0-03-independent-mut2-contract-v2-http-trace.jsonl`
- `results/raw/cc-h0-03-independent-mut2-contract-v2-actions.md`
- `results/raw/cc-h0-03-independent-mut2-contract-v2-agent-output.json`
- `independent-evaluator/isolation-manifests/cc-h0-03-independent-mut2-contract-v2.json`
- `results/raw/cc-h0-03-contract-quality-comparison.json`
