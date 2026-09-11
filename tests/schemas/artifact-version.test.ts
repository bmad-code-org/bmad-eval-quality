/**
 * What holds the eight artifact `schemaVersion` constants, now that each one
 * is declared beside the schema it names and exported from the barrel.
 *
 * The number is readable from no value. `lineage.ts` keeps `schemaVersion` a
 * plain `z.int().min(1)` so a stale artifact fails as AD-28's
 * `schema-version-mismatch` rather than as an anonymous parse error, which
 * means no schema object, no published JSON Schema document, and no `.meta()`
 * field carries the accepted version. A constant compared against a second
 * transcription of itself is what `CONFORMANCE_OUTCOME_COUNTS` does, and two
 * of its six entries drifted from their runners because nothing linked them.
 *
 * So each constant is held two ways here, neither of them a copy of the
 * number:
 *
 * The source walk reads every authored artifact literal under `src`, `tests`
 * and `scripts` and holds its stamp against the constant. It found
 * `score.test.ts`'s scoring policy stamped 1 while carrying the version-2
 * shape.
 *
 * The parse-behaviour cases hold the constant against the parser, for the six
 * artifacts that have a predecessor shape. A shape built at the constant parses
 * and one built at the constant minus one does not, and both are built from the
 * constant: a schema change that forgets the constant leaves the shape the
 * constant names unparseable, and a bump with no case for the new N-1 leaves
 * the builder with nothing to build.
 *
 * Every version-N case is built from a frozen literal declared in this file,
 * and the freezing is the whole method. These literals are annotated
 * `Readonly<Record<string, unknown>>`, so the typechecker has no way to drag
 * one along when its schema moves, and the literal for version N stays where it
 * is while the schema goes somewhere else. That is what makes the case an
 * independent witness. A case that spreads a typed fixture witnesses nothing:
 * `npm run typecheck` runs inside `validate`, so adding a required field to an
 * artifact forces the fixture to move in the same commit, the version-N case
 * then builds from the moved fixture, and it parses with the constant left
 * where it was. Refactoring these literals back into a fixture spread as a
 * tidy-up takes the method with it, and the only failure left would be a
 * runtime-only constraint the typechecker cannot see, such as a `.min(1)`.
 *
 * The residual: a breaking shape change that edits the builder's case for N to
 * the new shape in the same commit and does not bump N passes everything. No
 * gate reading only behaviour can catch that, because at that point nothing
 * outside the change knows what the version ought to be.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildSkillExampleChain } from '../../scripts/skill-example-target.ts'
import { buildWorkedExampleChain } from '../../scripts/worked-example-target.ts'
import { buildWorkflowExampleChain } from '../../scripts/workflow-example-target.ts'
import {
	EVAL_CONTRACT_SCHEMA_VERSION,
	EvalContract,
} from '../../src/core/schemas/eval-contract.ts'
import { EVALUATOR_CONFIGURATION_SCHEMA_VERSION } from '../../src/core/schemas/evaluator-configuration.ts'
import {
	EVIDENCE_ARTIFACT_SCHEMA_VERSION,
	EvidenceArtifact,
} from '../../src/core/schemas/evidence-artifact.ts'
import { ISOLATION_MANIFEST_SCHEMA_VERSION } from '../../src/core/schemas/isolation-manifest.ts'
import { PREFLIGHT_VERDICT_SCHEMA_VERSION } from '../../src/core/schemas/preflight-verdict.ts'
import { PRIVATE_ARTIFACT_MANIFEST_SCHEMA_VERSION } from '../../src/core/schemas/private-artifact-manifest.ts'
import { PROBE_SCHEMA_VERSION, Probe } from '../../src/core/schemas/probe.ts'
import {
	SCORING_POLICY_SCHEMA_VERSION,
	ScoringPolicy,
} from '../../src/core/schemas/scoring-policy.ts'
import {
	SEALED_EVALUATOR_BRIEF_SCHEMA_VERSION,
	SealedEvaluatorBrief,
} from '../../src/core/schemas/sealed-evaluator-brief.ts'
import {
	SEALED_RUN_RECORD_SCHEMA_VERSION,
	SealedRunRecord,
} from '../../src/core/schemas/sealed-run-record.ts'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

type ArtifactEntry = {
	/** the constant, read from the module that declares it beside its schema. */
	readonly version: number
	/**
	 * How many authored literals the source walk has to find for this artifact.
	 * A floor of one per artifact was what this walk fell to when it generalised
	 * from `eval-contract-version.test.ts`, and that file's own history is why a
	 * floor of one is not enough: three of its contracts sat at a stale stamp for
	 * two versions, and the walk it carried asserted more than five EvalContract
	 * literals for exactly that reason. A regex that stops matching one authoring
	 * form takes a count from six to one and leaves every case green.
	 */
	readonly minimumLiterals: number
}

/**
 * Every artifact with a version constant, keyed by the type name an authored
 * literal is annotated with. The ten are the eight this story declares plus
 * the two Story 12.1 exported, so one walk covers every constant rather than
 * each file walking the tree for its own.
 */
const VERSION_BY_ARTIFACT_TYPE: Readonly<Record<string, ArtifactEntry>> = {
	EvalContract: { version: EVAL_CONTRACT_SCHEMA_VERSION, minimumLiterals: 6 },
	EvaluatorConfiguration: {
		version: EVALUATOR_CONFIGURATION_SCHEMA_VERSION,
		minimumLiterals: 1,
	},
	EvidenceArtifact: {
		version: EVIDENCE_ARTIFACT_SCHEMA_VERSION,
		minimumLiterals: 1,
	},
	IsolationManifest: {
		version: ISOLATION_MANIFEST_SCHEMA_VERSION,
		minimumLiterals: 1,
	},
	PreflightVerdict: {
		version: PREFLIGHT_VERDICT_SCHEMA_VERSION,
		minimumLiterals: 1,
	},
	PrivateArtifactManifest: {
		version: PRIVATE_ARTIFACT_MANIFEST_SCHEMA_VERSION,
		minimumLiterals: 1,
	},
	Probe: { version: PROBE_SCHEMA_VERSION, minimumLiterals: 1 },
	ScoringPolicy: { version: SCORING_POLICY_SCHEMA_VERSION, minimumLiterals: 1 },
	SealedEvaluatorBrief: {
		version: SEALED_EVALUATOR_BRIEF_SCHEMA_VERSION,
		minimumLiterals: 1,
	},
	SealedRunRecord: {
		version: SEALED_RUN_RECORD_SCHEMA_VERSION,
		minimumLiterals: 1,
	},
}

const ARTIFACT_TYPES = Object.keys(VERSION_BY_ARTIFACT_TYPE)

/** the type name as this repository spells the artifact in a file name. */
const artifactNameOf = (type: string): string =>
	type.replace(/(?<!^)([A-Z])/g, '-$1').toLowerCase()

// ---------------------------------------------------------------------------
// the source walk
// ---------------------------------------------------------------------------

const ROOTS = ['src', 'tests', 'scripts']

const sourceFiles = (directory: string): readonly string[] => {
	const found: string[] = []
	const walk = (current: string): void => {
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			const full = join(current, entry.name)
			if (entry.isDirectory()) walk(full)
			else if (entry.name.endsWith('.ts')) found.push(full)
		}
	}
	walk(join(repoRoot, directory))
	return found
}

/**
 * The index of the `}` closing the `{` at `open`, or `-1`.
 *
 * A literal's own body is the bound that matters. An earlier version of this
 * walk read a fixed window forward from the annotation and reported three
 * literals stale that were not: each spreads a base and carries no stamp of
 * its own, so the window ran past the closing brace and read the next
 * artifact's stamp. Quoted text and comments are skipped because both carry
 * braces; a template's `${` and its `}` balance, so they need no case.
 */
const matchingBrace = (text: string, open: number): number => {
	let depth = 0
	for (let i = open; i < text.length; i += 1) {
		const character = text[i]
		const next = text[i + 1]
		if (character === '/' && next === '/') {
			const end = text.indexOf('\n', i)
			if (end === -1) return -1
			i = end
			continue
		}
		if (character === '/' && next === '*') {
			const end = text.indexOf('*/', i + 2)
			if (end === -1) return -1
			i = end + 1
			continue
		}
		if (character === "'" || character === '"' || character === '`') {
			for (i += 1; i < text.length; i += 1) {
				if (text[i] === '\\') {
					i += 1
					continue
				}
				if (text[i] === character) break
			}
			continue
		}
		if (character === '{') depth += 1
		else if (character === '}') {
			depth -= 1
			if (depth === 0) return i
		}
	}
	return -1
}

/**
 * The three annotation forms a literal wears in this tree: an explicit type on
 * the binding or on an arrow's return, a `satisfies` clause, and a parse call
 * taking the literal directly. The `satisfies` form is read for the artifact
 * name anywhere in the type expression, since `artifact-fixtures.ts` writes the
 * evidence artifact's only authored literal as
 * `satisfies Omit<Extract<EvidenceArtifact, ...>, ...>`.
 *
 * The parse form is what the walk was blind to. `worked-example-shared.ts`
 * declares the policy every committed chain is scored under as
 * `ScoringPolicy.parse({ schemaVersion: 2, ... })`, and nothing else held that
 * site: the value is validated against a schema that takes any positive
 * integer, it is not an emitted chain file, and the parse-behaviour case builds
 * from a literal of its own. The form is added to the walk, so the next literal
 * authored that way is walked too; annotating that one site would have held
 * that one site.
 */
const ANNOTATED = new RegExp(
	`:\\s*(${ARTIFACT_TYPES.join('|')})\\s*(?:=\\s*\\{|=>\\s*\\(\\{)`,
	'g',
)
const SATISFIES = /\}\s*satisfies\s+/g
const PARSED = new RegExp(
	`\\b(${ARTIFACT_TYPES.join('|')})\\.parse\\(\\s*\\{`,
	'g',
)

/**
 * The stamp a literal carries in its own body, wherever the key sits.
 *
 * Line position is not a bound. An anchored pattern requiring the key to start
 * a line and carry a trailing comma reads neither a single-line literal nor one
 * whose `schemaVersion` is the final property, and it counted both as literals
 * that spread a base, which skips them in silence. The value is captured whole
 * and classified below, so a stamp reading a constant is told apart from one
 * the walk could not read at all.
 */
const STAMP = /[{\s]schemaVersion:\s*([^,\n}]*)/

type Literal = {
	readonly artifactType: string
	readonly open: number
	readonly close: number
}

/**
 * The type expression a `satisfies` clause names, read from `from`.
 *
 * Two bounds, and both are load-bearing. It stops at the first character no
 * type expression carries, which is what reads `Omit<Extract<EvidenceArtifact,
 * { mode: 'production' }>, ...>` as far as the artifact name. And at bracket
 * depth zero it stops at the newline: a character class admitting whitespace
 * runs past the clause until it meets a character outside the class, so a
 * following statement naming a second artifact type makes the clause name two
 * and the literal is dropped with no failure and no count.
 */
const typeExpressionAt = (text: string, from: number): string => {
	let depth = 0
	for (let i = from; i < text.length; i += 1) {
		const character = text[i] as string
		if (character === '<') depth += 1
		else if (character === '>') depth -= 1
		else if (character === '\n' && depth <= 0) return text.slice(from, i)
		else if (!/[\w,'|\s]/.test(character)) return text.slice(from, i)
	}
	return text.slice(from)
}

const literalsIn = (text: string): readonly Literal[] => {
	const found: Literal[] = []
	for (const match of [...text.matchAll(ANNOTATED), ...text.matchAll(PARSED)]) {
		const open = text.indexOf('{', match.index ?? 0)
		found.push({
			artifactType: match[1] as string,
			open,
			close: matchingBrace(text, open),
		})
	}
	for (const match of text.matchAll(SATISFIES)) {
		const close = match.index ?? 0
		const expression = typeExpressionAt(
			text,
			close + (match[0] as string).length,
		)
		const named = ARTIFACT_TYPES.filter((type) =>
			new RegExp(`\\b${type}\\b`).test(expression),
		)
		// A clause naming two artifacts says which shape is being satisfied for
		// neither of them, so it is left to the annotation forms above.
		if (named.length !== 1) continue
		let open = -1
		for (let i = close - 1; i >= 0; i -= 1) {
			if (text[i] === '{' && matchingBrace(text, i) === close) {
				open = i
				break
			}
		}
		if (open === -1) continue
		found.push({ artifactType: named[0] as string, open, close })
	}
	return found
}

describe('no authored artifact literal carries a stale stamp', () => {
	const stale: string[] = []
	const unmatched: string[] = []
	const unreadable: string[] = []
	const checked = new Map<string, number>()

	for (const directory of ROOTS) {
		for (const file of sourceFiles(directory)) {
			const text = readFileSync(file, 'utf8')
			for (const literal of literalsIn(text)) {
				const where = `${relative(repoRoot, file)}:${
					text.slice(0, literal.open).split('\n').length
				}`
				if (literal.close === -1) {
					unmatched.push(`${where}: ${literal.artifactType}`)
					continue
				}
				const stamp = STAMP.exec(text.slice(literal.open, literal.close))
				// A literal that spreads a base carries no stamp of its own and
				// inherits whatever the base was held to.
				if (stamp === null) continue
				const value = (stamp[1] as string).trim()
				// A stamp that reads the constant cannot go stale, so there is
				// nothing to compare; it still counts as a literal this walk reached.
				const named = /^[A-Z][A-Z0-9_]*$/.test(value)
				if (!named && !/^\d+$/.test(value)) {
					unreadable.push(
						`${where}: ${literal.artifactType} schemaVersion ${value}`,
					)
					continue
				}
				checked.set(
					literal.artifactType,
					(checked.get(literal.artifactType) ?? 0) + 1,
				)
				if (named) continue
				const expected = (
					VERSION_BY_ARTIFACT_TYPE[literal.artifactType] as ArtifactEntry
				).version
				if (Number(value) !== expected) {
					stale.push(
						`${where}: ${literal.artifactType} schemaVersion ${value}, and the constant reads ${expected}`,
					)
				}
			}
		}
	}

	it('reads every literal it finds to a matching close brace', () => {
		expect(unmatched).toEqual([])
	})

	// The third state, split out from the two legitimate ones. A literal that
	// spreads a base and a literal stamped with the constant are both held; a
	// literal whose stamp this walk cannot read is held by nothing, and
	// collapsing all three into one skip is how a stamp stops being walked
	// without anything failing.
	it('reads the stamp of every literal that carries one', () => {
		expect(unreadable).toEqual([])
	})

	it('finds no stale stamp', () => {
		expect(stale).toEqual([])
	})

	// One floor per artifact, since a regex that stops matching one artifact's
	// form takes that artifact's coverage to zero and leaves a total over the
	// whole walk looking healthy, which is how a walk goes quiet. Each floor is
	// the artifact's own, for the reason `ArtifactEntry` records.
	it.each(ARTIFACT_TYPES)('walks the %s literals it has to', (artifactType) => {
		const entry = VERSION_BY_ARTIFACT_TYPE[artifactType] as ArtifactEntry
		expect(checked.get(artifactType) ?? 0).toBeGreaterThanOrEqual(
			entry.minimumLiterals,
		)
	})

	// `VERSION_BY_ARTIFACT_TYPE` is hand-written, so a constant exported
	// tomorrow and left out of it would be walked by nothing while every case
	// above stayed green. The barrel is the derived side: a name it publishes
	// as `<ARTIFACT>_SCHEMA_VERSION` is a version a caller can read, and every
	// one of them has to be in the map. Read off the barrel's source text so
	// this needs no build, the way the barrel census reads it.
	//
	// Any `export { ... }` block, since the formatter wraps a multi-specifier
	// export across lines and a one-line single-specifier pattern reads none of
	// those. The two sides are asserted equal: a floor over the size of a whole
	// census is the failure this file names a few lines above, and it would pass
	// here on one matched name out of ten.
	it('walks every `_SCHEMA_VERSION` the barrel exports', () => {
		const barrel = readFileSync(join(repoRoot, 'src/index.ts'), 'utf8')
		const exported = [
			...barrel.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s*from/g),
		].flatMap((match) =>
			[...(match[1] as string).matchAll(/[A-Z][A-Z0-9_]*_SCHEMA_VERSION/g)].map(
				(name) => name[0],
			),
		)
		const mapped = ARTIFACT_TYPES.map(
			(type) =>
				`${type.replace(/(?<!^)([A-Z])/g, '_$1').toUpperCase()}_SCHEMA_VERSION`,
		)
		expect([...exported].sort()).toEqual([...mapped].sort())
	})
})

// ---------------------------------------------------------------------------
// the emitted bytes
// ---------------------------------------------------------------------------

// The literals above are what a reader can see; these are what the builders
// actually emit, since a builder could stamp a value on its way out. The three
// committed chains carry the brief, the record, the evidence artifact, the
// probe and the contract, and the spike chain alone carries a preflight
// verdict. No chain exposes an isolation manifest, an evaluator configuration,
// a private artifact manifest or a scoring policy, so for three of the four
// version-1 artifacts the source walk is the whole holding.
describe('every emitted artifact carries the current version', () => {
	const chains = [
		['spike worked example', buildWorkedExampleChain()],
		['skill defect', buildSkillExampleChain()],
		['workflow capture', buildWorkflowExampleChain()],
	] as const

	it.each(chains)('%s', (_label, chain) => {
		expect(chain.brief.schemaVersion).toBe(
			SEALED_EVALUATOR_BRIEF_SCHEMA_VERSION,
		)
		expect(chain.record.schemaVersion).toBe(SEALED_RUN_RECORD_SCHEMA_VERSION)
		expect(chain.artifact.schemaVersion).toBe(EVIDENCE_ARTIFACT_SCHEMA_VERSION)
		expect(chain.probe.schemaVersion).toBe(PROBE_SCHEMA_VERSION)
		expect(chain.contract.schemaVersion).toBe(EVAL_CONTRACT_SCHEMA_VERSION)
		if ('preflightVerdict' in chain) {
			expect(chain.preflightVerdict.schemaVersion).toBe(
				PREFLIGHT_VERDICT_SCHEMA_VERSION,
			)
		}
	})

	// The conditional above is the verdict constant's only emitted-bytes
	// holding, and it skips in silence: rename the key or stop exposing it and
	// every chain takes the empty branch with nothing failing.
	it('at least one chain carries a preflight verdict', () => {
		expect(
			chains.some(([, chain]) => 'preflightVerdict' in chain),
			'no committed chain exposes `preflightVerdict`, so the emitted-bytes case for PREFLIGHT_VERDICT_SCHEMA_VERSION runs over nothing',
		).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// the parser
// ---------------------------------------------------------------------------

// The shapes the parse-behaviour cases are built from, one per artifact that
// has moved at least once, each frozen at the version it is named for.
//
// Frozen means annotated `Readonly<Record<string, unknown>>` and written out
// here. The fixtures in `artifact-fixtures.ts` carry an explicit schema-derived
// type, so the typechecker moves them in the same commit as the schema, and a
// case built by spreading one restates the current shape while saying nothing
// about the version it is named for. Each literal here is the smallest shape
// its version accepts: a version gate asks whether the floor still parses, and
// the branch coverage the fixtures carry is a different question answered in a
// different file.
//
// These literals stamp a version the source walk above cannot see, since none
// of them is annotated with an artifact type. That is the same freezing: a
// literal the walk moved with the constant would be a copy of the constant.

/** AD-27's rendered form, at the ordinal `digestOf` spells as zero. */
const DIGEST = `sha256:${'0'.repeat(64)}`

const ARTIFACT_REFERENCE = {
	storage: 'public',
	path: 'evidence/actions-0001.jsonl',
	privateRef: null,
	digest: DIGEST,
}

const SEALED_RUN_RECORD_AT_6: Readonly<Record<string, unknown>> = {
	schemaVersion: 6,
	parentDigest: null,
	revisionCount: 0,
	runId: 'version-witness-run',
	conditionArm: 'independent',
	mode: 'production',
	trialIndex: 1,
	contractDigest: DIGEST,
	sealedBriefDigest: DIGEST,
	evaluatorConfigurationDigest: DIGEST,
	evaluatorRecommendation: 'FAIL',
	oracleDispositions: [],
	findings: [],
	observations: [],
	judgeResults: [],
	actionsArtifact: ARTIFACT_REFERENCE,
	isolationManifestArtifact: ARTIFACT_REFERENCE,
	resourceUse: {
		toolCalls: 0,
		inputTokens: 0,
		outputTokens: 0,
		wallClockSeconds: 0,
		costUsd: '0',
	},
	evidenceDisclosure: { truncationBound: null, reportedIncomplete: false },
}

const SEALED_EVALUATOR_BRIEF_AT_2: Readonly<Record<string, unknown>> = {
	schemaVersion: 2,
	parentDigest: null,
	revisionCount: 0,
	contractDigest: DIGEST,
	behaviors: [
		{
			id: 'B-001',
			description: 'An update that reports success has persisted.',
			severity: 'critical',
			observableSuccessCriterion: null,
			requirementLinks: [],
			riskLinks: [],
			oracles: [],
		},
	],
	directions: [
		{
			oracleId: 'O-001',
			text: 'Establish whether the value you obtained after a successful update reflects what you sent.',
		},
	],
	permittedInterfaces: [],
	scopedResources: [],
	principals: [],
	budgets: { maxToolCalls: 0, maxWallClockMinutes: 0, maxCostUsd: '0' },
	safetyLimits: [],
	probeStepBound: null,
}

const EVIDENCE_ARTIFACT_AT_3: Readonly<Record<string, unknown>> = {
	schemaVersion: 3,
	parentDigest: null,
	revisionCount: 0,
	runId: 'version-witness-run',
	scoringVersion: DIGEST,
	scoringVersionInputs: {
		// The contract's stamp, which this schema takes as any positive integer.
		// It names another artifact's version and is frozen here with everything
		// else, so it reads no constant.
		contractSchemaVersion: 1,
		corpusDigest: DIGEST,
		fixtureDigest: DIGEST,
		evaluatorConfigurationDigest: DIGEST,
		scoringPolicyDigest: DIGEST,
		mode: 'contract-scoring',
	},
	comparabilityKey: DIGEST,
	excludedProbeIds: [],
	exitCode: 0,
	verdictBasis: [],
	callerAttestedInputs: [],
	trials: { declaredMinimum: 1, completed: 0, invalidatedAttempts: [] },
	outcomes: [],
	uncitedFindings: [],
	coverageGaps: [],
	strength: {
		denominator: 'unique qualified probe identifiers exercised per class',
		basis: 'measured',
		vector: { defect: null, gameability: null, 'zero-action': null },
		comparable: false,
		note: null,
	},
	remediation: {
		revisionCount: 0,
		cap: 0,
		capSource: 'caller-attested',
		lineageChain: {
			lengthConsistent: true,
			noRepeatedDigest: true,
			noGap: true,
		},
	},
	mode: 'contract-scoring',
	contractVerdict: 'CONCERNS',
	uncitedFindingGaps: [],
	systemRecommendationRecorded: 'FAIL',
	systemRecommendationNote: null,
}

const SCORING_POLICY_AT_2: Readonly<Record<string, unknown>> = {
	schemaVersion: 2,
	parentDigest: null,
	revisionCount: 0,
	policyId: 'version-witness-policy',
	severityFloor: 'material',
	confidenceThreshold: 0.7,
	catchThreshold: 0.5,
	minimumTrialCount: 3,
	reExecutionCap: 2,
	remediationCap: 3,
	regexMatchStepBudget: 1000000,
}

const PROBE_AT_5: Readonly<Record<string, unknown>> = {
	schemaVersion: 5,
	parentDigest: null,
	revisionCount: 0,
	probeId: 'P-001',
	probeClass: 'defect',
	expectedClean: false,
	behaviorId: 'B-001',
	systemId: 'notes-api',
	implementationDigest: DIGEST,
	artifactDigest: DIGEST,
	commitDigest: DIGEST,
	rationale: 'A controlled mutation seeding a lost-update defect.',
	qualification: {
		route: 'controlled-mutation',
		mutationSource: 'hand-authored mutation of the update handler',
		mutationOperator: 'statement-deletion',
		targetArtifact: ARTIFACT_REFERENCE,
		expectedObservableFailure:
			'the update acknowledges with 200 and the stored title is unchanged',
		baselinePassEvidence: ARTIFACT_REFERENCE,
		mutatedFailEvidence: ARTIFACT_REFERENCE,
		rollbackVerified: true,
	},
	defects: [],
	defectSignature: {
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
					argument: null,
					option: null,
					environment: null,
					stdin: null,
					arguments: null,
				},
			},
			predicate: {
				op: 'equality',
				operands: [
					{ pointer: '/interactions/observed/response-status' },
					{ literal: 200 },
				],
			},
		},
	},
}

const EMPTY_CHANNEL = { requiredKeys: [], permittedKeys: [], types: {} }

const EMPTY_REQUEST_SHAPE = {
	path: EMPTY_CHANNEL,
	query: EMPTY_CHANNEL,
	header: EMPTY_CHANNEL,
	body: EMPTY_CHANNEL,
}

const EVAL_CONTRACT_AT_5: Readonly<Record<string, unknown>> = {
	schemaVersion: 5,
	contractId: 'version-witness-contract',
	parentDigest: null,
	revisionCount: 0,
	sourceSpecDigest: null,
	behaviors: [
		{
			id: 'B-001',
			description: 'A minimal behaviour, so the contract declares something.',
			severity: 'low',
			observableSuccessCriterion: null,
			requirementLinks: [],
			riskLinks: [],
			oracles: [],
		},
	],
	oracles: [],
	rubrics: [],
	waivers: [],
	permittedInterfaces: [
		{
			logicalId: 'thing-api',
			kind: 'api',
			operations: [
				{
					operationId: 'read-thing',
					method: 'GET',
					pathTemplate: '/things/{id}',
					stateChangeMarker: false,
					requestShape: EMPTY_REQUEST_SHAPE,
					responseDescriptor: {
						requiredKeys: ['value'],
						permittedKeys: ['value'],
						types: {},
						successIndicator: null,
						channelRoles: null,
						collectionLocations: null,
					},
					volatilePointers: [],
					sensitivityWitness: null,
				},
			],
		},
	],
	referenceSets: null,
	siblingGroups: null,
	interactionPlan: [],
	scopedResources: null,
	forbiddenInputs: [],
	testData: { setup: null, cleanup: null, principals: null, resources: null },
	budgets: { maxToolCalls: 0, maxWallClockMinutes: 0, maxCostUsd: '0' },
	safetyLimits: [],
	requiredEvidence: [],
	probeStepBound: null,
	fixtureReset: null,
}

/**
 * Version 4's `mcp` interface. The kind carried the HTTP operation shape then,
 * so an operation declared a method and a path template; version 5 gives it a
 * tool call declaring a published tool name, and a contract carrying this stops
 * parsing.
 */
const MCP_INTERFACE_AT_4 = {
	logicalId: 'notes-tool-server',
	kind: 'mcp',
	operations: [
		{
			operationId: 'search-notes',
			method: 'POST',
			pathTemplate: '/tools',
			stateChangeMarker: false,
			requestShape: EMPTY_REQUEST_SHAPE,
			responseDescriptor: {
				requiredKeys: ['ok'],
				permittedKeys: ['ok'],
				types: {},
				successIndicator: null,
				channelRoles: null,
				collectionLocations: null,
			},
			volatilePointers: [],
			sensitivityWitness: null,
		},
	],
}

type ShapeByVersion = Readonly<
	Record<number, (stamp: number) => Record<string, unknown>>
>

/**
 * Each artifact whose shape has moved at least once, with a builder per
 * version it has held. The keys are written as integers on purpose: reading
 * the constant into the key would make the case for the current version exist
 * by construction, and then a bump with no shape behind it would pass.
 */
const SHAPES: readonly {
	readonly artifact: string
	readonly current: number
	readonly parse: (value: unknown) => { readonly success: boolean }
	readonly predecessor: string
	readonly shapeByVersion: ShapeByVersion
}[] = [
	{
		artifact: 'sealed-run-record',
		current: SEALED_RUN_RECORD_SCHEMA_VERSION,
		parse: (value) => SealedRunRecord.safeParse(value),
		predecessor: "carries the prior art's run-level `invalidReason`",
		shapeByVersion: {
			6: (stamp) => ({ ...SEALED_RUN_RECORD_AT_6, schemaVersion: stamp }),
			5: (stamp) => ({
				...SEALED_RUN_RECORD_AT_6,
				schemaVersion: stamp,
				invalidReason: 'the harness aborted the trial',
			}),
		},
	},
	{
		artifact: 'sealed-evaluator-brief',
		current: SEALED_EVALUATOR_BRIEF_SCHEMA_VERSION,
		parse: (value) => SealedEvaluatorBrief.safeParse(value),
		predecessor: 'declares no `principals`',
		shapeByVersion: {
			2: (stamp) => ({ ...SEALED_EVALUATOR_BRIEF_AT_2, schemaVersion: stamp }),
			1: (stamp) => {
				const brief: Record<string, unknown> = {
					...SEALED_EVALUATOR_BRIEF_AT_2,
					schemaVersion: stamp,
				}
				delete brief.principals
				return brief
			},
		},
	},
	{
		artifact: 'evidence-artifact',
		current: EVIDENCE_ARTIFACT_SCHEMA_VERSION,
		parse: (value) => EvidenceArtifact.safeParse(value),
		predecessor:
			'declares no `uncitedFindingGaps` on the contract-scoring branch',
		shapeByVersion: {
			3: (stamp) => ({ ...EVIDENCE_ARTIFACT_AT_3, schemaVersion: stamp }),
			2: (stamp) => {
				const artifact: Record<string, unknown> = {
					...EVIDENCE_ARTIFACT_AT_3,
					schemaVersion: stamp,
				}
				delete artifact.uncitedFindingGaps
				return artifact
			},
		},
	},
	{
		artifact: 'scoring-policy',
		current: SCORING_POLICY_SCHEMA_VERSION,
		parse: (value) => ScoringPolicy.safeParse(value),
		predecessor: 'declares no `catchThreshold`',
		shapeByVersion: {
			2: (stamp) => ({ ...SCORING_POLICY_AT_2, schemaVersion: stamp }),
			1: (stamp) => {
				const policy: Record<string, unknown> = {
					...SCORING_POLICY_AT_2,
					schemaVersion: stamp,
				}
				delete policy.catchThreshold
				return policy
			},
		},
	},
	{
		artifact: 'probe',
		current: PROBE_SCHEMA_VERSION,
		parse: (value) => Probe.safeParse(value),
		predecessor:
			"declares eight selector channels, without the ninth `arguments` one a tool call's inputs land in",
		shapeByVersion: {
			5: (stamp) => ({ ...PROBE_AT_5, schemaVersion: stamp }),
			// Rebuilt down to the selector, which is where the one difference
			// version 5 makes to this probe sits. A second copy of the other sixty
			// lines would be one more thing to disagree with itself.
			4: (stamp) => {
				const signature = PROBE_AT_5.defectSignature as Record<string, unknown>
				const condition = signature.condition as Record<string, unknown>
				const selector = condition.selector as Record<string, unknown>
				const inputBinding: Record<string, unknown> = {
					...(selector.inputBinding as Record<string, unknown>),
				}
				delete inputBinding.arguments
				return {
					...PROBE_AT_5,
					schemaVersion: stamp,
					defectSignature: {
						...signature,
						condition: {
							...condition,
							selector: { ...selector, inputBinding },
						},
					},
				}
			},
		},
	},
	{
		artifact: 'eval-contract',
		current: EVAL_CONTRACT_SCHEMA_VERSION,
		parse: (value) => EvalContract.safeParse(value),
		predecessor:
			'carries an `mcp` interface whose operation declares a method and a path template',
		shapeByVersion: {
			5: (stamp) => ({ ...EVAL_CONTRACT_AT_5, schemaVersion: stamp }),
			4: (stamp) => ({
				...EVAL_CONTRACT_AT_5,
				schemaVersion: stamp,
				permittedInterfaces: [
					...(EVAL_CONTRACT_AT_5.permittedInterfaces as readonly unknown[]),
					MCP_INTERFACE_AT_4,
				],
			}),
		},
	},
]

describe('each constant names the shape the parser accepts', () => {
	it.each(SHAPES.map((entry) => [entry.artifact, entry] as const))(
		'%s parses at the constant',
		(artifact, entry) => {
			const build = entry.shapeByVersion[entry.current]
			expect(
				build,
				`${artifact}: the constant reads ${entry.current} and no builder case declares that version's shape`,
			).toBeDefined()
			const built = (build as (stamp: number) => Record<string, unknown>)(
				entry.current,
			)
			expect(
				entry.parse(built).success,
				`${artifact}: the shape built at ${entry.current} does not parse, so the schema moved and the constant did not`,
			).toBe(true)
		},
	)

	it.each(SHAPES.map((entry) => [entry.artifact, entry] as const))(
		'%s does not parse at the constant minus one',
		(artifact, entry) => {
			const predecessor = entry.current - 1
			const build = entry.shapeByVersion[predecessor]
			expect(
				build,
				`${artifact}: the constant reads ${entry.current} and no builder case declares version ${predecessor}, which ${entry.predecessor}`,
			).toBeDefined()
			const built = (build as (stamp: number) => Record<string, unknown>)(
				predecessor,
			)
			expect(
				entry.parse(built).success,
				`${artifact}: the version-${predecessor} shape still parses, so the bump to ${entry.current} broke nothing the parser can see`,
			).toBe(false)
		},
	)
})

/**
 * The four artifacts that have never moved. Nothing was released before
 * version 1, so there is no predecessor shape to fail on and the
 * parse-behaviour question is vacuous; the source walk is the whole holding for
 * three of them, and the spike chain's emitted bytes hold the preflight verdict
 * as well. The assertion is what keeps that record honest: the first bump fails
 * here and the artifact has to join `SHAPES` with a predecessor case.
 */
const AT_VERSION_ONE: readonly (readonly [string, number])[] = [
	['preflight-verdict', PREFLIGHT_VERDICT_SCHEMA_VERSION],
	['isolation-manifest', ISOLATION_MANIFEST_SCHEMA_VERSION],
	['evaluator-configuration', EVALUATOR_CONFIGURATION_SCHEMA_VERSION],
	['private-artifact-manifest', PRIVATE_ARTIFACT_MANIFEST_SCHEMA_VERSION],
]

describe('an artifact at version 1 has no predecessor shape', () => {
	it.each(AT_VERSION_ONE)('%s', (artifact, version) => {
		expect(
			version,
			`${artifact} is recorded here as having no predecessor shape and its constant now reads ${version}. It has one: move it into SHAPES with a builder case for version ${version} and one for version ${version - 1}, and drop it from this list.`,
		).toBe(1)
	})
})

// The two lists above are the whole of what the parse-behaviour method says
// about the ten constants, and both are hand-written. `VERSION_BY_ARTIFACT_TYPE`
// is linked to the barrel so a constant exported and left out of the map fails;
// nothing linked the map to these two, so a constant could sit in the map with
// no predecessor case and no version-1 record while every case stayed green.
// That is the hole the next constant would have landed in.
describe('every constant in the map is accounted for', () => {
	it('has a parse-behaviour case or a version-1 record', () => {
		const held = [
			...SHAPES.map((entry) => entry.artifact),
			...AT_VERSION_ONE.map(([artifact]) => artifact),
		].sort()
		expect(held).toEqual(ARTIFACT_TYPES.map(artifactNameOf).sort())
	})
})
