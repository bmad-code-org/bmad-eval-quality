// AD-9's corpus gate: the closed reason set, the route table, the probe-side
// AD-4 legality pass, and the sealed-set filter that reports its exclusions.

import { describe, expect, it } from 'vitest'
import type { DefectSignature } from '../../src/core/schemas/defect-signature.ts'
import type { Expression } from '../../src/core/schemas/expression.ts'
import type { Operation } from '../../src/core/schemas/interface.ts'
import type { Probe } from '../../src/core/schemas/probe.ts'
import {
	QUALIFICATION_FAILURES,
	qualifyProbe,
	resolveHomeOperation,
	sealProbeSet,
} from '../../src/core/score/qualification.ts'
import {
	canary,
	createNote,
	evidenceReference,
	INTERFACES,
	qualifiedProbe,
	readNote,
	seededSignature,
} from './fixtures/probe-witness.ts'

const withPredicate = (predicate: Expression): Probe => ({
	...qualifiedProbe,
	defectSignature: {
		...seededSignature,
		condition: { ...seededSignature.condition, predicate },
	},
})

const withSignature = (signature: Partial<DefectSignature>): Probe => ({
	...qualifiedProbe,
	defectSignature: { ...seededSignature, ...signature },
})

const codesOf = (probe: Probe, operation: Operation | null = createNote) =>
	qualifyProbe(probe, operation).failures.map((failure) => failure.code)

describe('the reason set is closed', () => {
	it('carries no duplicate code', () => {
		expect(new Set(QUALIFICATION_FAILURES).size).toBe(
			QUALIFICATION_FAILURES.length,
		)
	})

	it('qualifies the corpus fixture against its own home operation', () => {
		const result = qualifyProbe(qualifiedProbe, createNote)
		expect(result.failures).toEqual([])
		expect(result.qualified).toBe(true)
		expect(result.declarationChecksRan).toBe(true)
	})

	// The three declaration-dependent checks need the home operation's declared
	// shapes, which a corpus holds nowhere. A caller qualifying against no
	// inventory is told what was not checked rather than handed a pass that hid
	// them.
	it('says so when the declaration-dependent checks could not run', () => {
		const result = qualifyProbe(qualifiedProbe, null)
		expect(result.qualified).toBe(true)
		expect(result.declarationChecksRan).toBe(false)
	})
})

describe('the route table, expectedClean read first', () => {
	it('rejects a route the class does not admit', () => {
		expect(
			codesOf({
				...qualifiedProbe,
				qualification: {
					route: 'canary',
					indicts: 'fixture',
					nonDetectionEvidence: evidenceReference,
				},
			}),
		).toEqual(['qualification-route-incompatible'])
	})

	it('names the illegal cell where no route applies at all', () => {
		const cleanDefect = {
			...qualifiedProbe,
			probeClass: 'defect' as const,
			expectedClean: true as const,
			defects: [],
			qualification: {
				route: 'clean-control' as const,
				baselinePassEvidence: evidenceReference,
				revisionCommitDigest: qualifiedProbe.commitDigest,
				noKnownDefectStatement: 'no known defect',
			},
		}
		const result = qualifyProbe(cleanDefect as unknown as Probe, createNote)
		expect(result.failures.map((failure) => failure.code)).toEqual([
			'qualification-route-incompatible',
		])
		expect(result.failures[0]?.detail).toContain('admits no AD-9 route at all')
	})

	// Both source rules read "every seeded source is X", which is vacuously true
	// of an empty array in both directions. Read literally that hands a probe
	// with no defect BOTH routes, and lets a corpus author attach either route's
	// evidence to a defect that does not exist.
	it('admits no route to a seeding class whose defects array is empty', () => {
		const seedsNothing: Probe = { ...qualifiedProbe, defects: [] }
		const result = qualifyProbe(seedsNothing, createNote)
		expect(result.failures.map((failure) => failure.code)).toEqual([
			'qualification-route-incompatible',
		])
		expect(result.failures[0]?.detail).toContain('defects array is empty')
		expect(
			qualifyProbe(
				{
					...seedsNothing,
					qualification: {
						route: 'historical',
						failBeforeEvidence: evidenceReference,
						passAfterEvidence: evidenceReference,
						fixCommitDigest: qualifiedProbe.commitDigest,
						oracleStableAcrossRevisions: true,
					},
				},
				createNote,
			).qualified,
		).toBe(false)
	})

	// The mixed-source array empties the admissible list too, and the detail
	// has to name the array rather than blaming the class pairing for it.
	it('rejects a defects array whose sources no single route agrees with', () => {
		expect(
			codesOf({
				...qualifiedProbe,
				defects: [
					qualifiedProbe.defects[0]!,
					{
						...qualifiedProbe.defects[0]!,
						defectId: 'D-002',
						source: 'natural',
					},
				],
			}),
		).toEqual([
			'qualification-defect-sources-mixed',
			'qualification-route-incompatible',
		])
		expect(
			qualifyProbe(
				{
					...qualifiedProbe,
					defects: [
						qualifiedProbe.defects[0]!,
						{
							...qualifiedProbe.defects[0]!,
							defectId: 'D-002',
							source: 'natural',
						},
					],
				},
				createNote,
			).failures[1]?.detail,
		).toContain('both a natural defect and a controlled mutation')
	})

	it('admits the gameability and historical routes on the classes that own them', () => {
		const gameability = {
			...qualifiedProbe,
			probeClass: 'gameability' as const,
			qualification: {
				route: 'gameability' as const,
				degenerateResponse: 'a 200 carrying an empty note',
				naiveOracleSatisfiedEvidence: evidenceReference,
				disciplinedOracleRejectedEvidence: evidenceReference,
			},
		}
		expect(qualifyProbe(gameability, createNote).failures).toEqual([])
		const historical = {
			...qualifiedProbe,
			defects: [{ ...qualifiedProbe.defects[0]!, source: 'natural' as const }],
			qualification: {
				route: 'historical' as const,
				failBeforeEvidence: evidenceReference,
				passAfterEvidence: evidenceReference,
				fixCommitDigest: qualifiedProbe.commitDigest,
				oracleStableAcrossRevisions: true,
			},
		}
		expect(qualifyProbe(historical, createNote).failures).toEqual([])
	})

	it("reads the historical route's own unmet precondition", () => {
		const historical = {
			...qualifiedProbe,
			defects: [{ ...qualifiedProbe.defects[0]!, source: 'natural' as const }],
			qualification: {
				route: 'historical' as const,
				failBeforeEvidence: evidenceReference,
				passAfterEvidence: evidenceReference,
				fixCommitDigest: qualifiedProbe.commitDigest,
				oracleStableAcrossRevisions: false,
			},
		}
		expect(codesOf(historical)).toEqual(['qualification-evidence-unverified'])
	})

	it('reads a route evidence flag the record itself says was not verified', () => {
		expect(
			codesOf({
				...qualifiedProbe,
				qualification: {
					...qualifiedProbe.qualification,
					rollbackVerified: false,
				} as typeof qualifiedProbe.qualification,
			}),
		).toEqual(['qualification-evidence-unverified'])
	})
})

describe('the signature requirement, and the one class exempt from it', () => {
	it('rejects a signature-less probe on a class that seeds', () => {
		expect(codesOf({ ...qualifiedProbe, defectSignature: null })).toEqual([
			'signature-absent',
		])
	})

	it('admits a canary carrying none', () => {
		expect(qualifyProbe(canary, createNote).failures).toEqual([])
	})

	it('rejects a canary carrying one', () => {
		// The cast is the point: `canary` is typed as the union, so spreading a
		// signature back onto it is a shape TypeScript will not build by
		// accident. The gate still has to name it, because a hand-authored
		// corpus can.
		expect(
			codesOf({ ...canary, defectSignature: seededSignature } as Probe),
		).toEqual(['signature-present-on-canary'])
	})

	it('rejects an interface kind other than api', () => {
		expect(codesOf(withSignature({ interfaceKind: 'cli' }))).toEqual([
			'signature-interface-kind-unsupported',
		])
	})
})

describe('the channel rule: the response channel, or two channels', () => {
	const selector = seededSignature.condition.selector

	it('passes on the declared observable channel alone', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-status',
					condition: {
						selector,
						predicate: {
							op: 'equality',
							operands: [
								{ pointer: '/interactions/observed/response-status' },
								{ literal: 500 },
							],
						},
					},
				}),
			),
		).toEqual([])
	})

	// The rule exists to reject "the evidence contains the string I sent", so
	// naming the sent channel twice must not pass, and does not.
	it('rejects call-inputs twice', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-status',
					condition: {
						selector,
						predicate: {
							op: 'equality',
							operands: [
								{ pointer: '/interactions/observed/call-inputs/body/title' },
								{ pointer: '/interactions/observed/call-inputs/body/title' },
							],
						},
					},
				}),
			),
		).toEqual(['condition-channels-underspecified'])
	})

	it('passes on two channels where one is response-side', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'exit-code',
					interfaceKind: 'mcp',
					condition: {
						selector,
						predicate: {
							op: 'equality',
							operands: [
								{ pointer: '/interactions/observed/response-body/message' },
								{ pointer: '/interactions/observed/call-inputs/body/title' },
							],
						},
					},
				}),
			),
			// `mcp` is its own failure; the channel rule is what this row is about.
		).toEqual(['signature-interface-kind-unsupported'])
	})
})

describe('the declared observable channel is checked, not just read', () => {
	const selector = seededSignature.condition.selector
	const callInputsOnly = {
		selector,
		predicate: {
			op: 'existence',
			operands: [{ pointer: '/interactions/observed/call-inputs/body/title' }],
		} satisfies Expression as Expression,
	}

	// The channel rule reads this field first, so an unchecked value here is an
	// unchecked field that is load-bearing. Declaring `call-inputs` observable
	// let its own pointer satisfy the rule, and the condition then resolved
	// `true` on the observation where the system behaved correctly: the catch
	// rate 1.00 by construction that AD-40 exists to close, arriving through the
	// field added to close it.
	it('rejects a channel that records what was sent', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'call-inputs',
					condition: callInputsOnly,
				}),
			),
		).toEqual([
			'signature-observable-channel-not-response-side',
			'condition-channels-underspecified',
		])
	})

	// Decision 15's rule, applied to the declaration as well as to the pointers:
	// an api interface never produces stdout, stderr, or an exit code.
	it('rejects a text channel declared observable on an api signature', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'stdout',
					condition: {
						selector,
						predicate: {
							op: 'all',
							operands: [
								{
									op: 'existence',
									operands: [
										{ pointer: '/interactions/observed/response-body/message' },
									],
								},
								{
									op: 'existence',
									operands: [
										{ pointer: '/interactions/observed/response-status' },
									],
								},
							],
						},
					},
				}),
			),
		).toEqual(['condition-text-channel-on-api'])
	})
})

describe('the selector is checked against the same request shape it filters', () => {
	// A selector key the operation declares nowhere matches no observation, so
	// every candidate is filtered out and the probe reports `not-triggered`,
	// which Story 7.5 maps to `confirmed`. A typo becomes a silently passing
	// run. Stricter than the contract side on purpose: `undeclared-mandatory-input`
	// is strict-only because a contract may be compiled either way, and AD-9's
	// corpus gate has no lenient mode.
	it('rejects a selector key the home operation declares nowhere', () => {
		const probe = withSignature({
			condition: {
				selector: {
					inputBinding: {
						path: null,
						query: null,
						header: null,
						body: { neverDeclared: { matcher: 'any' } },
					},
				},
				predicate: seededSignature.condition.predicate,
			},
		})
		const result = qualifyProbe(probe, createNote)
		expect(result.failures.map((failure) => failure.code)).toEqual([
			'condition-selector-key-undeclared',
		])
		expect(result.failures[0]?.artifactPath).toBe(
			'Probe[probeId=PX-001].defectSignature.condition.selector.inputBinding.body["neverDeclared"]',
		)
	})

	it('is declaration-dependent, so it is skipped with no inventory', () => {
		const probe = withSignature({
			condition: {
				selector: {
					inputBinding: {
						path: null,
						query: null,
						header: null,
						body: { neverDeclared: { matcher: 'any' } },
					},
				},
				predicate: seededSignature.condition.predicate,
			},
		})
		const result = qualifyProbe(probe, null)
		expect(result.qualified).toBe(true)
		expect(result.declarationChecksRan).toBe(false)
	})

	// "Declared" has two meanings here and the gate has to hold both. Key
	// presence is `requiredKeys` union `permittedKeys`; the type-violating
	// member additionally reads the type map, where a missing entry means the
	// type was never declared. A key can be permitted and carry no type, and a
	// type-violating binding against one fails closed on every observation, so
	// checking only key presence leaves the same selector matching nothing.
	it('rejects a type-violating binding on a key with no declared type', () => {
		const permitsUntypedTag: Operation = {
			...createNote,
			requestShape: {
				...createNote.requestShape,
				body: {
					requiredKeys: ['title'],
					permittedKeys: ['tag'],
					types: { title: 'string' },
				},
			},
		}
		const probe = withSignature({
			condition: {
				selector: {
					inputBinding: {
						path: null,
						query: null,
						header: null,
						body: { tag: { matcher: 'type-violating' } },
					},
				},
				predicate: seededSignature.condition.predicate,
			},
		})
		const result = qualifyProbe(probe, permitsUntypedTag)
		expect(result.failures.map((failure) => failure.code)).toEqual([
			'condition-selector-key-undeclared',
		])
		expect(result.failures[0]?.detail).toContain('does not declare')

		// The other two members never read the type map, so the same untyped key
		// is legal for them and must not be rejected.
		expect(
			qualifyProbe(
				withSignature({
					condition: {
						selector: {
							inputBinding: {
								path: null,
								query: null,
								header: null,
								body: { tag: { matcher: 'any' } },
							},
						},
						predicate: seededSignature.condition.predicate,
					},
				}),
				permitsUntypedTag,
			).failures,
		).toEqual([])
	})

	it('admits a key the operation declares', () => {
		expect(codesOf(qualifiedProbe)).toEqual([])
	})
})

describe('a disjunct that examines only what was sent decides on its own', () => {
	const sentSide = {
		op: 'existence',
		operands: [{ pointer: '/interactions/observed/call-inputs/body/title' }],
	} satisfies Expression as Expression
	const responseSide = {
		op: 'existence',
		operands: [{ pointer: '/interactions/observed/response-body/message' }],
	} satisfies Expression as Expression

	// The channel rule counts channels and cannot see where the truth value
	// comes from, so this predicate names two channels, one response-side, and
	// satisfies it. The first disjunct is true of every candidate, because the
	// selector's own binding guarantees that key is present on anything that
	// became a candidate at all: the condition then resolves true on the
	// observation where the system behaved correctly.
	it('rejects a sent-side operand of any', () => {
		const result = qualifyProbe(
			withSignature({
				observableChannel: 'response-body',
				condition: {
					selector: seededSignature.condition.selector,
					predicate: { op: 'any', operands: [sentSide, responseSide] },
				},
			}),
			createNote,
		)
		expect(result.failures.map((failure) => failure.code)).toEqual([
			'condition-disjunct-without-response-channel',
		])
		expect(result.failures[0]?.artifactPath).toBe(
			'Probe[probeId=PX-001].defectSignature.condition.predicate.operands[0]',
		)
	})

	// An operand naming no fully-rooted pointer at all is the degenerate case of
	// the same shape: `existence` over a literal is true of every observation.
	it('rejects a disjunct naming no channel at all', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-body',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: {
							op: 'any',
							operands: [
								{
									op: 'equality',
									operands: [{ literal: 1 }, { literal: 1 }],
								},
								responseSide,
							],
						},
					},
				}),
			),
		).toEqual(['condition-disjunct-without-response-channel'])
	})

	// Scoped to `any` and nothing else. Under `all` no single operand carries
	// the verdict alone, so a sent-side conjunct is the legitimate half of the
	// two-channel conditions AD-40's wording exists to admit: "the response
	// echoes the request body" is exactly that shape.
	it('leaves a sent-side conjunct of all alone', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-body',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: { op: 'all', operands: [sentSide, responseSide] },
					},
				}),
			),
		).toEqual([])
	})

	it('reaches an any nested inside an all', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-body',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: {
							op: 'all',
							operands: [
								responseSide,
								{ op: 'any', operands: [sentSide, responseSide] },
							],
						},
					},
				}),
			),
		).toEqual(['condition-disjunct-without-response-channel'])
	})

	// A bound-element pointer roots at no step identifier and names no channel of
	// its own, so a disjunct made entirely of `@/` comparisons looks like it
	// reads nothing. It reads whatever the enclosing quantifier's collection is
	// rooted in, and rejecting it would be a false positive on a legitimate
	// per-element condition.
	it('inherits the enclosing quantifier collection channel for @/ operands', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-body',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: {
							op: 'for-any',
							collection: {
								pointer: '/interactions/observed/response-body/items',
							},
							predicate: {
								op: 'any',
								operands: [
									{
										op: 'equality',
										operands: [{ pointer: '@/broken' }, { literal: true }],
									},
									{
										op: 'equality',
										operands: [{ pointer: '@/code' }, { literal: 500 }],
									},
								],
							},
						},
					},
				}),
			),
		).toEqual([])
	})

	// The same shape with a sent-side disjunct inside the quantifier still
	// fails: inheritance supplies a channel to `@/` pointers, it does not excuse
	// an operand that reads call-inputs directly.
	it('still rejects a sent-side disjunct inside a quantifier', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-body',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: {
							op: 'for-any',
							collection: {
								pointer: '/interactions/observed/response-body/items',
							},
							predicate: {
								op: 'any',
								operands: [
									{
										op: 'existence',
										operands: [
											{
												pointer:
													'/interactions/observed/call-inputs/body/title',
											},
										],
									},
									{
										op: 'equality',
										operands: [{ pointer: '@/broken' }, { literal: true }],
									},
								],
							},
						},
					},
				}),
			),
		).toEqual(['condition-disjunct-without-response-channel'])
	})

	it('admits a disjunction of two response-side operands', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-body',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: {
							op: 'any',
							operands: [
								responseSide,
								{
									op: 'equality',
									operands: [
										{ pointer: '/interactions/observed/response-status' },
										{ literal: 500 },
									],
								},
							],
						},
					},
				}),
			),
		).toEqual([])
	})
})

describe('the pointer rules', () => {
	it('rejects a pointer rooted at any step id but the reserved one', () => {
		expect(
			codesOf(
				withPredicate({
					op: 'equality',
					operands: [
						{ pointer: '/interactions/write/response-status' },
						{ literal: 500 },
					],
				}),
			),
		).toEqual([
			'condition-pointer-not-observation-rooted',
			'condition-channels-underspecified',
		])
	})

	// Without this check a condition addressing an undeclared key resolves
	// absent, every comparison over it resolves false, and the probe reports its
	// defect as never triggered: a silently passing run on a signature that was
	// never writable.
	it('rejects a pointer the home operation does not declare', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-body',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: {
							op: 'existence',
							operands: [
								{ pointer: '/interactions/observed/response-body/nonesuch' },
							],
						},
					},
				}),
			),
		).toEqual(['condition-pointer-unwritable'])
	})

	it('skips the writability check when no home operation was supplied', () => {
		const unwritable = withSignature({
			observableChannel: 'response-body',
			condition: {
				selector: seededSignature.condition.selector,
				predicate: {
					op: 'existence',
					operands: [
						{ pointer: '/interactions/observed/response-body/nonesuch' },
					],
				},
			},
		})
		expect(codesOf(unwritable, null)).toEqual([])
		expect(qualifyProbe(unwritable, null).declarationChecksRan).toBe(false)
	})

	// Wrong in both places, and reported in both: the declaration says the
	// defect manifests in stdout and the pointer addresses stdout, and an api
	// interface produces neither.
	it('rejects a text channel on an api signature', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'stdout',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: {
							op: 'existence',
							operands: [{ pointer: '/interactions/observed/stdout' }],
						},
					},
				}),
			),
		).toEqual([
			'condition-text-channel-on-api',
			'condition-text-channel-on-api',
		])
		// By address, not only by count: the two failures come from different
		// checks and a count alone cannot say that both ran.
		expect(
			qualifyProbe(
				withSignature({
					observableChannel: 'stdout',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: {
							op: 'existence',
							operands: [{ pointer: '/interactions/observed/stdout' }],
						},
					},
				}),
				createNote,
			).failures.map((failure) => failure.artifactPath),
		).toEqual([
			'Probe[probeId=PX-001].defectSignature.observableChannel',
			'Probe[probeId=PX-001].defectSignature.condition.predicate.operands[0]',
		])
	})
})

describe('the probe-side AD-4 legality pass', () => {
	// The case that makes the pass load-bearing: `existence` over a literal is
	// true of every observation, so every candidate satisfies the signature and
	// the catch rate is 1.00 by construction — the exact defect AD-40 exists to
	// close, arriving through the field added to close it.
	it('rejects existence over a literal', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-status',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: { op: 'existence', operands: [{ literal: 5 }] },
					},
				}),
			),
		).toEqual([
			'condition-channels-underspecified',
			'condition-operand-illegal',
		])
	})

	it('rejects a referenceSet operand, which no corpus signature can resolve', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-body',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: {
							op: 'containment',
							operands: [
								{ pointer: '/interactions/observed/response-body/message' },
								{ referenceSet: 'expected-things' },
							],
						},
					},
				}),
			),
		).toEqual(['condition-reference-set-operand'])
	})

	it('rejects a referenceSet in the set-membership position too', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-status',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: {
							op: 'set-membership',
							operands: [
								{ pointer: '/interactions/observed/response-status' },
								{ referenceSet: 'expected-statuses' },
							],
						},
					},
				}),
			),
		).toEqual(['condition-reference-set-operand'])
	})

	it('rejects an unanchored regex', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-body',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: {
							op: 'regex',
							operands: [
								{ pointer: '/interactions/observed/response-body/message' },
							],
							pattern: 'internal',
						},
					},
				}),
			),
		).toEqual(['condition-regex-illegal'])
	})

	it('rejects nested quantifiers', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-body',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: {
							op: 'for-all',
							collection: {
								pointer: '/interactions/observed/response-body/items',
							},
							predicate: {
								op: 'for-any',
								collection: { pointer: '@/rows' },
								predicate: {
									op: 'equality',
									operands: [{ pointer: '@/ok' }, { literal: true }],
								},
							},
						},
					},
				}),
			),
		).toEqual(['condition-quantifier-nesting'])
	})

	// The check reads the operation's declared response types, never its
	// collection locations: a declared non-array type beats a contradictory
	// collection location, and a re-derivation reading the other field would
	// disagree with the compiler on a committed fixture.
	it('rejects a quantifier over a declared non-collection', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-body',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: {
							op: 'for-all',
							collection: {
								pointer: '/interactions/observed/response-body/message',
							},
							predicate: {
								op: 'equality',
								operands: [{ pointer: '@/ok' }, { literal: true }],
							},
						},
					},
				}),
			),
		).toEqual(['condition-quantifier-over-non-collection'])
	})

	it('rejects a bound-element pointer outside any quantifier', () => {
		expect(
			codesOf(
				withSignature({
					observableChannel: 'response-status',
					condition: {
						selector: seededSignature.condition.selector,
						predicate: {
							op: 'all',
							operands: [
								{
									op: 'equality',
									operands: [
										{ pointer: '/interactions/observed/response-status' },
										{ literal: 500 },
									],
								},
								{ op: 'existence', operands: [{ pointer: '@/broken' }] },
							],
						},
					},
				}),
			),
		).toEqual(['condition-bound-element-outside-quantifier'])
	})

	it('carries the shipped failure path through unchanged', () => {
		const failure = qualifyProbe(
			withSignature({
				observableChannel: 'response-status',
				condition: {
					selector: seededSignature.condition.selector,
					predicate: { op: 'existence', operands: [{ literal: 5 }] },
				},
			}),
			createNote,
		).failures.find((entry) => entry.code === 'condition-operand-illegal')
		expect(failure?.artifactPath).toBe(
			'Probe[probeId=PX-001].defectSignature.condition.predicate.operands[0]',
		)
	})
})

describe('the home operation resolves by erased transport identity', () => {
	it('binds a parameterised template regardless of parameter name', () => {
		expect(
			resolveHomeOperation(
				{ ...seededSignature, method: 'GET', pathTemplate: '/notes/{id}' },
				INTERFACES,
			),
		).toBe(readNote)
	})

	it('returns null when the inventory declares no such signature', () => {
		expect(
			resolveHomeOperation(
				{ ...seededSignature, pathTemplate: '/archives' },
				INTERFACES,
			),
		).toBeNull()
	})
})

describe('sealProbeSet admits and reports, never drops silently', () => {
	// AD-9's sentence is a corpus invariant. Dropping an unqualified probe at
	// score time would shrink AD-7's denominator and desynchronise the corpus
	// digest from the probes actually scored, so the exclusions come back with
	// their reasons attached.
	it('returns the exclusions alongside the admitted probes', () => {
		const unqualified: Probe = {
			...qualifiedProbe,
			probeId: 'PX-003',
			defectSignature: null,
		}
		const sealed = sealProbeSet(
			[qualifiedProbe, canary, unqualified],
			() => createNote,
		)
		expect(sealed.admitted.map((entry) => entry.probe.probeId)).toEqual([
			'PX-001',
			'PX-002',
		])
		expect(sealed.rejected).toHaveLength(1)
		expect(sealed.rejected[0]?.probe.probeId).toBe('PX-003')
		expect(sealed.rejected[0]?.result.failures.map((f) => f.code)).toEqual([
			'signature-absent',
		])
	})

	// The admission carries its own result, so a set sealed without an
	// inventory is distinguishable from one sealed with it. A bare `Probe[]`
	// dropped that fact at the seal and let a half-checked admission read as a
	// fully-checked one, which is the three skipped checks going silent.
	it('carries declarationChecksRan on the admission, not only on the rejection', () => {
		const withInventory = sealProbeSet([qualifiedProbe], () => createNote)
		expect(withInventory.admitted[0]?.result.declarationChecksRan).toBe(true)

		const withoutInventory = sealProbeSet([qualifiedProbe], () => null)
		expect(withoutInventory.admitted).toHaveLength(1)
		expect(withoutInventory.rejected).toEqual([])
		expect(withoutInventory.admitted[0]?.result.declarationChecksRan).toBe(
			false,
		)
	})

	// The resolver is required, so the unchecked path costs a caller a visible
	// `() => null` rather than being what they reach by writing less. Verified
	// on the probe the skipped checks would have caught: writable against no
	// inventory, unwritable against the real one.
	it('admits a signature the skipped checks would have rejected', () => {
		const unwritable = withSignature({
			observableChannel: 'response-body',
			condition: {
				selector: seededSignature.condition.selector,
				predicate: {
					op: 'existence',
					operands: [
						{ pointer: '/interactions/observed/response-body/nowhere' },
					],
				},
			},
		})
		expect(sealProbeSet([unwritable], () => null).admitted).toHaveLength(1)
		const sealed = sealProbeSet([unwritable], () => createNote)
		expect(sealed.admitted).toEqual([])
		expect(sealed.rejected[0]?.result.failures.map((f) => f.code)).toEqual([
			'condition-pointer-unwritable',
		])
	})
})
