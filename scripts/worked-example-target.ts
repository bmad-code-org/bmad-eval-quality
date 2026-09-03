// Everything the worked-example generator and its drift check must agree on:
// where the chain lives, which five files the builder owns, and the bytes
// themselves. Both import this module, so neither can address a file the other
// does not.
//
// Owed item 7: the chain's derived values were hand-typed against a pre-epic-7
// architecture and are now demonstrably wrong. Nothing downstream of the
// evaluator's own evidence is written here by hand. The evaluator-authored
// inputs are the contract, the probe's declarations, and the run record's raw
// observations, dispositions, and findings; every selection, check resolution,
// witness match, outcome state, corroboration, rate and verdict below is the
// return value of a reference function this epic built.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports.
import { compile } from '../src/application/compile.ts'
import { seal } from '../src/application/seal.ts'
import { serializeArtifact } from '../src/application/serialize.ts'
import { digestArtifact } from '../src/core/canonical/digest.ts'
import { walkExpression } from '../src/core/compile/expression-legality.ts'
import { evaluateCoverage } from '../src/core/coverage/coverage.ts'
import { emit } from '../src/core/emit/emit.ts'
import {
	makePointerDenotesCollection,
	makeResolveOperand,
} from '../src/core/evaluate/evidence-resolution.ts'
import { resolveCheck } from '../src/core/evaluate/resolution.ts'
import { validateLineageChain } from '../src/core/lineage/chain.ts'
import type { DefectSignature } from '../src/core/schemas/defect-signature.ts'
import type { EvalContract } from '../src/core/schemas/eval-contract.ts'
import {
	type CheckResolutionValue,
	EvidenceArtifact,
	type Outcome,
	type UncitedFindingGap,
} from '../src/core/schemas/evidence-artifact.ts'
import type {
	Expression,
	Operand,
	SetOperand,
} from '../src/core/schemas/expression.ts'
import type { Operation } from '../src/core/schemas/interface.ts'
import type { KeyedShapeDescriptor } from '../src/core/schemas/primitives.ts'
import { Probe } from '../src/core/schemas/probe.ts'
import { ScoringPolicy } from '../src/core/schemas/scoring-policy.ts'
import type { SealedEvaluatorBrief } from '../src/core/schemas/sealed-evaluator-brief.ts'
import {
	type Observation,
	SealedRunRecord,
} from '../src/core/schemas/sealed-run-record.ts'
import { bindingOrder } from '../src/core/score/binding-order.ts'
import {
	resolveCapturedBindings,
	selectWithBindings,
} from '../src/core/score/bindings.ts'
import {
	type ContractAssessment,
	resolveContractVerdict,
	type ScoredOutcome,
} from '../src/core/score/ladder.ts'
import {
	type OutcomeInputs,
	resolveOutcome,
	uncitedDefectFindingGaps,
	uncitedFindingIds,
} from '../src/core/score/outcome.ts'
import {
	resolveHomeOperation,
	sealProbeSet,
} from '../src/core/score/qualification.ts'
import { auditQuotation } from '../src/core/score/quotation.ts'
import { reduceTrialSet } from '../src/core/score/reduce-trials.ts'
import type { ScoredOutcomesAndVerdict } from '../src/core/score/score.ts'
import type { StepSelection } from '../src/core/score/selection.ts'
import {
	type FindingMap,
	mapFindings,
	matchProbeWitness,
	type ProbeWitnessMatch,
	type SignedProbe,
} from '../src/core/score/witness.ts'
import { buildPlanIndex } from '../src/core/seal/plan-index.ts'

/** Repository-relative, for the emitted keys and for violation messages. */
export const WORKED_EXAMPLE_LABEL =
	'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/spike-worked-example'

export const WORKED_EXAMPLE_ROOT = new URL(
	`../${WORKED_EXAMPLE_LABEL}/`,
	import.meta.url,
)

/**
 * The five files this builder owns, and nothing else under that directory.
 * `FINDINGS.md`, `README.md`, and `system-under-test.md` are hand-authored
 * evidence: the generator never clears the directory and the drift check runs
 * no orphan sweep, so neither touches them.
 */
export const WORKED_EXAMPLE_FILES = [
	'eval-contract.json',
	'brief.json',
	'probe.json',
	'sealed-run-record.json',
	'evidence-artifact.json',
] as const

const keyOf = (name: string): string => `${WORKED_EXAMPLE_LABEL}/${name}`

/**
 * Canonical bytes, re-indented. RFC 8785 fixes key order and number spelling,
 * so two runs over one input produce one tree; the re-indent is what keeps the
 * chain readable, which is the only reason this folder exists.
 *
 * Two consequences, both stated because a reader of a worked example will hit
 * them.
 *
 * The bytes on disk are the re-indented form, so hashing a file here does not
 * reproduce a digest recorded inside it. `sealed-run-record.json`'s
 * `contractDigest` is `digestArtifact` over the contract's canonical bytes,
 * which is `serializeArtifact` output with no whitespace; `shasum -a 256` over
 * `eval-contract.json` hashes this indented rendering and gives a different
 * value. Every digest in this chain is over the canonical form. That is what
 * `dev-corpus-target.ts` avoids by writing `serializeArtifact` output straight
 * to disk, and the trade taken here is readability against a hash a reader can
 * reproduce with one shell command.
 *
 * The re-indent preserves RFC 8785 key order only while no emitted object
 * carries an array-index-like key: V8 hoists integer-like own properties and
 * enumerates them in numeric order ahead of the string keys, so `JSON.parse`
 * followed by `JSON.stringify` would reorder such an object. The round trip
 * below checks that rather than asserting it, because a breach is otherwise
 * invisible: the generator would write reordered bytes and the drift check
 * would compare them against an identically reordered rebuild and exit 0. The
 * digests are computed over the canonical bytes rather than over this
 * rendering, so nothing downstream reads the rendered order either way.
 */
const renderJson = (value: unknown, artifactPath: string): string => {
	const canonical = serializeArtifact(value, artifactPath)
	const rendered = `${JSON.stringify(JSON.parse(canonical), null, 2)}\n`
	// `serializeArtifact` ends its output with a newline, which the re-parse
	// drops, so the comparison puts one back.
	if (`${JSON.stringify(JSON.parse(rendered))}\n` !== canonical) {
		fail(`${artifactPath}: the re-indent did not round-trip to canonical bytes`)
	}
	return rendered
}

const digestPlaceholder = (ordinal: number): string =>
	`sha256:${ordinal.toString(16).padStart(64, '0')}`

// ---------------------------------------------------------------------------
// authored input 1: the scoring policy the run was scored under
// ---------------------------------------------------------------------------

/**
 * The published default policy. Not one of the five emitted files: it is a
 * caller-side input the chain was scored under, and it is here so the severity
 * floor, the thresholds, and the regex budget below are read from one declared
 * artifact rather than from five scattered literals.
 */
const POLICY = ScoringPolicy.parse({
	schemaVersion: 2,
	parentDigest: null,
	revisionCount: 0,
	policyId: 'default-policy',
	severityFloor: 'material',
	confidenceThreshold: 0.7,
	catchThreshold: 0.5,
	minimumTrialCount: 3,
	reExecutionCap: 2,
	remediationCap: 3,
	regexMatchStepBudget: 1000000,
})

// ---------------------------------------------------------------------------
// authored input 2: the Eval Contract
// ---------------------------------------------------------------------------

const emptyChannel = (): KeyedShapeDescriptor => ({
	requiredKeys: [],
	permittedKeys: [],
	types: {},
})

/** The note payload both read operations and the update return. */
const NOTE_SHAPE: KeyedShapeDescriptor = {
	requiredKeys: ['id', 'title', 'body', 'tags', 'updatedAt'],
	permittedKeys: ['id', 'title', 'body', 'tags', 'updatedAt'],
	types: {
		id: 'string',
		title: 'string',
		body: 'string',
		tags: 'array',
		updatedAt: 'string',
	},
}

const noteEnvelope = (): Operation['responseDescriptor'] => ({
	requiredKeys: ['ok'],
	permittedKeys: ['ok', 'note', 'error'],
	types: { ok: 'boolean', note: 'object', error: 'string' },
	successIndicator: '/ok',
	channelRoles: {
		'/ok': 'success-indicator',
		'/note': 'payload',
		'/error': 'diagnostic',
	},
	collectionLocations: [],
})

/**
 * Authored whole against the current `EvalContract`, not patched. The committed
 * file predates eight schema revisions: the interface-level `responseShape` and
 * `volatilePointers` moved onto each operation, `path` became `pathTemplate`,
 * the flat request triple became the four-channel `RequestShape`, contract-level
 * `linkage` and `strictMode` are gone, and every step now declares a
 * `cardinality` and an explicit `after`.
 */
const AUTHORED_CONTRACT = {
	schemaVersion: 3,
	contractId: 'notes-api-v1',
	parentDigest: null,
	revisionCount: 0,
	sourceSpecDigest: digestPlaceholder(1),
	behaviors: [
		{
			id: 'B-001',
			description: 'A PATCH reporting success has persisted the change.',
			severity: 'critical',
			observableSuccessCriterion:
				'An independent GET issued after a successful PATCH returns the title the PATCH sent.',
			requirementLinks: [{ scheme: 'spike', id: 'REQ-NOTES-1' }],
			riskLinks: [{ scheme: 'spike-risk', id: 'RISK-SILENT-WRITE' }],
			oracles: ['O-001'],
		},
		{
			id: 'B-002',
			description:
				'The success indicator agrees with the transport status and excludes a diagnostic.',
			severity: 'material',
			observableSuccessCriterion:
				'A successful call carries status 200 with `ok` true, a complete note payload, and no diagnostic field.',
			requirementLinks: [{ scheme: 'spike', id: 'REQ-NOTES-2' }],
			riskLinks: [],
			oracles: ['O-002', 'O-003'],
		},
		{
			id: 'B-003',
			description:
				'Every note in a collection response is complete, not only the first.',
			severity: 'material',
			observableSuccessCriterion:
				'Every element of the collection response carries all five declared note fields.',
			requirementLinks: [{ scheme: 'spike', id: 'REQ-NOTES-3' }],
			riskLinks: [],
			oracles: ['O-004'],
		},
		{
			id: 'B-004',
			description:
				'A malformed PATCH body is rejected rather than silently accepted.',
			severity: 'low',
			observableSuccessCriterion:
				'A PATCH whose tags field violates its declared type returns status 400 with `ok` false.',
			requirementLinks: [{ scheme: 'spike', id: 'REQ-NOTES-4' }],
			riskLinks: [],
			oracles: ['O-005'],
		},
	],
	oracles: [
		{
			id: 'O-001',
			direction: {
				evidenceTargets: [
					'/interactions/read-back/response-body/note/title',
					'/interactions/write/call-inputs/body/title',
				],
				relation: 'equality',
				polarity: 'expects-hold',
				scope:
					'One update followed by one independent read of the same note through the separate read operation.',
				negativeDomain:
					"An update reporting success whose title the later read does not return. The update operation's own response is not evidence that it persisted: that response can be generated from a value that was never written.",
			},
			check: {
				op: 'equality',
				operands: [
					{ pointer: '/interactions/read-back/response-body/note/title' },
					{ pointer: '/interactions/write/call-inputs/body/title' },
				],
			},
			polarity: 'expects-hold',
			commentary:
				'The read-back rule. The seeded defect turns on this oracle binding one particular read.',
		},
		{
			id: 'O-002',
			direction: {
				evidenceTargets: [
					'/interactions/write/response-status',
					'/interactions/write/response-body/ok',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: "The update call's status and its success indicator, together.",
				negativeDomain:
					'A body claiming success under a failing status, or the reverse.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/write/response-status' },
							{ literal: 200 },
						],
					},
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/write/response-body/ok' },
							{ literal: true },
						],
					},
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-003',
			direction: {
				evidenceTargets: [
					'/interactions/write/response-body/error',
					'/interactions/write/response-body/note',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope: 'The update response taken as a whole.',
				negativeDomain:
					'A success carrying a diagnostic field beside the success flag, or a note payload carrying only the fields the caller changed.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'absence',
						operands: [{ pointer: '/interactions/write/response-body/error' }],
					},
					{
						op: 'shape',
						operands: [{ pointer: '/interactions/write/response-body/note' }],
						descriptor: NOTE_SHAPE,
					},
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
		{
			id: 'O-004',
			direction: {
				evidenceTargets: ['/interactions/collection/response-body/notes'],
				relation: 'for-all',
				polarity: 'expects-hold',
				scope: 'Every element of the collection response.',
				negativeDomain:
					'A collection whose first element carries all five fields and whose later elements do not.',
			},
			check: {
				op: 'for-all',
				collection: { pointer: '/interactions/collection/response-body/notes' },
				predicate: {
					op: 'shape',
					operands: [{ pointer: '@/' }],
					descriptor: NOTE_SHAPE,
				},
			},
			polarity: 'expects-hold',
			commentary:
				'Per-record completeness. AD-4 resolves this over an empty collection as `insufficient-evidence` rather than vacuously true.',
		},
		{
			id: 'O-005',
			direction: {
				evidenceTargets: [
					'/interactions/malformed-write/response-status',
					'/interactions/malformed-write/response-body/ok',
				],
				relation: 'all',
				polarity: 'expects-hold',
				scope:
					'One update whose tags value violates the declared type for that key.',
				negativeDomain:
					'A malformed body accepted with status 200 instead of rejected with 400.',
			},
			check: {
				op: 'all',
				operands: [
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/malformed-write/response-status' },
							{ literal: 400 },
						],
					},
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/malformed-write/response-body/ok' },
							{ literal: false },
						],
					},
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
	],
	rubrics: [],
	waivers: [],
	permittedInterfaces: [
		{
			logicalId: 'notes-api',
			kind: 'api',
			operations: [
				{
					operationId: 'get-note',
					method: 'GET',
					pathTemplate: '/notes/{id}',
					stateChangeMarker: false,
					requestShape: {
						path: {
							requiredKeys: ['id'],
							permittedKeys: ['id'],
							types: { id: 'string' },
						},
						query: emptyChannel(),
						header: emptyChannel(),
						body: emptyChannel(),
					},
					responseDescriptor: noteEnvelope(),
					volatilePointers: ['/note/updatedAt'],
					sensitivityWitness: {
						witnessId: 'get-note-sensitivity',
						channel: 'path',
						legs: [
							{
								legId: 'get-note-witness-a',
								inputs: {
									path: { id: 'n-1' },
									query: {},
									header: {},
									body: { kind: 'absent' },
								},
							},
							{
								legId: 'get-note-witness-b',
								inputs: {
									path: { id: 'n-2' },
									query: {},
									header: {},
									body: { kind: 'absent' },
								},
							},
						],
						relation: {
							op: 'not',
							operands: [
								{
									op: 'deep-equality',
									operands: [
										{
											pointer: '/interactions/get-note-witness-a/response-body',
										},
										{
											pointer: '/interactions/get-note-witness-b/response-body',
										},
									],
								},
							],
						},
					},
				},
				{
					operationId: 'patch-note',
					method: 'PATCH',
					pathTemplate: '/notes/{id}',
					stateChangeMarker: true,
					requestShape: {
						path: {
							requiredKeys: ['id'],
							permittedKeys: ['id'],
							types: { id: 'string' },
						},
						query: emptyChannel(),
						header: emptyChannel(),
						body: {
							requiredKeys: [],
							permittedKeys: ['title', 'body', 'tags'],
							types: { title: 'string', body: 'string', tags: 'array' },
						},
					},
					responseDescriptor: noteEnvelope(),
					volatilePointers: ['/note/updatedAt'],
					sensitivityWitness: {
						witnessId: 'patch-note-sensitivity',
						channel: 'body',
						legs: [
							{
								legId: 'patch-note-witness-a',
								inputs: {
									path: { id: 'n-1' },
									query: {},
									header: {},
									body: { kind: 'json', value: { title: 'alpha' } },
								},
							},
							{
								legId: 'patch-note-witness-b',
								inputs: {
									path: { id: 'n-1' },
									query: {},
									header: {},
									body: { kind: 'json', value: { title: 'beta' } },
								},
							},
						],
						relation: {
							op: 'not',
							operands: [
								{
									op: 'deep-equality',
									operands: [
										{
											pointer:
												'/interactions/patch-note-witness-a/response-body',
										},
										{
											pointer:
												'/interactions/patch-note-witness-b/response-body',
										},
									],
								},
							],
						},
					},
				},
				{
					operationId: 'list-notes',
					method: 'GET',
					pathTemplate: '/notes',
					stateChangeMarker: false,
					requestShape: {
						path: emptyChannel(),
						query: emptyChannel(),
						header: emptyChannel(),
						body: emptyChannel(),
					},
					responseDescriptor: {
						requiredKeys: ['ok'],
						permittedKeys: ['ok', 'notes', 'error'],
						types: { ok: 'boolean', notes: 'array', error: 'string' },
						successIndicator: '/ok',
						channelRoles: {
							'/ok': 'success-indicator',
							'/notes': 'collection',
							'/error': 'diagnostic',
						},
						collectionLocations: [
							{
								pointer: '/notes',
								expectedCardinality: { mode: 'exact', count: 3 },
								referenceSet: null,
							},
						],
					},
					volatilePointers: [],
					// AD-10 exempts an operation declaring no key in any request
					// channel, and this one declares none.
					sensitivityWitness: null,
				},
			],
		},
	],
	referenceSets: null,
	siblingGroups: {
		operations: [['get-note', 'list-notes']],
		parameters: [['title', 'body']],
	},
	interactionPlan: [
		{
			stepId: 'baseline-read',
			operationId: 'get-note',
			inputBinding: {
				path: { id: { literal: 'n-1' } },
				query: null,
				header: null,
				body: null,
			},
			after: null,
			// The one step that genuinely matches several observations: it carries
			// no temporal clause and both reads of `n-1` satisfy it. `any` is what
			// several legitimate matches are declared with.
			cardinality: 'any',
		},
		{
			stepId: 'write',
			operationId: 'patch-note',
			inputBinding: {
				path: { id: { literal: 'n-1' } },
				query: null,
				header: null,
				body: { title: { matcher: 'any' } },
			},
			after: null,
			cardinality: 'exactly-one',
		},
		{
			stepId: 'read-back',
			operationId: 'get-note',
			inputBinding: {
				path: { id: { literal: 'n-1' } },
				query: null,
				header: null,
				body: null,
			},
			// The temporal clause, not a widened cardinality, is what separates this
			// step from `baseline-read`: the selector floors its candidates at the
			// anchor's sequence.
			after: 'write',
			cardinality: 'exactly-one',
		},
		{
			stepId: 'collection',
			operationId: 'list-notes',
			inputBinding: { path: null, query: null, header: null, body: null },
			after: null,
			cardinality: 'exactly-one',
		},
		{
			stepId: 'malformed-write',
			operationId: 'patch-note',
			inputBinding: {
				path: { id: { literal: 'n-1' } },
				query: null,
				header: null,
				body: { tags: { matcher: 'type-violating' } },
			},
			after: null,
			cardinality: 'exactly-one',
		},
	],
	scopedResources: null,
	forbiddenInputs: [
		'original-spec',
		'source-code',
		'repository',
		'builder-transcript',
		'implementation-logs',
		'comparator-results',
		'human-labels',
	],
	testData: {
		setup:
			'Seed exactly three notes with ids n-1, n-2, n-3, each with all five fields populated.',
		cleanup: 'Delete all notes created or modified during the run.',
		principals: null,
		resources: null,
	},
	budgets: {
		maxToolCalls: 40,
		maxWallClockMinutes: 10,
		maxCostUsd: '1.0',
	},
	safetyLimits: [
		'No request to any host other than the mapped notes-api target.',
	],
	requiredEvidence: ['Request and response pair for every call, in order.'],
	probeStepBound: 8,
	fixtureReset: null,
} satisfies EvalContract

// ---------------------------------------------------------------------------
// authored input 3: the probe, P-001
// ---------------------------------------------------------------------------

const spikeEvidence = (ordinal: number, label: string) => ({
	storage: 'private' as const,
	path: null,
	privateRef: `opaque:${label}`,
	digest: digestPlaceholder(ordinal),
})

/**
 * AD-40's signature, homed on the read rather than on the update.
 * `system-under-test.md` records why: the update's own response "is
 * indistinguishable from a correct one", so no condition over a single
 * `PATCH` observation separates the seeded defect from correct behaviour.
 * The defect manifests on the independent read that returns the stale title,
 * which is the observation the evaluator's own defect finding cites.
 */
const SEEDED_SIGNATURE: DefectSignature = {
	interfaceKind: 'api',
	method: 'GET',
	pathTemplate: '/notes/{id}',
	observableChannel: 'response-body',
	condition: {
		selector: {
			inputBinding: {
				path: { id: { literal: 'n-1' } },
				query: null,
				header: null,
				body: null,
			},
		},
		predicate: {
			op: 'equality',
			operands: [
				{ pointer: '/interactions/observed/response-body/note/title' },
				{ literal: 'Original' },
			],
		},
	},
}

/**
 * The AD-9 qualification record is authored, not computed: `qualification` is a
 * declared field on the probe and `qualifyProbe` is the gate over it, never its
 * producer. What the gate owes owed item 7 is that it actually runs, which is
 * why `sealProbeSet` below fails the build on a rejection.
 */
const AUTHORED_PROBE = {
	schemaVersion: 2,
	parentDigest: null,
	revisionCount: 0,
	probeId: 'P-001',
	probeClass: 'defect',
	behaviorId: 'B-001',
	systemId: 'spike-notes-api',
	implementationDigest: digestPlaceholder(7),
	artifactDigest: digestPlaceholder(8),
	commitDigest: digestPlaceholder(9),
	rationale:
		'The seeded silent-write defect: PATCH validates, builds the updated note, returns it with ok true and status 200, and never persists it. Only an independent GET reveals the old value.',
	qualification: {
		route: 'controlled-mutation',
		mutationSource:
			'the toy Notes API written for this spike, with the persistence call removed from the update handler',
		mutationOperator: 'store-write-deletion',
		targetArtifact: spikeEvidence(10, 'spike-notes-api-handler'),
		expectedObservableFailure:
			'a later independent GET of the updated note returns the title the update replaced',
		baselinePassEvidence: spikeEvidence(11, 'spike-baseline-pass'),
		mutatedFailEvidence: spikeEvidence(12, 'spike-mutated-fail'),
		rollbackVerified: true,
	},
	expectedClean: false,
	defects: [
		{
			defectId: 'D-001',
			behaviorId: 'B-001',
			summary:
				'PATCH /notes/{id} reports success and never writes; the response is generated from the in-memory object it declined to persist.',
			severity: 'critical',
			oracleEvidence: [spikeEvidence(13, 'spike-defect-evidence')],
			source: 'controlled-mutation',
			manifestationWitness: null,
		},
	],
	defectSignature: SEEDED_SIGNATURE,
} satisfies Probe

// ---------------------------------------------------------------------------
// authored input 4: the sealed run record
// ---------------------------------------------------------------------------

const JSON_HEADERS = { 'content-type': 'application/json' }

const note = (
	id: string,
	title: string,
	body: string,
	tags: string[],
	updatedAt: string,
) => ({ id, title, body, tags, updatedAt })

/**
 * The observations are evaluator-authored evidence and stay so: there is no
 * live Notes API in this repository, only the prose spec, and `core/ingest`
 * does not exist. Owed item 7 forbids hand-filling a downstream value that
 * pretends to be a reducer's output; it never asked for a live system to run
 * against. The evidence here is the same five calls the committed record
 * carries. Only its shape moved.
 */
const authoredRecord = (
	contractDigest: string,
	briefDigest: string,
): SealedRunRecord => ({
	schemaVersion: 3,
	parentDigest: null,
	revisionCount: 0,
	runId: 'spike-run-0001',
	conditionArm: 'independent',
	mode: 'contract-scoring',
	trialIndex: 1,
	contractDigest,
	sealedBriefDigest: briefDigest,
	evaluatorConfigurationDigest: digestPlaceholder(4),
	evaluatorRecommendation: 'FAIL',
	oracleDispositions: [
		{
			oracleId: 'O-001',
			disposition: 'violated',
			observationIds: ['obs-003', 'obs-004'],
			note: 'Update reported success; the independent read returned the old title.',
		},
		{
			oracleId: 'O-002',
			disposition: 'held',
			observationIds: ['obs-003'],
			note: 'Status and ok agreed on every successful call.',
		},
		{
			oracleId: 'O-003',
			disposition: 'held',
			observationIds: ['obs-003'],
			note: 'The update response carried all five fields and no diagnostic alongside the success flag.',
		},
		{
			oracleId: 'O-004',
			disposition: 'held',
			observationIds: ['obs-002'],
			note: 'Every note in the collection carried all five fields.',
		},
		{
			// The honest record of a step that witnessed nothing: the evaluator
			// narrates a 400 rejection that appears in no observation, and cites
			// none. `unsupported-disposition` is what reads this.
			oracleId: 'O-005',
			disposition: 'held',
			observationIds: [],
			note: 'A tags value of the wrong type was rejected with 400 and ok false.',
		},
	],
	findings: [
		{
			findingId: 'F-001',
			findingType: 'defect',
			oracleId: 'O-001',
			probeId: 'P-001',
			behaviorId: 'B-001',
			severity: 'critical',
			confidence: 0.95,
			summary:
				"PATCH /notes/n-1 returned 200 with ok true and the new title 'Revised', but a subsequent GET /notes/n-1 returned the original title 'Original'. The update response was not backed by a write.",
			observationIds: ['obs-003', 'obs-004'],
			quotedEvidence: [
				{ quote: '"title":"Revised"', channel: 'response-body' },
				{ quote: '"title":"Original"', channel: 'response-body' },
			],
			evidenceArtifacts: [spikeEvidence(5, 'spike-actions-0001')],
		},
		{
			findingId: 'F-002',
			findingType: 'confirmation',
			oracleId: 'O-002',
			probeId: 'P-001',
			behaviorId: 'B-002',
			severity: 'material',
			confidence: 0.99,
			summary:
				'Status 200 agreed with ok true on every successful call observed.',
			observationIds: ['obs-001', 'obs-003'],
			evidenceArtifacts: [],
		},
		{
			findingId: 'F-003',
			findingType: 'observation',
			oracleId: null,
			probeId: 'P-001',
			behaviorId: null,
			severity: 'low',
			confidence: 0.8,
			summary:
				"PATCH accepts an unknown field 'colour' and echoes it back in the note payload. No oracle in the contract addresses unknown-field handling, so this is filed uncited.",
			observationIds: ['obs-005'],
			evidenceArtifacts: [],
		},
	],
	observations: [
		{
			observationId: 'obs-001',
			sequence: 1,
			operationId: 'get-note',
			provenance: 'baseline',
			callInputs: {
				path: { id: 'n-1' },
				query: null,
				header: null,
				body: null,
			},
			responseBody: {
				ok: true,
				note: note('n-1', 'Original', 'b', ['t'], '2026-07-29T10:00:00Z'),
			},
			responseHeaders: JSON_HEADERS,
			responseStatus: 200,
			stdout: null,
			stderr: null,
			exitCode: null,
		},
		{
			observationId: 'obs-002',
			sequence: 2,
			operationId: 'list-notes',
			provenance: 'baseline',
			callInputs: { path: null, query: null, header: null, body: null },
			responseBody: { ok: true, notes: [] },
			responseHeaders: JSON_HEADERS,
			responseStatus: 200,
			stdout: null,
			stderr: null,
			exitCode: null,
		},
		{
			observationId: 'obs-003',
			sequence: 3,
			operationId: 'patch-note',
			provenance: 'evaluator-chosen',
			callInputs: {
				path: { id: 'n-1' },
				query: null,
				header: null,
				body: { title: 'Revised' },
			},
			responseBody: {
				ok: true,
				note: note('n-1', 'Revised', 'b', ['t'], '2026-07-29T10:05:00Z'),
			},
			responseHeaders: JSON_HEADERS,
			responseStatus: 200,
			stdout: null,
			stderr: null,
			exitCode: null,
		},
		{
			observationId: 'obs-004',
			sequence: 4,
			operationId: 'get-note',
			provenance: 'evaluator-chosen',
			callInputs: {
				path: { id: 'n-1' },
				query: null,
				header: null,
				body: null,
			},
			responseBody: {
				ok: true,
				note: note('n-1', 'Original', 'b', ['t'], '2026-07-29T10:00:00Z'),
			},
			responseHeaders: JSON_HEADERS,
			responseStatus: 200,
			stdout: null,
			stderr: null,
			exitCode: null,
		},
		{
			observationId: 'obs-005',
			sequence: 5,
			operationId: 'patch-note',
			provenance: 'evaluator-chosen',
			callInputs: {
				path: { id: 'n-2' },
				query: null,
				header: null,
				body: { colour: 'red' },
			},
			responseBody: {
				ok: true,
				note: {
					...note('n-2', 'Second', 'b2', [], '2026-07-29T10:06:00Z'),
					colour: 'red',
				},
			},
			responseHeaders: JSON_HEADERS,
			responseStatus: 200,
			stdout: null,
			stderr: null,
			exitCode: null,
		},
	],
	judgeResults: [],
	actionsArtifact: spikeEvidence(5, 'spike-actions-0001'),
	isolationManifestArtifact: spikeEvidence(6, 'spike-manifest-0001'),
	resourceUse: {
		toolCalls: 5,
		inputTokens: 8100,
		outputTokens: 1400,
		wallClockSeconds: 62.5,
		costUsd: '0.04',
	},
	evidenceDisclosure: { truncationBound: null, reportedIncomplete: false },
	invalidReason: null,
})

const SYSTEM_RECOMMENDATION_NOTE =
	'Expected in contract-scoring mode: the probe is knowingly defective, so a system-directed FAIL is an input rather than a signal about the contract. Not promoted to a verdict.'

// ---------------------------------------------------------------------------
// derivation
// ---------------------------------------------------------------------------

/** Every interaction-rooted step identifier one check addresses. */
function addressedSteps(expression: Expression): ReadonlySet<string> {
	const found = new Set<string>()
	const take = (operand: Operand | SetOperand): void => {
		if (!('pointer' in operand)) return
		const { pointer } = operand
		if (pointer.startsWith('@')) return
		// The root segment is checked, so a pointer rooted anywhere else cannot
		// contribute a phantom step identifier that happens to match a plan step.
		const [, root, stepId] = pointer.split('/')
		if (root === 'interactions' && stepId !== undefined) found.add(stepId)
	}
	walkExpression(expression, 0, '', { onOperand: take, onSetOperand: take })
	return found
}

/** AD-23 and AD-40's four finding buckets, in `FindingMap`'s own declaration order. */
const FINDING_BUCKETS = [
	'mapped',
	'unmapped',
	'dangling',
	'signatureless',
] as const satisfies readonly (keyof FindingMap)[]

/**
 * A function declaration rather than an arrow, because TypeScript treats a
 * call as never-returning only when the callee is declared this way. As a
 * `const` arrow it stops narrowing at every guard below, and the null checks
 * on `oracle.check` and on the plan lookups then need casts to undo.
 */
function fail(message: string): never {
	throw new Error(`worked-example: ${message}`)
}

/**
 * The chain as values rather than bytes: the four artifacts the files carry
 * plus the two intermediate results a reader has to be able to check
 * independently. `buildWorkedExample` renders exactly this, so a test driving
 * the chain reads the same values the committed files carry without touching
 * the filesystem.
 */
export type WorkedExampleChain = {
	readonly contract: EvalContract
	readonly brief: SealedEvaluatorBrief
	readonly probe: SignedProbe
	readonly record: SealedRunRecord
	readonly artifact: EvidenceArtifact
	readonly witness: ProbeWitnessMatch
	readonly selectionOf: ReadonlyMap<string, StepSelection>
}

/**
 * The chain, derived. Deterministic: no clock, no randomness, no input outside
 * the literals above.
 */
export function buildWorkedExampleChain(): WorkedExampleChain {
	const contract = compile(AUTHORED_CONTRACT)
	const brief = seal(AUTHORED_CONTRACT)
	const contractDigest = digestArtifact(contract, 'EvalContract')
	const briefDigest = digestArtifact(brief, 'SealedEvaluatorBrief')
	const probe = Probe.parse(AUTHORED_PROBE)
	const record = SealedRunRecord.parse(
		authoredRecord(contractDigest, briefDigest),
	)

	// AD-9's gate, run for real. A rejection fails the build rather than
	// shipping a chain scored against a probe no sealed set would admit.
	const homeOperationOf = (candidate: Probe): Operation | null =>
		candidate.expectedClean || candidate.defectSignature === null
			? null
			: resolveHomeOperation(
					candidate.defectSignature,
					contract.permittedInterfaces,
				)
	const sealedProbes = sealProbeSet([probe], homeOperationOf)
	if (sealedProbes.rejected.length > 0) {
		fail(
			`${probe.probeId} did not qualify: ${sealedProbes.rejected
				.flatMap((entry) => entry.result.failures)
				.map((failure) => `${failure.code} at ${failure.artifactPath}`)
				.join('; ')}`,
		)
	}
	const admitted = sealedProbes.admitted[0] ?? fail('no probe was admitted')

	// Selection: `bindingOrder` first, then the captured-binding map, then the
	// binding-aware selector. Bare `selectObservations` filters on `operationId`
	// alone and returns `several` for all four steps that share an operation;
	// the temporal clause and the binding filters are what separate them.
	const index = buildPlanIndex(
		contract.interactionPlan,
		contract.permittedInterfaces,
	)
	// `resolveCapturedBindings` orders the plan itself, so this call is here
	// only to assert the plan is acyclic before it does.
	const { cyclic } = bindingOrder(contract.interactionPlan)
	if (cyclic.length > 0) {
		fail(`the interaction plan carries a binding cycle: ${cyclic.join(', ')}`)
	}
	const captured = resolveCapturedBindings(
		contract.interactionPlan,
		index,
		record.observations,
	)
	const selectionOf = new Map<string, StepSelection>()
	for (const step of contract.interactionPlan) {
		selectionOf.set(
			step.stepId,
			selectWithBindings(step, record.observations, index, captured),
		)
	}

	// One observation per step, by the same rule `resolveTemporalAnchor`
	// (`selection.ts:96-127`) applies to an anchor: one match binds, several
	// under a declared `any` binds the lowest sequence, and anything else binds
	// nothing. That function cannot be called here because it re-runs the
	// operation-only `selectObservations` instead of taking a `StepSelection`,
	// and lifting the reduction out of it would be new score-side surface this
	// story's Boundaries forbid. `matchedObservationIds` is ascending by
	// `sequence` (`selection.ts:28-31`), so `[0]` is the lowest.
	const observationById = new Map(
		record.observations.map((observation) => [
			observation.observationId,
			observation,
		]),
	)
	const stepObservations: Record<string, Observation> = {}
	for (const step of contract.interactionPlan) {
		const selection =
			selectionOf.get(step.stepId) ??
			fail(`step ${step.stepId} was never selected`)
		const [first] = selection.matchedObservationIds
		if (first === undefined) continue
		if (selection.result === 'several' && step.cardinality !== 'any') continue
		const observation =
			observationById.get(first) ??
			fail(`step ${step.stepId} selected unknown observation ${first}`)
		stepObservations[step.stepId] = observation
	}
	// The contract's own declared sets, projected to their members. Hardcoding
	// an empty map would leave a reference-set operand added later resolving
	// ABSENT, which weakens the check it sits in instead of failing loudly.
	const referenceSets = Object.fromEntries(
		Object.entries(contract.referenceSets ?? {}).map(([id, declaration]) => [
			id,
			declaration.members,
		]),
	)
	const resolveOperand = makeResolveOperand(stepObservations, referenceSets)
	const pointerDenotesCollection = makePointerDenotesCollection(contract, index)

	// AD-40's witness match, and AD-23's finding buckets.
	// Split so each failure names its own reason. The cast is what TypeScript
	// still needs after them: narrowing `probe.defectSignature` refines the
	// property for reads and leaves the object's own declared type alone, so
	// the whole value is not assignable to `SignedProbe` without it.
	if (probe.expectedClean) fail(`${probe.probeId} is a clean control`)
	if (probe.defectSignature === null) {
		fail(`${probe.probeId} carries no defect signature to match against`)
	}
	const signedProbe = probe as SignedProbe
	const witness = matchProbeWitness(
		signedProbe,
		contract.permittedInterfaces,
		record,
	)
	const findingMap = mapFindings([probe], contract.permittedInterfaces, record)
	const bucketOf = new Map<string, keyof FindingMap>()
	for (const bucket of FINDING_BUCKETS) {
		for (const entry of findingMap[bucket])
			bucketOf.set(entry.findingId, bucket)
	}

	// AD-40 pairs a probe with exactly one designated oracle: the one
	// discharging the behaviour its seeded defect breaks. The witness attaches
	// there and nowhere else.
	const seededBehaviorId =
		signedProbe.defects[0]?.behaviorId ?? fail('the probe seeds no defect')
	const seededBehavior =
		contract.behaviors.find((behavior) => behavior.id === seededBehaviorId) ??
		fail(`no behaviour ${seededBehaviorId}`)
	if (seededBehavior.oracles.length !== 1) {
		fail(
			`behaviour ${seededBehaviorId} is discharged by ${seededBehavior.oracles.length} oracles, so the signature designates none`,
		)
	}
	const designatedOracleId =
		seededBehavior.oracles[0] ??
		fail(`behaviour ${seededBehaviorId} declares no oracle`)

	const severityOfBehaviourFor = (oracleId: string) =>
		contract.behaviors.find((behavior) => behavior.oracles.includes(oracleId))
			?.severity ?? fail(`no behaviour declares oracle ${oracleId}`)

	const outcomes: Outcome[] = []
	const scored: ScoredOutcome[] = []
	for (const oracle of contract.oracles) {
		const check = oracle.check
		if (check === null) fail(`oracle ${oracle.id} carries no check`)
		const checkResolution: CheckResolutionValue = resolveCheck(
			check,
			resolveOperand,
			pointerDenotesCollection,
			POLICY.regexMatchStepBudget,
			`EvalContract.oracles[id=${oracle.id}].check`,
		)
		const steps = addressedSteps(check)
		// Walked once: `selections` is what the outcome reads and
		// `selectorAmbiguity` is a predicate over the same pairs.
		const addressed = contract.interactionPlan
			.filter((step) => steps.has(step.stepId))
			.map((step) => ({
				step,
				selection:
					selectionOf.get(step.stepId) ??
					fail(`step ${step.stepId} was never selected`),
			}))
		const selections = addressed.map((entry) => entry.selection)
		const selectorAmbiguity = addressed.some(
			(entry) =>
				entry.selection.result === 'several' &&
				entry.step.cardinality !== 'any',
		)
		const disposition =
			record.oracleDispositions.find((entry) => entry.oracleId === oracle.id) ??
			null
		const defectFinding = record.findings.find(
			(finding) =>
				finding.findingType === 'defect' && finding.oracleId === oracle.id,
		)
		const citedFinding =
			defectFinding === undefined
				? null
				: {
						findingId: defectFinding.findingId,
						bucket:
							bucketOf.get(defectFinding.findingId) ??
							fail(`finding ${defectFinding.findingId} landed in no bucket`),
					}
		const inputs: OutcomeInputs = {
			required: true,
			disposition,
			citedFinding,
			witness: oracle.id === designatedOracleId ? witness : null,
			selections,
			selectorAmbiguity,
			checkResolution: checkResolution.resolution,
			polarity: oracle.polarity,
			probeClass: probe.probeClass,
			expectedClean: probe.expectedClean,
			// Read off the probe rather than asserted, so the nine declared inputs
			// this chain names stay exactly nine: this one an artifact carries.
			probeSigned: signedProbe.defectSignature !== null,
			probeQualified: admitted.result.qualified,
			// The contract declares no waiver, no rubric, and the run recorded no
			// AD-26 evaluation fault. All three arrive declared, as `outcome.ts`
			// requires.
			waiver: 'none',
			judgeConduct: 'absent',
			evaluationFault: false,
		}
		const resolution = resolveOutcome(inputs)
		// A `resolvedFrom` naming a finding the record does not carry is an AD-32
		// cross-artifact dangling reference, and quietly substituting the
		// behaviour severity there could move the AD-21 floor comparison with no
		// signal, so it fails instead.
		const severity =
			resolution.resolvedFrom === null
				? severityOfBehaviourFor(oracle.id)
				: (record.findings.find(
						(finding) => finding.findingId === resolution.resolvedFrom,
					)?.severity ??
					fail(
						`oracle ${oracle.id} resolved from ${resolution.resolvedFrom}, which the record does not carry`,
					))
		outcomes.push({
			oracleId: oracle.id,
			probeId: probe.probeId,
			state: resolution.state,
			severity,
			disposition:
				disposition?.disposition ??
				fail(`oracle ${oracle.id} carries no disposition`),
			resolvedFrom: resolution.resolvedFrom,
			corroboration: resolution.corroboration,
			selectedObservationIds: [...resolution.selectedObservationIds],
			checkResolution,
		})
		scored.push({
			oracleId: oracle.id,
			required: true,
			severity,
			// `ladder.ts:42` defines this as the caller's own
			// `OutcomeInputs.checkResolution !== null`, so it is read off the
			// resolution rather than declared beside it.
			checkResolved: inputs.checkResolution !== null,
			resolution,
		})
	}

	// AD-7's reducer over the single-trial set, then the rate vector.
	const designated =
		scored.find((outcome) => outcome.oracleId === designatedOracleId) ??
		fail(`no outcome for the designated oracle ${designatedOracleId}`)
	// One vote per trial, and this chain carries one trial record. `completed`
	// is read off the same array, so a second trial cannot leave it at one and
	// understate both the strength denominator and the comparability test.
	const votes = [{ state: designated.resolution.state }]
	const reduced = reduceTrialSet(votes, POLICY.catchThreshold)
	const trials = {
		declaredMinimum: POLICY.minimumTrialCount,
		completed: votes.length,
		invalidatedAttempts: [...reduced.invalidatedAttempts],
	}

	const coverageGaps = evaluateCoverage(contract)
	const uncitedGaps: readonly UncitedFindingGap[] =
		uncitedDefectFindingGaps(record)
	const lineage = validateLineageChain([contract], {
		artifactPath: 'EvalContract',
		acceptedSchemaVersion: contract.schemaVersion,
		declaredRevisionCount: contract.revisionCount,
		remediationCap: POLICY.remediationCap,
	})

	const assessment: ContractAssessment = {
		mode: 'contract-scoring',
		outcomeState: {
			outcomes: scored,
			unwitnessedQuotations: auditQuotation(record),
			trials,
			reExecutionCap: POLICY.reExecutionCap,
		},
		evidenceIntegrity: {
			disclosure: record.evidenceDisclosure,
			// Declared, not derived: the first two have no source in any artifact
			// the chain carries, the third is AD-32's cross-artifact check, and the
			// fourth is AD-16's isolation manifest, which the spike never produced
			// a violation for.
			overTruncated: false,
			unavailable: false,
			internallyInconsistent: false,
			isolationViolation: [],
			// This chain hand-assembles the record directly and never calls
			// `core/ingest`, so none of Story 8.2's eight ingest-condition
			// fields, nor its two score-computed ones, has anything to carry;
			// every one is the empty array its own type already permits.
			duplicateRecordIdentifiers: [],
			danglingCitations: [],
			danglingDispositionCitations: [],
			forbiddenInputsNotWithheld: [],
			crossArtifactDisagreements: [],
			evaluatorConfigurationAbsent: [],
			evaluatorConfigurationDigestMismatches: [],
			judgeResultsUnscored: [],
			operationIdentifierCollisions: [],
			trialSetDisagreements: [],
		},
		evaluatorRecommendation: record.evaluatorRecommendation,
		coverageGaps,
		uncitedDefectFindings: uncitedGaps,
		findings: record.findings.map((finding) => ({
			findingId: finding.findingId,
			confidence: finding.confidence,
		})),
		confidenceThreshold: POLICY.confidenceThreshold,
		remediationState: lineage.checks,
		// Declared: pre-flight is a separate stage the spike never ran, and a
		// `false` here would invalidate the run over a stage it never reached.
		preflightPassed: true,
		severityFloor: POLICY.severityFloor,
		systemRecommendationRecorded: record.evaluatorRecommendation,
		systemRecommendationNote: SYSTEM_RECOMMENDATION_NOTE,
	}
	const ladder = resolveContractVerdict(assessment)
	if (ladder.verdict === null) {
		fail(
			`the chain resolved AD-21's Invalid rung and carries no contract verdict: ${ladder.basis.join('; ')}`,
		)
	}

	// `emit` now builds scoringVersionInputs, comparabilityKey, strength, and
	// the mode-discriminated artifact literal this hand-assembly used to build
	// directly. The two placeholder digests are the same AD-11 caller-attested
	// pair this chain always supplied: no artifact here carries a corpus or
	// fixture digest, so both stay caller-supplied rather than derived.
	const scoredOutcomesAndVerdict: ScoredOutcomesAndVerdict = {
		assessment,
		ladder,
		runId: record.runId,
		contract,
		policy: POLICY,
		probe,
		sealedProbes,
		trialSetResult: reduced,
		outcomes,
		uncitedFindings: [...uncitedFindingIds(record)],
	}
	const artifact = emit(
		scoredOutcomesAndVerdict,
		digestPlaceholder(14),
		digestPlaceholder(15),
		record.evaluatorConfigurationDigest,
	)

	return {
		contract,
		brief,
		probe: signedProbe,
		record,
		artifact: EvidenceArtifact.parse(artifact),
		witness,
		selectionOf,
	}
}

/**
 * The five generated files, as repository-relative path to text. The three
 * hand-authored prose files in the same directory are not the builder's and
 * appear in no key here.
 */
export function buildWorkedExample(): Map<string, string> {
	const chain = buildWorkedExampleChain()
	const files = new Map<string, string>()
	files.set(
		keyOf('eval-contract.json'),
		renderJson(chain.contract, 'EvalContract'),
	)
	files.set(
		keyOf('brief.json'),
		renderJson(chain.brief, 'SealedEvaluatorBrief'),
	)
	files.set(keyOf('probe.json'), renderJson(chain.probe, 'Probe'))
	files.set(
		keyOf('sealed-run-record.json'),
		renderJson(chain.record, 'SealedRunRecord'),
	)
	files.set(
		keyOf('evidence-artifact.json'),
		renderJson(chain.artifact, 'EvidenceArtifact'),
	)
	// `WORKED_EXAMPLE_FILES` is the authoritative list, so it is checked rather
	// than documented. The drift check iterates this map alone, so a dropped
	// `files.set` would leave its file committed, unowned and permanently
	// stale while the check reported the remaining four matching byte for byte
	// and exited 0. An orphan sweep would also catch that and is forbidden
	// here, because the same directory holds three hand-authored prose files
	// the builder never emits.
	const declared = WORKED_EXAMPLE_FILES.map(keyOf)
	const missing = declared.filter((path) => !files.has(path))
	const unlisted = [...files.keys()].filter((path) => !declared.includes(path))
	if (missing.length > 0 || unlisted.length > 0) {
		fail(
			`the builder's own key set disagrees with WORKED_EXAMPLE_FILES: ${
				missing.length > 0
					? `declared but not emitted: ${missing.join(', ')}. `
					: ''
			}${unlisted.length > 0 ? `emitted but not declared: ${unlisted.join(', ')}.` : ''}`.trim(),
		)
	}
	return files
}
