// The one recursive `src/` walk behind both `check:layers` and
// `dependency-direction.test.ts`'s real-tree scan, so the gate and the test
// scan the same set by construction. Kept separate from
// `scripts/dependency-direction.ts`, which stays filesystem-free and pure.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports, or the script fails at load.
import { readdir, readFile } from 'node:fs/promises'

/**
 * Every `.ts` file under `<repoRoot>/src/`, keyed by repo-relative POSIX
 * path. Fails closed on the two ways a walk can quietly under-report: a
 * symlink (whose target could sit outside `src/`, or outside the repository
 * altogether) and an empty result (which would otherwise read as "scanned
 * everything, found nothing wrong").
 */
export async function discoverSourceFiles(
	repoRoot: string,
): Promise<Map<string, string>> {
	const files = new Map<string, string>()
	async function walk(posixDir: string): Promise<void> {
		const entries = await readdir(`${repoRoot}${posixDir}`, {
			withFileTypes: true,
		})
		for (const entry of entries) {
			const childPosixPath = `${posixDir}/${entry.name}`
			if (entry.isSymbolicLink()) {
				throw new Error(
					`${childPosixPath.replace(/^\//, '')} is a symbolic link; the dependency-direction scan does not follow links, and silently skipping one would leave source unscanned`,
				)
			}
			if (entry.isDirectory()) {
				await walk(childPosixPath)
			} else if (entry.isFile() && entry.name.endsWith('.ts')) {
				const source = await readFile(`${repoRoot}${childPosixPath}`, 'utf8')
				files.set(childPosixPath.replace(/^\//, ''), source)
			}
		}
	}
	await walk('/src')
	if (files.size === 0) {
		throw new Error(
			'no .ts files were found under src/; a scan of nothing reports zero violations for the wrong reason',
		)
	}
	return files
}
