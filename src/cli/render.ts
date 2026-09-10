/**
 * The four shapes the binary writes, and the exit-code table two documents
 * share. Every line the CLI emits is produced here apart from what `main.ts`
 * writes for a rethrown defect, which is that error's own stack or message, so a
 * format change is one file. Five
 * renderers over the four shapes: a qualification failure and an error both
 * print `<code>: <artifactPath>: <detail>`.
 */
import { z } from 'zod'
import {
	type Diagnostic,
	type QualificationFailure,
	RuntimeFault,
	StructuralFailure,
	serializeArtifact,
} from '../application/index.ts'

const PREFIX = 'eval-quality'

/**
 * How many parse issues the renderer prints before it stops and counts the
 * rest.
 * An author fixing a contract reads the first few and edits; a wall of four
 * hundred lines from one missing required key teaches nothing and buries the
 * first line, which is the one that names the code.
 */
const ISSUE_LIMIT = 20

/**
 * An RFC 6901 pointer over the failing value, so the location the renderer
 * prints is the same spelling the contract itself uses to address evidence.
 * A numeric segment is an array index and is printed as one.
 */
function issueLocation(path: ReadonlyArray<PropertyKey>): string {
	if (path.length === 0) return '(root)'
	return path
		.map((segment) =>
			String(segment).replaceAll('~', '~0').replaceAll('/', '~1'),
		)
		.map((segment) => `/${segment}`)
		.join('')
}

/**
 * The issue list a failed parse already carries, which the first line of the
 * error alone does not expose.
 * A contract author outside this repository has the published schema and this
 * message and nothing else, so a parse failure that names no field costs a
 * bisect over the whole document.
 * Issues are sorted by location so two runs over the same input print the same
 * bytes.
 * A Zod issue message names the expectation and never echoes the value that
 * failed, which matters because this goes to stderr and a contract declares an
 * environment channel; the one thing a message does quote is an unrecognized
 * key name, which is a field name.
 */
function renderParseIssues(cause: unknown): string {
	if (!(cause instanceof z.ZodError)) return ''
	const lines = cause.issues
		.map((issue) => `  ${issueLocation(issue.path)}: ${issue.message}`)
		.sort()
	const shown = lines.slice(0, ISSUE_LIMIT)
	const hidden = lines.length - shown.length
	if (hidden > 0) shown.push(`  ... and ${hidden} more`)
	return shown.length === 0 ? '' : `\n${shown.join('\n')}`
}

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
 * A fault carrying a Zod error as its cause prints that error's issues under
 * the first line, one indented `<location>: <message>` per issue.
 * Anything else falls back to `String(error)`, which is what a defect in our
 * own code looks like from outside.
 */
export function renderError(error: unknown): string {
	if (error instanceof StructuralFailure || error instanceof RuntimeFault) {
		const prefix = `${error.code} in ${error.artifactPath}: `
		const detail = error.message.startsWith(prefix)
			? error.message.slice(prefix.length)
			: error.message
		const issues = renderParseIssues(error.cause)
		return `${PREFIX}: ${error.code}: ${error.artifactPath}: ${detail}${issues}`
	}
	return `${PREFIX}: ${String(error)}`
}

/**
 * One AD-9 qualification failure, in the same
 * `<code>: <artifactPath>: <detail>` shape `renderError` uses. An unqualified
 * probe is a domain outcome the ladder resolves to Invalid, so no
 * `StructuralFailure` and no `RuntimeFault` carries it. It reads like one on
 * stderr because the reader's question is the same.
 */
export function renderQualificationFailure(
	failure: QualificationFailure,
): string {
	return `${PREFIX}: ${failure.code}: ${failure.artifactPath}: ${failure.detail}`
}

/**
 * The seven codes the binary can take, one line each: AD-21's six, plus
 * `EX_USAGE`, which `exit-codes.ts` records as sitting outside AD-21.
 *
 * The `--help` output is this text, and `docs/reference/cli-commands.md`
 * transcribes it. `tests/cli/render.test.ts` holds the README's markdown table
 * against these rows, and `check:doc-claims` holds the transcription against
 * this string, so neither copy can drift.
 */
export const EXIT_CODE_TABLE = `Exit codes (AD-21's six, plus 64 from sysexits.h):
  0   success, and every verdict other than FAIL or a promoted CONCERNS
  1   CONCERNS promoted by --strict
  2   FAIL
  3   invalid: a failed pre-flight, or any other AD-21 invalidating condition
  4   structural failure
  5   runtime fault
  64  usage error

  --strict never promotes a CONCERNS whose firing conditions are all evidence
  conditions: those report that the measurement fell short of the policy.
  1 and 2 come from the score command's verdict ladder. 3 comes from a failed
  pre-flight, which the preflight command reports, or from any other
  invalidating condition score finds.`

/** `eval-quality: usage: <message>` */
export function renderUsage(message: string): string {
	return `${PREFIX}: usage: ${message}`
}
