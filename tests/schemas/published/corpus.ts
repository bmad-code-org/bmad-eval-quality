// Per-artifact corpus assembly for the published-schema checks: every positive
// fixture Story 1.4 committed, every hand-written reject case, and the
// generated mutant corpus, in one deterministic list per artifact. One corpus
// serves both the differential check (AC 7) and the keyword-mutation sweep
// (AC 8), which is what makes the sweep tractable and the differential inputs
// meaningful rather than arbitrary.

import type { InterchangeArtifactKey } from '../../../src/core/schemas/artifact.ts'
import {
	ARTIFACT_ACCEPT_FIXTURES,
	PROBE_CLASS_FIXTURES,
	UNION_BRANCH_FIXTURES,
} from '../fixtures/artifact-fixtures.ts'
import { ARTIFACT_REJECT_CASES } from '../fixtures/artifact-reject-cases.ts'
import { REJECT_CASES } from '../fixtures/reject-cases.ts'
import { RELEVANCE_CONTRACTS } from '../fixtures/relevance-contracts.ts'
import { generateMutants, type MutantGeneration } from './mutant-generator.ts'
import { publishedDocumentOf, publishedValidatorOf } from './validator.ts'

export type Seed = { readonly id: string; readonly value: unknown }

/**
 * Every positive fixture belonging to one artifact. Seeded from every one of
 * them, not one per artifact: a keyword inside a union branch the primary
 * fixture does not take is unreachable from that fixture alone, and Story 1.4
 * supplied the branch coverage exactly for this.
 */
export const seedsOf = (key: InterchangeArtifactKey): readonly Seed[] => {
	const seeds: Seed[] = [
		{ id: `accept/${key}`, value: ARTIFACT_ACCEPT_FIXTURES[key] },
	]
	if (key === 'eval-contract')
		for (const { name, contract } of RELEVANCE_CONTRACTS)
			seeds.push({ id: `relevance/${name}`, value: contract })
	if (key === 'probe')
		for (const fixture of PROBE_CLASS_FIXTURES)
			seeds.push({ id: fixture.id, value: fixture.value })
	for (const fixture of UNION_BRANCH_FIXTURES)
		if (fixture.artifact === key)
			seeds.push({ id: fixture.id, value: fixture.value })
	// first occurrence of a duplicate wins; identity, not content, is enough
	// because the fixtures are module-level constants.
	const seen = new Set<unknown>()
	const unique: Seed[] = []
	for (const seed of seeds) {
		if (seen.has(seed.value)) continue
		seen.add(seed.value)
		unique.push(seed)
	}
	return unique
}

/** the hand-written reject cases, materialised as instances. */
export const rejectInstancesOf = (
	key: InterchangeArtifactKey,
): readonly Seed[] => {
	const instances: Seed[] = []
	if (key === 'eval-contract') {
		for (const rejectCase of REJECT_CASES) {
			const instance = structuredClone(
				ARTIFACT_ACCEPT_FIXTURES['eval-contract'],
			) as any
			rejectCase.mutate(instance)
			instances.push({ id: `reject/${rejectCase.id}`, value: instance })
		}
	}
	for (const rejectCase of ARTIFACT_REJECT_CASES) {
		if (rejectCase.artifact !== key) continue
		const instance = structuredClone(ARTIFACT_ACCEPT_FIXTURES[key]) as any
		rejectCase.mutate(instance)
		instances.push({ id: `reject/${rejectCase.id}`, value: instance })
	}
	return instances
}

const generationCache = new Map<InterchangeArtifactKey, MutantGeneration>()

/** the generated mutant corpus for one artifact, computed once per run. */
export const generationOf = (key: InterchangeArtifactKey): MutantGeneration => {
	const cached = generationCache.get(key)
	if (cached) return cached
	const generation = generateMutants(
		publishedDocumentOf(key),
		seedsOf(key),
		publishedValidatorOf(key),
	)
	generationCache.set(key, generation)
	return generation
}

export type CorpusMember = Seed & {
	readonly kind: 'accept' | 'reject' | 'mutant' | 'witness'
}

const corpusCache = new Map<InterchangeArtifactKey, readonly CorpusMember[]>()

/**
 * The full differential/mutation corpus for one artifact, computed once per run.
 *
 * Cached for the same reason `generationOf` is: the differential check walks the
 * corpus once per artifact for the validator agreement test and again for the
 * ledger pairing test, and each uncached call re-cloned and re-mutated every
 * hand-written reject instance and rebuilt a wrapper object for all ~2,248
 * generated mutants. Nothing about the corpus changes between calls.
 *
 * Do not expect this to show up in the suite's wall clock. Assembling all twelve
 * corpora measured at 3 ms total, against 2,331 ms to generate the mutants they
 * are assembled from and roughly 32 s for the four published-schema test files.
 * The cache is here because repeating work that cannot change is wrong, not
 * because it was the cost anyone should optimise next.
 *
 * The members are therefore SHARED, not per-call copies. A caller that needs to
 * mutate one must `structuredClone` it first, which is what the differential
 * tests already do for their hand-built cases. This matches how `seedsOf`
 * already behaved: it hands back the fixture constants themselves.
 *
 * This does not amortise across test FILES. Vitest isolates modules per file, so
 * `differential.test.ts`, `keyword-mutation.test.ts`, and
 * `mutant-generator.test.ts` each still build their own generation. Sharing one
 * across files would take `isolate: false` on the whole suite, which trades a
 * real isolation guarantee for a startup cost, and is not a trade worth making
 * here.
 */
export const corpusOf = (
	key: InterchangeArtifactKey,
): readonly CorpusMember[] => {
	const cached = corpusCache.get(key)
	if (cached) return cached
	const generation = generationOf(key)
	const corpus: readonly CorpusMember[] = [
		...seedsOf(key).map((seed) => ({ ...seed, kind: 'accept' as const })),
		...rejectInstancesOf(key).map((seed) => ({
			...seed,
			kind: 'reject' as const,
		})),
		...generation.mutants.map((mutant) => ({
			id: `mutant/${mutant.id}`,
			value: mutant.value,
			kind: 'mutant' as const,
		})),
		...generation.witnesses.map((witness) => ({
			id: witness.id,
			value: witness.value,
			kind: 'witness' as const,
		})),
	]
	corpusCache.set(key, corpus)
	return corpus
}
