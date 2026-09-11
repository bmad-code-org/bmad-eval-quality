// What `generate:version` writes and `check:version` reads, spelled once: the
// manifest's `version` and the single `VERSION` declaration in the root
// barrel. Both scripts import this module, so neither can address a different
// file or a different declaration shape than the other.
//
// Both paths resolve from the current working directory.
// `scripts/release-prepare.mjs` runs the generator by absolute path against
// whichever repository it is cutting, and its test fixture is a repository
// with no `scripts/` of its own.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const MANIFEST_FILE = 'package.json'
export const BARREL_FILE = 'src/index.ts'

/** The declaration shape a refusal quotes back, so the repair is copyable. */
export const DECLARATION_SHAPE = "export const VERSION = '<version>'"

/**
 * Anchored to a whole line, so a mention of the declaration inside a comment
 * or a string is never the text that gets rewritten. Global, because two
 * declarations are drift of their own and the reading refuses them.
 */
const DECLARATION = /^export const VERSION = '([^']+)'$/gm

export type Reading = {
	/** `package.json`'s `version`, the one place the number is authored. */
	readonly manifestVersion: string
	/** The barrel's full text, which the generator rewrites. */
	readonly barrelSource: string
	/** The version the barrel currently declares. */
	readonly barrelVersion: string
}

const describe = (error: unknown): string =>
	error instanceof Error ? error.message : String(error)

/**
 * Both files, read from the working directory, with the barrel's one `VERSION`
 * declaration located. Throws a worded refusal naming the file and, where the
 * declaration is the problem, the shape expected.
 */
export function read(): Reading {
	let manifest: { readonly version?: unknown }
	try {
		manifest = JSON.parse(readFileSync(resolve(MANIFEST_FILE), 'utf8')) as {
			readonly version?: unknown
		}
	} catch (error) {
		throw new Error(`${MANIFEST_FILE}: unreadable (${describe(error)})`)
	}
	const manifestVersion = manifest.version
	if (typeof manifestVersion !== 'string' || manifestVersion === '') {
		throw new Error(`${MANIFEST_FILE}: declares no string \`version\``)
	}

	let barrelSource: string
	try {
		barrelSource = readFileSync(resolve(BARREL_FILE), 'utf8')
	} catch (error) {
		throw new Error(`${BARREL_FILE}: unreadable (${describe(error)})`)
	}

	const matches = [...barrelSource.matchAll(DECLARATION)]
	if (matches.length === 0) {
		throw new Error(
			`${BARREL_FILE}: declares no \`${DECLARATION_SHAPE}\` on a line of its own`,
		)
	}
	if (matches.length > 1) {
		throw new Error(
			`${BARREL_FILE}: declares \`VERSION\` ${matches.length} times; the generator writes one`,
		)
	}
	const barrelVersion = matches[0]?.[1]
	// The pattern's only group always participates once the pattern matched;
	// the guard is what makes that readable to the compiler.
	if (barrelVersion === undefined) {
		throw new Error(
			`${BARREL_FILE}: the \`VERSION\` declaration carries no version`,
		)
	}
	return { manifestVersion, barrelSource, barrelVersion }
}

/** The barrel's text with its one `VERSION` declaration set to `version`. */
export const withVersion = (barrelSource: string, version: string): string =>
	barrelSource.replace(DECLARATION, `export const VERSION = '${version}'`)
