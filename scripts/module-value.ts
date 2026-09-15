// How a configuration names a value it cannot spell in JSON.
//
// The three documentation gates hold a page against something the repository
// computes: how many contracts a corpus carries, which stages perform a
// comparison, which schema a worked example parses against, whether a claim
// that was true when it was written still is. None of those is a literal, and
// writing one into the configuration would create exactly the setting this
// format does not have: a number or a list a hand keeps in step with the code
// beside it.
//
// So a source is a module path and an export name. The gate imports the
// consumer's own module and reads the value out of it, which puts the
// computation in the consumer's code, where it can be tested, and leaves the
// configuration naming it.
//
// The module is the consumer's, and importing it runs it. That is the same
// trust a lint plugin or a test setup file has, and the published page says so
// plainly, so a consumer choosing to point a gate at a module knows what the
// gate does with it.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { RelativePath } from './scanned-paths.ts'

/** A module a configuration named that could not be imported or read. */
export const MODULE_VALUE_ERROR = 'EVAL_QUALITY_MODULE_VALUE'

const NonEmpty = z.string().min(1)

/**
 * What to take from the export. `value` is the export itself, `length` its
 * `length`, and `keys` the number of its own enumerable keys.
 *
 * Three rather than one, because the alternative is a configuration naming a
 * separate `…_COUNT` export beside every list, which is a second value a hand
 * maintains in step with the first.
 */
export const Take = z.enum(['value', 'length', 'keys'])

export const ModuleValue = z
	.strictObject({
		module: RelativePath.describe(
			'The module to import, relative to the configuration file. It is imported, so it runs.',
		),
		export: NonEmpty.describe(
			'The export to read. A default export is named "default".',
		),
		path: z
			.array(NonEmpty)
			.optional()
			.describe(
				'Properties to walk from the export before taking anything, so one exported table can back several sources.',
			),
		take: Take.default('value').describe(
			'What to take: the value itself, its length, or the number of its own keys.',
		),
	})
	.describe(
		'A value this configuration cannot spell: a module of yours, an export of that module, and what to take from it.',
	)

export type ModuleValueConfig = z.infer<typeof ModuleValue>

const codedError = (message: string): Error =>
	Object.assign(new Error(message), { code: MODULE_VALUE_ERROR })

const detail = (error: unknown): string =>
	error instanceof Error ? error.message : String(error)

/** How a source reads in a refusal, so every message names the same thing. */
export const nameOf = (source: ModuleValueConfig): string => {
	const walked = source.path === undefined ? '' : `.${source.path.join('.')}`
	return `${source.module}'s ${source.export}${walked}`
}

const typeOf = (value: unknown): string =>
	value === null ? 'null' : Array.isArray(value) ? 'an array' : typeof value

/**
 * The value behind one source. Every refusal names the module, the export and
 * what was found, because those are the three things the reader has to compare
 * against their own tree.
 *
 * Imports are not cached here. Node caches a module by URL for the life of the
 * process, so two sources naming one module import it once.
 */
export async function readModuleValue(
	root: string,
	source: ModuleValueConfig,
): Promise<unknown> {
	const url = pathToFileURL(resolve(root, source.module))
	let module: Record<string, unknown>
	try {
		module = (await import(url.href)) as Record<string, unknown>
	} catch (error) {
		throw codedError(`${source.module} could not be imported: ${detail(error)}`)
	}

	if (!(source.export in module)) {
		// `default` stays in the listing. Filtering it out told a module whose only
		// export is a default that it exports nothing, while `export: "default"`
		// would have resolved.
		const exported = Object.keys(module).sort()
		throw codedError(
			`${source.module} exports no "${source.export}"; it exports ${
				exported.length === 0 ? 'nothing' : exported.join(', ')
			}`,
		)
	}

	let value = module[source.export]
	for (const key of source.path ?? []) {
		if (value === null || typeof value !== 'object') {
			throw codedError(
				`${nameOf(source)}: "${key}" was reached on ${typeOf(value)}, which has no properties`,
			)
		}
		const holder = value as Record<string, unknown>
		if (!(key in holder)) {
			throw codedError(
				`${nameOf(source)}: "${key}" is absent; the keys there are ${Object.keys(holder).sort().join(', ')}`,
			)
		}
		value = holder[key]
	}
	return value
}

export type TakeKind = 'value' | 'length' | 'keys'

/**
 * The count behind a value, however the configuration asked for it. Shared, so a
 * module export and a value walked out of a JSON file answer to one rule and one
 * wording rather than to two that drift.
 *
 * `where` is what the refusal names, which differs per caller: a module export
 * for one, a file and a key path for the other.
 */
export function takeCount(
	value: unknown,
	take: TakeKind,
	where: string,
): number {
	if (take === 'value') {
		if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
			return value
		}
		throw codedError(
			`${where} is ${typeOf(value)} and take is "value", so a count was expected; a list takes "length" and a table takes "keys"`,
		)
	}
	if (take === 'length') {
		// A string has a length and counting its characters is never what a page
		// meant, so it is refused rather than answered. Every other `length` a
		// configuration can reach is a list's.
		if (typeof value === 'string') {
			throw codedError(
				`${where} is a string and take is "length", which would count its characters; a page counts members, so name a list`,
			)
		}
		const length = (value as { length?: unknown } | null)?.length
		if (typeof length === 'number' && Number.isInteger(length) && length >= 0) {
			return length
		}
		throw codedError(
			`${where} is ${typeOf(value)} and take is "length", which it has none of`,
		)
	}
	if (value === null || typeof value !== 'object') {
		throw codedError(
			`${where} is ${typeOf(value)} and take is "keys", which only an object has`,
		)
	}
	return Object.keys(value as Record<string, unknown>).length
}

/** A source that has to answer a number, which is every count a page carries. */
export async function readModuleCount(
	root: string,
	source: ModuleValueConfig,
): Promise<number> {
	return takeCount(
		await readModuleValue(root, source),
		source.take,
		nameOf(source),
	)
}

/** A source that has to answer a list of strings, which is every transcribed set. */
export async function readModuleStrings(
	root: string,
	source: ModuleValueConfig,
): Promise<readonly string[]> {
	const value = await readModuleValue(root, source)
	if (!Array.isArray(value) || value.some((each) => typeof each !== 'string')) {
		throw codedError(
			`${nameOf(source)} is ${typeOf(value)}, and a list of strings was expected`,
		)
	}
	return value as readonly string[]
}

/** A source that has to answer one string, which is every transcription. */
export async function readModuleText(
	root: string,
	source: ModuleValueConfig,
): Promise<string> {
	const value = await readModuleValue(root, source)
	if (typeof value === 'string') return value
	if (typeof value === 'function') {
		const produced: unknown = await (value as () => unknown)()
		if (typeof produced === 'string') return produced
		throw codedError(
			`${nameOf(source)} is a function and it returned ${typeOf(produced)}; a transcription source returns the text`,
		)
	}
	throw codedError(
		`${nameOf(source)} is ${typeOf(value)}, and a string or a function returning one was expected`,
	)
}

/**
 * A source that has to answer a predicate's verdict. A boolean export settles a
 * claim that a constant decides; a function export settles one that needs the
 * tree read, and it is awaited so a reader may be asynchronous.
 */
export async function readModuleVerdict(
	root: string,
	source: ModuleValueConfig,
): Promise<boolean> {
	const value = await readModuleValue(root, source)
	if (typeof value === 'boolean') return value
	if (typeof value === 'function') {
		const produced: unknown = await (value as () => unknown)()
		if (typeof produced === 'boolean') return produced
		throw codedError(
			`${nameOf(source)} is a function and it returned ${typeOf(produced)}; a predicate answers true or false`,
		)
	}
	throw codedError(
		`${nameOf(source)} is ${typeOf(value)}, and a boolean or a function returning one was expected`,
	)
}

/**
 * A source that has to answer a parser. Zod is this package's own schema
 * library and a consumer naming a schema export is naming a Zod one, so the
 * shape checked for is `safeParse`.
 */
export type Parser = {
	safeParse(value: unknown): {
		success: boolean
		error?: {
			issues: readonly { path: readonly PropertyKey[]; message: string }[]
		}
	}
}

export async function readModuleParser(
	root: string,
	source: ModuleValueConfig,
): Promise<Parser> {
	const value = await readModuleValue(root, source)
	if (
		value !== null &&
		typeof value === 'object' &&
		typeof (value as Parser).safeParse === 'function'
	) {
		return value as Parser
	}
	throw codedError(
		`${nameOf(source)} is ${typeOf(value)} and has no safeParse; a schema source names a Zod schema`,
	)
}
