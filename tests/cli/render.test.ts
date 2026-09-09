import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { Diagnostic } from '../../src/application/diagnostics.ts'
import { serializeArtifact } from '../../src/application/serialize.ts'
import {
	EXIT_CODE_TABLE,
	renderArtifact,
	renderDiagnostic,
	renderError,
	renderQualificationFailure,
	renderUsage,
} from '../../src/cli/render.ts'
import { digestArtifact, digestBytes } from '../../src/core/canonical/digest.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type { QualificationFailure } from '../../src/core/score/qualification.ts'
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

	it('case 182: prints the parse issues a schema-parse-failure carries as its cause', () => {
		// A contract author outside this repository has the published schema and
		// this message and nothing else. The first line names the code and the
		// artifact and stops there, so the issue list is the only thing that
		// says which field to edit.
		const parsed = EvalContract.safeParse({ contractId: 'not-a-contract' })
		expect(parsed.success).toBe(false)
		const fault = new RuntimeFault(
			'schema-parse-failure',
			'EvalContract',
			'input does not conform to the EvalContract schema',
			{ cause: parsed.success ? undefined : parsed.error },
		)
		const lines = renderError(fault).split('\n')
		expect(lines[0]).toBe(
			'eval-quality: schema-parse-failure: EvalContract: input does not conform to the EvalContract schema',
		)
		expect(lines.length).toBeGreaterThan(1)
		for (const line of lines.slice(1)) expect(line.startsWith('  ')).toBe(true)
		// Sorted, so two runs over the same input print the same bytes.
		const issues = lines.slice(1)
		expect([...issues].sort()).toEqual(issues)
	})

	it('case 183: locates an issue by an RFC 6901 pointer over the failing value', () => {
		const parsed = EvalContract.safeParse({
			...populatedContract,
			behaviors: [{ ...populatedContract.behaviors[0], severity: 'urgent' }],
		})
		expect(parsed.success).toBe(false)
		const fault = new RuntimeFault(
			'schema-parse-failure',
			'EvalContract',
			'input does not conform to the EvalContract schema',
			{ cause: parsed.success ? undefined : parsed.error },
		)
		expect(renderError(fault)).toContain('  /behaviors/0/severity: ')
	})

	it('case 184: counts the issues it did not print rather than emitting all of them', () => {
		// One missing required key can produce hundreds of issues. The first
		// line is the one that names the code, and a wall of text buries it.
		const issues = Array.from({ length: 25 }, (_, index) => ({
			code: 'custom' as const,
			path: [`field${String(index).padStart(2, '0')}`],
			message: 'invalid',
		}))
		const fault = new RuntimeFault(
			'schema-parse-failure',
			'EvalContract',
			'input does not conform to the EvalContract schema',
			{ cause: new z.ZodError(issues) },
		)
		const lines = renderError(fault).split('\n')
		expect(lines.length).toBe(22)
		expect(lines.at(-1)).toBe('  ... and 5 more')
	})

	it('case 185: prints no issue list for a fault carrying no Zod error', () => {
		const fault = new RuntimeFault(
			'digest-mismatch',
			'EvalContract',
			'the recomputed digest does not match',
			{ cause: new Error('boom') },
		)
		expect(renderError(fault)).toBe(
			'eval-quality: digest-mismatch: EvalContract: the recomputed digest does not match',
		)
	})

	it('case 186: names the expectation and never echoes the value that failed', () => {
		// A contract carries budgets, safety limits, and an environment channel,
		// and its own safetyLimits usually say no credential value reaches a log.
		// This renderer writes to stderr, so a Zod upgrade that started echoing
		// received values would turn every failed parse into a disclosure. The
		// one thing an issue message does quote is an unrecognized KEY name,
		// which is a field name rather than a value.
		const parsed = EvalContract.safeParse({
			schemaVersion: 'token-aaaaaaaaaaaa',
			contractId: 'TOKEN-BBBBBBBBBBBB',
			behaviors: [{ id: 'B-001', severity: 'token-cccccccccccc' }],
			forbiddenInputs: 'token-dddddddddddd',
		})
		expect(parsed.success).toBe(false)
		const fault = new RuntimeFault(
			'schema-parse-failure',
			'EvalContract',
			'input does not conform to the EvalContract schema',
			{ cause: parsed.success ? undefined : parsed.error },
		)
		const rendered = renderError(fault)
		for (const secret of [
			'token-aaaaaaaaaaaa',
			'TOKEN-BBBBBBBBBBBB',
			'token-cccccccccccc',
			'token-dddddddddddd',
		]) {
			expect(rendered).not.toContain(secret)
		}
		// The location is still named, so the message stays actionable.
		expect(rendered).toContain('  /behaviors/0/severity: ')
	})

	it('case 54: falls back to String(error) for a plain Error', () => {
		// What a defect in our own code looks like from outside: no code, no
		// artifact path.
		expect(renderError(new Error('boom'))).toBe('eval-quality: Error: boom')
	})
})

describe('renderQualificationFailure', () => {
	it('renders eval-quality: <code>: <artifactPath>: <detail>, the shape renderError uses', () => {
		const failure: QualificationFailure = {
			code: 'signature-absent',
			artifactPath: 'Probe[probeId=P-001].defectSignature',
			detail: 'a defect probe declaring no signature is unscoreable',
		}
		expect(renderQualificationFailure(failure)).toBe(
			'eval-quality: signature-absent: Probe[probeId=P-001].defectSignature: a defect probe declaring no signature is unscoreable',
		)
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
