// One accept fixture per interchange artifact, typed against its own schema
// so a re-spelling fails the typecheck before it reaches a test, plus one
// positive fixture per branch of every discriminated union. Branch coverage
// isn't measured by tooling (no `@vitest/coverage-v8`), so the fixture
// enumeration is asserted complete instead.

import type { ArtifactReference } from '../../../src/core/schemas/artifact-reference.ts'
import type { EvaluatorConfiguration } from '../../../src/core/schemas/evaluator-configuration.ts'
import type { EvidenceArtifact } from '../../../src/core/schemas/evidence-artifact.ts'
import type { IsolationManifest } from '../../../src/core/schemas/isolation-manifest.ts'
import type { PreflightVerdict } from '../../../src/core/schemas/preflight-verdict.ts'
import type { PrivateArtifactManifest } from '../../../src/core/schemas/private-artifact-manifest.ts'
import type { Probe } from '../../../src/core/schemas/probe.ts'
import type { Rubric } from '../../../src/core/schemas/rubric.ts'
import type { ScoringPolicy } from '../../../src/core/schemas/scoring-policy.ts'
import type { SealedEvaluatorBrief } from '../../../src/core/schemas/sealed-evaluator-brief.ts'
import type { SealedRunRecord } from '../../../src/core/schemas/sealed-run-record.ts'
import { populatedContract } from './relevance-contracts.ts'

/** AD-27's rendered form: "sha256:" plus 64 lowercase hexadecimal characters. */
export const digestOf = (ordinal: number): string =>
	`sha256:${ordinal.toString(16).padStart(64, '0')}`

const CONTRACT_DIGEST = digestOf(2)
const BRIEF_DIGEST = digestOf(3)
const EVALUATOR_CONFIGURATION_DIGEST = digestOf(4)
const ACTIONS_DIGEST = digestOf(5)
const MANIFEST_DIGEST = digestOf(6)

export const publicArtifactReference: ArtifactReference = {
	storage: 'public',
	path: 'evidence/actions-0001.jsonl',
	privateRef: null,
	digest: ACTIONS_DIGEST,
}

export const privateArtifactReference: ArtifactReference = {
	storage: 'private',
	path: null,
	privateRef: 'opaque:spike-actions-0001',
	digest: ACTIONS_DIGEST,
}

const isolationManifestReference: ArtifactReference = {
	storage: 'private',
	path: null,
	privateRef: 'opaque:spike-manifest-0001',
	digest: MANIFEST_DIGEST,
}

export const privateArtifactManifestFixture: PrivateArtifactManifest = {
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	entries: [
		{
			privateRef: 'opaque:spike-actions-0001',
			digest: ACTIONS_DIGEST,
			artifactKind: 'raw-trace',
			publicSafeRunId: 'spike-run-0001',
			sanitizationPolicy: 'header-redaction-v1',
		},
		{
			privateRef: 'opaque:spike-labels-0001',
			digest: digestOf(7),
			artifactKind: 'human-label',
			// Both nullable members exercised here: `null` spells "belongs to no
			// single run" and "no sanitization applied"; neither is reachable by
			// omitting the key.
			publicSafeRunId: null,
			sanitizationPolicy: null,
		},
	],
}

const defectFinding: SealedRunRecord['findings'][number] = {
	findingType: 'defect',
	findingId: 'F-001',
	oracleId: 'O-001',
	probeId: 'P-001',
	behaviorId: 'B-001',
	severity: 'critical',
	summary:
		'The update response reported success and a subsequent read returned the original title.',
	confidence: 0.95,
	observationIds: ['obs-003', 'obs-004'],
	evidenceArtifacts: [privateArtifactReference],
	quotedEvidence: [
		{
			quote: '{"ok":true,"note":{"title":"Revised"}}',
			channel: 'response-body',
		},
		{ quote: '200', channel: 'response-status' },
	],
}

const confirmationFinding: SealedRunRecord['findings'][number] = {
	findingType: 'confirmation',
	findingId: 'F-002',
	oracleId: 'O-002',
	probeId: 'P-001',
	behaviorId: 'B-002',
	severity: 'material',
	summary: 'Status 200 agreed with ok true on every successful call observed.',
	confidence: 0.99,
	observationIds: ['obs-001', 'obs-003'],
	evidenceArtifacts: [],
}

// The uncited case AD-23 preserves: no oracle, no behaviour, and a probe, which
// is required on every branch.
const observationFinding: SealedRunRecord['findings'][number] = {
	findingType: 'observation',
	findingId: 'F-003',
	oracleId: null,
	probeId: 'P-001',
	behaviorId: null,
	severity: 'low',
	summary:
		'PATCH accepts an unknown field and echoes it back. No oracle addresses unknown-field handling.',
	confidence: 0.8,
	observationIds: ['obs-005'],
	evidenceArtifacts: [],
}

export const FINDING_BRANCH_FIXTURES = [
	{ id: 'finding-defect', value: defectFinding },
	{ id: 'finding-confirmation', value: confirmationFinding },
	{ id: 'finding-observation', value: observationFinding },
] as const

const emptyCallInputs: SealedRunRecord['observations'][number]['callInputs'] = {
	path: null,
	query: null,
	header: null,
	body: null,
}

export const sealedRunRecordFixture: SealedRunRecord = {
	// Version 3: `mode` (version 2) and now `sequence` (version 3) are both
	// required, so neither a version-1 nor a version-2 record parses. This
	// fixture is the only place a Sealed Run Record version number is written
	// down, which is what makes each bump visible.
	schemaVersion: 3,
	parentDigest: null,
	revisionCount: 0,
	runId: 'spike-run-0001',
	conditionArm: 'independent',
	// `contract-scoring`, not `production`: the record already recommends FAIL
	// against a knowingly defective probe, and AD-21 makes that an input in this
	// mode rather than a signal. The evidence fixture it pairs with is the
	// contract-scoring branch.
	mode: 'contract-scoring',
	trialIndex: 1,
	contractDigest: CONTRACT_DIGEST,
	sealedBriefDigest: BRIEF_DIGEST,
	evaluatorConfigurationDigest: EVALUATOR_CONFIGURATION_DIGEST,
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
			observationIds: ['obs-001'],
			note: null,
		},
		{
			// AD-33: an unsupported disposition stays representable so the scorer
			// can invalidate it; the identifier list is therefore required but may
			// be empty.
			oracleId: 'O-003',
			disposition: 'not-attempted',
			observationIds: [],
			note: null,
		},
	],
	findings: [defectFinding, confirmationFinding, observationFinding],
	observations: [
		{
			observationId: 'obs-001',
			sequence: 1,
			operationId: 'get-note',
			provenance: 'baseline',
			callInputs: { ...emptyCallInputs, path: { id: 'n-1' } },
			responseBody: {
				ok: true,
				note: { id: 'n-1', title: 'Original' },
			},
			responseHeaders: { 'content-type': 'application/json' },
			responseStatus: 200,
			stdout: null,
			stderr: null,
			exitCode: null,
		},
		{
			observationId: 'obs-003',
			sequence: 2,
			operationId: 'patch-note',
			provenance: 'evaluator-chosen',
			callInputs: {
				...emptyCallInputs,
				path: { id: 'n-1' },
				body: { title: 'Revised' },
			},
			responseBody: { ok: true, note: { id: 'n-1', title: 'Revised' } },
			responseHeaders: null,
			responseStatus: 200,
			stdout: null,
			stderr: null,
			exitCode: null,
		},
		{
			observationId: 'obs-004',
			sequence: 3,
			operationId: 'get-note',
			provenance: 'evaluator-chosen',
			callInputs: { ...emptyCallInputs, path: { id: 'n-1' } },
			responseBody: { ok: true, note: { id: 'n-1', title: 'Original' } },
			responseHeaders: null,
			responseStatus: 200,
			stdout: null,
			stderr: null,
			exitCode: null,
		},
		{
			// The three process channels, so every one of AD-26's seven has a
			// populated instance somewhere in the corpus.
			observationId: 'obs-005',
			sequence: 4,
			operationId: 'run-migration',
			provenance: 'evaluator-chosen',
			callInputs: { ...emptyCallInputs, query: { dryRun: true } },
			responseBody: null,
			responseHeaders: null,
			responseStatus: null,
			stdout: 'migrated 0 rows\n',
			stderr: '',
			exitCode: 0,
		},
	],
	judgeResults: [
		{ rubricId: 'R-001', criterionId: 'RC-001', score: 3, note: null },
		{
			// `null` is the shape AD-6's `judge-error` fires on, so it must parse.
			rubricId: 'R-001',
			criterionId: 'RC-002',
			score: null,
			note: 'The judge response was unparseable.',
		},
	],
	actionsArtifact: privateArtifactReference,
	isolationManifestArtifact: isolationManifestReference,
	resourceUse: {
		toolCalls: 5,
		inputTokens: 8100,
		outputTokens: 1400,
		wallClockSeconds: 62.5,
		costUsd: '0.04',
	},
	evidenceDisclosure: { truncationBound: 4096, reportedIncomplete: false },
	invalidReason: null,
}

const withheld = { withheld: true, note: null }

export const isolationManifestFixture: IsolationManifest = {
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	runId: 'spike-run-0001',
	contractId: 'notes-api',
	conditionArm: 'independent',
	modelSnapshot: 'model-snapshot-2026-07-29',
	systemPromptDigest: digestOf(8),
	contractDigest: CONTRACT_DIGEST,
	evaluatorConfigurationDigest: EVALUATOR_CONFIGURATION_DIGEST,
	workspaceIdentity: 'workspace-0001',
	allowedMounts: ['/workspace'],
	observedMounts: ['/workspace'],
	networkAllowlist: ['fixture-host'],
	observedNetworkTargets: ['fixture-host'],
	toolAllowlist: ['http'],
	observedToolCalls: ['http'],
	resourceCeilings: {
		maxToolCalls: 50,
		maxInputTokens: 200000,
		maxOutputTokens: 50000,
		maxWallClockMinutes: 30,
		maxCostUsd: '5.00',
	},
	actualResourceUse: {
		toolCalls: 5,
		inputTokens: 8100,
		outputTokens: 1400,
		wallClockSeconds: 62.5,
		costUsd: '0.04',
	},
	forbiddenInputAccounting: {
		'original-spec': withheld,
		'source-code': withheld,
		repository: withheld,
		'builder-transcript': withheld,
		'implementation-logs': withheld,
		'comparator-results': withheld,
		// AD-16 treats a prohibited input as an invalidating condition caught at
		// ingest; the schema itself still has to parse `withheld: false`.
		'human-labels': {
			withheld: false,
			note: 'A label file was mounted read-only and is disclosed here.',
		},
	},
	violation: null,
}

export const evaluatorConfigurationFixture: EvaluatorConfiguration = {
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	sealedBriefDigest: BRIEF_DIGEST,
	evaluatorIdentity: 'opaque:evaluator-0001',
	modelSnapshot: 'model-snapshot-2026-07-29',
	systemPromptDigest: digestOf(9),
	decodingParameters: { temperature: 0, topP: 1 },
	toolInventory: ['http'],
	permissionInventory: ['network:fixture-host'],
	budgets: {
		maxToolCalls: 50,
		maxWallClockMinutes: 30,
		maxCostUsd: '5.00',
	},
	seed: 20260729,
	judgeConfiguration: {
		modelSnapshot: 'judge-snapshot-2026-07-29',
		systemPromptDigest: digestOf(10),
	},
}

export const seededDefect: Extract<
	Probe,
	{ expectedClean: false }
>['defects'][number] = {
	defectId: 'D-001',
	behaviorId: 'B-001',
	summary: 'The update handler acknowledges without persisting.',
	severity: 'critical',
	oracleEvidence: [publicArtifactReference],
	source: 'controlled-mutation',
	manifestationWitness: {
		legId: 'patch-note-fault',
		interfaceId: 'notes-api',
		operationId: 'patch-note',
		inputs: {
			path: { noteId: 'n-1' },
			query: {},
			header: {},
			body: { kind: 'json', value: { title: 'updated' } },
		},
		relation: {
			op: 'not',
			operands: [
				{
					op: 'equality',
					operands: [
						{ pointer: '/interactions/patch-note-fault/response-body/title' },
						{ literal: 'updated' },
					],
				},
			],
		},
	},
}

/**
 * AD-40's signature for the lost-update defect above: the update acknowledges
 * with 200 and the echoed title is not the one that was sent. Every pointer
 * roots at the reserved `observed` identifier, and the predicate names three
 * channels, one of them the declared observable channel.
 */
const lostUpdateSignature: Extract<
	Probe,
	{ expectedClean: false }
>['defectSignature'] = {
	interfaceKind: 'api',
	method: 'PATCH',
	pathTemplate: '/notes/{id}',
	observableChannel: 'response-body',
	condition: {
		selector: {
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { title: { matcher: 'any' } },
			},
		},
		predicate: {
			op: 'all',
			operands: [
				{
					op: 'equality',
					operands: [
						{ pointer: '/interactions/observed/response-status' },
						{ literal: 200 },
					],
				},
				{
					op: 'not',
					operands: [
						{
							op: 'equality',
							operands: [
								{ pointer: '/interactions/observed/response-body/note/title' },
								{ pointer: '/interactions/observed/call-inputs/body/title' },
							],
						},
					],
				},
			],
		},
	},
}

export const seededProbe: Probe = {
	// Version 2: AD-9's qualification record and AD-40's defect signature both
	// landed as required fields, so no version-1 probe parses.
	schemaVersion: 2,
	parentDigest: null,
	revisionCount: 0,
	probeId: 'P-001',
	probeClass: 'defect',
	expectedClean: false,
	behaviorId: 'B-001',
	systemId: 'notes-api',
	implementationDigest: digestOf(11),
	artifactDigest: digestOf(12),
	commitDigest: digestOf(13),
	rationale: 'A controlled mutation seeding a lost-update defect.',
	qualification: {
		route: 'controlled-mutation',
		mutationSource: 'hand-authored mutation of the update handler',
		mutationOperator: 'statement-deletion',
		targetArtifact: publicArtifactReference,
		expectedObservableFailure:
			'the update acknowledges with 200 and the stored title is unchanged',
		baselinePassEvidence: publicArtifactReference,
		mutatedFailEvidence: privateArtifactReference,
		rollbackVerified: true,
	},
	defects: [seededDefect],
	defectSignature: lostUpdateSignature,
}

export const cleanControlProbe: Probe = {
	schemaVersion: 2,
	parentDigest: null,
	revisionCount: 0,
	probeId: 'P-002',
	// probeClass is `zero-action` here: `defect` paired with
	// `expectedClean: true` is a contradiction the scorer reads off the pair,
	// which belongs among the unenforced-in-v0 admissions.
	probeClass: 'zero-action',
	expectedClean: true,
	behaviorId: 'B-001',
	systemId: 'notes-api',
	implementationDigest: digestOf(14),
	artifactDigest: digestOf(15),
	commitDigest: digestOf(16),
	rationale: 'The unmutated implementation, carried as a known-clean control.',
	qualification: {
		route: 'clean-control',
		baselinePassEvidence: publicArtifactReference,
		revisionCommitDigest: digestOf(16),
		noKnownDefectStatement:
			'The notes interface carried no known defect at this revision.',
	},
	defects: [],
}

// A canary indicts the fixture without seeding a defect, which is why the
// `expectedClean: false` branch carries no minimum on `defects`, and why it is
// the one class AD-40 exempts from carrying a signature.
export const canaryProbe: Probe = {
	...seededProbe,
	probeId: 'P-003',
	probeClass: 'canary',
	rationale: 'A canary: no seeded defect, and never in the strength vector.',
	qualification: {
		route: 'canary',
		indicts: 'fixture',
		nonDetectionEvidence: publicArtifactReference,
	},
	defects: [],
	defectSignature: null,
}

export const gameabilityProbe: Probe = {
	...seededProbe,
	probeId: 'P-004',
	probeClass: 'gameability',
	rationale:
		'A probe whose defect is reachable by an evaluator that games the contract rather than exercising it.',
	qualification: {
		route: 'gameability',
		degenerateResponse:
			'a 200 carrying an empty note object, which a presence-only oracle accepts',
		naiveOracleSatisfiedEvidence: publicArtifactReference,
		disciplinedOracleRejectedEvidence: privateArtifactReference,
	},
	defectSignature: {
		interfaceKind: 'api',
		method: 'POST',
		pathTemplate: '/notes',
		observableChannel: 'response-body',
		condition: {
			selector: {
				inputBinding: {
					path: null,
					query: null,
					header: null,
					body: { title: { matcher: 'any' } },
				},
			},
			predicate: {
				op: 'all',
				operands: [
					{
						op: 'equality',
						operands: [
							{ pointer: '/interactions/observed/response-status' },
							{ literal: 200 },
						],
					},
					{
						op: 'absence',
						operands: [
							{ pointer: '/interactions/observed/response-body/note/id' },
						],
					},
				],
			},
		},
	},
}

/**
 * The fifth probe, carrying the one route no other fixture takes: a defect
 * mined from a real fix boundary rather than introduced. It is the only fixture
 * anywhere that sets `Defect.source` to `natural`, which is what the route
 * depends on.
 *
 * Deliberately NOT in `PROBE_CLASS_FIXTURES`: that list is asserted to hold
 * exactly one entry per probe class, so a fifth entry there fails on the class
 * census rather than on anything this fixture is for.
 */
export const historicalProbe: Probe = {
	...seededProbe,
	probeId: 'P-005',
	rationale: 'A defect mined from a real fix commit and reverted in place.',
	qualification: {
		route: 'historical',
		failBeforeEvidence: publicArtifactReference,
		passAfterEvidence: privateArtifactReference,
		fixCommitDigest: digestOf(18),
		oracleStableAcrossRevisions: true,
	},
	defects: [
		{
			...seededDefect,
			defectId: 'D-002',
			summary: 'The read handler returns 500 on a note that was deleted.',
			source: 'natural',
		},
	],
	defectSignature: {
		interfaceKind: 'api',
		method: 'GET',
		pathTemplate: '/notes/{id}',
		observableChannel: 'response-status',
		condition: {
			selector: {
				inputBinding: {
					path: { id: { matcher: 'any' } },
					query: null,
					header: null,
					body: null,
				},
			},
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
					{
						op: 'existence',
						operands: [
							{ pointer: '/interactions/observed/response-body/error' },
						],
					},
				],
			},
		},
	},
}

export const preflightVerdictFixture: PreflightVerdict = {
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	runId: 'spike-run-0001',
	fixtureDigest: digestOf(17),
	passed: true,
	checks: [
		{
			kind: 'interface-present',
			operationId: null,
			outcome: 'satisfied',
			note: null,
		},
		{
			kind: 'input-sensitivity',
			operationId: 'patch-note',
			outcome: 'satisfied',
			note: null,
		},
		{
			kind: 'input-sensitivity',
			operationId: 'list-notes',
			outcome: 'exempt',
			note: 'The operation declares no inputs in any channel.',
		},
		{
			kind: 'state-reset',
			operationId: 'patch-note',
			outcome: 'satisfied',
			note: null,
		},
		{
			kind: 'clean-control',
			operationId: null,
			outcome: 'satisfied',
			note: null,
		},
		{
			kind: 'seeded-faults-scoped',
			operationId: null,
			outcome: 'satisfied',
			note: null,
		},
		{
			kind: 'seeded-fault-fired',
			operationId: 'patch-note',
			outcome: 'satisfied',
			note: null,
		},
	],
}

/**
 * The state the artifact exists to report. AD-10: a failed pre-flight
 * invalidates the run instead of becoming a contract verdict, so the failing
 * shape must parse as readily as the passing one.
 */
export const failingPreflightVerdict: PreflightVerdict = {
	...preflightVerdictFixture,
	passed: false,
	checks: [
		{
			kind: 'seeded-fault-fired',
			operationId: 'patch-note',
			outcome: 'failed',
			note: 'A declared seeded fault was never observed to fire, so the probe is vacuous.',
		},
		{
			kind: 'input-sensitivity',
			operationId: 'get-note',
			outcome: 'failed',
			note: 'The witness relation resolved insufficient-evidence, which fails rather than passes.',
		},
	],
}

export const scoringPolicyFixture: ScoringPolicy = {
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	policyId: 'default-policy',
	severityFloor: 'material',
	confidenceThreshold: 0.7,
	minimumTrialCount: 3,
	reExecutionCap: 2,
	remediationCap: 3,
	regexMatchStepBudget: 1000000,
}

const evidenceCommon = {
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	runId: 'spike-run-0001',
	scoringVersion: digestOf(18),
	scoringVersionInputs: {
		contractSchemaVersion: 1,
		corpusDigest: digestOf(19),
		fixtureDigest: digestOf(17),
		evaluatorConfigurationDigest: EVALUATOR_CONFIGURATION_DIGEST,
		scoringPolicyDigest: digestOf(20),
	},
	comparabilityKey: digestOf(21),
	excludedProbeIds: [] as string[],
	verdictBasis: [
		'contract caught the seeded critical defect on its only defect probe',
		'one unsatisfied coverage gap at material severity: sibling-cross-check',
	],
	callerAttestedInputs: [
		'corpusDigest',
		'fixtureDigest',
		'evaluatorConfigurationDigest',
	],
	trials: {
		declaredMinimum: 3,
		completed: 3,
		invalidatedAttempts: [{ attempt: 2, reason: 'port fault during probing' }],
	},
	outcomes: [
		{
			oracleId: 'O-001',
			probeId: 'P-001',
			state: 'caught',
			severity: 'critical',
			disposition: 'violated',
			resolvedFrom: 'F-001',
			corroboration: 'agrees',
			selectedObservationIds: ['obs-003', 'obs-004'],
			checkResolution: {
				resolution: 'false',
				introductionCondition: null,
				children: [
					{ resolution: 'true', introductionCondition: null, children: [] },
					{
						resolution: 'insufficient-evidence',
						introductionCondition: 'empty-collection',
						children: [],
					},
				],
			},
		},
		{
			// The `not-evaluable` corroboration case: the expression never ran, which
			// AD-33 keeps distinct from AD-4's `insufficient-evidence`.
			oracleId: 'O-003',
			probeId: null,
			state: 'unreached',
			severity: 'material',
			disposition: 'not-attempted',
			resolvedFrom: null,
			corroboration: 'not-evaluable',
			selectedObservationIds: [],
			checkResolution: null,
		},
	],
	uncitedFindings: ['F-003'],
	coverageGaps: [
		{
			rule: 'sibling-cross-check',
			relevancePredicate: 'sibling-cross-check-relevance',
			satisfactionPredicate: 'sibling-cross-check-satisfaction',
			satisfied: false,
			severity: 'material',
		},
	],
	strength: {
		denominator:
			'unique qualified probe identifiers exercised per class, across 3 completed trials',
		basis: 'measured',
		vector: {
			defect: { caught: 1, exercised: 1, rate: 1 },
			// A class with no exercised probe is an explicit `null`, never an entry
			// with a zero denominator wearing a rate of zero.
			gameability: null,
			'zero-action': { caught: 0, exercised: 0, rate: null },
		},
		comparable: true,
		note: null,
	},
	remediation: {
		revisionCount: 0,
		cap: 3,
		capSource: 'caller-attested',
		lineageChain: {
			lengthConsistent: true,
			noRepeatedDigest: true,
			noGap: true,
		},
	},
} satisfies Omit<
	Extract<EvidenceArtifact, { mode: 'production' }>,
	'mode' | 'productionVerdict' | 'exitCode'
>

// AD-21 fixes the exit code per verdict (PASS/WAIVED/CONCERNS exit zero, FAIL
// exits two), so `exitCode` can't sit in the shared block. The cross-field
// agreement itself is unenforced-in-v0.
export const productionEvidenceArtifact: EvidenceArtifact = {
	...evidenceCommon,
	exitCode: 2,
	mode: 'production',
	productionVerdict: 'FAIL',
}

export const contractScoringEvidenceArtifact: EvidenceArtifact = {
	...evidenceCommon,
	exitCode: 0,
	mode: 'contract-scoring',
	contractVerdict: 'CONCERNS',
	systemRecommendationRecorded: 'FAIL',
	systemRecommendationNote:
		'Expected in contract-scoring mode: the probe is knowingly defective, so a system-directed FAIL is an input rather than a signal about the contract.',
}

export const sealedEvaluatorBriefFixture: SealedEvaluatorBrief = {
	schemaVersion: 2,
	parentDigest: null,
	revisionCount: 0,
	contractDigest: CONTRACT_DIGEST,
	behaviors: [
		{
			id: 'B-001',
			description: 'An update that reports success has persisted.',
			severity: 'critical',
			observableSuccessCriterion:
				'A read after a successful update returns the updated value.',
			requirementLinks: [{ scheme: 'jira', id: 'NOTES-1' }],
			riskLinks: [],
			oracles: ['O-001'],
		},
	],
	directions: [
		{
			oracleId: 'O-001',
			text: 'Establish whether the value you obtained after a successful update reflects what you sent.',
		},
	],
	permittedInterfaces: [{ logicalId: 'notes-api', kind: 'api' }],
	scopedResources: [{ reference: 'published-openapi', kind: 'document' }],
	principals: ['owner'],
	budgets: { maxToolCalls: 50, maxWallClockMinutes: 30, maxCostUsd: '5.00' },
	safetyLimits: ['no destructive operations outside the workspace'],
	probeStepBound: 8,
}

export const rubricFixture: Rubric = {
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	id: 'R-001',
	scaleLevels: [
		{ level: 1, anchor: 'The response omits the updated value.' },
		{ level: 3, anchor: 'The response carries the updated value.' },
	],
	failureModePenalties: [
		{
			name: 'unsupported-claim',
			description: 'The answer asserts a value no observation carries.',
		},
	],
	maxLength: 400,
	criteria: [
		{
			id: 'RC-001',
			text: 'Does the read-back response carry the value that was sent?',
			evidence: '/interactions/read-back/response-body/note/title',
		},
		{
			id: 'RC-002',
			text: 'Does the update response report success?',
			evidence: '/interactions/write/response-body/ok',
		},
	],
}

/**
 * The accept corpus, keyed by registry key. A test asserts this key set equals
 * `INTERCHANGE_ARTIFACT_KEYS`, so a thirteenth artifact cannot ship without a
 * fixture and a committed fixture no test exercises cannot go silently dead.
 */
export const ARTIFACT_ACCEPT_FIXTURES = {
	'eval-contract': populatedContract,
	rubric: rubricFixture,
	'sealed-evaluator-brief': sealedEvaluatorBriefFixture,
	'sealed-run-record': sealedRunRecordFixture,
	'isolation-manifest': isolationManifestFixture,
	'evaluator-configuration': evaluatorConfigurationFixture,
	probe: seededProbe,
	'artifact-reference': publicArtifactReference,
	'private-artifact-manifest': privateArtifactManifestFixture,
	'preflight-verdict': preflightVerdictFixture,
	'scoring-policy': scoringPolicyFixture,
	'evidence-artifact': productionEvidenceArtifact,
} as const

/**
 * One positive fixture per branch of every discriminated union this story
 * declares: `ArtifactReference`'s two, the finding's three, `Probe`'s two, and
 * `EvidenceArtifact`'s two. A test asserts each parses under its own artifact's
 * schema and that the count matches the branch count read off the schemas.
 */
/**
 * Probe-class coverage, enumerated so no class value ships unparsed. AD-9
 * closes the set at four; AD-7 excludes `canary` and the clean control from
 * the strength vector.
 */
export const PROBE_CLASS_FIXTURES = [
	{ id: 'probe-class/defect', probeClass: 'defect', value: seededProbe },
	{
		id: 'probe-class/zero-action',
		probeClass: 'zero-action',
		value: cleanControlProbe,
	},
	{ id: 'probe-class/canary', probeClass: 'canary', value: canaryProbe },
	{
		id: 'probe-class/gameability',
		probeClass: 'gameability',
		value: gameabilityProbe,
	},
] as const

/**
 * Qualification-route coverage, one fixture per AD-9 route, so no route ships
 * unparsed and the keyword-mutation sweep has a seed for every branch of the
 * union. A separate list from `PROBE_CLASS_FIXTURES` because that one is
 * asserted to equal the closed class set exactly, and four classes carry five
 * routes.
 */
export const QUALIFICATION_ROUTE_FIXTURES = [
	{ id: 'probe-route/historical', route: 'historical', value: historicalProbe },
	{
		id: 'probe-route/controlled-mutation',
		route: 'controlled-mutation',
		value: seededProbe,
	},
	{
		id: 'probe-route/gameability',
		route: 'gameability',
		value: gameabilityProbe,
	},
	{ id: 'probe-route/canary', route: 'canary', value: canaryProbe },
	{
		id: 'probe-route/clean-control',
		route: 'clean-control',
		value: cleanControlProbe,
	},
] as const

export const UNION_BRANCH_FIXTURES = [
	{
		id: 'artifact-reference/public',
		artifact: 'artifact-reference',
		discriminator: 'storage',
		value: publicArtifactReference as unknown,
	},
	{
		id: 'artifact-reference/private',
		artifact: 'artifact-reference',
		discriminator: 'storage',
		value: privateArtifactReference as unknown,
	},
	{
		id: 'probe/seeded',
		artifact: 'probe',
		discriminator: 'expectedClean',
		value: seededProbe as unknown,
	},
	{
		id: 'probe/clean-control',
		artifact: 'probe',
		discriminator: 'expectedClean',
		value: cleanControlProbe as unknown,
	},
	{
		id: 'evidence-artifact/production',
		artifact: 'evidence-artifact',
		discriminator: 'mode',
		value: productionEvidenceArtifact as unknown,
	},
	{
		id: 'evidence-artifact/contract-scoring',
		artifact: 'evidence-artifact',
		discriminator: 'mode',
		value: contractScoringEvidenceArtifact as unknown,
	},
] as const
