/**
 * The four shapes the binary writes, and the exit-code table two documents
 * share. Every line the CLI emits is produced here, so a format change is one
 * file.
 */
import {
	type Diagnostic,
	RuntimeFault,
	StructuralFailure,
	serializeArtifact,
} from '../application/index.ts'

const PREFIX = 'eval-quality'

/**
 * Delegates to `serializeArtifact`; the canonical bytes are not re-derived
 * here, so the text written to stdout is the text `digestArtifact` hashes.
 */
export function renderArtifact(
	artifact: unknown,
	artifactPath: string,
): string {
	return serializeArtifact(artifact, artifactPath)
}

/** `eval-quality: <stage>: <runId>: <message>` */
export function renderDiagnostic(diagnostic: Diagnostic): string {
	return `${PREFIX}: ${diagnostic.stage}: ${diagnostic.runId}: ${diagnostic.message}`
}

/**
 * `eval-quality: <code>: <artifactPath>: <detail>` for either error class.
 * Anything else falls back to `String(error)`, which is what a defect in our
 * own code looks like from outside.
 */
export function renderError(error: unknown): string {
	if (error instanceof StructuralFailure || error instanceof RuntimeFault) {
		const prefix = `${error.code} in ${error.artifactPath}: `
		const detail = error.message.startsWith(prefix)
			? error.message.slice(prefix.length)
			: error.message
		return `${PREFIX}: ${error.code}: ${error.artifactPath}: ${detail}`
	}
	return `${PREFIX}: ${String(error)}`
}

/**
 * AD-21's seven exit codes, one line each. The `--help` output and the README
 * table are this text, so the two cannot drift.
 */
export const EXIT_CODE_TABLE = `Exit codes (AD-21):
  0   success, and every verdict other than FAIL or a promoted CONCERNS
  1   CONCERNS promoted by --strict
  2   FAIL
  3   invalid: a pre-flight verdict that did not pass
  4   structural failure
  5   runtime fault
  64  usage error

  1 and 2 report a scored verdict. Scoring ships in a later release, so no
  command here reaches either yet, and --strict changes no code this binary
  produces.`

/** `eval-quality: usage: <message>` */
export function renderUsage(message: string): string {
	return `${PREFIX}: usage: ${message}`
}
