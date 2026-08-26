/**
 * AC 6: proves `scanSources` rejects every forbidden edge and construct this
 * story names, and accepts every allowed edge, via in-memory synthetic
 * source snippets rather than mutating the real repository tree. The final
 * describe block runs the real repository scan as a smoke check; the
 * synthetic fixtures above it are what prove the checker actually rejects a
 * mutation.
 */
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Layer } from '../../scripts/dependency-direction.ts'
import {
	classifyLayer,
	scanSources,
} from '../../scripts/dependency-direction.ts'
import { discoverSourceFiles } from '../../scripts/discover-source-files.ts'

// One canonical "self" file per layer, plus a distinct "other" file for
// same-layer edges (a file can't import itself). `core`'s two files sit in
// different submodules (compile/, seal/) on purpose: that is the shape the
// architecture-spine clarification (AC 1 item 7) names as an allowed
// same-layer import, proven by the `core -> core` matrix entry below.
const SELF: Record<Layer, string> = {
	'core-schemas': 'src/core/schemas/alpha.ts',
	core: 'src/core/compile/alpha.ts',
	ports: 'src/ports/alpha.ts',
	application: 'src/application/alpha.ts',
	adapters: 'src/adapters/alpha.ts',
	testing: 'src/testing/alpha.ts',
	cli: 'src/cli/alpha.ts',
	root: 'src/index.ts',
}

const OTHER: Record<Layer, string> = {
	'core-schemas': 'src/core/schemas/beta.ts',
	core: 'src/core/seal/beta.ts',
	ports: 'src/ports/beta.ts',
	application: 'src/application/beta.ts',
	adapters: 'src/adapters/beta.ts',
	testing: 'src/testing/beta.ts',
	cli: 'src/cli/beta.ts',
	root: 'src/index.ts', // root is exactly one file; never used as a same-layer target
}

const LAYERS = Object.keys(SELF) as Layer[]

// The allowed-edge graph AC 6 states (items 1-7) plus Story 6.1 AC 10's
// `testing` layer, written from those texts and not from `isAllowedEdge`, so
// this test asserts the specification and not the implementation checking
// itself.
//
// The self-edges are the one part no AC spells out. AC 10 says nothing about
// `application -> application` or `cli -> cli`; those cells come from Story
// 6.1's reading of the spine, which draws one node per layer and states that
// an import inside a node is a same-layer dependency. For those five cells
// this map and `isAllowedEdge` encode one idea written twice, which is the
// honest consequence of settling the ambiguity in the story. `root` is left
// out: it is a single file, so its self-edge is unconstructible and the
// generated matrix skips that cell.
//
// Absence of a cross-layer target is a prohibition: no set contains `cli`
// (item 6, "nothing may import cli/"), `testing` (nothing may import the
// published suite), or `root` (nothing imports `src/index.ts` back).
const ALLOWED: Record<Layer, ReadonlySet<Layer>> = {
	'core-schemas': new Set<Layer>(['core-schemas', 'core']),
	core: new Set<Layer>(['core', 'core-schemas']),
	ports: new Set<Layer>(['ports', 'core-schemas']),
	application: new Set<Layer>(['application', 'core', 'core-schemas', 'ports']),
	adapters: new Set<Layer>(['adapters', 'ports', 'core-schemas']),
	testing: new Set<Layer>(['testing', 'ports', 'core-schemas']),
	cli: new Set<Layer>(['cli', 'application', 'adapters']),
	root: new Set<Layer>(['application', 'core-schemas']),
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

describe('dependency-direction: every allowed edge, every forbidden edge (AC 6, items 1-7)', () => {
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
				const violations = scanSources(files)
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

describe('dependency-direction: type-only imports are checked under the same rules as value imports', () => {
	it('a type-only import across a forbidden edge (ports -> core, non-schema) is still rejected', () => {
		const importer = 'src/ports/alpha.ts'
		const target = 'src/core/compile/alpha.ts'
		const files = twoFileMap(
			importer,
			`import type { Value } from '${relSpecifier(importer, target)}'\n`,
			target,
		)
		const violations = scanSources(files)
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
		expect(scanSources(files)).toEqual([])
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
		expect(scanSources(files)).toHaveLength(1)
	})

	it('export { x } from a forbidden target is rejected', () => {
		const files = twoFileMap(
			importer,
			`export { value } from '${relSpecifier(importer, target)}'\n`,
			target,
		)
		expect(scanSources(files)).toHaveLength(1)
	})

	it('export type { X } from a forbidden target is rejected', () => {
		const files = twoFileMap(
			importer,
			`export type { Value } from '${relSpecifier(importer, target)}'\n`,
			target,
		)
		expect(scanSources(files)).toHaveLength(1)
	})

	it('a local re-declaration (export { x } with no "from") is not a re-export and is never flagged', () => {
		const files = new Map([[importer, 'const value = 1\nexport { value }\n']])
		expect(scanSources(files)).toEqual([])
	})

	it('a plain declaration export is never flagged', () => {
		const files = new Map([
			[importer, 'export function helper(): number {\n\treturn 1\n}\n'],
		])
		expect(scanSources(files)).toEqual([])
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
		expect(scanSources(files)).toEqual([])
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
		const violations = scanSources(files)
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
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('string literal')
	})
})

describe('dependency-direction: import-equals and require are prohibited under src/, regardless of edge', () => {
	// `import Foo = require('...')` is TypeScript's CommonJS-interop
	// import-equals form: it contains both a prohibited import-equals
	// declaration and a prohibited `require(` call at the token level, so the
	// scanner flags each independently. Two true findings, not a
	// double-count, per AC 6's "collect and report all violations" rule.
	it('import X = require(...) is rejected on both grounds: import-equals and CommonJS require', () => {
		const importer = 'src/application/alpha.ts'
		const target = 'src/core/compile/alpha.ts'
		const specifier = relSpecifier(importer, target)
		const files = twoFileMap(
			importer,
			`import Foo = require('${specifier}')\n`,
			target,
		)
		const violations = scanSources(files)
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
		expect(scanSources(files)).toHaveLength(2)
	})

	it('CommonJS require(...) is rejected', () => {
		const importer = 'src/application/alpha.ts'
		const files = new Map([[importer, "const mod = require('./alpha.ts')\n"]])
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('CommonJS require')
	})
})

describe('dependency-direction: import analysis fails closed', () => {
	it('a relative import that does not resolve to a source file in the scanned set is rejected', () => {
		const importer = 'src/core/compile/alpha.ts'
		const files = new Map([
			[importer, "import { value } from './missing.ts'\n"],
		])
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('does not resolve')
	})

	it('a relative import escaping src/ is rejected', () => {
		const importer = 'src/core/compile/alpha.ts'
		const files = new Map([
			[importer, "import { value } from '../../../outside.ts'\n"],
		])
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('escapes src/')
	})
})

describe('dependency-direction: external module and Node builtin allowlist under core/', () => {
	it('core/schemas may import "zod"', () => {
		const files = new Map([
			['src/core/schemas/alpha.ts', "import { z } from 'zod'\n"],
		])
		expect(scanSources(files)).toEqual([])
	})

	it('core/schemas importing any other external module is rejected', () => {
		const files = new Map([
			['src/core/schemas/alpha.ts', "import lodash from 'lodash'\n"],
		])
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('zod')
	})

	it('core/ (excluding core/schemas) importing "zod" directly is rejected — only core/schemas is the Zod boundary', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', "import { z } from 'zod'\n"],
		])
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
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
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.specifier).toBe(builtin)
	})

	it('a namespace import of node:crypto under core/ is rejected, including in digest.ts itself', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				"import * as crypto from 'node:crypto'\n",
			],
		])
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
	})

	it('digest.ts may import exactly { createHash } from node:crypto', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				"import { createHash } from 'node:crypto'\n",
			],
		])
		expect(scanSources(files)).toEqual([])
	})

	it('digest.ts may import { createHash as h } from node:crypto', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				"import { createHash as h } from 'node:crypto'\n",
			],
		])
		expect(scanSources(files)).toEqual([])
	})

	it('digest.ts importing createHash alongside another binding is rejected — the clause must be createHash alone', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				"import { createHash, randomBytes } from 'node:crypto'\n",
			],
		])
		expect(scanSources(files)).toHaveLength(1)
	})

	it('a different core/ file importing { createHash } from node:crypto is rejected — the exception is scoped to digest.ts only', () => {
		const files = new Map([
			[
				'src/core/compile/alpha.ts',
				"import { createHash } from 'node:crypto'\n",
			],
		])
		expect(scanSources(files)).toHaveLength(1)
	})
})

describe('dependency-direction: no clock read, no randomness under core/ (AD-1)', () => {
	it('Date.now() under core/ is rejected', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'export const x = Date.now()\n'],
		])
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('clock read')
	})

	it('new Date() under core/ is rejected', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'export const x = new Date()\n'],
		])
		expect(scanSources(files)).toHaveLength(1)
	})

	it('Math.random() under core/ is rejected', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'export const x = Math.random()\n'],
		])
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('randomness')
	})

	it('Date.now() and Math.random() outside core/ (e.g. adapters/) are not flagged — purity is core-only', () => {
		const files = new Map([
			[
				'src/adapters/alpha.ts',
				'export const x = Date.now()\nexport const y = Math.random()\n',
			],
		])
		expect(scanSources(files)).toEqual([])
	})
})

describe('dependency-direction: no async function, no await under core/ (AD-1/AD-34)', () => {
	it('an async function declaration under core/ is rejected', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'export async function f() {}\n'],
		])
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('async')
	})

	it('an async arrow function under core/ is rejected', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'export const f = async () => 1\n'],
		])
		expect(scanSources(files)).toHaveLength(1)
	})

	it('an async method under core/ is rejected', () => {
		const files = new Map([
			[
				'src/core/compile/alpha.ts',
				'export const obj = {\n\tasync method() {},\n}\n',
			],
		])
		expect(scanSources(files)).toHaveLength(1)
	})

	it('"async" used as a bare identifier under core/ is not a false positive', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'const async = 5\nexport { async }\n'],
		])
		expect(scanSources(files)).toEqual([])
	})

	it('a top-level AwaitExpression under core/ is rejected', () => {
		const files = new Map([
			[
				'src/core/compile/alpha.ts',
				'export const x = await Promise.resolve(1)\n',
			],
		])
		const violations = scanSources(files)
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
		expect(scanSources(files)).toEqual([])
	})

	it('cli/ may await an application call', () => {
		const files = new Map([
			[
				'src/cli/alpha.ts',
				'export async function main() {\n\treturn await Promise.resolve(1)\n}\n',
			],
		])
		expect(scanSources(files)).toEqual([])
	})

	it('the string "await" and the word "async" inside a string or comment never trigger a purity violation — this is a token scan, not a text scan', () => {
		const files = new Map([
			[
				'src/core/compile/alpha.ts',
				"// async and await are just words in this comment\nexport const s = 'please do not await this string'\n",
			],
		])
		expect(scanSources(files)).toEqual([])
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
		const violations = scanSources(files)
		expect(violations).toHaveLength(2)
	})

	it('violations across multiple files in one scan are all reported', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'export const x = Date.now()\n'],
			['src/core/seal/beta.ts', 'export const y = Math.random()\n'],
		])
		const violations = scanSources(files)
		expect(violations).toHaveLength(2)
		expect(violations.map((v) => v.file).sort()).toEqual([
			'src/core/compile/alpha.ts',
			'src/core/seal/beta.ts',
		])
	})
})

describe('dependency-direction: every file under src/ belongs to a declared layer', () => {
	it('a .ts file under src/ outside every layer directory is rejected rather than silently skipped', () => {
		const files = new Map([
			[
				'src/loose.ts',
				"import fs from 'node:fs'\nexport const x = Math.random()\n",
			],
		])
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('no declared architecture layer')
	})
})

describe('dependency-direction: import analysis fails closed on an unreadable statement', () => {
	it('an import whose specifier is not a plain string literal is reported, never skipped', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'import { value } from `./beta.ts`\n'],
			['src/core/compile/beta.ts', 'export const value = 1\n'],
		])
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('could not determine')
	})

	it('a re-export whose specifier is not a plain string literal is reported, never skipped', () => {
		const files = new Map([
			['src/core/compile/alpha.ts', 'export * from `./beta.ts`\n'],
			['src/core/compile/beta.ts', 'export const value = 1\n'],
		])
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('could not determine')
	})

	it('import.meta is a meta-property, not an import declaration, and is never reported', () => {
		const files = new Map([
			['src/cli/alpha.ts', 'export const here = import.meta.url\n'],
		])
		expect(scanSources(files)).toEqual([])
	})
})

describe('dependency-direction: the createHash exception is the whole import clause, not just a binding inside it', () => {
	it('digest.ts importing a default binding alongside { createHash } is rejected', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				"import crypto, { createHash } from 'node:crypto'\n",
			],
		])
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('createHash')
	})

	it('a trailing comma inside the clause is punctuation and stays allowed', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				"import {\n\tcreateHash,\n} from 'node:crypto'\n",
			],
		])
		expect(scanSources(files)).toEqual([])
	})

	it('a type-only { createHash } import stays allowed', () => {
		const files = new Map([
			[
				'src/core/canonical/digest.ts',
				"import type { createHash } from 'node:crypto'\n",
			],
		])
		expect(scanSources(files)).toEqual([])
	})
})

describe('dependency-direction: wildcard re-export forms', () => {
	const importer = 'src/ports/alpha.ts'
	const target = 'src/core/compile/alpha.ts' // ports -> core (non-schema) is forbidden

	it('export type * from a forbidden target is rejected', () => {
		const files = twoFileMap(
			importer,
			`export type * from '${relSpecifier(importer, target)}'\n`,
			target,
		)
		expect(scanSources(files)).toHaveLength(1)
	})

	it('export * as ns from a forbidden target is rejected', () => {
		const files = twoFileMap(
			importer,
			`export * as ns from '${relSpecifier(importer, target)}'\n`,
			target,
		)
		expect(scanSources(files)).toHaveLength(1)
	})

	it('export type * as ns from a forbidden target is rejected', () => {
		const files = twoFileMap(
			importer,
			`export type * as ns from '${relSpecifier(importer, target)}'\n`,
			target,
		)
		expect(scanSources(files)).toHaveLength(1)
	})
})

describe('dependency-direction: ports/ declares shapes and imports no external module (AC 5)', () => {
	it.each(['zod', 'node:fs', 'node:crypto'])(
		'ports/ importing "%s" is rejected',
		(specifier) => {
			const files = new Map([
				['src/ports/alpha.ts', `import { x } from '${specifier}'\n`],
			])
			const violations = scanSources(files)
			expect(violations).toHaveLength(1)
			expect(violations[0]?.specifier).toBe(specifier)
		},
	)

	it.each(['src/adapters/alpha.ts', 'src/cli/alpha.ts'])(
		'%s may import a Node builtin — that layer exists to reach I/O',
		(file) => {
			const files = new Map([[file, "import { readFile } from 'node:fs'\n"]])
			expect(scanSources(files)).toEqual([])
		},
	)
})

describe('dependency-direction: the published conformance suite is framework-free (Story 6.1 AC 10)', () => {
	it('fixture 90: src/testing/ importing vitest, node:http, or zod is a violation naming AC 10\u2019s rule', () => {
		for (const specifier of ['vitest', 'node:http', 'zod']) {
			const files = new Map([
				['src/testing/x.ts', `import { x } from '${specifier}'\n`],
			])
			const violations = scanSources(files)
			expect(violations).toHaveLength(1)
			expect(violations[0]?.specifier).toBe(specifier)
			expect(violations[0]?.rule).toBe(
				'testing/ may import ports/ and core/schemas only; the published conformance suite may not import a test framework, an external module, or a Node builtin',
			)
		}
	})

	it('fixture 91: src/testing/ importing adapters/, application/, or core/probe/ is a violation', () => {
		const targets = [
			'src/adapters/y.ts',
			'src/application/y.ts',
			'src/core/probe/y.ts',
		]
		for (const target of targets) {
			const importer = 'src/testing/x.ts'
			const specifier = relSpecifier(importer, target)
			const files = twoFileMap(
				importer,
				`import { value } from '${specifier}'\n`,
				target,
			)
			const violations = scanSources(files)
			expect(violations).toHaveLength(1)
			expect(violations[0]?.file).toBe(importer)
			expect(violations[0]?.specifier).toBe(specifier)
		}
	})
})

describe('dependency-direction: ambient clock and random globals under core/ (AD-1)', () => {
	it.each([
		['crypto.randomUUID()', 'randomness'],
		['crypto.getRandomValues(new Uint8Array(1))', 'randomness'],
		['crypto.randomBytes(4)', 'randomness'],
		['crypto.webcrypto.getRandomValues(new Uint8Array(1))', 'randomness'],
		['performance.now()', 'clock read'],
	])(
		'%s under core/ is rejected — an ambient global needs no import, so only the expression check can see it',
		(expression, category) => {
			const files = new Map([
				['src/core/compile/alpha.ts', `export const x = ${expression}\n`],
			])
			const violations = scanSources(files)
			expect(violations).toHaveLength(1)
			expect(violations[0]?.rule).toContain(category)
		},
	)

	it('the same ambient globals outside core/ are not flagged', () => {
		const files = new Map([
			[
				'src/adapters/alpha.ts',
				'export const x = crypto.randomUUID()\nexport const y = performance.now()\n',
			],
		])
		expect(scanSources(files)).toEqual([])
	})
})

describe('dependency-direction: every async method form under core/', () => {
	it.each([
		['async generator method', 'export const o = {\n\tasync *gen() {},\n}\n'],
		[
			'computed-name async method',
			"export const o = {\n\tasync ['k']() {},\n}\n",
		],
		['quoted-name async method', "export const o = {\n\tasync 'k'() {},\n}\n"],
		['async generator declaration', 'export async function* gen() {}\n'],
	])('%s is rejected', (_label, source) => {
		const files = new Map([['src/core/compile/alpha.ts', source]])
		expect(scanSources(files)).toHaveLength(1)
	})

	it('an index access on a variable named async is not a false positive', () => {
		const files = new Map([
			[
				'src/core/compile/alpha.ts',
				'const async = [1]\nexport const first = async[0]\n',
			],
		])
		expect(scanSources(files)).toEqual([])
	})
})

describe('dependency-direction: dynamic import with import attributes', () => {
	it('a literal specifier followed by import attributes is read as a literal, and its edge is checked', () => {
		const importer = 'src/cli/alpha.ts'
		const target = 'src/core/compile/alpha.ts'
		const specifier = relSpecifier(importer, target)
		const files = twoFileMap(
			importer,
			`export async function load() {\n\treturn import('${specifier}', { with: { type: 'json' } })\n}\n`,
			target,
		)
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.specifier).toBe(specifier)
		expect(violations[0]?.rule).not.toContain('string literal')
	})

	it('the same form across an allowed edge is not flagged', () => {
		const importer = 'src/cli/alpha.ts'
		const target = 'src/application/alpha.ts'
		const files = twoFileMap(
			importer,
			`export async function load() {\n\treturn import('${relSpecifier(importer, target)}', { with: { type: 'json' } })\n}\n`,
			target,
		)
		expect(scanSources(files)).toEqual([])
	})
})

describe('dependency-direction: optional-call require', () => {
	it("require?.('...') is rejected the same as require('...')", () => {
		const files = new Map([
			[
				'src/application/alpha.ts',
				"declare const require: (id: string) => unknown\nconst mod = require?.('./alpha.ts')\n",
			],
		])
		const violations = scanSources(files)
		expect(violations).toHaveLength(1)
		expect(violations[0]?.rule).toContain('CommonJS require')
	})
})

describe('dependency-direction: the real repository scan (production gate: npm run check:layers)', () => {
	// Calls `discoverSourceFiles` directly rather than importing
	// `scripts/check-dependency-direction.ts`, whose module-load side effects
	// (running the scan, possibly `process.exit(1)`) are unsuitable inside a
	// test process. Sharing the walk keeps this test and the production gate
	// scanning the same file set.
	it('scans every .ts file under src/ with zero violations', async () => {
		const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
		const files = await discoverSourceFiles(repoRoot)
		expect(files.size).toBeGreaterThan(0)
		const violations = scanSources(files)
		expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
	})

	it('every discovered file classifies into a declared layer, so none is silently skipped', async () => {
		const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
		const files = await discoverSourceFiles(repoRoot)
		const unclassified = [...files.keys()].filter(
			(file) => classifyLayer(file) === undefined,
		)
		expect(unclassified).toEqual([])
	})

	it('rejects an empty src/ rather than reporting a clean scan of nothing', async () => {
		const root = await mkdtemp(join(tmpdir(), 'dependency-direction-'))
		try {
			await mkdir(join(root, 'src'))
			await expect(discoverSourceFiles(root)).rejects.toThrow(
				/no \.ts files were found under src\//,
			)
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})
})
