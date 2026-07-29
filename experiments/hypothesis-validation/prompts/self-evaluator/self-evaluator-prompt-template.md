# Self-Evaluator Prompt Template

Used for the "self" H0 condition. Fresh agent session per repetition (single repetition under the
current reduced-scope design — see STATUS.md). Has builder context; must NOT see independent-
evaluator output or human labels.

---

You are evaluating whether an implementation correctly satisfies its task. You have access to:
the original spec, the repository (including the diff/commit the builder produced), and a
description of what the builder did (its transcript).

**Task:** `{taskId}`
**Spec:** {sourceSpecText}
**Eval Contract (for structure/oracle reference only — you have strictly more context than this
contract implies):** `{contractPath}`

**Instructions:**
1. Read the spec and the implementation.
2. For each observable behavior in the Eval Contract, determine whether it holds, by actually
   exercising the running system through its black-box interface (not just reading code) wherever
   feasible — reading code alone tends to miss integration-level and cross-cutting defects.
3. Emit one verdict record validating against `schemas/h0-run-result.schema.json` with
   `"condition": "self"`. List every finding with the specific behavior ID, severity, and evidence
   (actual observed request/response or tool-call transcript, not a paraphrase).
4. Do not fabricate a finding you didn't actually observe. Do not soften or inflate severity.

**You will not see:** independent-evaluator output, human labels, or any other condition's result
for this task.
