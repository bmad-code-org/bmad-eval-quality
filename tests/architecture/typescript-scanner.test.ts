/**
 * The one loader both source-scanning gates reach TypeScript through, and its
 * three refusals: the package is absent, the package is a version with no
 * `typescript/unstable/ast`, and the subpath is there and lacks a member this
 * build reads. The last is the quiet one, since a missing enum member reads as
 * `undefined` and a rule guarded by it switches off with every gate green, so
 * the required list is derived here from the three scanner sources and held
 * equal to the constant.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
	loadTypeScriptScanner,
	REQUIRED_SYNTAX_KINDS,
	SCANNER_SHIPS_FROM,
	SCANNER_SUBPATH,
	TYPESCRIPT_UNAVAILABLE,
} from '../../scripts/typescript-scanner.ts'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

const rejecting = (code: string) => () =>
	Promise.reject(Object.assign(new Error(code), { code }))

const refusalOf = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(error: unknown) => error as Error & { code?: string },
	)

describe('the TypeScript scanner loader', () => {
	it('resolves here, where typescript 7 is installed', async () => {
		const scanner = await loadTypeScriptScanner('dependency-direction')
		expect(typeof scanner.createScanner).toBe('function')
		expect(typeof scanner.SyntaxKind.RequireKeyword).toBe('number')
	})

	it('refuses an absent package, naming the dependency and the gate', async () => {
		const failure = await refusalOf(
			loadTypeScriptScanner(
				'field-ownership',
				rejecting('ERR_MODULE_NOT_FOUND'),
			),
		)
		expect(failure?.code).toBe(TYPESCRIPT_UNAVAILABLE)
		expect(failure?.message).toContain('"typescript"')
		expect(failure?.message).toContain('field-ownership')
	})

	// TypeScript 5 has no `unstable/ast`; its export map refuses the subpath
	// with this code, which the gates used to rethrow as a resolver stack.
	it('refuses a version with no scanner subpath, naming the version and where it ships from', async () => {
		const failure = await refusalOf(
			loadTypeScriptScanner(
				'dependency-direction',
				rejecting('ERR_PACKAGE_PATH_NOT_EXPORTED'),
				async () => '5.9.3',
			),
		)
		expect(failure?.code).toBe(TYPESCRIPT_UNAVAILABLE)
		expect(failure?.message).toContain('typescript 5.9.3')
		expect(failure?.message).toContain(SCANNER_SUBPATH)
		expect(failure?.message).toContain(SCANNER_SHIPS_FROM)
		expect(failure?.message).toContain('dependency-direction')
	})

	it('refuses a subpath missing a member the gates read, naming it', async () => {
		const real = (await import('typescript/unstable/ast')) as Record<
			string,
			unknown
		>
		const { RequireKeyword: _dropped, ...kinds } = real.SyntaxKind as Record<
			string,
			number
		>
		const failure = await refusalOf(
			loadTypeScriptScanner(
				'field-ownership',
				async () => ({ ...real, SyntaxKind: kinds }),
				async () => '7.4.0',
			),
		)
		expect(failure?.code).toBe(TYPESCRIPT_UNAVAILABLE)
		expect(failure?.message).toContain('SyntaxKind.RequireKeyword')
		expect(failure?.message).toContain('typescript 7.4.0')
		expect(failure?.message).toContain('switch a rule off silently')
	})

	it('refuses a subpath with no scanner functions', async () => {
		const failure = await refusalOf(
			loadTypeScriptScanner(
				'field-ownership',
				async () => ({}),
				async () => null,
			),
		)
		expect(failure?.code).toBe(TYPESCRIPT_UNAVAILABLE)
		expect(failure?.message).toContain(
			'createScanner, computeLineStarts, SyntaxKind',
		)
		expect(failure?.message).toContain('an unknown version')
	})

	it('rethrows anything that is not one of its three refusals', async () => {
		const boom = new Error('the loader threw')
		await expect(
			loadTypeScriptScanner('field-ownership', () => Promise.reject(boom)),
		).rejects.toBe(boom)
	})

	// The list is the whole of the third refusal. Derived from the sources so a
	// member added to a scanner lands here or fails here, never neither.
	it('requires exactly the members the three scanner modules read', () => {
		const used = new Set<string>()
		for (const file of [
			'scripts/token-scan.ts',
			'scripts/dependency-direction.ts',
			'scripts/lineage-ownership.ts',
		]) {
			const source = readFileSync(`${repoRoot}${file}`, 'utf8')
			for (const match of source.matchAll(
				/\b(?:SyntaxKind|syntax)\.([A-Za-z]+)/g,
			)) {
				used.add(match[1] as string)
			}
		}
		expect([...REQUIRED_SYNTAX_KINDS]).toEqual([...used].sort())
	})
})
