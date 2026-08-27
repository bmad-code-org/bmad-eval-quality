/**
 * Integration coverage for `core/compile/compile.ts`: proves orchestration
 * (call order, fail-fast, strict-mode gating, purity). Each check has its
 * own dedicated test file, unchanged by this story.
 */
import { describe, expect, it } from 'vitest'
import { canonicalize } from '../../src/core/canonical/canonicalize.ts'
import { compile } from '../../src/core/compile/compile.ts'
import { checkScriptingBound } from '../../src/core/compile/scripting-bound.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import type { CompileStage } from '../../src/core/stage-contracts.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
import { cleanPopulatedContract, structuralFailureOf } from './helpers.ts'

function compileClean(mutate?: (contract: any) => void, strict = true) {
	const contract = cleanPopulatedContract() as any
	mutate?.(contract)
	return compile(EvalContract.parse(contract), { strict })
}

// Story 4.4, AC 4: the assignment is the compile-time proof that `compile`
// conforms to `CompileStage` (stage-contracts.ts); a signature drift fails
// `npm run typecheck` right here. The call through the typed alias is then a
// runtime check that the conformance type didn't quietly narrow behavior.
describe('compile: conforms to the CompileStage conformance type (AD-34, AC 4)', () => {
	it('assigns to CompileStage and produces the same result called through that type', () => {
		const stage: CompileStage = compile
		const parsed = EvalContract.parse(gateCContract)
		expect(stage(parsed, { strict: true })).toEqual(
			compile(parsed, { strict: true }),
		)
	})
})

describe('compile: positive whole-contract regression', () => {
	it('populatedContract (scoped-resources cleared) and gateCContract compile successfully in default strict mode', () => {
		expect(() =>
			compile(EvalContract.parse(cleanPopulatedContract()), { strict: true }),
		).not.toThrow()
		expect(() =>
			compile(EvalContract.parse(gateCContract), { strict: true }),
		).not.toThrow()
	})
})

describe('compile: one reused negative mutation reaches each of the 26 wired functions, in call order', () => {
	it('1 checkRequirementLinkage: missing-requirement-linkage', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.behaviors[0].requirementLinks = []
				c.behaviors[0].riskLinks = []
			}),
		)
		expect(failure.code).toBe('missing-requirement-linkage')
		expect(failure.artifactPath).toContain('behaviors[id=B-001]')
	})

	it('2 checkObservableSuccessCriterion: no-observable-success-criterion', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.behaviors[0].observableSuccessCriterion = null
			}),
		)
		expect(failure.code).toBe('no-observable-success-criterion')
	})

	it('3 checkEvidenceReachability: unreachable-check-evidence', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.oracles[0].check.operands[1] = {
					pointer: '/interactions/no-such-step/response-body/items',
				}
			}),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
	})

	// A separate fixture from checks 5 and 6, even though all three share
	// `malformed-operator-expression` (this story's AC 7 item 2): a bare "@/"
	// pointer with no enclosing quantifier, distinct in shape from an illegal
	// reference-set operand position or a rejected regex construct.
	it('4 checkBoundElementScope: malformed-operator-expression (bound-element pointer with no enclosing quantifier)', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.oracles[0].check = { op: 'existence', operands: [{ pointer: '@/x' }] }
			}),
		)
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.message).toContain('bound-element pointer')
	})

	it('5 checkOperandLegality: malformed-operator-expression (reference-set operand at an illegal position)', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.oracles[0].check = {
					op: 'equality',
					operands: [
						{ referenceSet: 'expected-things' },
						{ referenceSet: 'expected-things' },
					],
				}
			}),
		)
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.message).toContain('does not accept a referenceSet operand')
	})

	it('6 checkRegexConstructs: malformed-operator-expression (rejected backreference construct)', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.oracles[0].check = {
					op: 'regex',
					operands: [{ pointer: '/interactions/list/response-body/items' }],
					pattern: '^(a)\\1$',
				}
			}),
		)
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.message).toContain('rejected construct')
	})

	it('7 checkQuantifierOverNonCollection: quantifier-over-non-collection', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.oracles[0].check = {
					op: 'for-all',
					collection: { pointer: '/interactions/create/response-body/id' },
					predicate: { op: 'existence', operands: [{ pointer: '@/x' }] },
				}
			}),
		)
		expect(failure.code).toBe('quantifier-over-non-collection')
	})

	it('8 checkQuantifierNesting: quantifier-nesting-exceeded', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.oracles[0].check = {
					op: 'for-all',
					collection: { pointer: '/interactions/list/response-body/items' },
					predicate: {
						op: 'for-any',
						collection: { pointer: '@/children' },
						predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
					},
				}
			}),
		)
		expect(failure.code).toBe('quantifier-nesting-exceeded')
	})

	it('9 checkReferenceSetResolution: unresolved-reference-set', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.oracles[0].check.operands[0] = { referenceSet: 'never-declared' }
			}),
		)
		expect(failure.code).toBe('unresolved-reference-set')
	})

	it('10 checkDuplicateOperationSignature: duplicate-operation-signature', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				const operations = c.permittedInterfaces[0].operations
				operations[1].pathTemplate = '/things/{id}'
				const twin = structuredClone(operations[1])
				twin.operationId = 'list-things-again'
				twin.pathTemplate = '/things/{identifier}'
				operations.push(twin)
			}),
		)
		expect(failure.code).toBe('duplicate-operation-signature')
	})

	it('11 checkUndeclaredMandatoryInput: undeclared-mandatory-input, only when strict is true', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.interactionPlan[0].inputBinding.body.undeclaredKey = { literal: 'x' }
			}, true),
		)
		expect(failure.code).toBe('undeclared-mandatory-input')
	})

	// Story 6.2 wired this and the two witness checks at the end of the file
	// without census cases, so the describe above claimed to enumerate every
	// wired function while covering 19 of 22. Cases 12, 25, and 26 close that.
	it('12 checkSensitivityWitnessDeclared: undeclared-mandatory-input, only when strict is true', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.permittedInterfaces[0].operations[0].sensitivityWitness = null
			}, true),
		)
		expect(failure.code).toBe('undeclared-mandatory-input')
		// Case 11 fires the same code from a different site, so the path is what
		// separates the two.
		expect(failure.artifactPath).toBe(
			'EvalContract.permittedInterfaces[0].operations[0]',
		)
	})

	it('13 checkOracleChannel: oracle-missing-channel', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.oracles[0].direction = null
			}),
		)
		expect(failure.code).toBe('oracle-missing-channel')
	})

	it('14 checkOracleAlignment: direction-check-misaligned', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.oracles[0].direction.relation = 'existence'
			}),
		)
		expect(failure.code).toBe('direction-check-misaligned')
	})

	it('15 checkInterfaceKind: unsupported-interface-kind', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.permittedInterfaces[0].kind = 'web'
			}),
		)
		expect(failure.code).toBe('unsupported-interface-kind')
	})

	it('16 checkNestedTemporalClause: nested-temporal-clause', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.interactionPlan.push({
					stepId: 'third',
					operationId: 'list-things',
					inputBinding: { path: null, query: null, header: null, body: null },
					after: 'list',
				})
			}),
		)
		expect(failure.code).toBe('nested-temporal-clause')
	})

	// Widens the existing two-step plan instead of replacing it (unlike
	// `scripting-bound.test.ts`'s own direct-call fixtures), so oracle O-001's
	// `check` still resolves against the `list` step and this mutation reaches
	// checkScriptingBound (position 17) instead of checkEvidenceReachability
	// (position 3).
	it('17 checkScriptingBound: plan-exceeds-scripting-bound (width)', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.interactionPlan = [
					c.interactionPlan[0],
					c.interactionPlan[1],
					{
						stepId: 'extra-1',
						operationId: 'list-things',
						inputBinding: { path: null, query: null, header: null, body: null },
						after: 'create',
					},
					{
						stepId: 'extra-2',
						operationId: 'list-things',
						inputBinding: { path: null, query: null, header: null, body: null },
						after: 'create',
					},
				]
			}),
		)
		expect(failure.code).toBe('plan-exceeds-scripting-bound')
	})

	it('18 checkRubricIdentifiers: rubric-unanchored', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.rubrics.push(structuredClone(c.rubrics[0]))
			}),
		)
		expect(failure.code).toBe('rubric-unanchored')
		expect(failure.artifactPath).toBe('EvalContract.rubrics[1].id')
	})

	it('19 checkRubricReasoningProse: rubric-scores-reasoning-prose', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.rubrics[0].criteria[0].text = 'Grade the reasoning in the response.'
			}),
		)
		expect(failure.code).toBe('rubric-scores-reasoning-prose')
	})

	it('20 checkRubricAnchoring: rubric-unanchored', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.rubrics[0].maxLength = null
			}),
		)
		expect(failure.code).toBe('rubric-unanchored')
	})

	it('21 checkRubricEvidenceReachability: rubric-evidence-unreachable', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.rubrics[0].criteria[0].evidence =
					'/interactions/no-such-step/response-body/items'
			}),
		)
		expect(failure.code).toBe('rubric-evidence-unreachable')
	})

	it('22 checkForbiddenInputFloor: forbidden-input-floor-incomplete', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.forbiddenInputs = ['original-spec']
			}),
		)
		expect(failure.code).toBe('forbidden-input-floor-incomplete')
	})

	it('23 checkScopedResourceReferences: scoped-reference-resolves-forbidden', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.scopedResources = [
					{ reference: 'the-original-spec', kind: 'document' },
				]
			}),
		)
		expect(failure.code).toBe('scoped-reference-resolves-forbidden')
	})

	it('24 checkWaiverCompleteness: waiver-incomplete', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.waivers[0].rule = null
			}),
		)
		expect(failure.code).toBe('waiver-incomplete')
	})

	it('25 checkWitnessLegIdentifiers: malformed-operator-expression', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				const witness =
					c.permittedInterfaces[0].operations[0].sensitivityWitness
				witness.legs[1].legId = witness.legs[0].legId
			}),
		)
		expect(failure.code).toBe('malformed-operator-expression')
	})

	it('26 checkWitnessLegality: malformed-operator-expression', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				const witness =
					c.permittedInterfaces[0].operations[0].sensitivityWitness
				witness.legs[1].inputs.body = structuredClone(
					witness.legs[0].inputs.body,
				)
			}),
		)
		expect(failure.code).toBe('malformed-operator-expression')
	})
})

describe('compile: multi-defect registry-order precedence', () => {
	it('a contract violating both check 1 and check 24 reports check 1 (missing-requirement-linkage), the earlier registry position', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.behaviors[0].requirementLinks = []
				c.behaviors[0].riskLinks = []
				c.waivers[0].rule = null
			}),
		)
		expect(failure.code).toBe('missing-requirement-linkage')
	})
})

describe('compile: the three malformed-operator-expression subchecks pin their own suborder', () => {
	it('all three conditions present (bound-element scope, illegal reference-set operand, rejected regex) report checkBoundElementScope first', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.oracles[0].check = {
					op: 'all',
					operands: [
						{ op: 'existence', operands: [{ pointer: '@/x' }] },
						{
							op: 'equality',
							operands: [
								{ referenceSet: 'expected-things' },
								{ referenceSet: 'expected-things' },
							],
						},
						{
							op: 'regex',
							operands: [{ pointer: '/interactions/list/response-body/items' }],
							pattern: '^(a)\\1$',
						},
					],
				}
			}),
		)
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.message).toContain('bound-element pointer')
	})

	it('bound-element scope absent, illegal reference-set operand and rejected regex both present: checkOperandLegality wins over checkRegexConstructs', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.oracles[0].check = {
					op: 'all',
					operands: [
						{
							op: 'equality',
							operands: [
								{ referenceSet: 'expected-things' },
								{ referenceSet: 'expected-things' },
							],
						},
						{
							op: 'regex',
							operands: [{ pointer: '/interactions/list/response-body/items' }],
							pattern: '^(a)\\1$',
						},
					],
				}
			}),
		)
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.message).toContain('does not accept a referenceSet operand')
	})
})

describe('compile: the Story 4.3 nested-chain fixture, through orchestration', () => {
	it('reports nested-temporal-clause (position 16), before checkScriptingBound (position 17) is ever reached', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				// Preserves `create`/`list` (oracle O-001's check depends on
				// `/interactions/list/...`) and extends the single-root chain past
				// `list`, matching Story 4.3's eight-step-chain shape.
				const rest = Array.from({ length: 6 }, (_, index) => ({
					stepId: `chain-${index + 3}`,
					operationId: 'list-things',
					inputBinding: { path: null, query: null, header: null, body: null },
					after: index === 0 ? 'list' : `chain-${index + 2}`,
				}))
				c.interactionPlan = [
					c.interactionPlan[0],
					c.interactionPlan[1],
					...rest,
				]
			}),
		)
		expect(failure.code).toBe('nested-temporal-clause')
	})

	it('the same contract still fails checkScriptingBound (plan-exceeds-scripting-bound) when that graph check is called directly, proving the two checks remain independent', () => {
		const contract = cleanPopulatedContract() as any
		const rest = Array.from({ length: 6 }, (_, index) => ({
			stepId: `chain-${index + 3}`,
			operationId: 'list-things',
			inputBinding: { path: null, query: null, header: null, body: null },
			after: index === 0 ? 'list' : `chain-${index + 2}`,
		}))
		contract.interactionPlan = [
			contract.interactionPlan[0],
			contract.interactionPlan[1],
			...rest,
		]
		const failure = structuralFailureOf(() =>
			checkScriptingBound(EvalContract.parse(contract)),
		)
		expect(failure.code).toBe('plan-exceeds-scripting-bound')
	})
})

describe('compile: strict mode gating', () => {
	it('strict true rejects an undeclared input', () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.interactionPlan[0].inputBinding.body.undeclaredKey = { literal: 'x' }
			}, true),
		)
		expect(failure.code).toBe('undeclared-mandatory-input')
	})

	it('strict false accepts that exact fixture', () => {
		expect(() =>
			compileClean((c) => {
				c.interactionPlan[0].inputBinding.body.undeclaredKey = { literal: 'x' }
			}, false),
		).not.toThrow()
	})

	it("adding a second, unrelated defect to the same non-strict fixture still rejects, under that other defect's code", () => {
		const failure = structuralFailureOf(() =>
			compileClean((c) => {
				c.interactionPlan[0].inputBinding.body.undeclaredKey = { literal: 'x' }
				c.waivers[0].rule = null
			}, false),
		)
		expect(failure.code).toBe('waiver-incomplete')
	})
})

describe('compile: determinism and non-mutation over a frozen input', () => {
	function deepFreeze<T>(value: T): T {
		if (
			value !== null &&
			typeof value === 'object' &&
			!Object.isFrozen(value)
		) {
			for (const key of Object.keys(value as object)) {
				deepFreeze((value as Record<string, unknown>)[key])
			}
			Object.freeze(value)
		}
		return value
	}

	it('two calls over the same frozen parsed contract return canonically byte-identical values and never mutate the input', () => {
		const parsed = deepFreeze(EvalContract.parse(gateCContract))
		const first = compile(parsed, { strict: true })
		const second = compile(parsed, { strict: true })
		const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes)
		expect(decode(canonicalize(first, 'first'))).toBe(
			decode(canonicalize(second, 'second')),
		)
		// `deepFreeze` above would itself throw a TypeError on any attempted
		// mutation, since ES modules are strict mode; reaching this line at all
		// is part of the proof.
		expect(parsed).toEqual(EvalContract.parse(gateCContract))
	})

	it('two calls over the same frozen invalid input throw the same failure code', () => {
		const invalid = deepFreeze(
			EvalContract.parse(
				(() => {
					const c = cleanPopulatedContract() as any
					c.behaviors[0].requirementLinks = []
					c.behaviors[0].riskLinks = []
					return c
				})(),
			),
		)
		const firstFailure = structuralFailureOf(() =>
			compile(invalid, { strict: true }),
		)
		const secondFailure = structuralFailureOf(() =>
			compile(invalid, { strict: true }),
		)
		expect(firstFailure.code).toBe(secondFailure.code)
		expect(firstFailure.artifactPath).toBe(secondFailure.artifactPath)
	})
})

describe('compile: Story 4.3 graph behavior remains unchanged through orchestration', () => {
	it('a dangling after reference stays permissive: adding one does not block compilation', () => {
		expect(() =>
			compileClean((c) => {
				c.interactionPlan.push({
					stepId: 'dangling',
					operationId: 'list-things',
					inputBinding: { path: null, query: null, header: null, body: null },
					after: 'ghost-step-that-does-not-exist',
				})
			}),
		).not.toThrow()
	})

	// The remaining AC 7 item 7 claims, re-proven through `compile()` in
	// addition to `scripting-bound.test.ts`'s direct calls. Every fixture
	// keeps `populatedContract`'s two steps (`create` -> `list`) and appends
	// to them: oracle O-001's check cites `/interactions/list/...`, and
	// `checkEvidenceReachability` runs nine positions earlier, so replacing
	// the whole plan would trip that check first and prove nothing about the
	// graph bounds.
	const step = (stepId: string, after: string | null) => ({
		stepId,
		operationId: 'list-things',
		inputBinding: { path: null, query: null, header: null, body: null },
		after,
	})
	const appended = (extra: ReturnType<typeof step>[]) => (c: any) => {
		c.interactionPlan = [...c.interactionPlan, ...extra]
	}
	const disjointPairs = (count: number) =>
		Array.from({ length: count }, (_, index) => [
			step(`pair-${index + 1}a`, null),
			step(`pair-${index + 1}b`, `pair-${index + 1}a`),
		]).flat()

	it('the schema still admits an adversarial plan: parsing succeeds and compilation is what rejects it', () => {
		const contract = cleanPopulatedContract() as any
		appended(
			Array.from({ length: 15 }, (_, index) => step(`solo-${index + 1}`, null)),
		)(contract)
		// No `.max()` entered the interaction-plan schema, so the adversarial
		// shape has to survive parsing for compilation to have anything to
		// reject.
		expect(() => EvalContract.parse(contract)).not.toThrow()
		const failure = structuralFailureOf(() =>
			compile(EvalContract.parse(contract), { strict: true }),
		)
		expect(failure.code).toBe('plan-exceeds-scripting-bound')
	})

	it.each([
		[
			'step count 16',
			Array.from({ length: 14 }, (_, index) => step(`solo-${index + 1}`, null)),
		],
		['width 2', [step('root', null), step('c1', 'root'), step('c2', 'root')]],
		[
			'shared anchors 2',
			[
				step('a1', null),
				step('a1c1', 'a1'),
				step('a1c2', 'a1'),
				step('a2', null),
				step('a2c1', 'a2'),
				step('a2c2', 'a2'),
			],
		],
		['disjoint pairs 4', disjointPairs(3)],
	])('%s: at the bound, compilation still succeeds', (_label, extra) => {
		expect(() => compileClean(appended(extra))).not.toThrow()
	})

	it.each([
		[
			'step count 17',
			Array.from({ length: 15 }, (_, index) => step(`solo-${index + 1}`, null)),
			'declares 17 steps',
		],
		[
			'width 3',
			[
				step('root', null),
				step('c1', 'root'),
				step('c2', 'root'),
				step('c3', 'root'),
			],
			'anchors 3 other steps',
		],
		[
			'shared anchors 3',
			[
				step('a1', null),
				step('a1c1', 'a1'),
				step('a1c2', 'a1'),
				step('a2', null),
				step('a2c1', 'a2'),
				step('a2c2', 'a2'),
				step('a3', null),
				step('a3c1', 'a3'),
				step('a3c2', 'a3'),
			],
			'3 steps each anchor',
		],
		['disjoint pairs 5', disjointPairs(4), '5 mutually disjoint'],
	])(
		'%s: one past the bound, compilation reports plan-exceeds-scripting-bound on that dimension',
		(_label, extra, expectedFragment) => {
			const failure = structuralFailureOf(() => compileClean(appended(extra)))
			expect(failure.code).toBe('plan-exceeds-scripting-bound')
			expect(failure.message).toContain(expectedFragment)
		},
	)

	it('duplicate stepIds remain distinct graph nodes through orchestration (Story 4.3 fixture 20)', () => {
		// Three synthetic pairs plus `populatedContract`'s own `create` ->
		// `list` pair make four disjoint pairs on their own, legal at the
		// bound. The two steps spelled `dup-child` anchor to different roots:
		// unmerged they add two more pairs (six, over the bound, throws). If
		// they instead collapsed into one node keyed by the string
		// `dup-child`, the scan would find one three-node component, not a
		// pair, and the total would stay at four and pass.
		const failure = structuralFailureOf(() =>
			compileClean(
				appended([
					...disjointPairs(3),
					step('anchor-1', null),
					step('dup-child', 'anchor-1'),
					step('anchor-2', null),
					step('dup-child', 'anchor-2'),
				]),
			),
		)
		expect(failure.code).toBe('plan-exceeds-scripting-bound')
		expect(failure.message).toContain('6 mutually disjoint')
	})

	it('a genuine three-node component alongside the same three pairs stays legal, pinning the pair count at size exactly two', () => {
		expect(() =>
			compileClean(
				appended([
					...disjointPairs(3),
					step('trio-root', null),
					step('trio-c1', 'trio-root'),
					step('trio-c2', 'trio-root'),
				]),
			),
		).not.toThrow()
	})
})
