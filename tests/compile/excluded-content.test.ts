/**
 * AD-18's exclusion, as a gate rather than as a comment.
 *
 * Before this, the whole decision was carried by one test that greps
 * `corpus/dev`, so a contract carrying a live-shaped token compiled clean under
 * strict and travelled onto the sealed brief. These cases pin both halves of the
 * line the pattern set is drawn on: a value-shaped secret fails, and a name an
 * author is supposed to write does not.
 */

import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import {
	EXCLUDED_CATEGORIES,
	EXCLUDED_VALUE_PATTERNS,
	scanExcludedContent,
} from '../../src/core/excluded-content.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { commandContract } from '../schemas/fixtures/command-contract.ts'

const compileWith = (mutate: (contract: Record<string, unknown>) => void) => {
	const draft = structuredClone(commandContract) as Record<string, unknown>
	mutate(draft)
	return () => compile(EvalContract.parse(draft), { strict: true })
}

/** the first behavior's description, which every contract fixture carries. */
const setDescription = (
	contract: Record<string, unknown>,
	text: string,
): void => {
	const [first] = contract.behaviors as { description: string }[]
	if (first === undefined) throw new Error('the fixture declares no behavior')
	first.description = text
}

describe('the AD-18 pattern set', () => {
	it.each([...EXCLUDED_VALUE_PATTERNS])(
		'$category / $regex still fires on its own sample',
		({ regex, fires }) => {
			expect(regex.test(fires)).toBe(true)
		},
	)

	it('names all six of AD-18 categories, including the one it cannot match', () => {
		expect(EXCLUDED_CATEGORIES).toHaveLength(6)
		expect(EXCLUDED_CATEGORIES).toContain('real names')
		expect(
			EXCLUDED_VALUE_PATTERNS.filter(
				(pattern) => pattern.category === 'real names',
			),
		).toEqual([])
	})

	it('does not fire on the budget integers this repository writes', () => {
		expect(
			scanExcludedContent(
				{ budget: { inputTokens: 4000, outputTokens: 1000 } },
				'x',
			),
		).toEqual([])
	})

	it('reads values and never keys, which is the line the set is drawn on', () => {
		expect(scanExcludedContent({ 'ada@example.com': 'ok' }, 'x')).toEqual([])
		expect(scanExcludedContent({ contact: 'ada@example.com' }, 'x')).toEqual([
			{
				category: 'email addresses',
				path: 'x.contact',
				match: 'ada@example.com',
			},
		])
	})

	it('descends arrays and objects to any depth, and paths what it found', () => {
		expect(
			scanExcludedContent(
				{ steps: [{ inputs: { env: { API_TOKEN: 'sk-abcdefghijklmnop' } } }] },
				'EvalContract',
			),
		).toEqual([
			{
				category: 'tokens',
				path: 'EvalContract.steps[0].inputs.env.API_TOKEN',
				match: 'sk-abcdefghijklmnop',
			},
		])
	})

	it('reports one category per string, so a match is not counted six times', () => {
		const hits = scanExcludedContent({ a: 'ada@example.com' }, 'x')
		expect(hits).toHaveLength(1)
	})
})

describe('compile, reading a contract for AD-18 excluded content', () => {
	it('compiles the fixture untouched', () => {
		expect(compileWith(() => {})).not.toThrow()
	})

	it.each([
		['a token with an issuer prefix', 'run with sk-abcdefghijklmnopqr'],
		['a bearer credential', 'Authorization: Bearer abcdefghijklmnopqrstuv'],
		['a PEM private key', '-----BEGIN RSA PRIVATE KEY-----'],
		['an email address', 'owned by ada@example.com'],
		['an account identifier', 'settles to GB29NWBK60161331926819'],
		['card-shaped content', 'charged 4111 1111 1111 1111'],
	])('refuses %s', (_label, text) => {
		const run = compileWith((contract) => {
			setDescription(contract, text)
		})
		expect(run).toThrow(StructuralFailure)
		expect(run).toThrow(/excluded-content-in-declaration/)
	})

	it('quotes nothing of what it found, since a failure message travels further than the contract', () => {
		const run = compileWith((contract) => {
			setDescription(contract, 'run with sk-abcdefghijklmnopqr')
		})
		expect(run).toThrow(/carries a value shaped like tokens/)
		expect(run).not.toThrow(/sk-abcdefghijklmnopqr/)
	})

	it('admits the names an author of an authentication contract has to write', () => {
		expect(
			compileWith((contract) => {
				setDescription(
					contract,
					'The password reset flow, whose api key and credentials rotate.',
				)
			}),
		).not.toThrow()
	})

	it('is unconditional, since AD-18 has no lenient reading', () => {
		const draft = structuredClone(commandContract) as Record<string, unknown>
		setDescription(draft, 'owned by ada@example.com')
		const parsed = EvalContract.parse(draft)
		expect(() => compile(parsed, { strict: false })).toThrow(
			/excluded-content-in-declaration/,
		)
	})
})
