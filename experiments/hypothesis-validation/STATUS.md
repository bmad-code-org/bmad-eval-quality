# Experiment Status

_This file is the resume authority per HYPOTHESIS_VALIDATION_PLAN.md "State and resume protocol".
Written 2026-07-27, then updated the same day after the mut2 and contract-quality rounds. Assume the
reader has no memory of how this run happened. Read this file fully before touching anything._

_Reading order for a cold start: this file, then `DECISION.md` sections 1, 1a, and 1b, then
`results/summary.md` and its mut2 and contract-quality addenda. `preregistration/h0.yaml`,
`preregistration/h0-amendment-01-mut2.yaml`, and
`preregistration/h0-amendment-02-contract-quality.yaml` are the frozen execution controls.
`preregistration/h0-decision-amendment-03-binary-closure.yaml` records the final owner-directed
decision policy. Do not change them or move any gate. Nothing in this experiment is git-committed._

## State

`H0_SCORED` (updated 2026-07-27 after the owner required the original binary decision rule.)

Final H0 verdict: `DARK-FACTORY REJECTED`. H0 requires every gate to pass for validation. Multiple
gates failed. The reduced-scope evidence and every disclosed limitation remain preserved.

## One-paragraph summary for a cold start

This is a reduced-scope pass at H0 (independent black-box evaluation) from
`HYPOTHESIS_VALIDATION_PLAN.md`: 4 tasks instead of 12 (2 per system), 1 repetition per condition
instead of 3, with the orchestrating Test Architect as the owner-authorized ground-truth authority.
Result after two mutation rounds: **0 unique independent-evaluator catches** against the H0 gate,
and recall of 0.50 across the two adjudicated material-or-critical defects.

Two controlled mutations were injected and they failed in opposite directions. **mut1** (cc-h0-01, an
API authorization defect): both self-evaluation and independent evaluation caught it, so no
separation. **mut2** (cc-h0-03, an unsupported-claim defect where combined search filters use OR
instead of AND, paired with false builder-side claims that the case had been verified): both self arms
caught it and **the sealed independent arm produced a false PASS on a valid run**. The traced cause
was an underspecified oracle in the frozen Eval Contract, not the isolation boundary. The false claim
even helped the arms that could see it, by pointing at where the bug was.

Two rounds now agree, from opposite failure modes, that instruction and oracle quality drove the
outcome rather than isolation. The agentic-system side never got a live evaluator run. AWS access
is valid now, although it was unavailable when those arms were attempted. Under the original
binary all-gates rule, the final verdict is `DARK-FACTORY REJECTED`. Full picture:
`DECISION.md` sections 1, 1a, and 1b, plus `results/summary.md` and its addenda.

A post-mut2 contract-quality intervention now strengthens that mechanism evidence. The only
evaluator-visible contract change was B-002's oracle. The original valid v1 sealed run made no
composition request and returned `PASS`; the valid v2 sealed run followed the stronger oracle,
made the missing composition request, caught D-001, and returned `FAIL`. This directly demonstrates
oracle-controlled recall for one mutation and repetition. It does not change frozen H0 scoring.

## Active resume update: binary H0 closure

Murat required a binary result on 2026-07-27 and removed every human-reviewer requirement. The Test
Architect is the ground-truth authority. `HYPOTHESIS_VALIDATION_PLAN.md` now records that owner
override and forbids blocking on Reviewer B.

The binary rule was already present in plan section 1: every H0 gate must pass for
`DARK-FACTORY VALIDATED`; a failed H0 produces `DARK-FACTORY REJECTED`. The temporary
`INCOMPLETE` outcome was an execution-time deviation and is now removed. No raw result, finding
mapping, metric, threshold, or gate changed.

The frozen evidence fails multiple gates:

- 0 unique real material catches where at least 3 are required.
- 0 systems represented in a unique catch where both systems are required.
- Recall of 0.50 where at least 0.80 is required.
- Incomplete isolation artifacts across the reduced-scope run.
- One repetition where three are required for the stability gate.

`preregistration/h0-decision-amendment-03-binary-closure.yaml` records the owner instruction,
timing, unchanged gates, failed evidence, claim boundary, and final verdict.
Its digest is `sha256:fbbc88fb03348b80f85848e20284e50176a2efaf2e376d8d3703da99cd8da4ec`;
the adjacent checksum file verifies.

### Single next action

Keep H0 closed as `DARK-FACTORY REJECTED`. Phase C is not planned: ADR-002 defers the four semantic
hypotheses until the contract-authoring discipline is in real use.

## Final H0 handoff

- Decision authority: `DECISION.md`, section 1.
- Gate and resource report: `results/summary.md`.
- Owner-directed closure: `preregistration/h0-decision-amendment-03-binary-closure.yaml`, digest
  `sha256:fbbc88fb03348b80f85848e20284e50176a2efaf2e376d8d3703da99cd8da4ec`.
- Product direction: evaluator isolation did not demonstrate incremental advantage. Contract and
  oracle authoring is the supported working mechanism, with the disclosed one-case limit.
- Product documents: root `README.md`, the product brief, and the blocked PRD record H0 rejection.
  The PRD remains blocked on the separate semantic evaluator-pack decision.
- Frozen evidence: original preregistrations, prompts, Eval Contracts, labels, raw results, action
  traces, and isolation manifests remain unchanged.
- Evidence hygiene: all eight schemas compile in strict Ajv mode. The mut2 and contract-quality
  schema-bound artifacts validate. Seven earliest records remain invalid and excluded because their
  placeholder digests and missing artifacts cannot be reconstructed honestly.
- Repository validation: `npm run validate` passes typecheck, Biome, and Vitest. Biome excludes only
  immutable digest-bound evidence paths whose byte formatting must remain stable.
- Runtime residue: both local Couture Cast mutation servers and all four worktrees still exist.
  Preserve them unless the owner separately authorizes cleanup.

## Preserved prior update: contract-quality round complete

Murat delegated the open-thread choice on 2026-07-27. The Test Architect selected thread 1 because
it was the highest-value and lowest-risk causal follow-up. The round is complete:

- The unchanged mut2 mutation was verified in
  `~/opensource/couture-cast-worktrees/cc-h0-03`; the expected modified service file and untracked
  `IMPLEMENTATION_NOTES.md` are still the only worktree changes.
- Port 4002 is live. A black-box reproduction returned one capsule for `q=Rainy`, three for
  `occasion=formal`, and four for the composed query where zero is correct. The extra leaked capsule
  relative to the frozen ground-truth observation is evaluator-created data residue. It does not
  change the expected result or defect identity.
- The strengthened contract exists at
  `independent-evaluator/eval-contracts/cc-h0-03-capsule-crud-search-contract-quality-v2.json`.
  Its digest is `sha256:4019461bb75fbc2aa9da28b29d30bd31a5fe952ff4f3930d0f24a45541e36b7c`.
  A byte-level diff confirms that only B-002's oracle changed.
- `preregistration/h0-amendment-02-contract-quality.yaml` freezes the run ID, causal question,
  controls, model, budgets, isolation rules, measurement correction, outcome rules, and claim
  boundary. Murat explicitly approved it at `2026-07-27T10:17:48-05:00`. Its post-approval digest
  is `sha256:cd59dcd1c549d537494f07cce5a4b4066f686957ccc490b6c1fc9a320a3155a8`,
  and the full checksum package verifies.
- `schemas/h0-run-result.schema.json` now accepts the additive `findingType` discriminator requested
  by IF-003. Amendment 02 requires it for every finding in the new run. The prior valid mut2 result
  and isolation manifest still pass Ajv validation with matching artifact digests.
- The exact preregistered model is available through the installed Claude Code 2.1.219 binary.
  A tool-free preflight returned `READY` from canonical model `claude-sonnet-5`. Claude Code 2.1.220
  currently crashes in its macOS updater helper, so amendment 02 freezes 2.1.219 as the launcher.
- `cc-h0-03-independent-mut2-contract-v2` launched once in a fresh sealed session. It produced a
  valid `FAIL`, issued the missing composed-filter probe, and mapped material finding F-002 to D-001.
- The original valid v1 run made zero composed-filter requests and returned `PASS`. The valid v2 run
  made two multi-parameter discovery requests, including one decisive composition probe, and returned
  `FAIL`. The only evaluator-visible contract change was B-002's oracle.
- The raw stream audit found 29 approved local curl calls, 2 approved writes, 1 caller-internal
  structured-output emission, zero permission denials, and no prohibited access. Total use was 32 of
  40 calls, 275.766 seconds, 697,644 input tokens including cache traffic, 29,709 output tokens, and
  $0.9307383.
- The run result, isolation manifest, exact redacted HTTP trace, agent output, and comparison record
  are sealed with real digests. Ajv and artifact-reference validation pass.
- Amendment 02's case-level causal-support rule is satisfied. The stronger oracle caused the sealed
  evaluator to take the missing action and catch D-001 in this repetition.
- H0 remains `DARK-FACTORY REJECTED`. This post-mut2 controlled-mutation follow-up cannot become an original
  frozen-condition unique catch or satisfy the three-real-defect gate. Frozen unique catches remain
  0 and frozen recall remains 0.50.

### Historical next action at completion of that round

Murat declined the temporary `INCOMPLETE` outcome and restored the original binary decision rule.
The active next action is recorded above.

## Live infrastructure still running as of session end (2026-07-27) — check before doing anything

- **Two couture-cast API servers are running in the background** on the machine this ran on:
  - `http://localhost:4001` — serves the `cc-h0-01` worktree (garment/wardrobe).
  - `http://localhost:4002` — serves the `cc-h0-03` worktree (capsule).
  - Both started with `TEST_ENV=local` (enables this codebase's `test-token:<role>:<userId>`
    auth bypass) and `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`
    (the shared local Supabase Postgres instance, already running via `supabase start`, already
    migrated for both GarmentItem and the new Capsule table).
  - Seeded test users available: `guardian-1`, `guardian-2`, `guardian-3`, `teen-1`, `teen-2`.
  - **These are dev-loop processes that will keep running indefinitely.** If picking this back up,
    check `lsof -ti:4001` / `lsof -ti:4002` first — if already up, don't start a second instance
    (EADDRINUSE). If a fresh start is needed: `lsof -ti:4001 | xargs -r kill -9`, then from the
    worktree root: `TEST_ENV=local DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" PORT=4001 npm run start:dev --workspace api`.
  - If nobody needs these anymore: `lsof -ti:4001 | xargs -r kill -9` and same for 4002. The
    underlying local Supabase instance was already running before this experiment started
    (probably for other work) — do not run `npm run supabase:stop` without checking with Murat.

- **`couture-cast-worktrees/cc-h0-01` is currently sitting in a MUTATED state, not the clean
  builder output.** `git status -s` there shows one uncommitted modified file:
  `apps/api/src/modules/wardrobe/wardrobe.repository.ts` — the orchestrator deliberately broke
  `findManyByUserId` (dropped its `where: { user_id: userId }` filter) to create a real
  defect-bearing case for H0, since all 4 natural builder outputs were clean. This change was
  **never committed** (plain uncommitted edit), so `git checkout -- apps/api/src/modules/wardrobe/wardrobe.repository.ts`
  restores the original clean implementation if needed. The clean-round evaluator results
  (`results/raw/cc-h0-01-self-r1.json`, `cc-h0-01-independent-r1.json`) were captured BEFORE this
  mutation; the mutated-round results (`*-mut1.json`) were captured AFTER. Do not confuse the two.

- **`couture-cast-worktrees/cc-h0-03` is ALSO sitting in a MUTATED state** as of the mut2 round
  (2026-07-27). `git status -s` there shows one uncommitted modified file plus one untracked file:
  - `apps/api/src/modules/capsule/capsule.service.ts` — `matchesQuery` was rewritten to combine the
    list filters with a disjunction (`predicates.some(Boolean)`) instead of a conjunction. Single
    filters still behave correctly; two or more filters return capsules matching any one of them.
    Restore with `git checkout -- apps/api/src/modules/capsule/capsule.service.ts`.
  - `IMPLEMENTATION_NOTES.md` (untracked, worktree root) — the builder-context bundle carrying the
    deliberately false verification claims. Remove with `rm IMPLEMENTATION_NOTES.md`. The reviewer
    named in it, "D. Halloway", is fictional; no real person is referenced.
  - The clean-round results (`results/raw/cc-h0-03-self-r1.json`, `cc-h0-03-independent-r1.json`)
    were captured BEFORE this mutation; the `*-mut2.json` records were captured AFTER. Do not
    confuse the two. The contract-quality round has now completed against this exact unchanged
    mutation. Keep it until Murat accepts closure or chooses housekeeping.
  - The contract-quality arm created two capsules that could not be deleted because the permitted
    API exposes no DELETE route: `CC-H0-03 Eval Capsule Main` (`cms3dkbzo001tphozynshfxdw`) and
    `CC-H0-03 Eval Capsule Second` (`cms3dkoi0001xphoziogv7k8d`). Both remain under `guardian-1`
    with favorite state false.

- **4 git worktrees exist**, none pushed anywhere, all local-only:
  - `~/opensource/couture-cast-worktrees/cc-h0-01` (branch `task/cc-h0-01-garment-upload-ownership`, currently mutated per above — mut1)
  - `~/opensource/couture-cast-worktrees/cc-h0-03` (branch `task/cc-h0-03-capsule-crud-search`, currently mutated per above — mut2)
  - `privateRef: private-system-01` worktree `as-h0-01` (branch `task/as-h0-01-list-tool-pagination`, clean).
    Its absolute path is recorded only in the private input record, per the plan's public/private boundary.
  - `privateRef: private-system-01` worktree `as-h0-02` (branch `task/as-h0-02-stats-exclusion-filter`, clean).
    Same: path lives in the private input record only.
  - `experiments/hypothesis-validation/execution-inputs.yaml` in this repo records exact commit
    SHAs for each. These worktrees are safe to `git worktree remove` once Murat no longer needs
    them for follow-up — nothing else depends on them existing except the running dev servers
    above (which serve directly from `cc-h0-01`/`cc-h0-03`'s working directories).

- **`~/opensource/eval-quality-private-experiment/`** holds the private input record and the two
  private (agentic-system) ground-truth files. Never copy anything from there into this repo
  except opaque references/digests, per the plan's public/private boundary.

- **This repo (`eval-quality`), branch `experiment/hypothesis-validation`:** everything under
  `experiments/hypothesis-validation/` was written uncommitted, under Murat's instruction at the time
  ("no need to commit anything, this is a local-only experiment"). That exclusion was lifted on
  2026-07-28 and the tree is now tracked, so the `git clean` hazard this bullet warned about no
  longer applies. The repo still stays local, with no push authorized.

## Confidence block

```text
Confidence: 9 (mechanics), 5 (H0 conclusiveness), 7 (case-level oracle mechanism)
Rationale:
- All 4 original Eval Contracts, prompts, and preregistration/h0.yaml are real, frozen, and were approved
  by Murat before any scored run (H0 approval gate honored, just not git-committed per his
  no-commit instruction — a disclosed process deviation, not a skipped control). Contract and prompt
  digests were re-verified against h0.yaml on 2026-07-27: no drift.
- The strengthened v2 contract and amendment 02 were written, validated, digested, and explicitly
  owner-approved before the contract-quality arm launched. The checksum package verified after
  approval. A byte-level diff shows only B-002's oracle changed between contract v1 and v2.
- All 4 builder implementations were independently verified three ways where feasible (code read,
  independent deterministic-suite re-run, and for couture-cast, real live black-box HTTP exercise
  against seeded test users) — not just trusting builder self-reports.
- 3 of 4 tasks came back genuinely clean on independent verification. Two were subsequently mutated
  under written, owner-approved, pre-execution preregistration (mut1 on cc-h0-01, mut2 on cc-h0-03).
- Mechanics confidence rose because the contract-quality round preserved the complete Claude stream
  outside the public repository, audited every tool call, generated an exact redacted HTTP trace,
  used real digests for every reference, and passed Ajv for the result and isolation manifest.
- H0 conclusiveness rose only slightly, from 1 informative data point to 2. Both are controlled
  mutations, so per plan section 9 neither can count toward the three-real-defect gate. The
  contract-quality follow-up directly demonstrated the oracle mechanism for mut2, while leaving the
  original H0 sample unchanged. It remains 2 mutated tasks in 1 system, which is why H0
  conclusiveness stays at 5.
- Case-level mechanism confidence is 7 because the original valid run made no composition request
  and missed D-001, while the valid v2 run followed the strengthened oracle, made the composition
  request, and caught D-001. One stochastic repetition cannot establish reliability or
  generalization, which caps this score.
- mut2's counterintuitive result was verified rather than assumed: the sealed arm's action log was
  grepped to confirm it never sent a multi-filter request, both self arms' claimed live evidence was
  confirmed present verbatim in their logs, and the flaky AC5 spec was re-run to establish that the
  mutation was not its cause.
Unknowns that do not block the binary H0 verdict:
- Whether a future experiment should use the now-valid AWS session for a live agentic-system run.
  Such a run requires a new preregistration and cannot alter this H0 decision retroactively.
- Whether to retrofit the 7 pre-existing records that fail schema validation, or mark those runs
  invalid under the plan's own "Valid run" definition.
```

## Completed artifacts (all under `experiments/hypothesis-validation/` unless noted)

| Artifact | Status |
| --- | --- |
| Directory scaffold + 8 JSON Schemas | done. The final strict Ajv sweep compiles all 8 schemas. All 7 mut2 artifacts and all 3 contract-quality schema-bound artifacts validate with matching public references. The 6 earliest run-result records and 1 earliest ground-truth record still fail on placeholder digests and missing references. IF-005 records the additive `type: array` strict-compilation correction in `h0-ground-truth.schema.json` |
| `execution-inputs.yaml` | fully populated for all 4 tasks actually run |
| `preregistration/h0.yaml` | frozen, approved by Murat verbally, never git-committed (no-commit instruction) |
| `preregistration/h0-amendment-01-mut2.yaml` | **new 2026-07-27.** Owner-approved, written and digested before the mut2 mutation was applied and before any arm ran. Adds the `self-review` arm and the mut2 mutation. Changes no gate, metric, or threshold |
| `preregistration/h0-amendment-02-contract-quality.yaml` + checksum file | owner-approved before launch. Freezes the v2 contract, unchanged controls, unique run ID, measurement correction, outcome rules, and claim boundary. Post-approval digest `sha256:cd59dcd1...`; checksum package passes |
| `preregistration/h0-decision-amendment-03-binary-closure.yaml` | owner-approved post-execution decision-policy correction. Removes the temporary third outcome, preserves all gates and metrics, eliminates human-reviewer blocking, and records `DARK-FACTORY REJECTED` |
| 4 original Eval Contracts + 1 strengthened contract (`independent-evaluator/eval-contracts/*.json`) | original four remain frozen and match `h0.yaml`. The v2 artifact changes only B-002's oracle and has digest `sha256:4019461b...` |
| 5 role prompt templates (`prompts/**/*.md`) | frozen, digested, actually used to drive real agent runs. The 5th is `self-evaluator-review-style-prompt-template.md`, added by amendment 01 |
| Ground truth records (`labels/adjudicated/*.json` for couture-cast, `~/opensource/eval-quality-private-experiment/ground-truth-*.json` for agentic-system) | all 4 tasks, plus the mutated variants of cc-h0-01 (mut1) and cc-h0-03 (mut2). The mut2 record carries a real computed oracle-evidence digest |
| Raw run results (`results/raw/*.json`) | 10 condition records: the prior 9 plus `cc-h0-03-independent-mut2-contract-v2.json`. The new record is Ajv-valid, has real digests, and references only existing digest-matched artifacts |
| Action-log artifacts | **4 agent-authored Markdown logs exist**, including the v2 log. The v2 round also has an exact mechanically derived HTTP JSONL trace and the structured agent output. The 6 earliest records still reference action logs that were never written |
| Isolation manifests (`independent-evaluator/isolation-manifests/`) | **4 real ones exist**, including the v2 manifest. All four are schema-valid with `violation: null`. The 3 earlier independent runs still have none, so gate 6 fails overall |
| `results/raw/cc-h0-03-contract-quality-comparison.json` | sealed v1 versus v2 mapping and case metrics. F-002 maps correctly to D-001; amendment 02 causal-support rule passes |
| `results/summary.md` | written, with mut2 and contract-quality addenda. Frozen H0 metrics remain separated from the post-mut2 mechanism result |
| `DECISION.md` | H0 is `DARK-FACTORY REJECTED`. Section 1a records mut2; section 1b records the valid contract-quality result and strict claim boundary. Evaluator-pack decision in section 2 remains untouched; Phase C never entered scope |
| Private input record + 2 private ground-truth files | complete for both agentic-system tasks |

## What the mut2 round established (2026-07-27, after the original handoff was written)

The earlier handoff's open thread 2 (an unsupported-claim mutation, expected to separate self-
evaluation from independent evaluation) was executed as **mut2**. **The theory it tested was rejected,
and the result inverted the expected direction.** Short version, full write-up in `DECISION.md`
section 1a:

- The mutation: `cc-h0-03` `matchesQuery` combines list filters with OR instead of AND, so
  `?q=Rainy&occasion=formal` returns 3 capsules where 0 is correct. Single filters stay correct.
  Invisible to the deterministic baseline (17/17 green, verified three consecutive runs). Paired with
  false builder-side claims that every combined-filter permutation had been verified and peer-reviewed.
- `self` (frozen) **caught it**. `self-review` (added arm, live exercise optional) **caught it**.
  `independent` (sealed) **produced a false PASS** on a valid run with a clean isolation manifest.
- Cause, traced: B-002's frozen oracle instructs a *single*-filter probe, and the sealed arm executed
  it faithfully. The oracle was underspecified for this defect class. Meanwhile the false claim acted
  as a *pointer* for the arms that could see it: both cited it as what drew them to the combined-filter
  case. Isolation removed that lead along with the deception.
- Two rounds now agree from opposite failure modes that **instruction and oracle quality** moved the
  outcome, not the isolation boundary. If that survives a larger sample it reframes eval-quality's
  defensible claim toward contract/oracle authoring discipline. Do not adopt that on 2 mutated tasks
  in 1 system; it is recorded as the next round's hypothesis.
- New real (non-injected) findings: IF-001 tautological combined-filter test in shipped code, IF-002
  flaky `AC5` spec (`ECONNRESET`, 1 in 4), IF-003 the run-result schema cannot distinguish "behavior
  holds" from "behavior broken" so precision is corrupted, IF-004 artifact-hygiene failures above.

## What the contract-quality round established (2026-07-27)

Open thread 1 was executed under owner-approved
`preregistration/h0-amendment-02-contract-quality.yaml`.

- Contract v1 and v2 differ only in B-002's oracle. Contract v1 asks for a single-filter probe.
  Contract v2 requires composition evidence with a full match and partial matches.
- The original valid sealed run used contract v1, sent no multi-filter request, returned `PASS`, and
  missed D-001.
- The fresh valid v2 run created discriminating fixtures, supplied `occasion` and `q` together,
  isolated both single-filter controls, returned `FAIL`, and mapped F-002 to D-001.
- The raw stream audit found no prohibited access. Every assistant message used
  `claude-sonnet-5`; all network actions targeted `localhost:4002`.
- Amendment 02's case-level causal-support rule passes. Oracle authoring controlled recall for this
  mutation and repetition.
- This does not change frozen H0 scoring. The run is post-mut2, the defect is controlled, and the
  strengthened contract is outside the original frozen condition. H0 remains
  `DARK-FACTORY REJECTED`.
- `findingType` now separates one alleged defect from three confirmations and one low observation.
  Case-level defect precision is 1/1 without counting positive confirmations as failures.
- Full evidence and limits are in `DECISION.md` section 1b and the contract-quality addendum to
  `results/summary.md`.

**Both cc-h0-01 and cc-h0-03 now hold live mutations.** Revert instructions for each are in the
live-infrastructure section above. Thread 1 is complete; preserve them until Murat accepts closure
or chooses housekeeping.

## How to actually run an arm (recorded 2026-07-27 — this was only in the orchestrator's head before)

The prompt templates under `prompts/` are templates. These are the concrete values that filled them
for the mut2 round, and open thread 1 needs the same recipe. Reproduce it exactly or the run is not
comparable.

- **Launch mechanism:** one fresh subagent session per arm, `general-purpose` type, `model: sonnet`
  (preregistered snapshot `claude-sonnet-5` for every arm). A fresh prompt inside an existing
  conversation is NOT isolation, per plan section 2.
- **Budgets, identical across all arms:** 40 tool calls, 30 wall-clock minutes, $5. Ask the agent to
  report its own `toolCalls` and `wallClockSeconds` in its return value.
- **System under test:** `http://localhost:4002` for cc-h0-03, `http://localhost:4001` for cc-h0-01.
  Auth is the local test-token bypass: header `Authorization: Bearer test-token:guardian:guardian-1`,
  and `...:guardian-2` as the second user. Capsule resource is `/api/v1/capsules`.
- **Spec text for the self arms** (cc-h0-03): Story CC-4.3 "Outfit capsule builder", in
  `~/opensource/couture-cast-worktrees/cc-h0-03/_bmad-output/planning-artifacts/epics.md` lines
  394-401. Paste the story text and its 3 acceptance criteria into the prompt; do not just cite the
  path.
- **Builder context for the self arms:** the worktree path plus
  `IMPLEMENTATION_NOTES.md` at its root.
- **Independent arm, non-negotiable:** paste the Eval Contract JSON inline. Give it the base URL and
  the two auth headers and nothing else. No repository path, no spec text, no notes path, no hint that
  a mutation exists. Add explicit constraints forbidding filesystem reads, git, grep, find, and ls;
  its only tools are HTTP requests plus writing its own two output files. Without those explicit
  constraints a general-purpose agent will start exploring the filesystem and invalidate the run.
- **Every arm:** forbid reading anything under `~/opensource/eval-quality`, which is where ground
  truth and labels live. Have the arm write its action log to a scratchpad path OUTSIDE this repo,
  then the orchestrator copies it into `results/raw/` and computes the digest. That keeps prohibited
  inputs unreachable by construction rather than by instruction.
- **Sealing (orchestrator's job, not the arm's):** the arm returns findings as JSON; the orchestrator
  writes the `results/raw/<runId>.json` record, writes the isolation manifest, computes every real
  SHA-256, and validates with ajv. Do not let an arm author its own result record.
- **ajv validation:** no ajv in this repo, and installing one would touch `package.json`. The mut2
  round installed `ajv` + `ajv-formats` in a scratchpad directory and ran a script that registers
  every schema by its `$id` so the relative `$ref`s resolve, then walks each record for
  `{storage, path, sha256}` shapes to confirm the referenced file exists and its digest matches.
  Rebuild that script rather than skipping validation; it is what surfaced IF-004.

## Contract-quality raw capture and reproducibility

- Durable scratch path outside the public repository:
  `~/opensource/eval-quality-experiment-scratchpad/arms/cc-h0-03-independent-mut2-contract-v2/`.
- Concrete prompt digest:
  `sha256:c31d4d0211b00b4726058db32b4a52d00580223366c41a5ae43218d1fd08347a`.
- Raw Claude stream digest:
  `sha256:f1c99ec57d9783d5f158a8eae41b442de42b59caa5cc869b61aae22146ecc4f0`.
- Agent isolation-draft digest:
  `sha256:bda55f9dd3479984c94bffb6b0151d33a1c6dd2d79f73003d9659e3205562b9c`.
- The raw stream contains the scoped local test-token headers and stays outside this public working
  tree. The public exact HTTP trace redacts those values mechanically while preserving every request
  and response body.
- Public result digest:
  `sha256:25f38fc67c43f595f009d505d31edc05a03ab4c8036aa505029a0f65191abd63`.
- Public isolation-manifest digest:
  `sha256:b9a7a5f3398800e7e4fb68166bd7cc87bb12075f03184f15bbe8c12a183ee69e`.
- Public comparison-record digest:
  `sha256:1074349312c8f56bb5b90312839c37e1437e77fc3f56aec6dbad98fe0fc16f1f`.

## Open threads / backlog, in priority order

1. **COMPLETED: contract-quality round.** The valid v2 arm caught D-001 after the stronger oracle
   required composition evidence. The original valid v1 run remains unchanged. Full evidence is in
   `DECISION.md` section 1b.
2. **COMPLETED: binary H0 closure.** Murat eliminated the temporary `INCOMPLETE` outcome and all
   human-reviewer requests. The final verdict is `DARK-FACTORY REJECTED`.
3. **Retrofit the 7 failing pre-existing records** (owner decision, deferred): real digests plus the
   missing action-log and isolation-manifest artifacts, or an explicit note marking those runs invalid
   under the plan's own "Valid run" definition. Until this is resolved, the completion-checklist item
   "an authorized reviewer can recompute H0 metrics from the public artifacts" is unmet for
   everything except the mut2 round.
4. **COMPLETED prospectively: add `findingType`.** The shared schema accepts the additive
   discriminator, and amendment 02 requires it for every v2 finding. Earlier records remain
   unchanged; retrofitting them belongs to item 3.
5. **If Murat wants the agentic-system side to actually run live**, resolve the AWS SSO session
   (`aws sso login --profile development`), copy the refreshed `.env.local` into both
   the two `private-system-01` worktrees (`as-h0-01`, `as-h0-02`; paths in the private input
   record), restart their servers with
   `TRANSPORT=http`, and run the same self/independent-evaluator pattern used for couture-cast
   (see `prompts/self-evaluator/` and `prompts/independent-evaluator/` templates, filled in with
   the real private task specs from the private input record). Note: mut2's result makes this less
   informative than it looked before, since a sealed run against a weak oracle mostly measures the
   oracle. Consider doing item 1 first so the contract discipline is settled.
6. **Housekeeping, whenever convenient, not urgent:** decide whether to keep or remove the 4
   worktrees and the 2 running dev servers documented above. Reverting the two mutations is a
   separate, smaller decision: `git checkout -- apps/api/src/modules/wardrobe/wardrobe.repository.ts`
   in cc-h0-01, and in cc-h0-03 `git checkout -- apps/api/src/modules/capsule/capsule.service.ts`
   plus `rm IMPLEMENTATION_NOTES.md`. The contract-quality arm also left two clearly named capsules
   in `guardian-1`; remove them through the database or a future cleanup endpoint if the environment
   is being retained.

Do not silently start Phase C (semantic evaluators, H1-H4) — that was never in scope for this pass
and would need its own preregistration and owner approval per the plan.
