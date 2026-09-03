// One reject fixture per constraint the schema enforces, following the
// `RejectCase` shape from Story 1.3: an accept fixture mutated to violate
// exactly one constraint, asserting the Zod issue path and code rather than a
// bare "did not parse" (which stays green when the schema rejects for the
// wrong reason).
//
// Constraints the schema deliberately does not enforce live in
// `ad5-admissions.test.ts` instead (AD-5).

import type { InterchangeArtifactKey } from '../../../src/core/schemas/artifact.ts'
import { contractScoringEvidenceArtifact } from './artifact-fixtures.ts'

export type ArtifactRejectCase = {
	readonly id: string
	readonly artifact: InterchangeArtifactKey
	/** what the mutation violates, in the schema's own terms. */
	readonly constraint: string
	/** mutates a clone; typed loosely because a reject fixture is by construction not of the parsed type. */
	readonly mutate: (artifact: any) => void
	readonly issuePath: readonly (string | number)[]
	readonly issueCode: string
	/** the validator keyword the published schema must report; see `RejectCase.keyword`. */
	readonly keyword: string
	/** the RFC 6901 instance pointer in ajv 8's spelling; see `RejectCase.instancePath`. */
	readonly instancePath: string
	/** the discriminating error params for parent-reporting keywords; see `RejectCase.errorParams`. */
	readonly errorParams?: Readonly<Record<string, string>>
	/** set where one mutation legitimately produces more than one issue. */
	readonly issueCount?: number
	/**
	 * Overrides the accept fixture this case clones from, for a constraint that
	 * exists only on a branch the registry's default accept seed
	 * (`ARTIFACT_ACCEPT_FIXTURES[artifact]`) does not take. Both consumers read
	 * `rejectCase.seed ?? ARTIFACT_ACCEPT_FIXTURES[artifact]`.
	 */
	readonly seed?: unknown
}

export const ARTIFACT_REJECT_CASES: readonly ArtifactRejectCase[] = [
	// ---- artifact-reference -------------------------------------------------
	{
		id: 'reference-digest-malformed',
		artifact: 'artifact-reference',
		constraint:
			'a digest is "sha256:" plus 64 lowercase hex characters (AD-27)',
		mutate: (reference) => {
			reference.digest = 'sha256:ABC'
		},
		issuePath: ['digest'],
		issueCode: 'invalid_format',
		keyword: 'pattern',
		instancePath: '/digest',
	},
	{
		id: 'reference-public-path-empty',
		artifact: 'artifact-reference',
		constraint: 'a public reference names a non-empty path',
		mutate: (reference) => {
			reference.path = ''
		},
		issuePath: ['path'],
		issueCode: 'too_small',
		keyword: 'minLength',
		instancePath: '/path',
	},
	{
		id: 'reference-public-carries-private-ref',
		artifact: 'artifact-reference',
		constraint:
			'the inapplicable member of a branch is explicit null, never a value',
		mutate: (reference) => {
			reference.privateRef = 'opaque:leaked'
		},
		issuePath: ['privateRef'],
		issueCode: 'invalid_type',
		keyword: 'type',
		instancePath: '/privateRef',
	},
	{
		id: 'reference-storage-outside-the-two',
		artifact: 'artifact-reference',
		constraint: 'storage discriminates exactly two branches',
		mutate: (reference) => {
			reference.storage = 'hybrid'
		},
		issuePath: ['storage'],
		issueCode: 'invalid_union',
		keyword: 'const',
		instancePath: '/storage',
	},

	// ---- private-artifact-manifest -----------------------------------------
	{
		id: 'manifest-private-ref-empty',
		artifact: 'private-artifact-manifest',
		constraint: 'an opaque reference is non-empty',
		mutate: (manifest) => {
			manifest.entries[0].privateRef = ''
		},
		issuePath: ['entries', 0, 'privateRef'],
		issueCode: 'too_small',
		keyword: 'minLength',
		instancePath: '/entries/0/privateRef',
	},
	{
		id: 'manifest-kind-outside-the-eight',
		artifact: 'private-artifact-manifest',
		constraint: "artifactKind ratifies the prior art's eight members",
		mutate: (manifest) => {
			manifest.entries[0].artifactKind = 'screenshot'
		},
		issuePath: ['entries', 0, 'artifactKind'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/entries/0/artifactKind',
	},
	{
		id: 'manifest-sanitization-policy-empty',
		artifact: 'private-artifact-manifest',
		constraint:
			'a sanitization policy is a non-empty opaque string or explicit null',
		mutate: (manifest) => {
			manifest.entries[0].sanitizationPolicy = ''
		},
		issuePath: ['entries', 0, 'sanitizationPolicy'],
		issueCode: 'too_small',
		keyword: 'minLength',
		instancePath: '/entries/0/sanitizationPolicy',
	},
	{
		id: 'manifest-schema-version-below-one',
		artifact: 'private-artifact-manifest',
		constraint: 'schemaVersion is an integer of at least 1 (AD-11)',
		mutate: (manifest) => {
			manifest.schemaVersion = 0
		},
		issuePath: ['schemaVersion'],
		issueCode: 'too_small',
		keyword: 'minimum',
		instancePath: '/schemaVersion',
	},

	// ---- sealed-run-record --------------------------------------------------
	{
		id: 'record-mode-absent',
		artifact: 'sealed-run-record',
		constraint: 'the run mode is required (AD-21, owed item 4)',
		mutate: (record) => {
			delete record.mode
		},
		issuePath: ['mode'],
		// A missing key on an enum member resolves `undefined` against the two
		// values, so Zod reports `invalid_value` where a missing string reports
		// `invalid_type`. The published schema still reports `required`.
		issueCode: 'invalid_value',
		keyword: 'required',
		instancePath: '',
		errorParams: { missingProperty: 'mode' },
	},
	{
		id: 'record-mode-outside-the-two',
		artifact: 'sealed-run-record',
		constraint: "the run mode is AD-21's production or contract-scoring",
		mutate: (record) => {
			record.mode = 'shadow'
		},
		issuePath: ['mode'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/mode',
	},
	{
		id: 'record-run-id-empty',
		artifact: 'sealed-run-record',
		constraint: 'an opaque caller label is non-empty',
		mutate: (record) => {
			record.runId = ''
		},
		issuePath: ['runId'],
		issueCode: 'too_small',
		keyword: 'minLength',
		instancePath: '/runId',
	},
	{
		id: 'record-trial-index-zero',
		artifact: 'sealed-run-record',
		constraint: 'the trial index is one-based',
		mutate: (record) => {
			record.trialIndex = 0
		},
		issuePath: ['trialIndex'],
		issueCode: 'too_small',
		keyword: 'minimum',
		instancePath: '/trialIndex',
	},
	{
		id: 'record-recommendation-not-applicable',
		artifact: 'sealed-run-record',
		constraint:
			"the evaluator recommendation is the verdict vocabulary minus WAIVED; the prior art's NOT_APPLICABLE does not survive",
		mutate: (record) => {
			record.evaluatorRecommendation = 'NOT_APPLICABLE'
		},
		issuePath: ['evaluatorRecommendation'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/evaluatorRecommendation',
	},
	{
		id: 'record-finding-id-underpadded',
		artifact: 'sealed-run-record',
		constraint: 'an identifier prefix carries three or more digits',
		mutate: (record) => {
			record.findings[0].findingId = 'F-1'
		},
		issuePath: ['findings', 0, 'findingId'],
		issueCode: 'invalid_format',
		keyword: 'pattern',
		instancePath: '/findings/0/findingId',
	},
	{
		id: 'record-confidence-above-one',
		artifact: 'sealed-run-record',
		constraint: 'confidence is the closed unit interval',
		mutate: (record) => {
			record.findings[0].confidence = 1.5
		},
		issuePath: ['findings', 0, 'confidence'],
		issueCode: 'too_big',
		keyword: 'maximum',
		instancePath: '/findings/0/confidence',
	},
	{
		id: 'record-defect-quoted-evidence-empty',
		artifact: 'sealed-run-record',
		constraint: 'a defect finding carries at least one quotation (AD-23)',
		mutate: (record) => {
			record.findings[0].quotedEvidence = []
		},
		issuePath: ['findings', 0, 'quotedEvidence'],
		issueCode: 'too_small',
		keyword: 'minItems',
		instancePath: '/findings/0/quotedEvidence',
	},
	{
		id: 'record-quoted-channel-outside-the-seven',
		artifact: 'sealed-run-record',
		constraint: "quoted evidence names one of AD-26's seven channels",
		mutate: (record) => {
			record.findings[0].quotedEvidence[0].channel = 'trace'
		},
		issuePath: ['findings', 0, 'quotedEvidence', 0, 'channel'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/findings/0/quotedEvidence/0/channel',
	},
	{
		id: 'record-disposition-outside-the-three',
		artifact: 'sealed-run-record',
		constraint: "a disposition is AD-23's held, violated, or not-attempted",
		mutate: (record) => {
			record.oracleDispositions[0].disposition = 'unknown'
		},
		issuePath: ['oracleDispositions', 0, 'disposition'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/oracleDispositions/0/disposition',
	},
	{
		id: 'record-provenance-outside-the-two',
		artifact: 'sealed-run-record',
		constraint: "an observation's provenance is baseline or evaluator-chosen",
		mutate: (record) => {
			record.observations[0].provenance = 'unknown'
		},
		issuePath: ['observations', 0, 'provenance'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/observations/0/provenance',
	},
	{
		id: 'record-response-status-not-an-integer',
		artifact: 'sealed-run-record',
		constraint: 'a status code is an integer or explicit null',
		mutate: (record) => {
			record.observations[0].responseStatus = 200.5
		},
		issuePath: ['observations', 0, 'responseStatus'],
		issueCode: 'invalid_type',
		keyword: 'type',
		instancePath: '/observations/0/responseStatus',
	},
	{
		id: 'record-cost-as-a-number',
		artifact: 'sealed-run-record',
		constraint: 'money is a decimal string, never a JSON number (AD-36)',
		mutate: (record) => {
			record.resourceUse.costUsd = 0.04
		},
		issuePath: ['resourceUse', 'costUsd'],
		issueCode: 'invalid_type',
		keyword: 'type',
		instancePath: '/resourceUse/costUsd',
	},
	{
		id: 'record-cost-negative',
		artifact: 'sealed-run-record',
		constraint: 'money uses the unsigned decimal-string form',
		mutate: (record) => {
			record.resourceUse.costUsd = '-0.04'
		},
		issuePath: ['resourceUse', 'costUsd'],
		issueCode: 'invalid_format',
		keyword: 'pattern',
		instancePath: '/resourceUse/costUsd',
	},
	{
		id: 'record-wall-clock-negative',
		artifact: 'sealed-run-record',
		constraint: 'a measured duration is not negative',
		mutate: (record) => {
			record.resourceUse.wallClockSeconds = -1
		},
		issuePath: ['resourceUse', 'wallClockSeconds'],
		issueCode: 'too_small',
		keyword: 'minimum',
		instancePath: '/resourceUse/wallClockSeconds',
	},
	{
		id: 'record-truncation-bound-negative',
		artifact: 'sealed-run-record',
		constraint: 'a truncation bound is a non-negative integer or null (AD-17)',
		mutate: (record) => {
			record.evidenceDisclosure.truncationBound = -1
		},
		issuePath: ['evidenceDisclosure', 'truncationBound'],
		issueCode: 'too_small',
		keyword: 'minimum',
		instancePath: '/evidenceDisclosure/truncationBound',
	},

	{
		id: 'record-finding-type-outside-the-three',
		artifact: 'sealed-run-record',
		constraint:
			"a finding type outside AD-23's three resolves to no branch of the union",
		mutate: (record) => {
			record.findings[0].findingType = 'suspicion'
		},
		issuePath: ['findings', 0, 'findingType'],
		issueCode: 'invalid_union',
		keyword: 'const',
		instancePath: '/findings/0/findingType',
	},
	{
		id: 'record-confidence-below-zero',
		artifact: 'sealed-run-record',
		constraint:
			'confidence is the closed unit interval, bounded from below as well as above',
		mutate: (record) => {
			record.findings[0].confidence = -0.1
		},
		issuePath: ['findings', 0, 'confidence'],
		issueCode: 'too_small',
		keyword: 'minimum',
		instancePath: '/findings/0/confidence',
	},
	{
		id: 'record-response-status-negative',
		artifact: 'sealed-run-record',
		constraint: 'a status code is not negative',
		mutate: (record) => {
			record.observations[0].responseStatus = -1
		},
		issuePath: ['observations', 0, 'responseStatus'],
		issueCode: 'too_small',
		keyword: 'minimum',
		instancePath: '/observations/0/responseStatus',
	},
	{
		id: 'record-response-headers-scalar',
		artifact: 'sealed-run-record',
		constraint:
			'the response-headers channel is a name-to-value map, because AD-26 gives it a pointer tail',
		mutate: (record) => {
			record.observations[0].responseHeaders = 200
		},
		issuePath: ['observations', 0, 'responseHeaders'],
		issueCode: 'invalid_type',
		keyword: 'type',
		instancePath: '/observations/0/responseHeaders',
	},
	{
		id: 'record-sequence-absent',
		artifact: 'sealed-run-record',
		constraint:
			'an observation carries a required sequence (ADR-006, owed item 2)',
		mutate: (record) => {
			delete record.observations[0].sequence
		},
		issuePath: ['observations', 0, 'sequence'],
		issueCode: 'invalid_type',
		keyword: 'required',
		instancePath: '/observations/0',
		errorParams: { missingProperty: 'sequence' },
	},
	{
		id: 'record-sequence-not-positive',
		artifact: 'sealed-run-record',
		constraint: 'sequence is a positive integer',
		mutate: (record) => {
			record.observations[0].sequence = 0
		},
		issuePath: ['observations', 0, 'sequence'],
		issueCode: 'too_small',
		keyword: 'exclusiveMinimum',
		instancePath: '/observations/0/sequence',
	},

	// ---- isolation-manifest -------------------------------------------------
	{
		id: 'manifest-ceiling-below-one',
		artifact: 'isolation-manifest',
		constraint: "the three count ceilings carry the prior art's `minimum: 1`",
		mutate: (manifest) => {
			manifest.resourceCeilings.maxToolCalls = 0
		},
		issuePath: ['resourceCeilings', 'maxToolCalls'],
		issueCode: 'too_small',
		keyword: 'minimum',
		instancePath: '/resourceCeilings/maxToolCalls',
	},
	{
		id: 'manifest-wall-clock-ceiling-zero',
		artifact: 'isolation-manifest',
		constraint:
			"the prior art's `exclusiveMinimum: 0` on the wall-clock ceiling, kept",
		mutate: (manifest) => {
			manifest.resourceCeilings.maxWallClockMinutes = 0
		},
		issuePath: ['resourceCeilings', 'maxWallClockMinutes'],
		issueCode: 'too_small',
		keyword: 'exclusiveMinimum',
		instancePath: '/resourceCeilings/maxWallClockMinutes',
	},
	{
		id: 'manifest-cost-ceiling-zero',
		artifact: 'isolation-manifest',
		constraint:
			"the prior art's `exclusiveMinimum: 0` on the cost ceiling survives the move from number to decimal string",
		mutate: (manifest) => {
			manifest.resourceCeilings.maxCostUsd = '0'
		},
		issuePath: ['resourceCeilings', 'maxCostUsd'],
		issueCode: 'invalid_format',
		keyword: 'pattern',
		instancePath: '/resourceCeilings/maxCostUsd',
	},
	{
		id: 'manifest-cost-ceiling-zero-with-fraction',
		artifact: 'isolation-manifest',
		constraint:
			'a positive decimal string excludes every spelling of zero, not only the bare one',
		mutate: (manifest) => {
			manifest.resourceCeilings.maxCostUsd = '0.00'
		},
		issuePath: ['resourceCeilings', 'maxCostUsd'],
		issueCode: 'invalid_format',
		keyword: 'pattern',
		instancePath: '/resourceCeilings/maxCostUsd',
	},
	{
		id: 'manifest-ceiling-cost-as-a-number',
		artifact: 'isolation-manifest',
		constraint:
			'money is a decimal string in the manifest too, per the universal value domain',
		mutate: (manifest) => {
			manifest.resourceCeilings.maxCostUsd = 5
		},
		issuePath: ['resourceCeilings', 'maxCostUsd'],
		issueCode: 'invalid_type',
		keyword: 'type',
		instancePath: '/resourceCeilings/maxCostUsd',
	},
	{
		id: 'manifest-accounting-extra-member',
		artifact: 'isolation-manifest',
		constraint: 'the accounting is closed at the seven-member floor',
		mutate: (manifest) => {
			manifest.forbiddenInputAccounting['golden-answers'] = {
				withheld: true,
				note: null,
			}
		},
		issuePath: ['forbiddenInputAccounting'],
		issueCode: 'unrecognized_keys',
		keyword: 'additionalProperties',
		instancePath: '/forbiddenInputAccounting',
		errorParams: { additionalProperty: 'golden-answers' },
	},
	{
		id: 'manifest-contract-id-outside-the-charset',
		artifact: 'isolation-manifest',
		constraint: 'every identifier is a kebab slug from the shared charset',
		mutate: (manifest) => {
			manifest.contractId = 'Notes_API'
		},
		issuePath: ['contractId'],
		issueCode: 'invalid_format',
		keyword: 'pattern',
		instancePath: '/contractId',
	},

	// ---- evaluator-configuration -------------------------------------------
	{
		id: 'configuration-identity-empty',
		artifact: 'evaluator-configuration',
		constraint: 'an opaque evaluator identity is non-empty',
		mutate: (configuration) => {
			configuration.evaluatorIdentity = ''
		},
		issuePath: ['evaluatorIdentity'],
		issueCode: 'too_small',
		keyword: 'minLength',
		instancePath: '/evaluatorIdentity',
	},
	{
		id: 'configuration-seed-not-an-integer',
		artifact: 'evaluator-configuration',
		constraint: '"where supported" is spelled null, and a seed is an integer',
		mutate: (configuration) => {
			configuration.seed = 1.5
		},
		issuePath: ['seed'],
		issueCode: 'invalid_type',
		keyword: 'type',
		instancePath: '/seed',
	},
	{
		id: 'configuration-budget-cost-malformed',
		artifact: 'evaluator-configuration',
		constraint: 'a budget carries money in the declared decimal-string format',
		mutate: (configuration) => {
			configuration.budgets.maxCostUsd = '5.00 USD'
		},
		issuePath: ['budgets', 'maxCostUsd'],
		issueCode: 'invalid_format',
		keyword: 'pattern',
		instancePath: '/budgets/maxCostUsd',
	},

	// ---- probe --------------------------------------------------------------
	{
		id: 'probe-id-underpadded',
		artifact: 'probe',
		constraint: 'an identifier prefix carries three or more digits',
		mutate: (probe) => {
			probe.probeId = 'P-1'
		},
		issuePath: ['probeId'],
		issueCode: 'invalid_format',
		keyword: 'pattern',
		instancePath: '/probeId',
	},
	{
		id: 'probe-class-outside-the-four',
		artifact: 'probe',
		constraint: "probeClass is AD-9's closed four",
		mutate: (probe) => {
			probe.probeClass = 'performance'
		},
		issuePath: ['probeClass'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/probeClass',
	},
	{
		id: 'probe-defect-source-outside-the-two',
		artifact: 'probe',
		constraint: "a defect's source is natural or controlled-mutation",
		mutate: (probe) => {
			probe.defects[0].source = 'synthetic'
		},
		issuePath: ['defects', 0, 'source'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/defects/0/source',
	},
	{
		id: 'probe-implementation-digest-malformed',
		artifact: 'probe',
		constraint:
			"the prior art's implementationSha is now the shared AD-27 digest",
		mutate: (probe) => {
			probe.implementationDigest = 'abc123'
		},
		issuePath: ['implementationDigest'],
		issueCode: 'invalid_format',
		keyword: 'pattern',
		instancePath: '/implementationDigest',
	},

	{
		id: 'probe-qualification-absent',
		artifact: 'probe',
		constraint:
			"AD-9's qualification record is required on every probe, canaries included",
		mutate: (probe) => {
			delete probe.qualification
		},
		issuePath: ['qualification'],
		issueCode: 'invalid_type',
		keyword: 'required',
		instancePath: '',
		errorParams: { missingProperty: 'qualification' },
	},
	{
		id: 'probe-qualification-route-outside-the-five',
		artifact: 'probe',
		constraint: "a qualification route is one of AD-9's five",
		mutate: (probe) => {
			probe.qualification.route = 'anecdotal'
		},
		issuePath: ['qualification', 'route'],
		issueCode: 'invalid_union',
		keyword: 'const',
		instancePath: '/qualification/route',
	},
	{
		id: 'probe-signature-selector-captured-binding',
		artifact: 'probe',
		constraint:
			"a defect signature's selector admits literal and matcher bindings only; `{ captured }` names a step of one contract's plan and resolves nothing against another",
		mutate: (probe) => {
			probe.defectSignature.condition.selector.inputBinding.body.title = {
				captured: '/interactions/write/response-body/id',
			}
		},
		issuePath: [
			'defectSignature',
			'condition',
			'selector',
			'inputBinding',
			'body',
			'title',
		],
		issueCode: 'invalid_union',
		keyword: 'anyOf',
		instancePath: '/defectSignature/condition/selector/inputBinding/body/title',
	},
	{
		id: 'probe-signature-selector-principal-binding',
		artifact: 'probe',
		constraint:
			"a defect signature's selector admits literal and matcher bindings only; `{ principal }` names an entry of one contract's test data",
		mutate: (probe) => {
			probe.defectSignature.condition.selector.inputBinding.body.title = {
				principal: 'owner',
			}
		},
		issuePath: [
			'defectSignature',
			'condition',
			'selector',
			'inputBinding',
			'body',
			'title',
		],
		issueCode: 'invalid_union',
		keyword: 'anyOf',
		instancePath: '/defectSignature/condition/selector/inputBinding/body/title',
	},
	{
		id: 'probe-signature-selector-channel-empty',
		artifact: 'probe',
		constraint:
			'a declared selector channel names at least one parameter; an unbound channel is null',
		mutate: (probe) => {
			probe.defectSignature.condition.selector.inputBinding.body = {}
		},
		issuePath: [
			'defectSignature',
			'condition',
			'selector',
			'inputBinding',
			'body',
		],
		issueCode: 'custom',
		keyword: 'minProperties',
		instancePath: '/defectSignature/condition/selector/inputBinding/body',
	},
	{
		id: 'probe-signature-channel-outside-the-seven',
		artifact: 'probe',
		constraint: "an observable channel is one of AD-26's closed seven",
		mutate: (probe) => {
			probe.defectSignature.observableChannel = 'response-trailer'
		},
		issuePath: ['defectSignature', 'observableChannel'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/defectSignature/observableChannel',
	},
	{
		id: 'probe-signature-path-template-colon-spelled',
		artifact: 'probe',
		constraint:
			'a path template spells parameters in braces; AD-40 compares templates as literal segments plus parameter positions and that comparison is not implementable against two syntaxes',
		mutate: (probe) => {
			probe.defectSignature.pathTemplate = '/notes/:id'
		},
		issuePath: ['defectSignature', 'pathTemplate'],
		issueCode: 'invalid_format',
		keyword: 'pattern',
		instancePath: '/defectSignature/pathTemplate',
	},

	{
		id: 'probe-expected-clean-outside-the-two',
		artifact: 'probe',
		constraint:
			'the boolean discriminator admits exactly true and false, and nothing else',
		mutate: (probe) => {
			probe.expectedClean = 'unknown'
		},
		issuePath: ['expectedClean'],
		issueCode: 'invalid_union',
		keyword: 'const',
		instancePath: '/expectedClean',
	},

	// ---- preflight-verdict --------------------------------------------------
	{
		id: 'preflight-fixture-digest-absent',
		artifact: 'preflight-verdict',
		constraint: 'the fixture digest is required (AD-10, AD-11)',
		mutate: (verdict) => {
			delete verdict.fixtureDigest
		},
		issuePath: ['fixtureDigest'],
		issueCode: 'invalid_type',
		keyword: 'required',
		instancePath: '',
		errorParams: { missingProperty: 'fixtureDigest' },
	},
	{
		id: 'preflight-check-kind-outside-the-six',
		artifact: 'preflight-verdict',
		constraint: "the check kinds are AD-10's closed six",
		mutate: (verdict) => {
			verdict.checks[0].kind = 'schema-present'
		},
		issuePath: ['checks', 0, 'kind'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/checks/0/kind',
	},
	{
		id: 'preflight-outcome-outside-the-three',
		artifact: 'preflight-verdict',
		constraint: 'an outcome is satisfied, failed, or exempt',
		mutate: (verdict) => {
			verdict.checks[0].outcome = 'skipped'
		},
		issuePath: ['checks', 0, 'outcome'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/checks/0/outcome',
	},

	// ---- scoring-policy -----------------------------------------------------
	{
		id: 'policy-confidence-threshold-above-one',
		artifact: 'scoring-policy',
		constraint:
			"the threshold shares a finding's confidence scale, the closed unit interval",
		mutate: (policy) => {
			policy.confidenceThreshold = 1.2
		},
		issuePath: ['confidenceThreshold'],
		issueCode: 'too_big',
		keyword: 'maximum',
		instancePath: '/confidenceThreshold',
	},
	{
		id: 'policy-minimum-trial-count-zero',
		artifact: 'scoring-policy',
		constraint: 'a declared minimum trial count is at least one',
		mutate: (policy) => {
			policy.minimumTrialCount = 0
		},
		issuePath: ['minimumTrialCount'],
		issueCode: 'too_small',
		keyword: 'minimum',
		instancePath: '/minimumTrialCount',
	},
	{
		id: 'policy-re-execution-cap-negative',
		artifact: 'scoring-policy',
		constraint: 'a cap is not negative',
		mutate: (policy) => {
			policy.reExecutionCap = -1
		},
		issuePath: ['reExecutionCap'],
		issueCode: 'too_small',
		keyword: 'minimum',
		instancePath: '/reExecutionCap',
	},
	{
		id: 'policy-severity-floor-outside-the-three',
		artifact: 'scoring-policy',
		constraint: "the severity floor uses AD-19's three levels",
		mutate: (policy) => {
			policy.severityFloor = 'blocker'
		},
		issuePath: ['severityFloor'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/severityFloor',
	},

	{
		id: 'policy-confidence-threshold-below-zero',
		artifact: 'scoring-policy',
		constraint:
			'the threshold is bounded from below as well as above, like the confidence it is compared against',
		mutate: (policy) => {
			policy.confidenceThreshold = -0.5
		},
		issuePath: ['confidenceThreshold'],
		issueCode: 'too_small',
		keyword: 'minimum',
		instancePath: '/confidenceThreshold',
	},
	{
		id: 'policy-catch-threshold-above-one',
		artifact: 'scoring-policy',
		constraint:
			'the catch threshold shares the same closed unit interval as the confidence threshold',
		mutate: (policy) => {
			policy.catchThreshold = 1.2
		},
		issuePath: ['catchThreshold'],
		issueCode: 'too_big',
		keyword: 'maximum',
		instancePath: '/catchThreshold',
	},
	{
		id: 'policy-catch-threshold-below-zero',
		artifact: 'scoring-policy',
		constraint:
			'the catch threshold is bounded from below as well as above, like the confidence threshold',
		mutate: (policy) => {
			policy.catchThreshold = -0.5
		},
		issuePath: ['catchThreshold'],
		issueCode: 'too_small',
		keyword: 'minimum',
		instancePath: '/catchThreshold',
	},

	// ---- evidence-artifact --------------------------------------------------
	{
		id: 'evidence-state-outside-the-twelve',
		artifact: 'evidence-artifact',
		constraint: "an outcome state is one of AD-6's closed twelve",
		mutate: (artifact) => {
			artifact.outcomes[0].state = 'detected'
		},
		issuePath: ['outcomes', 0, 'state'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/outcomes/0/state',
	},
	{
		id: 'evidence-corroboration-outside-the-three',
		artifact: 'evidence-artifact',
		constraint: "corroboration is AD-33's closed three",
		mutate: (artifact) => {
			artifact.outcomes[0].corroboration = 'insufficient-evidence'
		},
		issuePath: ['outcomes', 0, 'corroboration'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/outcomes/0/corroboration',
	},
	{
		id: 'evidence-introduction-condition-outside-the-one',
		artifact: 'evidence-artifact',
		constraint: 'AD-4 closes the introduction set at one member',
		mutate: (artifact) => {
			artifact.outcomes[0].checkResolution.introductionCondition =
				'missing-pointer'
		},
		issuePath: ['outcomes', 0, 'checkResolution', 'introductionCondition'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/outcomes/0/checkResolution/introductionCondition',
	},
	{
		id: 'evidence-rate-above-one',
		artifact: 'evidence-artifact',
		constraint: 'a catch rate is the closed unit interval or explicit null',
		mutate: (artifact) => {
			artifact.strength.vector.defect.rate = 1.4
		},
		issuePath: ['strength', 'vector', 'defect', 'rate'],
		issueCode: 'too_big',
		keyword: 'maximum',
		instancePath: '/strength/vector/defect/rate',
	},
	{
		id: 'evidence-basis-outside-the-two',
		artifact: 'evidence-artifact',
		constraint:
			'AD-40 distinguishes a measured catch rate from a reconstructed one',
		mutate: (artifact) => {
			artifact.strength.basis = 'estimated'
		},
		issuePath: ['strength', 'basis'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/strength/basis',
	},
	{
		id: 'evidence-strength-vector-carries-canary',
		artifact: 'evidence-artifact',
		constraint:
			'canary probes and clean controls never enter the vector (AD-7)',
		mutate: (artifact) => {
			artifact.strength.vector.canary = { caught: 1, exercised: 1, rate: 1 }
		},
		issuePath: ['strength', 'vector'],
		issueCode: 'unrecognized_keys',
		keyword: 'additionalProperties',
		instancePath: '/strength/vector',
		errorParams: { additionalProperty: 'canary' },
	},
	{
		id: 'evidence-cap-source-not-caller-attested',
		artifact: 'evidence-artifact',
		constraint:
			'AD-12 states the package validates the remediation cap rather than enforcing it',
		mutate: (artifact) => {
			artifact.remediation.capSource = 'package-enforced'
		},
		issuePath: ['remediation', 'capSource'],
		issueCode: 'invalid_value',
		keyword: 'const',
		instancePath: '/remediation/capSource',
	},
	{
		id: 'evidence-invalidated-attempt-reason-empty',
		artifact: 'evidence-artifact',
		constraint: "AD-6 requires each invalidated attempt's reason",
		mutate: (artifact) => {
			artifact.trials.invalidatedAttempts[0].reason = ''
		},
		issuePath: ['trials', 'invalidatedAttempts', 0, 'reason'],
		issueCode: 'too_small',
		keyword: 'minLength',
		instancePath: '/trials/invalidatedAttempts/0/reason',
	},
	{
		id: 'evidence-exit-code-not-an-integer',
		artifact: 'evidence-artifact',
		constraint: 'an exit code is an integer',
		mutate: (artifact) => {
			artifact.exitCode = 0.5
		},
		issuePath: ['exitCode'],
		issueCode: 'invalid_type',
		keyword: 'type',
		instancePath: '/exitCode',
	},

	{
		id: 'evidence-mode-outside-the-two',
		artifact: 'evidence-artifact',
		constraint:
			'the mode discriminator admits exactly the two modes AD-21 separates',
		mutate: (artifact) => {
			artifact.mode = 'diagnostic'
		},
		issuePath: ['mode'],
		issueCode: 'invalid_union',
		keyword: 'const',
		instancePath: '/mode',
	},
	{
		id: 'evidence-rate-below-zero',
		artifact: 'evidence-artifact',
		constraint: 'a catch rate is bounded from below as well as above',
		mutate: (artifact) => {
			artifact.strength.vector.defect.rate = -0.2
		},
		issuePath: ['strength', 'vector', 'defect', 'rate'],
		issueCode: 'too_small',
		keyword: 'minimum',
		instancePath: '/strength/vector/defect/rate',
	},
	{
		id: 'evidence-verdict-basis-empty-member',
		artifact: 'evidence-artifact',
		constraint:
			'a fired condition that names itself with nothing has not been recorded',
		mutate: (artifact) => {
			artifact.verdictBasis = ['']
		},
		issuePath: ['verdictBasis', 0],
		issueCode: 'too_small',
		keyword: 'minLength',
		instancePath: '/verdictBasis/0',
	},
	{
		id: 'evidence-scoring-version-mode-absent',
		artifact: 'evidence-artifact',
		constraint:
			"mode is ScoringVersionInputs's sixth field and required (owed item 4)",
		mutate: (artifact) => {
			delete artifact.scoringVersionInputs.mode
		},
		issuePath: ['scoringVersionInputs', 'mode'],
		// A missing key on a literal member resolves `undefined` against it, so
		// Zod reports `invalid_value` where a missing string reports
		// `invalid_type` (the same trap Story 7.1's `record-mode-absent` names).
		issueCode: 'invalid_value',
		keyword: 'required',
		instancePath: '/scoringVersionInputs',
		errorParams: { missingProperty: 'mode' },
	},
	{
		id: 'evidence-scoring-version-mode-disagrees-with-branch',
		artifact: 'evidence-artifact',
		constraint:
			"scoringVersionInputs.mode agrees with the artifact's own mode discriminant (AD-11, AD-32); each branch narrows the nested field to that one literal rather than the closed two, so the sibling branch's own legal value is rejected here just as an arbitrary string would be",
		mutate: (artifact) => {
			artifact.scoringVersionInputs.mode = 'contract-scoring'
		},
		issuePath: ['scoringVersionInputs', 'mode'],
		issueCode: 'invalid_value',
		keyword: 'const',
		instancePath: '/scoringVersionInputs/mode',
	},
	{
		id: 'uncited-finding-gaps-absent',
		artifact: 'evidence-artifact',
		constraint:
			"uncitedFindingGaps is required on the contract-scoring branch, the version-3 bump owed item 5 requires (AD-11); the registry's default accept seed is production-mode, so this case clones the contract-scoring seed instead",
		seed: contractScoringEvidenceArtifact,
		mutate: (artifact) => {
			delete artifact.uncitedFindingGaps
		},
		issuePath: ['uncitedFindingGaps'],
		issueCode: 'invalid_type',
		keyword: 'required',
		instancePath: '',
		errorParams: { missingProperty: 'uncitedFindingGaps' },
	},
	{
		id: 'uncited-finding-gap-observation-ids-empty',
		artifact: 'evidence-artifact',
		constraint:
			"a gap's observationIds is non-empty, mirroring the defect finding's own tightened minimum (AD-23) it is read from",
		seed: contractScoringEvidenceArtifact,
		mutate: (artifact) => {
			artifact.uncitedFindingGaps[0].observationIds = []
		},
		issuePath: ['uncitedFindingGaps', 0, 'observationIds'],
		issueCode: 'too_small',
		keyword: 'minItems',
		instancePath: '/uncitedFindingGaps/0/observationIds',
	},
	{
		id: 'uncited-finding-gap-quoted-evidence-empty',
		artifact: 'evidence-artifact',
		constraint:
			"a gap's quotedEvidence is non-empty, mirroring the defect finding's own tightened minimum (AD-23) it is read from",
		seed: contractScoringEvidenceArtifact,
		mutate: (artifact) => {
			artifact.uncitedFindingGaps[0].quotedEvidence = []
		},
		issuePath: ['uncitedFindingGaps', 0, 'quotedEvidence'],
		issueCode: 'too_small',
		keyword: 'minItems',
		instancePath: '/uncitedFindingGaps/0/quotedEvidence',
	},

	// ---- sealed-evaluator-brief --------------------------------------------
	{
		id: 'brief-behaviors-empty',
		artifact: 'sealed-evaluator-brief',
		constraint: 'a brief with no behaviour directs nothing',
		mutate: (brief) => {
			brief.behaviors = []
		},
		issuePath: ['behaviors'],
		issueCode: 'too_small',
		keyword: 'minItems',
		instancePath: '/behaviors',
	},
	{
		id: 'brief-interface-kind-outside-the-four',
		artifact: 'sealed-evaluator-brief',
		constraint: "an interface kind is AD-19's closed four",
		mutate: (brief) => {
			brief.permittedInterfaces[0].kind = 'grpc'
		},
		issuePath: ['permittedInterfaces', 0, 'kind'],
		issueCode: 'invalid_value',
		keyword: 'enum',
		instancePath: '/permittedInterfaces/0/kind',
	},
	{
		id: 'brief-direction-text-empty',
		artifact: 'sealed-evaluator-brief',
		constraint: 'a generated direction carries prose',
		mutate: (brief) => {
			brief.directions[0].text = ''
		},
		issuePath: ['directions', 0, 'text'],
		issueCode: 'too_small',
		keyword: 'minLength',
		instancePath: '/directions/0/text',
	},
	{
		id: 'brief-principals-absent',
		artifact: 'sealed-evaluator-brief',
		constraint:
			'the brief always answers which principals the caller provisions; `seal` knows the answer, so absent is not one of them (owed item 3)',
		mutate: (brief) => {
			delete brief.principals
		},
		issuePath: ['principals'],
		issueCode: 'invalid_type',
		keyword: 'required',
		instancePath: '',
		errorParams: { missingProperty: 'principals' },
	},
	{
		id: 'brief-principal-name-not-an-identifier',
		artifact: 'sealed-evaluator-brief',
		constraint:
			'a carried principal name is an identifier, and an opaque label at that (AD-18)',
		mutate: (brief) => {
			brief.principals = ['Owner Account']
		},
		issuePath: ['principals', 0],
		issueCode: 'invalid_format',
		keyword: 'pattern',
		instancePath: '/principals/0',
	},
	{
		id: 'brief-probe-step-bound-negative',
		artifact: 'sealed-evaluator-brief',
		constraint: "AD-16's probe-step bound is non-negative or explicit null",
		mutate: (brief) => {
			brief.probeStepBound = -1
		},
		issuePath: ['probeStepBound'],
		issueCode: 'too_small',
		keyword: 'minimum',
		instancePath: '/probeStepBound',
	},

	// ---- rubric -------------------------------------------------------------
	{
		id: 'rubric-id-underpadded',
		artifact: 'rubric',
		constraint: 'an identifier prefix carries three or more digits',
		mutate: (rubric) => {
			rubric.id = 'R-1'
		},
		issuePath: ['id'],
		issueCode: 'invalid_format',
		keyword: 'pattern',
		instancePath: '/id',
	},
	{
		id: 'rubric-max-length-zero',
		artifact: 'rubric',
		constraint: 'a bounded length is at least one, and unbounded is null',
		mutate: (rubric) => {
			rubric.maxLength = 0
		},
		issuePath: ['maxLength'],
		issueCode: 'too_small',
		keyword: 'minimum',
		instancePath: '/maxLength',
	},
	{
		id: 'rubric-criterion-evidence-not-a-pointer',
		artifact: 'rubric',
		constraint: 'criterion evidence is an AD-26 interaction-rooted pointer',
		mutate: (rubric) => {
			rubric.criteria[0].evidence = 'the response body'
		},
		issuePath: ['criteria', 0, 'evidence'],
		issueCode: 'invalid_format',
		keyword: 'pattern',
		instancePath: '/criteria/0/evidence',
	},
]
