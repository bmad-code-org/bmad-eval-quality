// The spike worked example, re-checked and NOT repaired (ADR-006: the
// architecture's only end-to-end evidence). Its two sealed artifacts are
// transcribed here verbatim; what they fail, and why, IS the record, so
// repairing the artifact would delete the evidence that the shapes and the
// worked chain disagree.
//
// Transcribed in-memory rather than read from disk (AD-30: `core/` uses only
// in-memory fixtures, no filesystem I/O at runtime). Pure ASCII, as the
// sources are.
//
// Source: _bmad-output/planning-artifacts/architecture/
//         architecture-eval-quality-2026-07-29/spike-worked-example/
//
// These two are the named exception to the reject corpus's one-issue rule: a
// document that fails many ways at once asserts its full expected issue list
// instead, so a shape change anywhere shows up as a changed list rather than a
// still-green "did not parse".

export type WorkedExampleIssue = {
	readonly path: readonly (string | number)[]
	readonly code: string
}

/** `sealed-run-record.json`, verbatim. */
export const workedExampleSealedRunRecord: unknown = {
	schemaVersion: 1,
	runId: 'spike-run-0001',
	contractDigest:
		'sha256:0000000000000000000000000000000000000000000000000000000000000002',
	sealedBriefDigest:
		'sha256:0000000000000000000000000000000000000000000000000000000000000003',
	evaluatorConfigurationDigest:
		'sha256:0000000000000000000000000000000000000000000000000000000000000004',
	conditionArm: 'independent',
	trialIndex: 1,
	evaluatorRecommendation: 'FAIL',
	oracleDispositions: [
		{
			oracleId: 'O-001',
			disposition: 'violated',
			note: 'Update reported success; the independent read returned the old title.',
		},
		{
			oracleId: 'O-002',
			disposition: 'held',
			note: 'Status and ok agreed on every successful call.',
		},
		{
			oracleId: 'O-003',
			disposition: 'held',
			note: 'The update response carried all five fields and no diagnostic alongside the success flag.',
		},
		{
			oracleId: 'O-004',
			disposition: 'held',
			note: 'Every note in the collection carried all five fields.',
		},
		{
			oracleId: 'O-005',
			disposition: 'held',
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
			provenance: 'evaluator-chosen',
			summary:
				"PATCH /notes/n-1 returned 200 with ok true and the new title 'Revised', but a subsequent GET /notes/n-1 returned the original title 'Original'. The update response was not backed by a write.",
			observationIds: ['obs-003', 'obs-004'],
			evidenceArtifacts: [
				{
					kind: 'action-log',
					reference: 'opaque:spike-actions-0001',
					digest:
						'sha256:0000000000000000000000000000000000000000000000000000000000000005',
					visibility: 'private',
				},
			],
		},
		{
			findingId: 'F-002',
			findingType: 'confirmation',
			oracleId: 'O-002',
			probeId: 'P-001',
			behaviorId: 'B-002',
			severity: 'material',
			confidence: 0.99,
			provenance: 'baseline',
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
			provenance: 'evaluator-chosen',
			summary:
				"PATCH accepts an unknown field 'colour' and echoes it back in the note payload. No oracle in the contract addresses unknown-field handling, so this is filed uncited.",
			observationIds: ['obs-005'],
			evidenceArtifacts: [],
		},
	],
	observations: [
		{
			observationId: 'obs-001',
			operationId: 'get-note',
			provenance: 'baseline',
			callInputs: {
				id: 'n-1',
			},
			responseStatus: 200,
			responseBody: {
				ok: true,
				note: {
					id: 'n-1',
					title: 'Original',
					body: 'b',
					tags: ['t'],
					updatedAt: '2026-07-29T10:00:00Z',
				},
			},
		},
		{
			observationId: 'obs-002',
			operationId: 'list-notes',
			provenance: 'baseline',
			callInputs: {},
			responseStatus: 200,
			responseBody: {
				ok: true,
				notes: [],
			},
		},
		{
			observationId: 'obs-003',
			operationId: 'patch-note',
			provenance: 'evaluator-chosen',
			callInputs: {
				id: 'n-1',
				title: 'Revised',
			},
			responseStatus: 200,
			responseBody: {
				ok: true,
				note: {
					id: 'n-1',
					title: 'Revised',
					body: 'b',
					tags: ['t'],
					updatedAt: '2026-07-29T10:05:00Z',
				},
			},
		},
		{
			observationId: 'obs-004',
			operationId: 'get-note',
			provenance: 'evaluator-chosen',
			callInputs: {
				id: 'n-1',
			},
			responseStatus: 200,
			responseBody: {
				ok: true,
				note: {
					id: 'n-1',
					title: 'Original',
					body: 'b',
					tags: ['t'],
					updatedAt: '2026-07-29T10:00:00Z',
				},
			},
		},
		{
			observationId: 'obs-005',
			operationId: 'patch-note',
			provenance: 'evaluator-chosen',
			callInputs: {
				id: 'n-2',
				colour: 'red',
			},
			responseStatus: 200,
			responseBody: {
				ok: true,
				note: {
					id: 'n-2',
					title: 'Second',
					body: 'b2',
					tags: [],
					updatedAt: '2026-07-29T10:06:00Z',
					colour: 'red',
				},
			},
		},
	],
	judgeResults: [],
	actionsArtifact: {
		kind: 'action-log',
		reference: 'opaque:spike-actions-0001',
		digest:
			'sha256:0000000000000000000000000000000000000000000000000000000000000005',
		visibility: 'private',
	},
	resourceUse: {
		toolCalls: 5,
		inputTokens: 8100,
		outputTokens: 1400,
		wallClockSeconds: 62.5,
		costUsd: 0.04,
	},
	isolationManifestArtifact: {
		kind: 'isolation-manifest',
		reference: 'opaque:spike-manifest-0001',
		digest:
			'sha256:0000000000000000000000000000000000000000000000000000000000000006',
		visibility: 'private',
	},
	invalidReason: null,
}

/**
 * Its sixty-one issues, each a real divergence rather than a transcription
 * slip: absent lineage; no run `mode`, the field owed item 4 made required;
 * dispositions missing `observationIds` (AD-33); finding-level `provenance`
 * instead of observation-level (AD-23); the old four-field artifact-reference
 * shape; a defect finding with no `quotedEvidence` (AD-23); the flat
 * `callInputs` map (AD-26); missing process channels; `costUsd` as a number;
 * no `evidenceDisclosure`.
 */
export const WORKED_EXAMPLE_RECORD_ISSUES: readonly WorkedExampleIssue[] = [
	{ path: ['parentDigest'], code: 'invalid_type' },
	{ path: ['revisionCount'], code: 'invalid_type' },
	{ path: ['mode'], code: 'invalid_value' },
	{ path: ['oracleDispositions', 0, 'observationIds'], code: 'invalid_type' },
	{ path: ['oracleDispositions', 1, 'observationIds'], code: 'invalid_type' },
	{ path: ['oracleDispositions', 2, 'observationIds'], code: 'invalid_type' },
	{ path: ['oracleDispositions', 3, 'observationIds'], code: 'invalid_type' },
	{ path: ['oracleDispositions', 4, 'observationIds'], code: 'invalid_type' },
	{
		path: ['findings', 0, 'evidenceArtifacts', 0, 'storage'],
		code: 'invalid_union',
	},
	{ path: ['findings', 0, 'quotedEvidence'], code: 'invalid_type' },
	{ path: ['findings', 0], code: 'unrecognized_keys' },
	{ path: ['findings', 1], code: 'unrecognized_keys' },
	{ path: ['findings', 2], code: 'unrecognized_keys' },
	{ path: ['observations', 0, 'callInputs', 'path'], code: 'invalid_type' },
	{ path: ['observations', 0, 'callInputs', 'query'], code: 'invalid_type' },
	{ path: ['observations', 0, 'callInputs', 'header'], code: 'invalid_type' },
	{ path: ['observations', 0, 'callInputs', 'body'], code: 'invalid_type' },
	{ path: ['observations', 0, 'callInputs'], code: 'unrecognized_keys' },
	{ path: ['observations', 0, 'responseHeaders'], code: 'invalid_type' },
	{ path: ['observations', 0, 'stdout'], code: 'invalid_type' },
	{ path: ['observations', 0, 'stderr'], code: 'invalid_type' },
	{ path: ['observations', 0, 'exitCode'], code: 'invalid_type' },
	{ path: ['observations', 1, 'callInputs', 'path'], code: 'invalid_type' },
	{ path: ['observations', 1, 'callInputs', 'query'], code: 'invalid_type' },
	{ path: ['observations', 1, 'callInputs', 'header'], code: 'invalid_type' },
	{ path: ['observations', 1, 'callInputs', 'body'], code: 'invalid_type' },
	{ path: ['observations', 1, 'responseHeaders'], code: 'invalid_type' },
	{ path: ['observations', 1, 'stdout'], code: 'invalid_type' },
	{ path: ['observations', 1, 'stderr'], code: 'invalid_type' },
	{ path: ['observations', 1, 'exitCode'], code: 'invalid_type' },
	{ path: ['observations', 2, 'callInputs', 'path'], code: 'invalid_type' },
	{ path: ['observations', 2, 'callInputs', 'query'], code: 'invalid_type' },
	{ path: ['observations', 2, 'callInputs', 'header'], code: 'invalid_type' },
	{ path: ['observations', 2, 'callInputs', 'body'], code: 'invalid_type' },
	{ path: ['observations', 2, 'callInputs'], code: 'unrecognized_keys' },
	{ path: ['observations', 2, 'responseHeaders'], code: 'invalid_type' },
	{ path: ['observations', 2, 'stdout'], code: 'invalid_type' },
	{ path: ['observations', 2, 'stderr'], code: 'invalid_type' },
	{ path: ['observations', 2, 'exitCode'], code: 'invalid_type' },
	{ path: ['observations', 3, 'callInputs', 'path'], code: 'invalid_type' },
	{ path: ['observations', 3, 'callInputs', 'query'], code: 'invalid_type' },
	{ path: ['observations', 3, 'callInputs', 'header'], code: 'invalid_type' },
	{ path: ['observations', 3, 'callInputs', 'body'], code: 'invalid_type' },
	{ path: ['observations', 3, 'callInputs'], code: 'unrecognized_keys' },
	{ path: ['observations', 3, 'responseHeaders'], code: 'invalid_type' },
	{ path: ['observations', 3, 'stdout'], code: 'invalid_type' },
	{ path: ['observations', 3, 'stderr'], code: 'invalid_type' },
	{ path: ['observations', 3, 'exitCode'], code: 'invalid_type' },
	{ path: ['observations', 4, 'callInputs', 'path'], code: 'invalid_type' },
	{ path: ['observations', 4, 'callInputs', 'query'], code: 'invalid_type' },
	{ path: ['observations', 4, 'callInputs', 'header'], code: 'invalid_type' },
	{ path: ['observations', 4, 'callInputs', 'body'], code: 'invalid_type' },
	{ path: ['observations', 4, 'callInputs'], code: 'unrecognized_keys' },
	{ path: ['observations', 4, 'responseHeaders'], code: 'invalid_type' },
	{ path: ['observations', 4, 'stdout'], code: 'invalid_type' },
	{ path: ['observations', 4, 'stderr'], code: 'invalid_type' },
	{ path: ['observations', 4, 'exitCode'], code: 'invalid_type' },
	{ path: ['actionsArtifact', 'storage'], code: 'invalid_union' },
	{ path: ['isolationManifestArtifact', 'storage'], code: 'invalid_union' },
	{ path: ['resourceUse', 'costUsd'], code: 'invalid_type' },
	{ path: ['evidenceDisclosure'], code: 'invalid_type' },
]

/** `evidence-artifact.json`, verbatim. */
export const workedExampleEvidenceArtifact: unknown = {
	schemaVersion: 1,
	runId: 'spike-run-0001',
	scoringVersion:
		'sha256:0000000000000000000000000000000000000000000000000000000000000009',
	comparabilityKey:
		'sha256:000000000000000000000000000000000000000000000000000000000000000a',
	mode: 'contract-scoring',
	contractVerdict: 'CONCERNS',
	exitCode: 0,
	verdictBasis: [
		'contract caught the seeded critical defect on its only defect probe',
		'one unsatisfied coverage gap at material severity: sibling-cross-check',
		'trials below declared minimum: 1 completed, 3 declared',
	],
	systemRecommendationRecorded: 'FAIL',
	systemRecommendationNote:
		'Expected in contract-scoring mode: the probe is knowingly defective, so a system-directed FAIL is an input rather than a signal about the contract. Not promoted to a verdict.',
	callerAttestedInputs: [
		'corpusDigest',
		'fixtureDigest',
		'evaluatorConfigurationDigest',
	],
	trials: {
		declaredMinimum: 3,
		completed: 1,
		invalidatedAttempts: [],
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
		},
		{
			oracleId: 'O-002',
			probeId: 'P-001',
			state: 'confirmed',
			severity: 'material',
			disposition: 'held',
			resolvedFrom: 'F-002',
			corroboration: 'agrees',
		},
		{
			oracleId: 'O-003',
			probeId: 'P-001',
			state: 'confirmed',
			severity: 'material',
			disposition: 'held',
			resolvedFrom: null,
			corroboration: 'agrees',
		},
		{
			oracleId: 'O-004',
			probeId: 'P-001',
			state: 'confirmed',
			severity: 'material',
			disposition: 'held',
			resolvedFrom: null,
			corroboration: 'agrees',
		},
		{
			oracleId: 'O-005',
			probeId: 'P-001',
			state: 'confirmed',
			severity: 'low',
			disposition: 'held',
			resolvedFrom: null,
			corroboration: 'agrees',
		},
	],
	uncitedFindings: ['F-003'],
	coverageGaps: [
		{
			rule: 'sibling-cross-check',
			relevancePredicate: 'siblingGroups.parameters non-empty',
			satisfactionPredicate:
				'an oracle whose intent and check address both members of a declared parameter group',
			satisfied: false,
			severity: 'material',
		},
	],
	strength: {
		denominator:
			'unique qualified probe identifiers exercised per class, across 1 completed trial',
		vector: {
			defect: {
				caught: 1,
				exercised: 1,
				rate: 1,
			},
		},
		rawCounts: {
			defect: {
				caught: 1,
				exercised: 1,
			},
		},
		comparable: false,
		note: 'Single probe, single trial. Below the declared minimum of 3, so the vector is reported and explicitly non-comparable rather than silently compared.',
	},
	remediation: {
		revisionCount: 0,
		cap: 3,
		capSource: 'caller-attested',
	},
}

/**
 * Its nineteen issues. `mode`, `contractVerdict`, `verdictBasis`, `trials`,
 * and `callerAttestedInputs` parse unchanged. What fails: absent lineage; the
 * scoring version as a bare digest missing AD-11's five named inputs; no
 * `excludedProbeIds`; outcomes with neither `selectedObservationIds` nor
 * `checkResolution`; `strength` with no `basis` and a one-key vector;
 * `rawCounts` (dropped as a duplicate of the vector); remediation with no
 * `lineageChain`.
 */
export const WORKED_EXAMPLE_EVIDENCE_ISSUES: readonly WorkedExampleIssue[] = [
	{ path: ['parentDigest'], code: 'invalid_type' },
	{ path: ['revisionCount'], code: 'invalid_type' },
	{ path: ['scoringVersionInputs'], code: 'invalid_type' },
	{ path: ['excludedProbeIds'], code: 'invalid_type' },
	{ path: ['outcomes', 0, 'selectedObservationIds'], code: 'invalid_type' },
	{ path: ['outcomes', 0, 'checkResolution'], code: 'invalid_type' },
	{ path: ['outcomes', 1, 'selectedObservationIds'], code: 'invalid_type' },
	{ path: ['outcomes', 1, 'checkResolution'], code: 'invalid_type' },
	{ path: ['outcomes', 2, 'selectedObservationIds'], code: 'invalid_type' },
	{ path: ['outcomes', 2, 'checkResolution'], code: 'invalid_type' },
	{ path: ['outcomes', 3, 'selectedObservationIds'], code: 'invalid_type' },
	{ path: ['outcomes', 3, 'checkResolution'], code: 'invalid_type' },
	{ path: ['outcomes', 4, 'selectedObservationIds'], code: 'invalid_type' },
	{ path: ['outcomes', 4, 'checkResolution'], code: 'invalid_type' },
	{ path: ['strength', 'basis'], code: 'invalid_value' },
	{ path: ['strength', 'vector', 'gameability'], code: 'invalid_type' },
	{ path: ['strength', 'vector', 'zero-action'], code: 'invalid_type' },
	{ path: ['strength'], code: 'unrecognized_keys' },
	{ path: ['remediation', 'lineageChain'], code: 'invalid_type' },
]
