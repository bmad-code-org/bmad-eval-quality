// The command-probe arm's own version of `probe-subject.test.ts` fixtures
// 85-88: the in-repository command-probe subject, run against
// `runCommandLineProbeConformance` over a real spawned process.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runCommandLineProbeConformance } from '../../src/testing/probe-conformance.ts'
import {
	createCommandProbeSubject,
	ensureFixtureExecutable,
} from './command-probe-subject.ts'

describe('the in-repository command-probe subject', () => {
	let scratchDir: string

	beforeAll(() => {
		ensureFixtureExecutable()
		scratchDir = mkdtempSync(join(tmpdir(), 'command-probe-subject-'))
	})

	afterAll(() => {
		rmSync(scratchDir, { recursive: true, force: true })
	})

	it('passes the published command-probe conformance suite, fifteen outcomes, over a real process', async () => {
		const report = await runCommandLineProbeConformance(
			createCommandProbeSubject(scratchDir),
		)
		const failures = report.outcomes.filter((outcome) => !outcome.passed)
		expect(failures).toEqual([])
		expect(report.outcomes).toHaveLength(15)
		expect(report.passed).toBe(true)
	}, 20000)
})
