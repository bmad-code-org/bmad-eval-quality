#!/usr/bin/env node
// Structural checks for the planning artifacts. Biome excludes `_bmad-output`, so nothing else
// in `npm run validate` reads these files.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Inside `experiments/`, list individual files only: several records there are digest-recorded and a
// whitespace rewrite would invalidate their checksums.
const ROOTS = [
	'README.md',
	'_bmad-output/planning-artifacts',
	'_bmad-output/project-knowledge',
	'experiments/hypothesis-validation/README.md',
	'experiments/hypothesis-validation/HYPOTHESIS_VALIDATION_PLAN.md',
]
const FRONTMATTER_SCAN_LIMIT = 40

const collect = (target) => {
	const info = statSync(target, { throwIfNoEntry: false })
	if (!info) return []
	if (info.isFile()) return target.endsWith('.md') ? [target] : []
	return readdirSync(target).flatMap((entry) => collect(join(target, entry)))
}

const checkFrontmatter = (lines) => {
	if (lines[0] !== '---') return []
	const closing = lines.slice(1, FRONTMATTER_SCAN_LIMIT).indexOf('---')
	if (closing === -1) {
		return [
			`line 1: frontmatter opens with --- but has no closing --- within ${FRONTMATTER_SCAN_LIMIT} lines`,
		]
	}
	const errors = []
	for (const [offset, line] of lines.slice(1, closing + 1).entries()) {
		if (line.startsWith('#')) {
			errors.push(
				`line ${offset + 2}: Markdown heading inside frontmatter (${line.trim()})`,
			)
		}
	}
	return errors
}

const fixWhitespace = (lines) => {
	const fixed = []
	let inFence = false
	for (const line of lines) {
		if (line.trimStart().startsWith('```')) inFence = !inFence
		const next = inFence ? line : line.replace(/\s+$/, '')
		if (!inFence && next === '' && fixed.at(-1) === '') continue
		fixed.push(next)
	}
	while (fixed.at(-1) === '') fixed.pop()
	return fixed
}

const files = ROOTS.flatMap(collect).sort()
const shouldFix = process.argv.includes('--fix')
const failures = []

for (const file of files) {
	const original = readFileSync(file, 'utf8')
	const lines = original.split('\n')
	const structural = checkFrontmatter(lines)
	const repaired = `${fixWhitespace(lines).join('\n')}\n`

	if (shouldFix && repaired !== original) writeFileSync(file, repaired)
	else if (repaired !== original) {
		structural.push(
			'trailing whitespace, repeated blank lines, or a malformed final newline',
		)
	}
	for (const problem of structural) failures.push(`${file}: ${problem}`)
}

if (failures.length > 0) {
	console.error(`check-docs found ${failures.length} problem(s):`)
	for (const failure of failures) console.error(`  ${failure}`)
	console.error('Run `npm run check:docs -- --fix` for the whitespace ones.')
	process.exit(1)
}

console.log(`check-docs: ${files.length} file(s) OK`)
