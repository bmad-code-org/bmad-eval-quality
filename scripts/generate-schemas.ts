// Writes the published JSON Schema export to `schemas/{key}.schema.json` for
// all twelve interchange artifacts. A thin I/O wrapper over the pure builder
// in `publish.ts` (AD-1); serialization rules live there too, so this writer
// and `check-schemas.ts`'s drift check cannot disagree about bytes.
//
// Usage:
//   npm run generate:schemas

// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports, or the script fails at load.
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { INTERCHANGE_ARTIFACT_KEYS } from '../src/core/schemas/artifact.ts'
import {
	publishedDocument,
	serializePublishedDocument,
} from '../src/core/schemas/publish.ts'

const directory = new URL('../schemas/', import.meta.url)
// Filesystem paths for anything built from a name read from disk. `new URL`
// is safe for the twelve kebab-slug registry keys, but a name containing `#`
// or `?` truncates there (`a#b.schema.json` resolves to `schemas/a`) and
// `%2F` throws ERR_INVALID_FILE_URL_PATH. A cleanup step can't afford to
// remove the wrong path.
const directoryPath = fileURLToPath(directory)
await mkdir(directory, { recursive: true })
for (const key of INTERCHANGE_ARTIFACT_KEYS) {
	// The builder throws a worded diagnosis when a ledger address stops
	// resolving; unguarded it would print as a Node stack instead.
	let serialized: string
	try {
		serialized = serializePublishedDocument(publishedDocument(key))
	} catch (error) {
		console.error(
			`generate-schemas: the builder failed for ${key}: ${
				error instanceof Error ? error.message : String(error)
			}`,
		)
		process.exit(1)
	}
	await writeFile(new URL(`${key}.schema.json`, directory), serialized)
	console.log(
		`generate-schemas: wrote schemas/${key}.schema.json (${Buffer.byteLength(serialized)} bytes)`,
	)
}

// A removed registry key must not strand its old file: check-schemas would
// fail on the orphan forever, and this script is the documented repair. Only
// regular `*.schema.json` files are removed; the `isFile` guard matters as
// much as the suffix, since `rm` without `recursive` throws on a directory
// and would abort the run part way through.
const expected = new Set(
	INTERCHANGE_ARTIFACT_KEYS.map((key) => `${key}.schema.json`),
)
for (const entry of await readdir(directory, { withFileTypes: true })) {
	if (!entry.isFile()) continue
	if (!entry.name.endsWith('.schema.json') || expected.has(entry.name)) continue
	await rm(join(directoryPath, entry.name))
	console.log(`generate-schemas: removed orphan schemas/${entry.name}`)
}
