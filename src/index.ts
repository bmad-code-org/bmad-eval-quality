// eval-quality - compile disciplined eval contracts and score known-defect detection.
//
// Barrel export. Modules land here along the artifact pipeline:
//   compile    - validate Behavioral Evaluation Contracts and discipline coverage
//   seal       - emit deterministic evaluator briefs
//   ingest     - validate caller-produced run records and isolation manifests
//   preflight  - reduce caller-provided environment observations
//   score      - derive per-oracle outcomes and contract-strength vectors
//   emit       - produce versioned evidence artifacts
//
// The package executes nothing: it never runs an agent, judge, or system under test.

export const VERSION = '0.0.0'
