/**
 * The mechanical properties of the condition vocabulary: that the ladder
 * mapping stays total over the kinds tuple, that ingest's identifiers stay
 * disjoint from the per-oracle vocabulary `resolveOutcome` assigns, that the set
 * of conditions with no rung is exactly the seven the design admits, and that
 * the per-directory coverage floor points at a directory that exists and still
 * carries its number.
 *
 * That a non-null target names a real ladder field is carried by `tsc` through
 * `LadderTarget`'s `Extract` pair: both consumer types are erased at runtime, so
 * a field-name assertion here would have no object to check.
 */
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
	INGEST_CONDITION_KINDS,
	LADDER_TARGETS,
} from '../../src/core/ingest/index.ts'
import { INVALIDATING_CONDITIONS } from '../../src/core/score/outcome.ts'
import vitestConfig from '../../vitest.config.ts'

/**
 * The threshold keys that are not a coverage glob. `100` and `perFile` are
 * booleans, `autoUpdate` rewrites the file, and the rest are metric names.
 */
const NON_GLOB_THRESHOLD_KEYS = new Set([
	'statements',
	'branches',
	'functions',
	'lines',
	'perFile',
	'autoUpdate',
	'100',
])

describe('the ingest condition vocabulary', () => {
	it('maps every kind, and only the kinds, to a ladder target', () => {
		expect(Object.keys(LADDER_TARGETS).sort()).toEqual(
			[...INGEST_CONDITION_KINDS].sort(),
		)
	})

	// Two per-record conditions and ten per-oracle ones reach the same ladder
	// through different fields. Sharing an identifier between them would make a
	// persisted basis line ambiguous about which check produced it.
	it('shares no identifier with the per-oracle invalidating conditions', () => {
		const perOracle = new Set<string>(
			INVALIDATING_CONDITIONS.map((row) => row.id),
		)
		const shared = INGEST_CONDITION_KINDS.filter((kind) => perOracle.has(kind))

		expect(shared).toEqual([])
	})

	// Pinned rather than derived: an eighth kind mapping to `null` is an eighth
	// condition scoring nothing, and it should fail the build and force a
	// decision instead of quietly joining the seven the design already accounts
	// for.
	it('leaves exactly seven kinds without a rung', () => {
		const rungless = INGEST_CONDITION_KINDS.filter(
			(kind) => LADDER_TARGETS[kind] === null,
		)

		expect(rungless).toEqual([
			'dangling-citation',
			'dangling-disposition-citation',
			'forbidden-input-not-withheld',
			'cross-artifact-disagreement',
			'evaluator-configuration-absent',
			'evaluator-configuration-digest-mismatch',
			'judge-result-unscored',
		])
	})

	// The coverage floor is a glob, and a glob matching nothing summarises to
	// "Unknown", which compares below no threshold at all: the gate would be
	// permanently green. This is what stops a rename from silently switching it
	// off. Importing the root config from a test is also what pulls it into the
	// typecheck program, since `tsconfig.json` includes `src`, `tests`, and
	// `scripts` only, so a later change there surfaces here rather than nowhere.
	it('points its per-directory coverage floor at a directory that exists', () => {
		const thresholds = vitestConfig.test?.coverage?.thresholds ?? {}
		const globs = Object.keys(thresholds).filter(
			(key) => !NON_GLOB_THRESHOLD_KEYS.has(key),
		)

		expect(globs).toEqual(['src/core/ingest/**'])
		const directory = fileURLToPath(
			new URL(`../../${globs[0]?.replace(/\/\*\*$/, '')}/`, import.meta.url),
		)
		expect(
			readdirSync(directory).filter((entry) => entry.endsWith('.ts')).length,
		).toBeGreaterThan(0)
	})

	// The key alone is half the gate. Lowering either number is the same edit as
	// pointing the glob at nothing, and neither the coverage run nor the case
	// above would notice.
	//
	// A floor, never an equality. The coverage canary in CI proves the gate
	// blocks by seeding a threshold it cannot meet, so pinning these to exactly
	// 90 makes that canary fail here instead of on the axis it is testing, and
	// it then reports that the check "failed for the wrong reason".
	it('holds the per-directory floor and the two global ones at 90 or above', () => {
		const thresholds = vitestConfig.test?.coverage?.thresholds ?? {}
		const globs = Object.entries(thresholds).filter(
			([key]) => !NON_GLOB_THRESHOLD_KEYS.has(key),
		)

		expect(globs.map(([key]) => key)).toEqual(['src/core/ingest/**'])
		const perDirectory = globs[0]?.[1] as {
			statements?: number
			branches?: number
		}
		expect(perDirectory.statements).toBeGreaterThanOrEqual(90)
		expect(perDirectory.branches).toBeGreaterThanOrEqual(90)
		expect(thresholds.statements).toBeGreaterThanOrEqual(90)
		expect(thresholds.branches).toBeGreaterThanOrEqual(90)
	})
})
