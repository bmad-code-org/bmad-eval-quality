// The walk of AD-5's twenty codes, plus AD-28's schema-version-mismatch fault.
//
// The rule: where AD-5 gives the compiler a literal code, the schema ADMITS the
// shape and Epic 4 or Epic 5 rejects it. A schema tightened past a code does not
// make the product safer — it converts a coded, artifact-path-carrying
// structural error into an anonymous schema-parse-failure fault, and the two
// vocabularies are disjoint.
//
// Operator arity is the one deliberate exception, and the epic chose it.

import { describe, expect, it } from 'vitest'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { populatedContract } from './fixtures/relevance-contracts.ts'

const admits = (mutate: (contract: any) => void): void => {
	const contract = structuredClone(populatedContract) as any
	mutate(contract)
	const result = EvalContract.safeParse(contract)
	expect(result.error?.issues ?? []).toEqual([])
	expect(result.success).toBe(true)
}

const listThings = (contract: any) =>
	contract.permittedInterfaces[0].operations.find(
		(operation: any) => operation.operationId === 'list-things',
	)

describe('AD-5 code walk — every coded shape stays representable', () => {
	it('missing-requirement-linkage: both link arrays empty on a behaviour', () => {
		admits((contract) => {
			contract.behaviors[0].requirementLinks = []
			contract.behaviors[0].riskLinks = []
		})
	})

	it('no-observable-success-criterion: a null criterion', () => {
		admits((contract) => {
			contract.behaviors[0].observableSuccessCriterion = null
		})
	})

	it('no-observable-success-criterion: an empty oracle list parses and is not this code', () => {
		admits((contract) => {
			contract.oracles = []
			contract.behaviors[0].oracles = []
		})
	})

	it('oracle-missing-channel: a null direction', () => {
		admits((contract) => {
			contract.oracles[0].direction = null
		})
	})

	it('oracle-missing-channel: a null check', () => {
		admits((contract) => {
			contract.oracles[0].check = null
		})
	})

	it('direction-check-misaligned: targets, relation, and polarity all disagreeing with check', () => {
		admits((contract) => {
			contract.oracles[0].direction.evidenceTargets = [
				'/interactions/create/response-body/ok',
			]
			contract.oracles[0].direction.relation = 'existence'
			contract.oracles[0].direction.polarity = 'expects-violation'
		})
	})

	it('unreachable-check-evidence: a pointer naming an undeclared step', () => {
		admits((contract) => {
			contract.oracles[0].check.operands[1] = {
				pointer: '/interactions/no-such-step/response-body/items',
			}
		})
	})

	it('unreachable-check-evidence: an empty interaction plan', () => {
		admits((contract) => {
			contract.interactionPlan = []
		})
	})

	it('malformed-operator-expression: a reference-set operand outside AD-26 three legal positions', () => {
		admits((contract) => {
			contract.oracles[0].check = {
				op: 'equality',
				operands: [
					{ referenceSet: 'expected-things' },
					{ referenceSet: 'expected-things' },
				],
			}
		})
	})

	it('malformed-operator-expression: a regex carrying a backreference and one carrying a lookbehind', () => {
		admits((contract) => {
			contract.oracles[0].check = {
				op: 'regex',
				operands: [{ pointer: '/interactions/list/response-body/items' }],
				pattern: '^(a)\\1$',
			}
		})
		admits((contract) => {
			contract.oracles[0].check = {
				op: 'regex',
				operands: [{ pointer: '/interactions/list/response-body/items' }],
				pattern: '^(?<=a)b$',
			}
		})
	})

	it('quantifier-over-non-collection: a quantifier over a pointer the descriptor types as a scalar', () => {
		admits((contract) => {
			contract.oracles[0].check = {
				op: 'for-all',
				collection: { pointer: '/interactions/create/response-body/id' },
				predicate: { op: 'existence', operands: [{ pointer: '@/x' }] },
			}
		})
	})

	it('quantifier-nesting-exceeded: a quantifier inside a quantifier', () => {
		admits((contract) => {
			contract.oracles[0].check = {
				op: 'for-all',
				collection: { pointer: '/interactions/list/response-body/items' },
				predicate: {
					op: 'for-any',
					collection: { pointer: '@/children' },
					predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
				},
			}
		})
	})

	it('quantifier-nesting-exceeded: covers-by-key inside a quantifier', () => {
		admits((contract) => {
			contract.oracles[0].check = {
				op: 'for-all',
				collection: { pointer: '/interactions/list/response-body/items' },
				predicate: {
					op: 'covers-by-key',
					operands: [
						{ referenceSet: 'expected-things' },
						{ pointer: '@/rows' },
					],
					expectedKey: 'id',
					actualKey: 'id',
				},
			}
		})
	})

	it('unresolved-reference-set: an operand naming an identifier the contract does not declare', () => {
		admits((contract) => {
			contract.oracles[0].check.operands[0] = { referenceSet: 'never-declared' }
		})
	})

	// The code is about a collision "after parameter-name erasure", so the two
	// templates differ in the parameter name and agree on nothing else: erasing
	// the names makes both `/things/{}`. Identical strings would only exercise
	// the trivial case and leave the erasure untested in Story 4.2's fixture.
	it('duplicate-operation-signature: two operations colliding after parameter-name erasure', () => {
		admits((contract) => {
			const operations = contract.permittedInterfaces[0].operations
			operations[1].pathTemplate = '/things/{id}'
			const twin = structuredClone(operations[1])
			twin.operationId = 'list-things-again'
			twin.pathTemplate = '/things/{identifier}'
			operations.push(twin)
		})
	})

	it('undeclared-mandatory-input: a step binding a key the request shape does not declare', () => {
		admits((contract) => {
			contract.interactionPlan[0].inputBinding.body.undeclaredKey = {
				literal: 'x',
			}
		})
	})

	it('nested-temporal-clause: a temporal clause naming a step that carries one', () => {
		admits((contract) => {
			contract.interactionPlan.push({
				stepId: 'third',
				operationId: 'list-things',
				inputBinding: { path: null, query: null, header: null, body: null },
				after: 'list',
			})
		})
	})

	it('plan-exceeds-scripting-bound: sixty-four independent write/read pairs', () => {
		admits((contract) => {
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
		})
	})

	it('plan-exceeds-scripting-bound: an eight-step single-root chain', () => {
		admits((contract) => {
			contract.interactionPlan = Array.from({ length: 8 }, (_, index) => ({
				stepId: `chain-${index + 1}`,
				operationId: 'list-things',
				inputBinding: { path: null, query: null, header: null, body: null },
				after: index === 0 ? null : `chain-${index}`,
			}))
		})
	})

	it.each(['web', 'cli', 'mcp'])(
		'unsupported-interface-kind: a %s interface',
		(kind) => {
			admits((contract) => {
				contract.permittedInterfaces[0].kind = kind
			})
		},
	)

	it.each(['rule', 'rationale', 'approval', 'expiresAt'])(
		'waiver-incomplete: a waiver whose %s is null',
		(part) => {
			admits((contract) => {
				contract.waivers[0][part] = null
			})
		},
	)

	it('waiver-incomplete: a null condition is a complete waiver and also parses', () => {
		admits((contract) => {
			contract.waivers[0].condition = null
		})
	})

	it('forbidden-input-floor-incomplete: a list short of the seven', () => {
		admits((contract) => {
			contract.forbiddenInputs = ['original-spec']
		})
		admits((contract) => {
			contract.forbiddenInputs = []
		})
	})

	it('scoped-reference-resolves-forbidden: a scoped resource reference at all', () => {
		admits((contract) => {
			contract.scopedResources = [
				{ reference: 'the-original-spec', kind: 'document' },
			]
		})
	})

	it('rubric-unanchored: an unanchored scale, an unbounded length, and missing penalties', () => {
		admits((contract) => {
			contract.rubrics[0].scaleLevels = null
		})
		admits((contract) => {
			contract.rubrics[0].scaleLevels = []
		})
		admits((contract) => {
			contract.rubrics[0].maxLength = null
		})
		admits((contract) => {
			contract.rubrics[0].failureModePenalties = null
		})
	})

	it('rubric-evidence-unreachable: a criterion evidence pointer resolving nowhere', () => {
		admits((contract) => {
			contract.rubrics[0].criteria[0].evidence =
				'/interactions/no-such-step/response-body/items'
		})
	})

	it('rubric-scores-reasoning-prose: a criterion scoring stated reasoning', () => {
		admits((contract) => {
			contract.rubrics[0].criteria[0].text =
				'Score the quality of the reasoning the agent stated before answering.'
		})
	})

	it('schema-version-mismatch (AD-28): a non-equal schemaVersion parses', () => {
		admits((contract) => {
			contract.schemaVersion = 2
		})
	})
})

describe('operator arity — the one deliberate exception, recorded', () => {
	it('rejects a wrong-arity operator rather than admitting it', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check.operands = [{ referenceSet: 'expected-things' }]
		expect(EvalContract.safeParse(contract).success).toBe(false)
	})
})

describe('cross-field rules with no AD-5 code, unenforced in v0 by decision', () => {
	// AC 8's named exception: "where no code exists the schema enforces" collides
	// with "prefer pushing cross-field rules to the compiler". These are named
	// rather than silently dropped, so a later epic adds a code deliberately
	// instead of discovering the hole.
	it('admits a behaviour naming an oracle identifier no oracle declares', () => {
		admits((contract) => {
			contract.behaviors[0].oracles = ['O-999']
		})
	})

	it('admits a collection location naming a reference set the contract does not declare', () => {
		admits((contract) => {
			listThings(
				contract,
			).responseDescriptor.collectionLocations[0].referenceSet =
				'never-declared'
		})
	})

	it('admits a step naming an operation the inventory does not declare', () => {
		admits((contract) => {
			contract.interactionPlan[0].operationId = 'no-such-operation'
		})
	})

	it('admits a reference-set member missing a declared comparison key', () => {
		admits((contract) => {
			contract.referenceSets['expected-things'].members = [{ other: 'x' }]
		})
	})

	it('admits a descriptor key carrying no channel role', () => {
		admits((contract) => {
			listThings(contract).responseDescriptor.channelRoles = {}
		})
	})

	it('admits a rubric scale with duplicate and negative levels', () => {
		admits((contract) => {
			contract.rubrics[0].scaleLevels = [
				{ level: 1, anchor: 'first' },
				{ level: 1, anchor: 'also first' },
				{ level: -3, anchor: 'below the floor' },
			]
		})
	})

	it('admits a descriptor whose permitted keys do not cover its required keys', () => {
		admits((contract) => {
			listThings(contract).responseDescriptor.requiredKeys = ['items']
			listThings(contract).responseDescriptor.permittedKeys = []
		})
	})

	it('admits a lineage root whose revision count disagrees with its parent digest', () => {
		admits((contract) => {
			contract.parentDigest = null
			contract.revisionCount = 3
		})
	})
})
