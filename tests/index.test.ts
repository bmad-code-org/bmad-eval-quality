import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ENGINE_VERSION } from '../src/core/version.ts'
import { VERSION } from '../src/index.ts'

/**
 * Read from source, so this holds under a bare `npm test`. `check:version`
 * reads the same two files and runs inside `validate`;
 * `tests/architecture/package-exports.test.ts` case 156 reads the built barrel
 * and skips when no build has run.
 */
const manifestVersion = (
	JSON.parse(
		readFileSync(
			fileURLToPath(new URL('../package.json', import.meta.url)),
			'utf8',
		),
	) as { readonly version: string }
).version

describe('eval-quality scaffold', () => {
	it('exports the version the manifest declares', () => {
		expect(VERSION).toBe(manifestVersion)
	})

	it('declares the same version to core, where a stage that records the engine reads it', () => {
		expect(ENGINE_VERSION).toBe(manifestVersion)
		expect(ENGINE_VERSION).toBe(VERSION)
	})
})
