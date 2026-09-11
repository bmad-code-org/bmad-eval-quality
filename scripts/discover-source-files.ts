// The one recursive walk behind the dependency-direction gate and behind
// `dependency-direction.test.ts`'s real-tree scan, so the gate and the test scan
// the same set by construction. Kept separate from `dependency-direction.ts`,
// which stays filesystem-free, pure, and reachable only after `typescript` has
// been probed; this module needs neither.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports, or the gate fails at load.
import type { Dirent } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** One declared tree: a repository-relative directory and the extensions read inside it. */
export type ScanRoot = {
	readonly path: string
	readonly extensions: readonly string[]
}

/**
 * Every matching file under every declared root, keyed by repository-relative
 * POSIX path. Fails closed on the three ways a walk can quietly under-report: a
 * root that cannot be read, a symlink (whose target could sit outside the root,
 * or outside the repository altogether), and a root that yielded nothing, which
 * would otherwise read as "scanned everything, found nothing wrong".
 */
export async function discoverSourceFiles(
	repoRoot: string,
	roots: readonly ScanRoot[],
): Promise<Map<string, string>> {
	const files = new Map<string, string>()

	async function walk(relativeDir: string, root: ScanRoot): Promise<void> {
		let entries: Dirent[]
		try {
			entries = await readdir(join(repoRoot, relativeDir), {
				withFileTypes: true,
			})
		} catch (error) {
			throw new Error(
				`the scan root "${root.path}" could not be walked at ${relativeDir}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
		}
		for (const entry of entries) {
			const child = `${relativeDir}/${entry.name}`
			if (entry.isSymbolicLink()) {
				throw new Error(
					`${child} is a symbolic link; the dependency-direction scan does not follow links, and silently skipping one would leave source unscanned`,
				)
			}
			if (entry.isDirectory()) {
				await walk(child, root)
			} else if (
				entry.isFile() &&
				root.extensions.some((extension) => entry.name.endsWith(extension))
			) {
				files.set(child, await readFile(join(repoRoot, child), 'utf8'))
			}
		}
	}

	for (const root of roots) {
		const before = files.size
		await walk(root.path, root)
		if (files.size === before) {
			throw new Error(
				`the scan root "${root.path}" holds no ${root.extensions.join(' or ')} file; a scan of nothing reports zero violations for the wrong reason`,
			)
		}
	}
	return files
}
