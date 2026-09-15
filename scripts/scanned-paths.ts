// The scanned set every gate that reads a tree declares, and the walk behind it.
//
// Three gates take a list of paths out of `eval-quality.config.json` and read
// what is under them: the package-boundary gate, the field-ownership gate, and
// the two documentation gates that hold a page against source. The declaration
// and the walk sit here rather than in any one of them, on the rule
// `package-boundary.ts` wrote down when it was the only owner: a third gate that
// needs it is the point at which it earns a module of its own.
//
// The walk fails closed on the three ways it can under-report: a path that is
// not there, a path that matched no file, and a symbolic link, whose target
// could sit outside the declared tree or outside the repository altogether.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports.
import type { Dirent } from 'node:fs'
import { lstat, readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'

/** A path or manifest field the configuration named and the tree does not have. */
export const SCAN_PATH_ERROR = 'EVAL_QUALITY_SCAN_PATH'

/** A tree the gate could not read to the end, so the scan proves nothing. */
export const SCAN_UNREADABLE = 'EVAL_QUALITY_SCAN_UNREADABLE'

const codedError = (code: string, message: string): Error =>
	Object.assign(new Error(message), { code })

const detail = (error: unknown): string =>
	error instanceof Error ? error.message : String(error)

const NonEmpty = z.string().min(1)

const isSafeRelative = (value: string): boolean =>
	!value.startsWith('/') &&
	!/^[A-Za-z]:/.test(value) &&
	!value.includes('\\') &&
	value.split('/').every((segment) => segment !== '' && segment !== '..')

const RELATIVE_PATH_MESSAGE =
	'is not a repository-relative path: write it with forward slashes, no leading slash, no drive letter, and no ".." segment, so a configuration can only name files beneath itself'

/** Shared with `lineage-ownership.ts`; see the note on `ScannedPathList`. */
export const RelativePath = NonEmpty.max(400).refine(
	isSafeRelative,
	RELATIVE_PATH_MESSAGE,
)

/** The same shape with a trailing slash allowed, for a directory prefix. */
export const RelativePrefix = NonEmpty.max(400).refine(
	(value) => isSafeRelative(value.endsWith('/') ? value.slice(0, -1) : value),
	RELATIVE_PATH_MESSAGE,
)

const ScannedPath = z.strictObject({
	path: RelativePath.describe(
		'A directory to walk, or a single file to read, relative to this configuration file.',
	),
	recursive: z
		.boolean()
		.default(true)
		.describe(
			'Whether a directory is walked to the bottom. Ignored when the path names a file.',
		),
	extensions: z
		.array(
			z
				.string()
				.regex(
					/^\.[A-Za-z0-9][A-Za-z0-9.]*$/,
					'is not a file extension; write it with its leading dot, as ".ts"',
				),
		)
		.min(1)
		.optional()
		.describe(
			'Which files under this path are read. Leave it out and every file is read whatever its name, which is what a tree of generated data needs.',
		),
	optional: z
		.boolean()
		.default(false)
		.describe(
			'Whether this path may contribute nothing. False, the default, fails when the path is absent or holds no matching file, so a generated tree nobody built cannot read as a clean scan.',
		),
})

export type ScannedPathConfig = z.infer<typeof ScannedPath>

/**
 * The scanned-set declaration. It lived in `package-boundary.ts` while that gate
 * was its only owner, on a note saying a third gate needing it was the point at
 * which it earned a module of its own. The two documentation gates made three.
 */
export const ScannedPathList = z.array(ScannedPath).min(1)

export type ScanCount = {
	readonly path: string
	readonly files: number
}

export type DiscoveredEntries = {
	readonly entries: Map<string, string>
	readonly counts: ScanCount[]
}

const matchesExtension = (declared: ScannedPathConfig, name: string): boolean =>
	declared.extensions === undefined ||
	declared.extensions.some((extension) => name.endsWith(extension))

async function walk(
	root: string,
	posix: string,
	declared: ScannedPathConfig,
	entries: Map<string, string>,
): Promise<number> {
	let dirents: Dirent[]
	try {
		dirents = await readdir(resolve(root, posix), { withFileTypes: true })
	} catch (error) {
		throw codedError(
			SCAN_UNREADABLE,
			`${posix} could not be read: ${detail(error)}`,
		)
	}
	let count = 0
	for (const entry of dirents) {
		const child = `${posix}/${entry.name}`
		if (entry.isSymbolicLink()) {
			throw codedError(
				SCAN_UNREADABLE,
				`${child} is a symbolic link; this scan does not follow links, and skipping one would leave a file unscanned while the run reported a clean tree`,
			)
		}
		if (entry.isDirectory()) {
			if (!declared.recursive) continue
			count += await walk(root, child, declared, entries)
		} else if (entry.isFile() && matchesExtension(declared, entry.name)) {
			entries.set(child, await readFile(resolve(root, child), 'utf8'))
			count += 1
		}
	}
	return count
}

/**
 * Everything the declared paths hold, keyed by the path a report prints. Fails
 * closed on the three ways a walk under-reports: a path that is not there, a
 * path that matched no file, and a link whose target could sit anywhere.
 */
export async function discoverEntries(
	root: string,
	paths: readonly ScannedPathConfig[],
	gate: string,
): Promise<DiscoveredEntries> {
	const entries = new Map<string, string>()
	const counts: ScanCount[] = []
	for (const declared of paths) {
		let info: Awaited<ReturnType<typeof lstat>>
		try {
			info = await lstat(resolve(root, declared.path))
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw codedError(
					SCAN_UNREADABLE,
					`${declared.path} could not be read: ${detail(error)}`,
				)
			}
			if (declared.optional) {
				counts.push({ path: declared.path, files: 0 })
				continue
			}
			throw codedError(
				SCAN_PATH_ERROR,
				`${declared.path} does not exist, and the "${gate}" section names it under paths; mark it optional if it may be absent`,
			)
		}
		if (info.isSymbolicLink()) {
			throw codedError(
				SCAN_UNREADABLE,
				`${declared.path} is a symbolic link, and this scan does not follow links`,
			)
		}
		if (info.isFile()) {
			entries.set(
				declared.path,
				await readFile(resolve(root, declared.path), 'utf8'),
			)
			counts.push({ path: declared.path, files: 1 })
			continue
		}
		const found = await walk(root, declared.path, declared, entries)
		if (found === 0 && !declared.optional) {
			throw codedError(
				SCAN_PATH_ERROR,
				`${declared.path} holds no file the "${gate}" section asked for, so a scan of nothing would report zero violations for the wrong reason; mark it optional if it may be empty`,
			)
		}
		counts.push({ path: declared.path, files: found })
	}
	return { entries, counts }
}
