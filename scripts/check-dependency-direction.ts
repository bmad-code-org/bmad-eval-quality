// Command entry point for AC 6's mechanically-enforced dependency direction:
// walks `src/`, scans every file with `dependency-direction.ts`'s scanner,
// and exits nonzero on any violation.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports, or the script fails at load.
//
// Usage:
//   npm run check:layers
import { fileURLToPath } from 'node:url'
import { scanSources } from './dependency-direction.ts'
import { discoverSourceFiles } from './discover-source-files.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

let files: Map<string, string>
try {
	files = await discoverSourceFiles(repoRoot)
} catch (error) {
	console.error(
		`check:layers: could not discover source files: ${
			error instanceof Error ? error.message : String(error)
		}`,
	)
	process.exit(1)
}

const violations = scanSources(files)

if (violations.length > 0) {
	console.error(
		`check:layers: ${violations.length} dependency-direction violation(s) across ${files.size} scanned file(s):`,
	)
	for (const violation of [...violations].sort((a, b) =>
		a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1,
	)) {
		console.error(
			`  ${violation.file}:${violation.line} imports "${violation.specifier}" — ${violation.rule}`,
		)
	}
	process.exit(1)
}

console.log(
	`check:layers: ${files.size} file(s) scanned under src/, 0 violations`,
)
