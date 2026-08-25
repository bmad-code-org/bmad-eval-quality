// Binds `RUNTIME_FAULT_CODES` to the AD-28 runtime fault registry it
// transcribes: the same drift check `check-ad5-registry.ts` runs for AD-5's
// compile-time registry, one boundary over. Fails if the architecture
// workspace and `lint:spine` path disagree, so this script and the spine
// linter can never silently point at two different documents.
//
// Extraction and comparison live in `scripts/ad28-registry.ts`, so
// `ad28-registry.test.ts` can prove they reject a mutated table; this file is
// I/O and exit codes only.
//
// Usage:
//   node scripts/check-ad28-registry.ts

// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports, or the script fails at load.
import { readFile } from 'node:fs/promises'
import { RUNTIME_FAULT_CODES } from '../src/core/schemas/faults.ts'
import { compareRegistry, extractAd28CodeTable } from './ad28-registry.ts'

const SPINE_WORKSPACE =
	'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29'
const SPINE_PATH = `${SPINE_WORKSPACE}/ARCHITECTURE-SPINE.md`

let manifest: string
try {
	manifest = await readFile(new URL('../package.json', import.meta.url), 'utf8')
} catch (error) {
	console.error(
		`check-ad28-registry: could not read package.json: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

let lintSpine: string | undefined
try {
	lintSpine = (JSON.parse(manifest).scripts as Record<string, string>)[
		'lint:spine'
	]
} catch (error) {
	console.error(
		`check-ad28-registry: could not parse package.json: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

if (lintSpine === undefined || !lintSpine.includes(SPINE_WORKSPACE)) {
	console.error(
		`check-ad28-registry: package.json's \`lint:spine\` does not name ${SPINE_WORKSPACE}, so this script and the spine linter disagree about which architecture workspace is current`,
	)
	console.error(`  lint:spine: ${lintSpine ?? '<absent>'}`)
	process.exit(1)
}

let spine: string
try {
	spine = await readFile(new URL(`../${SPINE_PATH}`, import.meta.url), 'utf8')
} catch (error) {
	console.error(
		`check-ad28-registry: could not read ${SPINE_PATH}: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

const extraction = extractAd28CodeTable(spine)
if (!extraction.ok) {
	console.error(`check-ad28-registry: ${extraction.reason} in ${SPINE_PATH}`)
	for (const detail of extraction.details) console.error(`  ${detail}`)
	process.exit(1)
}

const failures = compareRegistry(extraction.codes, RUNTIME_FAULT_CODES)
if (failures.length > 0) {
	console.error(
		`check-ad28-registry: RUNTIME_FAULT_CODES has drifted from the AD-28 table (${failures.length} finding(s))`,
	)
	for (const failure of failures) console.error(`  ${failure}`)
	process.exit(1)
}

console.log(
	`check-ad28-registry: ${extraction.codes.length} codes, set- and order-equal between the AD-28 table and src/core/schemas/faults.ts`,
)
