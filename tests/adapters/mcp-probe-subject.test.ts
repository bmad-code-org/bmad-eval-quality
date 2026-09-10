// The mcp-probe arm's own version of `probe-subject.test.ts` fixtures 85-88:
// the published arm run against the shipped adapter and a real stdio server,
// asserting fourteen of fourteen with an empty failure list.
//
// A failing run of this file leaks nothing. Every session the subject opens is
// torn down in `callToolOverStdio`'s own `finally`, which ends the server's
// stdin and kills its process group, and that runs on the cap path and the
// throw path as well as the clean one. No case here launches through a
// launcher or asks the fixture to linger, so there is no grandchild for an
// assertion failure to strand.

import { describe, expect, it } from 'vitest'
import {
	CONFORMANCE_OUTCOME_COUNTS,
	formatConformanceReport,
} from '../../src/testing/conformance.ts'
import { runMcpProbeConformance } from '../../src/testing/probe-conformance.ts'
import { createMcpProbeSubject } from './mcp-probe-subject.ts'

describe('the shipped MCP adapter against the published mcp arm', () => {
	it('passes fourteen of fourteen', async () => {
		const report = await runMcpProbeConformance(createMcpProbeSubject())
		const failures = report.outcomes.filter((outcome) => !outcome.passed)
		// The formatted report is what an adapter author sees, so a failure here
		// names the assertion and its detail rather than a bare count.
		expect(failures.length === 0 ? '' : formatConformanceReport(report)).toBe(
			'',
		)
		expect(report.outcomes).toHaveLength(
			CONFORMANCE_OUTCOME_COUNTS['mcp-probe'],
		)
		expect(report.port).toBe('mcp-probe')
		expect(report.subject).toBe('createMcpAdapter')
		expect(report.passed).toBe(true)
	}, 60_000)

	it('emits every assertion id exactly once, in report order', async () => {
		const report = await runMcpProbeConformance(createMcpProbeSubject())
		expect(report.outcomes.map((outcome) => outcome.id)).toEqual([
			'probe/typed-fault',
			'probe/single-underlying-call-on-success',
			'probe/single-underlying-call-on-failure',
			'probe/prompt-abort',
			'probe/no-in-band-error',
			'probe/schema-valid-return',
			'mcp/allow-authorized-tool-call',
			'mcp/observe-error-result',
			'mcp/deny-unmapped-interface',
			'mcp/deny-unauthorized-tool',
			'mcp/arguments-passed-as-declared',
			'mcp/observe-declared-result-channel',
			'mcp/cap-elapsed',
			'mcp/cap-result-bytes',
		])
	}, 60_000)
})
