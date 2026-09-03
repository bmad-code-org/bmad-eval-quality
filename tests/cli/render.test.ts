import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Diagnostic } from '../../src/application/diagnostics.ts'
import { serializeArtifact } from '../../src/application/serialize.ts'
import {
	EXIT_CODE_TABLE,
	renderArtifact,
	renderDiagnostic,
	renderError,
	renderUsage,
} from '../../src/cli/render.ts'
import { digestArtifact, digestBytes } from '../../src/core/canonical/digest.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'

const PATH = 'EvalContract'

describe('renderArtifact', () => {
	it('case 49: is byte-equal to serializeArtifact over a fixture', () => {
		// The delegation is the whole point: an independently implemented
		// renderArtifact would either duplicate the canonicalization or reach
		// into core/, which cli/ may not import.
		expect(renderArtifact(populatedContract, PATH)).toBe(
			serializeArtifact(populatedContract, PATH),
		)
	})

	it('case 50: ends with exactly one trailing newline', () => {
		const text = renderArtifact(populatedContract, PATH)
		expect(text.endsWith('\n')).toBe(true)
		expect(text.endsWith('\n\n')).toBe(false)
	})
})

describe('renderDiagnostic', () => {
	it('case 51: renders eval-quality: <stage>: <runId>: <message>', () => {
		const diagnostic: Diagnostic = {
			runId: 'run-7f3c',
			stage: 'preflight',
			message: 'probe P-001 answered leg L-001',
		}
		expect(renderDiagnostic(diagnostic)).toBe(
			'eval-quality: preflight: run-7f3c: probe P-001 answered leg L-001',
		)
	})
})

describe('renderError', () => {
	it('case 52: renders a StructuralFailure as eval-quality: <code>: <artifactPath>: <detail>', () => {
		const failure = new StructuralFailure(
			'oracle-missing-channel',
			'EvalContract/oracles[id=O-001]',
			'no channel carries the declared evidence target',
		)
		expect(renderError(failure)).toBe(
			'eval-quality: oracle-missing-channel: EvalContract/oracles[id=O-001]: no channel carries the declared evidence target',
		)
	})

	it('case 53: renders a RuntimeFault in the same shape', () => {
		const fault = new RuntimeFault(
			'schema-parse-failure',
			'EvalContract',
			'input does not parse as JSON',
		)
		expect(renderError(fault)).toBe(
			'eval-quality: schema-parse-failure: EvalContract: input does not parse as JSON',
		)
	})

	it('case 54: falls back to String(error) for a plain Error', () => {
		// What a defect in our own code looks like from outside: no code, no
		// artifact path.
		expect(renderError(new Error('boom'))).toBe('eval-quality: Error: boom')
	})
})

describe('renderUsage', () => {
	it('case 55: renders eval-quality: usage: <message>', () => {
		expect(renderUsage('unknown flag --nope')).toBe(
			'eval-quality: usage: unknown flag --nope',
		)
	})
})

describe('the digest agreement over rendered output', () => {
	it('case 56: digestArtifact equals digestBytes of the rendered text minus its trailing newline', () => {
		// AC 3's agreement carried through the CLI's own writer. digestArtifact
		// carries a `sha256:` prefix, so a bare sha256sum of stdout does not
		// match it.
		const text = renderArtifact(populatedContract, PATH)
		expect(text.endsWith('\n')).toBe(true)
		expect(digestBytes(new TextEncoder().encode(text.slice(0, -1)))).toBe(
			digestArtifact(populatedContract, PATH),
		)
	})

	it('case 177: the README exit-code table is the one `render.ts` publishes', () => {
		const readme = readFileSync(
			new URL('../../README.md', import.meta.url),
			'utf8',
		)
		// `render.ts` claims the help output and the README carry the same seven
		// lines. The README renders them as a markdown table and backticks the
		// flag names, so the comparison strips backticks and goes per row: the
		// code, then the words beside it.
		const rows = EXIT_CODE_TABLE.split('\n')
			.map((line) => line.match(/^ {2}(\d+) {2,}(.+)$/))
			.filter((match): match is RegExpMatchArray => match !== null)
		expect(rows).toHaveLength(7)
		const plain = readme.replaceAll('`', '')
		for (const [, code, text] of rows) {
			expect(plain).toContain(`| ${code} | ${text} |`)
		}
	})

	// Round 2 peer review, finding 3/4's class: guards against the exact
	// regression this table's own prose already had once (`score` shipping
	// while the trailing paragraph still said it did not).
	it('the trailing prose names score, never the old "ships in a later release" claim', () => {
		expect(EXIT_CODE_TABLE).toContain('score')
		expect(EXIT_CODE_TABLE).not.toMatch(/ships in a later release/)
		expect(EXIT_CODE_TABLE).not.toMatch(/no command here reaches/)
	})
})
