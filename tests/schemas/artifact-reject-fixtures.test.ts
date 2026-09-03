import { describe, expect, it } from 'vitest'
import {
	INTERCHANGE_ARTIFACT_KEYS,
	INTERCHANGE_ARTIFACTS,
} from '../../src/core/schemas/artifact.ts'
import { ARTIFACT_ACCEPT_FIXTURES } from './fixtures/artifact-fixtures.ts'
import { ARTIFACT_REJECT_CASES } from './fixtures/artifact-reject-cases.ts'

describe('the per-constraint reject corpus for the eleven new artifacts', () => {
	it('enumerates every case exactly once', () => {
		const ids = ARTIFACT_REJECT_CASES.map((rejectCase) => rejectCase.id)
		expect(new Set(ids).size).toBe(ids.length)
		expect(ids.length).toBeGreaterThan(0)
	})

	// Every artifact this story declares owns at least one reject case. The
	// Eval Contract is excluded because Story 1.3's corpus already covers it and
	// this story changes none of its constraints.
	it('covers every artifact except the one Story 1.3 already covers', () => {
		const covered = new Set(
			ARTIFACT_REJECT_CASES.map((entry) => entry.artifact),
		)
		const expected = INTERCHANGE_ARTIFACT_KEYS.filter(
			(key) => key !== 'eval-contract',
		)
		expect([...covered].sort()).toEqual([...expected].sort())
	})

	// Enumerated programmatically: a committed fixture no test exercises cannot
	// go silently dead.
	it.each(ARTIFACT_REJECT_CASES)(
		'$id violates $constraint',
		({ artifact, mutate, issuePath, issueCode, issueCount, seed }) => {
			const subject = structuredClone(
				seed ?? ARTIFACT_ACCEPT_FIXTURES[artifact],
			) as unknown
			mutate(subject)
			const result = INTERCHANGE_ARTIFACTS[artifact].schema.safeParse(subject)
			expect(result.success).toBe(false)
			const issues = result.error?.issues ?? []
			// Exactly one issue is what makes this a single-constraint mutation.
			expect(issues).toHaveLength(issueCount ?? 1)
			expect(issues[0]?.path).toEqual(issuePath)
			expect(issues[0]?.code).toBe(issueCode)
		},
	)
})
