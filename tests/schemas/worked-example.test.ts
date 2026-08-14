import { describe, expect, it } from 'vitest'
import { Expression } from '../../src/core/schemas/expression.ts'
import { WORKED_EXAMPLE_CHECKS } from './fixtures/worked-example-checks.ts'

describe('the spike worked example, re-checked and not repaired', () => {
	it.each(WORKED_EXAMPLE_CHECKS)(
		'$oracle parses: $parses — $finding',
		({ check, parses, issues }) => {
			const result = Expression.safeParse(check)
			expect(result.success).toBe(parses)
			if (parses) {
				expect(issues).toBeUndefined()
				return
			}
			// The recorded finding names a specific defect. Asserting the exact
			// issues is what keeps that record true: a bare failure would stay green
			// if the grammar broke somewhere else entirely.
			expect(
				result.error?.issues.map((issue) => ({
					path: issue.path,
					code: issue.code,
				})),
			).toEqual(issues)
		},
	)

	it('records two of five as conforming and three as stale', () => {
		const conforming = WORKED_EXAMPLE_CHECKS.filter((entry) => entry.parses)
		expect(conforming).toHaveLength(2)
		expect(WORKED_EXAMPLE_CHECKS).toHaveLength(5)
	})
})
