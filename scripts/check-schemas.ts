// The byte-exact drift check (AD-13, check two): rebuilds all twelve published
// documents in memory through the pure builder, serialises them through the
// exact rules the generator uses, and compares the result byte for byte
// against the committed `schemas/*.schema.json`. Plugs the hole where the Zod
// source and the committed export drift apart silently — a consumer would then
// validate against constraints the package no longer enforces.
//
// This is the one check that reads the filesystem, which is why it is a script
// rather than a Vitest test (AD-30 forbids tests filesystem I/O outside a
// temporary directory). It never rewrites a file and has no --write flag on
// purpose: a check that can silently repair what it is checking is not a gate.
// Regeneration is `npm run generate:schemas`.
//
// Usage:
//   npm run check:schemas

// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports, or the script fails at load.
import { readdir, readFile } from 'node:fs/promises'
import { INTERCHANGE_ARTIFACT_KEYS } from '../src/core/schemas/artifact.ts'
import {
	publishedDocument,
	serializePublishedDocument,
} from '../src/core/schemas/publish.ts'

const directory = new URL('../schemas/', import.meta.url)
const failures: string[] = []

// Anything in schemas/ the registry does not name is drift too: an orphan
// schema file, an editor backup, a stray note, or a nested directory would
// otherwise ship or linger unchecked beside the twelve real documents.
//
// Dot-prefixed entries are the one exception, and they are skipped rather than
// reported. `.gitignore` already covers `.DS_Store`, which macOS creates in any
// directory a Finder window has visited; failing on it would redden
// `npm run validate` for a file the repository does not track, with no visible
// cause, and `npm run generate:schemas` — the repair every message here names —
// deliberately removes only `*.schema.json` and so cannot clear it.
const expected = new Set(
	INTERCHANGE_ARTIFACT_KEYS.map((key) => `${key}.schema.json`),
)
// Kept apart from the drift list: "an unexpected file is present" and "a
// document no longer matches the builder" are different repairs, and one
// summary counting both as "drifted or missing" misnames whichever it is.
const unexpected: string[] = []
try {
	const entries = await readdir(directory, { withFileTypes: true })
	for (const entry of entries) {
		if (entry.name.startsWith('.')) continue
		if (!entry.isFile())
			unexpected.push(
				`schemas/${entry.name}: not a regular file; nothing but the twelve schema files belongs here`,
			)
		else if (!expected.has(entry.name))
			unexpected.push(
				`schemas/${entry.name}: present on disk but no registry key names it; remove it, or add its registry key`,
			)
	}
} catch (error) {
	// ENOENT means "not generated yet" and has a stated repair; any other
	// failure (EACCES, ENOTDIR) is its own problem and must not masquerade
	// as a missing directory.
	if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
		console.error(
			'check-schemas: schemas/ does not exist; run `npm run generate:schemas`',
		)
	} else {
		console.error(
			`check-schemas: could not read schemas/: ${
				error instanceof Error ? error.message : String(error)
			}`,
		)
	}
	process.exit(1)
}

for (const key of INTERCHANGE_ARTIFACT_KEYS) {
	// The builder throws a worded diagnosis when a ledger address stops
	// resolving, naming the entry and the segment that failed. Unguarded, that
	// message reaches the terminal as an unhandled rejection and a Node stack
	// instead of as this gate's own report, which is the one failure mode the
	// injector's error text was written for.
	let rebuilt: Buffer
	try {
		rebuilt = Buffer.from(
			serializePublishedDocument(publishedDocument(key)),
			'utf8',
		)
	} catch (error) {
		console.error(
			`check-schemas: the builder failed for ${key}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		)
		process.exit(1)
	}
	let committed: Buffer
	try {
		committed = await readFile(new URL(`${key}.schema.json`, directory))
	} catch {
		failures.push(
			`schemas/${key}.schema.json: missing; run \`npm run generate:schemas\``,
		)
		continue
	}
	if (committed.equals(rebuilt)) continue
	// Report the first differing byte offset with a short context window on
	// both sides, so the drift is locatable without a manual diff.
	const bound = Math.min(committed.length, rebuilt.length)
	let offset = 0
	while (offset < bound && committed[offset] === rebuilt[offset]) offset++
	const windowOf = (buffer: Buffer): string =>
		JSON.stringify(
			buffer.subarray(Math.max(0, offset - 20), offset + 20).toString('utf8'),
		)
	failures.push(
		`schemas/${key}.schema.json: drift at byte offset ${offset} ` +
			`(committed ${committed.length} bytes, rebuilt ${rebuilt.length} bytes)\n` +
			`  committed: ${windowOf(committed)}\n` +
			`  rebuilt:   ${windowOf(rebuilt)}`,
	)
}

if (unexpected.length > 0 || failures.length > 0) {
	if (unexpected.length > 0) {
		console.error(
			`check-schemas: schemas/ holds ${unexpected.length} entr${
				unexpected.length === 1 ? 'y' : 'ies'
			} nothing expects`,
		)
		for (const entry of unexpected) console.error(entry)
	}
	if (failures.length > 0) {
		console.error(
			`check-schemas: ${failures.length} file(s) drifted or missing`,
		)
		for (const failure of failures) console.error(failure)
	}
	process.exit(1)
}
console.log(
	`check-schemas: ${INTERCHANGE_ARTIFACT_KEYS.length} committed schema files match the builder byte for byte`,
)
