/**
 * The dependency-direction gate: proves `scanSources` rejects every forbidden
 * edge and construct, and accepts every allowed one, over in-memory synthetic
 * source snippets rather than by mutating the real repository tree. The last
 * describe blocks run this repository's own configuration against its own tree.
 *
 * The graph below is written from `ARCHITECTURE-SPINE.md` and from Story 6.1 AC
 * 10. It is copied from neither `eval-quality.config.json` nor the scanner, so
 * these cases assert the architecture and the implementation never gets to agree
 * with itself.
 */
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { DependencyDirectionConfig } from '../../scripts/check-dependency-direction.ts'
import {
	DependencyDirectionSection,
	ORDERING_WITNESS_VIOLATIONS,
	probeTypeScript,
	runDependencyDirection,
	TYPESCRIPT_PEER_MISSING,
} from '../../scripts/check-dependency-direction.ts'
import type { DirectionGraph } from '../../scripts/dependency-direction.ts'
import {
	classifyLayer,
	compileGraph,
	scanSources,
} from '../../scripts/dependency-direction.ts'
import { discoverSourceFiles } from '../../scripts/discover-source-files.ts'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

const ZOD_RULE = 'core/schemas may import the external module "zod" only'
const CORE_RULE =
	'core/ (excluding core/schemas) may not import an external module or Node builtin'
const PORTS_RULE =
	'ports/ may import core/schemas only; it declares shapes and may not import an external module or Node builtin'
const TESTING_RULE =
	'testing/ may import ports/ and core/schemas only; the published conformance suite may not import a test framework, an external module, or a Node builtin'
const EXEMPTION_RULE =
	'src/core/canonical/digest.ts may import only the named binding "createHash" from node:crypto'

/** Ambient reads AD-1 bans under `core/`. A global such as `crypto` needs no import, so no import rule can see one. */
const IMPURE_MEMBERS = [
	{ member: 'Date.now', category: 'clock read' },
	{ member: 'performance.now', category: 'clock read' },
	{ member: 'performance.timeOrigin', category: 'clock read' },
	{ member: 'Math.random', category: 'randomness' },
	{ member: 'crypto.randomUUID', category: 'randomness' },
	{ member: 'crypto.getRandomValues', category: 'randomness' },
	{ member: 'crypto.randomBytes', category: 'randomness' },
	{ member: 'crypto.randomInt', category: 'randomness' },
	{ member: 'crypto.randomFillSync', category: 'randomness' },
	{ member: 'crypto.randomFill', category: 'randomness' },
	{ member: 'crypto.webcrypto', category: 'randomness' },
	{ member: 'crypto.subtle', category: 'randomness' },
]

/**
 * The layer graph this repository declares, transcribed here from the spine.
 *
 * `core-schemas` may import itself and nothing else. The `switch` this gate
 * replaced granted `core-schemas -> core` through a `case` fall-through shared
 * with `core`, and the spine grants no such edge: line 150 reads "`core/`
 * imports `core/schemas` and nothing else outside itself" and line 593 repeats
 * it as "core/ # pure; imports core/schemas only", both of which bound what
 * `core/` reaches and neither of which says anything about the reverse. No file
 * under `src/core/schemas/` reaches outside that directory, so narrowing it
 * changes no verdict.
 *
 * Each layer names itself in `imports` where a same-layer import is allowed.
 * `root` is one file, so it names nothing and its self-edge is unconstructible.
 */
const SECTION = DependencyDirectionSection.parse({
	roots: [{ path: 'src', extensions: ['.ts'] }],
	layers: [
		{
			name: 'root',
			match: 'exact',
			path: 'src/index.ts',
			label: 'src/index.ts',
			imports: ['application', 'core-schemas'],
		},
		{
			name: 'core-schemas',
			match: 'prefix',
			path: 'src/core/schemas/',
			label: 'core/schemas',
			imports: ['core-schemas'],
			externals: { policy: 'allow', modules: ['zod'], rule: ZOD_RULE },
		},
		{
			name: 'core',
			match: 'prefix',
			path: 'src/core/',
			label: 'core/ (excluding core/schemas)',
			imports: ['core', 'core-schemas'],
			externals: { policy: 'deny', rule: CORE_RULE },
		},
		{
			name: 'ports',
			match: 'prefix',
			path: 'src/ports/',
			label: 'ports/',
			imports: ['ports', 'core-schemas'],
			externals: { policy: 'deny', rule: PORTS_RULE },
		},
		{
			name: 'application',
			match: 'prefix',
			path: 'src/application/',
			label: 'application/',
			imports: ['application', 'core', 'core-schemas', 'ports'],
		},
		{
			name: 'adapters',
			match: 'prefix',
			path: 'src/adapters/',
			label: 'adapters/',
			imports: ['adapters', 'ports', 'core-schemas'],
		},
		{
			name: 'testing',
			match: 'prefix',
			path: 'src/testing/',
			label: 'testing/',
			imports: ['testing', 'ports', 'core-schemas'],
			externals: { policy: 'deny', rule: TESTING_RULE },
		},
		{
			name: 'cli',
			match: 'prefix',
			path: 'src/cli/',
			label: 'cli/',
			imports: ['cli', 'application', 'adapters'],
		},
	],
	exemptions: [
		{
			file: 'src/core/canonical/digest.ts',
			module: 'node:crypto',
			binding: 'createHash',
			rule: EXEMPTION_RULE,
		},
	],
	purity: {
		layers: ['core', 'core-schemas'],
		awaitRule:
			'no AwaitExpression under core/; application/ is the only layer that awaits a port',
		asyncFunctionRule:
			'no async function under core/; core stages are synchronous',
		newDateRule: 'no clock read under core/ (AD-1): new Date() is impurity',
		members: IMPURE_MEMBERS.map(({ member, category }) => ({
			member,
			rule: `no ${category} under core/ (AD-1): ${member} is impurity`,
		})),
	},
})

const GRAPH = compileGraph(SECTION)

const scan = (
	files: ReadonlyMap<string, string>,
	graph: DirectionGraph = GRAPH,
) => scanSources(files, graph)

type LayerName =
	| 'core-schemas'
	| 'core'
	| 'ports'
	| 'application'
	| 'adapters'
	| 'testing'
	| 'cli'
	| 'root'

// One canonical "self" file per layer, plus a distinct "other" file for
// same-layer edges (a file can't import itself). `core`'s two files sit in
// different submodules (compile/, seal/) on purpose: that is the shape the
// spine names as an allowed same-layer import.
const SELF: Record<LayerName, string> = {
	'core-schemas': 'src/core/schemas/alpha.ts',
	core: 'src/core/compile/alpha.ts',
	ports: 'src/ports/alpha.ts',
	application: 'src/application/alpha.ts',
	adapters: 'src/adapters/alpha.ts',
	testing: 'src/testing/alpha.ts',
	cli: 'src/cli/alpha.ts',
	root: 'src/index.ts',
}

const OTHER: Record<LayerName, string> = {
	'core-schemas': 'src/core/schemas/beta.ts',
	core: 'src/core/seal/beta.ts',
	ports: 'src/ports/beta.ts',
	application: 'src/application/beta.ts',
	adapters: 'src/adapters/beta.ts',
	testing: 'src/testing/beta.ts',
	cli: 'src/cli/beta.ts',
	root: 'src/index.ts', // root is exactly one file; never used as a same-layer target
}

const LAYERS = Object.keys(SELF) as LayerName[]

const ALLOWED: Record<LayerName, ReadonlySet<LayerName>> = {
	'core-schemas': new Set<LayerName>(['core-schemas']),
	core: new Set<LayerName>(['core', 'core-schemas']),
	ports: new Set<LayerName>(['ports', 'core-schemas']),
	application: new Set<LayerName>([
		'application',
		'core',
		'core-schemas',
		'ports',
	]),
	adapters: new Set<LayerName>(['adapters', 'ports', 'core-schemas']),
	testing: new Set<LayerName>(['testing', 'ports', 'core-schemas']),
	cli: new Set<LayerName>(['cli', 'application', 'adapters']),
	root: new Set<LayerName>(['application', 'core-schemas']),
}

function relSpecifier(fromFile: string, toFile: string): string {
	const rel = posix.relative(posix.dirname(fromFile), toFile)
	return rel.startsWith('.') ? rel : `./${rel}`
}

/** A minimal two-file in-memory source map: `importer` imports `target` via `statement`, and `target` is an inert module with nothing of its own to check. */
function twoFileMap(
	importer: string,
	importerSource: string,
	target: string,
	targetSource = 'export const value = 1\n',
): Map<string, string> {
	return new Map([
		[importer, importerSource],
		[target, targetSource],
	])
}

describe('dependency-direction: every allowed edge, every forbidden edge', () => {
	for (const from of LAYERS) {
		for (const to of LAYERS) {
			if (from === 'root' && to === 'root') continue // one file; no self-edge to construct
			const allowed = ALLOWED[from].has(to)
			const importer = SELF[from]
			const target = from === to ? OTHER[to] : SELF[to]
			const specifier = relSpecifier(importer, target)

			it(`${allowed ? 'allows' : 'rejects'} ${from} -> ${to} (${importer} importing ${target})`, () => {
				const files = twoFileMap(
					importer,
					`import { value } from '${specifier}'\n`,
					target,
				)
				const violations = scan(files)
				if (allowed) {
					expect(violations).toEqual([])
				} else {
					expect(violations).toHaveLength(1)
					expect(violations[0]?.file).toBe(importer)
					expect(violations[0]?.specifier).toBe(specifier)
				}
			})
		}
	}
})

describe('dependency-direction: core/schemas may not import core/', () => {
	// The `switch` this gate replaced granted this edge through a `case`
	// fall-through it shared with `core`. Nothing in the spine grants it and no
	// file exercises it, so the configuration omits it and this case pins that
	// the omission is enforcement rather than an oversight.
	it('rejects core-schemas -> core, which the switch granted and the spine never did', () => {
		const importer = SELF['core-schemas']
		const target = SELF.core
		const specifier = relSpecifier(importer, target)
		const files = twoFileMap(
			importer,
			`import { value } from '${specifier}'\n`,
			target,
		)
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toBe(
			'core/schemas may not import core/ (excluding core/schemas)',
		)
	})

	it('still allows core -> core-schemas, which both spine sentences state', () => {
		const importer = SELF.core
		const target = SELF['core-schemas']
		const files = twoFileMap(
			importer,
			`import { value } from '${relSpecifier(importer, target)}'\n`,
			target,
		)
		expect(scan(files)).toEqual([])
	})
})

describe('dependency-direction: type-only imports are checked under the same rules as value imports', () => {
	it('a type-only import across a forbidden edge (ports -> core, non-schema) is still rejected', () => {
		const importer = 'src/ports/alpha.ts'
		const target = 'src/core/compile/alpha.ts'
		const files = twoFileMap(
			importer,
			`import type { Value } from '${relSpecifier(importer, target)}'\n`,
			target,
		)
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.specifier).toBe(relSpecifier(importer, target))
	})

	it('a type-only import across an allowed edge (application -> core) is not flagged', () => {
		const importer = 'src/application/alpha.ts'
		const target = 'src/core/compile/alpha.ts'
		const files = twoFileMap(
			importer,
			`import type { Value } from '${relSpecifier(importer, target)}'\n`,
			target,
		)
		expect(scan(files)).toEqual([])
	})
})

describe('dependency-direction: re-exports are checked under the same rules as imports', () => {
	const importer = 'src/ports/alpha.ts'
	const target = 'src/core/compile/alpha.ts' // ports -> core (non-schema) is forbidden

	it('export * from a forbidden target is rejected', () => {
		const files = twoFileMap(
			importer,
			`export * from '${relSpecifier(importer, target)}'\n`,
			target,
		)
		expect(scan(files)).toHaveLength(1)
	})

	it('export { x } from a forbidden target is rejected', () => {
		const files = twoFileMap(
			importer,
			`export { value } from '${relSpecifier(importer, target)}'\n`,
			target,
		)
		expect(scan(files)).toHaveLength(1)
	})

	it('export type { X } from a forbidden target is rejected', () => {
		const files = twoFileMap(
			importer,
			`export type { Value } from '${relSpecifier(importer, target)}'\n`,
			target,
		)
		expect(scan(files)).toHaveLength(1)
	})

	it('a local re-declaration (export { x } with no "from") is not a re-export and is never flagged', () => {
		const files = new Map([[importer, 'const value = 1\nexport { value }\n']])
		expect(scan(files)).toEqual([])
	})

	it('a plain declaration export is never flagged', () => {
		const files = new Map([
			[importer, 'export function helper(): number {\n\treturn 1\n}\n'],
		])
		expect(scan(files)).toEqual([])
	})
})

describe('dependency-direction: dynamic import()', () => {
	it('a literal dynamic import across an allowed edge (cli -> application) is not flagged', () => {
		const importer = 'src/cli/alpha.ts'
		const target = 'src/application/alpha.ts'
		const files = twoFileMap(
			importer,
			`export async function load() {\n\treturn import('${relSpecifier(importer, target)}')\n}\n`,
			target,
		)
		expect(scan(files)).toEqual([])
	})

	it('a literal dynamic import across a forbidden edge (cli -> core) is rejected', () => {
		const importer = 'src/cli/alpha.ts'
		const target = 'src/core/compile/alpha.ts'
		const specifier = relSpecifier(importer, target)
		const files = twoFileMap(
			importer,
			`export async function load() {\n\treturn import('${specifier}')\n}\n`,
			target,
		)
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.specifier).toBe(specifier)
	})

	it('a non-literal dynamic import argument is rejected regardless of layer', () => {
		const importer = 'src/application/alpha.ts'
		const files = new Map([
			[
				importer,
				"const path = './alpha.ts'\nexport function load() {\n\treturn import(path)\n}\n",
			],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('string literal')
	})
})

describe('dependency-direction: import-equals and require under commonjs "forbid"', () => {
	// `import Foo = require('...')` is TypeScript's CommonJS-interop
	// import-equals form: it contains both a prohibited import-equals
	// declaration and a prohibited `require(` call at the token level, so the
	// scanner flags each independently. Two true findings, each reported once.
	it('import X = require(...) is rejected on both grounds: import-equals and CommonJS require', () => {
		const importer = 'src/application/alpha.ts'
		const target = 'src/core/compile/alpha.ts'
		const specifier = relSpecifier(importer, target)
		const files = twoFileMap(
			importer,
			`import Foo = require('${specifier}')\n`,
			target,
		)
		const violations = scan(files)
		expect(violations).toHaveLength(2)
		const rules = violations.map((v) => v.rule)
		expect(rules.some((r) => r.includes('import-equals'))).toBe(true)
		expect(rules.some((r) => r.includes('CommonJS require'))).toBe(true)
	})

	it('import type X = require(...) is rejected the same way', () => {
		const importer = 'src/application/alpha.ts'
		const target = 'src/core/compile/alpha.ts'
		const specifier = relSpecifier(importer, target)
		const files = twoFileMap(
			importer,
			`import type Foo = require('${specifier}')\n`,
			target,
		)
		expect(scan(files)).toHaveLength(2)
	})

	it('CommonJS require(...) is rejected', () => {
		const importer = 'src/application/alpha.ts'
		const files = new Map([[importer, "const mod = require('./alpha.ts')\n"]])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('CommonJS require')
	})

	it("require?.('...') is rejected the same as require('...')", () => {
		const files = new Map([
			[
				'src/application/alpha.ts',
				"declare const require: (id: string) => unknown\nconst mod = require?.('./alpha.ts')\n",
			],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('CommonJS require')
	})
})

describe('dependency-direction: commonjs "check" reads require() as an edge', () => {
	// A tree with CommonJS files needs its require() calls held to the layer
	// rules. Waving them through instead would walk a .cjs tree, find no import
	// statement anywhere in it, and report a clean pass over files whose every
	// dependency it declined to read.
	const CJS = compileGraph(
		DependencyDirectionSection.parse({
			roots: [{ path: 'lib', extensions: ['.cjs'] }],
			commonjs: 'check',
			layers: [
				{
					name: 'inner',
					match: 'prefix',
					path: 'lib/inner/',
					imports: ['inner'],
				},
				{
					name: 'outer',
					match: 'prefix',
					path: 'lib/outer/',
					imports: ['outer', 'inner'],
				},
			],
		}),
	)

	it('a require() across an allowed edge is not flagged', () => {
		const files = new Map([
			['lib/outer/a.cjs', "const inner = require('../inner/b.cjs')\n"],
			['lib/inner/b.cjs', 'module.exports = 1\n'],
		])
		expect(scan(files, CJS)).toEqual([])
	})

	it('a require() across a forbidden edge is rejected as a forbidden edge', () => {
		const files = new Map([
			['lib/inner/b.cjs', "const outer = require('../outer/a.cjs')\n"],
			['lib/outer/a.cjs', 'module.exports = 1\n'],
		])
		const violations = scan(files, CJS)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toBe('inner may not import outer')
	})

	it('a non-literal require() argument is rejected rather than skipped', () => {
		const files = new Map([
			['lib/outer/a.cjs', "const id = './b.cjs'\nconst m = require(id)\n"],
			['lib/outer/b.cjs', 'module.exports = 1\n'],
		])
		const violations = scan(files, CJS)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('string literal')
	})

	it('import x = require(...) is counted once, as the edge its require carries', () => {
		const files = new Map([
			['lib/inner/b.cjs', "import outer = require('../outer/a.cjs')\n"],
			['lib/outer/a.cjs', 'module.exports = 1\n'],
		])
		const violations = scan(files, CJS)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toBe('inner may not import outer')
	})
})

describe('dependency-direction: triple-slash reference directives are dependencies with no import statement', () => {
	// TypeScript honours a reference directive only in a file's leading trivia,
	// and the tokenizer skips trivia by construction, so an edge written this way
	// produced no token for any import rule to see.
	it('a reference path across a forbidden edge is rejected', () => {
		const importer = 'src/ports/alpha.ts'
		const target = 'src/core/compile/alpha.ts'
		const files = twoFileMap(
			importer,
			'/// <reference path="../core/compile/alpha.ts" />\nexport const value = 1\n',
			target,
		)
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.line).toBe(1)
		expect(violations[0]?.rule).toBe(
			'ports/ may not depend on core/ (excluding core/schemas); a triple-slash reference directive is a dependency with no import statement',
		)
	})

	it('a reference path across an allowed edge is not flagged, so the edge is what the rule binds', () => {
		const importer = 'src/application/alpha.ts'
		const target = 'src/core/compile/alpha.ts'
		const files = twoFileMap(
			importer,
			'/// <reference path="../core/compile/alpha.ts" />\nexport const value = 1\n',
			target,
		)
		expect(scan(files)).toEqual([])
	})

	it('a reference path leaving the declared roots is rejected', () => {
		const files = new Map([
			[
				'src/core/compile/alpha.ts',
				'/// <reference path="../../../outside.ts" />\nexport const x = 1\n',
			],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('escapes the declared scan roots')
	})

	it('a reference path that resolves to no scanned file is rejected', () => {
		const files = new Map([
			[
				'src/core/compile/alpha.ts',
				'/// <reference path="./missing.ts" />\nexport const x = 1\n',
			],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('does not resolve')
	})

	it('a reference types= directive is held to the layer external policy', () => {
		const files = new Map([
			[
				'src/core/compile/alpha.ts',
				'/// <reference types="node" />\nexport const x = 1\n',
			],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.specifier).toBe('node')
		expect(violations[0]?.rule).toBe(
			`${CORE_RULE}; reached through a triple-slash reference directive rather than an import`,
		)
	})

	it('a reference types= naming an allowlisted module is not flagged', () => {
		const files = new Map([
			[
				'src/core/schemas/alpha.ts',
				'/// <reference types="zod" />\nexport const x = 1\n',
			],
		])
		expect(scan(files)).toEqual([])
	})

	it('a reference lib= names a TypeScript library file, not a module, and is never flagged', () => {
		const files = new Map([
			[
				'src/core/compile/alpha.ts',
				'/// <reference lib="es2022" />\nexport const x = 1\n',
			],
		])
		expect(scan(files)).toEqual([])
	})

	it('a reference directive carrying no attribute this gate reads is reported rather than skipped', () => {
		const files = new Map([
			[
				'src/core/compile/alpha.ts',
				'/// <reference unknownattr="x" />\nexport const x = 1\n',
			],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain(
			'could not read this triple-slash reference directive',
		)
	})

	it('a directive after the first statement is not leading trivia, TypeScript ignores it, and so does this gate', () => {
		const importer = 'src/ports/alpha.ts'
		const target = 'src/core/compile/alpha.ts'
		const files = twoFileMap(
			importer,
			'export const value = 1\n/// <reference path="../core/compile/alpha.ts" />\n',
			target,
		)
		expect(scan(files)).toEqual([])
	})

	it('a file that is nothing but a directive is still scanned', () => {
		const importer = 'src/ports/alpha.ts'
		const target = 'src/core/compile/alpha.ts'
		const files = twoFileMap(
			importer,
			'/// <reference path="../core/compile/alpha.ts" />\n',
			target,
		)
		expect(scan(files)).toHaveLength(1)
	})
})

describe('dependency-direction: import analysis fails closed', () => {
	it('a relative import that does not resolve to a source file in the scanned set is rejected', () => {
		const importer = 'src/core/compile/alpha.ts'
		const files = new Map([
			[importer, "import { value } from './missing.ts'\n"],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('does not resolve')
	})

	it('a relative import escaping the declared roots is rejected', () => {
		const importer = 'src/core/compile/alpha.ts'
		const files = new Map([
			[importer, "import { value } from '../../../outside.ts'\n"],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('escapes the declared scan roots')
	})

	it('an import whose specifier is not a plain string literal is reported, never skipped', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'import { value } from `./beta.ts`\n'],
			['src/core/compile/beta.ts', 'export const value = 1\n'],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('could not determine')
	})

	it('a re-export whose specifier is not a plain string literal is reported, never skipped', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'export * from `./beta.ts`\n'],
			['src/core/compile/beta.ts', 'export const value = 1\n'],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('could not determine')
	})

	it('import.meta is a meta-property, not an import declaration, and is never reported', () => {
		const files = new Map([
			['src/cli/alpha.ts', 'export const here = import.meta.url\n'],
		])
		expect(scan(files)).toEqual([])
	})
})

describe('dependency-direction: external module and Node builtin policy', () => {
	it('core/schemas may import "zod"', () => {
		const files = new Map([
			['src/core/schemas/alpha.ts', "import { z } from 'zod'\n"],
		])
		expect(scan(files)).toEqual([])
	})

	it('an allowlist entry is matched by exact string equality, so a subpath of it is refused', () => {
		const files = new Map([
			['src/core/schemas/alpha.ts', "import { z } from 'zod/v4'\n"],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toBe(ZOD_RULE)
	})

	it('core/schemas importing any other external module is rejected', () => {
		const files = new Map([
			['src/core/schemas/alpha.ts', "import lodash from 'lodash'\n"],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toBe(ZOD_RULE)
	})

	it('core/ (excluding core/schemas) importing "zod" directly is rejected; only core/schemas is the Zod boundary', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', "import { z } from 'zod'\n"],
		])
		expect(scan(files)).toHaveLength(1)
	})

	it.each([
		'node:fs',
		'node:child_process',
		'node:net',
		'node:http',
		'node:https',
	])('core/ importing "%s" is rejected', (builtin) => {
		const files = new Map([
			['src/core/compile/alpha.ts', `import { x } from '${builtin}'\n`],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.specifier).toBe(builtin)
	})

	it.each(['zod', 'node:fs', 'node:crypto'])(
		'ports/ importing "%s" is rejected',
		(specifier) => {
			const files = new Map([
				['src/ports/alpha.ts', `import { x } from '${specifier}'\n`],
			])
			const violations = scan(files)
			expect(violations).toHaveLength(1)
			expect(violations[0]?.specifier).toBe(specifier)
			expect(violations[0]?.rule).toBe(PORTS_RULE)
		},
	)

	it.each(['vitest', 'node:http', 'zod'])(
		'testing/ importing "%s" is rejected; the published conformance suite is framework-free',
		(specifier) => {
			const files = new Map([
				['src/testing/x.ts', `import { x } from '${specifier}'\n`],
			])
			const violations = scan(files)
			expect(violations).toHaveLength(1)
			expect(violations[0]?.specifier).toBe(specifier)
			expect(violations[0]?.rule).toBe(TESTING_RULE)
		},
	)

	it.each(['src/adapters/alpha.ts', 'src/cli/alpha.ts'])(
		'%s may import a Node builtin; that layer exists to reach I/O',
		(file) => {
			const files = new Map([[file, "import { readFile } from 'node:fs'\n"]])
			expect(scan(files)).toEqual([])
		},
	)
})

describe('dependency-direction: the exemption is one file, one module, one binding', () => {
	it('digest.ts may import exactly { createHash } from node:crypto', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				"import { createHash } from 'node:crypto'\n",
			],
		])
		expect(scan(files)).toEqual([])
	})

	it('digest.ts may import { createHash as h } from node:crypto', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				"import { createHash as h } from 'node:crypto'\n",
			],
		])
		expect(scan(files)).toEqual([])
	})

	it('a trailing comma inside the clause is punctuation and stays allowed', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				"import {\n\tcreateHash,\n} from 'node:crypto'\n",
			],
		])
		expect(scan(files)).toEqual([])
	})

	it('a type-only { createHash } import stays allowed', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				"import type { createHash } from 'node:crypto'\n",
			],
		])
		expect(scan(files)).toEqual([])
	})

	it('a namespace import of node:crypto is rejected, including in digest.ts itself', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				"import * as crypto from 'node:crypto'\n",
			],
		])
		expect(scan(files).map((entry) => entry.rule)).toEqual([EXEMPTION_RULE])
	})

	it('digest.ts importing a default binding alongside { createHash } is rejected', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				"import crypto, { createHash } from 'node:crypto'\n",
			],
		])
		expect(scan(files).map((entry) => entry.rule)).toEqual([EXEMPTION_RULE])
	})

	it('digest.ts importing createHash alongside another binding is rejected', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				"import { createHash, randomBytes } from 'node:crypto'\n",
			],
		])
		expect(scan(files).map((entry) => entry.rule)).toEqual([EXEMPTION_RULE])
	})

	it('a different core/ file importing { createHash } from node:crypto is rejected; the exemption is one file', () => {
		const files = new Map([
			[
				'src/core/compile/alpha.ts',
				"import { createHash } from 'node:crypto'\n",
			],
		])
		expect(scan(files).map((entry) => entry.rule)).toEqual([CORE_RULE])
	})

	// The exemption reaches an import declaration and nothing else, because a
	// re-export, a dynamic import and a reference directive all arrive with no
	// clause tokens and none of them can be held to a binding list. That was an
	// emergent property of the plumbing rather than a stated rule, which meant a
	// refactor threading the tokens everywhere would have widened a
	// security-adjacent exemption silently. These cases make it a decision. Each
	// asserts the exemption's own rule string: a count alone would pass on any
	// violation, and the awaited form of the dynamic import raises the purity ban
	// as well, so a count would have let that case pass for the wrong reason.
	it('digest.ts may not reach the exemption through a re-export', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				"export { createHash } from 'node:crypto'\n",
			],
		])
		expect(scan(files).map((entry) => entry.rule)).toEqual([EXEMPTION_RULE])
	})

	it('digest.ts may not reach the exemption through a dynamic import', () => {
		const files = new Map([
			['src/core/canonical/digest.ts', "const p = import('node:crypto')\n"],
		])
		expect(scan(files).map((entry) => entry.rule)).toEqual([EXEMPTION_RULE])
	})

	it('digest.ts may not reach the exemption through a reference directive', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				'/// <reference types="node:crypto" />\nexport const x = 1\n',
			],
		])
		expect(scan(files).map((entry) => entry.rule)).toEqual([
			`${EXEMPTION_RULE}; reached through a triple-slash reference directive rather than an import`,
		])
	})
})

describe('dependency-direction: purity under core/ (AD-1, AD-34)', () => {
	it('Date.now() under core/ is rejected', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'export const x = Date.now()\n'],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('clock read')
	})

	it('new Date() under core/ is rejected', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'export const x = new Date()\n'],
		])
		expect(scan(files)).toHaveLength(1)
	})

	it('Math.random() under core/ is rejected', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'export const x = Math.random()\n'],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('randomness')
	})

	it('Date.now() and Math.random() outside the purity scope are not flagged', () => {
		const files = new Map([
			[
				'src/adapters/alpha.ts',
				'export const x = Date.now()\nexport const y = Math.random()\n',
			],
		])
		expect(scan(files)).toEqual([])
	})

	it.each([
		['crypto.randomUUID()', 'randomness'],
		['crypto.getRandomValues(new Uint8Array(1))', 'randomness'],
		['crypto.randomBytes(4)', 'randomness'],
		['crypto.webcrypto.getRandomValues(new Uint8Array(1))', 'randomness'],
		['performance.now()', 'clock read'],
	])(
		'%s under core/ is rejected; an ambient global needs no import, so only the member table can see it',
		(expression, category) => {
			const files = new Map([
				['src/core/compile/alpha.ts', `export const x = ${expression}\n`],
			])
			const violations = scan(files)
			expect(violations).toHaveLength(1)
			expect(violations[0]?.rule).toContain(category)
		},
	)

	it('the same ambient globals outside the purity scope are not flagged', () => {
		const files = new Map([
			[
				'src/adapters/alpha.ts',
				'export const x = crypto.randomUUID()\nexport const y = performance.now()\n',
			],
		])
		expect(scan(files)).toEqual([])
	})

	it('an async function declaration under core/ is rejected', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'export async function f() {}\n'],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('async')
	})

	it('an async arrow function under core/ is rejected', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'export const f = async () => 1\n'],
		])
		expect(scan(files)).toHaveLength(1)
	})

	it.each([
		['async method', 'export const obj = {\n\tasync method() {},\n}\n'],
		['async generator method', 'export const o = {\n\tasync *gen() {},\n}\n'],
		[
			'computed-name async method',
			"export const o = {\n\tasync ['k']() {},\n}\n",
		],
		['quoted-name async method', "export const o = {\n\tasync 'k'() {},\n}\n"],
		['async generator declaration', 'export async function* gen() {}\n'],
	])('%s under core/ is rejected', (_label, source) => {
		const files = new Map([['src/core/compile/alpha.ts', source]])
		expect(scan(files)).toHaveLength(1)
	})

	// The async detector is a structural disambiguator and stays built in for
	// that reason: TypeScript emits `AsyncKeyword` for the text "async"
	// unconditionally, because it is only a contextual keyword, so a table of
	// banned words would fail these two cases and no configuration could repair
	// it.
	it('"async" used as a bare identifier under core/ is not a false positive', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'const async = 5\nexport { async }\n'],
		])
		expect(scan(files)).toEqual([])
	})

	it('an index access on a variable named async is not a false positive', () => {
		const files = new Map([
			[
				'src/core/compile/alpha.ts',
				'const async = [1]\nexport const first = async[0]\n',
			],
		])
		expect(scan(files)).toEqual([])
	})

	it('a top-level AwaitExpression under core/ is rejected', () => {
		const files = new Map([
			[
				'src/core/compile/alpha.ts',
				'export const x = await Promise.resolve(1)\n',
			],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('AwaitExpression')
	})

	it('adapters/ may await freely while implementing a port', () => {
		const files = new Map([
			[
				'src/adapters/alpha.ts',
				'export async function load() {\n\treturn await Promise.resolve(1)\n}\n',
			],
		])
		expect(scan(files)).toEqual([])
	})

	it('the words "async" and "await" inside a string or comment never trigger a purity violation; this is a token scan', () => {
		const files = new Map([
			[
				'src/core/compile/alpha.ts',
				"// async and await are just words in this comment\nexport const s = 'please do not await this string'\n",
			],
		])
		expect(scan(files)).toEqual([])
	})
})

describe('dependency-direction: all violations in one scan are collected, not just the first', () => {
	it('a single file combining a forbidden import and a purity violation reports both', () => {
		const importer = 'src/core/compile/alpha.ts'
		const target = 'src/application/alpha.ts' // core -> application is forbidden
		const files = twoFileMap(
			importer,
			`import { value } from '${relSpecifier(importer, target)}'\nexport const x = Math.random()\n`,
			target,
		)
		expect(scan(files)).toHaveLength(2)
	})

	it('violations across multiple files in one scan are all reported', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'export const x = Date.now()\n'],
			['src/core/seal/beta.ts', 'export const y = Math.random()\n'],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(2)
		expect(violations.map((v) => v.file).sort()).toEqual([
			'src/core/compile/alpha.ts',
			'src/core/seal/beta.ts',
		])
	})
})

describe('dependency-direction: every file under a scan root belongs to a declared layer', () => {
	it('a file under a root outside every layer is rejected rather than silently skipped', () => {
		const files = new Map([
			[
				'src/loose.ts',
				"import fs from 'node:fs'\nexport const x = Math.random()\n",
			],
		])
		const violations = scan(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('no declared layer')
	})
})

describe('dependency-direction: the layer list is ordered and the schema holds it that way', () => {
	type RawSection = {
		roots: { path: string; extensions: string[] }[]
		layers: { name: string; path: string; imports: string[] }[]
		exemptions: {
			file: string
			module: string
			binding: string
			rule: string
		}[]
	}

	const raw = (): RawSection =>
		JSON.parse(JSON.stringify(SECTION)) as RawSection

	const refused = (section: RawSection, contains: string): void => {
		const result = DependencyDirectionSection.safeParse(section)
		expect(result.success).toBe(false)
		expect(JSON.stringify(result.error?.issues)).toContain(contains)
	}

	it('refuses a wider prefix listed before a narrower one, so the swap is a configuration error rather than a quiet re-layering', () => {
		const section = raw()
		const narrow = section.layers.findIndex(
			(layer) => layer.name === 'core-schemas',
		)
		const wide = section.layers.findIndex((layer) => layer.name === 'core')
		section.layers = section.layers.map((layer, index) => {
			if (index === narrow)
				return section.layers[wide] as RawSection['layers'][number]
			if (index === wide)
				return section.layers[narrow] as RawSection['layers'][number]
			return layer
		})
		refused(section, 'unreachable')
	})

	it('refuses an imports entry naming a layer nobody declared', () => {
		const section = raw()
		section.layers[0]?.imports.push('nowhere')
		refused(section, 'not a declared layer')
	})

	it('refuses an exemption on a layer whose externals are unrestricted', () => {
		const section = raw()
		section.exemptions = [
			{
				file: 'src/cli/alpha.ts',
				module: 'node:crypto',
				binding: 'createHash',
				rule: 'the cli may reach crypto anyway',
			},
		]
		refused(section, 'unrestricted')
	})

	it('refuses a scan root nested inside another scan root', () => {
		const section = raw()
		section.roots = [
			{ path: 'src', extensions: ['.ts'] },
			{ path: 'src/cli', extensions: ['.ts'] },
		]
		refused(section, 'sits inside the root')
	})

	it('refuses a prefix layer whose path does not end in a slash', () => {
		const section = raw()
		const core = section.layers.find((layer) => layer.name === 'core')
		if (core !== undefined) core.path = 'src/core'
		refused(section, 'has to end with')
	})
})

describe('dependency-direction: the typescript peer dependency is refused by name', () => {
	it('names the missing dependency and the gate that wanted it', async () => {
		const result = await probeTypeScript(() =>
			Promise.reject(new Error('ERR_MODULE_NOT_FOUND')),
		)
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.message).toContain('"typescript"')
		expect(result.message).toContain('dependency-direction')
		expect(result.message).toContain('No other gate needs it')
	})

	it('resolves here, where typescript is installed', async () => {
		expect((await probeTypeScript()).ok).toBe(true)
	})

	it('exports a code for the binary to map to an exit status', () => {
		expect(TYPESCRIPT_PEER_MISSING).toBe('EVAL_QUALITY_TYPESCRIPT_PEER_MISSING')
	})
})

describe('dependency-direction: this repository runs the gate on its own tree', () => {
	const configPath = fileURLToPath(
		new URL('../../eval-quality.config.json', import.meta.url),
	)

	async function repositorySection(): Promise<DependencyDirectionConfig> {
		const document = JSON.parse(await readFile(configPath, 'utf8')) as Record<
			string,
			unknown
		>
		const raw = document['dependency-direction']
		if (raw === undefined) {
			throw new Error(
				`${configPath} declares no "dependency-direction" section; this repository holds its own layer graph there, like any other consumer`,
			)
		}
		return DependencyDirectionSection.parse(raw)
	}

	it('parses its own section against the published schema', async () => {
		const section = await repositorySection()
		expect(section.layers.length).toBeGreaterThan(0)
	})

	it('scans every file under its declared roots with zero violations', async () => {
		const section = await repositorySection()
		const files = await discoverSourceFiles(repoRoot, section.roots)
		expect(files.size).toBeGreaterThan(0)
		const violations = scanSources(files, compileGraph(section))
		expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
	})

	it('places every discovered file in a declared layer, so none is silently skipped', async () => {
		const section = await repositorySection()
		const graph = compileGraph(section)
		const files = await discoverSourceFiles(repoRoot, section.roots)
		const unplaced = [...files.keys()].filter(
			(file) => classifyLayer(file, graph.layers) === undefined,
		)
		expect(unplaced).toEqual([])
	})

	// The ordering witness. Two layer rows nest: every file under the narrower
	// prefix also sits under the wider one, and only the list order decides which
	// rules hold it. Swapping them is the mistake a maintainer makes by
	// normalising the list into a map keyed by layer name, where there is no
	// order left to get right. This is what that costs, measured.
	it(`reports exactly ${ORDERING_WITNESS_VIOLATIONS} violations when the two nesting layer rows are swapped`, async () => {
		const section = await repositorySection()
		const nesting = section.layers.flatMap((narrow, narrowIndex) =>
			section.layers.flatMap((wide, wideIndex) =>
				narrowIndex < wideIndex &&
				narrow.match === 'prefix' &&
				wide.match === 'prefix' &&
				narrow.path.startsWith(wide.path)
					? [[narrowIndex, wideIndex] as const]
					: [],
			),
		)
		expect(nesting).toHaveLength(1)
		const [narrowIndex, wideIndex] = nesting[0] as readonly [number, number]

		const layers = [...section.layers]
		const narrow = layers[narrowIndex]
		const wide = layers[wideIndex]
		if (narrow === undefined || wide === undefined)
			throw new Error('unreachable')
		layers[narrowIndex] = wide
		layers[wideIndex] = narrow

		const files = await discoverSourceFiles(repoRoot, section.roots)
		const violations = scanSources(files, compileGraph({ ...section, layers }))
		expect(violations).toHaveLength(ORDERING_WITNESS_VIOLATIONS)
	})

	it('runs through the published entry point and reports a clean pass', async () => {
		const outcome = await runDependencyDirection({
			section: await repositorySection(),
			root: repoRoot,
			configPath,
		})
		expect(outcome.kind).toBe('report')
		if (outcome.kind !== 'report') return
		expect(outcome.violations).toEqual([])
		expect(outcome.failed).toBe(false)
		expect(outcome.summary).toContain('0 violations')
	})

	// Report-only is a declared mode rather than an exit code a caller may
	// ignore, and its whole purpose is showing a consumer the size of the problem
	// before it commits to fixing it. A run that could produce nothing would make
	// that unsatisfiable in a way nobody notices, so the summary carries the count
	// on every outcome, zero included.
	it('report-only exits clean and still states its count', async () => {
		const section = await repositorySection()
		const outcome = await runDependencyDirection({
			section: { ...section, reportOnly: true },
			root: repoRoot,
			configPath,
		})
		expect(outcome.kind).toBe('report')
		if (outcome.kind !== 'report') return
		expect(outcome.reportOnly).toBe(true)
		expect(outcome.failed).toBe(false)
		expect(outcome.summary).toContain('report-only')
		expect(outcome.summary).toContain('0 violation(s)')
		expect(outcome.summary).toContain('did not fail')
	})

	it('refuses a declared root that is not there, rather than scanning what is left', async () => {
		const section = await repositorySection()
		const outcome = await runDependencyDirection({
			section: {
				...section,
				roots: [
					...section.roots,
					{ path: 'not-a-directory', extensions: ['.ts'] },
				],
			},
			root: repoRoot,
			configPath,
		})
		expect(outcome.kind).toBe('refused')
		if (outcome.kind !== 'refused') return
		expect(outcome.message).toContain('not-a-directory')
	})
})

describe('dependency-direction: the walk fails closed', () => {
	it('rejects a declared root that holds no matching file, rather than reporting a clean scan of nothing', async () => {
		const root = await mkdtemp(join(tmpdir(), 'dependency-direction-'))
		try {
			await mkdir(join(root, 'src'))
			await expect(
				discoverSourceFiles(root, [{ path: 'src', extensions: ['.ts'] }]),
			).rejects.toThrow(/holds no \.ts file/)
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	it('names the root it could not walk', async () => {
		const root = await mkdtemp(join(tmpdir(), 'dependency-direction-'))
		try {
			await expect(
				discoverSourceFiles(root, [{ path: 'absent', extensions: ['.ts'] }]),
			).rejects.toThrow(/"absent"/)
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})
})
