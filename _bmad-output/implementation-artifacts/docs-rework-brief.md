# eval-quality Documentation Rework Coordinator Brief

## Mission

Rework the `eval-quality` documentation so a new user can understand the model quickly, follow the walkthroughs linearly, run the commands as written, see meaningful results, and understand why those results matter.

The current docs contain strong technical content, but several pages mix tutorial flow, design explanation, reference material, and integration templates. That creates a broken user experience: commands look runnable, yet some depend on files or placeholder values the page never creates.

The target experience is:

> **If a page tells the user to do something, the page must provide every artifact needed to do it and show what the result means.**

This is both a documentation cleanup and a documentation-product-quality effort.

## Coordinator Operating Model

You are the main coordinator. Use peer-session agents to work in parallel where the work is naturally separable.

Recommended split:

1. Core concepts and explanation cleanup
2. Full walkthrough rewrite
3. Agent behavior how-to
4. Skill behavior how-to
5. Workflow behavior how-to
6. AI feature behavior how-to
7. Tool-use behavior how-to
8. Repository gates how-to
9. Final consistency and docs-execution validation

Have each peer session inspect the current implementation and docs before editing. Do not let peers invent product behavior that the code does not support.

After the page-specific work lands, run a final normalization pass across all guides. The guides should share a common UX standard without becoming mechanically identical. Each guide should teach one distinct system shape.

# Core Documentation Changes

## 1. Add a simple system model

Add this mental model somewhere early in the docs, likely in the overview, Start Here, or How It Works:

```text
System under test
        ↓
Evaluation
runs the system
collects evidence
makes judgments
        ↓
Behavioral Evaluation Contract (BEC)
defines what behavior matters
defines what evidence counts
defines how success/failure is resolved
        ↓
eval-quality
checks whether the BEC is sane
checks whether the evaluation evidence supports it
scores whether the evaluation actually catches defects
```

The point is to make the boundaries explicit:

- The **system under test** is the AI feature, agent, skill, workflow, or tool server.
- The **evaluation** is the mechanism that runs or observes it and produces evidence plus judgments.
- The **BEC** declares what must be proven.
- **eval-quality** checks the contract and the evidence, then scores the evaluation.

## 2. Add the core anti-pattern and target flow

Add this idea explicitly:

```text
prompt → model → "looks good to me" → PASS
```

`eval-quality` is trying to move users toward:

```text
behavior
→ observable criterion
→ oracle
→ evidence path
→ probe
→ clean control / seeded defect
→ scored result
```

This is one of the clearest descriptions of why the project exists.

## 3. Simplify "What an eval contract declares" and "Why compile rejects contracts"

The current explanation is technically correct but more verbose than it needs to be.

The core explanation should be approximately:

### What a Behavioral Evaluation Contract declares

A BEC declares:

- what behavior matters
- how success is observed
- what evidence the evaluator may use
- what interfaces it may touch
- what checks decide outcomes
- what limits the run must respect

A **sensitivity witness** proves an input actually matters.

Change one input, keep everything else the same, and the output should change in the declared way. Otherwise an evaluation may appear to check an input while the system ignores it.

### Why `compile` rejects contracts

`compile` acts like a linter or type checker for evaluation design.

It rejects contracts that are structurally valid JSON but cannot prove what they claim.

Two important examples:

1. The contract claims an input matters but never proves the system reads it.
2. An oracle points at evidence that can never exist.

Both are the same class of problem:

> **The evaluation can say PASS without actually looking at the behavior it claims to validate.**

That is the core idea. Keep deeper implementation detail available later or in reference documentation.

## 4. Simplify "Three ways to get a wrong answer"

Reduce the section to three concepts:

### 1. A defect only counts as caught when evidence proves it

The evaluator cannot receive credit by merely claiming "I found the defect."

The cited observation must match the defect signature declared by the probe.

```text
claim + matching evidence = caught
claim without matching evidence = no credit
```

### 2. Know what is being scored

There are two modes:

- `production`: Is this system safe or good enough to ship?
- `contract-scoring`: Is this evaluation contract good enough to catch known defects?

The twin-run model uses `contract-scoring`.

A mutated system failing while the evaluation catches the mutation is a success for the evaluation contract.

### 3. Keep the experiment controlled

`eval-quality`'s own transformations are deterministic.

The model, evaluator, fixtures, sampling, configuration, trial count, and related execution details are external.

If those change between arms, the comparison becomes noisy.

The concise takeaway should be:

> **Evidence must prove the catch. Use the correct scoring mode. Keep the experiment controlled.**

# Explanation: "What Ships"

The current page is doing too many jobs.

It should answer:

> **What do I actually get when I install this thing?**

A user should be able to understand the answer in about 30 seconds.

Recommended content:

## What Ships

`eval-quality` provides four commands:

- `compile`: validate an evaluation contract
- `seal`: create an evaluator-safe brief
- `preflight`: verify the environment can produce meaningful evidence
- `score`: validate evidence and produce a verdict plus contract-strength result

Contracts currently support:

- `api`
- `cli`
- `mcp`

The package also ships:

- JSON Schemas
- reference adapters
- a development corpus
- conformance tests

`eval-quality` does not run the agent, evaluator, judge, or system under test. Those remain part of the caller's evaluation harness.

## Current limitation

A CLI `score` invocation accepts one run record.

If the scoring policy requires multiple trials, the strength vector is still reported but marked non-comparable.

The underlying scoring model supports trial sets.

### Follow-up

Treat this as a real product limitation worth addressing separately. Do not bury it only in documentation.

Move or remove material that belongs elsewhere:

- detailed MCP discussion → Tool-Use Behavior
- public vs hidden corpus discussion → contract strength explanation
- version compatibility → CLI/reference
- long unsupported-future-capability lists → architecture/history, if retained at all

# Glossary: `EvalContract`

Current wording implies that `compile` transforms something into an `EvalContract`.

That is misleading.

The authored JSON is already an `EvalContract` shape. `compile` validates it against the schema and discipline rules, then emits it if it passes.

Preferred wording:

> **EvalContract**: A Behavioral Evaluation Contract authored by the caller. `compile` validates it against the schema and discipline rules, then emits the checked contract if it passes.

Shorter acceptable version:

> **EvalContract**: The Behavioral Evaluation Contract. `compile` validates it and rejects invalid or structurally weak contracts.

The mental model should be:

```text
authored EvalContract
        ↓
compile
        ↓
valid EvalContract
        OR
rejection
```

Canonical serialization may change byte formatting or key order. Semantically it remains the same contract.

# Full Walkthrough: `author-behavioral-contracts`

This page needs to become a genuine end-to-end tutorial.

The target user experience:

```text
author contract
→ compile
→ inspect
→ see compile reject a bad contract
→ seal
→ preflight
→ score
→ inspect verdict and strength
```

A new user should be able to copy the page top to bottom from a fresh checkout and never encounter unexplained missing files.

## Global walkthrough requirements

- Every command presented as runnable must actually run.
- Do not use placeholder values such as `<digest>` in runnable commands.
- Do not reference `record.json`, `probe.json`, `scoring-policy.json`, or similar files unless the tutorial has already created or pointed to those exact files.
- If a command is illustrative grammar, label it as such and move it out of the main flow.
- After each important command, show short expected output.
- Explain what happened and why the user should care.
- Prefer one coherent worked example throughout the page.
- Make `probes.json` creation visually obvious in the preflight section.
- Explain `planned` vs `observed` the first time the user sees the preflight diagnostic.

### Planned vs observed

The tutorial should explain:

- **planned**: the contract caused preflight to expect that leg
- **observed**: matching evidence was actually supplied for that planned leg

Conceptually:

```text
contract says what evidence should exist
        ↓
planned legs

harness/system produces evidence
        ↓
observed legs

preflight compares the two
        ↓
passed / failed
```

## Step 6: Make `score` actually runnable

The current Step 6 looks executable but is not.

It references files the tutorial never creates and uses:

```text
--corpus-digest <digest>
```

which shells interpret as redirection.

Rewrite Step 6 so the user actually runs `score`.

The tutorial must create or point to real:

- sealed run record
- compiled contract
- probe
- preflight verdict
- scoring policy
- isolation manifest
- evaluator configuration
- corpus digest

The user should personally produce a scored result here.

Do not stop at a table describing the inputs.

## Step 7: Read the result the user just produced

The current useful lesson is:

> A caught defect does not automatically mean the evaluation contract is healthy.

The example's core behavior is:

```text
PATCH title to "Revised"
API replies with "Revised"
GET same note afterward
GET returns "Original"
```

The write claimed success while the independent read-back proved the state never persisted.

Step 7 should show the user the result they just produced and explain:

### Oracle outcomes

Example shape:

```text
O-001 caught
O-002 confirmed
O-003 confirmed
O-004 abstained
O-005 unreached
```

Explain the important states, especially the one directly tied to the planted defect.

### Overall verdict

Example:

```text
contract-scoring FAIL exit 2
```

Explain why the contract can catch the planted defect and still receive `FAIL` or `CONCERNS`.

### Strength

Example:

```json
{"defect":{"caught":1,"exercised":1,"rate":1}}
```

Explain:

- one defect probe ran
- it was caught
- trial-count policy can still make the result non-comparable

The concise Step 7 lesson should be:

> **`score` verifies whether the evaluation really caught the defect from evidence, while also checking broader contract health. Catching one defect does not automatically make the evaluation contract trustworthy.**

## Move "The twin run, as commands" out of the tutorial flow

The current section presents an integration template using files such as:

```text
contract.json
clean-probes.json
clean-observations.json
mutated-probes.json
mutated-record.json
scoring-policy.json
...
```

Those files do not exist in the tutorial.

Move this into a clearly labeled later section such as:

## Next: Run a real clean/mutated experiment

State explicitly:

> **Template only. Do not run these commands verbatim. The files below are produced by your evaluation harness.**

Keep the concept because the twin run is central to `eval-quality`, but separate it from the copy-paste tutorial.

# System-Shape How-To Guides

Pages in scope:

- `docs/how-to/evaluate-agent-behavior.md`
- `docs/how-to/evaluate-skill-behavior.md`
- `docs/how-to/evaluate-workflow-behavior.md`
- `docs/how-to/evaluate-ai-feature-behavior.md`
- `docs/how-to/evaluate-tool-use-behavior.md`
- `docs/how-to/run-the-gates-on-your-repository.md`

The current pattern across most of these pages is:

> strong technical explanation + command grammar + missing runnable artifacts

Convert them into real hands-on guides.

# Shared Requirements for All How-To Guides

## 1. Separate tutorial commands from reference and integration templates

Any command in the main tutorial path must work after following the preceding steps.

Do not show placeholder values such as:

```text
<digest>
contract.json
probe.json
clean-record.json
```

unless the tutorial has already created those exact values or files.

If a command is only grammar or an integration template:

- move it to a clearly labeled later section
- state explicitly that it is not for verbatim execution

## 2. Make the user experience the page's unique concept

Do not repeat the entire generic BEC walkthrough on every page.

Each guide should contain a focused mini-lab around the thing that makes that system shape different.

The user should:

1. execute something
2. observe something
3. deliberately break or mutate something where useful
4. see `eval-quality` distinguish the result
5. understand the lesson

## 3. Prefer deterministic local fixtures

The tutorial should not require:

- Claude
- OpenAI
- another paid model
- API credentials
- an external service

unless the dependency is fundamental to the capability being documented.

Prefer tiny deterministic fixtures.

The tutorial is teaching `eval-quality` semantics, not model quality.

Reuse existing repository fixtures and committed worked examples where practical.

Add small documentation fixtures or helpers where necessary.

## 4. Preserve the package boundary

Do not make the docs imply that `eval-quality`:

- executes the SUT
- executes the evaluator
- mutates the SUT
- provides adapters it does not actually provide

A tutorial helper or fixture may play the caller/harness role.

Make that boundary explicit.

## 5. Show expected output

After each important command:

- show short expected output
- explain what happened
- explain why the user should care

Keep deep implementation detail out of the middle of the runnable path.

## 6. End each mini-lab with the actual lesson

By the end, the user should be able to answer:

- What did I evaluate?
- What evidence did `eval-quality` receive?
- What did preflight establish?
- What did score establish?
- What failure or blind spot did the exercise expose?

Move deep schema details, source-file references, edge cases, and exhaustive limitations after the runnable exercise or into reference documentation.

## 7. Test the documentation

Add or extend documentation invocation tests.

Strong acceptance test:

```text
fresh checkout
npm ci
npm run build
follow the guide top to bottom
every runnable command works
```

Do not solve broken tutorial flow only by adding prose disclaimers.

If a useful end-to-end exercise is feasible, make it executable.

# Page-Specific Briefs

## Agent Behavior

### Unique concept

A system invoked through a CLI whose observable behavior is:

- exit code
- stdout
- stderr
- declared artifacts

### Build a runnable mini-lab

The user should:

1. inspect or compile a complete CLI contract
2. run or obtain preflight observations for a real small command fixture
3. see input sensitivity demonstrated
4. exercise a known seeded defect
5. run preflight successfully
6. score a real record with no placeholder files or digests
7. inspect the caught defect and resulting strength/verdict

Make the distinction between **manifestation witness** and **defect signature** concrete.

Where practical:

- manifestation witness may inspect an artifact
- scoring signature should use exit code or the nominated stream

This lets the user experience the artifact-channel restriction instead of reading several paragraphs before seeing why it matters.

Keep the deeper CLI-channel and artifact-limitation material after the runnable section.

Do not require TEA or an external AI model.

TEA can remain as the real-world example at the end.

## Skill Behavior

### Unique concept

Attribution.

The user needs to evaluate a decision owned by the skill rather than generic agent behavior.

### Build a runnable selection-skill mini-lab

The user should:

1. run a small deterministic skill runner that emits its decision as structured JSON on stdout
2. see the skill choose the correct subset for a case
3. compile a contract with inclusion and exclusion behaviors
4. run a normal or clean probe
5. exercise a degenerate "select everything" response
6. score the gameability probe
7. see why inclusion alone would pass while exclusion catches the degenerate strategy

Use complete real files throughout.

The user should leave understanding:

```text
one behavior
one oracle
one attributable decision
```

and:

> **Gameability means an easy or degenerate strategy can satisfy a weak evaluator.**

Keep the TEA fragment-selection corpus as the real-world example after the mini-lab.

The existing "select everything" example is strong. Make the user see it happen.

## Workflow Behavior

### Unique concept

Evidence across ordered steps.

Use the existing captured read-back worked example where practical.

### User experience

The user should:

1. create a record
2. receive an identifier
3. bind the later read-back step to that identifier using `{ captured }`
4. establish that the read happened after the write
5. preflight the environment
6. score a seeded persistence defect
7. see the write report success while the independent read-back exposes the defect

Include one small deliberate compile failure if it improves the lesson, for example:

- capture the wrong type
- capture an undeclared channel
- create a binding cycle

Then restore the valid contract and continue.

Every command in the primary path must reference real files already created or committed.

Prefer existing assets where possible:

- `_bmad-output/worked-examples/workflow-capture/`
- `corpus/dev/contracts/captured-read-back.json`

Move exhaustive ordering semantics and scripting bounds after the exercise.

## AI Feature Behavior

### Unique concept

Evaluating behavior when generated output may vary.

### Build the runnable path around the existing toy Notes API or equivalent loopback fixture

The user should experience:

1. a real HTTP-shaped contract using `kind: "api"`
2. a write that appears successful
3. an independent read-back
4. a relational oracle comparing what was sent with what was later observed
5. a seeded persistence defect that preserves the successful-looking response
6. preflight and score
7. the defect becoming `caught` because read-back disagrees with the write

If it can be done without derailing the flow, add one compact demonstration of the empty-collection rule:

```text
quantifier over empty collection
→ insufficient evidence
→ abstained
```

The main lesson should be:

> **You do not need deterministic prose to evaluate a nondeterministic AI feature. Assert stable structure and relationships between observations.**

Do not require a hosted model.

The loopback fixture is enough to teach the semantics.

Keep detailed AD-4 and operator discussion after the runnable mini-lab.

## Tool-Use Behavior

The current page mixes two different systems under test:

1. an agent whose tool choices are being evaluated
2. the MCP tool server itself

Keep the distinction, but make the primary tutorial exercise about the **MCP tool server itself**.

Link the agent-tool-choice case back to Agent Behavior rather than teaching two complete tutorials on one page.

### Extend the existing runnable MCP example

The user should:

1. build the repo
2. create or use the small local MCP tool-server fixture
3. compile the MCP contract
4. run real preflight legs through `createMcpAdapter` or a documented helper around it
5. see actual arguments and structured results
6. seed a deterministic tool defect
7. score a real probe
8. inspect whether the defect was caught

Where practical, include:

```text
write
→ independent read-back
```

This demonstrates why a tool reporting success is weaker evidence than checking resulting state.

The current page already has a runnable `mcp-contract.json` compile example. Finish the experience instead of stopping after compilation.

Do not leave non-runnable `preflight` and `score` command grammar in the main tutorial path.

Preserve the current product boundary:

- structured MCP results are supported
- text-only/Markdown MCP result semantics remain unsupported

Do not fake support for them.

## Run the Gates on Your Repository

This page should be treated slightly differently.

The existing detailed material is useful reference documentation. Keep it, but put a hands-on tutorial in front of it.

Do not begin with one giant five-gate configuration and then explain it for the rest of the page.

### Create a tiny fixture repository

Prefer `/tmp` so the user's checkout stays clean.

Start with one deterministic gate and establish the interaction pattern:

```text
configure gate
→ run it
→ see meaningful failure
→ fix fixture or config
→ run again
→ see exit 0
```

Then provide short runnable mini-labs for:

- licences
- dependency-direction
- package-boundary
- field-ownership

For dependency-direction and field-ownership, make the TypeScript peer dependency requirement explicit before the user reaches the command that needs it.

### Treat `lockfile-age` separately

`lockfile-age` requires npm registry publication metadata.

Clearly label the network prerequisite.

Do not make an otherwise offline tutorial appear broken because the registry cannot be reached.

### Teach the gate exit contract

The user should experience and understand:

```text
0  gate passed
1  gate found the thing it exists to find
64 invocation/configuration error
```

Use intentionally tiny examples.

The goal is to experience the gate behavior, not reproduce the architecture of the `eval-quality` repository.

After the runnable section, keep the existing deeper configuration semantics as reference.

# Shared Tutorial Fixture Architecture

Avoid creating six unrelated piles of handwritten JSON.

Prefer a coherent structure such as:

```text
examples/tutorials/
  agent/
  skill/
  workflow/
  ai-feature/
  tool-use/
  gates/
```

Each directory may contain:

- deterministic fixture SUT
- contract
- probes
- observations or a generator
- evaluator output/run record
- scoring policy
- manifests/config
- small helper scripts where appropriate
- expected outputs

Prefer generators where they reduce duplicated or stale artifacts.

The documentation should teach from artifacts the repository itself verifies.

# Documentation Validation

Add a docs-level validation mechanism that exercises commands intended to be runnable.

Potential direction:

```text
npm run check:doc-invocations
```

or equivalent existing validation infrastructure.

The goal:

> **Documentation examples become tested product surfaces.**

A snippet that merely looks plausible is insufficient.

At minimum, CI should prove:

- every runnable file path exists
- no runnable command contains unresolved placeholders
- commands execute with the documented exit code
- expected outputs remain aligned with actual product behavior

# Final Coordinator Pass

After the peer sessions complete:

1. Verify each guide from a fresh checkout.
2. Normalize naming and terminology.
3. Make sure `evaluation`, `evaluator`, BEC, preflight, probe, manifestation witness, defect signature, verdict, and strength are used consistently.
4. Remove accidental duplication across explanation, how-to, and reference pages.
5. Keep explanation pages concise and conceptual.
6. Keep how-to pages executable and task-oriented.
7. Keep CLI/reference pages exhaustive and boring on purpose.
8. Keep `/llms-full.txt` comprehensive for agents.
9. Check links and cross-references after moving sections.
10. Run all docs invocation tests.

# Definition of Done

The documentation rework is complete when:

- a new user can explain the system boundary among SUT, evaluation, BEC, and `eval-quality`
- a new user understands why `compile` can reject a syntactically valid contract
- the full walkthrough runs end to end without missing files or fake placeholders
- each system-shape how-to contains a focused runnable mini-lab
- every command presented as runnable actually runs
- integration templates are clearly separated from tutorials
- expected output is shown for important steps
- the user experiences at least one real defect, blind spot, gameability case, or gate failure and sees `eval-quality` distinguish it
- reference-heavy material remains available without blocking the hands-on learning path
- docs examples are verified in CI
- the one-record CLI scoring limitation is both documented clearly and tracked as a product limitation to address
