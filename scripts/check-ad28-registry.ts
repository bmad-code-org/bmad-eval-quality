// Binds `RUNTIME_FAULT_CODES` to the AD-28 runtime fault registry it
// transcribes: the same drift check `check-ad5-registry.ts` runs for AD-5's
// compile-time registry, one boundary over. Fails if the architecture
// workspace here and `lint_spine.py`'s `DEFAULT_WORKSPACE` disagree, so this
// script and the spine linter can never silently point at two different
// documents.
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

let linter: string
try {
	linter = await readFile(
		new URL('./spine-lint/lint_spine.py', import.meta.url),
		'utf8',
	)
} catch (error) {
	console.error(
		`check-ad28-registry: could not read scripts/spine-lint/lint_spine.py: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

// Two assertions rather than a substring search. A bare `includes` over a
// 550-line file is satisfied by any surviving mention of the path (a comment,
// a docstring, a changelog line) while the constant itself points somewhere
// else, which is the drift this check exists to catch.
const declaredWorkspace = /^DEFAULT_WORKSPACE = "([^"]+)"$/m.exec(linter)?.[1]
if (declaredWorkspace !== SPINE_WORKSPACE) {
	console.error(
		`check-ad28-registry: lint_spine.py declares DEFAULT_WORKSPACE = ${
			declaredWorkspace === undefined
				? '(no top-level assignment matched)'
				: `"${declaredWorkspace}"`
		}, not "${SPINE_WORKSPACE}", so this script and the spine linter disagree about which architecture workspace is current`,
	)
	process.exit(1)
}
// The constant only binds the linter if `--workspace` still defaults to it;
// a flag re-pointed at a literal would leave the assertion above passing over
// a value nothing reads.
if (!/"--workspace",\s*default=DEFAULT_WORKSPACE/.test(linter)) {
	console.error(
		"check-ad28-registry: lint_spine.py's --workspace flag no longer defaults to DEFAULT_WORKSPACE, so the constant this script agrees with is not the workspace the linter reads",
	)
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
