import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			// AD-30's floor is `core/` alone. `adapters/` and `cli/` are covered
			// by AD-37's conformance suite and the CLI's own tests, and counting
			// them here would let a well-tested adapter mask a thin core.
			include: ['src/core/**'],
			reporter: ['text-summary', 'json-summary'],
			// Outside the repository and unique per run. Writing into `./coverage`
			// intermittently fails with "Something removed the coverage directory",
			// and a flake there reads as a threshold failure. A fixed name under
			// `tmpdir()` only moves that collision: it is one path for the whole
			// machine, shared by every checkout, worktree, and terminal. The pid
			// gives each run its own directory, so no second run can clear the one
			// this one is writing into.
			reportsDirectory: join(tmpdir(), `eval-quality-coverage-${process.pid}`),
			// The glob key is a per-directory floor beside the two global ones. In
			// this vitest a matched file stays in the global pool as well, so the
			// glob adds a floor rather than carving files out of the overall one.
			// Verify any new glob by hand before trusting it: an empty coverage map
			// summarises to "Unknown", and `"Unknown" < 90` is `false`, so a glob
			// matching nothing is permanently green.
			// `tests/ingest/conditions.test.ts` asserts the directory is real.
			thresholds: {
				statements: 90,
				branches: 90,
				'src/core/ingest/**': { statements: 90, branches: 90 },
			},
		},
	},
})
