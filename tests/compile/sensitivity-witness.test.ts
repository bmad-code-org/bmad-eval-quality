/**
 * AD-10's three declaration-side witness checks (Story 6.2). One `it` per
 * numbered fixture, each a single mutation of `cleanPopulatedContract()`,
 * asserting the AD-5 code and the artifact path rather than the message.
 *
 * The contract under mutation declares two operations: `create-thing` (POST,
 * `stateChangeMarker: true`, body key `name`, witness legs `create-witness-a`
 * and `create-witness-b`) and `list-things` (GET, marker false, query key
 * `limit`, legs `list-witness-a` and `list-witness-b`). Its interaction plan
 * declares the steps `create` and `list`.
 */
import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { cleanPopulatedContract, structuralFailureOf } from './helpers.ts'

const OPERATION_PATH = 'EvalContract.permittedInterfaces[0].operations[0]'
const WITNESS_PATH = `${OPERATION_PATH}.sensitivityWitness`

const mutated = (mutate: (contract: any) => void): EvalContract => {
	const contract = cleanPopulatedContract() as any
	mutate(contract)
	return EvalContract.parse(contract)
}

const failureOf = (mutate: (contract: any) => void, strict = true) =>
	structuralFailureOf(() => {
		compile(mutated(mutate), { strict })
	})

const createWitness = (contract: any) =>
	contract.permittedInterfaces[0].operations[0].sensitivityWitness

const legPointer = (legId: string, tail = '') =>
	`/interactions/${legId}/response-body${tail}`

/** the relation the fixture ships with: a differential over both legs. */
const bothLegs = {
	op: 'deep-equality',
	operands: [
		{ pointer: legPointer('create-witness-a') },
		{ pointer: legPointer('create-witness-b') },
	],
}

const witnessInputs = (body: unknown) => ({
	path: {},
	query: {},
	header: {},
	body,
})

describe('checkSensitivityWitnessDeclared: AD-10 mandatory per declared operation', () => {
	it('18. fires undeclared-mandatory-input for a null witness on an input-bearing operation under strict', () => {
		const failure = failureOf((contract) => {
			contract.permittedInterfaces[0].operations[0].sensitivityWitness = null
		})
		expect(failure.code).toBe('undeclared-mandatory-input')
		expect(failure.artifactPath).toBe(OPERATION_PATH)
	})

	// The code's gating regime is the reason this check sits inside the strict
	// block: `checkUndeclaredMandatoryInput` is already gated there, and one
	// code with two regimes would be worse than one code with two conditions.
	it('19. compiles that same contract clean under strict: false', () => {
		expect(() =>
			compile(
				mutated((contract) => {
					contract.permittedInterfaces[0].operations[0].sensitivityWitness =
						null
				}),
				{ strict: false },
			),
		).not.toThrow()
	})

	it('20. fires undeclared-mandatory-input for a leg omitting a key the selected channel declares required', () => {
		const failure = failureOf((contract) => {
			createWitness(contract).legs[0].inputs.body = {
				kind: 'json',
				value: {},
			}
		})
		expect(failure.code).toBe('undeclared-mandatory-input')
		expect(failure.artifactPath).toBe(`${WITNESS_PATH}.legs[0]`)
	})

	it('21. fires undeclared-mandatory-input for a leg supplying a key the selected channel does not permit', () => {
		const failure = failureOf((contract) => {
			createWitness(contract).legs[1].inputs.body = {
				kind: 'json',
				value: { name: 'beta', colour: 'red' },
			}
		})
		expect(failure.code).toBe('undeclared-mandatory-input')
		expect(failure.artifactPath).toBe(`${WITNESS_PATH}.legs[1]`)
	})

	// The story's AC 7 table scoped the key rules to the selected channel.
	// `planPreflight` copies all four channels onto the `ProbeRequest` and the
	// port sends them, so an undeclared key on an unselected channel is an
	// outbound value the contract never declared. AD-18 makes the header case
	// the one that matters.
	it('115. fires undeclared-mandatory-input for a leg supplying a header key the operation does not declare', () => {
		const failure = failureOf((contract) => {
			createWitness(contract).legs[0].inputs.header = {
				authorization: 'Bearer redacted',
			}
		})
		expect(failure.code).toBe('undeclared-mandatory-input')
		expect(failure.artifactPath).toBe(`${WITNESS_PATH}.legs[0]`)
	})

	it('116. fires undeclared-mandatory-input for a leg omitting a required key of a channel the witness does not vary', () => {
		const failure = failureOf((contract) => {
			// `list-things` varies `query`; declaring a required `path` key leaves
			// both of its legs unable to issue the request at all.
			contract.permittedInterfaces[0].operations[1].requestShape.path = {
				requiredKeys: ['id'],
				permittedKeys: ['id'],
				types: { id: 'string' },
			}
		})
		expect(failure.code).toBe('undeclared-mandatory-input')
		expect(failure.artifactPath).toBe(
			'EvalContract.permittedInterfaces[0].operations[1].sensitivityWitness.legs[0]',
		)
	})

	it('117. fires malformed-operator-expression when both legs supply the same value on the selected channel', () => {
		const failure = failureOf((contract) => {
			createWitness(contract).legs[1].inputs.body = structuredClone(
				createWitness(contract).legs[0].inputs.body,
			)
		})
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.artifactPath).toBe(`${WITNESS_PATH}.legs`)
	})

	it("118. holds the fixture reset's own inputs to the same request shape", () => {
		const failure = failureOf((contract) => {
			contract.fixtureReset = {
				legId: 'reset-leg',
				interfaceId: 'thing-api',
				operationId: 'create-thing',
				inputs: witnessInputs({
					kind: 'json',
					value: { name: 'reset', colour: 'red' },
				}),
			}
		})
		expect(failure.code).toBe('undeclared-mandatory-input')
		expect(failure.artifactPath).toBe('EvalContract.fixtureReset.inputs')
	})

	it('32. compiles clean for an operation declaring no keys in any channel and no witness', () => {
		const emptyChannel = { requiredKeys: [], permittedKeys: [], types: {} }
		expect(() =>
			compile(
				mutated((contract) => {
					contract.permittedInterfaces[0].operations.push({
						operationId: 'ping-thing',
						method: 'GET',
						pathTemplate: '/ping',
						stateChangeMarker: false,
						requestShape: {
							path: emptyChannel,
							query: emptyChannel,
							header: emptyChannel,
							body: emptyChannel,
						},
						responseDescriptor: {
							requiredKeys: [],
							permittedKeys: [],
							types: {},
							successIndicator: null,
							channelRoles: null,
							collectionLocations: null,
						},
						volatilePointers: [],
						sensitivityWitness: null,
					})
				}),
				{ strict: true },
			),
		).not.toThrow()
	})

	it('33. compiles clean for the well-formed witnesses the fixture ships with', () => {
		expect(() =>
			compile(EvalContract.parse(cleanPopulatedContract()), { strict: true }),
		).not.toThrow()
	})
})

describe('checkWitnessLegality: the channel, the relation, and the fixture reset', () => {
	it('22. fires malformed-operator-expression for channel "body" on a non-mutating operation', () => {
		const failure = failureOf((contract) => {
			contract.permittedInterfaces[0].operations[0].stateChangeMarker = false
		})
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.artifactPath).toBe(WITNESS_PATH)
	})

	it('23. fires malformed-operator-expression for channel "path" on a mutating operation', () => {
		const failure = failureOf((contract) => {
			createWitness(contract).channel = 'path'
		})
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.artifactPath).toBe(WITNESS_PATH)
	})

	it('25. fires malformed-operator-expression when the relation addresses only one leg', () => {
		const failure = failureOf((contract) => {
			createWitness(contract).relation = {
				op: 'deep-equality',
				operands: [
					{ pointer: legPointer('create-witness-a') },
					{ literal: 'alpha' },
				],
			}
		})
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.artifactPath).toBe(`${WITNESS_PATH}.relation`)
	})

	it('26. fires malformed-operator-expression when the relation addresses neither leg', () => {
		const failure = failureOf((contract) => {
			createWitness(contract).relation = {
				op: 'equality',
				operands: [{ literal: 1 }, { literal: 1 }],
			}
		})
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.artifactPath).toBe(`${WITNESS_PATH}.relation`)
	})

	it('27. fires unreachable-check-evidence when a relation pointer roots at a third step id', () => {
		const failure = failureOf((contract) => {
			createWitness(contract).relation = {
				op: 'all',
				operands: [
					bothLegs,
					{
						op: 'existence',
						operands: [{ pointer: legPointer('some-other-leg') }],
					},
				],
			}
		})
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toBe(`${WITNESS_PATH}.relation`)
	})

	// The relation is the one expression `checkEvidenceReachability` never
	// walks, since that check reads oracle checks alone. Left unchecked, both
	// pointers resolve absent at pre-flight, `deep-equality` over an absent side
	// is false, and the enclosing `not` certifies the operation sensitive from a
	// pair that never resolved.
	it('37. fires unreachable-check-evidence when a relation pointer names a key the descriptor does not declare', () => {
		const failure = failureOf((contract) => {
			createWitness(contract).relation = {
				op: 'deep-equality',
				operands: [
					{ pointer: legPointer('create-witness-a', '/nope') },
					{ pointer: legPointer('create-witness-b', '/nope') },
				],
			}
		})
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toContain(`${WITNESS_PATH}.relation`)
	})

	// The rule order inside this check is load-bearing and this is where it
	// shows: both operands root at one leg and both are unreachable, so the
	// coverage rule and the reachability rule each have an answer and they
	// carry different codes. Reachability runs last, so the coverage fault is
	// the one reported.
	it('38. reports the one-leg coverage fault ahead of relation reachability', () => {
		const failure = failureOf((contract) => {
			createWitness(contract).relation = {
				op: 'deep-equality',
				operands: [
					{ pointer: legPointer('create-witness-a', '/nope') },
					{ pointer: legPointer('create-witness-a', '/nope') },
				],
			}
		})
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.artifactPath).toBe(`${WITNESS_PATH}.relation`)
	})

	// `pruneVolatile` deletes the field from the projection before the relation
	// reads it, so the pointer is reachable against the descriptor and absent in
	// practice. Left unchecked it is the same false pass as case 37 by a second
	// route.
	it('39. fires unreachable-check-evidence when a relation pointer names a declared volatile field', () => {
		const failure = failureOf((contract) => {
			contract.permittedInterfaces[0].operations[0].volatilePointers = ['/id']
			createWitness(contract).relation = {
				op: 'deep-equality',
				operands: [
					{ pointer: legPointer('create-witness-a', '/id') },
					{ pointer: legPointer('create-witness-b', '/id') },
				],
			}
		})
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toContain(`${WITNESS_PATH}.relation`)
		expect(failure.message).toContain('declares volatile')
	})

	// RFC 6901's empty pointer is the whole document, which is how
	// `pruneVolatile` reads it, so the described channel carries nothing.
	it('40. fires unreachable-check-evidence for the empty volatile pointer over any relation pointer', () => {
		const failure = failureOf((contract) => {
			contract.permittedInterfaces[0].operations[0].volatilePointers = ['']
		})
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.message).toContain('declares volatile')
	})

	// The volatile declaration is about the projection a witness relation reads.
	// An oracle is scored against a sealed run record, which carries no
	// projection, so the same pointer stays legitimate there.
	it('41. leaves an oracle pointer at a declared volatile field alone', () => {
		expect(() =>
			compile(
				mutated((contract) => {
					// `/items` on `list-things` is what O-001's check and RC-001's
					// evidence both address. Its witness moves to the bare bodies,
					// so the only pointers left at the volatile field are the two
					// scored against a sealed run record.
					const [, list] = contract.permittedInterfaces[0].operations
					list.volatilePointers = ['/items']
					list.sensitivityWitness.relation = {
						op: 'not',
						operands: [
							{
								op: 'deep-equality',
								operands: [
									{ pointer: '/interactions/list-witness-a/response-body' },
									{ pointer: '/interactions/list-witness-b/response-body' },
								],
							},
						],
					}
				}),
				{ strict: true },
			),
		).not.toThrow()
	})

	it('30. fires malformed-operator-expression when fixtureReset names a non-mutating operation', () => {
		const failure = failureOf((contract) => {
			contract.fixtureReset = {
				legId: 'reset-leg',
				interfaceId: 'thing-api',
				operationId: 'list-things',
				inputs: witnessInputs({ kind: 'absent' }),
			}
		})
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.artifactPath).toBe('EvalContract.fixtureReset')
	})

	it('31. fires unreachable-check-evidence when fixtureReset names an operation the contract does not declare', () => {
		const failure = failureOf((contract) => {
			contract.fixtureReset = {
				legId: 'reset-leg',
				interfaceId: 'thing-api',
				operationId: 'purge-things',
				inputs: witnessInputs({ kind: 'absent' }),
			}
		})
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toBe('EvalContract.fixtureReset')
	})
})

describe('checkWitnessLegIdentifiers: one namespace with interaction-plan step ids', () => {
	it('24. fires malformed-operator-expression when the two leg ids are equal', () => {
		const failure = failureOf((contract) => {
			createWitness(contract).legs[1].legId = 'create-witness-a'
		})
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.artifactPath).toBe(`${WITNESS_PATH}.legs`)
	})

	it('28. fires malformed-operator-expression when a leg id collides with an interaction-plan step id', () => {
		const failure = failureOf((contract) => {
			createWitness(contract).legs[0].legId = 'create'
		})
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.artifactPath).toBe(`${WITNESS_PATH}.legs[0].legId`)
	})

	it("29. fires malformed-operator-expression when a leg id collides with another operation's leg id", () => {
		const failure = failureOf((contract) => {
			contract.permittedInterfaces[0].operations[1].sensitivityWitness.legs[0].legId =
				'create-witness-a'
		})
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.artifactPath).toBe(
			'EvalContract.permittedInterfaces[0].operations[1].sensitivityWitness.legs[0].legId',
		)
	})

	// Not one of AD-10's named conditions and not on the story's table. Two legs
	// sharing an id would carry one `probeId` through the port, and the reducer
	// indexes observations by `probeId`, so the reset would answer for a witness
	// leg.
	it('113. fires malformed-operator-expression when the fixture reset leg id collides with a witness leg id', () => {
		const failure = failureOf((contract) => {
			contract.fixtureReset = {
				legId: 'create-witness-a',
				interfaceId: 'thing-api',
				operationId: 'create-thing',
				inputs: witnessInputs({ kind: 'json', value: { name: 'reset' } }),
			}
		})
		expect(failure.code).toBe('malformed-operator-expression')
		expect(failure.artifactPath).toBe('EvalContract.fixtureReset.legId')
	})
})

/**
 * The tripwires for the generalized enumerator in `expression-legality.ts`.
 * Revert that change and all three go red: without it a witness relation is
 * never walked, and `checkQuantifierOverNonCollection` additionally needs the
 * witness-scoped operation lookup, since a leg id never resolves through the
 * interaction plan.
 */
describe('the generalized expression enumerator reaches a witness relation', () => {
	const quantifierOverScalar = (contract: any): void => {
		createWitness(contract).relation = {
			op: 'all',
			operands: [
				{
					op: 'for-all',
					collection: { pointer: legPointer('create-witness-a', '/ok') },
					predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
				},
				bothLegs,
			],
		}
	}

	const undeclaredReferenceSet = (contract: any): void => {
		createWitness(contract).relation = {
			op: 'all',
			operands: [
				{
					op: 'containment',
					operands: [
						{ pointer: legPointer('create-witness-a', '/id') },
						{ referenceSet: 'never-declared' },
					],
				},
				bothLegs,
			],
		}
	}

	it('34. fires quantifier-over-non-collection for a leg-rooted quantifier over a declared scalar', () => {
		const failure = failureOf(quantifierOverScalar)
		expect(failure.code).toBe('quantifier-over-non-collection')
		expect(failure.artifactPath).toBe(
			`${WITNESS_PATH}.relation.operands[0].collection`,
		)
	})

	it('35. fires unresolved-reference-set for a witness relation naming an undeclared reference set', () => {
		const failure = failureOf(undeclaredReferenceSet)
		expect(failure.code).toBe('unresolved-reference-set')
		expect(failure.artifactPath).toBe(
			`${WITNESS_PATH}.relation.operands[0].operands[1]`,
		)
	})

	it('36. carries an artifact path naming the witness relation, never an oracle, on both', () => {
		for (const mutate of [quantifierOverScalar, undeclaredReferenceSet]) {
			const { artifactPath } = failureOf(mutate)
			expect(artifactPath).toContain('.sensitivityWitness.relation')
			expect(artifactPath).not.toContain('oracles[')
		}
	})
})
