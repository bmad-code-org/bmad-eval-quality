/**
 * AD-24's table as data (Story 6.4, AC 11 cases 1 through 10). These are the
 * invariants a table holds that a paragraph cannot.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
	ARTIFACT_PRODUCERS,
	deriveLineageWriterModules,
	INTERNAL_PRODUCTS,
	LINEAGE_WRITER_MODULES,
	PIPELINE_STAGES,
	type PipelineStage,
	STAGE_SIGNATURES,
	STAGE_VALUE_INPUTS,
	type StageSignature,
} from '../../src/core/lineage/stage-table.ts'
import {
	INTERCHANGE_ARTIFACT_KEYS,
	INTERCHANGE_ARTIFACTS,
	type InterchangeArtifactKey,
} from '../../src/core/schemas/artifact.ts'

const stageOf = (key: InterchangeArtifactKey): PipelineStage | undefined =>
	PIPELINE_STAGES.find((stage) => stage === ARTIFACT_PRODUCERS[key])

const internal = new Set<string>(INTERNAL_PRODUCTS)
const interchange = new Set<string>(INTERCHANGE_ARTIFACT_KEYS)

describe('the AD-24 stage-signature table', () => {
	// 1
	it('has exactly the six stage keys, in PIPELINE_STAGES order', () => {
		expect(Object.keys(STAGE_SIGNATURES)).toEqual([...PIPELINE_STAGES])
	})

	// 2. AD-24's own Prevents line: revision 1 gave the Evidence Artifact to
	// both `score` and `emit`.
	it('gives each stage a distinct owned output', () => {
		const owned = PIPELINE_STAGES.map((stage) => STAGE_SIGNATURES[stage].owns)
		expect(new Set(owned).size).toBe(owned.length)
	})

	// 3
	it('names a producer for every interchange artifact, in registry order', () => {
		expect(Object.keys(ARTIFACT_PRODUCERS)).toEqual([
			...INTERCHANGE_ARTIFACT_KEYS,
		])
	})

	// 4
	it('agrees with the producer map in both directions', () => {
		for (const key of INTERCHANGE_ARTIFACT_KEYS) {
			const stage = stageOf(key)
			if (stage === undefined) continue
			expect(STAGE_SIGNATURES[stage].ownsInterchange).toBe(key)
			const others = PIPELINE_STAGES.filter((each) => each !== stage)
			for (const other of others) {
				expect(STAGE_SIGNATURES[other].ownsInterchange).not.toBe(key)
			}
		}
		for (const stage of PIPELINE_STAGES) {
			const owned = STAGE_SIGNATURES[stage].ownsInterchange
			if (owned === null) continue
			expect(ARTIFACT_PRODUCERS[owned]).toBe(stage)
		}
	})

	// 5
	it('declares every non-interchange output as an internal product', () => {
		for (const stage of PIPELINE_STAGES) {
			const { owns } = STAGE_SIGNATURES[stage]
			if (interchange.has(owns)) continue
			expect(internal.has(owns)).toBe(true)
		}
		for (const product of INTERNAL_PRODUCTS) {
			const used = PIPELINE_STAGES.some(
				(stage) =>
					STAGE_SIGNATURES[stage].owns === product ||
					STAGE_SIGNATURES[stage].inputs.includes(product),
			)
			expect(used).toBe(true)
		}
	})

	// 6. The case that separates a derivation from a literal holding the same
	// two strings: a module-level constant is evaluated once at import, so
	// mutating a local copy of the table can only be observed through the
	// exported function.
	it('derives the writer allowlist from whichever table it is handed', () => {
		const withoutSeal: Record<PipelineStage, StageSignature> = {
			...STAGE_SIGNATURES,
			seal: { ...STAGE_SIGNATURES.seal, lineage: 'none' },
		}
		expect(deriveLineageWriterModules(withoutSeal)).not.toContain(
			'src/core/seal/seal.ts',
		)

		const withEmit: Record<PipelineStage, StageSignature> = {
			...STAGE_SIGNATURES,
			emit: { ...STAGE_SIGNATURES.emit, module: 'src/core/emit/emit.ts' },
		}
		expect(deriveLineageWriterModules(withEmit)).toContain(
			'src/core/emit/emit.ts',
		)
	})

	// 7
	it('exports the derived allowlist, which today is the two built minters', () => {
		expect(LINEAGE_WRITER_MODULES).toEqual(
			deriveLineageWriterModules(STAGE_SIGNATURES),
		)
		expect(LINEAGE_WRITER_MODULES).toEqual([
			'src/core/seal/seal.ts',
			'src/core/preflight/reduce.ts',
		])
	})

	// 8
	it('only lets a stage mint lineage onto an artifact that carries it', () => {
		for (const stage of PIPELINE_STAGES) {
			const signature = STAGE_SIGNATURES[stage]
			if (signature.lineage === 'mints') {
				const owned = signature.ownsInterchange
				expect(owned).not.toBeNull()
				if (owned === null) continue
				expect(INTERCHANGE_ARTIFACTS[owned].carriesLineage).toBe(true)
			}
			if (signature.lineage !== 'none') continue
			expect(signature.ownsInterchange).toBeNull()
		}
	})

	// 9
	it('marks exactly one artifact embedded, and it is the one with no lineage', () => {
		const embedded = INTERCHANGE_ARTIFACT_KEYS.filter(
			(key) => ARTIFACT_PRODUCERS[key] === 'embedded',
		)
		const withoutLineage = INTERCHANGE_ARTIFACT_KEYS.filter(
			(key) => !INTERCHANGE_ARTIFACTS[key].carriesLineage,
		)
		expect(embedded).toEqual(['artifact-reference'])
		expect(withoutLineage).toEqual(['artifact-reference'])
	})

	// 10
	it('names every input as an interchange artifact or an internal product', () => {
		for (const stage of PIPELINE_STAGES) {
			for (const input of STAGE_SIGNATURES[stage].inputs) {
				expect(interchange.has(input) || internal.has(input)).toBe(true)
			}
		}
	})

	// 11. The value column is closed for the same reason `inputs` is: a free
	// string would let the table name anything and prove nothing.
	it('names every value input in the value vocabulary', () => {
		const values = new Set<string>(STAGE_VALUE_INPUTS)
		for (const stage of PIPELINE_STAGES) {
			for (const value of STAGE_SIGNATURES[stage].valueInputs) {
				expect(values.has(value), `${stage} valueInput ${value}`).toBe(true)
			}
		}
	})

	// 12. The `module` column is a path, and nothing checked it resolved. A row
	// naming a file that was renamed or never written reads as a built stage and
	// is what `check:lineage` derives its writer allowlist from.
	it('names an existing file on every stage that declares a module', () => {
		for (const stage of PIPELINE_STAGES) {
			const module = STAGE_SIGNATURES[stage].module
			if (module === null) continue
			expect(
				existsSync(fileURLToPath(new URL(`../../${module}`, import.meta.url))),
				`${stage} module ${module}`,
			).toBe(true)
		}
	})

	// 13. Which stages are built is the table's own claim, and case 12 only
	// checks the ones that claim it. Pinned as a set so a row losing its module,
	// or a later stage gaining one, has to be written down here.
	it('names a module on exactly the stages that are built', () => {
		expect(
			PIPELINE_STAGES.filter(
				(stage) => STAGE_SIGNATURES[stage].module !== null,
			),
		).toEqual(['compile', 'seal', 'ingest', 'preflight', 'score'])
		expect(STAGE_SIGNATURES.ingest.module).toBe('src/core/ingest/ingest.ts')
		expect(STAGE_SIGNATURES.score.module).toBe('src/core/score/score.ts')
	})

	// 14. Owed item 6's own words: "the source of run mode is absent". One
	// stage names it, and it is the stage AD-21 fixes mode before.
	it('names mode on ingest and on no other stage', () => {
		const naming = PIPELINE_STAGES.filter((stage) =>
			STAGE_SIGNATURES[stage].valueInputs.includes('mode'),
		)
		expect(naming).toEqual(['ingest'])
	})
})
