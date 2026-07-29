# eval-quality

**Write agent evals that know how to expose failures, then check whether those evals can actually catch known bugs.**

> **Status: under active development, not yet published.** The product direction is decided. The library, the CLI, and the contract-strength scorer are not implemented yet. What the experiments did and did not show is in [Evidence and limitations](#evidence-and-limitations), including two preregistered verdicts that did not pass.

An agent can produce an answer that reads as correct and is materially wrong. An eval can make the same mistake.

Weak oracle:

```text
Check malformed input is handled correctly.
```

An evaluator given that instruction sends one malformed request, sees an error come back, and reports success. The record that should never have been created was created anyway. Nobody looked.

Strong oracle:

```text
Send malformed input. Verify the request fails, inspect the full response body,
confirm the specific error, and confirm no record was created.
```

A passing eval says little when the contract never asked for the probe that would expose the failure. So the first thing worth testing is whether the eval can catch a failure you already know about.

```text
product spec
  → Behavioral Evaluation Contract
  → known defect or gameability probe
  → independent evaluator
  → per-oracle evidence and a gate decision
```

## What each part provides

`eval-quality` provides:

- the Behavioral Evaluation Contract schema
- the oracle vocabulary and authoring rules
- the contract compiler
- the environment pre-flight
- Eval Contract strength scoring
- versioned evidence output and PASS / CONCERNS / FAIL governance

An established engine provides:

- agent execution
- trace ingestion and standard assertions
- repeated trials
- cost accounting
- reports
- CI integration

[`agentevals-dev/agentevals`](https://github.com/agentevals-dev/agentevals) and [Promptfoo](https://www.promptfoo.dev/) are the candidate engines. `eval-quality` does not rebuild that layer.

## Who it is for

Teams shipping AI agents, coding skills, review bots, MCP-based assistants, or automated test-generation systems, and teams operating human-on-the-loop or dark-factory delivery.

Use `eval-quality` when all three are true:

- An agent, skill, or model judgment is involved.
- A plausible-looking output can still be materially wrong.
- Observable evidence or probes can expose the wrong behavior.

Deterministic work does not need it and already has cheaper, stronger evidence from unit, contract, E2E, performance, and mutation testing.

## Behavioral Evaluation Contracts

A **Behavioral Evaluation Contract** is a versioned specification of the behaviors to probe, the evidence to collect, the negative cases to exercise, and the rules that decide whether the system passes or fails. **Eval Contract** is the shorthand used from here on. The individual checks inside it are **oracles**. The contract carries no prescribed action sequence; the evaluator chooses its own path.

This is not a Pact or API contract, and the distinction matters if you arrived from contract testing:

| Pact / API contract | Behavioral Evaluation Contract |
| --- | --- |
| An agreement between a consumer and a provider | An agreement between intended behavior and its evaluator |
| Defines request and response interactions | Defines probes, evidence, and verdict rules |
| Detects integration incompatibility | Detects behavioral and evaluation blind spots |
| Verified against a provider | Scored against known defects and gaming cases |

The authoring discipline is a small set of rules that survived the experiments: separate the success indicator from the body, read the whole body, probe malformed and negative inputs, verify per record, and cross-check sibling parameters and sibling tools.

A compiler enforces these rules mechanically against the contract artifact, in three classes. Structural errors fail compilation. Coverage gaps score down without blocking. A waived pattern is allowed when it records the named rule, a rationale, a machine-checkable condition, and the approval.

## How Eval Contract strength scoring works

Do not trust a contract because it looks thorough. Put a known defect behind it, run the evaluator, and ask whether the contract's oracles caused the defect to be caught.

Two probe classes go behind a contract, and a strong contract rejects both:

- **Defect probes**, where the behavior is simply wrong.
- **Gameability probes**, where the behavior looks compliant while dodging the oracle's intent. A test that raises coverage while asserting nothing is the familiar version of this.

Probes come from qualified historical defects or verified controlled mutations. The corpus separates a visible development set from an immutable sealed set for each scoring version.

Every required oracle check resolves to exactly one state, and the state travels with the result, so "the check reported" is never sufficient on its own: `caught`, `missed`, `passed_clean_control`, `false_positive`, `abstained`, `oracle_error`, `infrastructure_error`, or `not_applicable`.

A required oracle that missed, abstained, errored, or is absent prevents PASS, and a high overall score never overrides it. An infrastructure error or a failed environment pre-flight is not a behavioral result at all; it invalidates the run and is re-executed rather than scored.

## Using it

`eval-quality` is its own repository and package, not a plugin inside another framework.

The **library** is the primary surface. It exports the contract schema, the oracle vocabulary, the compiler, the scorer, the pre-flight, and the evidence types. The published typed schema is what lets coding agents author contracts correctly by default, which is how the discipline scales beyond the people who went looking for the tool.

The **CLI** wraps the same library for callers that cannot import TypeScript: CI jobs, GitHub Actions, PR-review and unit-test bots, other frameworks' skills, and any agent permitted to run a shell command.

```bash
eval-quality compile   # validate a contract against the authoring discipline
eval-quality preflight # verify the measurement environment before scoring
eval-quality score     # seed known defects, report per-oracle outcomes
```

Commands are non-interactive by default, emit machine-readable output, and exit with a code reflecting the gate verdict. The library and CLI expose the same capabilities and produce the same versioned evidence artifact.

## Relationship with BMad and TEA

The dependency runs one way.

```text
TEA → eval-quality
```

TEA is the reference authoring client. It reads BMad planning artifacts, notices eval-relevant work, drafts a contract, and calls this package. It is not co-installed, and `eval-quality` holds no knowledge of TEA, BMad, or any planning-artifact format.

Any human, bot, CI job, skill, or other framework can author a contract and use `eval-quality` directly. The discipline still applies, because the compiler judges the artifact rather than trusting whoever produced it.

Evaluator runs remain isolated to prevent builder-context leakage and preserve traceability. Stronger contract oracles produced the measured detection improvement.

## Evidence and limitations

Holding the model, the budget, the system, and the defects fixed, and changing only how the Eval Contract was authored, sealed-evaluator detection moved from **0.33 to 1.00** across three naturally occurring defects, three repetitions per arm, 19 scored runs.

Both experiment rounds missed at least one preregistered gate. Round 1 recorded `DARK-FACTORY REJECTED`; round 2 block 1 recorded `CONTRACT-DISCIPLINE NOT SUPPORTED`. The sample covers three defects, one system, and one model. This supports a product-direction decision at narrow scale. Certification would require broader replication.

Read the [product brief](_bmad-output/planning-artifacts/briefs/brief-eval-quality-2026-07-17/brief.md) for the product rationale, the [PRD](_bmad-output/planning-artifacts/prds/prd-eval-quality-2026-07-17/prd.md) for build requirements, and [ADR-002](_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-22/ADR-002-contract-authoring-discipline.md) for the decision record. The experiment record includes the [round 1 verdict](experiments/hypothesis-validation/DECISION.md), [round 2 results](experiments/hypothesis-validation/PHASE2-RESULTS.md), [metric summary](experiments/hypothesis-validation/results/summary.md), and [protocol](experiments/hypothesis-validation/HYPOTHESIS_VALIDATION_PLAN.md).

## Not building now

Deferred until the contract layer is in real use: claim-to-evidence lineage, semantic checkpoint scoring, process and outcome separation, and first material error attribution.

Out of scope entirely: a new eval engine, a hosted service, a dashboard or GUI, multimodal evaluators, automatic prompt repair, and a generic judge-calibration platform.

## Development

```bash
npm install
npm run validate         # typecheck + lint + docs check + test
npm run build            # emit to dist/
npm run lint:fix         # auto-fix with Biome
npm run build:shareable  # render the planning artifacts to self-contained HTML
```

`build:shareable` writes this README, the product brief, the PRD, and ADR-002 to `_bmad-output/shareable/` as standalone styled HTML for sharing outside the repo. Regenerate rather than hand-edit those files.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](SECURITY.md). Please do not open a public issue for vulnerabilities.

## License

Apache-2.0 &copy; Murat Ozcan. See [LICENSE](LICENSE).
