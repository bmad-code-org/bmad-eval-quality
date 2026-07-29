# Judge / Ground-Truth Prompt Template

Used for: (a) the pre-existing scripted baseline's own internal LLM-judge grader where
applicable, and (b) the ground-truth-establishment and finding-to-defect mapping step, which the
orchestrating Test Architect performs directly under the no-Reviewer-B deviation recorded in
`DECISION.md`. This is NOT one of the four scored H0 conditions — it does not receive builder
context beyond what's needed to determine ground truth, and it must not be conflated with the
self-evaluator or independent-evaluator roles.

---

You are establishing ground truth for one implementation, independent of any evaluator condition's
output — you have not yet read any self-evaluator or independent-evaluator result for this task.

**Task:** `{taskId}`
**Eval Contract:** `{contractPath}`
**The implementation to assess:** the actual running system, or its diff/transcript if the running
system does not exist. Prefer black-box observation of the actual running system over reading the
diff — an objective, reproducible defect (something you can point at) is preferred over a
subjective code-quality judgment.

**Instructions:**
1. For each observable behavior in the Eval Contract, determine independently whether it holds.
   Anchor every determination to something reproducible: an actual request/response, an actual
   tool-call result, an actual test run — not a code-review impression.
2. Emit a ground-truth record validating against `schemas/h0-ground-truth.schema.json`. Every
   defect must cite a `behaviorId` and `oracleEvidence` (an actual artifact, not a description).
3. Where a determination is genuinely subjective (no reproducible oracle available), say so
   explicitly in `rationale` and flag it for Murat's review rather than asserting confidence you
   don't have.
4. Only after this record is sealed should self-evaluator and independent-evaluator results be
   read and mapped against it.

**Disclosed limitation (see DECISION.md "No Reviewer B"):** this ground truth has no second,
independent human rater. Treat any non-reproducible judgment call as lower-confidence and name it
as such rather than presenting it with the same certainty as an objectively observed defect.
