#!/usr/bin/env node
// Enforces AD-25's licence allowlist over the full resolved dependency graph.
//
// Reads `package-lock.json` directly rather than walking `node_modules`: the lockfile records a
// `license` field for every entry, including optional platform binaries never installed on this
// runner's OS/CPU (Biome and friends ship one lock entry per platform). Walking node_modules would
// silently miss every foreign-platform entry. Needs no install.
//
// Usage:
//   node scripts/check-licenses.mjs [--lockfile <path>]

import { readFile } from 'node:fs/promises'

const ALLOWLIST = new Set([
	'MIT',
	'Apache-2.0',
	'ISC',
	'BSD-2-Clause',
	'BSD-3-Clause',
	'0BSD',
])

function parseArgs(argv) {
	const args = { lockfile: 'package-lock.json' }
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (arg === '--lockfile') args.lockfile = argv[++i]
		else throw new Error(`Unknown argument: ${arg}`)
	}
	return args
}

// Strips a single layer of balanced outer parentheses at a time, e.g. "(MIT OR Apache-2.0)" ->
// "MIT OR Apache-2.0". Only strips when the opening paren's match is the expression's final
// character (a true outer wrap), not when parens merely appear inside, e.g. "(MIT) OR (ISC)".
function stripOuterParens(expr) {
	let s = expr.trim()
	while (s.startsWith('(') && s.endsWith(')')) {
		let depth = 0
		let wrapsWhole = true
		for (let i = 0; i < s.length; i++) {
			if (s[i] === '(') depth++
			else if (s[i] === ')') {
				depth--
				if (depth === 0 && i !== s.length - 1) {
					wrapsWhole = false
					break
				}
			}
		}
		if (!wrapsWhole) break
		s = s.slice(1, -1).trim()
	}
	return s
}

// Splits `expr` on top-level occurrences of `token` (e.g. " OR ", " AND "), ignoring occurrences
// nested inside parentheses.
function splitTopLevel(expr, token) {
	const parts = []
	let depth = 0
	let start = 0
	for (let i = 0; i < expr.length; i++) {
		const ch = expr[i]
		if (ch === '(') depth++
		else if (ch === ')') depth--
		else if (depth === 0 && expr.slice(i, i + token.length) === token) {
			parts.push(expr.slice(start, i))
			i += token.length - 1
			start = i + 1
		}
	}
	parts.push(expr.slice(start))
	return parts
}

// Recursively evaluates an SPDX-ish licence expression: OR passes if any operand is allowlisted,
// AND passes only if every operand is. A bare identifier (including a "X WITH exception" compound,
// UNLICENSED, or anything unparseable) passes only via exact allowlist membership, so those all fail
// closed without special-casing.
function isAllowed(licenseExpr) {
	if (!licenseExpr || typeof licenseExpr !== 'string') return false
	const stripped = stripOuterParens(licenseExpr.trim())
	if (stripped === '') return false

	const orParts = splitTopLevel(stripped, ' OR ')
	if (orParts.length > 1) return orParts.some((part) => isAllowed(part))

	const andParts = splitTopLevel(stripped, ' AND ')
	if (andParts.length > 1) return andParts.every((part) => isAllowed(part))

	return ALLOWLIST.has(stripped)
}

function licenseStringOf(meta) {
	const license = meta.license
	if (typeof license === 'string') return license
	if (
		license &&
		typeof license === 'object' &&
		typeof license.type === 'string'
	)
		return license.type
	return null
}

// Resolves how npm's hoisting algorithm would look up dependency `name` starting from the package
// at `fromPath`: its own node_modules first, then each ancestor's, ending at the root.
function ancestorScopesOf(pkgPath) {
	if (pkgPath === '') return ['']
	const segments = pkgPath.split('/')
	const scopes = [pkgPath]
	for (let i = segments.length - 2; i >= 0; i -= 2) {
		scopes.push(segments.slice(0, i).join('/'))
	}
	return scopes
}

function resolveDependency(packages, fromPath, name) {
	for (const scope of ancestorScopesOf(fromPath)) {
		const candidate = scope
			? `${scope}/node_modules/${name}`
			: `node_modules/${name}`
		if (packages[candidate]) return candidate
	}
	return null
}

function buildEdges(packages) {
	const edges = new Map()
	for (const [path, meta] of Object.entries(packages)) {
		const wantedNames = new Set([
			...Object.keys(meta.dependencies ?? {}),
			...Object.keys(meta.optionalDependencies ?? {}),
			...Object.keys(meta.peerDependencies ?? {}),
			...(path === '' ? Object.keys(meta.devDependencies ?? {}) : []),
		])
		const list = []
		for (const name of wantedNames) {
			const resolved = resolveDependency(packages, path, name)
			if (resolved) list.push({ name, childPath: resolved })
		}
		edges.set(path, list)
	}
	return edges
}

// Breadth-first search from the root over the lockfile's dependency edges (walking edges, not
// `npm ls`, since this script needs no install) to find one shortest chain of require-names that
// reaches `targetPath`.
function findDependencyPath(packages, edges, targetPath) {
	const rootName = packages['']?.name ?? '(root)'
	if (targetPath === '') return rootName

	const visited = new Set([''])
	const queue = ['']
	const parent = new Map() // childPath -> { parentPath, name }

	while (queue.length > 0) {
		const current = queue.shift()
		for (const { name, childPath } of edges.get(current) ?? []) {
			if (visited.has(childPath)) continue
			visited.add(childPath)
			parent.set(childPath, { parentPath: current, name })
			if (childPath === targetPath) {
				const chain = []
				let cursor = targetPath
				while (cursor !== '') {
					const step = parent.get(cursor)
					chain.unshift(step.name)
					cursor = step.parentPath
				}
				return [rootName, ...chain].join(' > ')
			}
			queue.push(childPath)
		}
	}
	return targetPath // unreachable via declared edges; fall back to the raw lockfile key
}

export function checkLicenses(lockfile) {
	const packages = lockfile.packages ?? {}
	const entries = Object.entries(packages).filter(([pkgPath]) => pkgPath !== '')

	const violations = []
	for (const [pkgPath, meta] of entries) {
		const license = licenseStringOf(meta)
		if (!isAllowed(license)) {
			violations.push({
				path: pkgPath,
				name: meta.name ?? pkgPath.split('node_modules/').pop(),
				version: meta.version ?? '(unknown)',
				license,
			})
		}
	}

	if (violations.length === 0)
		return { violations: [], entryCount: entries.length }

	const edges = buildEdges(packages)
	for (const violation of violations) {
		violation.dependencyPath = findDependencyPath(
			packages,
			edges,
			violation.path,
		)
	}
	return { violations, entryCount: entries.length }
}

async function main() {
	const args = parseArgs(process.argv.slice(2))
	const lockfile = JSON.parse(await readFile(args.lockfile, 'utf8'))
	const { violations, entryCount } = checkLicenses(lockfile)

	if (violations.length === 0) {
		console.log(`Licence scan passed: ${entryCount} entries, all allowlisted.`)
		return
	}

	console.error(
		`\nLicence violation: ${violations.length} entrie(s) outside the allowlist:`,
	)
	for (const v of violations) {
		console.error(
			`  - ${v.name}@${v.version}: license=${JSON.stringify(v.license)}`,
		)
		console.error(`    dependency path: ${v.dependencyPath}`)
	}
	process.exitCode = 1
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error(err.stack ?? String(err))
		process.exitCode = 1
	})
}
