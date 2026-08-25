// Check one of four (Story 1.5, AC 5): the rejection suite run against the
// published schema. AD-13: "every negative case is a valid positive fixture
// mutated to violate exactly one target constraint, and the test asserts the
// expected validator keyword and instance path." This is the published-schema
// half of the corpus the Zod-side suites already assert.
//
// Containment, not a single error, on purpose: with `allErrors: true` a
// one-operand `equality` produces well over two hundred errors, since
// `Expression` exports as a sixteen-branch `oneOf` and every branch reports
// its own failure. The Zod-side "exactly one issue" rule is a Zod-side rule.

import { describe, expect, it } from 'vitest'
import {
	INTERCHANGE_ARTIFACT_KEYS,
	type InterchangeArtifactKey,
} from '../../../src/core/schemas/artifact.ts'
import {
	ARTIFACT_ACCEPT_FIXTURES,
	PROBE_CLASS_FIXTURES,
	UNION_BRANCH_FIXTURES,
} from '../fixtures/artifact-fixtures.ts'
import { ARTIFACT_REJECT_CASES } from '../fixtures/artifact-reject-cases.ts'
import { REJECT_CASES } from '../fixtures/reject-cases.ts'
import { RELEVANCE_CONTRACTS } from '../fixtures/relevance-contracts.ts'
import { publishedValidatorOf } from './validator.ts'

/** the whole corpus in one enumerable list, so completeness is assertable. */
const PUBLISHED_REJECT_CASES: readonly {
	id: string
	artifact: InterchangeArtifactKey
	keyword: string
	instancePath: string
	issuePath: readonly (string | number)[]
	errorParams?: Readonly<Record<string, string>>
	mutate: (value: any) => void
}[] = [
	...REJECT_CASES.map((rejectCase) => ({
		id: rejectCase.id,
		artifact: 'eval-contract' as const,
		keyword: rejectCase.keyword,
		instancePath: rejectCase.instancePath,
		issuePath: rejectCase.issuePath,
		errorParams: rejectCase.errorParams,
		mutate: rejectCase.mutate,
	})),
	...ARTIFACT_REJECT_CASES.map((rejectCase) => ({
		id: rejectCase.id,
		artifact: rejectCase.artifact,
		keyword: rejectCase.keyword,
		instancePath: rejectCase.instancePath,
		issuePath: rejectCase.issuePath,
		errorParams: rejectCase.errorParams,
		mutate: rejectCase.mutate,
	})),
]

/**
 * The three keywords that report at the PARENT of the member they are about:
 * `required` names the dropped key, `additionalProperties` the added one, and
 * `propertyNames` the offending name, all in `params`, not `instancePath`. So
 * `(keyword, instancePath)` alone can't say which member was touched, which is
 * why `errorParams` is required and asserted for these three.
 */
const PARENT_REPORTING = new Set([
	'required',
	'additionalProperties',
	'propertyNames',
])

/** the Zod issue path as an RFC 6901 pointer, for the cross-check below. */
const pointerOf = (path: readonly (string | number)[]): string =>
	path.length === 0
		? ''
		: `/${path
				.map((segment) =>
					String(segment).replace(/~/g, '~0').replace(/\//g, '~1'),
				)
				.join('/')}`

describe('the reject corpus, run against the published documents', () => {
	// 44 against the Eval Contract plus 68 across the other eleven; a count
	// drift here means a case was added on one side and not annotated. The 112
	// total is also pinned in differential.test.ts ("carries every hand-written
	// reject case").
	it('enumerates all 112 cases exactly once', () => {
		expect(REJECT_CASES).toHaveLength(44)
		expect(ARTIFACT_REJECT_CASES).toHaveLength(68)
		expect(PUBLISHED_REJECT_CASES).toHaveLength(112)
		const ids = PUBLISHED_REJECT_CASES.map(
			(rejectCase) => `${rejectCase.artifact}/${rejectCase.id}`,
		)
		expect(new Set(ids).size).toBe(ids.length)
	})

	// The published half must land where the Zod half lands. Containment alone,
	// inside an error set that can exceed two hundred entries, is otherwise
	// satisfiable by coincidence from an unrelated `oneOf` branch; this binds
	// the reported location to the location the mutation actually touched.
	it.each(PUBLISHED_REJECT_CASES)(
		'$artifact/$id reports where its Zod issue path points',
		({ keyword, instancePath, issuePath, id }) => {
			const zodPointer = pointerOf(issuePath)
			if (!PARENT_REPORTING.has(keyword)) {
				expect(instancePath, id).toBe(zodPointer)
				return
			}
			// these three report at the parent, so the pointer is a prefix and the
			// remainder is the member `errorParams` names
			expect(
				zodPointer === instancePath ||
					zodPointer.startsWith(`${instancePath}/`),
				`${id}: ajv reports at ${instancePath || '<root>'}, which is not an ancestor of the Zod path ${zodPointer || '<root>'}`,
			).toBe(true)
		},
	)

	it('declares errorParams for exactly the parent-reporting keywords', () => {
		const missing = PUBLISHED_REJECT_CASES.filter(
			(rejectCase) =>
				PARENT_REPORTING.has(rejectCase.keyword) &&
				rejectCase.errorParams === undefined,
		).map((rejectCase) => `${rejectCase.artifact}/${rejectCase.id}`)
		expect(
			missing,
			'parent-reporting cases with no discriminating params',
		).toEqual([])
		// nine today; a bare count would drift silently, so the set is derived
		expect(
			PUBLISHED_REJECT_CASES.filter(
				(rejectCase) => rejectCase.errorParams !== undefined,
			).length,
		).toBe(
			PUBLISHED_REJECT_CASES.filter((rejectCase) =>
				PARENT_REPORTING.has(rejectCase.keyword),
			).length,
		)
	})

	it.each(PUBLISHED_REJECT_CASES)(
		'$artifact/$id is rejected with $keyword at $instancePath',
		({ artifact, keyword, instancePath, errorParams, mutate }) => {
			const validate = publishedValidatorOf(artifact)
			const instance = structuredClone(
				ARTIFACT_ACCEPT_FIXTURES[artifact],
			) as unknown
			mutate(instance)
			expect(validate(instance)).toBe(false)
			const errors = validate.errors ?? []
			expect(
				errors.some(
					(error) =>
						error.keyword === keyword &&
						error.instancePath === instancePath &&
						// where the keyword names a member, the named member must be the
						// one this case mutated
						Object.entries(errorParams ?? {}).every(
							([name, value]) =>
								(error.params as Record<string, unknown>)[name] === value,
						),
				),
				`expected an error (${keyword}, ${instancePath}, ${JSON.stringify(
					errorParams ?? {},
				)}); got ${JSON.stringify(
					errors
						.slice(0, 5)
						.map((error) => [error.keyword, error.instancePath, error.params]),
				)}`,
			).toBe(true)
		},
	)
})

/** every positive fixture, enumerated with its owning artifact. */
const PUBLISHED_ACCEPT_FIXTURES: readonly {
	id: string
	artifact: InterchangeArtifactKey
	value: unknown
}[] = [
	...INTERCHANGE_ARTIFACT_KEYS.map((key) => ({
		id: `accept/${key}`,
		artifact: key,
		value: ARTIFACT_ACCEPT_FIXTURES[key] as unknown,
	})),
	...PROBE_CLASS_FIXTURES.map((fixture) => ({
		id: fixture.id,
		artifact: 'probe' as const,
		value: fixture.value as unknown,
	})),
	...UNION_BRANCH_FIXTURES.map((fixture) => ({
		id: fixture.id,
		artifact: fixture.artifact as InterchangeArtifactKey,
		value: fixture.value,
	})),
	...RELEVANCE_CONTRACTS.map((fixture) => ({
		id: `relevance/${fixture.name}`,
		artifact: 'eval-contract' as const,
		value: fixture.contract as unknown,
	})),
]

describe('every accept fixture validates clean against its own published document', () => {
	// twelve accepts, four probe classes, six union branches, three relevance
	// contracts: the enumeration itself is asserted so none can go silently dead.
	it('enumerates all twenty-five positives', () => {
		expect(PUBLISHED_ACCEPT_FIXTURES).toHaveLength(12 + 4 + 6 + 3)
	})

	// Twenty-five listings, nineteen distinct instances: six of the branch and
	// probe-class fixtures ARE the artifact's accept fixture, by object
	// identity (`accept/probe` is both `probe-class/defect` and
	// `probe/seeded`; `probe-class/zero-action` is `probe/clean-control`; and
	// `accept/artifact-reference`, `accept/evidence-artifact`, and
	// `accept/eval-contract` each appear once more under a branch or relevance
	// id). `seedsOf` in corpus.ts dedupes by identity; this list deliberately
	// doesn't, so every declared id is exercised under its own name. The
	// distinct count is pinned so a fixture quietly collapsing into an alias
	// of another shows up here.
	it('covers nineteen distinct instances behind those twenty-five ids', () => {
		expect(
			new Set(PUBLISHED_ACCEPT_FIXTURES.map((entry) => entry.value)).size,
		).toBe(19)
	})

	it.each(PUBLISHED_ACCEPT_FIXTURES)(
		'$id validates clean',
		({ artifact, value }) => {
			const validate = publishedValidatorOf(artifact)
			expect(
				validate(value),
				JSON.stringify(validate.errors?.slice(0, 3)),
			).toBe(true)
		},
	)
})
