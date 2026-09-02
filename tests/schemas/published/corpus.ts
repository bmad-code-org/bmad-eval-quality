// Per-artifact corpus assembly for the published-schema checks: every positive
// fixture Story 1.4 committed, every hand-written reject case, and the
// generated mutant corpus, in one deterministic list per artifact. One corpus
// serves both the differential check (AC 7) and the keyword-mutation sweep
// (AC 8), which is what makes the sweep tractable.

import type { InterchangeArtifactKey } from '../../../src/core/schemas/artifact.ts'
import {
	ARTIFACT_ACCEPT_FIXTURES,
	PROBE_CLASS_FIXTURES,
	QUALIFICATION_ROUTE_FIXTURES,
	UNION_BRANCH_FIXTURES,
} from '../fixtures/artifact-fixtures.ts'
import { ARTIFACT_REJECT_CASES } from '../fixtures/artifact-reject-cases.ts'
import { REJECT_CASES } from '../fixtures/reject-cases.ts'
import { RELEVANCE_CONTRACTS } from '../fixtures/relevance-contracts.ts'
import { generateMutants, type MutantGeneration } from './mutant-generator.ts'
import { publishedDocumentOf, publishedValidatorOf } from './validator.ts'

export type Seed = { readonly id: string; readonly value: unknown }

/**
 * Every positive fixture belonging to one artifact, not just the primary one:
 * a keyword inside a union branch the primary fixture doesn't take is
 * unreachable from that fixture alone (Story 1.4 supplies the branch
 * coverage).
 */
export const seedsOf = (key: InterchangeArtifactKey): readonly Seed[] => {
	const seeds: Seed[] = [
		{ id: `accept/${key}`, value: ARTIFACT_ACCEPT_FIXTURES[key] },
	]
	if (key === 'eval-contract')
		for (const { name, contract } of RELEVANCE_CONTRACTS)
			seeds.push({ id: `relevance/${name}`, value: contract })
	if (key === 'probe') {
		for (const fixture of PROBE_CLASS_FIXTURES)
			seeds.push({ id: fixture.id, value: fixture.value })
		// A second probe list, because AD-9's five routes do not sit one per
		// class. Named here rather than left to the class list: a keyword
		// reachable only through the fifth route's branch has no seed to flip
		// otherwise, and the mutation sweep reports it as unprotected.
		for (const fixture of QUALIFICATION_ROUTE_FIXTURES)
			seeds.push({ id: fixture.id, value: fixture.value })
	}
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
 * The full differential/mutation corpus for one artifact, computed once per
 * run and cached: an uncached call re-mutates every hand-written reject
 * instance and rebuilds ~2,248 generated mutants for nothing, since nothing
 * about the corpus changes between calls (measured: 3 ms cached total vs.
 * 2,331 ms to generate).
 *
 * Members are SHARED, not per-call copies; a caller that mutates one must
 * `structuredClone` it first, matching how `seedsOf` already behaves.
 *
 * Does not amortise across test files: Vitest isolates modules per file, so
 * each of the three published-schema test files builds its own generation.
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
