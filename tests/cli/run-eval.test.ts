import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const DIRNAME = dirname(fileURLToPath(import.meta.url))
const ROOT = join(DIRNAME, '..', '..')

describe('scripts/run-eval.mjs: single-pass convenience runner', () => {
	it('compiles and seals a contract in a single pass', async () => {
		const scratch = mkdtempSync(join(tmpdir(), 'run-eval-test-'))
		try {
			const scriptPath = join(ROOT, 'scripts', 'run-eval.mjs')
			const contractPath = join(
				ROOT,
				'corpus',
				'dev',
				'contracts',
				'satisfied-declarations.json',
			)

			const { stdout } = await execFileAsync(process.execPath, [
				scriptPath,
				'--contract',
				contractPath,
				'--out',
				scratch,
			])

			expect(stdout).toContain(
				'[eval-quality] 🎉 Single-pass workflow complete!',
			)

			const compiledFile = join(scratch, 'eval-contract.json')
			const briefFile = join(scratch, 'sealed-evaluator-brief.json')

			expect(existsSync(compiledFile)).toBe(true)
			expect(existsSync(briefFile)).toBe(true)

			const compiled = JSON.parse(readFileSync(compiledFile, 'utf8'))
			const brief = JSON.parse(readFileSync(briefFile, 'utf8'))

			expect(compiled.schemaVersion).toBe(1)
			expect(brief.behaviors.length).toBeGreaterThan(0)
		} finally {
			rmSync(scratch, { recursive: true, force: true })
		}
	}, 30_000)
})
