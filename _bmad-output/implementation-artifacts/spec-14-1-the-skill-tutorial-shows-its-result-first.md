---
title: 'The skill tutorial shows its result first'
type: 'chore'
created: '2026-11-26'
status: 'in-progress'
review_loop_iteration: 0
baseline_commit: '2f045fc41fe984475d9607fbbb367f55a272c70c'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-14-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A reader of `docs/how-to/evaluate-skill-behavior.md` meets probe classification, run-record and observation detail, strength-vector semantics and the AD-40 pairing rule inside the numbered lab before the two-row result those stages produce.

**Approach:** Put the two-row result table directly after the existing opener, keep the lab as a short executable path in dependency order, and move the stage internals plus the existing reference sections under one `## Advanced` heading. Only `docs/how-to/evaluate-skill-behavior.md` changes, plus a `doc-claims` entry in the same commit if a pinned sentence must change.

## Boundaries & Constraints

**Always:** The opener (frontmatter, H1, intro, and "The core problem: lazy shortcuts" through "You will run the selector runner locally…") keeps its claims word for word. Commands stay in dependency order: setup, compile, honest preflight, degenerate preflight, preflight readback, honest score, honest readback, degenerate score, degenerate readback. The three `<!-- expect-exit: 0 -->` runner pairs keep one invocation per fence and their `text` block after it, with blank lines only between. Each `intro`-pinned sentence stays immediately before the example it introduces. The page says both arms come back `CONCERNS` at exit `0`.

**Ask First:** Any change outside the page and `eval-quality.config.json`; any edit to a pinned sentence's wording.

**Never:** Touch `examples/tutorials/skill/`, `scripts/generate-tutorials.ts`, `scripts/tutorial-target.ts`, `website/`, the page path or its frontmatter. Weaken or reconfigure any gate. Change a command, flag, digest or transcript line. Add a claim the engine does not make.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh run | Built checkout, documented chain run in order into a new empty directory | Every command exits 0; readbacks match the page transcripts | A missing producer fails the run because no stale file exists |
| Result table | JSON written by that fresh run | Inclusion passes on both arms; exclusion passes honest, fails degenerate; gameability `{"caught":1,"exercised":1,"rate":1}`; verdict `CONCERNS` both arms | Any mismatch blocks the story |

</frozen-after-approval>

## Code Map

- `docs/how-to/evaluate-skill-behavior.md` -- the only content change. Opener lines 8–40. Runner pairs at 93, 103, 117. Rule-check table 129–134 duplicates the new result table. Internals in the lab: twin-run callout and diagram 57–84, demonstration-vs-replay callout 160, preflight explanation 194–206, honest read 235–247, degenerate read 278–286, AD-40 paragraph 309–314. Reference sections 334–538.
- `eval-quality.config.json:1047` -- `lists` entry, pins "`compile` accepts … and rejects a contract declaring" (line 14, opener, unchanged).
- `eval-quality.config.json:1290,1301,1312` -- `intro` entries: "This interface parses against the published `EvalContract` schema", "The inclusion half says the run named everything the rules mandate:", "The exclusion half is what rejects it:". Each must stay directly above its fenced example.
- `eval-quality.config.json:1570,1602` -- `text` entries, values from `scripts/doc-claim-sources.ts` (`skillDefectVector`, `skillCorpusDigest`); the strings must stay on the page.
- `scripts/check-doc-invocations.mjs` -- replays bash fences in document order in a sandbox; `mkdir -p` and `--out` are rebased. Order is the dependency contract.
- `.github/workflows/pr-checks.yml:1329` -- `canary-tutorials`; `.github/workflows/docs.yaml` -- docs build and link job (`npm run docs:build`, `npm run docs:validate-links`).

## Tasks & Acceptance

**Execution:**
- [x] `docs/how-to/evaluate-skill-behavior.md` -- after the opener add `## The result` with a two-row Markdown table (rows: inclusion `O-001`, exclusion `O-002`; columns: honest arm, degenerate arm), one sentence on the gameability vector and one on `CONCERNS` at exit `0` -- the result before the internals.
- [x] same file -- trim the lab to commands, readbacks, transcripts and one-line reads per step; drop the step-1 rule-check table that the result table now carries; say the output directory starts empty -- shortest executable path.
- [x] same file -- add `## Advanced` after Key takeaways and the stop line; move the twin-run callout and diagram, the replay-input callout, the preflight explanation and attribution boundary, the strength-vector and verdict-basis reading, and the AD-40 pairing paragraph there; demote the existing reference H2 sections to H3 under it -- one Advanced heading.

**Acceptance Criteria:**
- Given the reordered page, when read top to bottom, then the result table is the first content after the opener and the opener's text is byte-identical to base.
- Given `git diff 2f045fc -- examples/tutorials/skill scripts/generate-tutorials.ts scripts/tutorial-target.ts website`, when run, then it is empty.
- Given `npm run validate`, `npm run docs:build` and `npm run docs:validate-links`, when run, then all exit 0.

## Design Notes

Anchors are kept: demoting `##` to `###` keeps each heading's slug, and no page links into this page by anchor. The result table states values the fresh run reads back: honest `O-001`/`O-002` `passed-clean-control held`; degenerate `O-001 confirmed held`, `O-002 caught violated`.

## Verification

**Commands:**
- `npm run validate` -- expected: exit 0.
- `npm run docs:build && npm run docs:validate-links` -- expected: exit 0.
- Fresh-run script (scratchpad): extract the page's bash fences after `npm run build`, rewrite `/tmp/eval-quality-skill` to a new `mktemp -d`, run them in order, then read both evidence artifacts and assert the matrix rows -- expected: all assertions pass.
