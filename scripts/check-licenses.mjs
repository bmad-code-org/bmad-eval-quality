// Holds every entry in a resolved lockfile against an allowlist of SPDX
// identifiers, and fails closed on an entry that does not resolve to the npm
// registry.
//
// Reads `package-lock.json` directly rather than walking `node_modules`: the
// lockfile records a `license` field for every entry, including optional
// platform binaries never installed on this runner's OS/CPU (Biome and friends
// ship one lock entry per platform). Walking node_modules would silently miss
// every foreign-platform entry. Needs no install.
//
// A pure scanner over a parsed lockfile and the data its caller supplies. It
// carries no allowlist, no policy and no exception of its own, so this
// repository's licence policy is data in `eval-quality.config.json` exactly as a
// consumer's is. `scripts/gates-cli.ts` is the entry point that reads that file,
// resolves the policy for each lockfile, and decides which exceptions still
// hold.

const REGISTRY_PREFIX = 'https://registry.npmjs.org/'

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

// One scoped exception, applied to one entry. `prefix` names a family of
// packages and `license` is matched as a substring, because the shapes this
// covers are platform binaries whose licence expression carries the copyleft
// term among others. The caller has already decided this exception applies to
// this lockfile and that its marker still holds.
function isTolerated(tolerance, meta, name, license) {
	if (!name.startsWith(tolerance.prefix)) return false
	if (tolerance.optional !== false && meta.optional !== true) return false
	return typeof license === 'string' && license.includes(tolerance.license)
}

// Resolves how npm's hoisting algorithm would look up dependency `name` starting from the package
// at `fromPath`: its own node_modules first, then each ancestor's, ending at the root.
//
// Must split on "/node_modules/" boundaries, not bare "/": a scoped package's path
// (node_modules/@scope/name) has three segments per nesting level, not two, so striding by two
// undershoots every scoped ancestor and never reaches the root scope "". That silently drops the
// dependency edge for anything nested under a scoped package - including every @biomejs/cli-*
// platform binary - and findDependencyPath falls back to the raw lockfile key instead of the real
// require-chain.
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

/**
 * `options.allowlist` is required and has no default. An absent allowlist either
 * fails every entry or silently permits every entry, and a gate that picks one
 * of those on the caller's behalf is the fallback this package does not have.
 */
export function checkLicenses(lockfile, options = {}) {
	const allowed = options.allowlist
	if (!Array.isArray(allowed) || allowed.length === 0) {
		throw new Error(
			'check-licenses: no allowlist was supplied; the licences gate carries none of its own',
		)
	}
	const allowlist = new Set(allowed)
	const label = typeof options.label === 'string' ? options.label : 'allowlist'
	const tolerances = options.tolerances ?? []

	const packages = lockfile.packages ?? {}
	// A `link: true` entry is a workspace symlink, not an installed artifact with its own licence -
	// audit-lockfile-age.mjs already excludes these; this script should agree instead of flagging a
	// symlink for a `license` field it was never going to have.
	const entries = Object.entries(packages).filter(
		([pkgPath, meta]) => pkgPath !== '' && !meta.link,
	)

	const violations = []
	const tolerated = []
	const reasons = new Set()
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
		if (isAllowed(license, allowlist)) continue
		const tolerance = tolerances.find((candidate) =>
			isTolerated(candidate, meta, name, license),
		)
		if (tolerance !== undefined) {
			tolerated.push(`${name}@${version}`)
			reasons.add(tolerance.reason)
			continue
		}
		violations.push({ path: pkgPath, name, version, license })
	}

	tolerated.sort()
	const toleranceReasons = [...reasons].sort()

	if (violations.length === 0)
		return {
			violations: [],
			entryCount: entries.length,
			tolerated,
			toleranceReasons,
			policy: label,
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
		toleranceReasons,
		policy: label,
	}
}
