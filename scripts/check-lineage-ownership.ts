// Command entry point for AD-29's ownership rule: walks `src/`, scans every
// file with `lineage-ownership.ts`'s scanner, exits nonzero on any violation.
//
// Run by `node` directly, so nothing it imports transitively may carry a
// TypeScript enum, namespace, parameter property, or `export type` re-export.
//
// Usage:
//   npm run check:lineage
import { fileURLToPath } from 'node:url'
import { discoverSourceFiles } from './discover-source-files.ts'
import { scanLineageWrites } from './lineage-ownership.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

let files: Map<string, string>
try {
	files = await discoverSourceFiles(repoRoot)
} catch (error) {
	console.error(
		`check:lineage: could not discover source files: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

const violations = scanLineageWrites(files, { wholeTree: true })

if (violations.length > 0) {
	console.error(
		`check:lineage: ${violations.length} lineage-ownership violation(s) across ${files.size} scanned file(s):`,
	)
	for (const violation of [...violations].sort((a, b) =>
		a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1,
	)) {
		console.error(
			`  ${violation.file}:${violation.line} ${violation.subject}: ${violation.rule}`,
		)
	}
	process.exit(1)
}

console.log(
	`check:lineage: ${files.size} file(s) scanned under src/, 0 violations`,
)
