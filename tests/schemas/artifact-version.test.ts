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
 * The parse-behaviour cases hold the constant against the parser, for the four
 * artifacts that have a predecessor shape. A fixture built at the constant
 * parses and one built at the constant minus one does not, and both are built
 * from the constant: a shape change that forgets the constant leaves the
 * fixture the constant names unparseable, and a bump with no case for the new
 * N-1 leaves the builder with nothing to build.
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
import { EVAL_CONTRACT_SCHEMA_VERSION } from '../../src/core/schemas/eval-contract.ts'
import { EVALUATOR_CONFIGURATION_SCHEMA_VERSION } from '../../src/core/schemas/evaluator-configuration.ts'
import {
	EVIDENCE_ARTIFACT_SCHEMA_VERSION,
	EvidenceArtifact,
} from '../../src/core/schemas/evidence-artifact.ts'
import { ISOLATION_MANIFEST_SCHEMA_VERSION } from '../../src/core/schemas/isolation-manifest.ts'
import { PREFLIGHT_VERDICT_SCHEMA_VERSION } from '../../src/core/schemas/preflight-verdict.ts'
import { PRIVATE_ARTIFACT_MANIFEST_SCHEMA_VERSION } from '../../src/core/schemas/private-artifact-manifest.ts'
import { PROBE_SCHEMA_VERSION } from '../../src/core/schemas/probe.ts'
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
import {
	contractScoringEvidenceArtifact,
	scoringPolicyFixture,
	sealedEvaluatorBriefFixture,
	sealedRunRecordFixture,
} from './fixtures/artifact-fixtures.ts'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

/**
 * Every artifact with a version constant, keyed by the type name an authored
 * literal is annotated with. The ten are the eight this story declares plus
 * the two Story 12.1 exported, so one walk covers every constant rather than
 * each file walking the tree for its own.
 */
const VERSION_BY_ARTIFACT_TYPE: Readonly<Record<string, number>> = {
	EvalContract: EVAL_CONTRACT_SCHEMA_VERSION,
	EvaluatorConfiguration: EVALUATOR_CONFIGURATION_SCHEMA_VERSION,
	EvidenceArtifact: EVIDENCE_ARTIFACT_SCHEMA_VERSION,
	IsolationManifest: ISOLATION_MANIFEST_SCHEMA_VERSION,
	PreflightVerdict: PREFLIGHT_VERDICT_SCHEMA_VERSION,
	PrivateArtifactManifest: PRIVATE_ARTIFACT_MANIFEST_SCHEMA_VERSION,
	Probe: PROBE_SCHEMA_VERSION,
	ScoringPolicy: SCORING_POLICY_SCHEMA_VERSION,
	SealedEvaluatorBrief: SEALED_EVALUATOR_BRIEF_SCHEMA_VERSION,
	SealedRunRecord: SEALED_RUN_RECORD_SCHEMA_VERSION,
}

const ARTIFACT_TYPES = Object.keys(VERSION_BY_ARTIFACT_TYPE)

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
 * The two annotation forms a literal wears in this tree: an explicit type on
 * the binding or on an arrow's return, and the `satisfies` clause. The
 * `satisfies` form is read for the artifact name anywhere in the type
 * expression, since `artifact-fixtures.ts` writes the evidence artifact's only
 * authored literal as `satisfies Omit<Extract<EvidenceArtifact, ...>, ...>`.
 */
const ANNOTATED = new RegExp(
	`:\\s*(${ARTIFACT_TYPES.join('|')})\\s*(?:=\\s*\\{|=>\\s*\\(\\{)`,
	'g',
)
const SATISFIES = /\}\s*satisfies\s+([\w<>,'|\s]+)/g
const STAMP = /^[ \t]*schemaVersion:\s*(\d+),/m

type Literal = {
	readonly artifactType: string
	readonly open: number
	readonly close: number
}

const literalsIn = (text: string): readonly Literal[] => {
	const found: Literal[] = []
	for (const match of text.matchAll(ANNOTATED)) {
		const open = text.indexOf('{', match.index ?? 0)
		found.push({
			artifactType: match[1] as string,
			open,
			close: matchingBrace(text, open),
		})
	}
	for (const match of text.matchAll(SATISFIES)) {
		const expression = match[1] as string
		const named = ARTIFACT_TYPES.filter((type) =>
			new RegExp(`\\b${type}\\b`).test(expression),
		)
		// A clause naming two artifacts says which shape is being satisfied for
		// neither of them, so it is left to the annotation forms above.
		if (named.length !== 1) continue
		const close = (match.index ?? 0) + (match[0] as string).indexOf('}')
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
				checked.set(
					literal.artifactType,
					(checked.get(literal.artifactType) ?? 0) + 1,
				)
				const expected = VERSION_BY_ARTIFACT_TYPE[
					literal.artifactType
				] as number
				if (Number(stamp[1]) !== expected) {
					stale.push(
						`${where}: ${literal.artifactType} schemaVersion ${stamp[1]}, and the constant reads ${expected}`,
					)
				}
			}
		}
	}

	it('reads every literal it finds to a matching close brace', () => {
		expect(unmatched).toEqual([])
	})

	it('finds no stale stamp', () => {
		expect(stale).toEqual([])
	})

	// A floor per artifact rather than one over the walk. A regex that stops
	// matching one artifact's form takes that artifact's coverage to zero and
	// leaves the total looking healthy, which is how a walk goes quiet.
	it.each(ARTIFACT_TYPES)('walks at least one %s literal', (artifactType) => {
		expect(checked.get(artifactType) ?? 0).toBeGreaterThan(0)
	})

	// `VERSION_BY_ARTIFACT_TYPE` is hand-written, so a constant exported
	// tomorrow and left out of it would be walked by nothing while every case
	// above stayed green. The barrel is the derived side: a name it publishes
	// as `<ARTIFACT>_SCHEMA_VERSION` is a version a caller can read, and every
	// one of them has to be in the map. Read off the barrel's source text so
	// this needs no build, the way the barrel census reads it.
	it('walks every `_SCHEMA_VERSION` the barrel exports', () => {
		const barrel = readFileSync(join(repoRoot, 'src/index.ts'), 'utf8')
		const exported = [
			...barrel.matchAll(/export \{ ([A-Z0-9_]+_SCHEMA_VERSION) \}/g),
		].map((match) => match[1] as string)
		expect(exported.length).toBeGreaterThan(0)
		const mapped = new Set(
			ARTIFACT_TYPES.map(
				(type) =>
					`${type.replace(/(?<!^)([A-Z])/g, '_$1').toUpperCase()}_SCHEMA_VERSION`,
			),
		)
		expect(exported.filter((name) => !mapped.has(name))).toEqual([])
	})
})

// ---------------------------------------------------------------------------
// the emitted bytes
// ---------------------------------------------------------------------------

// The literals above are what a reader can see; these are what the builders
// actually emit, since a builder could stamp a value on its way out. The three
// committed chains are the published surface for four of the eight artifacts.
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
})

// ---------------------------------------------------------------------------
// the parser
// ---------------------------------------------------------------------------

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
			6: (stamp) => ({ ...sealedRunRecordFixture, schemaVersion: stamp }),
			5: (stamp) => ({
				...sealedRunRecordFixture,
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
			2: (stamp) => ({ ...sealedEvaluatorBriefFixture, schemaVersion: stamp }),
			1: (stamp) => {
				const { principals: _dropped, ...rest } = sealedEvaluatorBriefFixture
				return { ...rest, schemaVersion: stamp }
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
			3: (stamp) => ({
				...contractScoringEvidenceArtifact,
				schemaVersion: stamp,
			}),
			// Deleted off a copy rather than destructured: the fixture is typed as
			// the union and `uncitedFindingGaps` sits on one branch, so a rest
			// pattern for it does not compile against the other.
			2: (stamp) => {
				const rest: Record<string, unknown> = {
					...contractScoringEvidenceArtifact,
					schemaVersion: stamp,
				}
				delete rest.uncitedFindingGaps
				return rest
			},
		},
	},
	{
		artifact: 'scoring-policy',
		current: SCORING_POLICY_SCHEMA_VERSION,
		parse: (value) => ScoringPolicy.safeParse(value),
		predecessor: 'declares no `catchThreshold`',
		shapeByVersion: {
			2: (stamp) => ({ ...scoringPolicyFixture, schemaVersion: stamp }),
			1: (stamp) => {
				const { catchThreshold: _dropped, ...rest } = scoringPolicyFixture
				return { ...rest, schemaVersion: stamp }
			},
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
 * parse-behaviour question is vacuous; the source walk and the emitted-bytes
 * walk are the whole holding for these. The assertion is what keeps that
 * record honest: the first bump fails here and the artifact has to join
 * `SHAPES` with a predecessor case.
 */
const AT_VERSION_ONE: readonly (readonly [string, number])[] = [
	['preflight-verdict', PREFLIGHT_VERDICT_SCHEMA_VERSION],
	['isolation-manifest', ISOLATION_MANIFEST_SCHEMA_VERSION],
	['evaluator-configuration', EVALUATOR_CONFIGURATION_SCHEMA_VERSION],
	['private-artifact-manifest', PRIVATE_ARTIFACT_MANIFEST_SCHEMA_VERSION],
]

describe('an artifact at version 1 has no predecessor shape', () => {
	it.each(AT_VERSION_ONE)('%s', (_artifact, version) => {
		expect(version).toBe(1)
	})
})
