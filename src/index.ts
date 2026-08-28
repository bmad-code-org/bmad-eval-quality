// eval-quality: compile disciplined eval contracts and score known-defect detection.
//
// Barrel export. Modules land here along the artifact pipeline:
//   compile:   validate Behavioral Evaluation Contracts and discipline coverage
//   seal:      emit deterministic evaluator briefs
//   ingest:    validate caller-produced run records and isolation manifests
//   preflight: compile the contract's witnesses into probe requests, then
//              reduce the observations the environment-probe port returned
//   score:     derive per-oracle outcomes and contract-strength vectors
//   emit:      produce versioned evidence artifacts
//
// The package executes nothing: it never runs an agent, judge, or system under test.
//
// The dependency matrix grants this file two edges and no others: `root ->
// application` and `root -> core-schemas`. So the layer barrel
// `application/index.ts` is how everything else under `core/` is reached,
// while the artifact types below come straight off `core/schemas` on the
// second edge. The port vocabulary stays at the `eval-quality/conformance`
// subpath, where AD-37 puts the conformance definition an adapter author
// reads; the reference adapters stay at `eval-quality/adapters`.

export * from './application/index.ts'
export type { ArtifactReference } from './core/schemas/artifact-reference.ts'
export type { EvalContract } from './core/schemas/eval-contract.ts'
export type { EvaluatorConfiguration } from './core/schemas/evaluator-configuration.ts'
export type { EvidenceArtifact } from './core/schemas/evidence-artifact.ts'
export type { IsolationManifest } from './core/schemas/isolation-manifest.ts'
export type {
	PreflightCheck,
	PreflightVerdict,
} from './core/schemas/preflight-verdict.ts'
export type { PrivateArtifactManifest } from './core/schemas/private-artifact-manifest.ts'
export type { Probe } from './core/schemas/probe.ts'
export type { Rubric } from './core/schemas/rubric.ts'
export type { ScoringPolicy } from './core/schemas/scoring-policy.ts'
export type { SealedEvaluatorBrief } from './core/schemas/sealed-evaluator-brief.ts'
export type { SealedRunRecord } from './core/schemas/sealed-run-record.ts'
export type {
	FixtureReset,
	ManifestationWitness,
	SensitivityWitness,
	SensitivityWitnessLeg,
	WitnessChannel,
	WitnessInputs,
} from './core/schemas/sensitivity-witness.ts'

export const VERSION = '0.1.0'
