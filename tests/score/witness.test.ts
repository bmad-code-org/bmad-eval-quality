// AD-40's witness match, its four finding buckets, and the quotation audit that
// runs beside it and never feeds it.
//
// The partition table is walked in full: every row of it, both permutation
// families, and the citation triad that makes non-detection reachable.

import { describe, expect, it } from 'vitest'
import type { DefectSignature } from '../../src/core/schemas/defect-signature.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type { Observation } from '../../src/core/schemas/sealed-run-record.ts'
import {
	auditQuotation,
	projectChannel,
	reconstructDetection,
} from '../../src/core/score/quotation.ts'
import {
	mapFindings,
	matchProbeWitness,
	PROBE_REGEX_MATCH_STEP_BUDGET,
	PROBE_WITNESS_RESULTS,
	type SignedProbe,
} from '../../src/core/score/witness.ts'
import {
	canary,
	correctRejection,
	defectFinding,
	defectFired,
	evidenceReference,
	INTERFACES,
	observation,
	qualifiedProbe,
	recordOf,
} from './fixtures/probe-witness.ts'

const withSignature = (
	signature: Partial<DefectSignature>,
	probe: SignedProbe = qualifiedProbe,
): SignedProbe => ({
	...probe,
	defectSignature: { ...probe.defectSignature, ...signature },
})

const bothObservations = [correctRejection, defectFired]

describe('the six results are a closed, ordered vocabulary', () => {
	it('declares them in the order the partition table evaluates', () => {
		expect([...PROBE_WITNESS_RESULTS]).toEqual([
			'unexercised',
			'unwitnessed-claim',
			'matched',
			'manifested-unclaimed',
			'not-triggered',
			'vacuous',
		])
	})

	it('follows pre-flight in naming its own regex budget', () => {
		expect(PROBE_REGEX_MATCH_STEP_BUDGET).toBe(1_000_000)
	})
})

describe('the citation triad: what makes non-detection reachable', () => {
	// The three rows differ in one input only — which observation the finding
	// cites — and produce three different results. A scorer reading anything
	// less than the discriminating condition returns the same answer to all
	// three, which is the catch rate being 1.00 by construction.
	it('resolves matched when a defect finding cites the satisfying observation', () => {
		const match = matchProbeWitness(
			qualifiedProbe,
			INTERFACES,
			recordOf(bothObservations, [defectFinding(['obs-2'])]),
		)
		expect(match.result).toBe('matched')
		expect(match.witnessObservationIds).toEqual(['obs-2'])
		expect(match.basis).toBe('measured')
	})

	it('resolves unwitnessed-claim when it cites the non-satisfying one', () => {
		const match = matchProbeWitness(
			qualifiedProbe,
			INTERFACES,
			recordOf(bothObservations, [defectFinding(['obs-1'])]),
		)
		expect(match.result).toBe('unwitnessed-claim')
		expect(match.unwitnessedFindingIds).toEqual(['F-001'])
		expect(match.witnessObservationIds).toEqual([])
	})

	it('resolves manifested-unclaimed when no defect finding is filed', () => {
		const match = matchProbeWitness(
			qualifiedProbe,
			INTERFACES,
			recordOf(bothObservations),
		)
		expect(match.result).toBe('manifested-unclaimed')
		expect(match.partition.satisfying).toEqual(['obs-2'])
	})

	// An invalidating declared-versus-observed inconsistency must not be masked
	// by a catch on the same probe, so the bogus claim wins even beside a
	// finding that genuinely witnesses.
	it('lets an unwitnessed claim beat a competing match', () => {
		const match = matchProbeWitness(
			qualifiedProbe,
			INTERFACES,
			recordOf(bothObservations, [
				defectFinding(['obs-2'], { findingId: 'F-001' }),
				defectFinding(['obs-1'], { findingId: 'F-002' }),
			]),
		)
		expect(match.result).toBe('unwitnessed-claim')
		expect(match.unwitnessedFindingIds).toEqual(['F-002'])
	})
})

describe('the partition table, walked in full', () => {
	it('unexercised: no evaluator-chosen observation of the home operation', () => {
		const match = matchProbeWitness(
			qualifiedProbe,
			INTERFACES,
			recordOf(
				bothObservations.map((entry) => ({
					...entry,
					provenance: 'baseline' as const,
				})),
			),
		)
		expect(match.result).toBe('unexercised')
		expect(match.exercised).toBe(false)
		expect(match.homeOperationResolved).toBe(true)
		expect(match.observationIds).toEqual([])
	})

	it('unexercised: the inventory declares no operation matching the signature', () => {
		const match = matchProbeWitness(
			withSignature({ pathTemplate: '/archives' }),
			INTERFACES,
			recordOf(bothObservations, [defectFinding(['obs-2'])]),
		)
		expect(match.result).toBe('unexercised')
		expect(match.homeOperationResolved).toBe(false)
	})

	it('not-triggered: exercised, and the selector matched nothing', () => {
		const wellFormed = bothObservations.map((entry) => ({
			...entry,
			callInputs: { ...entry.callInputs, body: { title: 'a real title' } },
		}))
		const match = matchProbeWitness(
			qualifiedProbe,
			INTERFACES,
			recordOf(wellFormed),
		)
		expect(match.result).toBe('not-triggered')
		expect(match.exercised).toBe(true)
		expect(match.observationIds).toEqual([])
	})

	// AD-6's "common case on any defect probe": the system was examined and
	// behaved. Folding this into `vacuous` would invalidate the run.
	it('not-triggered: the condition resolved false everywhere', () => {
		const match = matchProbeWitness(
			qualifiedProbe,
			INTERFACES,
			recordOf([correctRejection]),
		)
		expect(match.result).toBe('not-triggered')
		expect(match.partitionSizes).toEqual({
			satisfying: 0,
			refuting: 1,
			inconclusive: 0,
		})
	})

	it('not-triggered: mixed false and insufficient-evidence still has a home', () => {
		const match = matchProbeWitness(
			withSignature({
				observableChannel: 'response-body',
				condition: {
					selector: qualifiedProbe.defectSignature.condition.selector,
					predicate: {
						op: 'any',
						operands: [
							{
								op: 'equality',
								operands: [
									{ pointer: '/interactions/observed/response-status' },
									{ literal: 500 },
								],
							},
							{
								op: 'for-all',
								collection: {
									pointer: '/interactions/observed/response-body/items',
								},
								predicate: {
									op: 'equality',
									operands: [{ pointer: '@/broken' }, { literal: true }],
								},
							},
						],
					},
				},
			}),
			INTERFACES,
			// `any` is weaker than disjunction: an insufficient-evidence sibling
			// wins over a `true` one, so obs-2 lands in `U`, while obs-1 resolves
			// cleanly false and lands in `F`. A record whose observations split
			// across `F` and `U` fitted no result at all under a precedence
			// list.
			recordOf([
				{ ...correctRejection, responseBody: { ok: false, items: [1] } },
				defectFired,
			]),
		)
		expect(match.result).toBe('not-triggered')
		expect(match.partitionSizes.refuting).toBe(1)
		expect(match.partitionSizes.inconclusive).toBe(1)
	})

	// AD-40's own definition, verbatim: insufficient-evidence on every candidate
	// means the corpus presented no defect to detect.
	// The table's fifth row, and the matrix's "whether `T` is empty or not". The
	// bogus-claim rows come before the T-empty rows, so a claim on a probe that
	// never manifested is still the invalidating inconsistency rather than a
	// quiet `not-triggered`.
	it('unwitnessed-claim: a bogus claim with an empty satisfying set', () => {
		const match = matchProbeWitness(
			qualifiedProbe,
			INTERFACES,
			recordOf([correctRejection], [defectFinding(['obs-1'])]),
		)
		expect(match.result).toBe('unwitnessed-claim')
		expect(match.partitionSizes).toEqual({
			satisfying: 0,
			refuting: 1,
			inconclusive: 0,
		})
		expect(match.unwitnessedFindingIds).toEqual(['F-001'])
		expect(match.witnessObservationIds).toEqual([])
	})

	it('vacuous: every candidate resolved insufficient-evidence', () => {
		const match = matchProbeWitness(
			withSignature({
				observableChannel: 'response-body',
				condition: {
					selector: qualifiedProbe.defectSignature.condition.selector,
					predicate: {
						op: 'for-all',
						collection: {
							pointer: '/interactions/observed/response-body/items',
						},
						predicate: {
							op: 'equality',
							operands: [{ pointer: '@/broken' }, { literal: true }],
						},
					},
				},
			}),
			INTERFACES,
			recordOf(bothObservations),
		)
		expect(match.result).toBe('vacuous')
		expect(match.partitionSizes).toEqual({
			satisfying: 0,
			refuting: 0,
			inconclusive: 2,
		})
	})

	// An empty candidate set satisfies "insufficient-evidence on every
	// candidate" vacuously. The table puts it on the not-triggered side
	// explicitly rather than letting the quantifier decide, because the two
	// route to opposite verdicts.
	it('separates the empty candidate set from the vacuous one', () => {
		const empty = matchProbeWitness(
			qualifiedProbe,
			INTERFACES,
			recordOf([
				{
					...correctRejection,
					callInputs: {
						...correctRejection.callInputs,
						body: { title: 'well formed' },
					},
				},
			]),
		)
		expect(empty.result).toBe('not-triggered')
		expect(empty.observationIds).toEqual([])
	})
})

describe('a fault leaves the function undecorated', () => {
	// The Conventions table forbids a fault becoming a verdict, and AD-28 routes
	// it to AD-21's invalid rung. Catching it here would convert the fault exit
	// into a scored run, so the test asserts the throw and its code rather than
	// a domain value.
	it('propagates a RuntimeFault rather than folding the candidate into a partition', () => {
		const faulting = withSignature({
			observableChannel: 'response-body',
			condition: {
				selector: qualifiedProbe.defectSignature.condition.selector,
				predicate: {
					op: 'regex',
					operands: [
						{ pointer: '/interactions/observed/response-body/message' },
					],
					// Anchored, no backreference, no lookbehind: the qualification
					// gate's regex-construct check admits it, and the evaluator
					// rejects it at match time for a catastrophic-backtracking shape.
					pattern: '^(a+)+$',
				},
			},
		})
		let thrown: unknown
		try {
			matchProbeWitness(faulting, INTERFACES, recordOf(bothObservations))
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(RuntimeFault)
		expect((thrown as RuntimeFault).code).toBe('budget-exhausted')
		expect((thrown as RuntimeFault).artifactPath).toBe(
			'Probe[probeId=PX-001].defectSignature.condition.predicate',
		)
	})
})

describe('ordering: array position is never read, sequence always is', () => {
	const permutations: readonly (readonly Observation[])[] = [
		[correctRejection, defectFired],
		[defectFired, correctRejection],
	]

	it.each(permutations.map((order, index) => [index, order] as const))(
		'permutation %i returns identical identifiers in identical order',
		(_index, order) => {
			const match = matchProbeWitness(
				qualifiedProbe,
				INTERFACES,
				recordOf(order, [defectFinding(['obs-2'])]),
			)
			expect(match.result).toBe('matched')
			expect(match.observationIds).toEqual(['obs-1', 'obs-2'])
			expect(match.partition.satisfying).toEqual(['obs-2'])
			expect(match.partition.refuting).toEqual(['obs-1'])
		},
	)

	// The second permutation family: the same observations with their sequence
	// values swapped. The result and the identifier SET are unchanged; the order
	// follows the new sequence, which is the whole point of recording one.
	it('reorders by the reversed sequence and returns the same result', () => {
		const reversed = [
			{ ...correctRejection, sequence: 2 },
			{ ...defectFired, sequence: 1 },
		]
		const match = matchProbeWitness(
			qualifiedProbe,
			INTERFACES,
			recordOf(reversed, [defectFinding(['obs-2'])]),
		)
		expect(match.result).toBe('matched')
		expect(match.observationIds).toEqual(['obs-2', 'obs-1'])
		expect([...match.observationIds].sort()).toEqual(['obs-1', 'obs-2'])
	})

	// The third permutation family, and the one the ACs do not name. `findings`
	// carries no ordering field at all, so its array position is the same
	// non-meaning `sequence` was added to remove from `observations`; every
	// finding identifier this module returns is therefore sorted by identifier.
	it('returns identical finding identifiers under a permuted findings array', () => {
		const claims = [
			defectFinding(['obs-1'], { findingId: 'F-B' }),
			defectFinding(['obs-1'], { findingId: 'F-A' }),
		]
		for (const order of [claims, [...claims].reverse()]) {
			const match = matchProbeWitness(
				qualifiedProbe,
				INTERFACES,
				recordOf(bothObservations, order),
			)
			expect(match.result).toBe('unwitnessed-claim')
			expect(match.unwitnessedFindingIds).toEqual(['F-A', 'F-B'])
			expect(
				mapFindings(
					[qualifiedProbe],
					INTERFACES,
					recordOf(bothObservations, order),
				).mapped.map((entry) => entry.findingId),
			).toEqual(['F-A', 'F-B'])
		}
	})

	it('breaks a sequence tie on observationId, so no hand-built array is ambiguous', () => {
		const tied = [
			{ ...defectFired, observationId: 'obs-b', sequence: 1 },
			{ ...defectFired, observationId: 'obs-a', sequence: 1 },
		]
		const match = matchProbeWitness(qualifiedProbe, INTERFACES, recordOf(tied))
		expect(match.observationIds).toEqual(['obs-a', 'obs-b'])
	})
})

describe('the selector follows the shipped binding filter', () => {
	it('fails closed on a null observed channel a binding names', () => {
		const match = matchProbeWitness(
			qualifiedProbe,
			INTERFACES,
			recordOf([
				{
					...defectFired,
					callInputs: { ...defectFired.callInputs, body: null },
				},
			]),
		)
		expect(match.result).toBe('not-triggered')
		expect(match.observationIds).toEqual([])
	})

	it('fails closed when the declared type is indeterminate', () => {
		const inventory = [
			{
				logicalId: 'notes-api',
				kind: 'api' as const,
				operations: [
					{
						...INTERFACES[0]!.operations[0]!,
						requestShape: {
							...INTERFACES[0]!.operations[0]!.requestShape,
							body: {
								requiredKeys: ['title'],
								permittedKeys: [],
								types: { title: null },
							},
						},
					},
				],
			},
		]
		const match = matchProbeWitness(
			qualifiedProbe,
			inventory,
			recordOf(bothObservations),
		)
		expect(match.observationIds).toEqual([])
	})

	// The third rule Decision 4 inherits from the shipped filter, and the one no
	// case reached: key presence binds every admitted member, `{ matcher: 'any' }`
	// included, so a selector naming a key the call did not carry filters the
	// observation out rather than matching it.
	it('filters out an observation missing a key the selector binds', () => {
		const probe = withSignature({
			condition: {
				selector: {
					inputBinding: {
						path: null,
						query: null,
						header: null,
						body: { title: { matcher: 'any' } },
					},
				},
				predicate: qualifiedProbe.defectSignature.condition.predicate,
			},
		})
		const carriesTheKey = matchProbeWitness(
			probe,
			INTERFACES,
			recordOf([defectFired]),
		)
		expect(carriesTheKey.observationIds).toEqual(['obs-2'])
		expect(carriesTheKey.result).toBe('manifested-unclaimed')

		const missingTheKey = matchProbeWitness(
			probe,
			INTERFACES,
			recordOf([
				{
					...defectFired,
					callInputs: {
						path: null,
						query: null,
						header: null,
						body: { other: 42 },
					},
				},
			]),
		)
		expect(missingTheKey.observationIds).toEqual([])
		expect(missingTheKey.result).toBe('not-triggered')
	})

	it('binds a literal by deep equality, key order irrelevant', () => {
		const literalProbe = withSignature({
			condition: {
				selector: {
					inputBinding: {
						path: null,
						query: null,
						header: null,
						body: { title: { literal: { a: 1, b: [2, 3] } } },
					},
				},
				predicate: qualifiedProbe.defectSignature.condition.predicate,
			},
		})
		const match = matchProbeWitness(
			literalProbe,
			INTERFACES,
			recordOf([
				{
					...defectFired,
					callInputs: {
						...defectFired.callInputs,
						body: { title: { b: [2, 3], a: 1 } },
					},
				},
			]),
		)
		expect(match.result).toBe('manifested-unclaimed')
	})
})

describe('the home operation binds after parameter-name erasure', () => {
	it('binds /notes/{id} against a contract declaring /notes/{noteId}', () => {
		const readProbe = withSignature({
			method: 'GET',
			pathTemplate: '/notes/{id}',
			condition: {
				selector: {
					inputBinding: {
						path: null,
						query: null,
						header: null,
						body: null,
					},
				},
				predicate: qualifiedProbe.defectSignature.condition.predicate,
			},
		})
		const match = matchProbeWitness(
			readProbe,
			INTERFACES,
			recordOf([
				observation({
					observationId: 'obs-9',
					operationId: 'read-note',
					responseStatus: 500,
				}),
			]),
		)
		expect(match.homeOperationResolved).toBe(true)
		expect(match.result).toBe('manifested-unclaimed')
	})
})

describe('mapFindings sorts every defect finding into one of four buckets', () => {
	const offOperation = observation({
		observationId: 'obs-7',
		sequence: 7,
		operationId: 'read-note',
		responseStatus: 200,
	})

	it('returns an off-operation citation as unmapped, never as a catch', () => {
		const map = mapFindings(
			[qualifiedProbe, canary],
			INTERFACES,
			recordOf(
				[...bothObservations, offOperation],
				[defectFinding(['obs-7'], { findingId: 'F-010' })],
			),
		)
		expect(map.unmapped).toEqual([{ findingId: 'F-010', probeId: 'PX-001' }])
		expect(map.mapped).toEqual([])
		const match = matchProbeWitness(
			qualifiedProbe,
			INTERFACES,
			recordOf(
				[...bothObservations, offOperation],
				[defectFinding(['obs-7'], { findingId: 'F-010' })],
			),
		)
		// The same finding is neither a catch nor an invalidating claim: it is a
		// discovery about a different operation.
		expect(match.result).toBe('manifested-unclaimed')
	})

	it('returns a dangling probe citation separately', () => {
		const map = mapFindings(
			[qualifiedProbe],
			INTERFACES,
			recordOf(bothObservations, [
				defectFinding(['obs-2'], { findingId: 'F-011', probeId: 'P-999' }),
			]),
		)
		expect(map.dangling).toEqual([{ findingId: 'F-011', probeId: 'P-999' }])
	})

	it('returns a finding cited to a signature-less probe in its own bucket', () => {
		const map = mapFindings(
			[qualifiedProbe, canary],
			INTERFACES,
			recordOf(bothObservations, [
				defectFinding(['obs-2'], {
					findingId: 'F-012',
					probeId: canary.probeId,
				}),
			]),
		)
		expect(map.signatureless).toEqual([
			{ findingId: 'F-012', probeId: 'PX-002' },
		])
	})

	it('treats a clean control as signature-less, and memoises one lookup per probe', () => {
		const cleanControl = {
			...canary,
			probeId: 'PX-004',
			probeClass: 'zero-action' as const,
			expectedClean: true as const,
			defects: [],
			qualification: {
				route: 'clean-control' as const,
				baselinePassEvidence: evidenceReference,
				revisionCommitDigest: canary.commitDigest,
				noKnownDefectStatement: 'no known defect at this revision',
			},
		} as unknown as typeof canary
		const unresolvable = {
			...qualifiedProbe,
			probeId: 'PX-005',
			defectSignature: {
				...qualifiedProbe.defectSignature,
				pathTemplate: '/archives',
			},
		}
		const map = mapFindings(
			[qualifiedProbe, cleanControl, unresolvable],
			INTERFACES,
			recordOf(bothObservations, [
				defectFinding(['obs-2'], {
					findingId: 'F-015',
					probeId: 'PX-004',
				}),
				// Two findings on one probe: the second reads the memoised home
				// operation rather than resolving it again.
				defectFinding(['obs-2'], {
					findingId: 'F-016',
					probeId: 'PX-005',
				}),
				defectFinding(['obs-2'], {
					findingId: 'F-017',
					probeId: 'PX-005',
				}),
			]),
		)
		expect(map.signatureless).toEqual([
			{ findingId: 'F-015', probeId: 'PX-004' },
		])
		// The home operation resolves to nothing, so no citation can touch it.
		expect(map.unmapped).toEqual([
			{ findingId: 'F-016', probeId: 'PX-005' },
			{ findingId: 'F-017', probeId: 'PX-005' },
		])
	})

	it('maps a home-operation citation, and reads defect findings only', () => {
		const map = mapFindings(
			[qualifiedProbe],
			INTERFACES,
			recordOf(bothObservations, [
				defectFinding(['obs-2'], { findingId: 'F-013' }),
				{
					findingType: 'confirmation',
					findingId: 'F-014',
					oracleId: 'O-002',
					probeId: 'PX-001',
					behaviorId: 'B-001',
					severity: 'low',
					summary: 'The rejection held on the first call.',
					confidence: 0.5,
					observationIds: ['obs-1'],
					evidenceArtifacts: [],
				},
			]),
		)
		expect(map.mapped).toEqual([{ findingId: 'F-013', probeId: 'PX-001' }])
		expect(map.unmapped).toEqual([])
		expect(map.signatureless).toEqual([])
		expect(map.dangling).toEqual([])
	})
})

describe('quotation audits and never governs', () => {
	it('projects each channel by its own rule', () => {
		const rich = observation({
			observationId: 'obs-p',
			callInputs: {
				path: null,
				query: null,
				header: null,
				body: { b: 1, a: 2 },
			},
			responseBody: { z: 1, a: 2 },
			responseHeaders: { 'content-type': 'application/json' },
			responseStatus: 500,
			stdout: 'hello',
			stderr: 'boom',
			exitCode: -9,
		})
		const at = 'test'
		expect(projectChannel(rich, 'stdout', at)).toBe('hello')
		expect(projectChannel(rich, 'stderr', at)).toBe('boom')
		expect(projectChannel(rich, 'response-status', at)).toBe('500')
		expect(projectChannel(rich, 'exit-code', at)).toBe('-9')
		// RFC 8785: keys sorted, no whitespace. A quote taken from a
		// pretty-printed rendering is deliberately not a substring of this.
		expect(projectChannel(rich, 'response-body', at)).toBe('{"a":2,"z":1}')
		expect(projectChannel(rich, 'response-headers', at)).toBe(
			'{"content-type":"application/json"}',
		)
		expect(projectChannel(rich, 'call-inputs', at)).toBe(
			'{"body":{"a":2,"b":1},"header":null,"path":null,"query":null}',
		)
	})

	it('projects a null channel to nothing, so it witnesses nothing', () => {
		const blank = observation({ observationId: 'obs-blank' })
		for (const channel of [
			'stdout',
			'stderr',
			'response-status',
			'exit-code',
			'response-body',
			'response-headers',
		] as const) {
			expect(projectChannel(blank, channel, 'test'), channel).toBeNull()
		}
		// `call-inputs` is the one channel that always projects: its four-key
		// shape is present even when every channel inside it is null.
		expect(projectChannel(blank, 'call-inputs', 'test')).toBe(
			'{"body":null,"header":null,"path":null,"query":null}',
		)
	})

	it('reports a quote appearing in no cited observation', () => {
		const unwitnessed = auditQuotation(
			recordOf(bothObservations, [
				defectFinding(['obs-1'], { findingId: 'F-020', quote: '500' }),
			]),
		)
		expect(unwitnessed).toEqual([
			{
				findingId: 'F-020',
				quoteIndex: 0,
				channel: 'response-status',
				quote: '500',
				citedObservationIds: ['obs-1'],
			},
		])
	})

	// Spine `:531` makes an unwitnessed quote a property of the finding, so the
	// audit does not care which bucket the finding maps to.
	it('audits a finding whose citations never touch the home operation', () => {
		const off = observation({
			observationId: 'obs-8',
			operationId: 'read-note',
			responseStatus: 200,
		})
		const unwitnessed = auditQuotation(
			recordOf(
				[...bothObservations, off],
				[defectFinding(['obs-8'], { findingId: 'F-021', quote: '500' })],
			),
		)
		expect(unwitnessed.map((entry) => entry.findingId)).toEqual(['F-021'])
	})

	it('says nothing about a quote the cited observation carries', () => {
		expect(
			auditQuotation(
				recordOf(bothObservations, [
					defectFinding(['obs-2'], { quote: '500' }),
				]),
			),
		).toEqual([])
	})

	it('does not feed the verdict: an unwitnessed quote still resolves matched', () => {
		const record = recordOf(bothObservations, [
			defectFinding(['obs-2'], { quote: 'a quote nothing carries' }),
		])
		expect(matchProbeWitness(qualifiedProbe, INTERFACES, record).result).toBe(
			'matched',
		)
		expect(auditQuotation(record)).toHaveLength(1)
	})
})

describe('the containment procedure, defined and unreachable in v0', () => {
	// Its input is constructed below the schema boundary with a typed cast: the
	// defect branch has required at least one observation identifier since the
	// schema's first version, so no record this reader accepts can present the
	// shape the procedure exists for.
	const legacyFinding = {
		quotedEvidence: [{ quote: 'internal error', channel: 'response-body' }],
	} as unknown as {
		quotedEvidence: { quote: string; channel: 'response-body' }[]
	}

	it('labels its result reconstructed and resolves by quotation', () => {
		const derived = reconstructDetection(legacyFinding, [defectFired], 'test')
		expect(derived).toEqual({
			basis: 'reconstructed',
			detected: true,
			witnessObservationIds: ['obs-2'],
		})
	})

	it('detects nothing when the quotation appears in no satisfying observation', () => {
		const derived = reconstructDetection(
			legacyFinding,
			[correctRejection],
			'test',
		)
		expect(derived.detected).toBe(false)
		expect(derived.basis).toBe('reconstructed')
	})

	it('proves nothing from an empty quotation list', () => {
		const derived = reconstructDetection(
			{ quotedEvidence: [] },
			[defectFired],
			'test',
		)
		expect(derived.detected).toBe(false)
	})

	it('is never what the measured match reports', () => {
		expect(
			matchProbeWitness(qualifiedProbe, INTERFACES, recordOf(bothObservations))
				.basis,
		).toBe('measured')
	})
})
