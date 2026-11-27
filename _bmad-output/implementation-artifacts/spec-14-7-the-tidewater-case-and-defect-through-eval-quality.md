---
title: 'The Tidewater case and defect through eval-quality'
type: 'chore'
ticket: '14-7-the-tidewater-case-and-defect-through-eval-quality'
created: '2026-11-26'
status: 'done'
baseline_revision: '74f92922e92daf9989850c08b2530cdfb5a0009b'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-14-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-14-5-a-planted-defect-caught-for-the-reason-it-was-planted.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 14.5 showed that Toolsmith's `tidewater-prd` rubric passes a copy of a clean Shard Pro output with one FR-WO-015 line deleted, because rubric line 1 accepts the kept `.source/` copy. The owner told Toolsmith's maintainer the same case and defect would go through eval-quality next, so the two tools can be compared side by side.

**Approach:** Write the case's rubric lines, and the line Story 14.5 proposed, as an eval-quality contract. Run `compile`, `seal`, `preflight` and `score` from this checkout over Story 14.5's graded folders `g01` to `g04` and two hand-built degenerate outputs, with no model call. Record each check per folder, what the contract had to declare, what eval-quality cannot express, a side-by-side table and a short draft for the owner's note.

## Boundaries & Constraints

**Always:** Inputs are Story 14.5's graded folders, the fixture copy inside them and their `grading.json` files. eval-quality runs from this checkout's build at the baseline revision. Raw evidence stays under `<evidence-dir>/14-7-*`; this record holds commands with placeholders, digests, counts and checked excerpts, and no absolute path. A finding about eval-quality itself goes to `deferred-work.md` and to the coordinator.

**Ask First:** None; the coordinator delegated approval of this plan.

**Never:** Start an agent run, a grader run or any other model call. Change `src/`, `schemas/`, the CLI, a gate, `eval-quality.config.json`, the corpus or the docs. Touch BMAD-METHOD or send anything to anyone. Touch Story 14.6's worktree or ledger line.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clean output | `g01`, `g02`, `g03` read by the collector | Each oracle's `checkResolution` recorded; the FR-WO-015 oracle holds on all three | A check that fails on a clean output is reported with the 14.5 grade beside it |
| Poisoned copy | `g04` | The sampled line 1 oracle holds; whether any oracle fails is recorded | None expected |
| Degenerate outputs | `g01` reduced to its source copy, with no shard or with one title stub | Which oracles hold on an answer that keeps only the original | None expected |
| Before any run | `compile --strict` and `preflight` on the contract | Whether either reports the weak line 1 acceptance, yes or no | A refusal is recorded with its code |
| eval-quality defect | Any `score` result that contradicts a documented rule | One `deferred-work.md` entry and a message to the coordinator | No source change |

</frozen-after-approval>

## Code Map

- `docs/how-to/evaluate-skill-behavior.md` -- the skill form the contract follows: a `cli` interface, the decision printed as JSON on stdout, one oracle per behavior (`:332-347`), and the stated limit that a defect signature cannot address a written file (`:371`, `:539`).
- `_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md` -- AD-40 (`:528ff`): a finding counts as detection when it cites an observation the probe's signature matches; AD-3 keeps the `check` out of every outcome state.
- `src/core/schemas/expression.ts:66-84` -- the closed operator, connective and quantifier sets; `:116`, the bounded regex, whose nested quantifiers always fault.
- `src/core/evaluate/operators.ts:139-167` -- `containment` is a substring test on strings (`:157`) and needs a pointer as container.
- `src/core/evaluate/resolution.ts:192-200` -- `anyOf`: a `true` sibling never rescues one that examined nothing.
- `src/core/score/outcome.ts:462`, `:492`, `:500` -- `clean-control-false-positive`, `witness-matched` and `witness-manifested-unclaimed`: catches come from the evaluator's findings, checked against the probe signature.
- `src/core/score/ladder.ts:220-225` -- `missed`, `abstained`, `bypassed` and `false-positive` reach FAIL.
- `src/core/score/score.ts:260-278` -- `judgeConductOf`: "no schema field maps a rubric criterion to an oracle".
- `src/core/preflight/plan.ts:508-570` -- the two seeded-fault checks pre-flight adds per defect probe.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- this story's ledger key.

## Tasks & Acceptance

**Execution:**
- [x] `<evidence-dir>/14-7-tools/collect.py` -- print one graded folder as JSON on stdout -- a file-only output needs a stream for probes.
- [x] `<evidence-dir>/14-7-tools/contract.mjs` -- author the contract from the fixture -- the case's checks.
- [x] `<evidence-dir>/14-7-tools/build.mjs` -- build observations, probes, evaluator configuration, isolation manifests and records; run seal, preflight and score -- the chain.
- [x] `_bmad-output/planning-artifacts/epics.md`, `epic-14-context.md`, `sprint-status.yaml` -- add Story 14.7 -- the ticket.
- [x] this file -- Evidence, the side-by-side table and the owner's draft -- the record.

**Acceptance Criteria:**
- Given each of the six Story 14.7 criteria in `epics.md`, when the mapping table under Evidence is read, then each names the step that meets it.
- Given this file, when searched with the path check under Verification, then nothing matches.
- Given `npm run validate`, when run, then it exits 0.

## Design Notes

The contract scores what the run left, as Story 14.5's grader did. Its one operation is `read-output`, a collector command that takes a graded folder and prints the reply, the entry file's first 200 lines, the frozen source copy and every manifest-listed shard body. The agent run stays outside the contract: its one case prompt gives pre-flight no second input to show sensitivity with, and two different workspaces do.

The records' evaluator dispositions are Story 14.5's grades, transcribed: rubric line n to oracle `O-00n`, line 5 from the five-line regrade, `not-attempted` where no grade exists. That puts the grader's verdict and the engine's check in one artifact, and `corroboration` marks where they differ. The engine's `checkResolution` never reads a disposition; every `caught`, `missed` and `false-positive` does. The records are synthetic: the builder turns each failed grade into a defect finding with a quote it chose, and attests the isolation manifest's values itself. So the probe states measure how `score` responds to Story 14.5's grade booleans in this shape, and only `checkResolution` is a reading of the outputs.

## Evidence

Recorded 2026-11-26 from this checkout at `74f92922e92daf9989850c08b2530cdfb5a0009b` (10.1.2), built with `npm run build`, on Node 24.22.3 and Python 3 run with `-I`.

Placeholders: `<evidence-dir>` is the epic's local evidence folder, outside every repository; `<grade>` is `<evidence-dir>/14-5-grade`, Story 14.5's neutral graded folders; `<tools>` is `<evidence-dir>/14-7-tools`; `<work>` is `<evidence-dir>/14-7-work`, made empty before the final run; `<repo>` is this checkout; `<fixture>` is `<grade>/g01/reference/tidewater-prd.md`, the case fixture at `59de7a03`; `<fx>` is that fixture in citations.

| Story 14.7 acceptance criterion | Met by |
|---|---|
| 1. The contract compiles; its size and every declaration | Steps 1 and 2 |
| 2. Whether compile or preflight flags the weak line 1, yes or no | Step 3 |
| 3. Whether score passes `g01` to `g03` and fails `g04`, model calls, judge needs | Steps 4 and 5 |
| 4. Side-by-side table, and what eval-quality cannot express | Steps 6 and 7 |
| 5. An eval-quality defect in `deferred-work.md`, no source change | Step 8 |
| 6. Three or four sentences for the owner's note | For Toolsmith's maintainer |

```bash
node <tools>/contract.mjs <fixture> <work>/contract.json
(cd <work> && node <repo>/dist/cli/main.js compile --in contract.json --out eval-contract.json)
node <tools>/build.mjs <repo> <evidence-dir>
```

`build.mjs` runs `collect.py` on each folder, `seal`, one `preflight` and nine `score` calls through the CLI, and writes `<work>/summary.json`. The chain after compile took 2.3 s of wall clock. A rerun into an empty `<work>` holding only the two contract files wrote a byte-identical `summary.json` (`c4d4a4e749d91e08fd1ff586c4159d8b30006e07c071b32977a115c774e24195`).

| File | SHA-256 |
|---|---|
| `<tools>/collect.py` | `8f33e06696df990d67f8a0e92b46f37bd670321b93a3138d800da7d2d4de1823` |
| `<tools>/contract.mjs` | `69a3f1c5d626795ef4227e463e562bd316e8f6bf7a21ec86c8c8df0c78bf4275` |
| `<tools>/build.mjs` | `b31bbb1a001c33cb40930b05af056aa10a478ca2bc5bd0f797ca44d08340da79` |
| `<work>/contract.json` | `4d161103727ef7bbe2a86b2660370d2209e4a1b07d1b5068967480b3422491e2` |
| `<work>/eval-contract.json` | `81d817f8335a8574be96a1d7e2075e1e81ebf8dcb932342ea1cfcad05a682807`; `contractDigest` `sha256:efb2c9a625ccee17bcf6ad8982c838d3bb573a188f690c0cd45c4ec9dca55b54` |
| `<work>/preflight-verdict.json` | `fa684b8f2c3ddbb0d1bbaf322a4bf73c1ffc18b39e92e628bf5b5198094add1a` |

**1. The contract.** `tidewater-prd`, schema version 7: 6 behaviors, 6 oracles, 1 rubric with 2 criteria, 1 interface, 1 plan step. It is 899,288 bytes as authored and 894,378 compiled. 852,668 of those bytes are the fixture, inlined in `O-006`; without `O-006` the authored contract is 34,712 bytes, and `O-001` (four sampled passages) is 20,113 of those in compact form.

| Oracle | Rubric line | Check |
|---|---|---|
| `O-001` | 1, sampled approximation | for each sampled passage, `any` of: the source copy contains it, some shard body contains it. Samples: FR-WO-015 (`<fx>:2531-2552`), NFR-RET-004 (`:8761-8768`), the Appendix A FR-WO rows (`:9898-9932`), section 5.3 (`:565-596`) |
| `O-002` | 2, lexical half | the entry head matches `FR-WO-0(?:0\d\|1[0-5])[^\n]*\bto (?:FR-WO-)?0(?:1[5-9]\|[2-9]\d)\b` (a work-order range that covers 015) and contains "Appendix A" or "raceability" |
| `O-003` | 3, lexical half, reply only | the reply contains `$27` and `$29` and matches `\b18\b` and `\b25 months\b` |
| `O-004` | 4, read as a slice test | `for-all` shards: the source copy contains the shard body, so each body is one unbroken verbatim slice |
| `O-005` | 5, Story 14.5's addition | `for-any` shards: the body contains the full FR-WO-015 passage |
| `O-006` | none | the source copy equals the fixture, which `O-004` rests on |

Four of these encodings differ from their rubric line. `O-001` loosens line 1 in one direction and tightens it in another. It keeps the weak branch, "the original kept intact somewhere", as "the source copy contains each sample", so a source copy holding only the four samples passes; Codex's review replay showed exactly that, with `O-006` failing beside it. It replaces the other branch, "files whose contents together contain every original line", with "one shard holds each sample whole": a sample split across two shards fails that branch though the files together hold it, which is why Appendix A is sampled by its FR-WO rows only. And three-valued `any` makes an empty shard list undecidable even beside an intact source copy (step 3), where line 1 would pass. `O-003` reads the reply only, while line 3 also accepts "a conflicts list in the output": no output holds a separate conflicts file, and a lexical search of the whole output would be satisfied by the source copy, which states every value. Its `\b18\b` conjunct accepts any standalone 18 in the reply. `O-004` tests "matches the source verbatim" as an unbroken slice, so it fails an omission or an addition inside a shard as well as a rewording; line 4 names rewording only.

The rubric `R-001` holds the two judgements no operator decides: `RC-001`, whether a reader of the first 200 lines can locate FR-WO-015 and Appendix A, and `RC-002`, whether the reply asserts only one value of a conflict.

**2. What the contract and the records had to declare.**

- One `cli` interface `shard-pro-output` with one operation `read-output`: executable `collect-output`, one required argument `workspace`, no option, environment or stdin key, `artifacts: []`, `stateChangeMarker: false`, stdout as its descriptor channel, four required keys (`reply`, `entryHead`, `sourceCopy`, `shards`), `/shards` a collection of at most 400, and a sensitivity witness whose two legs read two different clean outputs and must not return equal shard lists.
- The collector itself, 54 lines. It reads every file as strict UTF-8 with no newline translation, so equal text means equal bytes; a copy of `g01` whose source copy was rewritten with CRLF line ends now fails `O-006`. It does no judging and three pieces of selection: it keeps only the shards the manifest lists, strips each shard's frontmatter and the one blank line after it, and cuts the entry file at 200 lines.
- One plan step `output` binding `workspace` to `{ "matcher": "any" }`, so every graded folder matches it.
- Severity `material` on all six behaviors, the level the scoring policy's floor reads, and budgets copied from the tutorial (`maxCostUsd` "1.00", `maxToolCalls` 20, `maxWallClockMinutes` 5), which no run here comes near.
- A rubric that compiles only with anchored scale levels, a bounded length and named failure-mode penalties (`rubric-unanchored` three times), and a forbidden-input list that keeps `original-spec` (`forbidden-input-floor-incomplete`). Those four refusals came before the first exit 0.
- Six probes: a clean control on `B-005`; two defect probes for the planted deletion (signature: the source copy holds the FR-WO-015 Statement line `<fx>:2533` and no listed shard does), on `B-005` and `B-001`, each with its own manifestation leg; three gameability probes for the degenerate outputs, on `B-005` and `B-001`. The gameability signature for an empty shard list uses `absence` of `/shards/0`: a quantifier over the empty list made the first version `vacuous`, and `score` exited 3 with `oracle O-005 resolved infrastructure-error`. Two defect probes sharing one leg id were refused by `preflight` (`malformed-operator-expression`), and a leg id must be lowercase.
- Six pre-flight observations, each from its own collector run: `witness-clean-1` (`g01`), `witness-clean-2` (`g02`), two reads of `g01` for the control legs, and one read of `g04` for each defect probe's manifestation leg. The contract declares no fixture reset, so `state-reset` compares the two control reads of an unchanged folder; it passes because the collector is deterministic, which the builder also checks with one more read of `g01`.
- Per record: an evaluator configuration, an isolation manifest, an actions file and the evaluator dispositions and findings derived from Story 14.5's grade booleans. The builder wrote every finding, citation and attestation. A failed grade becomes a defect finding citing the one observation and quoting text that observation holds: for `g03`, the reply's own sentence "Prices, availability targets, SOC 2 dates and the 72-hour offline window agree across the document."; for `g04`, the heading "#### FR-WO-015 — Create work orders from fault events", since an omission has no text to quote. The collector read is marked `evaluator-chosen`, which the schema gives to "a deterministic interaction plan that is the evaluation's own action" (`sealed-run-record.ts:252`). A record is about 1.77 MB, nearly all of it the collector's output.

**3. Before any run: no.** `compile --strict` exits 0 and prints nothing. `preflight`, given all six probes, passes all eight of its checks: `interface-present`, `input-sensitivity`, `state-reset`, `clean-control`, and `seeded-faults-scoped` and `seeded-fault-fired` for each defect probe. Neither stage looks at what an oracle accepts. Compile checks structure and the discipline rules. Pre-flight checks that the environment is measurable and that each seeded fault fires; a gameability probe adds no pre-flight check. The weak acceptance shows only at score time. `g04` itself exposes it: `O-001` holds on the poisoned copy while `O-005` fails it. The title stub shows a more extreme shortcut the same check accepts, and that output has to be built by hand. The gameability probes do not change that: they qualify at `score` on their declared prose and evidence, and nothing tests the naive-holds and disciplined-fails pair they claim. For the title stub the pair is real (`O-001` true, `O-005` false). For the empty list it is not, since both checks resolve `insufficient-evidence`, so `P-006` is an abstention diagnostic and its rate belongs in no comparison. Building the stub needs no model call, but someone has to think of it first.

On the two degenerate outputs the checks answer differently. With no shard at all, `O-001` resolves `insufficient-evidence`, because eval-quality's three-valued `any` (`resolution.ts:192-200`) lets no `true` sibling rescue a quantifier over an empty list, so the source copy alone cannot satisfy it. With one title-line stub shard, `O-001`, `O-004` and `O-006` all hold; only `O-005` and the `O-002` proxy fail it. The FAIL verdicts on both degenerate runs come from records with no finding (step 5), apart from `O-004` and `O-005` abstaining on the empty one.

**4. The checks, per folder.** `checkResolution` from each evidence artifact, computed by the engine with no model call over the collected text. A `true` means the oracle's predicate held on that text; it is not a score verdict, which step 5 reports separately. The 14.5 column is the blind grader's verdict on lines 1 to 5, from `g01`-`g04` and the regrades `g05`, `g10`, `g11`, `g06`.

| Folder | `O-001` | `O-002` | `O-003` | `O-004` | `O-005` | `O-006` | Story 14.5 grader, lines 1-5 |
|---|---|---|---|---|---|---|---|
| `g01` clean 1 | true | true | true | true | true | true | pass, pass, pass, pass, pass |
| `g02` clean 2 | true | true | true | true | true | true | pass, pass, pass, pass, pass |
| `g03` clean 3 | true | true | false | true | true | true | pass, pass, fail, pass, pass |
| `g04` poisoned | true | true | true | false | false | true | pass, pass, pass, pass, fail |
| degenerate, title stub | true | false | true | true | false | true | not graded |
| degenerate, no shard | insufficient | false | true | insufficient | insufficient | true | not graded |

So `g01` and `g02` pass all six checks. `g03` fails `O-003`, because its reply never names $27 or $29: the clean miss Story 14.5's grader also failed it for, found here by the narrower reply-only test. `g04` passes `O-001`, the sampled line 1 check, and fails two checks. The four-line grader saw the loss too: its line 1 evidence says the shard set alone is not complete, its line 4 evidence names the omission, and it passed both lines because their wording allows it. `O-005` fails because no listed shard holds the whole FR-WO-015 passage. `O-004` fails because the shard `work-orders-fr-wo-007-017.md` is no longer one unbroken slice of the source. That second catch comes from reading line 4 as a slice test. The grader read it as a rewording test and passed `g04` ("The one defect is an omission, not a rewording"), and `corroboration` reads `disagrees` on `O-004` in every `g04` artifact. The grader's reading matches line 4's words. The slice reading is the encoding's own choice, made once and applied to bytes. `g04` differs from `g01` in one shard line and in one deleted reply bullet, Story 14.5's own self-check claim, which bears on no oracle here.

No check above needs a judge to reach its result. Two rubric judgements stay undecided. `RC-001` stays open because `O-002` only finds a range written as "X to Y"; a map that wrote "FR-WO-013–020" would fail it while still letting a reader locate the requirement. `RC-002` stays open because naming both values does not settle it: a reply could name $27 and $29 and still assert $29 as the price. The records carry no judge results, and `score.ts:260-278` reads a rubric only for judge conduct, so a judge's score could not move any oracle or the verdict anyway.

**5. The score runs.** Every run used `--policy <repo>/examples/tutorials/skill/scoring-policy.json` (minimum 3 trials, severity floor `material`) and `--scored-at 2026-11-26T12:00:00Z`.

| Run | Folder, probe, dispositions | Exit | Verdict | What decided it |
|---|---|---|---|---|
| `clean-1` | `g01`, clean control `P-001`, 14.5 grades | 0 | CONCERNS | all six oracles `passed-clean-control`; basis: coverage gaps `whole-body`, `malformed-input`, `sibling-cross-check`, and 1 trial below 3 |
| `clean-2` | `g02`, `P-001`, 14.5 grades | 0 | CONCERNS | the same |
| `clean-3` | `g03`, `P-001`, 14.5 grades | 2 | FAIL | diagnostic only: `g03` really misses the price conflict, so declaring it a clean control for all six oracles is wrong, and `oracle O-003 resolved false-positive` is no false alarm. The engine's `O-003` check agrees the reply misses the conflict |
| `poisoned-line1-rubric4` | `g04`, defect `P-003` on `B-001`, the four-line grade | 2 | FAIL | `oracle O-001 resolved missed`; `defect {caught 0, exercised 1, rate 0}`: no line failed, so the record holds no defect finding, though the grader's evidence names the omission |
| `poisoned-line5-rubric5` | `g04`, defect `P-002` on `B-005`, with the line 5 regrade | 0 | CONCERNS | `O-005` `caught`, `defect {caught 1, exercised 1, rate 1}` |
| `poisoned-line1-rubric5` | `g04`, `P-003` on `B-001`, with the line 5 regrade | 0 | CONCERNS | `O-001` `caught` and `defect` rate 1, from the finding against `O-005`; see step 8 |
| `degenerate-stub-line5` | stub, gameability `P-004` on `B-005`, no finding | 2 | FAIL | `oracle O-005 resolved missed`; `gameability` rate 0 |
| `degenerate-stub-line1` | stub, gameability `P-005` on `B-001`, no finding | 2 | FAIL | `oracle O-001 resolved missed`; `gameability` rate 0 |
| `degenerate-empty-line1` | no shard, gameability `P-006` on `B-001`, no finding | 2 | FAIL | `O-001` missed; `O-004` and `O-005` abstained |

A catch in eval-quality is the evaluator's. `caught` needs a defect finding that cites an observation the probe's signature matches (`outcome.ts:492`, AD-40), so every `caught`, `missed` and `false-positive` above comes from findings the builder derived from Story 14.5's grades, or from their absence. With no finding the degenerate runs score `missed` whatever the oracles say, and the oracle-level answer for them is step 4's table. The states also follow the record's provenance: Codex's review replay, repeated here, marked the stub's collector read `baseline` and left everything else alone, and `degenerate-stub-line1` became `not-applicable`, 0 exercised, CONCERNS, with `O-001` still `true`. With the four-line grade, `g04` scores `missed`, the same miss Story 14.5 reported. With the line 5 regrade, it scores `caught`.

**Model calls.** This story made none. The collector reads files, and compile, seal, pre-flight and score are deterministic, so every `checkResolution` in step 4 is model-free. The probe states in step 5 are not: they rest on Story 14.5's eight grader runs (`g01`-`g06`, `g10`, `g11`), already counted in that story's budget. The graded outputs come from that story's three clean agent runs.

**6. Side by side.** Same case, same three clean outputs, same poisoned copy.

| | Toolsmith `bmad-eval`, Story 14.5 | eval-quality, this story |
|---|---|---|
| Poisoned copy, line 1 | passes; the grader's evidence notes the shards alone are incomplete | `O-001`, the sampled approximation, passes |
| Poisoned copy, line 4 | passes, read as a rewording test | `O-004` fails, because the encoding reads line 4 as a slice test |
| Poisoned copy, the FR-WO-015 line | fails line 5; three clean outputs pass it | `O-005` fails; three clean outputs pass it |
| Clean output 3's price-conflict miss | line 3 fails | `O-003`, a reply-only lexical test, fails |
| Weak "kept intact somewhere" before any run | not examined | not flagged by compile or pre-flight; a hand-built title-stub output passes `O-001` |
| Judgement ("lets a reader locate", "without asserting only one value") | the grader judges it | lexical proxies, plus rubric text that reaches no verdict |
| Model calls | 8 grader runs for these grades | 0 for the checks; the catch and miss states replay synthetic records built from those 8 grades |
| Grading harness written for the comparison | `assemble.py`, `grade.py` and `poison.py`, 240 lines, plus `validity2.py` (255 lines) for the agent runs | `collect.py`, `contract.mjs` and `build.mjs`, 719 lines, with no grader to write |
| Case authoring | the case entry and its four rubric sentences already existed upstream; Story 14.5 wrote one more sentence | a contract with 6 oracles and the fixture inlined, through four compile refusals and two pre-flight refusals |
| What a pass means | the grader read the output and agreed with each sentence | a check's predicate held on the collected text; a score verdict also weighs the findings, the probe and the policy, so a run with two false checks can still read CONCERNS |

**7. What eval-quality could not express, or expressed only through the harness.**

- A probe signature over written files. `qualifyProbe` refuses an `artifact` pointer in a signature (`evaluate-skill-behavior.md:371`), so this contract put the output on stdout through a collector command. Oracles alone could have read declared artifacts.
- A file set whose names change per run. Artifact identifiers are fixed per contract, so the collector bundles the manifest-listed shards into one array and does the join with the manifest itself.
- "Within the first 200 lines". The bounded regex faults on nested quantifiers (`expression.ts:116`), so a line-counting pattern is out and the collector cuts the head.
- "Files whose contents together contain every original line". This collector emits no line list, so `O-001` uses the rubric's own four samples. Codex's review showed the shape that would check every line: a collector that also emits the source as a line array and the shard bodies joined, and one `for-all` over the lines with a `containment` against the joined text, which held on `g01` and failed on `g04` with the shipped resolver.
- "A conflicts list in the output". Without a declared conflicts file, a search of the whole output is satisfied by the source copy, so `O-003` reads the reply only.
- A reference with no channel. The operation's descriptor supplies no independent copy of the fixture, and `containment` takes a pointer container (`operators.ts:139-167`), so this comparison inlined the fixture as an 852,668-byte `equality` literal.
- Pre-flight's input sensitivity for the agent run. The case has one prompt, so the witness compares two workspaces through the collector and the agent run stays outside the contract.
- The two judgements in step 4, which no operator decides and no rubric score can move.

**8. No eval-quality defect.** One result looked like one and is AD-40 working as written. In `poisoned-line1-rubric5`, probe `P-003` names behavior `B-001`, whose one oracle `O-001` is designated. The record's only defect finding cites `O-005`, probe `P-003` and the observation the signature matches, and `score` resolved `O-001` to `caught`, with its own check `true` and its disposition `held`. AD-40 defines detection per probe: "A finding counts as detection if and only if it cites at least one observation satisfying the signature's discriminating condition", and `score.ts:643-645` hands that probe-level result to the designated oracle. So `O-001 caught` says that P-003's planted defect was detected, which is true. The oddity comes from this contract: `P-003` is declared on `B-001`, a behavior the deletion does not break under its own weak encoding. A reader who wants an oracle's own result reads its `checkResolution`. Nothing went to `deferred-work.md`.

## Implementation Notes

The implementation is evidence gathered in the planning session, so this session wrote the record directly from the runs it made; no coding subagent was launched. The scratch tools live in `<tools>`, outside the repository. The committed change is planning text and this record, so no package byte moves.

## Plan Change Log

- Codex round 2: the frozen matrix row "The line 1 oracle as written holds" became "The sampled line 1 oracle holds", under the approval the coordinator delegated. `O-001` approximates line 1, and the old words misdescribed it; no expected behavior changed.

## Review Triage Log

bmad-build review, quick lens, pass 1: 13 findings (medium 7, low 5, false 1). All but the false one patched in this record or the planning text.

- false: step 8 called the `O-001 caught` result an engine defect. AD-40 (`ARCHITECTURE-SPINE.md:528ff`) defines detection per probe and `score.ts:643-645` gives the designated oracle that result, so it conforms. Step 8 now says so, and the `deferred-work.md` entry was withdrawn.
- medium: the model-call row and the owner draft credited eval-quality's probe states to no model. The row and draft now separate the model-free checks from the states that reuse Story 14.5's grades.
- medium: the authoring row counted this story's harness and left out 14.5's grading harness, and the case entry already existed upstream. Both now appear.
- medium: `O-003` narrows line 3 to the reply and its `\b18\b` conjunct is weak. Step 1 and step 7 say so.
- medium: the line 4 catch came from the encoding. Step 4 and the table now book it as the slice reading.
- medium: pre-flight had run with no probes. It now runs with all six (eight checks, all satisfied), which needed distinct lowercase leg ids.
- medium: step 3 credited the empty degenerate's FAIL to `O-001`'s abstention. It now names the absent evaluator.
- medium: the owner draft used internal references and long sentences. Rewritten.
- low: two contract sizes, the unrecorded verification result, the incomplete declaration list, the planning text that did not yet name 14.7 (intro, definition of done, order, context dependencies, and `g04`'s reply bullet), and two ranges for one passage.

Codex round 1 (changes requested, 7). All seven patched.

- The record said the four-line grader found nothing; its line 1 and line 4 evidence names the omission. Steps 4 and 5, the table and the draft credit it.
- The records' findings, quotes and attestations are the builder's. Design Notes and step 2 say so, the quotes are now text the cited observation holds (checked by the builder), and step 5 reports the provenance replay.
- A true check was read as a pass, and `g03` as a clean control. Step 4 separates checks from verdicts, and the `clean-3` run is marked diagnostic.
- `O-001` was called line 1 as written. It is the sampled approximation, with both branches' limits in step 1.
- The three gameability probes shared one description and one evidence file. The stub probes now cite their own `O-001` and `O-005` results, and `P-006` is an abstention diagnostic.
- The collector decoded newlines, so "byte-level" overstated `O-006`. It now reads strict UTF-8 with no newline translation, and a CRLF copy fails `O-006`; the draft says exact text.
- Step 7 overstated three limits. It now names the full-line shape, keeps the signature-only file restriction, and books the fixture literal as this comparison's choice.

Codex round 2 (changes requested, 2). Both patched.

- `O-001` also loosens line 1: a source copy holding only the four samples passes it. The contract's own direction and commentary, the matrix row and step 1 now call it a sampled approximation and name both directions; step 3 credits `g04` with exposing the weak acceptance.
- The pre-flight observations reused earlier reads. Each leg now gets its own collector run, and step 2 says what `state-reset` compares with no fixture reset declared. Every check, state and verdict came out the same.

## Verification

**Commands:**

```bash
npm run validate
grep -nE "(^|[[:space:]=:\`'\"(])/(Users|private|tmp|home|var|opt|Volumes|mnt|etc|root|srv)([/[:space:]\`'\",.;:)]|$)|~[/]|[$]HOME|[A-Za-z]:[\\\\]" _bmad-output/implementation-artifacts/spec-14-7-*.md
```

Expected: `npm run validate` exits 0; the `grep` prints nothing and exits 1.

Result at the final edit: `npm run validate` exited 0 (157 test files, 5,466 tests), and the `grep` printed nothing and exited 1. The first `validate` run failed one test, `tests/cli/main.test.ts` "the packed and installed tarball", with `ENOTCACHED` for `zod-4.6.6.tgz`: the host's npm cache no longer held the tarball that test installs offline. `npm cache add zod@4.6.6` restored it, and the test and the full run then passed with no file changed.

## For Toolsmith's maintainer

Draft for the owner's note; this story sends nothing.

We also ran the same Tidewater case and the same poisoned copy through eval-quality, scoring the outputs your grader had already graded with no new model call, and a sampled version of rubric line 1 still passes the poisoned copy with nothing flagging its "kept intact somewhere" clause before a run. The poisoned copy fails two exact-text checks, the full FR-WO-015 passage in one listed shard and line 4 read strictly as "each shard is an unbroken slice of the source", and the three clean outputs pass both. Your grader noticed that loss too, and its lines 1 and 4 let it pass. eval-quality's catch-or-miss verdicts still come from an evaluator's findings, here built from your grader's pass and fail marks, and the judgement calls in lines 2 and 3 stay rubric text that no check decides.
