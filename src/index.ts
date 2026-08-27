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
// The dependency matrix lets this file import `application/` and `core/schemas`
// and nothing else, so pre-flight's pure plan-and-reduce pair is not re-exported
// here: `runPreflight` is the entry point, and the artifact types below are what
// a caller reads off its result.

export {
	type RunPreflightOptions,
	runPreflight,
} from './application/preflight.ts'
export type {
	PreflightCheck,
	PreflightVerdict,
} from './core/schemas/preflight-verdict.ts'
export type {
	FixtureReset,
	ManifestationWitness,
	SensitivityWitness,
	SensitivityWitnessLeg,
	WitnessChannel,
	WitnessInputs,
} from './core/schemas/sensitivity-witness.ts'

export const VERSION = '0.0.0'
