// Writes `package.json`'s `version` into the root barrel's `VERSION`
// declaration and the core `ENGINE_VERSION` beside it, which makes the manifest the one place the number is authored.
// `scripts/release-prepare.mjs` runs it straight after `npm version`, the way
// it already runs `scripts/stamp-changelog.mjs`.
//
// It refuses when `src/index.ts` carries no declaration to write into: minting
// one would put the export back after a deliberate removal.
//
// Usage:
//   npm run generate:version

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Reading } from './version-target.ts'
import {
	BARREL_FILE,
	CORE_FILE,
	read,
	withCoreVersion,
	withVersion,
} from './version-target.ts'

let reading: Reading
try {
	reading = read()
} catch (error) {
	console.error(
		`generate-version: ${error instanceof Error ? error.message : String(error)}`,
	)
	process.exit(1)
}

/** Writes one declaration, or says it already agrees. Refuses an unwritable file. */
function settle(file: string, current: string, rewrite: () => string): void {
	if (current === reading.manifestVersion) {
		console.log(`generate-version: ${file} already declares ${current}`)
		return
	}
	try {
		writeFileSync(resolve(file), rewrite())
	} catch (error) {
		console.error(
			`generate-version: ${file}: unwritable (${error instanceof Error ? error.message : String(error)})`,
		)
		process.exit(1)
	}
	console.log(
		`generate-version: ${file} ${current} -> ${reading.manifestVersion}`,
	)
}

settle(BARREL_FILE, reading.barrelVersion, () =>
	withVersion(reading.barrelSource, reading.manifestVersion),
)
settle(CORE_FILE, reading.coreVersion, () =>
	withCoreVersion(reading.coreSource, reading.manifestVersion),
)
