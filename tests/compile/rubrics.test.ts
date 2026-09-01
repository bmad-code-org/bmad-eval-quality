/**
 * AD-22's four rubric checks (Story 6.3). One `it` per numbered case, each a
 * single mutation of `cleanPopulatedContract()`, asserting the AD-5 code and
 * the artifact path. Case 24 is the one exception and reads `message`, because
 * comparing two messages is the only way to see that this check gives the same
 * reason as `checkEvidenceReachability`.
 *
 * The contract under mutation ships one rubric, `R-001`: a single scale level
 * `{ level: 1, anchor: 'Every expected thing is present.' }`, one penalty
 * named `omission`, `maxLength: 400`, and one criterion `RC-001` whose
 * evidence is `/interactions/list/response-body/items`. Its interaction plan
 * declares the steps `create` (operation `create-thing`) and `list`
 * (operation `list-things`); only `list` is addressed by an oracle.
 */
import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import { findReasoningProseTerm } from '../../src/core/compile/rubrics.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { cleanPopulatedContract, structuralFailureOf } from './helpers.ts'

const RUBRIC_PATH = 'EvalContract.rubrics[id=R-001]'

const mutated = (mutate: (contract: any) => void): EvalContract => {
	const contract = cleanPopulatedContract() as any
	mutate(contract)
	return EvalContract.parse(contract)
}

const compiled = (mutate: (contract: any) => void) =>
	compile(mutated(mutate), { strict: true })

const failureOf = (mutate: (contract: any) => void) =>
	structuralFailureOf(() => {
		compiled(mutate)
	})

const criterion = (text: string) => ({
	id: 'RC-001',
	text,
	evidence: '/interactions/list/response-body/items',
})

/** A second rubric that is itself clean, for the cross-rubric cases. */
const secondRubric = (
	id: string,
	criterionId: string,
	text = 'Does the returned list carry every expected identifier?',
) => ({
	id,
	scaleLevels: [{ level: 1, anchor: 'Every expected thing is present.' }],
	failureModePenalties: [
		{ name: 'omission', description: 'An expected thing is missing.' },
	],
	maxLength: 400,
	criteria: [
		{
			id: criterionId,
			text,
			evidence: '/interactions/list/response-body/items',
		},
	],
})

// The vocabulary `REASONING_PROSE_PATTERN` deliberately excludes. Each has an
// ordinary sense in an API contract, and a compile-time code has no waiver
// path, so a term that fires on permitted authoring gets reworded around.
const EXCLUDED_TERMS = [
	'explain',
	'explanation',
	'explain why',
	'explains why',
	'thinking',
	'thinking time',
	'thinking tokens',
	'CoT',
	'scratchpad',
	'deliberation',
	'justify',
	'justification',
]

// Every alternative the pattern accepts, in every spelling of its separator
// and every inflection it admits. Driven from this list, so dropping an
// alternative turns a test red. `\u2010` and `\u2011` are the two non-ASCII
// hyphens a paste out of a styled document carries; the doubled separators
// pin the `+` in the separator class.
const FORBIDDEN_TERMS = [
	'chain of thought',
	'chain-of-thought',
	'chain of thoughts',
	'chains of thought',
	'chains of thoughts',
	'chains-of-thought',
	'chain  of  thought',
	'chain\u2010of\u2010thought',
	'chain\u2011of\u2011thought',
	'train of thought',
	'train-of-thought',
	'train of thoughts',
	'trains of thought',
	'trains-of-thought',
	'thought process',
	'thought-process',
	'thought--process',
	'thought processes',
	'thought-processes',
	'thought processing',
	'thought-processing',
	'thinking process',
	'thinking-process',
	'thinking processes',
	'internal monologue',
	'internal-monologue',
	'internal monologues',
	'internal-monologues',
	'inner monologue',
	'inner-monologue',
	'inner monologues',
	'self explanation',
	'self-explanation',
	'self explanations',
	'self-explanations',
	'reasoning',
	'reasonings',
	'rationale',
	'rationales',
]

describe('rubric checks: positive whole-contract regression', () => {
	it('1 the shipped fixture compiles unmutated, so no rule needed a fixture edit', () => {
		expect(() => compiled(() => {})).not.toThrow()
	})

	it('2 a zero-rubric contract compiles clean', () => {
		expect(() =>
			compiled((c) => {
				c.rubrics = []
			}),
		).not.toThrow()
	})

	it('3 a criterion id may repeat across rubrics, since a score cites the pair', () => {
		expect(() =>
			compiled((c) => {
				c.rubrics.push(secondRubric('R-002', 'RC-001'))
			}),
		).not.toThrow()
	})

	it('4 scale ordinals may be negative, zero, and non-contiguous', () => {
		expect(() =>
			compiled((c) => {
				c.rubrics[0].scaleLevels = [
					{ level: 7, anchor: 'Every expected thing is present.' },
					{ level: -1, anchor: 'Nothing expected is present.' },
					{ level: 0, anchor: 'Some expected thing is present.' },
				]
			}),
		).not.toThrow()
	})

	it('5 a single-level scale is legal: no minimum level count was minted', () => {
		expect(() =>
			compiled((c) => {
				c.rubrics[0].scaleLevels = [{ level: 1, anchor: 'All present.' }]
			}),
		).not.toThrow()
	})

	it('6 two penalties may share a name: penalty identity is not this story to mint', () => {
		expect(() =>
			compiled((c) => {
				c.rubrics[0].failureModePenalties = [
					{ name: 'omission', description: 'An expected thing is missing.' },
					{ name: 'omission', description: 'A required field is absent.' },
				]
			}),
		).not.toThrow()
	})

	it('7 a rubric with no criteria compiles, per AD-19', () => {
		expect(() =>
			compiled((c) => {
				c.rubrics[0].criteria = []
			}),
		).not.toThrow()
	})

	it.each(EXCLUDED_TERMS)(
		'8 an excluded term compiles clean in a criterion text: %s',
		(term) => {
			expect(findReasoningProseTerm(`Grade the ${term} in the response.`)).toBe(
				undefined,
			)
			expect(() =>
				compiled((c) => {
					c.rubrics[0].criteria = [
						criterion(`Grade the ${term} in the response.`),
					]
				}),
			).not.toThrow()
		},
	)
})

describe('checkRubricIdentifiers: rubric-unanchored', () => {
	it('9 two rubrics sharing an id, reported at the repeat', () => {
		const failure = failureOf((c) => {
			c.rubrics.push(secondRubric('R-001', 'RC-002'))
		})
		expect(failure.code).toBe('rubric-unanchored')
		expect(failure.artifactPath).toBe('EvalContract.rubrics[1].id')
	})

	it('10 two criteria in one rubric sharing an id, reported at the repeat', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].criteria.push(criterion('Does the list omit nothing?'))
		})
		expect(failure.code).toBe('rubric-unanchored')
		expect(failure.artifactPath).toBe(`${RUBRIC_PATH}.criteria[1].id`)
	})

	// The crossing case, and the only one that pins the two-pass split. Nest the
	// criterion loop back inside the rubric walk and this reports
	// `rubrics[id=R-001].criteria[1].id` on a contract where two rubrics are
	// both R-001, which is the ambiguity the split exists to stop. Cases 9, 10,
	// and 27 all stay green under that mutation.
	it('37 a rubric-id repeat outranks a criterion-id repeat in an earlier rubric', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].criteria.push(criterion('Does the list omit nothing?'))
			c.rubrics.push(secondRubric('R-001', 'RC-002'))
		})
		expect(failure.code).toBe('rubric-unanchored')
		expect(failure.artifactPath).toBe('EvalContract.rubrics[1].id')
	})
})

describe('checkRubricReasoningProse: rubric-scores-reasoning-prose', () => {
	it.each(FORBIDDEN_TERMS)(
		'11 a criterion text scoring stated reasoning: %s',
		(term) => {
			expect(findReasoningProseTerm(`Grade the ${term} in the response.`)).toBe(
				term,
			)
			const failure = failureOf((c) => {
				c.rubrics[0].criteria = [
					criterion(`Grade the ${term} in the response.`),
				]
			})
			expect(failure.code).toBe('rubric-scores-reasoning-prose')
			expect(failure.artifactPath).toBe(
				`${RUBRIC_PATH}.criteria[id=RC-001].text`,
			)
		},
	)

	it('12 a scale anchor scoring stated reasoning', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].scaleLevels = [
				{ level: 1, anchor: 'The reasoning is sound.' },
				{ level: 0, anchor: 'Every expected thing is present.' },
			]
		})
		expect(failure.code).toBe('rubric-scores-reasoning-prose')
		expect(failure.artifactPath).toBe(`${RUBRIC_PATH}.scaleLevels[0].anchor`)
	})

	it('13 a penalty name scoring stated reasoning', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].failureModePenalties = [
				{
					name: 'missing rationale',
					description: 'An expected thing is missing.',
				},
			]
		})
		expect(failure.code).toBe('rubric-scores-reasoning-prose')
		expect(failure.artifactPath).toBe(
			`${RUBRIC_PATH}.failureModePenalties[0].name`,
		)
	})

	it('14 a penalty description scoring stated reasoning', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].failureModePenalties = [
				{
					name: 'omission',
					description:
						'Deduct where the response does not state its reasoning.',
				},
			]
		})
		expect(failure.code).toBe('rubric-scores-reasoning-prose')
		expect(failure.artifactPath).toBe(
			`${RUBRIC_PATH}.failureModePenalties[0].description`,
		)
	})

	it('15 criterion text is reported before a scale anchor carrying the same defect', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].scaleLevels = [
				{ level: 1, anchor: 'The reasoning is sound.' },
				{ level: 0, anchor: 'Every expected thing is present.' },
			]
			c.rubrics[0].criteria = [
				criterion('Grade the rationale in the response.'),
			]
		})
		expect(failure.artifactPath).toBe(`${RUBRIC_PATH}.criteria[id=RC-001].text`)
	})
})

describe('checkRubricAnchoring: rubric-unanchored', () => {
	it.each([
		['null', null],
		['empty', []],
	])('16 a %s scaleLevels list is the unanchored scale', (_label, value) => {
		const failure = failureOf((c) => {
			c.rubrics[0].scaleLevels = value
		})
		expect(failure.code).toBe('rubric-unanchored')
		expect(failure.artifactPath).toBe(`${RUBRIC_PATH}.scaleLevels`)
	})

	it('17 a repeated scale-level ordinal', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].scaleLevels = [
				{ level: 1, anchor: 'Every expected thing is present.' },
				{ level: 1, anchor: 'Some expected thing is present.' },
			]
		})
		expect(failure.code).toBe('rubric-unanchored')
		expect(failure.artifactPath).toBe(`${RUBRIC_PATH}.scaleLevels[1].level`)
	})

	it.each([
		['empty', ''],
		['whitespace-only', '   '],
		['zero-width-only', '\u200b\ufeff'],
	])('18 a %s anchor states no observable condition', (_label, anchor) => {
		const failure = failureOf((c) => {
			c.rubrics[0].scaleLevels = [{ level: 1, anchor }]
		})
		expect(failure.code).toBe('rubric-unanchored')
		expect(failure.artifactPath).toBe(`${RUBRIC_PATH}.scaleLevels[0].anchor`)
	})

	it('19 a null maxLength is the unbounded length', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].maxLength = null
		})
		expect(failure.code).toBe('rubric-unanchored')
		expect(failure.artifactPath).toBe(`${RUBRIC_PATH}.maxLength`)
	})

	it.each([
		['null', null],
		['empty', []],
	])(
		'20 a %s failureModePenalties list names no penalties',
		(_label, value) => {
			const failure = failureOf((c) => {
				c.rubrics[0].failureModePenalties = value
			})
			expect(failure.code).toBe('rubric-unanchored')
			expect(failure.artifactPath).toBe(`${RUBRIC_PATH}.failureModePenalties`)
		},
	)

	it('21 a whitespace-only penalty name leaves the penalty unnamed', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].failureModePenalties = [
				{ name: '   ', description: 'An expected thing is missing.' },
			]
		})
		expect(failure.code).toBe('rubric-unanchored')
		expect(failure.artifactPath).toBe(
			`${RUBRIC_PATH}.failureModePenalties[0].name`,
		)
	})

	it.each([
		['empty', ''],
		['whitespace-only', '   '],
	])('22 a %s criterion text states no question', (_label, text) => {
		const failure = failureOf((c) => {
			c.rubrics[0].criteria = [criterion(text)]
		})
		expect(failure.code).toBe('rubric-unanchored')
		expect(failure.artifactPath).toBe(`${RUBRIC_PATH}.criteria[id=RC-001].text`)
	})
})

describe('checkRubricEvidenceReachability: rubric-evidence-unreachable', () => {
	const evidenceOf = (pointer: string) => (c: any) => {
		c.rubrics[0].criteria[0].evidence = pointer
	}

	it('23 a pointer naming a step the plan does not declare', () => {
		const failure = failureOf(
			evidenceOf('/interactions/no-such-step/response-body/items'),
		)
		expect(failure.code).toBe('rubric-evidence-unreachable')
		expect(failure.artifactPath).toBe(
			`${RUBRIC_PATH}.criteria[id=RC-001].evidence`,
		)
	})

	it('24 a declared step with an undeclared response-body field, giving the same reason as unreachable-check-evidence', () => {
		const pointer = '/interactions/list/response-body/nope'
		const failure = failureOf(evidenceOf(pointer))
		expect(failure.code).toBe('rubric-evidence-unreachable')
		expect(failure.artifactPath).toBe(
			`${RUBRIC_PATH}.criteria[id=RC-001].evidence`,
		)
		// The two evidence codes differ only in code and path. Comparing the
		// messages is the only way to see that, since `StructuralFailure` keeps
		// the detail nowhere else. This is the file's one message assertion, and
		// it compares two real messages.
		const oracleFailure = structuralFailureOf(() => {
			compiled((c) => {
				c.oracles[0].check.operands[0] = { pointer }
			})
		})
		expect(oracleFailure.code).toBe('unreachable-check-evidence')
		const reasonOf = (thrown: { message: string }) => {
			const at = thrown.message.indexOf(`"${pointer}" `)
			// Without this, a missing marker slices at -1 and the comparison
			// below passes on one matching character.
			expect(at).toBeGreaterThanOrEqual(0)
			return thrown.message.slice(at)
		}
		expect(reasonOf(failure)).toBe(reasonOf(oracleFailure))
	})

	// Cases 25 and 26 are the only proof that `buildPlanIndex` was called with
	// `{ duplicateIds: 'unresolved' }`. Drop the options object and both throw a
	// `TypeError` a caller cannot classify, while 23 and 24 stay green.
	it('25 a duplicated step id is caught as a structural failure, with no TypeError escaping', () => {
		const failure = failureOf((c) => {
			c.interactionPlan.push(structuredClone(c.interactionPlan[0]))
			c.rubrics[0].criteria[0].evidence =
				'/interactions/create/response-body/id'
		})
		expect(failure.code).toBe('rubric-evidence-unreachable')
	})

	it('26 a duplicated operation id is caught as a structural failure, with no TypeError escaping', () => {
		const failure = failureOf((c) => {
			const operations = c.permittedInterfaces[0].operations
			const duplicate = structuredClone(operations[0])
			duplicate.pathTemplate = '/things-alternate'
			operations.push(duplicate)
			c.rubrics[0].criteria[0].evidence =
				'/interactions/create/response-body/id'
		})
		expect(failure.code).toBe('rubric-evidence-unreachable')
	})
})

describe('compile: rubric check precedence', () => {
	it('27 identifiers are settled before reasoning prose reports', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].criteria = [
				criterion('Grade the reasoning in the response.'),
			]
			c.rubrics.push(secondRubric('R-001', 'RC-002'))
		})
		expect(failure.code).toBe('rubric-unanchored')
		expect(failure.artifactPath).toBe('EvalContract.rubrics[1].id')
	})

	it('28 reasoning prose outranks anchoring', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].criteria = [
				criterion('Grade the reasoning in the response.'),
			]
			c.rubrics[0].scaleLevels = null
		})
		expect(failure.code).toBe('rubric-scores-reasoning-prose')
	})

	it('29 anchoring outranks evidence reachability', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].maxLength = null
			c.rubrics[0].criteria[0].evidence =
				'/interactions/no-such-step/response-body/items'
		})
		expect(failure.code).toBe('rubric-unanchored')
	})

	it('30 checkScriptingBound runs before every rubric check', () => {
		const failure = failureOf((c) => {
			for (const stepId of ['fan-a', 'fan-b', 'fan-c']) {
				c.interactionPlan.push({
					stepId,
					operationId: 'list-things',
					inputBinding: {
						path: null,
						query: { limit: { literal: 10 } },
						header: null,
						body: null,
					},
					after: 'create',
					cardinality: 'exactly-one',
				})
			}
			c.rubrics.push(secondRubric('R-001', 'RC-002'))
		})
		expect(failure.code).toBe('plan-exceeds-scripting-bound')
	})

	it('31 every rubric check runs before checkForbiddenInputFloor', () => {
		const failure = failureOf((c) => {
			c.forbiddenInputs = c.forbiddenInputs.filter(
				(member: string) => member !== 'source-code',
			)
			c.rubrics[0].criteria[0].evidence =
				'/interactions/no-such-step/response-body/items'
		})
		expect(failure.code).toBe('rubric-evidence-unreachable')
	})

	it('33 reasoning prose reports the first rubric in array order', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].criteria = [
				criterion('Grade the rationale in the response.'),
			]
			c.rubrics.push(
				secondRubric('R-002', 'RC-002', 'Grade the reasoning in the response.'),
			)
		})
		expect(failure.artifactPath).toBe(`${RUBRIC_PATH}.criteria[id=RC-001].text`)
	})

	// Each row of AC 5's table, violated together with every row below it. An
	// isolated reject case passes under any intra-rubric ordering; only this
	// cumulative walk pins that rule n outranks rules n+1 through 7.
	it.each([
		[
			'2',
			[
				{ level: 1, anchor: '' },
				{ level: 1, anchor: 'All present.' },
			],
			'.scaleLevels[1].level',
		],
		[
			'3',
			[
				{ level: 1, anchor: '' },
				{ level: 2, anchor: 'All present.' },
			],
			'.scaleLevels[0].anchor',
		],
		[
			'4',
			[
				{ level: 1, anchor: 'None present.' },
				{ level: 2, anchor: 'All present.' },
			],
			'.maxLength',
		],
	])(
		'34 anchoring rule %s outranks every rule below it',
		(_row, scaleLevels, suffix) => {
			const failure = failureOf((c) => {
				c.rubrics[0].scaleLevels = scaleLevels
				c.rubrics[0].maxLength = null
				c.rubrics[0].failureModePenalties = [
					{ name: '   ', description: 'An expected thing is missing.' },
				]
				c.rubrics[0].criteria = [criterion('   ')]
			})
			expect(failure.artifactPath).toBe(`${RUBRIC_PATH}${suffix}`)
		},
	)

	it('35 the unbounded-length rule outranks the missing-penalties rule', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].maxLength = null
			c.rubrics[0].failureModePenalties = null
		})
		expect(failure.artifactPath).toBe(`${RUBRIC_PATH}.maxLength`)
	})

	it('38 the blank-penalty-name rule outranks the blank-criterion rule', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].failureModePenalties = [
				{ name: '   ', description: 'An expected thing is missing.' },
			]
			c.rubrics[0].criteria = [criterion('   ')]
		})
		expect(failure.artifactPath).toBe(
			`${RUBRIC_PATH}.failureModePenalties[0].name`,
		)
	})

	it('36 the missing-penalties rule outranks the blank-criterion rule', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].failureModePenalties = null
			c.rubrics[0].criteria = [criterion('   ')]
		})
		expect(failure.artifactPath).toBe(`${RUBRIC_PATH}.failureModePenalties`)
	})

	it('32 the first defective rubric in array order reports', () => {
		const failure = failureOf((c) => {
			c.rubrics[0].maxLength = null
			const second = secondRubric('R-002', 'RC-002')
			second.maxLength = null as unknown as number
			c.rubrics.push(second)
		})
		expect(failure.artifactPath).toBe(`${RUBRIC_PATH}.maxLength`)
	})
})
