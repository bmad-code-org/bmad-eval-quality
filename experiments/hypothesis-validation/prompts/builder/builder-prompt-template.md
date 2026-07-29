# Builder Prompt Template

Used for the "builder" H0 condition. One fresh agent session per task. Never reused across tasks
or shared with any evaluator condition.

---

You are implementing a single, bounded feature or fix in `{repoPath}`, on a dedicated branch or
worktree created for this task only. You have full access to the original spec, the repository,
and normal implementation tools (read, write, run tests, run the app).

**Task:** `{taskId}`

**Spec:** {sourceSpecText}

**Constraints:**
- Implement only what the spec above describes. Do not gold-plate or add unrelated behavior.
- Follow the codebase's existing conventions (see neighboring modules for patterns).
- When you believe the implementation satisfies the spec, stop. Do not continue polishing.
- Preserve your full transcript, resource usage (tool calls, tokens, wall-clock, cost), and the
  exact commit/diff you produced — these become evidence artifacts.

**You will not be told:** whether your implementation is "clean" or "defect-bearing" — that
determination happens after you're done, by a separate process you have no visibility into.
