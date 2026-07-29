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

## Relationship with TEA

The dependency runs one way.

```text
TEA → eval-quality
```

TEA is the reference authoring client. It reads BMad planning artifacts, notices eval-relevant work, drafts a contract, and calls this package. It is not co-installed, and `eval-quality` holds no knowledge of TEA, BMad, or any planning-artifact format.

Any human, bot, CI job, skill, or other framework can author a contract and use `eval-quality` directly. The discipline still applies, because the compiler judges the artifact rather than trusting whoever produced it.

## Evidence and limitations

Holding the model, the budget, the system, and the defects fixed, and changing only how the Eval Contract was authored, sealed-evaluator detection moved from **0.33 to 1.00** across three naturally occurring defects, three repetitions per arm, 19 scored runs.

Two of the three plainly authored contracts detected nothing at all. One of them observed the defective behaviour and recorded it as confirmation that the system handled the case well. The mechanism is visible in the transcripts rather than only in the score: the plainly authored contract never prescribed the probe that would expose the defect, and the disciplined one did, by construction.

What that evidence does not support:

- **Neither experiment round cleared its preregistered gates.** Round 1 is recorded `DARK-FACTORY REJECTED`. Round 2 block 1 is recorded `CONTRACT-DISCIPLINE NOT SUPPORTED` after failing one safety gate, on the block's only clean control, to a defect in the measurement harness rather than in a contract.
- **The sample is narrow.** Three defects, one system, one model.
- **The decision was made at product-decision grade**, on the mechanism evidence rather than on a passing gate. It is not a certification claim, and no further replication is planned.

Recorded verdicts and evidence: [DECISION.md](experiments/hypothesis-validation/DECISION.md), [PHASE2-RESULTS.md](experiments/hypothesis-validation/PHASE2-RESULTS.md), [results/summary.md](experiments/hypothesis-validation/results/summary.md). Gates and protocol: [HYPOTHESIS_VALIDATION_PLAN.md](experiments/hypothesis-validation/HYPOTHESIS_VALIDATION_PLAN.md).

## Where known defects come from

Two sources, both requiring recorded evidence before a case counts:

- **History.** The commit before a real bug fix is the case, and the fix's own test is the oracle.
- **Controlled mutation.** A defect seeded deliberately against a real fix boundary, covering failure classes that never left a clean commit.

A historical case is not automatically trustworthy. It qualifies only when it fails before the fix and passes after it:

```text
parent commit  → the fix's own test fails
fix commit     → the fix's own test passes
```

Round 1 mined 18 fix commits and found 2 whose own tests already passed at the parent commit. A case earns ground-truth status through this check rather than through being mined.

## Held-out defects

The probe corpus splits in two. A **development set** is visible to contract authors and used to improve the discipline. A **sealed set** is hidden and immutable for a given scoring version, and it produces the reported score.

Revealing a sealed defect, repairing the contract, and rerunning against the same supposedly held-out case converts scoring into tutoring. A miss on the sealed set may inform the next version only after the current evaluation closes.

## Test the harness before trusting the score

Across both experiment rounds, every unintended defect was in the measurement layer rather than in the code under test: wrong response shapes, missing routes, a request-body-blind stub, a tautological test, two schemas that would not compile. The single safety gate that failed traced to a stub missing a wrapper key that the real client unwraps.

So a scored run first passes a bounded environment pre-flight. It cannot prove an environment defect-free in general, and it does not try. It proves the specific paths the probe exercises: declared routes present and actually matched, request-body sensitivity where it applies, per-run state reset or immutable, known-clean control behavior, and the seeded fault as the only anomalous response in scope.

A pre-flight failure invalidates the run. It is never read as a signal about the contract.

## Evaluator isolation is a control, not the product

The evaluator receives the sealed Eval Contract, scoped credentials and test data, allowlisted tools, and black-box access through the public UI, API, CLI, or MCP interface. It does not receive the original spec, the source code, the repository, the builder conversation, or implementation logs. Every run records an isolation manifest, and any prohibited-input access invalidates the run.

This prevents context leakage and keeps evidence traceable. It is not where the advantage came from. A sealed evaluator's recall is bounded above by the oracles its contract supplies, and both rounds showed that isolation could not compensate for a missing oracle, from opposite failure directions.

## Not building now

Deferred until the contract layer is in real use: claim-to-evidence lineage, semantic checkpoint scoring, process and outcome separation, and first material error attribution.

Out of scope entirely: a new eval engine, a hosted service, a dashboard or GUI, multimodal evaluators, automatic prompt repair, and a generic judge-calibration platform.

## Who it is for

Teams shipping AI agents, coding skills, review bots, MCP-based assistants, or automated test-generation systems, and teams operating human-on-the-loop or dark-factory delivery.

The test for whether this applies to a given piece of work is three-part. There is an agent, skill, or model judgment involved. A plausible-looking output can still be materially wrong. Observable evidence or probes exist that would expose the wrong behavior.

Deterministic work does not need it and already has cheaper, stronger evidence from unit, contract, E2E, performance, and mutation testing.

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
