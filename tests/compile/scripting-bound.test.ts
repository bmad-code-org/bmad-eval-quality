import { describe, expect, it } from 'vitest'
import {
	checkNestedTemporalClause,
	checkScriptingBound,
} from '../../src/core/compile/scripting-bound.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'
import { structuralFailureOf } from './helpers.ts'

/** A minimal step: unbound on every channel, naming `list-things` (populatedContract's own second operation) so only the graph shape (`stepId`/`after`) is under test. */
function step(stepId: string, after: string | null): any {
	return {
		stepId,
		operationId: 'list-things',
		inputBinding: { path: null, query: null, header: null, body: null },
		after,
	}
}

/** `populatedContract`, cloned, with its `interactionPlan` replaced by a custom graph shape. */
function contractWithPlan(plan: readonly any[]): any {
	const contract = structuredClone(populatedContract) as any
	contract.interactionPlan = plan
	return contract
}

// The next three reuse `ad5-admissions.test.ts`'s (lines 188-232) own already-
// admitted mutations verbatim, per this story's Dev Notes instruction to reuse
// rather than approximate.

/** `ad5-admissions.test.ts`'s `nested-temporal-clause` mutation: a third step naming `list`, which itself carries a clause. */
function nestedTemporalClauseMutation(): any {
	const contract = structuredClone(populatedContract) as any
	contract.interactionPlan.push({
		stepId: 'third',
		operationId: 'list-things',
		inputBinding: { path: null, query: null, header: null, body: null },
		after: 'list',
	})
	return contract
}

/** `ad5-admissions.test.ts`'s sixty-four independent `write-N`/`read-N` pairs. */
function sixtyFourPairMutation(): any {
	const contract = structuredClone(populatedContract) as any
	contract.interactionPlan = Array.from({ length: 64 }, (_, index) => [
		{
			stepId: `write-${index + 1}`,
			operationId: 'create-thing',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { name: { matcher: 'any' } },
			},
			after: null,
		},
		{
			stepId: `read-${index + 1}`,
			operationId: 'list-things',
			inputBinding: { path: null, query: null, header: null, body: null },
			after: `write-${index + 1}`,
		},
	]).flat()
	return contract
}

/** `ad5-admissions.test.ts`'s eight-step single-root chain. */
function eightStepChainMutation(): any {
	const contract = structuredClone(populatedContract) as any
	contract.interactionPlan = Array.from({ length: 8 }, (_, index) => ({
		stepId: `chain-${index + 1}`,
		operationId: 'list-things',
		inputBinding: { path: null, query: null, header: null, body: null },
		after: index === 0 ? null : `chain-${index}`,
	}))
	return contract
}

describe('checkNestedTemporalClause: nested-temporal-clause', () => {
	it('fixture 1: passes with no throw against populatedContract and gateCContract', () => {
		expect(() =>
			checkNestedTemporalClause(EvalContract.parse(populatedContract)),
		).not.toThrow()
		expect(() =>
			checkNestedTemporalClause(EvalContract.parse(gateCContract)),
		).not.toThrow()
	})

	it("fixture 3: ad5-admissions.test.ts's nested-temporal-clause mutation throws, code and artifactPath naming the nested step", () => {
		const failure = structuralFailureOf(() =>
			checkNestedTemporalClause(nestedTemporalClauseMutation()),
		)
		expect(failure.code).toBe('nested-temporal-clause')
		expect(failure.artifactPath).toBe(
			'EvalContract.interactionPlan[stepId=third].after',
		)
	})

	it("fixture 4: gateCContract's own submit -> {poll, first-page} shared-anchor shape does not throw (width alone never trips nesting)", () => {
		expect(() =>
			checkNestedTemporalClause(EvalContract.parse(gateCContract)),
		).not.toThrow()
	})

	it('fixture 5: a step whose after names an undeclared step id does not throw (Decision 4: permissive dangling reference)', () => {
		const contract = contractWithPlan([step('a', 'ghost')])
		expect(() => checkNestedTemporalClause(contract)).not.toThrow()
	})

	it("fixture 6: ad5-admissions.test.ts's sixty-four-pair mutation does not throw (every pair is exactly one level, proving the split between the two codes is real)", () => {
		expect(() =>
			checkNestedTemporalClause(sixtyFourPairMutation()),
		).not.toThrow()
	})

	it("fixture 7: ad5-admissions.test.ts's eight-step chain mutation throws too, artifactPath naming chain-3 (the first nested link)", () => {
		const failure = structuralFailureOf(() =>
			checkNestedTemporalClause(eightStepChainMutation()),
		)
		expect(failure.code).toBe('nested-temporal-clause')
		expect(failure.artifactPath).toBe(
			'EvalContract.interactionPlan[stepId=chain-3].after',
		)
	})
})

describe('checkScriptingBound: plan-exceeds-scripting-bound', () => {
	it('fixture 2: passes with no throw against populatedContract and gateCContract', () => {
		expect(() =>
			checkScriptingBound(EvalContract.parse(populatedContract)),
		).not.toThrow()
		expect(() =>
			checkScriptingBound(EvalContract.parse(gateCContract)),
		).not.toThrow()
	})

	it("fixture 8: ad5-admissions.test.ts's eight-step chain mutation throws, message naming the one-level bound", () => {
		const failure = structuralFailureOf(() =>
			checkScriptingBound(eightStepChainMutation()),
		)
		expect(failure.code).toBe('plan-exceeds-scripting-bound')
		expect(failure.message).toContain('one-level bound')
	})

	it("fixture 9: ad5-admissions.test.ts's sixty-four-pair mutation throws on the disjoint-pair dimension specifically, not width or depth", () => {
		const failure = structuralFailureOf(() =>
			checkScriptingBound(sixtyFourPairMutation()),
		)
		expect(failure.code).toBe('plan-exceeds-scripting-bound')
		expect(failure.message).toContain('disjoint')
		expect(failure.message).not.toContain('width')
		expect(failure.message).not.toContain('one-level')
	})

	it('fixture 10: one root anchoring three children (WIDTH_MAX + 1) throws on width, and does not throw under checkNestedTemporalClause', () => {
		const contract = contractWithPlan([
			step('root', null),
			step('child-1', 'root'),
			step('child-2', 'root'),
			step('child-3', 'root'),
		])
		const failure = structuralFailureOf(() => checkScriptingBound(contract))
		expect(failure.code).toBe('plan-exceeds-scripting-bound')
		expect(failure.message).toContain('anchors 3 other steps')
		expect(() => checkNestedTemporalClause(contract)).not.toThrow()
	})

	it('fixture 11: one root anchoring exactly two children (WIDTH_MAX) does not throw (boundary-inclusive, paired with fixture 10)', () => {
		const contract = contractWithPlan([
			step('root', null),
			step('child-1', 'root'),
			step('child-2', 'root'),
		])
		expect(() => checkScriptingBound(contract)).not.toThrow()
	})

	it('fixture 12: three separate anchors, each with exactly two children, throws on shared anchors independently of maxWidth', () => {
		const contract = contractWithPlan([
			step('anchor-1', null),
			step('anchor-1-child-1', 'anchor-1'),
			step('anchor-1-child-2', 'anchor-1'),
			step('anchor-2', null),
			step('anchor-2-child-1', 'anchor-2'),
			step('anchor-2-child-2', 'anchor-2'),
			step('anchor-3', null),
			step('anchor-3-child-1', 'anchor-3'),
			step('anchor-3-child-2', 'anchor-3'),
		])
		const failure = structuralFailureOf(() => checkScriptingBound(contract))
		expect(failure.code).toBe('plan-exceeds-scripting-bound')
		expect(failure.message).toContain('3 steps each anchor')
	})

	it('fixture 13: seventeen fully isolated steps (STEP_COUNT_MAX + 1) throws on step count alone, every other dimension at zero', () => {
		const plan = Array.from({ length: 17 }, (_, index) =>
			step(`solo-${index + 1}`, null),
		)
		const failure = structuralFailureOf(() =>
			checkScriptingBound(contractWithPlan(plan)),
		)
		expect(failure.code).toBe('plan-exceeds-scripting-bound')
		expect(failure.message).toContain('declares 17 steps')
		expect(failure.message).not.toContain('width')
		expect(failure.message).not.toContain('anchor')
		expect(failure.message).not.toContain('disjoint')
	})

	it('fixture 14: a step whose after names an undeclared step id does not throw either, matching fixture 5 for the other function', () => {
		const contract = contractWithPlan([step('a', 'ghost')])
		expect(() => checkScriptingBound(contract)).not.toThrow()
	})

	it("fixture 16: the artifactPath on a thrown plan-exceeds-scripting-bound is exactly 'EvalContract.interactionPlan', the whole plan and never one step", () => {
		const plan = Array.from({ length: 17 }, (_, index) =>
			step(`solo-${index + 1}`, null),
		)
		const failure = structuralFailureOf(() =>
			checkScriptingBound(contractWithPlan(plan)),
		)
		expect(failure.artifactPath).toBe('EvalContract.interactionPlan')
	})

	it('fixture 17: two separate anchors, each with exactly two children (sharedAnchorCount at SHARED_ANCHOR_MAX) does not throw (boundary-inclusive, paired with fixture 12)', () => {
		const contract = contractWithPlan([
			step('anchor-1', null),
			step('anchor-1-child-1', 'anchor-1'),
			step('anchor-1-child-2', 'anchor-1'),
			step('anchor-2', null),
			step('anchor-2-child-1', 'anchor-2'),
			step('anchor-2-child-2', 'anchor-2'),
		])
		expect(() => checkScriptingBound(contract)).not.toThrow()
	})

	it('fixture 18: four mutually disjoint two-step pairs (disjointPairCount at DISJOINT_PAIR_MAX) does not throw (boundary-inclusive, paired with fixture 9)', () => {
		const plan = Array.from({ length: 4 }, (_, index) => [
			step(`pair-${index + 1}a`, null),
			step(`pair-${index + 1}b`, `pair-${index + 1}a`),
		]).flat()
		expect(() => checkScriptingBound(contractWithPlan(plan))).not.toThrow()
	})

	it('fixture 19: sixteen fully isolated steps (stepCount at STEP_COUNT_MAX) does not throw (boundary-inclusive, paired with fixture 13)', () => {
		const plan = Array.from({ length: 16 }, (_, index) =>
			step(`solo-${index + 1}`, null),
		)
		expect(() => checkScriptingBound(contractWithPlan(plan))).not.toThrow()
	})

	it('fixture 20: two distinct steps sharing one stepId, each with a different valid anchor, count as two separate pairs rather than merging into one three-node component (review finding: graph nodes are keyed by array position, not stepId)', () => {
		// Four genuine, uniquely-identified pairs contribute disjointPairCount=4
		// on their own (== DISJOINT_PAIR_MAX, legal by itself, matching fixture
		// 18). Two more steps, both spelled `dup-child` (schema-legal: `stepId`
		// carries no uniqueness constraint), each anchor to a distinct root
		// (`anchor-1`, `anchor-2`). Un-merged, those add two more disjoint
		// pairs (total 6, over the bound: throws). If the two `dup-child` nodes
		// wrongly collapsed into one graph node keyed by the string "dup-child",
		// the scan would instead find one three-node component
		// {anchor-1, dup-child, anchor-2} — size 3, not counted as a pair — and
		// the total would stay at 4, incorrectly passing.
		const plan = [
			...Array.from({ length: 4 }, (_, index) => [
				step(`pair-${index + 1}a`, null),
				step(`pair-${index + 1}b`, `pair-${index + 1}a`),
			]).flat(),
			step('anchor-1', null),
			step('dup-child', 'anchor-1'),
			step('anchor-2', null),
			step('dup-child', 'anchor-2'),
		]
		const failure = structuralFailureOf(() =>
			checkScriptingBound(contractWithPlan(plan)),
		)
		expect(failure.code).toBe('plan-exceeds-scripting-bound')
		expect(failure.message).toContain('6 mutually disjoint')
	})

	it('fixture 21: one three-node component alongside four genuine two-step pairs does not throw (review finding: pins disjointPairCount at exactly size === 2, catching a regression to size >= 2)', () => {
		// Four genuine pairs alone sit at disjointPairCount=4 (== DISJOINT_PAIR_MAX,
		// legal). Adding one three-node component (one anchor, two children,
		// all uniquely identified — no stepId duplication involved here) must
		// leave the count at 4, not 5: a component of size 3 is not a disjoint
		// *pair*. A regression from `size === 2` to `size >= 2` would count it
		// and push the total to 5, over the bound, throwing where this fixture
		// requires no throw.
		const plan = [
			...Array.from({ length: 4 }, (_, index) => [
				step(`pair-${index + 1}a`, null),
				step(`pair-${index + 1}b`, `pair-${index + 1}a`),
			]).flat(),
			step('trio-root', null),
			step('trio-child-1', 'trio-root'),
			step('trio-child-2', 'trio-root'),
		]
		expect(() => checkScriptingBound(contractWithPlan(plan))).not.toThrow()
	})
})

describe('nested-temporal-clause and plan-exceeds-scripting-bound on the same shape', () => {
	it("fixture 15: a two-step cycle throws under both checks, checkScriptingBound's message naming the one-level bound (Decision 1: no separate cycle detection needed)", () => {
		const contract = contractWithPlan([step('a', 'b'), step('b', 'a')])

		const nestingFailure = structuralFailureOf(() =>
			checkNestedTemporalClause(contract),
		)
		expect(nestingFailure.code).toBe('nested-temporal-clause')

		const boundFailure = structuralFailureOf(() =>
			checkScriptingBound(contract),
		)
		expect(boundFailure.code).toBe('plan-exceeds-scripting-bound')
		expect(boundFailure.message).toContain('one-level bound')
	})

	it('fixture 22: a step naming its own stepId as after (a self-loop) throws under both checks, and the connected-component scan does not loop forever on the resulting self-referential adjacency entry (found in round-2 review)', () => {
		const contract = contractWithPlan([step('self', 'self')])

		const nestingFailure = structuralFailureOf(() =>
			checkNestedTemporalClause(contract),
		)
		expect(nestingFailure.code).toBe('nested-temporal-clause')
		expect(nestingFailure.artifactPath).toBe(
			'EvalContract.interactionPlan[stepId=self].after',
		)

		const boundFailure = structuralFailureOf(() =>
			checkScriptingBound(contract),
		)
		expect(boundFailure.code).toBe('plan-exceeds-scripting-bound')
		expect(boundFailure.message).toContain('one-level bound')
	})

	it('fixture 23: a step naming a later-declared step as its after (a forward reference) passes both checks, since neither reads declaration order (AC 1 item 7, verified rather than asserted; found in round-2 review)', () => {
		const contract = contractWithPlan([step('a', 'b'), step('b', null)])
		expect(() => checkNestedTemporalClause(contract)).not.toThrow()
		expect(() => checkScriptingBound(contract)).not.toThrow()
	})

	it('fixture 24: a plan violating both width and step count at once reports width, the higher-priority dimension in the fixed ternary order, pinning that order against a regression (found in round-2 review)', () => {
		const plan = [
			step('root', null),
			step('child-1', 'root'),
			step('child-2', 'root'),
			step('child-3', 'root'),
			...Array.from({ length: 13 }, (_, index) =>
				step(`solo-${index + 1}`, null),
			),
		]
		const failure = structuralFailureOf(() =>
			checkScriptingBound(contractWithPlan(plan)),
		)
		expect(failure.message).toContain('anchors 3 other steps')
		expect(failure.message).not.toContain('declares')
	})

	it('fixture 25: an empty interactionPlan passes both checks (found in round-2 review)', () => {
		const contract = contractWithPlan([])
		expect(() => checkNestedTemporalClause(contract)).not.toThrow()
		expect(() => checkScriptingBound(contract)).not.toThrow()
	})

	it("fixture 26: a step whose declared parent itself has a dangling after does not throw under either check: the parent's own unresolved clause reads as no clause at all, matching Decision 4's stated intent rather than the parent's raw after field (found in round-2 review)", () => {
		const contract = contractWithPlan([step('b', 'ghost'), step('a', 'b')])
		expect(() => checkNestedTemporalClause(contract)).not.toThrow()
		expect(() => checkScriptingBound(contract)).not.toThrow()
	})
})
