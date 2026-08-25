// The byte-exact drift check (AD-13, check two): rebuilds all twelve published
// documents through the pure builder and compares them byte for byte against
// the committed `schemas/*.schema.json`, so a consumer never validates against
// constraints the package no longer enforces.
//
// The one check that reads the filesystem (AD-30 forbids test filesystem I/O
// outside a temp directory, so this is a script, not a Vitest test). It never
// rewrites a file, on purpose: a check that can repair what it checks is not
// a gate. Regeneration is `npm run generate:schemas`.
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
// file, an editor backup, or a nested directory would otherwise linger
// unchecked. Dot-prefixed entries are the exception (skipped, not reported):
// `.gitignore` already covers `.DS_Store`, and `generate:schemas` only ever
// removes `*.schema.json`, so it could never clear one anyway.
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
	// The builder throws a worded diagnosis naming the entry and segment that
	// failed when a ledger address stops resolving; unguarded, it would surface
	// as an unhandled rejection and a Node stack instead of this gate's report.
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
