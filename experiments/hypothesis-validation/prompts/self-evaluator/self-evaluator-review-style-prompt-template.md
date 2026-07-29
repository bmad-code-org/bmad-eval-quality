# Self-Evaluator Prompt Template — Review-Style Arm (`self-review`)

Added 2026-07-27 by preregistration amendment 01 (`preregistration/h0-amendment-01-mut2.yaml`).
This is an ADDITIONAL arm, not a replacement for
`self-evaluator-prompt-template.md`, which stays frozen and is still run on the same
implementation.

**Why this arm exists.** The frozen self-evaluator prompt mandates live black-box exercise of the
running system. That is a strong, deliberately demanding posture, and mut1's result showed it
performs on par with independent evaluation. It does not represent how self-review is normally
performed in practice, where a reviewer reads the diff, the tests, and the author's description,
and exercises the system live only when something looks suspicious. This arm represents that
ordinary posture so the two can be compared on the same implementation.

**Fairness requirement.** This prompt must describe a competent, thorough reviewer. It must not
instruct the agent to trust claims, skip work, or be careless, and it must not forbid live
exercise. A crippled prompt would produce a meaningless separation. Live exercise is available and
permitted here; it is simply not mandated.

---

You are performing a code review of an implementation before it ships. You have full access to:
the original spec, the repository including the diff the author produced, the author's own
implementation notes describing what they did and what they verified, and the test suite.

**Task:** `{taskId}`
**Spec:** {sourceSpecText}
**Repository / worktree:** {repoPath}
**Author's implementation notes:** {builderNotesPath}
**Eval Contract (for structure and oracle reference):** `{contractPath}`

**Instructions:**

1. Read the spec, the author's implementation notes, and the diff.
2. For each observable behavior in the Eval Contract, decide whether the implementation satisfies
   it, and say what your decision rests on.
3. Review the test suite the author wrote. Judge whether the tests actually cover the behaviors
   they are named for.
4. You may run the test suite and you may exercise the running system through its HTTP interface if
   you judge that necessary. Neither is required. Use your own judgment about where the risk is and
   spend your effort there, the way you would on a real review.
5. Emit one verdict record validating against `schemas/h0-run-result.schema.json` with
   `"condition": "self-review"`. List every finding with its behavior ID, severity, and the evidence
   your conclusion rests on. State plainly for each behavior whether your conclusion came from
   reading, from reasoning, from running tests, or from live observation.
6. Do not fabricate a finding you did not actually establish. Do not soften or inflate severity.

**Budgets:** maximum 40 tool calls, 30 minutes wall clock. Identical to every other arm.

**You will not see:** independent-evaluator output, the other self-evaluator arm's output, human
labels, or any other condition's result for this task.
