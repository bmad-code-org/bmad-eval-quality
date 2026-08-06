# spine-lint

Mechanical decision-integrity checks over `ARCHITECTURE-SPINE.md`. The authoritative copy of this
script lives here, in the tracked tree, because the copies installed under `.claude/`, `.agent/` and
`.agents/skills/bmad-architecture/scripts/` are gitignored as local agent tooling and cannot run in
continuous integration. Keep all four byte-identical; `npm run lint:spine` runs this one.

## Why the three cross-reference rules exist

Four review rounds on the eval-quality spine produced 180, then 50, then 24, then 17 findings, and
three of the most repeated classes were mechanical rather than semantic. They are checked here so a
reviewer never has to look for them again:

- **`code_citation`** — a sentence stating a compile-time prohibition must cite a literal code from
  the failure-code registry AD. It was failing at twelve sites in one revision, and it found three
  more that four rounds of reading had passed over.
- **`declaration_citation`** — a field an AD says another AD declares must appear in that AD. This is
  the signature that let one decision rest a repair on "method and path template are declared per
  operation under AD-19" while AD-19's list contained neither, and it caught a fourth instance of the
  same signature that no human round found.
- **`artifact_path`** — a cited repository path must resolve on disk. Three ADs carried citations to
  calibration evidence that did not exist, through revisions that had each passed their own review.

The first two are opt-in through `--registry-ad`, and the third through `--workspace-root`, so a spine
with no failure-code registry AD skips them rather than reporting a document-wide failure.

## Running it

```bash
npm run lint:spine        # the eval-quality spine, all rules, non-zero exit on high severity
npm run test:spine-lint   # the 45-test suite
```

Directly:

```bash
python3 scripts/spine-lint/lint_spine.py \
  --workspace _bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29 \
  --registry-ad 5 --workspace-root . --fail-on high
```

`--fail-on` defaults to `never`, preserving the original always-exit-zero contract for callers that
read the JSON and decide for themselves. Findings always travel in the JSON regardless of exit code.

## Keeping the copies in step

```bash
for d in .agents .claude .agent; do
  cp scripts/spine-lint/lint_spine.py "$d/skills/bmad-architecture/scripts/lint_spine.py"
  cp scripts/spine-lint/tests/test_lint_spine.py "$d/skills/bmad-architecture/scripts/tests/test_lint_spine.py"
done
```
