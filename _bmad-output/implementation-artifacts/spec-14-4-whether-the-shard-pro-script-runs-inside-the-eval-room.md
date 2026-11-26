---
title: 'Whether the Shard Pro script runs inside the eval room'
type: 'chore'
created: '2026-11-26'
status: 'done'
review_loop_iteration: 0
baseline_commit: '2601bf5e360d4b963e89c591ba1908e70ca9cb56'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-14-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A green Shard Pro evaluation credits the skill and its script, yet `shard_tool.py` imports `<project-root>/_bmad/scripts/frontmatter.py` before any subcommand and the Toolsmith eval runner stages only the skill and the case's fixtures. Nobody has recorded whether the script can run in the staged workspace at all.

**Approach:** Read `BMAD-METHOD` at `fc034b67` from an exported copy, stage the `tidewater-prd` case with the stage-only preflight, run a real `outline` in the staged workspace, then repeat with a temporary overlay that supplies the helper. Record commands with placeholders, exit codes, checked excerpts and digests in this file.

## Boundaries & Constraints

**Always:** Read BMAD-METHOD through `git archive fc034b67` into a disposable folder. Every `run_evals.py` run passes no `--harness` and no `--harness-name`, uses an empty project root that holds no `_bmad/`, selects `--case-ids tidewater-prd`, and must show `total` 1, `skipped` 1, exit 3; zero jobs fails the step. `outline` runs through `uv run`, which installs the PyYAML that `shard_tool.py:2-5` declares. The overlay holds exactly two files, a copy of `evals/core-tools/bmad-shard-pro/cases.json` whose `tidewater-prd` case adds `_bmad/scripts/frontmatter.py` to its `files` and otherwise parses equal to the original, and that helper copied byte for byte from `skills/core-tools/bmad/scripts/frontmatter.py`. It is built by the recorded recipe outside BMAD-METHOD and outside any skill directory. The record carries no absolute or machine-specific path.

**Ask First:** Any result that departs from the story's observations (exit 2 with "Run bmad setup for this project" without the overlay, exit 0 with it).

**Never:** Change, branch or open a pull request or issue in BMAD-METHOD. Make a live model call or pass a harness. Accept `--help` output as evidence. Touch `src/`, `schemas/`, `corpus/`, docs, gates, config or fixtures of this repository.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Preflight, original cases | Empty project root, original cases file | `total` 1, `skipped` 1, exit 3; workspace holds the skill and `tidewater-prd.md` only | Zero jobs or any other exit fails the step |
| `outline` without overlay | That workspace | Exit 2, stderr names the missing `_bmad/scripts/frontmatter.py` and "Run bmad setup for this project" | Recorded as found |
| Preflight, overlay cases | Same root, overlay cases file | `total` 1, `skipped` 1, exit 3; staged helper digest equals the source digest | A digest mismatch fails the step |
| `outline` with overlay | That workspace | Exit 0 with the outline JSON on stdout | Recorded as found |

</frozen-after-approval>

## Code Map

Line numbers are at `fc034b67`; `<bm>` is the export of that commit.

- `<bm>/skills/core-tools/bmad-shard-pro/scripts/shard_tool.py:1216-1227` -- `main` parses arguments, builds `<project-root>/_bmad/scripts/frontmatter.py` (1217), prints "error: … is missing. Run bmad setup for this project." and returns 2 when absent (1218-1220), then `exec_module`s it (1223) before the subcommand table (1226). Lines 2-5 declare `pyyaml>=6.0.2,<7`. `--project-root` defaults to the current folder.
- `<bm>/skills/core-tools/bmad-shard-pro/SKILL.md:13` -- the skill invokes `uv run "{skill-root}/scripts/shard_tool.py" --project-root "{project-root}"`.
- `<bm>/skills/core-tools/bmad/scripts/frontmatter.py` -- the helper; imports `yaml`.
- `<bm>/skills/toolsmith/bmad-eval/scripts/run_evals.py` -- `stage_skill` (78) copies the skill to `<workspace>/.agents/skills/<name>`; `fixture_problems` (97) and `resolve_fixtures` (141) resolve a relative `files` entry from the project root or the cases file's folder and keep its path in the workspace; `fetch_github` (128) fetches a URL entry with `gh api`. Without a harness, `run_case` stages into `<run-dir>/skill/<case>/cwd` and records `skipped` (210-217), and `main` exits 3 (441-442).
- `<bm>/skills/toolsmith/bmad-eval/scripts/eval_common.py` -- `resolve_harness` (98) returns no harness when `<project-root>/_bmad/scripts/resolve_customization.py` is absent (114); `find_project_root` (63) walks up from the skill path when `--project-root` is omitted, which is why the root is pinned to an empty folder. `run_in_clean_room` (241) runs a harness in a fresh temporary room (253), makes its workspace a git root (260) and starts the harness there (267), so a harness run sees the same staged files as the stage-only workspace.
- `<bm>/evals/core-tools/bmad-shard-pro/cases.json` -- `tidewater-prd` pins the fixture at `bmad-method-sample-data@59de7a03`.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:146` -- this story's ledger key.

## Tasks & Acceptance

**Execution:**
- [x] Scratch -- export `fc034b67`, create an empty project root, run the original-cases preflight, run `outline` in its workspace -- story AC 1 to 3.
- [x] Scratch -- build the overlay by the recipe, record both file digests, repeat the preflight with it, compare the staged helper's digest, run `outline` -- story AC 4 and 5.
- [x] `_bmad-output/implementation-artifacts/spec-14-4-whether-the-shard-pro-script-runs-inside-the-eval-room.md` -- write the evidence: the recipe and commands with placeholders, exit codes, checked excerpts, digests, the overlay location, and a statement that no model call ran and reporting upstream is the owner's decision -- the story's record.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- set the story's status as the workflow directs.

**Acceptance Criteria:**
- Given each row of the I/O matrix, when the Evidence is read, then the step it maps to records that row's expected exit code, counts and digests.
- Given the story's seven acceptance criteria in `epics.md` (Story 14.4), when the mapping table under Evidence is read, then each one names the step that meets it.
- Given this file, when searched with the path check under Verification, then nothing matches.
- Given `npm run validate`, when run, then it exits 0.

## Evidence

Recorded 2026-11-26 with uv 0.11.32, which ran both scripts on CPython 3.15.0, and `gh` logged in to github.com. Placeholders: `<bmad-method>` is a BMAD-METHOD clone that holds `fc034b67` (on `dev`); `<scratch>` is a new, empty working folder; `<run-id>` is the folder `run_evals.py` names; `<evidence-dir>` is the epic's local evidence folder, the one the coordinator's review rounds for Epic 14 are written to, outside every repository. The clone was only read by `git archive`, and its `git status --short` was empty afterwards.

| Story 14.4 acceptance criterion | Met by |
|---|---|
| 1. `outline` with no BMAD install: exit code and message | Step 2 |
| 2. Stage-only preflight: isolated root, no resolver, `tidewater-prd`, one skipped case, exit 3 | Step 1 |
| 3. A real `outline` in the staged workspace, no `--help` | Step 2 |
| 4. Overlay built: helper copied, path added to a copy of the cases file, case otherwise kept, PyYAML present | Step 3 and step 5 |
| 5. Overlay preflight: `outline` exits 0, digests match, overlay fixed, outside BMAD-METHOD and any skill directory | Steps 3 to 5 |
| 6. No live model call | Spend |
| 7. Placeholders, exit codes, excerpts, no absolute path, upstream report left to the owner | This section and For the owner |

**Citations re-read at `fc034b67`.** Every Code Map line above was read in the export. `shard_tool.py:1216-1227` and `:2-5` hold what the story cites; nothing moved.

**1. Preflight with the original cases file.** Run the blocks below in order in one `bash` session. `set -e` stops the session at the first failed check, and each expected nonzero exit is captured with `|| rc=$?`, so the session continues past it. Checks exit nonzero explicitly and run under `python3 -I`, so neither `PYTHONOPTIMIZE` nor another `PYTHON*` variable can switch them off; `root_is_empty` runs immediately before each `run_evals.py` call and again after it.

```bash
set -euo pipefail
mkdir <scratch>/bm <scratch>/root
git -C <bmad-method> archive fc034b67 | tar -x -C <scratch>/bm
root_is_empty() {  # stops the session when the root is missing, unreadable or not empty
  local entries
  test -d <scratch>/root
  entries=$(ls -A <scratch>/root)
  test -z "$entries"
}
preflight() {  # $1: cases file, $2: output folder
  local rc=0
  root_is_empty
  uv run <scratch>/bm/skills/toolsmith/bmad-eval/scripts/run_evals.py \
    --cases "$1" --skill-path <scratch>/bm/skills/core-tools/bmad-shard-pro \
    --output-dir "$2" --project-root <scratch>/root \
    --case-ids tidewater-prd > "$2.json" || rc=$?
  test "$rc" -eq 3
  python3 -I -c '
import json, sys
s = json.load(open(sys.argv[1]))
if (s["total"], s["executed"], s["skipped"], s["failures"]) != (1, 0, 1, 0):
    sys.exit(f"counts: {s}")
if [(r["case_id"], r["status"]) for r in s["results"]] != [("tidewater-prd", "skipped")]:
    sys.exit(f"results: {s}")
' "$2.json"
  root_is_empty
}
preflight <scratch>/bm/evals/core-tools/bmad-shard-pro/cases.json <scratch>/runs-a
ws_a=$(echo <scratch>/runs-a/*/skill/tidewater-prd/cwd)
(cd "$ws_a" && find . -path ./.agents -prune -o -type f -print)
```

`run_evals.py` exits 3. Stderr: `[run_evals] no harness (BMad is not set up in this project; pass --harness); staging cases only`, then `[skipped] skill/tidewater-prd`. The summary holds `"total": 1`, `"executed": 0`, `"skipped": 1`, `"failures": 0` and one result, `tidewater-prd` with status `skipped`. The project root holds no `_bmad/`, so no customization resolver exists, and it is still empty after the run. Outside `.agents/skills/bmad-shard-pro/`, the workspace holds one file, `./tidewater-prd.md`. A `--case-ids` value that matches no case gives `"total": 0` and also exits 3, which the summary check rejects.

**2. `outline` in that workspace.**

```bash
rc=0
(cd "$ws_a" && uv run .agents/skills/bmad-shard-pro/scripts/shard_tool.py --project-root . \
  outline tidewater-prd.md) > <scratch>/outline-a.json 2> <scratch>/outline-a.err || rc=$?
test "$rc" -eq 2
test ! -s <scratch>/outline-a.json
grep -F 'error: _bmad/scripts/frontmatter.py is missing. Run bmad setup for this project.' <scratch>/outline-a.err
```

Exit 2, empty stdout, and stderr holds `error: _bmad/scripts/frontmatter.py is missing. Run bmad setup for this project.` This reproduces the story's observation. Because the check at `shard_tool.py:1217-1220` runs before the subcommand table at line 1226, every subcommand of the staged script exits the same way; only `outline` was run.

**3. The overlay.**

```bash
ov=<evidence-dir>/14-4-overlay
test ! -e "$ov"
mkdir -p "$ov/_bmad/scripts"
cp <scratch>/bm/skills/core-tools/bmad/scripts/frontmatter.py "$ov/_bmad/scripts/frontmatter.py"
PYTHONIOENCODING=utf-8 python3 -c '
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
[c] = [c for c in d["cases"] if c["id"] == "tidewater-prd"]
c["files"].append("_bmad/scripts/frontmatter.py")
sys.stdout.write(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
' <scratch>/bm/evals/core-tools/bmad-shard-pro/cases.json > "$ov/cases.json.tmp"
mv "$ov/cases.json.tmp" "$ov/cases.json"
(cd "$ov" && find . -type f | LC_ALL=C sort && shasum -a 256 cases.json _bmad/scripts/frontmatter.py)
python3 -I -c '
import json, sys
a, b = (json.load(open(p, encoding="utf-8")) for p in sys.argv[1:])
[c] = [c for c in b["cases"] if c["id"] == "tidewater-prd"]
if c["files"].pop() != "_bmad/scripts/frontmatter.py" or a != b:
    sys.exit("the copy differs from the original beyond the added entry")
' <scratch>/bm/evals/core-tools/bmad-shard-pro/cases.json "$ov/cases.json"
```

| File | SHA-256 |
|---|---|
| overlay `cases.json` | `91907f29fa325fc7ab8d8aba0ce649cf634d4525a7cab254c03d49db56c3bbfb` |
| overlay `_bmad/scripts/frontmatter.py` | `e4e8616502ace93e3fac378eeefaf22628439feb814246e56a2ee12e2e12a6fa` |
| original `evals/core-tools/bmad-shard-pro/cases.json` | `8d7c3a1fbf08ac89da79a75f13cec0c6d1bf6d82e69ad5ed9298d66822542cb1` |
| original `skills/core-tools/bmad/scripts/frontmatter.py` | `e4e8616502ace93e3fac378eeefaf22628439feb814246e56a2ee12e2e12a6fa` |

The overlay holds those two files only. Parsed as JSON, the copy equals the original once the added entry is removed. A line `diff` shows one hunk at line 34: the fixture URL's line gains a trailing comma and the new entry follows it; the URL's value, the other two cases and every rubric are unchanged. The original cases file holds no non-ASCII character, so the copy's bytes do not depend on the locale. A replay of these blocks into a new `<scratch>` and a new `<evidence-dir>` built an overlay byte-identical to the one used here. That one sits at `<evidence-dir>/14-4-overlay`, outside BMAD-METHOD and outside any skill directory. Story 14.5 checks both digests before each arm and rebuilds the overlay with this recipe when that folder is gone.

**4. Preflight with the overlay.**

```bash
preflight "$ov/cases.json" <scratch>/runs-b
ws_b=$(echo <scratch>/runs-b/*/skill/tidewater-prd/cwd)
(cd "$ws_b" && find . -path ./.agents -prune -o -type f -print | LC_ALL=C sort)
tree_digest() {  # $1: folder; SHA-256 of the sorted per-file listing, __pycache__ left out
  (cd "$1" && find . -type f -not -path '*/__pycache__/*' | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-64)
}
for f in "$ws_a/tidewater-prd.md" "$ws_b/tidewater-prd.md" "$ws_b/_bmad/scripts/frontmatter.py"; do shasum -a 256 "$f" | cut -c1-64; done
for d in <scratch>/bm/skills/core-tools/bmad-shard-pro "$ws_a/.agents/skills/bmad-shard-pro" "$ws_b/.agents/skills/bmad-shard-pro"; do tree_digest "$d"; done
cmp "$ws_b/_bmad/scripts/frontmatter.py" <scratch>/bm/skills/core-tools/bmad/scripts/frontmatter.py
```

`preflight` passes again: exit 3, one job, `tidewater-prd` skipped, the root still empty. Outside the staged skill, the workspace holds `./_bmad/scripts/frontmatter.py` and `./tidewater-prd.md`.

| Staged item | `runs-a` | `runs-b` | Source |
|---|---|---|---|
| `_bmad/scripts/frontmatter.py` | absent | `e4e8616502ace93e3fac378eeefaf22628439feb814246e56a2ee12e2e12a6fa` | same, `skills/core-tools/bmad/scripts/frontmatter.py` |
| `tidewater-prd.md` | `e477467bea21cb6a4ac228779d8a1d588345c1866eca68d748973b6c88792df1` | same | fetched by `gh api` at `59de7a03` |
| skill tree, 5 files, by `tree_digest` | `74e9f5f3a9b662e51250c99cce7d23c041aa89e195df7975f369263601d0f8a4` | same | same, over `<scratch>/bm/skills/core-tools/bmad-shard-pro` |

**5. `outline` with the overlay.**

```bash
uv tree --script <scratch>/bm/skills/core-tools/bmad-shard-pro/scripts/shard_tool.py
(cd "$ws_b" && uv run .agents/skills/bmad-shard-pro/scripts/shard_tool.py --project-root . \
  outline tidewater-prd.md) > <scratch>/outline-b.json
python3 -I -c '
import json, sys
o = json.load(open(sys.argv[1]))
if (o["lines"], o["words"], o["heading_count"], o["bare_heading_share"]) != (11039, 133990, 906, 0.0):
    sys.exit("outline values differ")
if (o["proposed_cut"][0]["start"], o["proposed_cut"][0]["end"]) != (1, 145):
    sys.exit("first proposed cut differs")
' <scratch>/outline-b.json
(cd "$ws_b" && uv run --offline .agents/skills/bmad-shard-pro/scripts/shard_tool.py --project-root . \
  outline tidewater-prd.md) | cmp - <scratch>/outline-b.json
```

`outline` exits 0. `uv tree` resolves `pyyaml v6.0.4`. That version comes from the unpinned range `>=6.0.2,<7`, so a later rebuild may resolve a newer 6.x; Story 14.5 records the version it gets. Rerun with `--offline`, `outline` gives byte-identical stdout. Stdout is one JSON object with keys `source`, `lines`, `chars`, `words`, `frontmatter_lines`, `heading_count`, `bare_heading_share`, `existing_contents`, `blocks`, `identifier_prefixes`, `headings`, `proposed_cut` and `identifiers_defined_twice`. Checked values: `"lines": 11039`, `"words": 133990`, `"heading_count": 906`, `"bare_heading_share": 0.0`, and the first proposed cut is lines 1 to 145 under "Tidewater Fleet Platform — Product Requirements Document". The `source` value is the workspace's absolute path and is left out here.

**Spend.** No run passed `--harness` or `--harness-name`, and both runs report the harness as absent, so no agent or model was started. Network use was the fixture fetch by `gh api` and whatever `uv` resolved; the `--offline` rerun in step 5 shows the script needs nothing beyond the local cache.

**Validation.** `npm run validate` exit 0: 157 test files, 5,466 tests.

**For the owner.** As pinned at `fc034b67`, the runner stages the `tidewater-prd` case without `_bmad/scripts/frontmatter.py`. `run_in_clean_room` gives a harness run the same staged files in a fresh git root, and the case's prompt names no other project, so when the agent passes that workspace as `{project-root}`, the skill's script exits 2 before any subcommand. This was observed in the stage-only workspace; no harness run was made. With the overlay, which supplies the helper copied from `fc034b67` beside a copy of the cases file whose case lists its relative path, `outline` exits 0 there. Both parts are needed: a case that lists the path while the file is absent stops `run_evals.py` at fixture validation with exit 2, before any workspace is staged. Whether and how to report this to BMAD-METHOD is the owner's decision; this story sends nothing.

## Review Triage Log

bmad-build review, pass 1: blind hunter, edge-case hunter and verification-gap layers (high 0, medium 9, low 12, rejected 10). Patched in this record:

- medium: the "For the owner" claim covered harness runs from a stage-only test. It now cites `run_in_clean_room` for what a harness run stages and says no harness run was made.
- medium: the overlay's location was unnamed. It is now `<evidence-dir>/14-4-overlay`, with the placeholder defined and the rebuild rule for 14.5.
- medium: the overlay recipe read the clone with `git show`, against the spec's rule. It now copies from the `git archive` export, and a rebuild matched byte for byte.
- medium: the recipe could leave a truncated `cases.json` or mix into an existing folder. It now runs under `set -euo pipefail`, requires a new folder and moves a temporary file into place.
- medium: "the only network call" ignored `uv`. The record now names both and shows `--offline` reruns.
- medium: the overlay's parse equality was shown by a line `diff` only. A parsed comparison is recorded.
- medium: the spec's ACs did not cover the story's outcomes. ACs now tie each matrix row and each story criterion to a step, with a mapping table.
- medium: the path check scanned only Evidence and broke when rendered. It now scans the whole file from a fenced block.
- medium: the context edit dropped the owner's live-run budget for 14.5. Restored.
- low: the `npm run validate` result, the interpreter, the `gh` login, the `uv tree` command, the unpinned PyYAML range, the line behind "every subcommand", the fixture and skill digests in both arms, the self-contradicting URL sentence, the 14.5 harness fallback, the 14.6 lockfile-age wait, and the missing 14.6 entries in the epic context.

Rejected: the spec and ledger status mismatch (the workflow sets the ledger at its last step), a locale-dependent rebuild (the file is ASCII), a lockfile resolve bumping other packages (Story 14.6's own AC covers it), the context sync living in this pull request (it is part of this story's workflow and reverts with it), and `type: 'chore'` (Stories 14.1 and 14.2 use it).

Codex round 1 (high 0, medium 3, low 0). All three patched; the replay below confirmed each fix.

- medium: under `set -e` the preflight stopped the shell at its expected exit 3, a zero-job selection also exits 3, and `mkdir -p` accepted a reused root. Steps 1 to 5 now run as one `bash` session: the root is created fresh and checked empty before and after each run, expected exits are captured with `|| rc=$?`, and a check requires exit 3, one job and `tidewater-prd` skipped. A replay of every block into a new `<scratch>` and `<evidence-dir>` reached its end, and its overlay matched the one used here byte for byte.
- medium: the skill-tree digest's method was described in words, and sorting the `shasum` lines gives a different value. The `tree_digest` function now records the exact command.
- medium: the owner summary credited the `files` entry alone. It now says the overlay supplies the helper and the copied case lists it, and that a listed but absent helper stops `run_evals.py` at fixture validation with exit 2, which a run confirmed.

Codex round 2 (high 0, medium 2, low 0). Both patched.

- medium: the root was checked only before the first preflight and after each run, so a resolver placed between runs could be consulted before the check. `root_is_empty` now runs immediately before each `run_evals.py` call, stops the session when the root cannot be read, and runs again after the call. A replay that placed `_bmad/` in the root before the overlay preflight stopped there, and `runs-b` was never created.
- medium: the checks used `assert`, which `PYTHONOPTIMIZE` turns off. Every check now exits nonzero explicitly and runs under `python3 -I`. The full replay passed with `PYTHONOPTIMIZE=1` set, and its overlay matched byte for byte.

## Spec Change Log

## Verification

**Commands:**

```bash
npm run validate
grep -nE "(^|[[:space:]=:\`'\"(])/(Users|private|tmp|home|var|opt)/|~[/]|[$]HOME|[A-Za-z]:[\\\\]" _bmad-output/implementation-artifacts/spec-14-4-*.md
```

Expected: `npm run validate` exits 0; the `grep` prints nothing and exits 1.

## Suggested Review Order

**The finding**

- Start here: what the owner can act on, scoped to what was observed.
  [`spec-14-4-…:210`](spec-14-4-whether-the-shard-pro-script-runs-inside-the-eval-room.md#L210)

- Without the helper, `outline` exits 2 before any subcommand.
  [`spec-14-4-…:117`](spec-14-4-whether-the-shard-pro-script-runs-inside-the-eval-room.md#L117)

- With the overlay, `outline` exits 0 on the staged fixture.
  [`spec-14-4-…:186`](spec-14-4-whether-the-shard-pro-script-runs-inside-the-eval-room.md#L186)

**The preflight and the overlay**

- Stage-only run: empty root, one skipped case, exit 3.
  [`spec-14-4-…:80`](spec-14-4-whether-the-shard-pro-script-runs-inside-the-eval-room.md#L80)

- Overlay recipe and digests that Story 14.5 checks before each arm.
  [`spec-14-4-…:130`](spec-14-4-whether-the-shard-pro-script-runs-inside-the-eval-room.md#L130)

- Both arms staged the same skill and fixture; only the helper differs.
  [`spec-14-4-…:164`](spec-14-4-whether-the-shard-pro-script-runs-inside-the-eval-room.md#L164)

- Story criteria mapped to steps; no model call.
  [`spec-14-4-…:68`](spec-14-4-whether-the-shard-pro-script-runs-inside-the-eval-room.md#L68)

**Peripherals**

- Epic context refreshed for 14.5's harness and budget and the new 14.6.
  [`epic-14-context.md:49`](epic-14-context.md#L49)

- Ledger entry for this story.
  [`sprint-status.yaml:146`](sprint-status.yaml#L146)
