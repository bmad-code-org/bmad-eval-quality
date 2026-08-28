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
			thresholds: { statements: 90, branches: 90 },
		},
	},
})
