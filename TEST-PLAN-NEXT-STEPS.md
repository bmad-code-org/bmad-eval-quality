# Master Test Plan: Next Steps for `eval-quality`

**Author:** Murat K Ozcan — Master Test Architect & Quality Advisor  
**Status:** Approved for Execution  
**Target Repository:** `bmad-eval-quality` (`bmad-code-org`)  
**Scope:** Self-conformance, BMad ecosystem integration (`bmad-tea` & `BMAD-METHOD`), and production system evaluation (e.g., enterprise tool setups, MCP servers, and agent workflows).

---

## 1. Executive Summary & Quality Strategy

With `eval-quality`'s foundational build, CLI surface (`dist/cli/main.js`), schema layer, and validation suite (`npm run validate`) complete and green, the next strategic objective is **operationalizing evaluation across real-world targets**.

`eval-quality` acts as an independent, deterministic contract-compilation and scoring layer. It maintains a strict one-way boundary: `eval-quality` does not execute agents or manage LLM runners directly. Instead, callers (such as `bmad-tea`, workflow runners, or production test harnesses) pass declared evidence, contract files, and probe subjects to `eval-quality` for deterministic preflight, sealing, and scoring.

```
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

---

## 2. Phase 1: Self-Conformance & Adapter Readiness

Before evaluating external subjects, verify that `eval-quality`'s published ports and adapters pass total behavioral conformance.

### 1.1 Run Published Conformance Suite
`eval-quality` ships an executable conformance suite at `@bmad-code-org/eval-quality/conformance` (`src/testing/conformance.ts`).

- **Target:** Verify `NodeFileSystemAdapter`, `LocalCorpusAdapter`, and `SystemClockAdapter`.
- **Command:**
  ```bash
  npm run test:conformance
  ```
- **Validation Criteria:**
  - `runPortConformanceSuite` passes all 32 adapter cases.
  - `runProbeConformanceSuite` verifies target policy compliance (`AD-35` default-deny target policy).

### 1.2 Validate CLI Subcommands End-to-End
Verify the 5 canonical CLI entrypoints using the committed corpus (`corpus/dev/`):

```bash
# 1. Compile contract
node dist/cli/main.js compile corpus/dev/contracts/satisfied-declarations.json

# 2. Preflight checks
node dist/cli/main.js preflight corpus/dev/compile-seal-example/contract.json --brief corpus/dev/compile-seal-example/brief.json

# 3. Seal contract & evidence
node dist/cli/main.js seal corpus/dev/compile-seal-example/contract.json --brief corpus/dev/compile-seal-example/brief.json --out dist/sealed-record.json

# 4. Score run
node dist/cli/main.js run dist/sealed-record.json

# 5. Diagnostics
node dist/cli/main.js diagnostics dist/sealed-record.json
```

---

## 3. Phase 2: BMad Ecosystem Integration (`bmad-tea` & `BMAD-METHOD`)

`bmad-tea` (`bmad-method-test-architecture-enterprise`) contains an explicit roadmap (`docs/explanation/eval-quality-roadmap.md`) designed specifically for `eval-quality` integration.

### 2.1 Migrate Existing Harnesses to Behavioral Contracts
Convert `bmad-tea`'s two active eval harnesses into formal `eval-quality` Behavioral Evaluation Contracts:

1. **Fragment Selection Harness (24 cases across 8 skills):**
   - **Contract:** Define `eval-contract` schemas declaring expected fragment selections vs explicitly excluded fragments.
   - **Oracle:** Deterministic matching against workflow step definitions (`tea-index.csv`).
2. **`test-review` Harness (Planted Defect Suite):**
   - **Contract:** Define rubrics for recall, precision, score variance, and verdict stability across 9 planted defects + 1 clean control.
   - **Oracle:** Match extracted review findings against ground-truth defect line offsets.

### 2.2 Phased Rollout Across BMad Skills
Expand Behavioral Evaluation Contracts across remaining BMad skills in evidence order:

| Phase | Skill Target | Contract Focus & Oracles |
| :--- | :--- | :--- |
| **Phase 2.1** | `bmad-testarch-trace` & `nfr` | Bounded evidence verification, coverage calculation, waiver enforcement, gate decision accuracy (`PASS`/`CONCERNS`/`FAIL`). |
| **Phase 2.2** | `bmad-testarch-atdd` & `automate` | Executable fail-before / pass-after checks against qualified seeded regressions. |
| **Phase 2.3** | `bmad-testarch-framework` & `ci` | Generated project & pipeline configs verified by syntax linters and dry-run execution. |
| **Phase 2.4** | `bmad-testarch-test-design` | Risk grounding, probability/impact scoring consistency, and risk-to-coverage mapping. |
| **Phase 2.5** | `BMAD-METHOD` Core Workflows | Evaluate PRD compilation (`bmad-prd`), Architecture Spine generation (`bmad-architecture`), and Spec distillation (`bmad-spec`). |

---

## 4. Phase 3: Production System Evaluation (Enterprise Tool Setups & MCP Servers)

When testing a production setup (e.g., an enterprise tool integration, an MCP server interface, or microservice infrastructure), `eval-quality` evaluates the **behavioral compliance and output integrity** of the tool/service under test.

### 3.1 Architecture for Production System Testing
To test a production setup:
1. **Implement `EnvironmentProbePort` or Provide Sealed Evidence:**
   - Connect the production tool / MCP server response stream to `eval-quality`'s `EnvironmentProbePort` or capture tool execution logs as `evidence-artifact` JSON documents.
2. **Define Evaluation Contract:**
   - Specify required tool call inputs, expected response schemas, forbidden outputs (e.g., unhandled errors, data leakage), and performance bounds.
3. **Execute Preflight & Sensitivity Audit:**
   - Run `eval-quality preflight` against the production environment probe to verify target reachability, policy enforcement (`AD-35`), and input sensitivity.

### 3.2 Key Production Test Scenarios

```
Production Setup (e.g., MCP Server / Tool Service)
  │
  ├──► 1. Schema Conformance: Verify tool responses match published Zod / JSON schemas
  ├──► 2. Boundary Policy: Ensure probe requests conform to AD-35 target policy rules
  ├──► 3. Regression Scoring: Run eval-quality run against sealed historical evidence
  └──► 4. Fault Injection: Verify graceful degradation on missing or malformed tool arguments
```

- **Scenario A — Tool Schema Conformance:**
  Evaluate whether tool responses strictly adhere to `eval-contract` declarations without returning unexpected fields or nulls.
- **Scenario B — Input Sensitivity Audit:**
  Ensure the tool's behavior changes deterministically when sensitive input parameters are toggled, preventing dead or vacuous parameters.
- **Scenario C — Automated Quality Gate in Deployment:**
  Integrate `eval-quality run` as a mandatory deployment gate: if contract strength or behavioral score drops below the threshold, block release promotion.

---

## 5. Phase 4: CI/CD Quality Pipeline Integration

Implement a 3-tier CI quality pipeline to keep testing fast, deterministic, and credential-safe:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Tier 1: Pull Request Gate (Deterministic, 0 Credentials)               │
│ └── npm run validate (Lint, Typecheck, Layers, Lineage, Unit Tests)     │
└─────────────────────────────────────────────────────────────────────────┘
                                   │ Passes
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Tier 2: Smoke Eval Gate (Scheduled / Dispatch)                          │
│ └── Single qualified case per contract against reference runner          │
└─────────────────────────────────────────────────────────────────────────┘
                                   │ Passes
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Tier 3: Full Matrix Evaluation (Release Candidate)                     │
│ └── Complete contract sealing, multi-run stability, sealed evidence     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Actionable Next Steps Checklist

- [ ] **Step 1:** Execute `npm run test:conformance` and confirm 100% pass rate on shipped adapters.
- [ ] **Step 2:** Create initial `eval-contract` definitions for `bmad-tea` fragment selection in `bmad-method-test-architecture-enterprise`.
- [ ] **Step 3:** Implement an `EnvironmentProbePort` adapter for a sample production setup (e.g., an MCP server or CLI tool) to test schema conformance and input sensitivity.
- [ ] **Step 4:** Wire `eval-quality run` into a CI smoke job to score generated evidence artifacts automatically on every release candidate.
