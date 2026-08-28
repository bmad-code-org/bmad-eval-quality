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
import { pathToFileURL } from 'node:url'

// AD-25's list. The last three joined it when the documentation site arrived:
// all three are permissive, and none carries a copyleft or attribution burden
// beyond MIT's.
const PACKAGE_ALLOWLIST = new Set([
	'MIT',
	'Apache-2.0',
	'ISC',
	'BSD-2-Clause',
	'BSD-3-Clause',
	'0BSD',
	'BlueOak-1.0.0',
	'CC0-1.0',
	'Python-2.0',
])

/**
 * Two policies, named so a reader of CI output can never confuse them.
 *
 * `package` governs `package-lock.json`, the graph that reaches an adopter
 * through the tarball. AD-25 binds it exactly as written: the allowlist above
 * and no tolerance of any kind. `lightningcss` stays out of it, which is what
 * the root `overrides` pin on `vite` is for.
 *
 * `workspace` governs `website/package-lock.json` and adds `MPL-2.0`.
 * `website/package.json` is `"private": true`, `website/` appears in no `files`
 * entry, and `npm pack` carries none of it, so nothing in that graph is ever
 * distributed. MPL-2.0 is file-level copyleft on the covered files themselves
 * and binds a redistributor of those files; the documentation site ships as
 * static HTML built from these tools. The workspace policy also carries the
 * conditional `@img/sharp-*` tolerance below.
 */
const POLICIES = {
	package: {
		allowlist: PACKAGE_ALLOWLIST,
		label: 'package policy: AD-25 allowlist',
	},
	workspace: {
		allowlist: new Set([...PACKAGE_ALLOWLIST, 'MPL-2.0']),
		label: 'workspace policy: package allowlist + MPL-2.0',
	},
}

/**
 * The one scoped tolerance, and it is not an allowlist entry: `astro` declares
 * `sharp` in `optionalDependencies`, npm records an optional dependency in the
 * lockfile whatever `--omit` says, and the site selects
 * `passthroughImageService()` so the binaries are never loaded. The caller
 * passes `true` only for the website lockfile and only while that image
 * service is still selected, so turning it back on fails the gate again.
 */
function isToleratedSharp(meta, license) {
	const name = meta.name ?? ''
	return (
		name.startsWith('@img/sharp-') &&
		meta.optional === true &&
		typeof license === 'string' &&
		license.includes('LGPL-3.0-or-later')
	)
}

const REGISTRY_PREFIX = 'https://registry.npmjs.org/'

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
function isAllowed(licenseExpr, allowlist) {
	if (!licenseExpr || typeof licenseExpr !== 'string') return false
	const stripped = stripOuterParens(licenseExpr.trim())
	if (stripped === '') return false

	const orParts = splitTopLevel(stripped, ' OR ')
	if (orParts.length > 1)
		return orParts.some((part) => isAllowed(part, allowlist))

	const andParts = splitTopLevel(stripped, ' AND ')
	if (andParts.length > 1)
		return andParts.every((part) => isAllowed(part, allowlist))

	return allowlist.has(stripped)
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
//
// Must split on "/node_modules/" boundaries, not bare "/": a scoped package's path
// (node_modules/@scope/name) has three segments per nesting level, not two, so striding by two
// undershoots every scoped ancestor and never reaches the root scope "". That silently drops the
// dependency edge for anything nested under a scoped package - including every @biomejs/cli-*
// platform binary, exactly the case AD-25 calls out - and findDependencyPath falls back to the raw
// lockfile key instead of the real require-chain.
function ancestorScopesOf(pkgPath) {
	if (pkgPath === '') return ['']
	const scopes = []
	let scope = pkgPath
	for (;;) {
		scopes.push(scope)
		const boundary = scope.lastIndexOf('/node_modules/')
		if (boundary === -1) break
		scope = scope.slice(0, boundary)
	}
	scopes.push('')
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

export function checkLicenses(lockfile, options = {}) {
	const tolerateOptionalSharp = options.tolerateOptionalSharp === true
	const policy = POLICIES[options.policy ?? 'package']
	if (policy === undefined) {
		throw new Error(`unknown licence policy: ${options.policy}`)
	}
	const packages = lockfile.packages ?? {}
	// A `link: true` entry is a workspace symlink, not an installed artifact with its own licence -
	// audit-lockfile-age.mjs already excludes these; this script should agree instead of flagging a
	// symlink for a `license` field it was never going to have.
	const entries = Object.entries(packages).filter(
		([pkgPath, meta]) => pkgPath !== '' && !meta.link,
	)

	const violations = []
	const tolerated = []
	for (const [pkgPath, meta] of entries) {
		const name = meta.name ?? pkgPath.split('node_modules/').pop()
		const version = meta.version ?? '(unknown)'

		// A lockfile edit could relabel a package's `license` field while `resolved` (or `npm ci`
		// itself) still pulls the tarball from somewhere else entirely. Validating the self-reported
		// licence string without also pinning `resolved` to the real registry would validate the
		// wrong artifact and pass a substituted package.
		if (
			!(
				typeof meta.resolved === 'string' &&
				meta.resolved.startsWith(REGISTRY_PREFIX)
			)
		) {
			violations.push({
				path: pkgPath,
				name,
				version,
				license: meta.license ?? null,
				reason: `resolved=${JSON.stringify(meta.resolved)} is not the npm registry`,
			})
			continue
		}

		const license = licenseStringOf(meta)
		if (isAllowed(license, policy.allowlist)) continue
		if (tolerateOptionalSharp && isToleratedSharp({ ...meta, name }, license)) {
			tolerated.push(`${name}@${version}`)
			continue
		}
		violations.push({ path: pkgPath, name, version, license })
	}

	tolerated.sort()

	if (violations.length === 0)
		return {
			violations: [],
			entryCount: entries.length,
			tolerated,
			policy: policy.label,
		}

	const edges = buildEdges(packages)
	for (const violation of violations) {
		violation.dependencyPath = findDependencyPath(
			packages,
			edges,
			violation.path,
		)
	}
	return {
		violations,
		entryCount: entries.length,
		tolerated,
		policy: policy.label,
	}
}

/** The website lockfile is the one graph the workspace policy governs. */
const policyFor = (lockfilePath) =>
	lockfilePath.replace(/\\/g, '/').endsWith('website/package-lock.json')
		? 'workspace'
		: 'package'

/**
 * The tolerance is live only while the site still selects the passthrough
 * image service, so the file is read on every run.
 */
async function sharpToleranceApplies(lockfilePath) {
	if (!lockfilePath.replace(/\\/g, '/').endsWith('website/package-lock.json'))
		return false
	try {
		const config = await readFile(
			new URL('../website/astro.config.mjs', import.meta.url),
			'utf8',
		)
		return config.includes('passthroughImageService')
	} catch {
		return false
	}
}

async function main() {
	const args = parseArgs(process.argv.slice(2))
	const lockfile = JSON.parse(await readFile(args.lockfile, 'utf8'))
	const { violations, entryCount, tolerated, policy } = checkLicenses(
		lockfile,
		{
			policy: policyFor(args.lockfile),
			tolerateOptionalSharp: await sharpToleranceApplies(args.lockfile),
		},
	)

	if (violations.length === 0) {
		const note =
			tolerated.length === 0
				? ''
				: `, ${tolerated.length} optional @img/sharp-* entries tolerated: never loaded, passthroughImageService (${tolerated.join(', ')})`
		console.log(
			`Licence scan passed (${policy}): ${entryCount} entries, all allowlisted${note}.`,
		)
		return
	}

	console.error(
		`\nLicence violation (${policy}): ${violations.length} entrie(s) outside the allowlist:`,
	)
	for (const v of violations) {
		console.error(
			`  - ${v.name}@${v.version}: license=${JSON.stringify(v.license)}${v.reason ? ` (${v.reason})` : ''}`,
		)
		console.error(`    dependency path: ${v.dependencyPath}`)
	}
	process.exitCode = 1
}

// pathToFileURL percent-encodes the same way import.meta.url does (spaces, non-ASCII, etc.); a raw
// `file://${process.argv[1]}` template comparison silently mismatches on such paths, so main() never
// runs and the script exits 0 with no output - a gate switched off, not merely idle.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((err) => {
		console.error(err.stack ?? String(err))
		process.exitCode = 1
	})
}
