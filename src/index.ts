// eval-quality - agent evaluation for the reasoning path, not just the output.
//
// Barrel export. Modules land here as the engine is built:
//   runner      - drive an agent (provider-agnostic) and capture the transcript
//   assertions  - the Expect.* DSL (tool calls, sequence, params, performance)
//   graders     - deterministic-first, judge-second pipeline; pass@k aggregation
//   trajectory  - the differentiator: faithfulness / grounding / path quality /
//                 process-vs-outcome judging / reference-trajectory scoring
//   reporting   - evidence artifacts (summary + machine-readable result)
//
// Design intent: agent-eval is an EVIDENCE SOURCE, not a benchmark. The output
// is meant to feed a ship / don't-ship decision, not just a score.

export const VERSION = '0.0.0'
