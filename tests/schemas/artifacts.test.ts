// Per-artifact behaviour. Each assertion is written so it fails if the property
// it names is removed: the exclusions are asserted as negatives with their
// issue code and path rather than assumed from strictness, and the generated
// shapes are compared against the list they were generated from.

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
	INTERCHANGE_ARTIFACT_KEYS,
	INTERCHANGE_ARTIFACTS,
} from '../../src/core/schemas/artifact.ts'
import { ArtifactReference } from '../../src/core/schemas/artifact-reference.ts'
import { FORBIDDEN_INPUT_FLOOR } from '../../src/core/schemas/eval-contract.ts'
import { EvaluatorConfiguration } from '../../src/core/schemas/evaluator-configuration.ts'
import {
	CheckResolution,
	EvidenceArtifact,
	OUTCOME_STATES,
	SCORING_VERSION_INPUT_NAMES,
	ScoringVersionInputs,
} from '../../src/core/schemas/evidence-artifact.ts'
import { RequestShape } from '../../src/core/schemas/interface.ts'
import { IsolationManifest } from '../../src/core/schemas/isolation-manifest.ts'
import { TRANSPORT_CHANNELS } from '../../src/core/schemas/pointer.ts'
import { PreflightVerdict } from '../../src/core/schemas/preflight-verdict.ts'
import { PROBE_CLASSES, Probe } from '../../src/core/schemas/probe.ts'
import { Rubric, RubricBody } from '../../src/core/schemas/rubric.ts'
import { SealedEvaluatorBrief } from '../../src/core/schemas/sealed-evaluator-brief.ts'
import {
	Finding,
	RUN_MODES,
	SealedRunRecord,
} from '../../src/core/schemas/sealed-run-record.ts'
import {
	ARTIFACT_ACCEPT_FIXTURES,
	cleanControlProbe,
	contractScoringEvidenceArtifact,
	evaluatorConfigurationFixture,
	FINDING_BRANCH_FIXTURES,
	failingPreflightVerdict,
	isolationManifestFixture,
	PROBE_CLASS_FIXTURES,
	preflightVerdictFixture,
	productionEvidenceArtifact,
	sealedEvaluatorBriefFixture,
	sealedRunRecordFixture,
	seededProbe,
	UNION_BRANCH_FIXTURES,
} from './fixtures/artifact-fixtures.ts'

const clone = <T>(value: T): T => structuredClone(value)

const firstIssue = (result: z.ZodSafeParseResult<unknown>) => {
	expect(result.success).toBe(false)
	const issues = result.error?.issues ?? []
	expect(issues).toHaveLength(1)
	return issues[0]
}

describe('the accept corpus', () => {
	it('carries exactly one fixture per registry key', () => {
		expect(Object.keys(ARTIFACT_ACCEPT_FIXTURES).sort()).toEqual(
			[...INTERCHANGE_ARTIFACT_KEYS].sort(),
		)
	})

	it.each(Object.entries(ARTIFACT_ACCEPT_FIXTURES))(
		'%s parses under its own schema',
		(key, fixture) => {
			const result =
				INTERCHANGE_ARTIFACTS[
					key as keyof typeof INTERCHANGE_ARTIFACTS
				].schema.safeParse(fixture)
			expect(result.error?.issues ?? [], key).toEqual([])
			expect(result.success, key).toBe(true)
		},
	)
})

describe('one positive fixture per union branch', () => {
	it.each(UNION_BRANCH_FIXTURES)('$id parses', ({ artifact, value }) => {
		const result =
			INTERCHANGE_ARTIFACTS[
				artifact as keyof typeof INTERCHANGE_ARTIFACTS
			].schema.safeParse(value)
		expect(result.error?.issues ?? []).toEqual([])
	})

	// The other direction: the fixture list is compared against the branch count
	// read off the schemas, so a fourth branch cannot ship unexercised.
	it('covers every branch of every union-rooted artifact', () => {
		for (const [key, entry] of Object.entries(INTERCHANGE_ARTIFACTS)) {
			const options = (entry.schema as any).options
			if (options === undefined) continue
			const covered = UNION_BRANCH_FIXTURES.filter(
				(fixture) => fixture.artifact === key,
			)
			expect(covered, key).toHaveLength(options.length)
		}
	})

	it.each(FINDING_BRANCH_FIXTURES)('$id parses', ({ value }) => {
		expect(Finding.safeParse(value).error?.issues ?? []).toEqual([])
	})

	it('covers every branch of the finding union', () => {
		expect(FINDING_BRANCH_FIXTURES).toHaveLength(
			(Finding as any).options.length,
		)
	})
})

describe('the Evaluator Configuration, where a MISSING field is the requirement', () => {
	// AD-24 excludes the trial index "so trials pool into one scoring version".
	// A test that cannot show the exclusion failing is a gate that fails open,
	// so the code and the path are both asserted.
	it('rejects a trialIndex with unrecognized_keys at the root', () => {
		const issue = firstIssue(
			EvaluatorConfiguration.safeParse({
				...clone(evaluatorConfigurationFixture),
				trialIndex: 1,
			}),
		)
		expect(issue?.code).toBe('unrecognized_keys')
		expect(issue?.path).toEqual([])
	})

	it('keeps the trial index on the Sealed Run Record instead', () => {
		expect(SealedRunRecord.shape.trialIndex).toBeDefined()
		const record = clone(sealedRunRecordFixture) as any
		record.trialIndex = 0
		const issue = firstIssue(SealedRunRecord.safeParse(record))
		expect(issue?.code).toBe('too_small')
		expect(issue?.path).toEqual(['trialIndex'])
	})
})

describe("the Sealed Run Record's run mode, owed item 4's first clause", () => {
	it("carries AD-21's two modes and nothing else", () => {
		expect(RUN_MODES).toEqual(['production', 'contract-scoring'])
		for (const mode of RUN_MODES) {
			const record = { ...clone(sealedRunRecordFixture), mode }
			expect(SealedRunRecord.safeParse(record).error?.issues ?? []).toEqual([])
		}
	})

	// The node type, not only a failing parse: `.default()` and `.catch()` both
	// leave a record with no mode parsing successfully with a mode nobody
	// declared, which is the relabelling the field exists to stop, and neither
	// wrapper is visible from the outside except here.
	it('wraps the enum in no default, optional, or catch', () => {
		expect((SealedRunRecord.shape.mode as any).def.type).toBe('enum')
	})

	// AD-21 wants mode "fixed before ingest". A record presenting none fails to
	// parse, which AD-28 makes a `schema-parse-failure` fault at exit code five;
	// it is never an AD-21 rung and never an AD-5 code, since AD-5 is
	// compile-time only and `compile` never sees a run record.
	it('rejects a record presenting no mode', () => {
		const record = clone(sealedRunRecordFixture) as any
		delete record.mode
		const issue = firstIssue(SealedRunRecord.safeParse(record))
		expect(issue?.code).toBe('invalid_value')
		expect(issue?.path).toEqual(['mode'])
	})

	// The evidence artifact spells its two branch discriminators as literals so
	// a reader sees which branch is which. This is what stops the two spellings
	// drifting apart.
	it("agrees with the evidence artifact's two mode branches", () => {
		const branches = EvidenceArtifact.options.map(
			(branch: any) => branch.shape.mode.value,
		)
		expect(branches).toEqual([...RUN_MODES])
	})
})

describe("the Sealed Run Record's observation sequence, owed item 2's fix", () => {
	it('is a positive integer, wrapped in no default or optional', () => {
		const ObservationSchema = (SealedRunRecord.shape.observations as any)
			.element
		expect(ObservationSchema.shape.sequence.def.type).toBe('number')
		expect(ObservationSchema.shape.sequence.def.format).toBe('safeint')
	})

	it('rejects an observation presenting no sequence', () => {
		const record = clone(sealedRunRecordFixture) as any
		delete record.observations[0].sequence
		const issue = firstIssue(SealedRunRecord.safeParse(record))
		expect(issue?.code).toBe('invalid_type')
		expect(issue?.path).toEqual(['observations', 0, 'sequence'])
	})

	it('rejects a sequence of zero or below', () => {
		const record = clone(sealedRunRecordFixture) as any
		record.observations[0].sequence = 0
		const issue = firstIssue(SealedRunRecord.safeParse(record))
		expect(issue?.code).toBe('too_small')
		expect(issue?.path).toEqual(['observations', 0, 'sequence'])
	})

	// Uniqueness is schema-enforced (owed item 2) as a `.refine()` over the
	// whole array: uniqueness of a nested field across sibling array items has
	// no published-schema keyword, so this half of the constraint is Zod-only
	// (`constraint-ledger.ts`'s `observation-sequence-unique` entry records
	// why).
	it('rejects two observations sharing one sequence', () => {
		const record = clone(sealedRunRecordFixture) as any
		record.observations[1].sequence = record.observations[0].sequence
		const result = SealedRunRecord.safeParse(record)
		expect(result.success).toBe(false)
		const issue = result.error?.issues[0]
		expect(issue?.code).toBe('custom')
		expect(issue?.path).toEqual(['observations'])
	})

	it('accepts observations in any order, as long as every sequence is unique (array position is never read as ordering)', () => {
		const record = clone(sealedRunRecordFixture) as any
		record.observations = [...record.observations].reverse()
		expect(SealedRunRecord.safeParse(record).error?.issues ?? []).toEqual([])
	})
})

describe('the Sealed Evaluator Brief, whose exclusions are the point', () => {
	// AD-16: the brief never carries author commentary, the interaction plan, or
	// the plan's step identifiers. One reject fixture per excluded key, asserting
	// the code and the path. A test that only checks a valid brief parses proves
	// nothing about what the brief keeps out.
	it.each([
		['interactionPlan', [] as unknown],
		['commentary', 'an author note that must never reach the evaluator'],
		['stepId', 'write'],
	])('rejects %s with unrecognized_keys at the root', (key, value) => {
		const issue = firstIssue(
			SealedEvaluatorBrief.safeParse({
				...clone(sealedEvaluatorBriefFixture),
				[key]: value,
			}),
		)
		expect(issue?.code).toBe('unrecognized_keys')
		expect(issue?.path).toEqual([])
	})

	it('carries interface identity and no operation inventory', () => {
		const brief = clone(sealedEvaluatorBriefFixture) as any
		expect(Object.keys(brief.permittedInterfaces[0])).toEqual([
			'logicalId',
			'kind',
		])
		brief.permittedInterfaces[0].operations = []
		const issue = firstIssue(SealedEvaluatorBrief.safeParse(brief))
		expect(issue?.code).toBe('unrecognized_keys')
		expect(issue?.path).toEqual(['permittedInterfaces', 0])
	})

	it('keys a direction by its oracle and never by a step', () => {
		expect(
			Object.keys((SealedEvaluatorBrief.shape.directions as any).element.shape),
		).toEqual(['oracleId', 'text'])
	})
})

describe('the finding union, where AD-23 says "additionally"', () => {
	it('requires quoted evidence on a defect and nowhere else', () => {
		const defect = clone(FINDING_BRANCH_FIXTURES[0].value) as any
		delete defect.quotedEvidence
		expect(Finding.safeParse(defect).success).toBe(false)

		const confirmation = clone(FINDING_BRANCH_FIXTURES[1].value) as any
		confirmation.quotedEvidence = [
			{ quote: 'anything', channel: 'response-body' },
		]
		const issue = firstIssue(Finding.safeParse(confirmation))
		expect(issue?.code).toBe('unrecognized_keys')
	})

	it('requires at least one cited observation on a defect', () => {
		const defect = clone(FINDING_BRANCH_FIXTURES[0].value) as any
		defect.observationIds = []
		const issue = firstIssue(Finding.safeParse(defect))
		expect(issue?.code).toBe('too_small')
		expect(issue?.path).toEqual(['observationIds'])
	})

	// AD-23's word is *additionally*: a floor on `defect`, never a prohibition
	// elsewhere. The architecture's own worked record carries observation
	// identifiers on a confirmation and on an observation finding.
	it.each([1, 2])(
		'admits cited observations on branch %i, which is not a defect',
		(index) => {
			const finding = clone(FINDING_BRANCH_FIXTURES[index]?.value) as any
			expect(finding.observationIds.length).toBeGreaterThan(0)
			expect(Finding.safeParse(finding).error?.issues ?? []).toEqual([])
			finding.observationIds = []
			expect(Finding.safeParse(finding).error?.issues ?? []).toEqual([])
		},
	)

	it('requires a probe on every branch and admits a null oracle', () => {
		for (const { id, value } of FINDING_BRANCH_FIXTURES) {
			const finding = clone(value) as any
			delete finding.probeId
			expect(Finding.safeParse(finding).success, id).toBe(false)
			const uncited = clone(value) as any
			uncited.oracleId = null
			expect(Finding.safeParse(uncited).error?.issues ?? [], id).toEqual([])
		}
	})
})

describe("the isolation manifest's forbidden-input accounting", () => {
	const accountingShape = (
		IsolationManifest.shape.forbiddenInputAccounting as any
	).shape

	it('is generated from the floor, so its keys are the floor', () => {
		expect(Object.keys(accountingShape)).toEqual([...FORBIDDEN_INPUT_FLOOR])
		expect(Object.keys(accountingShape)).toHaveLength(7)
	})

	it.each(FORBIDDEN_INPUT_FLOOR)('rejects a manifest omitting %s', (member) => {
		const manifest = clone(isolationManifestFixture) as any
		delete manifest.forbiddenInputAccounting[member]
		const issue = firstIssue(IsolationManifest.safeParse(manifest))
		expect(issue?.code).toBe('invalid_type')
		expect(issue?.path).toEqual(['forbiddenInputAccounting', member])
	})

	// AD-16 makes a prohibited input an invalidating condition at ingest, not a
	// parse failure, so the disclosure has to parse.
	it('admits withheld:false on every member', () => {
		const manifest = clone(isolationManifestFixture) as any
		for (const member of FORBIDDEN_INPUT_FLOOR) {
			manifest.forbiddenInputAccounting[member] = {
				withheld: false,
				note: 'disclosed',
			}
		}
		expect(IsolationManifest.safeParse(manifest).error?.issues ?? []).toEqual(
			[],
		)
	})

	// A strict object rather than a record over the enum, so the export carries a
	// `required` array the non-TypeScript consumer AD-13 protects can read.
	it('exports a required array rather than propertyNames', () => {
		const document = z.toJSONSchema(IsolationManifest, { io: 'input' }) as any
		const accounting = document.properties.forbiddenInputAccounting
		expect(accounting.propertyNames).toBeUndefined()
		expect(accounting.additionalProperties).toBe(false)
		expect([...accounting.required].sort()).toEqual(
			[...FORBIDDEN_INPUT_FLOOR].sort(),
		)
	})

	it('carries all sixteen prior-art members, violation included', () => {
		const priorArtRequired = [
			'runId',
			'contractId',
			'conditionArm',
			'modelSnapshot',
			'systemPromptDigest',
			'contractDigest',
			'workspaceIdentity',
			'allowedMounts',
			'observedMounts',
			'networkAllowlist',
			'observedNetworkTargets',
			'toolAllowlist',
			'observedToolCalls',
			'resourceCeilings',
			'actualResourceUse',
			'violation',
		]
		expect(priorArtRequired).toHaveLength(16)
		for (const field of priorArtRequired) {
			expect((IsolationManifest.shape as any)[field], field).toBeDefined()
		}
	})
})

describe("the probe's expectedClean union", () => {
	it('forbids a seeded defect on a known-clean control', () => {
		const probe = clone(cleanControlProbe) as any
		probe.defects = [clone(seededProbe).defects[0]]
		const issue = firstIssue(Probe.safeParse(probe))
		expect(issue?.code).toBe('too_big')
		expect(issue?.path).toEqual(['defects'])
	})

	// A canary indicts the fixture rather than seeding a defect, so the
	// not-clean branch carries no minimum.
	it('admits an empty defect list on the not-clean branch', () => {
		const probe = clone(seededProbe) as any
		probe.defects = []
		expect(Probe.safeParse(probe).error?.issues ?? []).toEqual([])
	})

	it('parses a boolean discriminator in both directions', () => {
		expect(Probe.safeParse(seededProbe).success).toBe(true)
		expect(Probe.safeParse(cleanControlProbe).success).toBe(true)
	})

	// AD-9 closes the class set at four, and AD-7 reads two of them as the
	// exclusions from the strength vector. A class value no test parses is a
	// class nobody has checked.
	it.each(PROBE_CLASS_FIXTURES)('$id parses', ({ probeClass, value }) => {
		const result = Probe.safeParse(value)
		expect(result.error?.issues ?? []).toEqual([])
		expect((value as { probeClass: string }).probeClass).toBe(probeClass)
	})

	it('exercises every member of the closed class set', () => {
		expect(
			PROBE_CLASS_FIXTURES.map((entry) => entry.probeClass).sort(),
		).toEqual([...PROBE_CLASSES].sort())
	})
})

describe("the evidence artifact's vocabularies", () => {
	it("holds AD-6's closed twelve outcome states", () => {
		expect(OUTCOME_STATES).toHaveLength(12)
		expect(new Set(OUTCOME_STATES).size).toBe(12)
	})

	// AD-11 chose a named object over a concatenated tuple because revision 1
	// "let two conforming scorers compute different versions from identical
	// inputs". If the enum and the object disagree, the published pre-image does
	// not reproduce the published digest.
	it("keys callerAttestedInputs by exactly the scoring version's five fields", () => {
		expect(Object.keys(ScoringVersionInputs.shape)).toEqual([
			...SCORING_VERSION_INPUT_NAMES,
		])
		expect(SCORING_VERSION_INPUT_NAMES).toHaveLength(5)
	})

	it('rejects a caller-attested input that is not one of the five', () => {
		const artifact = clone(contractScoringEvidenceArtifact) as any
		artifact.callerAttestedInputs = ['scoringVersion']
		const issue = firstIssue(EvidenceArtifact.safeParse(artifact))
		expect(issue?.code).toBe('invalid_value')
		expect(issue?.path).toEqual(['callerAttestedInputs', 0])
	})

	// AD-7: "Canary probes and clean controls never enter the vector", so the
	// fourth class has no key at all and its absence is structural.
	it('keys the strength vector by three classes and not four', () => {
		const document = z.toJSONSchema(EvidenceArtifact, { io: 'input' }) as any
		const vector = document.oneOf[0].properties.strength.properties.vector
		expect(Object.keys(vector.properties)).toEqual([
			'defect',
			'gameability',
			'zero-action',
		])
		expect(Object.keys(vector.properties)).not.toContain('canary')
	})

	it('recurses through checkResolution rather than stopping at one node', () => {
		const nested = {
			resolution: 'insufficient-evidence',
			introductionCondition: 'empty-collection',
			children: [
				{
					resolution: 'true',
					introductionCondition: null,
					children: [
						{ resolution: 'false', introductionCondition: null, children: [] },
					],
				},
			],
		}
		expect(CheckResolution.safeParse(nested).error?.issues ?? []).toEqual([])
		const broken = structuredClone(nested) as any
		broken.children[0].children[0].resolution = 'maybe'
		expect(CheckResolution.safeParse(broken).success).toBe(false)
	})

	// AD-21: "the two verdicts never share a field", expressed structurally.
	// Asserted as `unrecognized_keys` in both directions instead of as a bare
	// failure: flipping the mode alone also drops the branch's own verdict field,
	// so a plain `success === false` stays green even if the branches regressed to
	// sharing both verdicts.
	it('refuses a production verdict on the contract-scoring branch', () => {
		const issue = firstIssue(
			EvidenceArtifact.safeParse({
				...clone(contractScoringEvidenceArtifact),
				productionVerdict: 'FAIL',
			}),
		)
		expect(issue?.code).toBe('unrecognized_keys')
		expect(issue?.path).toEqual([])
	})

	it('refuses a contract verdict on the production branch', () => {
		const issue = firstIssue(
			EvidenceArtifact.safeParse({
				...clone(productionEvidenceArtifact),
				contractVerdict: 'CONCERNS',
			}),
		)
		expect(issue?.code).toBe('unrecognized_keys')
		expect(issue?.path).toEqual([])
	})

	// WAIVED is the one member separating `Verdict` from
	// `EvaluatorRecommendation`, and it was reject-tested only through the run
	// record's `NOT_APPLICABLE` case. An evaluator never recommends a waiver.
	it('refuses WAIVED as a recorded system recommendation', () => {
		const issue = firstIssue(
			EvidenceArtifact.safeParse({
				...clone(contractScoringEvidenceArtifact),
				systemRecommendationRecorded: 'WAIVED',
			}),
		)
		expect(issue?.code).toBe('invalid_value')
		expect(issue?.path).toEqual(['systemRecommendationRecorded'])
	})

	// AD-21 pins the exit code to the verdict. The agreement is a cross-field
	// rule the schema admits, so this checks that the fixtures obey it. A fixture
	// pairing FAIL with zero would teach the wrong rule to anyone reading the
	// corpus for an example.
	it('pairs each fixture verdict with the exit code AD-21 assigns it', () => {
		expect(productionEvidenceArtifact.mode).toBe('production')
		expect(productionEvidenceArtifact.exitCode).toBe(2)
		expect(contractScoringEvidenceArtifact.exitCode).toBe(0)
	})
})

describe('the pre-flight verdict, in the state it exists to report', () => {
	// AD-10 makes a failed pre-flight invalidate the run rather than become a
	// contract verdict, so the failing shape has to parse as readily as the
	// passing one. Nothing was parsing it.
	it('parses a failing verdict and its failed checks', () => {
		const result = PreflightVerdict.safeParse(failingPreflightVerdict)
		expect(result.error?.issues ?? []).toEqual([])
		expect(failingPreflightVerdict.passed).toBe(false)
		expect(
			failingPreflightVerdict.checks.every(
				(check) => check.outcome === 'failed',
			),
		).toBe(true)
	})

	it('covers all three outcomes across the two fixtures', () => {
		const outcomes = new Set(
			[
				...preflightVerdictFixture.checks,
				...failingPreflightVerdict.checks,
			].map((check) => check.outcome),
		)
		expect([...outcomes].sort()).toEqual(['exempt', 'failed', 'satisfied'])
	})
})

describe('the published Rubric', () => {
	it('is the body plus the three lineage fields and nothing else', () => {
		expect(Object.keys(Rubric.shape).sort()).toEqual(
			[
				...Object.keys(RubricBody.shape),
				'schemaVersion',
				'parentDigest',
				'revisionCount',
			].sort(),
		)
	})

	it('gives the shared body a stable $defs name inside the contract', () => {
		const document = z.toJSONSchema(
			INTERCHANGE_ARTIFACTS['eval-contract'].schema,
			{ io: 'input' },
		) as any
		expect(Object.keys(document.$defs)).toContain('RubricBody')
		expect(document.properties.rubrics.items.$ref).toBe('#/$defs/RubricBody')
	})

	it('spreads the body flat rather than nesting it', () => {
		const document = z.toJSONSchema(Rubric, { io: 'input' }) as any
		expect(document.$defs).toBeUndefined()
		expect(document.properties.criteria).toBeDefined()
	})
})

describe('the shared vocabularies, derived rather than rebuilt', () => {
	// `RequestShape` is not regenerated from TRANSPORT_CHANNELS: its `header` key
	// carries a published AD-18 statement a generated loop would delete, changing
	// the EvalContract export bytes. The key set is asserted instead.
	it('keeps RequestShape hand-written and agreeing with the transport enum', () => {
		expect(Object.keys(RequestShape.shape)).toEqual([...TRANSPORT_CHANNELS])
		const requestShape = z.toJSONSchema(RequestShape, { io: 'input' }) as any
		expect(requestShape.properties.header.description).toContain(
			'never carries a credential value',
		)
	})

	it("keys an observation's call inputs by the same four channels", () => {
		const callInputs = (SealedRunRecord.shape.observations as any).element.shape
			.callInputs
		expect(Object.keys(callInputs.shape)).toEqual([...TRANSPORT_CHANNELS])
	})

	// The worked example's flat `callInputs: { id: "n-1" }` does not survive.
	it("rejects the flat call-inputs spelling AD-26 records as revision 3's defect", () => {
		const record = clone(sealedRunRecordFixture) as any
		record.observations[0].callInputs = { id: 'n-1' }
		expect(SealedRunRecord.safeParse(record).success).toBe(false)
	})
})

describe("the reference shape's exemption", () => {
	it('parses with no schemaVersion and rejects one', () => {
		const reference = {
			storage: 'public',
			path: 'evidence/a.json',
			privateRef: null,
			digest: `sha256:${'0'.repeat(64)}`,
		}
		expect(ArtifactReference.safeParse(reference).error?.issues ?? []).toEqual(
			[],
		)
		const issue = firstIssue(
			ArtifactReference.safeParse({ ...reference, schemaVersion: 1 }),
		)
		expect(issue?.code).toBe('unrecognized_keys')
	})
})
