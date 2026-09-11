// The build-free gate over the published version: compares the `VERSION`
// declaration in `src/index.ts` against `version` in `package.json` and
// refuses a disagreement.
//
// It reads the two source files, so it needs no build. `npm run validate` runs
// it, and `scripts/release-prepare.mjs` runs it in preflight, where a green
// result means the barrel agrees with the manifest the release is about to
// bump.
//
// Two test cases hold the same agreement elsewhere.
// `tests/architecture/package-exports.test.ts` case 156, "`VERSION` equals the
// manifest version", reads the built barrel and skips when `dist/` is absent.
// `tests/index.test.ts` compares the source barrel's `VERSION` against
// `package.json`, which is the case that holds under a bare `npm test`.
//
// It never rewrites what it checks, per `check-schemas.ts:6-9`: a check that
// can repair what it checks is not a gate. Regeneration is
// `npm run generate:version`.
//
// Usage:
//   npm run check:version

// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here
// or in anything it imports.
import type { Reading } from './version-target.ts'
import { BARREL_FILE, MANIFEST_FILE, read } from './version-target.ts'

let reading: Reading
try {
	reading = read()
} catch (error) {
	console.error(
		`check-version: ${error instanceof Error ? error.message : String(error)}`,
	)
	process.exit(1)
}

if (reading.barrelVersion !== reading.manifestVersion) {
	console.error(
		`check-version: ${BARREL_FILE} declares VERSION '${reading.barrelVersion}' ` +
			`and ${MANIFEST_FILE} declares version '${reading.manifestVersion}'\n` +
			'  run `npm run generate:version` to write the manifest version into the barrel',
	)
	process.exit(1)
}

console.log(
	`check-version: ${BARREL_FILE} and ${MANIFEST_FILE} both declare ${reading.manifestVersion}`,
)
