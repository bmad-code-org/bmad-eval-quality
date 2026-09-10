// What more than one committed chain needs, and nothing else.
//
// Each chain under `_bmad-output/worked-examples/` (and the spike chain that
// predates that root) owns its own target module: its contract, its probe, its
// run record, its file list. What they share is how bytes are rendered, how a
// placeholder digest is spelled, how the builder aborts, and the policy every
// chain is scored under. Those four live here so a change made for one chain
// reaches the others through a module that says it belongs to all of them.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports.
import { serializeArtifact } from '../src/application/serialize.ts'
import { ScoringPolicy } from '../src/core/schemas/scoring-policy.ts'

/**
 * A function declaration rather than an arrow, because TypeScript treats a
 * call as never-returning only when the callee is declared this way. As a
 * `const` arrow it stops narrowing at every guard in a chain builder, and the
 * null checks on a probe's own qualifying fields then need casts to undo.
 */
export function fail(message: string): never {
	throw new Error(`worked-example: ${message}`)
}

/**
 * Canonical bytes, re-indented. RFC 8785 fixes key order and number spelling,
 * so two runs over one input produce one tree; the re-indent is what keeps a
 * chain readable, which is the only reason these folders exist.
 *
 * Two consequences, both stated because a reader of a worked example will hit
 * them.
 *
 * The bytes on disk are the re-indented form, so hashing a file here does not
 * reproduce a digest recorded inside it. A chain's `contractDigest` is
 * `digestArtifact` over the contract's canonical bytes, which is
 * `serializeArtifact` output with no whitespace; `shasum -a 256` over the
 * chain's own `eval-contract.json` hashes this indented rendering and gives a
 * different value. Every digest in a chain is over the canonical form. That is
 * what `dev-corpus-target.ts` avoids by writing `serializeArtifact` output
 * straight to disk, and the trade taken here is readability against a hash a
 * reader can reproduce with one shell command. A chain whose contract is a
 * published corpus contract keeps the reproducible hash all the same, because
 * the corpus writes the canonical bytes and the chain's digest is over those.
 * Strip the published file's trailing newline before hashing it:
 * `serializeArtifact` appends one and `canonicalize` does not, so
 * `shasum -a 256` over the file as written answers a different question, the
 * one `corpus/dev/index.json` records.
 *
 * The re-indent preserves RFC 8785 key order only while no emitted object
 * carries an array-index-like key: V8 hoists integer-like own properties and
 * enumerates them in numeric order ahead of the string keys, so `JSON.parse`
 * followed by `JSON.stringify` would reorder such an object. The round trip
 * below checks that rather than asserting it, because a breach is otherwise
 * invisible: a generator would write reordered bytes and the drift check would
 * compare them against an identically reordered rebuild and exit 0. The digests
 * are computed over the canonical bytes rather than over this rendering, so
 * nothing downstream reads the rendered order either way.
 */
export const renderJson = (value: unknown, artifactPath: string): string => {
	const canonical = serializeArtifact(value, artifactPath)
	const rendered = `${JSON.stringify(JSON.parse(canonical), null, 2)}\n`
	// `serializeArtifact` ends its output with a newline, which the re-parse
	// drops, so the comparison puts one back.
	if (`${JSON.stringify(JSON.parse(rendered))}\n` !== canonical) {
		fail(`${artifactPath}: the re-indent did not round-trip to canonical bytes`)
	}
	return rendered
}

/**
 * A digest-shaped stand-in for a value no artifact in a chain carries. The
 * ordinal is what keeps two placeholders distinguishable, so the ordinals form
 * one sequence across every chain in the repository rather than restarting per
 * module.
 */
export const digestPlaceholder = (ordinal: number): string =>
	`sha256:${ordinal.toString(16).padStart(64, '0')}`

/**
 * The published default policy, and every chain is scored under it. Not one of
 * any chain's emitted files: it is a caller-side input a chain was scored
 * under, and it is here so the severity floor, the thresholds, and the regex
 * budget are read from one declared artifact rather than from scattered
 * literals.
 *
 * `minimumTrialCount` is 3, which is above what one `score` invocation can
 * complete: the command reads one sealed run record, so a chain built on it
 * completes one trial and its strength vector comes back marked
 * non-comparable. Lowering it to make a chain comparable would describe a
 * policy nobody ships.
 */
export const POLICY = ScoringPolicy.parse({
	schemaVersion: 2,
	parentDigest: null,
	revisionCount: 0,
	policyId: 'default-policy',
	severityFloor: 'material',
	confidenceThreshold: 0.7,
	catchThreshold: 0.5,
	minimumTrialCount: 3,
	reExecutionCap: 2,
	remediationCap: 3,
	regexMatchStepBudget: 1000000,
})
