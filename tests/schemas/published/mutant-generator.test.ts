// The mutant generator's own tests (Story 1.5, AC 9): a handful of
// hand-checked mutants asserted against the keyword they target, so the
// generator is not trusted on its own say-so, plus the determinism guarantee
// that makes the corpus a pure function of the schemas and the fixtures.

import { describe, expect, it } from 'vitest'
import { generationOf, seedsOf } from './corpus.ts'
import { generateMutants } from './mutant-generator.ts'
import {
	compileDocument,
	publishedDocumentOf,
	publishedValidatorOf,
} from './validator.ts'

// Whichever test calls `generationOf(key)` first for a given document pays that
// document's whole cold-cache generation, which is CPU-bound and well past
// Vitest's 5 s default on a shared runner once a document is large. Every test
// that can be the first caller for its document carries this budget, so these
// tests aren't the suite's accidental timing canaries. Same named budget the
// differential and sweep files use.
const GENERATION_TIMEOUT_MS = 120_000

const mutantFor = (
	key: Parameters<typeof generationOf>[0],
	occurrencePointer: string,
	suffix = '',
) =>
	generationOf(key).mutants.find(
		(mutant) =>
			mutant.id ===
			(suffix === '' ? occurrencePointer : `${occurrencePointer}#${suffix}`),
	)

describe('hand-checked mutants, one per mutation family', () => {
	it('violates a pattern with a string of the right type', () => {
		const mutant = mutantFor(
			'artifact-reference',
			'/oneOf/0/properties/digest/pattern',
		)
		expect(mutant).toBeDefined()
		const digest = (mutant!.value as any).digest
		expect(typeof digest).toBe('string')
		expect(digest).not.toMatch(/^sha256:[0-9a-f]{64}$/)
		expect(mutant?.instancePointer).toBe('/digest')
	})

	it('deletes exactly the named key for a required-member mutant', () => {
		const mutant = mutantFor('scoring-policy', '/required', 'policyId')
		expect(mutant).toBeDefined()
		expect((mutant!.value as any).policyId).toBeUndefined()
		expect((mutant!.value as any).severityFloor).toBeDefined()
	})

	it(
		'builds the one-operand equality the injected minItems rejects',
		() => {
			const mutant = mutantFor(
				'eval-contract',
				'/$defs/Expression/oneOf/0/properties/operands/minItems',
			)
			expect(mutant).toBeDefined()
			expect(mutant?.keyword).toBe('minItems')
			const validate = publishedValidatorOf('eval-contract')
			expect(validate(mutant?.value)).toBe(false)
			expect(
				(validate.errors ?? []).some(
					(error) =>
						error.keyword === 'minItems' &&
						error.instancePath === mutant?.instancePointer,
				),
			).toBe(true)
		},
		GENERATION_TIMEOUT_MS,
	)

	it('builds the empty channel map the injected minProperties rejects', () => {
		const mutant = mutantFor(
			'eval-contract',
			'/$defs/InputBindingChannel/minProperties',
		)
		expect(mutant).toBeDefined()
		const validate = publishedValidatorOf('eval-contract')
		expect(validate(mutant?.value)).toBe(false)
		expect(
			(validate.errors ?? []).some(
				(error) => error.keyword === 'minProperties',
			),
		).toBe(true)
	})

	it('displaces a numeric bound by one', () => {
		const mutant = mutantFor(
			'scoring-policy',
			'/properties/minimumTrialCount/minimum',
		)
		expect(mutant).toBeDefined()
		expect((mutant!.value as any).minimumTrialCount).toBe(0)
	})

	it('adds one undeclared key against additionalProperties: false', () => {
		const mutant = mutantFor('scoring-policy', '/additionalProperties')
		expect(mutant).toBeDefined()
		expect((mutant!.value as any)['zz-undeclared']).toBeDefined()
	})

	// The boolean discriminator used to have no rejected single-violation
	// mutant: with the two branches differing only in `defects`' maximum, the
	// flipped boolean was the sibling branch's discriminator and the flipped
	// instance validated through it, so the pairing had to be a flip witness
	// (accepted intact, rejected once the const is deleted). AD-40's defect
	// signature ended that: it sits on the seeding branch alone, so a clean
	// control with `expectedClean` flipped to false is missing a required key
	// and a seeded probe flipped to true carries an undeclared one. Both
	// occurrences now carry an ordinary rejected mutant, and the flip pairing is
	// gone rather than merely unused.
	it(
		'rejects the flipped oneOf discriminator outright, on both branches',
		() => {
			const validate = publishedValidatorOf('probe')
			for (const branch of [0, 1]) {
				const mutant = mutantFor(
					'probe',
					`/oneOf/${branch}/properties/expectedClean/const`,
				)
				expect(mutant, `branch ${branch}`).toBeDefined()
				expect(validate(mutant?.value), `branch ${branch}`).toBe(false)
			}
		},
		GENERATION_TIMEOUT_MS,
	)

	it('rejects every non-flip mutant with the intact document', () => {
		const validate = publishedValidatorOf('scoring-policy')
		const { mutants } = generationOf('scoring-policy')
		expect(mutants.length).toBeGreaterThan(20)
		for (const mutant of mutants) {
			if (mutant.id.endsWith('#flip')) continue
			expect(validate(mutant.value), mutant.id).toBe(false)
		}
	})
})

// The flip pairing has no live document to fire on any more: `probe.schema.json`
// carries the only two boolean `const`s in the twelve, and since AD-40's defect
// signature landed on one branch alone both of them kill an ordinary mutant.
// The generator's fallback is still correct and still general, so it is
// exercised against the shape it exists for rather than deleted on the strength
// of today's corpus.
describe('the flip pairing, against the shape it exists for', () => {
	// Two branches identical but for the discriminator, which is exactly the
	// case with no rejected single-violation mutant: the flipped instance simply
	// validates through the sibling branch.
	const twoBranchBoolean: Record<string, unknown> = {
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		$id: 'https://example.invalid/two-branch-boolean',
		oneOf: [
			{
				type: 'object',
				additionalProperties: false,
				required: ['clean', 'label'],
				properties: {
					clean: { type: 'boolean', const: true },
					label: { type: 'string', minLength: 1 },
				},
			},
			{
				type: 'object',
				additionalProperties: false,
				required: ['clean', 'label'],
				properties: {
					clean: { type: 'boolean', const: false },
					label: { type: 'string', minLength: 1 },
				},
			},
		],
	}

	it('pairs a boolean discriminator that admits no rejected mutant', () => {
		const validate = compileDocument(twoBranchBoolean)
		const seed = { id: 'accept/two-branch', value: { clean: true, label: 'a' } }
		expect(validate(seed.value)).toBe(true)
		const { mutants } = generateMutants(twoBranchBoolean, [seed], validate)
		const flip = mutants.find(
			(mutant) => mutant.id === '/oneOf/0/properties/clean/const#flip',
		)
		expect(flip).toBeDefined()
		// Accepted intact, which is what makes it a witness rather than a mutant,
		// and rejected once the const goes, which is what makes the keyword
		// killable at all.
		expect(validate(flip?.value)).toBe(true)
		const collapsed = structuredClone(twoBranchBoolean) as any
		delete collapsed.oneOf[0].properties.clean.const
		expect(compileDocument(collapsed)(flip?.value)).toBe(false)
	})
})

describe('determinism: no randomness, no clock', () => {
	it('produces byte-identical output across two runs', () => {
		const document = publishedDocumentOf('probe')
		const seeds = seedsOf('probe')
		const validate = publishedValidatorOf('probe')
		const first = generateMutants(document, seeds, validate)
		const second = generateMutants(document, seeds, validate)
		expect(JSON.stringify(second.mutants)).toBe(JSON.stringify(first.mutants))
		expect(JSON.stringify(second.witnesses)).toBe(
			JSON.stringify(first.witnesses),
		)
		expect([...second.unreachable]).toEqual([...first.unreachable])
		// Two full generations over the probe document, and the coverage run
		// instruments every one of them. Measured at 4.1s locally under v8
		// coverage, and it exceeded the 5s default on a CI runner.
	}, 30000)
})

describe('witnesses are valid instances, on both sides of the differential', () => {
	it(
		'emits accepted witnesses for the fifteen unfixtured Expression branches',
		() => {
			const { witnesses } = generationOf('eval-contract')
			const expressionWitnesses = witnesses.filter((witness) =>
				witness.id.startsWith('witness/$defs/Expression/oneOf/'),
			)
			expect(expressionWitnesses.length).toBeGreaterThanOrEqual(15)
			const validate = publishedValidatorOf('eval-contract')
			for (const witness of expressionWitnesses)
				expect(validate(witness.value), witness.id).toBe(true)
		},
		GENERATION_TIMEOUT_MS,
	)
})
