// Check three of four (Story 1.5, AC 7): zero disagreements between Zod
// acceptance and published-schema acceptance over the generated corpus plus
// every accept fixture and every hand-written reject case. A disagreement in
// either direction is a published schema lying to a non-TypeScript consumer,
// which is the failure AD-13 exists to prevent.

import { describe, expect, it } from 'vitest'
import {
	INTERCHANGE_ARTIFACT_KEYS,
	INTERCHANGE_ARTIFACTS,
} from '../../../src/core/schemas/artifact.ts'
import { CONSTRAINT_LEDGER } from '../../../src/core/schemas/constraint-ledger.ts'
import { ARTIFACT_REJECT_CASES } from '../fixtures/artifact-reject-cases.ts'
import { REJECT_CASES } from '../fixtures/reject-cases.ts'
import { corpusOf, generationOf, rejectInstancesOf, seedsOf } from './corpus.ts'
import { pointerMatchesSchemaPath } from './keyword-occurrences.ts'
import { publishedDocumentOf, publishedValidatorOf } from './validator.ts'

// One named budget rather than a bare literal repeated per call site, matching
// `SWEEP_TIMEOUT_MS` in keyword-mutation.test.ts. It applies to the corpus
// tests too: whichever test calls `generationOf('eval-contract')` first pays
// the whole cold-cache generation, measured at about 1.1 s here and CPU-bound,
// so leaving those on Vitest's 5 s default puts checks three and four one busy
// runner away from going red for a timing reason rather than a schema one.
const CORPUS_TIMEOUT_MS = 120_000

describe('the corpus itself, so a hollow differential cannot pass', () => {
	it('carries every hand-written reject case exactly once across the twelve', () => {
		const total = INTERCHANGE_ARTIFACT_KEYS.reduce(
			(count, key) => count + rejectInstancesOf(key).length,
			0,
		)
		expect(total).toBe(REJECT_CASES.length + ARTIFACT_REJECT_CASES.length)
		// the 44/68/112 corpus size is also pinned in published-rejection.test.ts
		expect(total).toBe(112)
	})

	it.each(INTERCHANGE_ARTIFACT_KEYS)(
		'%s has at least one seed and a generated mutant corpus',
		(key) => {
			expect(seedsOf(key).length).toBeGreaterThan(0)
			expect(generationOf(key).mutants.length).toBeGreaterThan(0)
		},
		CORPUS_TIMEOUT_MS,
	)

	// The generator never emits a non-finite number, and every member survives a
	// JSON round trip byte-identically — the AD-36 numeric-domain restraint the
	// ledger's `json-value-numeric-domain` entry demands of this check.
	it.each(INTERCHANGE_ARTIFACT_KEYS)(
		'%s corpus is JSON-clean: finite numbers, lossless round trip',
		(key) => {
			// NaN and Infinity stringify to null, so a lossless round trip is the
			// finiteness proof; the deliberate just-outside-safe-range integers the
			// `maximum` mutants use sit on exact binary64 values and survive too.
			// toStrictEqual, not toEqual: toEqual ignores undefined-valued
			// properties, so `{ a: undefined }` would pass although it is not
			// JSON-representable.
			for (const member of corpusOf(key)) {
				expect(
					JSON.parse(JSON.stringify(member.value)),
					member.id,
				).toStrictEqual(member.value)
			}
		},
		CORPUS_TIMEOUT_MS,
	)
})

describe('check three: the differential over generated inputs', () => {
	it.each(INTERCHANGE_ARTIFACT_KEYS)(
		'%s: Zod and the published document agree on every corpus member',
		(key) => {
			const schema = INTERCHANGE_ARTIFACTS[key].schema
			const validate = publishedValidatorOf(key)
			const disagreements: string[] = []
			for (const member of corpusOf(key)) {
				const zodVerdict = schema.safeParse(member.value).success
				const publishedVerdict = validate(member.value) === true
				if (zodVerdict === publishedVerdict) continue
				disagreements.push(
					`${key} ${member.id}: zod=${zodVerdict} published=${publishedVerdict} ` +
						`first errors: ${JSON.stringify(validate.errors?.slice(0, 3) ?? [])}`,
				)
			}
			expect(disagreements).toEqual([])
		},
		CORPUS_TIMEOUT_MS,
	)

	// The proof-of-concept case for the whole check, kept explicit: with the
	// `minProperties: 1` injection applied, an empty channel map is rejected at
	// its exact address and `null` stays accepted.
	it('rejects the empty input-binding channel map and accepts null, like Zod', () => {
		const validate = publishedValidatorOf('eval-contract')
		const schema = INTERCHANGE_ARTIFACTS['eval-contract'].schema
		const emptied = structuredClone(seedsOf('eval-contract')[0]!.value) as any
		emptied.interactionPlan[0].inputBinding.query = {}
		expect(schema.safeParse(emptied).success).toBe(false)
		expect(validate(emptied)).toBe(false)
		expect(
			(validate.errors ?? []).some(
				(error) =>
					error.keyword === 'minProperties' &&
					error.instancePath === '/interactionPlan/0/inputBinding/query',
			),
		).toBe(true)
		const nulled = structuredClone(seedsOf('eval-contract')[0]!.value) as any
		nulled.interactionPlan[0].inputBinding.query = null
		expect(schema.safeParse(nulled).success).toBe(true)
		expect(validate(nulled)).toBe(true)
	})

	// Cross-field rules are not-expressible and not enforced by Zod either, so
	// they must produce no disagreement — confirmed rather than assumed, as the
	// ledger's lineage entries demand.
	it('accepts a broken lineage biconditional on both sides', () => {
		const validate = publishedValidatorOf('eval-contract')
		const schema = INTERCHANGE_ARTIFACTS['eval-contract'].schema
		const mutant = structuredClone(seedsOf('eval-contract')[0]!.value) as any
		mutant.parentDigest = null
		mutant.revisionCount = 3
		expect(schema.safeParse(mutant).success).toBe(true)
		expect(validate(mutant)).toBe(true)
	})
})

describe('each injected ledger entry is paired with its own fixture (AD-13)', () => {
	const injectEntries = CONSTRAINT_LEDGER.filter(
		(entry) => entry.disposition.kind === 'inject',
	)

	// The count of thirteen is also pinned in publish.test.ts ("has thirteen
	// inject entries") and arithmetically in constraint-ledger.test.ts.
	it('walks all thirteen inject entries', () => {
		expect(injectEntries).toHaveLength(13)
	})

	/** the entry's stated address as an occurrence pointer in its document. */
	const addressPointer = (entry: (typeof injectEntries)[number]): string => {
		const document = publishedDocumentOf(entry.location.artifact) as any
		const definition =
			entry.location.kind === 'root'
				? document
				: document.$defs[entry.location.name]
		if (definition === undefined)
			throw new Error(`${entry.id}: the stated definition does not exist`)
		let pointer =
			entry.location.kind === 'root' ? '' : `/$defs/${entry.location.name}`
		let target = definition
		if (entry.branch !== null) {
			const index = definition.oneOf.findIndex(
				(candidate: any) => candidate.properties?.op?.const === entry.branch,
			)
			if (index < 0)
				throw new Error(
					`${entry.id}: no oneOf branch carries op const "${entry.branch}"`,
				)
			pointer = `${pointer}/oneOf/${index}`
			target = definition.oneOf[index]
		}
		// The field segment applies whether or not the entry names a branch: a
		// branch-null, field-non-null address is a plain property of the shape.
		if (entry.field !== null) {
			if (target.properties === undefined)
				throw new Error(
					`${entry.id}: the located shape has no properties object, so its address has no single pointer (the union-root fallback spreads the field across branches)`,
				)
			pointer = `${pointer}/properties/${entry.field}`
		}
		return pointer
	}

	// A corpus that happens to cover them is not the same as a pairing that is
	// asserted: for every injected keyword of every entry, the corpus member
	// BUILT to violate that occurrence is rejected with that keyword, at that
	// member's own instance path and at the entry's stated schema address.
	//
	// Both halves are required. `pointerMatchesSchemaPath` reads ajv's
	// def-relative `schemaPath` and documents one residual slack — two `$defs`
	// entries sharing an internal path are indistinguishable from `schemaPath`
	// alone — which it contains by requiring every call site to pin the instance
	// path as well. This is the call site AD-13's pairing requirement rests on,
	// so it pins it: the witness is looked up by `occurrencePointer` rather than
	// found by scanning, and its `instancePointer` is asserted against the
	// reported `instancePath`.
	it.each(injectEntries)(
		'$id has the fixture built for each of its injected keywords, rejected at its address',
		(entry) => {
			if (entry.disposition.kind !== 'inject')
				throw new Error('not an injection')
			const validate = publishedValidatorOf(entry.location.artifact)
			const pointer = addressPointer(entry)
			const generated = generationOf(entry.location.artifact).mutants
			for (const keyword of Object.keys(entry.disposition.keywords)) {
				const keywordPointer = `${pointer}/${keyword}`
				const paired = generated.filter(
					(mutant) => mutant.occurrencePointer === keywordPointer,
				)
				expect(
					paired.length,
					`${entry.id}: no mutant is paired with ${keyword} at ${keywordPointer}`,
				).toBeGreaterThan(0)
				const witnessed = paired.some((mutant) => {
					if (validate(mutant.value) === true) return false
					return (validate.errors ?? []).some(
						(error) =>
							error.keyword === keyword &&
							error.instancePath === mutant.instancePointer &&
							pointerMatchesSchemaPath(
								publishedDocumentOf(entry.location.artifact),
								keywordPointer,
								error.schemaPath,
							),
					)
				})
				expect(
					witnessed,
					`${entry.id}: no paired fixture is rejected with ${keyword} at ${keywordPointer} and its own instance path`,
				).toBe(true)
			}
		},
		CORPUS_TIMEOUT_MS,
	)
})
