# Test Plan: Next Steps for `eval-quality`

Author: Murat K Ozcan  
Repository: `bmad-eval-quality` (`bmad-code-org`)  

## 1. Strategy

`eval-quality` compiles behavioral contracts and scores evidence deterministically. It does not run agents or manage LLM execution directly. External harnesses (`bmad-tea`, CI runners, production tools) collect evidence and pass it to `eval-quality` for preflight verification, sealing, and scoring.

```text
┌────────────────────────────────────────────────────────┐
│               Evaluation Subject / Harness            │
│   (e.g., bmad-tea, BMAD-METHOD, Production MCP Server) │
└──────────────────────────┬─────────────────────────────┘
                           │ 1. Passes Contract & Evidence
                           ▼
┌────────────────────────────────────────────────────────┐
│                   eval-quality                         │
│  ├── 1. compile (Validate Behavioral Contract)        │
│  ├── 2. preflight (Verify Subject & Probe Boundaries)  │
│  ├── 3. seal      (Lock Contract + Evidence Inputs)    │
│  └── 4. run       (Compute Deterministic Score)        │
└────────────────────────────────────────────────────────┘
```

## 2. Phase 1: Self-Conformance and Adapter Verification

Verify that published ports and adapters pass conformance before evaluating external targets.

### 1. Run Published Conformance Suite
Execute the shipped adapter suite at `@bmad-code-org/eval-quality/conformance`:

```bash
npm run test:conformance
```

Pass criteria:
- `runPortConformanceSuite` passes all 32 adapter cases (`NodeFileSystemAdapter`, `LocalCorpusAdapter`, `SystemClockAdapter`).
- `runProbeConformanceSuite` passes `AD-35` target policy checks.

### 2. Verify CLI Commands
Run the CLI binary on committed corpus files:

```bash
# Single-pass compile and seal
npx eval-quality eval --contract corpus/dev/contracts/satisfied-declarations.json --out ./dist/eval-out

# Preflight check
npx eval-quality preflight --contract corpus/dev/compile-seal-example/contract.json \
  --probes corpus/dev/compile-seal-example/probes.json \
  --observations corpus/dev/compile-seal-example/observations.json \
  --run-id run-1 --out ./dist/eval-out
```

## 3. Phase 2: BMad Ecosystem Integration (`bmad-tea` & `BMAD-METHOD`)

Integrate `eval-quality` into `bmad-tea` (`bmad-method-test-architecture-enterprise`).

### 1. Convert Existing Harnesses
1. **Fragment Selection Harness (24 cases across 8 skills):**
   - Define `eval-contract` schemas declaring expected fragment selections against workflow steps (`tea-index.csv`).
2. **`test-review` Harness (Planted Defect Suite):**
   - Define rubrics for recall, precision, score variance, and verdict stability across 9 planted defects and 1 control.
   - Match extracted findings against ground-truth defect line offsets.

### 2. Rollout Schedule across BMad Skills
- **Phase 2.1:** `bmad-testarch-trace` and `nfr` (coverage calculation, waiver enforcement, gate verdicts).
- **Phase 2.2:** `bmad-testarch-atdd` and `automate` (executable fail-before / pass-after checks).
- **Phase 2.3:** `bmad-testarch-framework` and `ci` (generated project and pipeline configs).
- **Phase 2.4:** `bmad-testarch-test-design` (risk grounding and probability/impact scoring).
- **Phase 2.5:** `BMAD-METHOD` core workflows (PRD compilation in `bmad-prd`, Architecture Spine in `bmad-architecture`, Spec distillation in `bmad-spec`).

## 4. Phase 3: Production System Evaluation (MCP Servers and Services)

When evaluating a production setup (such as an MCP server or API tool), `eval-quality` checks behavioral compliance and response schema integrity.

### 1. Setup Architecture
1. **Connect Probe Port or Capture Evidence:** Pass response streams through `EnvironmentProbePort` or collect execution logs as `evidence-artifact` JSON documents.
2. **Define Evaluation Contract:** Declare required tool inputs, expected response schemas, forbidden errors, and performance bounds.
3. **Execute Preflight:** Run `eval-quality preflight` to check target reachability, `AD-35` policy compliance, and input sensitivity.

### 2. Production Scenarios
- **Schema Conformance:** Verify tool responses match published schemas without returning unexpected fields or nulls.
- **Input Sensitivity Audit:** Confirm tool behavior changes deterministically when sensitive inputs toggle.
- **Deployment Quality Gate:** Block release promotion if contract strength or score drops below threshold.

## 5. Phase 4: CI Quality Pipeline

Use a 3-tier CI structure:

1. **Tier 1 (Pull Request Gate):** `npm run validate` (linting, typechecking, layer direction, lineage ownership, unit tests).
2. **Tier 2 (Smoke Gate):** Single qualified case per contract against reference runner on scheduled runs.
3. **Tier 3 (Release Candidate):** Full matrix evaluation with contract sealing and multi-run stability checks.

## 6. Next Steps

1. Run `npm run test:conformance` and confirm 100% pass on shipped adapters.
2. Draft `eval-contract` definitions for `bmad-tea` fragment selection.
3. Implement an `EnvironmentProbePort` adapter for an MCP server or CLI tool interface.
4. Wire `eval-quality run` into release candidate CI jobs.
