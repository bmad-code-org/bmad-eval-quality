#!/usr/bin/env node
// The shareable-export gate. `check:docs` reads only markdown, so nothing in
// `npm run validate` used to look at `_bmad-output/shareable/`: a committed
// export could sit stale for weeks after the README changed, or keep pointing at
// a repository URL the project had already migrated away from, and every gate
// would stay green. Those exports are the copy that leaves the repository, so
// they are the copy most worth checking.
//
// Three things are asserted:
//   1. Every page the builder produces is committed, byte for byte. The export
//      is generated, so a difference means the committed copy is stale.
//   2. Nothing else lives in the directory. An orphan page keeps being shared
//      after the document behind it is gone.
//   3. Every eval-quality repository URL in the export is the canonical one, and
//      the canonical one is the URL `package.json` declares. A legacy owner in a
//      shared HTML file is a dead link for the recipient and a wrong attribution
//      for the project.
//
// It never rewrites a file and has no --write flag on purpose: a check that can
// silently repair what it is checking is not a gate. Regeneration is
// `npm run build:shareable`.
//
// Usage:
//   npm run check:shareable

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { REPO_URL, renderAll, SHAREABLE_DIR } from './build-shareable.mjs'

const DIR_LABEL = '_bmad-output/shareable'
const failures = []

// Derived rather than restated: if `package.json` migrates to another owner and
// the builder does not, the export ships links nothing else in the repository
// agrees with, and nobody finds out until a recipient reports a 404.
const manifest = JSON.parse(
	await readFile(new URL('../package.json', import.meta.url), 'utf8'),
)
const declared = (manifest.repository?.url ?? '')
	.replace(/^git\+/, '')
	.replace(/\.git$/, '')
if (declared !== REPO_URL) {
	failures.push(
		`the builder's REPO_URL is ${REPO_URL} but package.json declares ${declared || '(nothing)'}; ` +
			'the two must name the same repository',
	)
}

const { pages, repoOnlyLinks } = renderAll()

// Any eval-quality repository URL that is not the canonical one. Matching on the
// repository name rather than on a hard-coded list of past owners means a future
// migration is caught by the same rule, without anyone remembering to extend it.
const REPO_URL_PATTERN =
	/https:\/\/github\.com\/([\w.-]+)\/([\w.-]*eval-quality)/g

let committedEntries
try {
	committedEntries = await readdir(SHAREABLE_DIR, { withFileTypes: true })
} catch (error) {
	// ENOENT means "not generated yet" and has a stated repair; any other failure
	// (EACCES, ENOTDIR) is its own problem and must not masquerade as a missing
	// directory.
	if (error.code === 'ENOENT') {
		console.error(
			`check-shareable: ${DIR_LABEL}/ does not exist; run \`npm run build:shareable\``,
		)
	} else {
		console.error(
			`check-shareable: could not read ${DIR_LABEL}/: ${error.message}`,
		)
	}
	process.exit(1)
}

// Kept apart from the drift list: "an unexpected file is present" and "a page no
// longer matches the builder" are different repairs, and one summary counting
// both misnames whichever it is. Dot-prefixed entries are skipped for the same
// reason `check:schemas` skips them: `.DS_Store` is untracked and the repair
// named below would not clear it.
const unexpected = []
for (const entry of committedEntries) {
	if (entry.name.startsWith('.')) continue
	if (!entry.isFile()) {
		unexpected.push(
			`${DIR_LABEL}/${entry.name}: not a regular file; only generated pages belong here`,
		)
	} else if (!pages.has(entry.name)) {
		unexpected.push(
			`${DIR_LABEL}/${entry.name}: present on disk but the builder does not produce it; remove it, or add its entry to scripts/build-shareable.mjs`,
		)
	}
}

let canonicalSeen = false
for (const [name, html] of pages) {
	const rebuilt = Buffer.from(html, 'utf8')
	let committed
	try {
		committed = await readFile(join(SHAREABLE_DIR, name))
	} catch {
		failures.push(
			`${DIR_LABEL}/${name}: missing; run \`npm run build:shareable\``,
		)
		continue
	}

	if (committed.equals(rebuilt)) {
		// Nothing to report, but the URL scan below still runs on this page.
	} else {
		// Report the first differing byte offset with a short context window on
		// both sides, so the staleness is locatable without a manual diff.
		const bound = Math.min(committed.length, rebuilt.length)
		let offset = 0
		while (offset < bound && committed[offset] === rebuilt[offset]) offset++
		const windowOf = (buffer) =>
			JSON.stringify(
				buffer.subarray(Math.max(0, offset - 20), offset + 20).toString('utf8'),
			)
		failures.push(
			`${DIR_LABEL}/${name}: stale at byte offset ${offset} ` +
				`(committed ${committed.length} bytes, rebuilt ${rebuilt.length} bytes)\n` +
				`  committed: ${windowOf(committed)}\n` +
				`  rebuilt:   ${windowOf(rebuilt)}`,
		)
	}

	// The committed bytes are what a recipient opens, so they are what is scanned
	// for a legacy URL, even when they have already been reported as stale.
	const text = committed.toString('utf8')
	for (const match of text.matchAll(REPO_URL_PATTERN)) {
		if (match[0] === REPO_URL) {
			canonicalSeen = true
			continue
		}
		failures.push(
			`${DIR_LABEL}/${name}: links to ${match[0]}, which is not the canonical ${REPO_URL}`,
		)
	}
}

// A page set that names the repository nowhere would pass every check above
// while giving a recipient no way back to the source.
if (!canonicalSeen) {
	failures.push(
		`no page in ${DIR_LABEL}/ contains the canonical repository URL ${REPO_URL}`,
	)
}

if (unexpected.length > 0 || failures.length > 0) {
	if (unexpected.length > 0) {
		console.error(
			`check-shareable: ${DIR_LABEL}/ holds ${unexpected.length} entr${
				unexpected.length === 1 ? 'y' : 'ies'
			} nothing expects`,
		)
		for (const entry of unexpected) console.error(`  ${entry}`)
	}
	if (failures.length > 0) {
		console.error(`check-shareable: ${failures.length} problem(s)`)
		for (const failure of failures) console.error(`  ${failure}`)
	}
	process.exit(1)
}

// Reported, not failed: a link the export cannot render is a known limitation
// (a directory has no page), and the page marks it for the reader. Printing it
// keeps the set visible so it does not quietly grow.
for (const path of repoOnlyLinks) {
	console.log(
		`check-shareable: link still needs repository access (marked in the page): ${path}`,
	)
}
console.log(
	`check-shareable: ${pages.size} committed page(s) match the builder byte for byte and use ${REPO_URL}`,
)
