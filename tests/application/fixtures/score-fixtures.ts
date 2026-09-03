/**
 * One clean, self-consistent fixture chain for `runScore`, reused by
 * `tests/application/score.test.ts` and `tests/cli/run.test.ts` alike: a
 * `SealedRunRecord` that `ingest`s to zero conditions and `score`s PASS with
 * an empty basis, matching `tests/score/score.test.ts`'s own
 * `cleanTrial`/`baseContract` recipe one layer up through `ingest`.
 *
 * `behaviors[0].severity` is `'low'`, deliberately below the default
 * `severityFloor` ("material") on `scoringPolicyFixture` below, so the clean
 * case resolves PASS and a caller-lowered floor resolves CONCERNS instead.
 */
import {
	digestArtifact,
	digestBytes,
} from '../../../src/core/canonical/digest.ts'
import type { EvalContract } from '../../../src/core/schemas/eval-contract.ts'
import type { EvaluatorConfiguration } from '../../../src/core/schemas/evaluator-configuration.ts'
import type { IsolationManifest } from '../../../src/core/schemas/isolation-manifest.ts'
import type { PreflightVerdict } from '../../../src/core/schemas/preflight-verdict.ts'
import type { PrivateArtifactManifest } from '../../../src/core/schemas/private-artifact-manifest.ts'
import type { Probe } from '../../../src/core/schemas/probe.ts'
import type { ScoringPolicy } from '../../../src/core/schemas/scoring-policy.ts'
import type { SealedRunRecord } from '../../../src/core/schemas/sealed-run-record.ts'
import {
	notesInterface,
	qualifiedProbe,
} from '../../score/fixtures/probe-witness.ts'

export const corpusDigestFixture =
	'sha256:0000000000000000000000000000000000000000000000000000000000000030'

export const isolationManifestBytes = new TextEncoder().encode(
	'fixture isolation manifest bytes',
)
export const isolationManifestBytesDigest = digestBytes(isolationManifestBytes)
export const privateEntryBytes = new TextEncoder().encode(
	'fixture private entry bytes',
)
export const privateEntryBytesDigest = digestBytes(privateEntryBytes)

export const scoreContractFixture: EvalContract = {
	schemaVersion: 3,
	parentDigest: null,
	revisionCount: 0,
	contractId: 'score-command-contract',
	sourceSpecDigest: null,
	behaviors: [
		{
			id: 'B-001',
			description: 'Creating a note with a string title succeeds.',
			severity: 'low',
			observableSuccessCriterion: 'A 200 response to POST /notes.',
			requirementLinks: [],
			riskLinks: [],
			oracles: ['O-001'],
		},
	],
	oracles: [
		{
			id: 'O-001',
			direction: null,
			check: {
				op: 'equality',
				operands: [
					{ pointer: '/interactions/create/response-status' },
					{ literal: 200 },
				],
			},
			polarity: 'expects-hold',
			commentary: null,
		},
	],
	rubrics: [],
	waivers: [],
	permittedInterfaces: [notesInterface],
	referenceSets: null,
	siblingGroups: null,
	interactionPlan: [
		{
			stepId: 'create',
			operationId: 'create-note',
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { title: { matcher: 'any' } },
			},
			after: null,
			cardinality: 'exactly-one',
		},
	],
	scopedResources: null,
	forbiddenInputs: [],
	testData: { setup: null, cleanup: null, principals: null, resources: null },
	budgets: { maxToolCalls: 0, maxWallClockMinutes: 0, maxCostUsd: '0' },
	safetyLimits: [],
	requiredEvidence: [],
	probeStepBound: null,
	fixtureReset: null,
}

// `qualifiedProbe`'s own `probeId` ("PX-001") is not schema-valid `ProbeId`
// shape (`^P-[0-9]{3,}$`); `tests/emit/emit.test.ts` hits the identical gap
// and overrides it the same way (deferred-work.md's routed, unassigned entry
// from the emit stage's own review).
export const scoreProbeFixture: Probe = { ...qualifiedProbe, probeId: 'P-001' }

export const evaluatorConfigurationFixture: EvaluatorConfiguration = {
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	sealedBriefDigest:
		'sha256:0000000000000000000000000000000000000000000000000000000000000010',
	evaluatorIdentity: 'opaque:evaluator-1',
	modelSnapshot: 'model-snapshot-1',
	systemPromptDigest:
		'sha256:0000000000000000000000000000000000000000000000000000000000000011',
	decodingParameters: { temperature: 0 },
	toolInventory: [],
	permissionInventory: [],
	budgets: { maxToolCalls: 1, maxWallClockMinutes: 1, maxCostUsd: '1' },
	seed: 1,
	judgeConfiguration: null,
}
export const evaluatorConfigurationDigestFixture = digestArtifact(
	evaluatorConfigurationFixture,
	'EvaluatorConfiguration',
)

const scoreContractDigestFixture =
	'sha256:0000000000000000000000000000000000000000000000000000000000000020'

/** The withheld shape for every one of AD-16's seven forbidden inputs. */
const withheld = { withheld: true, note: null }

export const isolationManifestFixtureForScore: IsolationManifest = {
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	runId: 'run-1',
	contractId: 'score-command-contract',
	conditionArm: 'independent',
	modelSnapshot: 'model-snapshot-1',
	systemPromptDigest:
		'sha256:0000000000000000000000000000000000000000000000000000000000000012',
	contractDigest: scoreContractDigestFixture,
	evaluatorConfigurationDigest: evaluatorConfigurationDigestFixture,
	workspaceIdentity: 'workspace-1',
	allowedMounts: [],
	observedMounts: [],
	networkAllowlist: [],
	observedNetworkTargets: [],
	toolAllowlist: [],
	observedToolCalls: [],
	resourceCeilings: {
		maxToolCalls: 1,
		maxInputTokens: 1,
		maxOutputTokens: 1,
		maxWallClockMinutes: 1,
		maxCostUsd: '1',
	},
	actualResourceUse: {
		toolCalls: 0,
		inputTokens: 0,
		outputTokens: 0,
		wallClockSeconds: 0,
		costUsd: '0',
	},
	forbiddenInputAccounting: {
		'original-spec': withheld,
		'source-code': withheld,
		repository: withheld,
		'builder-transcript': withheld,
		'implementation-logs': withheld,
		'comparator-results': withheld,
		'human-labels': withheld,
	},
	violation: null,
}

/** The clean record: one observation satisfying O-001's check, `held`, no findings, no conditions. */
export const sealedRunRecordFixtureForScore: SealedRunRecord = {
	schemaVersion: 3,
	parentDigest: null,
	revisionCount: 0,
	runId: 'run-1',
	conditionArm: 'independent',
	mode: 'production',
	trialIndex: 1,
	contractDigest: scoreContractDigestFixture,
	sealedBriefDigest:
		'sha256:0000000000000000000000000000000000000000000000000000000000000013',
	evaluatorConfigurationDigest: evaluatorConfigurationDigestFixture,
	evaluatorRecommendation: 'PASS',
	oracleDispositions: [
		{
			oracleId: 'O-001',
			disposition: 'held',
			observationIds: ['obs-1'],
			note: null,
		},
	],
	findings: [],
	observations: [
		{
			observationId: 'obs-1',
			sequence: 1,
			operationId: 'create-note',
			provenance: 'evaluator-chosen',
			callInputs: {
				path: null,
				query: null,
				header: null,
				body: { title: 'ok' },
			},
			responseBody: { ok: true },
			responseHeaders: null,
			responseStatus: 200,
			stdout: null,
			stderr: null,
			exitCode: null,
		},
	],
	judgeResults: [],
	actionsArtifact: {
		storage: 'public',
		path: 'evidence/actions.jsonl',
		privateRef: null,
		digest:
			'sha256:0000000000000000000000000000000000000000000000000000000000000014',
	},
	isolationManifestArtifact: {
		storage: 'private',
		path: null,
		privateRef: 'opaque:isolation-manifest-1',
		digest: isolationManifestBytesDigest,
	},
	resourceUse: {
		toolCalls: 0,
		inputTokens: 0,
		outputTokens: 0,
		wallClockSeconds: 0,
		costUsd: '0',
	},
	evidenceDisclosure: { truncationBound: null, reportedIncomplete: false },
	invalidReason: null,
}

export const scoringPolicyFixtureForScore: ScoringPolicy = {
	schemaVersion: 2,
	parentDigest: null,
	revisionCount: 0,
	policyId: 'score-command-policy',
	severityFloor: 'material',
	confidenceThreshold: 0.5,
	catchThreshold: 0.5,
	minimumTrialCount: 1,
	reExecutionCap: 2,
	remediationCap: 3,
	regexMatchStepBudget: 1_000_000,
}

export const passingPreflightVerdictForScore: PreflightVerdict = {
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	runId: 'run-1',
	fixtureDigest:
		'sha256:0000000000000000000000000000000000000000000000000000000000000015',
	passed: true,
	checks: [],
}

export const privateArtifactManifestFixtureForScore: PrivateArtifactManifest = {
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	entries: [
		{
			privateRef: 'opaque:private-entry-1',
			digest: privateEntryBytesDigest,
			artifactKind: 'raw-trace',
			publicSafeRunId: 'run-1',
			sanitizationPolicy: null,
		},
	],
}
