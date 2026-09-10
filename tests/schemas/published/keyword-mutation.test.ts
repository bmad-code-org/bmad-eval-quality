// Check four of four (Story 1.5, AC 8): the keyword-mutation sweep. For every
// mutable keyword occurrence in every published document: delete it,
// recompile, and require at least one corpus member to change verdict. A
// keyword whose removal changes nothing is a keyword no fixture protects.
//
// Structurally unkillable occurrences are exempted by computed rule, never a
// hand list. Both the survivor list and the generator's unreachable list are
// asserted EQUAL to that computed set: a survivor outside it is a missing
// fixture, and an exempt occurrence that becomes killable means a schema
// changed under the exemption. Either way the check fails, which is what
// stops the exemption widening into a hole.

import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { INTERCHANGE_ARTIFACT_KEYS } from '../../../src/core/schemas/artifact.ts'
import { CONSTRAINT_LEDGER } from '../../../src/core/schemas/constraint-ledger.ts'
import {
	CENSUS_BY_DOCUMENT,
	CENSUS_BY_KEYWORD,
	CENSUS_TOTAL,
} from '../published-census.ts'
import { corpusOf, generationOf } from './corpus.ts'
import {
	exemptOccurrencePointers,
	mutableKeywordOccurrences,
	resolvePointer,
} from './keyword-occurrences.ts'
import {
	publishedDocumentOf,
	publishedValidatorOf,
	VALIDATOR_OPTIONS,
} from './validator.ts'

// The deletion sweep compiles the whole document once per occurrence, so the
// per-artifact budget is explicit rather than left to Vitest's default. It
// scales with the document, and the document has grown: 761 occurrences when
// this was first measured at ~16 s, 1108 after the command kind, and 1304 after
// the tool-call kind. At that size a CI runner measured 248 s for eval-contract
// against a 240 s budget, so the budget moves with the census. Raise it in the
// same change that raises `CENSUS_BY_DOCUMENT`, and read the number off a CI
// run rather than a laptop: the two differ by more than a factor of two.
const SWEEP_TIMEOUT_MS = 600_000

type SweepResult = {
	survivors: string[]
	uncompilable: string[]
	occurrenceCount: number
}

// Cached: the sweep compiles the document once per occurrence, and fixture 37
// asks the same two documents the parameterised check already swept.
const sweepCache = new Map<string, SweepResult>()

const sweep = (
	key: (typeof INTERCHANGE_ARTIFACT_KEYS)[number],
): SweepResult => {
	const cached = sweepCache.get(key)
	if (cached !== undefined) return cached
	const computed = computeSweep(key)
	sweepCache.set(key, computed)
	return computed
}

const computeSweep = (
	key: (typeof INTERCHANGE_ARTIFACT_KEYS)[number],
): SweepResult => {
	const document = publishedDocumentOf(key)
	const occurrences = mutableKeywordOccurrences(document)
	const corpus = corpusOf(key)
	const intact = publishedValidatorOf(key)
	const baseline = corpus.map((member) => intact(member.value) === true)
	const byOccurrence = new Map<string, unknown[]>()
	for (const mutant of generationOf(key).mutants) {
		const paired = byOccurrence.get(mutant.occurrencePointer) ?? []
		paired.push(mutant.value)
		byOccurrence.set(mutant.occurrencePointer, paired)
	}
	const survivors: string[] = []
	const uncompilable: string[] = []
	for (const occurrence of occurrences) {
		const mutated = structuredClone(document)
		const holder = resolvePointer(mutated, occurrence.nodePointer) as Record<
			string,
			unknown
		>
		delete holder[occurrence.keyword]
		let validate: ReturnType<Ajv2020['compile']>
		try {
			// A fresh instance per mutation (AC 10); `allErrors: false` because only
			// the verdict is read here. `strict` stays on, so a deletion ajv's strict
			// mode refuses is reported uncompilable and counted separately, not as a
			// pass.
			validate = new Ajv2020({
				...VALIDATOR_OPTIONS,
				allErrors: false,
			}).compile(mutated)
		} catch {
			uncompilable.push(occurrence.pointer)
			continue
		}
		let killed = false
		// the paired mutants first: deleting keyword K is expected to flip
		// exactly the instance built to violate K
		for (const value of byOccurrence.get(occurrence.pointer) ?? []) {
			if ((validate(value) === true) !== (intact(value) === true)) {
				killed = true
				break
			}
		}
		if (!killed) {
			for (let index = 0; index < corpus.length; index++) {
				if ((validate(corpus[index]!.value) === true) !== baseline[index]) {
					killed = true
					break
				}
			}
		}
		if (!killed) survivors.push(occurrence.pointer)
	}
	return { survivors, uncompilable, occurrenceCount: occurrences.length }
}

describe('the occurrence walk descends, so the sweep cannot pass hollow', () => {
	it('finds the full census across the twelve documents', () => {
		const byDocument: Record<string, number> = {}
		const byKeyword: Record<string, number> = {}
		let total = 0
		for (const key of INTERCHANGE_ARTIFACT_KEYS) {
			const occurrences = mutableKeywordOccurrences(publishedDocumentOf(key))
			byDocument[key] = occurrences.length
			total += occurrences.length
			for (const occurrence of occurrences)
				byKeyword[occurrence.keyword] = (byKeyword[occurrence.keyword] ?? 0) + 1
		}
		// Each of the three checks is independently load-bearing: the
		// per-document map catches a document dropping out of the walk, the
		// per-keyword map catches one keyword's descent being removed, and the
		// total catches an arithmetic slip in either.
		expect(byDocument).toEqual(CENSUS_BY_DOCUMENT)
		expect(byKeyword).toEqual(CENSUS_BY_KEYWORD)
		expect(total).toBe(CENSUS_TOTAL)
		expect(
			Object.values(CENSUS_BY_DOCUMENT).reduce((sum, count) => sum + count, 0),
		).toBe(CENSUS_TOTAL)
		expect(
			Object.values(CENSUS_BY_KEYWORD).reduce((sum, count) => sum + count, 0),
		).toBe(CENSUS_TOTAL)
	})
})

describe('check four: delete every keyword occurrence and require a verdict change', () => {
	// Deleting an injected arity keyword leaves `prefixItems` beside the other
	// half of the repair, which ajv's strictTuples refuses to compile: the same
	// third-party signal that caught the original arity hole. Those deletions
	// are uncompilable, not survivors, and the set is asserted exactly so
	// nothing else can hide in it. Fixtures for them are asserted in
	// differential.test.ts.
	const expectedUncompilable = (key: string): string[] => {
		const pointers: string[] = []
		for (const entry of CONSTRAINT_LEDGER) {
			if (entry.disposition.kind !== 'inject' || entry.branch === null) continue
			if (entry.location.artifact !== key) continue
			// derived from the entry's own stated address, never hardcoded, so a
			// relocated arity table cannot leave this expectation pointing at a
			// stale definition name or field
			if (entry.location.kind !== 'definition' || entry.field === null)
				throw new Error(
					`${entry.id}: a branch-addressed inject entry is expected to name a definition and a field`,
				)
			const document = publishedDocumentOf(entry.location.artifact) as any
			const index = document.$defs[entry.location.name].oneOf.findIndex(
				(candidate: any) => candidate.properties?.op?.const === entry.branch,
			)
			if (index < 0)
				throw new Error(
					`${entry.id}: no oneOf branch of ${entry.location.name} carries op const "${entry.branch}"`,
				)
			for (const keyword of Object.keys(entry.disposition.keywords))
				pointers.push(
					`/$defs/${entry.location.name}/oneOf/${index}/properties/${entry.field}/${keyword}`,
				)
		}
		return pointers.sort()
	}

	it.each(INTERCHANGE_ARTIFACT_KEYS)(
		'%s: survivors equal the computed exempt set, and so does the unreachable list',
		(key) => {
			const document = publishedDocumentOf(key)
			const exempt = exemptOccurrencePointers(document)
			const { survivors, uncompilable, occurrenceCount } = sweep(key)
			// the failure report names artifact plus keyword path, so a reader can
			// go straight to the shape that needs a fixture
			expect(
				survivors.filter((pointer) => !exempt.has(pointer)),
				`${key}: unprotected keyword occurrences (no fixture flips their deletion)`,
			).toEqual([])
			expect(
				[...exempt].filter((pointer) => !survivors.includes(pointer)),
				`${key}: exempt occurrences that became killable — a schema changed under the exemption rule`,
			).toEqual([])
			expect(uncompilable.sort(), `${key}: uncompilable deletions`).toEqual(
				expectedUncompilable(key),
			)
			// AC 9's gate: the generator's unreachable report equals the same set.
			const { unreachable } = generationOf(key)
			expect(
				[...unreachable].filter((pointer) => !exempt.has(pointer)).sort(),
				`${key}: generator gaps outside the exemption`,
			).toEqual([])
			expect(
				[...exempt].filter((pointer) => !unreachable.has(pointer)).sort(),
				`${key}: exempt occurrences the generator reached — the exemption rule is wrong`,
			).toEqual([])
			// the sweep swept the whole document, not a prefix of it
			expect(occurrenceCount, `${key}: occurrences swept`).toBe(
				CENSUS_BY_DOCUMENT[key],
			)
		},
		SWEEP_TIMEOUT_MS,
	)
})

// AD-10's witnesses moved both documents: `eval-contract` gained
// `WitnessInputs` and `probe` gained the whole expression grammar. Named as its
// own fixture because the additions are the ones a missing reject case would
// hide, and because it is the assertion Story 6.2's reject-case work is
// accountable to.
describe('the two documents Story 6.2 regenerated', () => {
	it.each(['eval-contract', 'probe'] as const)(
		'37. %s reports zero unprotected survivors after the witness additions',
		(key) => {
			const exempt = exemptOccurrencePointers(publishedDocumentOf(key))
			const { survivors } = sweep(key)
			expect(
				survivors.filter((pointer) => !exempt.has(pointer)),
				`${key}: keyword occurrences no fixture protects`,
			).toEqual([])
		},
		SWEEP_TIMEOUT_MS,
	)
})
