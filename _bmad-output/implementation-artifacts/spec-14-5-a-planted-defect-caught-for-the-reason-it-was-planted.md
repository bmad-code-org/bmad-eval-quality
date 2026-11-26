---
title: 'A planted defect, caught for the reason it was planted'
type: 'chore'
created: '2026-11-26'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'be4e0ce0154f7658c96e5c75069006f23af8d668'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-14-context.md', '{project-root}/_bmad-output/implementation-artifacts/spec-14-4-whether-the-shard-pro-script-runs-inside-the-eval-room.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A green Tidewater grade credits Shard Pro, yet nobody has shown that the case's four rubric lines fail when the output is broken. Without that, a pass proves nothing.

**Approach:** Run the `tidewater-prd` case live through Claude Code with Story 14.4's overlay: one smoke run, three clean runs, and three runs of a variant skill that reports only one value of each conflict. Delete one FR-WO-015 line from a copy of one clean output, grade everything blind against the unchanged rubric, judge each catch against the defect that was planted, and record counts by arm in this file.

## Boundaries & Constraints

**Always:** Read BMAD-METHOD only through `git archive fc034b67` into a scratch folder. Before each arm, the overlay's two digests match the 14.4 record and the staged helper's digest matches it again. Fixed before the smoke run: harness = Claude Code 2.1.332 through `run_evals.py --harness <json>` with the shape `references/harness.md` shows (`claude -p {prompt} --output-format stream-json --verbose --dangerously-skip-permissions`, `skill_dir` `.claude/skills`, `env` `{USER: ""}`, `home_files` `["Library/Keychains"]`); model = Claude Code's default, no `--model`, the model named by the transcript's `init` event recorded; rubric = the four `tidewater-prd` lines of the overlay `cases.json`, unchanged; timeout = 1800 s; `--mode quality`; project root = an empty folder. The grader runs the same CLI, model and clean-room environment, reads `<scratch>/references/grader.md`'s contract and a neutral folder (`reference/`, `reply/`, `artifacts/`, `grade/`) with no transcript, no staged skill, no staged helper and no arm in any path. Raw runs, transcripts and grader folders stay under `<evidence-dir>/14-5-*`. The record holds placeholders, counts and checked excerpts, and no absolute path.

**Ask First:** None; the coordinator delegated approval. A harness that cannot run the case stops the story as blocked; it is never swapped.

**Never:** Change, branch, or open a pull request or issue in BMAD-METHOD. Edit the rubric of a graded run. Propose a rubric line when the existing rubric already catches the poisoned copy. Exceed about 32 live calls (agent runs plus grader calls). Claim anything about baseline strength or other harnesses. Touch `src/`, `schemas/`, `corpus/`, docs, gates, config or fixtures.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid trial | One run of either arm | Harness status `ok`; a transcript `build` call through the staged `shard_tool.py` with a successful result; an independent `check --rebuild` on the split exits 0; a non-empty final reply | Any miss: invalid, counted and reported, never graded as a trial |
| Poisoned copy | First valid clean output | FR-WO-015 passage found whole in one manifest shard; its Statement line deleted; `.source/` equals the fixture; `check --rebuild` fails with the deleted line's source number | Passage split or line not unique: choose no line, record why |
| Rubric misses the loss | Poisoned grade has no line failing on the FR-WO-015 omission | Line 5 proposed; clean and poisoned regraded: clean passes, poisoned fails citing the omission | Otherwise: no line proposed |
| Variant trial | Valid variant run | Exercised when, for price or retention, the reply and any conflicts list give one value only, quoted; caught when line 3 fails citing the omitted value | Missing report, truncation or both values given: unexercised, reported |
| Clean arm | Valid clean runs | Line 3 passes on every one | A clean miss is a failed comparison |

</frozen-after-approval>

## Code Map

Lines are at `fc034b67`; `<bm>` is its export, `<fx>` the fixture at `59de7a03`.

- `<bm>/skills/toolsmith/bmad-eval/scripts/run_evals.py` -- `run_case` (178), `stage_skill` copies the skill under its folder name (78-91), so the variant folder is also named `bmad-shard-pro`; exit 0 only when no run failed (443).
- `<bm>/skills/toolsmith/bmad-eval/scripts/eval_common.py` -- `build_case_env` (178), `make_home` (209) and `run_in_clean_room` (241) build the room; the grader runner reuses them.
- `<bm>/skills/toolsmith/bmad-eval/references/grader.md` -- grader contract and `grading.json` shape; `harness.md:21-26` -- the Claude Code harness shape.
- `<bm>/skills/core-tools/bmad-shard-pro/SKILL.md:73` -- the line the variant replaces; `:51` keeps "never pick one" in shard summaries.
- `<bm>/skills/core-tools/bmad-shard-pro/scripts/shard_tool.py` -- `join_difference` (693) and the `rebuild` failure (1095-1105) name the first differing source line.
- `<fx>:85` -- requirement entries are authoritative over summaries. Price: FR-BIL-001 states $29 (`<fx>:7430`); $27 appears only in summaries (`:215`, `:571`, `:9782`), so precedence selects $29. Retention: FR-TEL-021 states 18 months (`:4812`), NFR-RET-004 25 (`:8764`); both are requirement entries, so none applies, and 18 is stated first (`:4402`).
- `<fx>:2531-2552` -- the FR-WO-015 passage; `:2533`, its Statement line, occurs once in the fixture.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:147` -- this story's ledger key.

## Tasks & Acceptance

**Execution:**
- [x] Scratch -- export `fc034b67`, verify the overlay, write the harness JSON, the validity checker, the evidence assembler and the grader runner outside every repository -- the fixed setup.
- [x] Scratch -- one smoke run, clean arm; check validity -- harness proof.
- [x] Scratch -- three clean runs and three variant runs, each arm after a digest check; classify validity -- the trials.
- [x] Scratch -- poisoned copy from the first valid clean output; grade clean runs, the poisoned copy and valid variant runs; regrade only when the matrix says so; classify exercise and catch -- the comparison.
- [x] Scratch -- after Codex review round 1, rerun the variant arm serially with the fallback value named in its line, and gate every trial with the stricter validity check -- the corrected variant.
- [x] `_bmad-output/implementation-artifacts/spec-14-5-a-planted-defect-caught-for-the-reason-it-was-planted.md` -- write Evidence (commands with placeholders, digests, counts by arm, quotes, spend) and end with the summary for Toolsmith's maintainer -- the record.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- set the story status as the workflow directs.

**Acceptance Criteria:**
- Given each of the ten Story 14.5 criteria in `epics.md`, when the mapping table under Evidence is read, then each names the step that meets it.
- Given the counts table, when read, then planned, completed, valid, exercised and correctly caught appear per arm with timeouts, setup failures, invalid runs, unexercised variants, grading errors and grader calls.
- Given this file, when searched with the path check under Verification, then nothing matches.
- Given `npm run validate`, when run, then it exits 0.

## Design Notes

The counted variant replaces line 73 with one line: "- what you found in the source: for each conflict, only the value the source's own precedence rule selects, or, where it states no precedence, the value it states first (for raw telematics retention, 18 months), in this reply and in any separate conflicts list, never the other value; index errors, suspected errors;". On this fixture precedence selects $29, and the line names the first-listed retention value, 18 months, as the epic requires.

A first variant ran before Codex review round 1 with a line that left the fallback value implicit: "- what you found in the source: for each conflict, only the value the source's own precedence rule selects, or the value it states first where it states no precedence, in this reply and in any separate conflicts list, never the other value; index errors, suspected errors;". Its results are kept below under its own name and are not counted for the story.

The proposed line 5, used only if needed: "If the output is split, the full FR-WO-015 passage, from its heading to the line before the FR-WO-016 heading, appears word for word in the body of one shard the manifest lists".

## Evidence

Recorded 2026-11-26 with Claude Code 2.1.332, uv 0.11.32 and `gh` logged in to github.com. The Story 14.4 preflight this story requires passed in that story's step 4 (exit 3, one skipped job, staged helper digest equal to its source), and its record merged at `be4e0ce0154f7658c96e5c75069006f23af8d668`.

Placeholders: `<scratch>` is a new, empty scratch folder outside every repository; `<bm>` is `<scratch>/bm`, the `git archive fc034b67` export, so the Boundaries' `<scratch>/references/grader.md` is `<bm>/skills/toolsmith/bmad-eval/references/grader.md`; `<evidence-dir>` is the epic's local evidence folder, outside every repository; `<overlay>` is `<evidence-dir>/14-4-overlay`; `<tools>` is `<evidence-dir>/14-5-tools`, which holds the harness JSON, the scripts, both rubric files, both variant lines' `SKILL.md` copies and the negative-control transcript; `<root>` is an empty folder; `<fixture>` is `tidewater-prd.md` fetched by `gh api` at `59de7a03`; `<fx>` is that fixture in citations; `<run-dir>` is a folder `run_evals.py` names, and `<case-dir>` one run's folder inside it; `<cwd>` is a case folder's `cwd/`, and `<split>` the one folder in it holding `.shards.json`; `<skill-tree-digest>` is the arm's digest below; `<tmp>` is the host's temporary directory; `<n>` is a run count, `<i>` a run number, and `<NN>` a grader folder's number. The BMAD-METHOD clone was only read by `git archive`.

| Story 14.5 acceptance criterion | Met by |
|---|---|
| 1. Same overlay, harness `ok`, staged build, `check --rebuild`, final reply; harness, model, rubric, timeout fixed first | Steps 1 to 3 |
| 2. Poisoned copy: unique FR-WO-015 line, passage verified, one line deleted, source frozen, first differing line | Step 4 |
| 3. Both graded blind on the unchanged rubric, four lines each, clean check kept out, reference outside artifacts | Steps 4 and 5 |
| 4. Rubric misses the loss: line 5 proposed, clean pass and cited failure on regrade | Step 5 |
| 5. Variant: full copy named `bmad-shard-pro`, one changed line at `SKILL.md:73`, fixture checked first, first-listed value named | Step 1 and Design Notes (the counted variant) |
| 6. Defect produced decided from the reply and any conflicts list, with quotes, apart from the grade | Step 6 |
| 7. Line 3 passes on clean; exercised variants fail citing the omitted value; a clean miss is a failed comparison | Step 7 |
| 8. Neutral grader folder, produced files only, raw events kept apart | Step 4 |
| 9. Three fresh valid runs per arm, counts by arm, grader calls counted | Steps 2 and 3, Counts; clean-arm exposure under Conditions |
| 10. No claim about baseline strength or other harnesses; summary for Toolsmith's maintainer | For Toolsmith's maintainer |

**Citations re-read at `fc034b67` and `59de7a03`.** Every Code Map line was read in the export and the fixture; none moved from Story 14.4's record.

**1. Fixed before the smoke run.**

| Item | Value |
|---|---|
| Harness | `<tools>/harness.json`, SHA-256 `457bd8a18895590b0d550bcb3764c125129fcc6dec4a74bcde37cc949b373647`: `{"command": ["claude", "-p", "{prompt}", "--output-format", "stream-json", "--verbose", "--dangerously-skip-permissions"], "skill_dir": ".claude/skills", "env": {"USER": ""}, "home_files": ["Library/Keychains"]}` |
| Model | Claude Code's default, no `--model`; every `init` event, agent and grader, names `claude-opus-5-5` |
| Rubric | the four `tidewater-prd` lines of `<overlay>/cases.json`, copied to `rubric4.json` (`226049870bd6db7b0d9763dcedc57f181a3672c67a0cdf660de4588d5eeb87e2`); the five-line `rubric5.json` used only for regrades adds the Design Notes line (`581740acdf6463a460ad110bff871da273261a6fb7592be686568157cf667454`) |
| Timeout | 1800 s per agent run and per grader run |
| Skill trees (`tree_digest` from Story 14.4) | clean `74e9f5f3a9b662e51250c99cce7d23c041aa89e195df7975f369263601d0f8a4`; first variant `f65dd8d0e3aaccd1beaf795702fa441f93ad5dcb69af07ad90f804609cd421e6`; counted variant `6b67d8ccebfacc85233d670173291108a094b9ad77049ea1c69a48c257ad6238` |
| Scripts in `<tools>` | `validity.py` `2a9525fa2dab937629f38a385571897b7e28d0abee6eb6d1717a3bb3fed3d7bc` and its successor `validity2.py` `0f0257fb320a9ad0549531ecb56345a6f1fda5fe62d6521680ea041a59eb4284`; `assemble.py` `d4c6127f2a8a54701dd974debc9c157b35052ee31efde29f8a000397ccf5bcff`; `poison.py` `8d2e1d6f0c661f0388a6d3f818704559e759afe2d525801dc20f396bf9f0ff06`; `grade.py` `3142cc751d9c9260b84cbf82efcf3406f76f19b348d963cee8ba5f6ff26a66fb`; `serial_variant2.sh` `c464773e7bb653a3f26bc8fb9990a6dfddefd59df2f45fe37dbd33d71ab8b230` |

Each variant is `cp -R <bm>/skills/core-tools/bmad-shard-pro <scratch>/<variant|variant2>/bmad-shard-pro` with line 73 replaced; `diff -r` against the export reports `SKILL.md` only, and `diff` on it shows one hunk, `73c73`. The counted variant's `SKILL.md` has SHA-256 `114f643116811d6259359333d60fd3150a1b8174e8372a84228a13bf27492116`. The fixture check behind its line: `<fx>:85` says "The functional and non-functional requirement entries are the authoritative statements. Summary sections quote them for convenience." FR-BIL-001 is the only requirement entry that states a Professional price, so precedence selects $29. FR-TEL-021 and NFR-RET-004 are both requirement entries, so precedence selects neither, and the source states 18 months first.

**2. The arms.** Before every `run_evals.py` call, `shasum -a 256 -c` passed for `<overlay>/cases.json` (`91907f29fa325fc7ab8d8aba0ce649cf634d4525a7cab254c03d49db56c3bbfb`) and `<overlay>/_bmad/scripts/frontmatter.py` (`e4e8616502ace93e3fac378eeefaf22628439feb814246e56a2ee12e2e12a6fa`), the digests Story 14.4 recorded, and `<root>` was empty before and after.

```bash
uv run <bm>/skills/toolsmith/bmad-eval/scripts/run_evals.py --cases <overlay>/cases.json \
  --skill-path <skill> --output-dir <evidence-dir>/14-5-runs --project-root <root> \
  --harness <tools>/harness.json --case-ids tidewater-prd --mode quality --timeout 1800 \
  --runs <n> --workers <n> --label <smoke|clean|variant|variant2-r<i>>
```

| Arm | `<skill>` | How it ran |
|---|---|---|
| smoke (not counted) | `<bm>/skills/core-tools/bmad-shard-pro` | `--runs 1` |
| clean | `<bm>/skills/core-tools/bmad-shard-pro` | `--runs 3 --workers 3`, the three runs at the same time |
| first variant (not counted) | `<scratch>/variant/bmad-shard-pro` | `--runs 3 --workers 3`, after the clean arm finished |
| counted variant | `<scratch>/variant2/bmad-shard-pro` | `<tools>/serial_variant2.sh`: three calls with `--runs 1 --workers 1`, one after another |

Before the counted variant, every `<tmp>` item the earlier runs and graders had made (21, each named in their transcripts) was moved into `<evidence-dir>/14-5-tmp-leftovers/`. After each of its runs, the driver moved there every `<tmp>` item that run's transcript names and the run had touched, so no counted variant run could read another run's files. Every `run_evals.py` call exited 0 with `"failures": 0`.

**3. Validity.** Codex review round 1 showed that `validity.py` accepted a hand-written `printf` in place of the build. `validity2.py` replaced it for every trial:

```bash
python3 -I <tools>/validity2.py <case-dir> <skill-tree-digest>
python3 -I <tools>/validity2.py <smoke-case-dir> <clean-tree-digest> --transcript <tools>/negative-control-transcript.jsonl
```

A trial counts only when all of these hold: `timing.json` status `ok`; a `Skill` call to `bmad-shard-pro` or a read of its staged `SKILL.md`; a staged build receipt; exactly one split folder; the staged helper still at digest `e4e8616502ace93e3fac378eeefaf22628439feb814246e56a2ee12e2e12a6fa` and the staged skill tree at its arm's digest; the frozen `.source/tidewater-prd.md` equal to the fixture (`e477467bea21cb6a4ac228779d8a1d588345c1866eca68d748973b6c88792df1`); a fresh `uv run --offline <cwd>/.claude/skills/bmad-shard-pro/scripts/shard_tool.py --project-root <cwd> check <split> --rebuild` exiting 0 with `"ok": true`; and a last `result` event of `success` with a non-empty reply. A staged build receipt is a Bash call in which, with quotes honoured, heredoc bodies dropped and the call's own variables and functions expanded, a simple command reads `uv run <path ending .claude/skills/bmad-shard-pro/scripts/shard_tool.py> --project-root <arg> build <plan>`; whose result is no error and shows build's `ok` true marker; any main path it names is `<cwd>/<split>/<split>.md` of this run, and any shard files it lists are, in order, a prefix of the final manifest's; and the final `.shards.json` carries the keys only `build` adds (`source` `.source/tidewater-prd.md`, `frontmatter_lines`, `sub_maps`). The negative control is the smoke transcript with its six Bash calls that mention `shard_tool.py` and `build` rewritten as `printf '%s\n' '<the original command>'`; `validity2.py` rejects it with `staged_build_receipt` false. `uv tree --script` resolved `pyyaml v6.0.4`.

| Trial | Elapsed | Shards | Receipt: the staged build command | `result` events | Nested agents | Valid |
|---|---|---|---|---|---|---|
| smoke (not counted) | 334 s | 105 | `uv run .claude/skills/bmad-shard-pro/scripts/shard_tool.py --project-root . build tidewater-prd.plan.json` | 1 | 0 | yes |
| clean 1 | 386 s | 109 | `… --project-root . build <tmp>/shardwork/plan.json` | 1 | 0 | yes |
| clean 2 | 316 s | 107 | `… --project-root . build <tmp>/shardgen/plan.json` | 1 | 0 | yes |
| clean 3 | 345 s | 104 | `… --project-root . build tidewater-shard-plan.json` | 1 | 0 | yes |
| first variant 1 (not counted) | 1484 s | 103 | `… --project-root . build <tmp>/shardplan/plan.json` | 3 | 1 | yes |
| first variant 2 (not counted) | 380 s | 109 | `… --project-root . build "$W/plan.json"`, `W` from `mktemp -d` | 1 | 3 | yes |
| first variant 3 (not counted) | 410 s | 107 | `… --project-root . build tidewater-shard-plan.json` | 1 | 0 | yes |
| counted variant 1 | 407 s | 114 | `… --project-root . build <tmp>/shardwork/plan.json` | 1 | 0 | yes |
| counted variant 2 | 326 s | 108 | `… --project-root . build <tmp>/shardwork/plan.json` | 1 | 0 | yes |
| counted variant 3 | 389 s | 104 | `… --project-root . build <tmp>/shardwork/plan.json --force` | 1 | 0 | yes |

`…` stands for `uv run .claude/skills/bmad-shard-pro/scripts/shard_tool.py`, written directly or through a variable or function the same call defines. Every trial also ran `check --rebuild` itself before replying.

**4. The poisoned copy and the grader's folder.** Every graded output got a neutral folder `<evidence-dir>/14-5-grade/g<NN>` (key kept in `14-5-grade-key.json` beside it): `reference/tidewater-prd.md` (the fixture), `reply/final-reply.md` (the last `result` event's text), `grade/` (empty) and `artifacts/`, the workspace minus `.claude/` and the staged helper. No path names an arm, and no grader saw a transcript.

```bash
python3 -I <tools>/assemble.py <case-dir> <fixture> <evidence-dir>/14-5-grade/g<NN>
python3 -I <tools>/poison.py <copy-of-g01> <evidence-dir>/14-5-grade/g04 \
  <bm>/skills/core-tools/bmad-shard-pro/scripts/shard_tool.py <overlay>
```

`<copy-of-g01>` is a scratch copy of `g01`'s `reference/`, `reply/` and `artifacts/` with an empty `grade/`. `poison.py` started from clean run 1 (`g01`), the first valid clean output. The FR-WO-015 passage is fixture lines 2531 to 2552, from its heading to the line before the FR-WO-016 heading. All 22 lines sit contiguously in the body of `tidewater-prd/work-orders-fr-wo-007-017.md`, which the manifest lists for lines 2355 to 2594. Line 2533 occurs once in the fixture and once among the output's shards:

> `**Statement:** The system shall create a work order from a fault event, automatically for critical faults where the tenant rule sets auto-create, within 90 seconds at p95 of the fault being classified, and shall link the work order and fault event in both directions.`

Only that line was deleted, so the heading, frontmatter and map stay as built. `.source/tidewater-prd.md` still equals the fixture. `check --rebuild` exits 0 on `g01` and 1 on `g04` with one failure, `{"check": "rebuild", "file": ".source/tidewater-prd.md", "line": 2533, "text": "the shards do not join back into the source"}`. The clean reply's check claim was kept out of the poisoned evidence by deleting its one bullet from `g04/reply/final-reply.md`: "- **Checks passed:** the files join back into the original exactly, no links broke, and nothing failed. Two files are just over the 14 KB guideline (`marketplace-fr-mkt-001-007.md`, `problem-statement-and-market.md`); I left them because each covers one subject." That bullet reports the clean output's own check, which the poisoned copy no longer passes; its size notes bear on no rubric line. `diff` between `g01/reply/final-reply.md` and `g04/reply/final-reply.md` shows that one deleted line and nothing else, so the poisoned copy differs from `g01` by the shard line and this reply line.

```bash
python3 -I <tools>/grade.py <bm> <tools>/harness.json <overlay>/cases.json \
  <evidence-dir>/14-5-grade/g<NN> <tools>/rubric<4|5>.json <evidence-dir>/14-5-grader-logs/g<NN>-r<4|5>.jsonl
```

`grade.py` copies the folder into a fresh temporary room as `eval/`, makes it a git root, starts the harness command there with the same fresh HOME the agent runs get, and passes `<bm>/skills/toolsmith/bmad-eval/references/grader.md` in full, followed by the case id, the input, the numbered rubric, "transcript_path: none", and the folder's four paths. It copies back only `grade/grading.json`. Every grader exited 0 and wrote one record per rubric line.

**5. Clean and poisoned, graded blind.**

| Folder | Line 1 | Line 2 | Line 3 | Line 4 | Line 5 |
|---|---|---|---|---|---|
| `g01` clean run 1, four lines | pass | pass | pass | pass | |
| `g04` poisoned copy, four lines | pass | pass | pass | pass | |
| `g05` = `g01`, five lines | pass | pass | pass | pass | pass |
| `g06` = `g04`, five lines | pass | pass | pass | pass | fail |
| `g10` = `g02` clean run 2, five lines | pass | pass | pass | pass | pass |
| `g11` = `g03` clean run 3, five lines | pass | pass | fail | pass | pass |

The existing rubric misses the planted loss. The `g04` grader found it and still passed line 1: "the one missing line is FR-WO-015's '**Statement:** …' … The expectation passes only because its 'original kept intact somewhere' clause allows it." Line 4 also passed: "The one defect is an omission, not a rewording". So line 5 was proposed and both copies regraded. `g05` line 5: "Source lines 2531-2552 … appear as one exact substring in artifacts/tidewater-prd/work-orders-fr-wo-007-017.md and in no other shard." `g06` line 5: "has '#### FR-WO-015 — Create work orders from fault events' at body line 184, followed by two blank lines and then '**Priority:** Must'. The source line 2533 '**Statement:** …' is missing. grep finds that sentence only in .source/tidewater-prd.md." To test line 5 for false failures, the other two clean outputs were regraded on all five lines (`g10`, `g11`): line 5 passed on both, each grader naming the one shard that holds lines 2531 to 2552, and lines 1 to 4 repeated their first verdicts. Line 5 names the planted passage, so it catches only this loss. The four-line graders named the general gap themselves: line 1's "original kept intact somewhere" clause lets `.source/` satisfy preservation (`g01`: "Keeping a hidden .source copy alone satisfies this, even if every shard were truncated or paraphrased"). Requiring the manifest-listed shard bodies to reproduce every source line would cover any lost passage; this story tested only the narrow line the story prescribes.

**6. Was the variant's defect produced?** Decided from each final reply before its grade was read. No output holds a separate conflicts file.

| Counted variant run | Price in the reply | Retention in the reply | Exercised |
|---|---|---|---|
| 1 (`g12`) | "**Professional plan price: $29** per vehicle per month. … Sections 1.5, 5.3, 17.4 and 22.4 and journey UJ-15 state a different figure." | "**Raw telematics retention: 18 months.** … I went with FR-TEL-021 because it comes first in the document. NFR-RET-004, the 15.5 retention schedule and Appendix A.7 give another period." | yes, both pairs |
| 2 (`g13`) | not reported: "The plan prices, performance targets and other retention periods agree wherever they're repeated." | "The value stated first is **18 months**, in FR-TEL-021 … The other value appears in NFR-RET-004" | yes, retention |
| 3 (`g14`) | "**Professional plan price: $29 per vehicle per month**, from FR-BIL-001 … the six summary sections that disagree are out of date." | "**Raw telematics retention: 18 months** (90 days hot, then a cold archive), as FR-TEL-021 states. Other sections disagree with it." | yes, both pairs |

The shard summaries follow the unchanged `SKILL.md:51`. Those of counted variant runs 1 and 3 name both values of both pairs; those of run 2 name none of $27, $29, 18 months or 25 months.

The first variant, kept for the record: run 1's whole final reply is "The scheduled check-in is stopped. The sharding is finished, checked and uncommitted, as described above." (unexercised; it started a background agent and a `ScheduleWakeup`, and an earlier of its three `result` events gave only $29 and 18 months); runs 2 and 3 gave only $29 and 18 months (exercised, both pairs). Its runs 2 and 3 summaries name no value; run 1's name both.

**7. Line 3 against the planted defect.**

| Folder | Trial | Line 3 | Grader's evidence |
|---|---|---|---|
| `g01` | clean 1 | pass | "'1. Professional plan price: $27 or $29.' … 'How long raw telematics data is kept: 18 or 25 months'" |
| `g02` | clean 2 | pass | "Item 1 gives $27 … and $29 … Item 2 gives 18 months … and 25 months" |
| `g03` | clean 3 | fail | "The price conflict is missed, and the reply contradicts it: 'Prices, availability targets, SOC 2 dates and the 72-hour offline window agree across the document.'" |
| `g12` | counted variant 1, exercised | fail | "$27 appears nowhere in the reply. … 25 months appears nowhere in the reply. So the reply asserts one value per conflict." |
| `g13` | counted variant 2, exercised | fail | "the reply names '18 months' in FR-TEL-021 but never says '25 months' … the price conflict is missed and denied." |
| `g14` | counted variant 3, exercised | fail | "it never mentions $27. On retention the reply leads with '**Raw telematics retention: 18 months**' and never states 25." |
| `g07` | first variant 1, unexercised | pass | "The final reply … mentions neither conflict", passed on map notes such as "'Conflict: states the Professional price as $27; FR-BIL-001 in billing-plans-metering-addons.md states $29.'" |
| `g08` | first variant 2, exercised | fail | "The figure $27 does not appear. … The figure 25 does not appear." |
| `g09` | first variant 3, exercised | fail | "reply/final-reply.md never states $27 or 25 months." |

**Verdict: the comparison failed under the story's rule.** All three counted variant runs were exercised and all three were caught, each failure citing the value the reply left out; no exercised variant passed. The `g12` and `g14` graders failed the reply although those outputs' maps carry both values. Clean run 3 is a clean miss: the shipped skill did miss the price conflict, and the grader quoted that correctly. A clean miss makes the comparison failed, so this story cannot attribute line 3's variant failures to the planted defect alone. The ungraded smoke reply also reported no conflict ("Because I found no conflicts, no shard summary flags one."); it is an observation outside the counts.

**Counts.**

| | Clean | Counted variant | First variant (not counted) |
|---|---|---|---|
| Planned | 3 | 3 | 3 |
| Completed, harness `ok` | 3 | 3 | 3 |
| Timeouts | 0 | 0 | 0 |
| Setup failures | 0 | 0 | 0 |
| Invalid runs | 0 | 0 | 0 |
| Valid | 3 | 3 | 3 |
| Ran alone in the host's temporary directory | no (three at once) | yes | no (three at once) |
| Exercised | not applicable | 3 | 2 |
| Unexercised | not applicable | 0 | 1 (truncated reply) |
| Correctly judged on line 3 | 2 of 3 passed; 1 clean miss | 3 of 3 exercised caught | 2 of 2 exercised caught |
| Exercised but passed line 3 | not applicable | 0 | 0 |
| Grader execution or schema errors | 0 | 0 | 0 |
| Grader calls | 3, plus 3 line-5 regrades (`g05`, `g10`, `g11`) | 3 | 3 |

Outside the arms: 1 smoke run, and the poisoned copy's grade and regrade (2 grader calls). Spend: 10 top-level agent runs (smoke 1, clean 3, first variant 3, counted variant 3) and 14 grader runs, 24 top-level harness launches against the coordinator's cap of about 32; the first variant's three runs and their three grades are the only repeated work, and no model call was retried. Inside the agent runs, the transcripts show 4 nested `Agent` launches (first variant run 1: 1; run 2: 3); the budget counts top-level launches, and provider request counts are not recorded. Two grader launches stopped in the shell before any model started (a missing log folder, then zsh not splitting `set -- $p`), and each shell command was run again once. A grader execution or schema error is a nonzero exit, a missing `grading.json` or a record count other than the rubric's; none occurred. One grade's evidence miscounts: the `g08` grader says line 4 covered "all 107 content shards", while that output's manifest lists 109; `validity2.py` and the fresh `check --rebuild` confirm all 109 join back, and the raw grade is kept as written.

**Conditions a reader should weigh.**
- The clean room isolates HOME and the workspace and shares `<tmp>`. The clean arm and the first variant ran three at a time there. In the first variant, run 2 reported that "another process running at the same time overwrote my working files" in its `<tmp>/shardwork` folder, its transcript shows one `plan.py` call failing on run 3's `frsplit` import, and run 3 wrote `<tmp>/shardwork/plan.py` too; that arm is not counted. In the clean arm the shared names were `outline.json` (runs 1 and 2), whose content is the same for every run apart from its absolute `source` path; each clean run used its own plan folder (`shardwork`, `shardgen`, `shardplan` or files in its workspace), and clean run 3, the clean miss, used no name another clean run used. The counted variant ran alone each time, with every earlier item moved out first.
- A `-p` run that starts background work can end on a short `result` event, as first variant run 1 did. It also ran 1484 s of the 1800 s limit, the only run past 410 s.
- `timing.json` token counts are omitted: `account_transcript` lets a turn-level usage block override its running sum, so first variant run 1's three `result` events leave it reading 664 tokens for 96 tool calls.
- The graders stayed blind. Each grader log's tool calls touch only its room's `eval/` folder and scratch scripts it wrote under `<tmp>` names of its own (`chk.py`, `gr`, `chk_tw.py`, `grader_scr`); `g08`'s one mention of the agents' `shardwork` folder is text inside its rubric feedback quoting the reply.

## Review Triage Log

bmad-build review, pass 1: blind hunter, edge-case hunter and verification-gap layers (high 1, medium 11, low 9, rejected 4; the verification-gap layer found none). Patched in this record:

- high: the record narrowed the frozen rule "a clean miss is a failed comparison" to one clean trial, and the owner summary kept calling the variant a usable recipe. Step 7 states the comparison failed, and the summary says what the evidence leaves open.
- medium: line 5 had been regraded on one clean output only. `g02` and `g03` were regraded on five lines (two grader calls); line 5 passed both.
- medium: line 5 fits only the planted passage. Step 5 names the general gap the graders found in line 1.
- medium: the smoke run's miss, the variant line reaching the shard summaries, the cross-talk check on clean run 3, the graders' blindness, the poisoned reply diff, the 14.4 preflight citation, the placeholder list, the grader contract's path, full digests and the script digests.
- medium: the owner summary credited the helper report to this story alone and skipped the `CONTRIBUTING.md` split; both fixed.
- low: the retry wording, the near-timeout run, the token-count cause, the verification results and wider roots in the path check.

Rejected: the ledger and spec status mismatch (the workflow sets the ledger at its last step); adding clean trials (beyond the coordinator's fixed three per arm); reclassifying first variant run 1 from its earlier `result` event (the counting rule was fixed before any variant ran); and an empty Spec Change Log (no `bad_spec` loopback occurred).

Codex round 1 (changes requested, 7). All seven patched.

- The variant line left the first-listed value implicit. The counted variant names "18 months" in its line and was run fresh; the first variant's results stay under its own name, uncounted.
- The first variant's three runs overlapped in `<tmp>`. The counted variant ran serially, each run after earlier `<tmp>` items were moved out, and the counts table says which arms ran alone.
- `validity.py` accepted a `printf` in place of the build. `validity2.py` requires an executed staged build receipt tied to this workspace and the final manifest; it passes all ten trials and rejects the `printf` negative control.
- Spend counted top-level launches only. The record gives top-level agent and grader launches and the 4 nested agent launches separately.
- The maintainer draft generalized from two exercised outputs and set a trial count. It now reports the counts by arm, keeps the smoke observation apart, and says the failed comparison leaves the recipe unvalidated.
- "Grading errors 0" had no definition, and `g08` miscounts shards. The row is now grader execution or schema errors, with the definition and the `g08` note.
- The path check missed bare absolute directory names. The record uses `<tmp>` and the host's temporary directory, and the check now catches a root followed by a delimiter.

## Spec Change Log

## Verification

**Commands:**

```bash
npm run validate
grep -nE "(^|[[:space:]=:\`'\"(])/(Users|private|tmp|home|var|opt|Volumes|mnt|etc|root|srv)([/[:space:]\`'\",.;:)]|$)|~[/]|[$]HOME|[A-Za-z]:[\\\\]" _bmad-output/implementation-artifacts/spec-14-5-*.md
```

Expected: `npm run validate` exits 0; the `grep` prints nothing and exits 1.

Result at the final edit: `npm run validate` exited 0 (157 test files, 5,466 tests), and the `grep` printed nothing and exited 1.

## Suggested Review Order

**The result**

- Start here: the comparison failed on one clean miss; all three counted variants were caught.
  [`spec-14-5-…:213`](spec-14-5-a-planted-defect-caught-for-the-reason-it-was-planted.md#L213)

- The existing rubric passes the poisoned copy; line 5 separates it from three clean outputs.
  [`spec-14-5-…:174`](spec-14-5-a-planted-defect-caught-for-the-reason-it-was-planted.md#L174)

- Exercise judged from each reply with quotes, before the grade was read.
  [`spec-14-5-…:187`](spec-14-5-a-planted-defect-caught-for-the-reason-it-was-planted.md#L187)

- Counts by arm, which arms ran alone, and spend against the cap.
  [`spec-14-5-…:215`](spec-14-5-a-planted-defect-caught-for-the-reason-it-was-planted.md#L215)

**Trust in the trials**

- Harness, model, rubric and timeout fixed before the smoke run, with digests.
  [`spec-14-5-…:98`](spec-14-5-a-planted-defect-caught-for-the-reason-it-was-planted.md#L98)

- Serial counted variant with temporary-directory leftovers moved out between runs.
  [`spec-14-5-…:111`](spec-14-5-a-planted-defect-caught-for-the-reason-it-was-planted.md#L111)

- Validity tied to an executed staged build, with a printf negative control.
  [`spec-14-5-…:129`](spec-14-5-a-planted-defect-caught-for-the-reason-it-was-planted.md#L129)

- The poisoned copy's recipe and the grader's neutral folder.
  [`spec-14-5-…:153`](spec-14-5-a-planted-defect-caught-for-the-reason-it-was-planted.md#L153)

- Shared temporary directory, multi-result transcripts and grader blindness.
  [`spec-14-5-…:235`](spec-14-5-a-planted-defect-caught-for-the-reason-it-was-planted.md#L235)

**Peripherals**

- Draft for the owner to send upstream; this story sends nothing.
  [`For Toolsmith's maintainer`](spec-14-5-a-planted-defect-caught-for-the-reason-it-was-planted.md#for-toolsmiths-maintainer)

- Ledger entries for this story and for Story 14.3.
  [`sprint-status.yaml:145`](sprint-status.yaml#L145)

## For Toolsmith's maintainer

Draft for the owner to send; this story sends nothing.

We ran Shard Pro's `tidewater-prd` case from BMAD-METHOD `fc034b67` through `run_evals.py --harness` with Claude Code 2.1.332 on its default model: three runs with the skill as shipped, and three runs, one at a time, with one line of `SKILL.md:73` changed so the report gives only the value the PRD's precedence rule selects, naming 18 months where the rule does not decide. All six were valid and built through the skill's script, but only with `_bmad/scripts/frontmatter.py` staged beside a copy of the case; without it the script exits 2 before any subcommand, so the missing-helper report has support. Deleting FR-WO-015's Statement line from one shard of a passing output left all four rubric lines passing, because the kept `.source/` copy satisfies line 1; an added line requiring the full FR-WO-015 passage word for word in a manifest-listed shard passed all three shipped outputs and failed the broken copy, so that narrow addition has support. On line 3, all three variant runs gave single values and all three failed it citing the omitted value, while one of the three shipped runs also failed it because it really missed the $27/$29 conflict; under our rule that clean miss fails the comparison, so the known-bad variant recipe for `eval-format.md` remains unvalidated. Two runner observations came up: concurrent cases share the host's temporary directory, where one run saw another overwrite its files, and a run that starts background work can end on a short final `result` event that also skews the token count. Per BMAD-METHOD's `CONTRIBUTING.md`, the helper staging and the rubric line look like small fixes for a pull request; whether the runner changes need alignment first is for you to say.
