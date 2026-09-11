// Writes `package.json`'s `version` into the root barrel's `VERSION`
// declaration, which makes the manifest the one place the number is authored.
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
import { BARREL_FILE, read, withVersion } from './version-target.ts'

let reading: Reading
try {
	reading = read()
} catch (error) {
	console.error(
		`generate-version: ${error instanceof Error ? error.message : String(error)}`,
	)
	process.exit(1)
}

if (reading.barrelVersion === reading.manifestVersion) {
	console.log(
		`generate-version: ${BARREL_FILE} already declares ${reading.manifestVersion}`,
	)
} else {
	try {
		writeFileSync(
			resolve(BARREL_FILE),
			withVersion(reading.barrelSource, reading.manifestVersion),
		)
	} catch (error) {
		console.error(
			`generate-version: ${BARREL_FILE}: unwritable (${error instanceof Error ? error.message : String(error)})`,
		)
		process.exit(1)
	}
	console.log(
		`generate-version: ${BARREL_FILE} ${reading.barrelVersion} -> ${reading.manifestVersion}`,
	)
}
