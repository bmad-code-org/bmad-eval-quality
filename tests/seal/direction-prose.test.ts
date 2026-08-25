import { describe, expect, it } from 'vitest'
import { RELATION_VOCABULARY } from '../../src/core/schemas/expression.ts'
import type { Direction } from '../../src/core/schemas/oracle.ts'
import { renderEvidenceReferences } from '../../src/core/seal/derived-reference.ts'
import { renderDirectionText } from '../../src/core/seal/direction-prose.ts'
import { buildPlanIndex } from '../../src/core/seal/plan-index.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'
import {
	bothFreeTextNull,
	gateCInteractionPlan,
	gateCPermittedInterfaces,
	gateDReconstruction,
	populatedInteractionPlan,
	populatedPermittedInterfaces,
} from './fixtures.ts'

const gateCIndex = buildPlanIndex(
	gateCInteractionPlan,
	gateCPermittedInterfaces,
)

// One pinned wording pattern per relation family, mirroring the exact
// skeletons `direction-prose.ts` defines, so the sweep test below asserts the
// family-appropriate shape actually appears rather than only that some
// non-empty text was produced.
const FAMILY_PATTERN: Partial<Record<string, RegExp>> = {
	'for-all':
		/Every element reachable through .+ is asserted to meet the declared condition\./,
	'for-any':
		/At least one element reachable through .+ is asserted to meet the declared condition\./,
	all: /is asserted to satisfy every declared condition together\./,
	any: /is asserted to satisfy at least one declared condition\./,
	not: /is asserted to fail the declared condition, not to satisfy it\./,
	existence: /is asserted to be present\./,
	absence: /is asserted to be absent\./,
	equality: /is asserted to be equal\./,
	'deep-equality': /is asserted to be deeply, structurally equal\./,
	containment: /is asserted to contain the declared member\./,
}

function expectedPatternFor(relation: string): RegExp {
	return (
		FAMILY_PATTERN[relation] ??
		new RegExp(`is asserted to satisfy the declared "${relation}" condition\\.`)
	)
}

// The humanized operation name for every step one direction's evidenceTargets
// reference, resolved the same way the module under test does (kebab-case,
// hyphens to spaces), so the sweep test can assert every referenced
// operation's identity actually appears in the rendered text.
function humanizedOperationsFor(direction: Direction): readonly string[] {
	const stepIds = direction.evidenceTargets.map((pointer) => {
		const match = /^\/interactions\/([a-z0-9-]+)\//.exec(pointer)
		const stepId = match?.[1]
		if (stepId === undefined) {
			throw new Error(
				`test cannot parse the step id out of pointer: ${pointer}`,
			)
		}
		return stepId
	})
	return [...new Set(stepIds)].map((stepId) => {
		const step = gateCInteractionPlan.find(
			(candidate) => candidate.stepId === stepId,
		)
		if (step === undefined) {
			throw new Error(`test fixture is missing referenced step: ${stepId}`)
		}
		return step.operationId.split('-').join(' ')
	})
}

describe('AC 3: the Gate D Arm 2 reconstruction (content-equivalence, not a golden string)', () => {
	it('names the operation, states universal-quantification framing, and frames negativeDomain as a defect', () => {
		const text = renderDirectionText(
			gateDReconstruction.direction,
			buildPlanIndex(
				gateDReconstruction.interactionPlan,
				gateDReconstruction.permittedInterfaces,
			),
		)
		expect(text).toContain('search capsules')
		expect(text).toMatch(/every element/i)
		expect(text).toContain(
			'A returned capsule that does not satisfy the supplied query',
		)
		expect(text).toContain('is treated as a defect')
		expect(text).toContain('One search/filter endpoint response')
	})
})

describe('AC 3: the relation-keyed template families', () => {
	it('renders all sixteen RELATION_VOCABULARY members without throwing, non-empty, and pairwise distinct', () => {
		const direction = {
			evidenceTargets: ['/interactions/poll/response-status'],
			polarity: 'expects-hold' as const,
			scope: null,
			negativeDomain: null,
		}
		const texts = RELATION_VOCABULARY.map((relation) => {
			const text = renderDirectionText({ ...direction, relation }, gateCIndex)
			expect(text.length).toBeGreaterThan(0)
			return text
		})
		// Every relation must render its own text: two relations sharing one
		// rendered sentence (e.g. `any` silently reusing `all`'s wording, or
		// `containment` reusing `equality`'s) would pass a bare non-empty check
		// but fail this.
		expect(new Set(texts).size).toBe(RELATION_VOCABULARY.length)
	})

	it('the structural family names its own relation in the rendered text', () => {
		const structural = [
			'regex',
			'set-membership',
			'ordering',
			'count-tolerance',
			'shape',
			'covers-by-key',
		] as const
		for (const relation of structural) {
			const text = renderDirectionText(
				{
					evidenceTargets: ['/interactions/poll/response-status'],
					relation,
					polarity: 'expects-hold',
					scope: null,
					negativeDomain: null,
				},
				gateCIndex,
			)
			expect(text).toContain(relation)
		}
	})

	it('for-all and for-any are distinguished from each other (quantifier framing)', () => {
		const base = {
			evidenceTargets: ['/interactions/poll/response-status'],
			polarity: 'expects-hold' as const,
			scope: null,
			negativeDomain: null,
		}
		const forAll = renderDirectionText(
			{ ...base, relation: 'for-all' },
			gateCIndex,
		)
		const forAny = renderDirectionText(
			{ ...base, relation: 'for-any' },
			gateCIndex,
		)
		expect(forAll).toMatch(/every element/i)
		expect(forAny).toMatch(/at least one element/i)
		expect(forAll).not.toBe(forAny)
	})

	it('"not" negates rather than sharing all/any\'s affirmative skeleton', () => {
		const base = {
			evidenceTargets: [
				'/interactions/first-page/response-body/rows/retractedAt',
			],
			polarity: 'expects-hold' as const,
			scope: null,
			negativeDomain: null,
		}
		const notText = renderDirectionText(
			{ ...base, relation: 'not' },
			gateCIndex,
		)
		const allText = renderDirectionText(
			{ ...base, relation: 'all' },
			gateCIndex,
		)
		expect(notText.toLowerCase()).toMatch(
			/not to satisfy|fail the declared condition/,
		)
		expect(notText).not.toBe(allText)
	})

	it('a null scope and a null negativeDomain each drop their own clause rather than rendering "null"', () => {
		const index = buildPlanIndex(
			bothFreeTextNull.interactionPlan,
			bothFreeTextNull.permittedInterfaces,
		)
		const text = renderDirectionText(bothFreeTextNull.direction, index)
		expect(text.toLowerCase()).not.toContain('null')
		expect(text).not.toMatch(/\s{2,}/)
	})

	it('an empty-string scope and an empty-string negativeDomain each drop their clause exactly as null does: the schema admits "" as a value distinct from null', () => {
		const index = buildPlanIndex(
			bothFreeTextNull.interactionPlan,
			bothFreeTextNull.permittedInterfaces,
		)
		const withNulls = renderDirectionText(bothFreeTextNull.direction, index)
		const withEmptyStrings = renderDirectionText(
			{ ...bothFreeTextNull.direction, scope: '', negativeDomain: '' },
			index,
		)
		expect(withEmptyStrings).toBe(withNulls)
		expect(withEmptyStrings).not.toMatch(/\s{2,}/)
		expect(withEmptyStrings.trim().endsWith('.')).toBe(true)
	})

	it('existence and absence each render their own pinned wording, distinguished from each other', () => {
		const base = {
			evidenceTargets: ['/interactions/poll/response-body/jobId'],
			polarity: 'expects-hold' as const,
			scope: null,
			negativeDomain: null,
		}
		const existenceText = renderDirectionText(
			{ ...base, relation: 'existence' },
			gateCIndex,
		)
		const absenceText = renderDirectionText(
			{ ...base, relation: 'absence' },
			gateCIndex,
		)
		expect(existenceText).toContain('is asserted to be present.')
		expect(absenceText).toContain('is asserted to be absent.')
		expect(existenceText).not.toBe(absenceText)
	})

	it('scope and negativeDomain text is inserted, lightly shaped (trimmed, capitalized, one terminal mark), never split or reordered', () => {
		const direction = {
			evidenceTargets: ['/interactions/poll/response-status'],
			relation: 'equality' as const,
			polarity: 'expects-hold' as const,
			scope: 'a distinctive scope sentence nothing else in this suite writes.',
			negativeDomain:
				'a distinctive negative-domain sentence nothing else in this suite writes',
		}
		const text = renderDirectionText(direction, gateCIndex)
		expect(text).toContain(
			'A distinctive scope sentence nothing else in this suite writes.',
		)
		expect(text).toContain(
			'A distinctive negative-domain sentence nothing else in this suite writes is treated as a defect.',
		)
	})

	it('does not produce a double terminator when negativeDomain already ends in a period', () => {
		const direction = {
			evidenceTargets: ['/interactions/poll/response-status'],
			relation: 'equality' as const,
			polarity: 'expects-hold' as const,
			scope: null,
			negativeDomain: 'A job resource that echoes filters it was never given.',
		}
		const text = renderDirectionText(direction, gateCIndex)
		expect(text).toContain(
			'A job resource that echoes filters it was never given is treated as a defect.',
		)
		expect(text).not.toMatch(/\.\s+is treated as a defect/)
	})

	it('capitalizes a lowercase-starting scope, and only its leading letter', () => {
		const direction = {
			evidenceTargets: ['/interactions/poll/response-status'],
			relation: 'equality' as const,
			polarity: 'expects-hold' as const,
			scope: 'lowercase-starting SCOPE text.',
			negativeDomain: null,
		}
		const text = renderDirectionText(direction, gateCIndex)
		expect(text).toContain('Lowercase-starting SCOPE text.')
		expect(text).not.toContain('lowercase-starting SCOPE text.')
	})

	it('inserts a missing terminal period so an unterminated scope does not run into the next clause', () => {
		const direction = {
			evidenceTargets: ['/interactions/poll/response-status'],
			relation: 'equality' as const,
			polarity: 'expects-hold' as const,
			scope: 'a scope with no terminal punctuation',
			negativeDomain: 'a negative domain that follows it',
		}
		const text = renderDirectionText(direction, gateCIndex)
		expect(text).toContain(
			'A scope with no terminal punctuation. A negative domain that follows it is treated as a defect.',
		)
	})

	it('composes parts in the fixed order: relation claim, then polarity, then scope, then negativeDomain', () => {
		const direction = {
			evidenceTargets: ['/interactions/poll/response-status'],
			relation: 'equality' as const,
			polarity: 'expects-hold' as const,
			scope: 'UNIQUESCOPEMARKER text.',
			negativeDomain: 'UNIQUENEGATIVEDOMAINMARKER text',
		}
		const text = renderDirectionText(direction, gateCIndex)
		const relationIndex = text.indexOf('is asserted to be equal')
		const polarityIndex = text.indexOf('expects this relation to hold')
		const scopeIndex = text.indexOf('UNIQUESCOPEMARKER')
		const negativeDomainIndex = text.indexOf('UNIQUENEGATIVEDOMAINMARKER')
		expect(relationIndex).toBeGreaterThanOrEqual(0)
		expect(polarityIndex).toBeGreaterThan(relationIndex)
		expect(scopeIndex).toBeGreaterThan(polarityIndex)
		expect(negativeDomainIndex).toBeGreaterThan(scopeIndex)
	})

	it('polarity is rendered as its own clause, distinguishing expects-hold from expects-violation', () => {
		const base = {
			evidenceTargets: ['/interactions/poll/response-status'],
			relation: 'equality' as const,
			scope: null,
			negativeDomain: null,
		}
		const holds = renderDirectionText(
			{ ...base, polarity: 'expects-hold' },
			gateCIndex,
		)
		const violates = renderDirectionText(
			{ ...base, polarity: 'expects-violation' },
			gateCIndex,
		)
		expect(holds).toMatch(/expects this relation to hold/)
		expect(violates).toMatch(/expects this relation to be a violation/)
	})

	it('throws TypeError when evidenceTargets is empty, rather than rendering degenerate text', () => {
		const direction = {
			evidenceTargets: [] as string[],
			relation: 'equality' as const,
			polarity: 'expects-hold' as const,
			scope: null,
			negativeDomain: null,
		}
		expect(() => renderDirectionText(direction, gateCIndex)).toThrow(TypeError)
	})
})

describe('AC 5: the gateCContract sweep over all eight directions', () => {
	it("every direction names each referenced step's operation and matches its relation family's pinned wording pattern", () => {
		for (const oracle of gateCContract.oracles) {
			const direction = oracle.direction
			if (direction === null)
				throw new Error('gateCContract oracle carries no direction')
			const text = renderDirectionText(direction, gateCIndex)
			for (const operationName of humanizedOperationsFor(direction)) {
				expect(text).toContain(operationName)
			}
			expect(text).toMatch(expectedPatternFor(direction.relation))
		}
	})

	it("the generator-composed evidence reference carries no step identifier: checked on the generated text only, since author-written scope/negativeDomain are verbatim free prose exempt from this check (AC 4's own distinction, extended here)", () => {
		// A step id that happens to be a substring of its own operation's
		// humanized name (gateCContract's "submit" step names operation
		// "submit-export") is legitimate operation naming and not a step-id
		// leak, so it is excluded per-step instead of asserted as a bare
		// substring absence.
		const steps = gateCInteractionPlan.map((step) => ({
			stepId: step.stepId,
			humanizedOperation: step.operationId.split('-').join(' '),
		}))
		for (const oracle of gateCContract.oracles) {
			const direction = oracle.direction
			if (direction === null)
				throw new Error('gateCContract oracle carries no direction')
			const generated = renderEvidenceReferences(
				direction.evidenceTargets,
				gateCIndex,
			)
			for (const { stepId, humanizedOperation } of steps) {
				if (humanizedOperation.includes(stepId)) continue
				expect(generated).not.toContain(stepId)
			}
		}
	})

	it('connective directions (all, not) render distinctly from each other', () => {
		const byRelation = new Map<string, string>()
		for (const oracle of gateCContract.oracles) {
			const direction = oracle.direction
			if (direction === null) continue
			if (direction.relation !== 'all' && direction.relation !== 'not') continue
			byRelation.set(oracle.id, renderDirectionText(direction, gateCIndex))
		}
		const values = [...byRelation.values()]
		expect(new Set(values).size).toBe(values.length)
	})

	it("presence directions render over populatedContract's covers-by-key oracle too (a second worked example)", () => {
		const populatedIndex = buildPlanIndex(
			populatedInteractionPlan,
			populatedPermittedInterfaces,
		)
		const oracle = populatedContract.oracles[0]
		if (oracle?.direction === undefined || oracle.direction === null) {
			throw new Error('populatedContract fixture missing its one direction')
		}
		const text = renderDirectionText(oracle.direction, populatedIndex)
		expect(text).toContain('covers-by-key')
		expect(text).toContain('list things')
	})
})

describe('AC 5: determinism by permutation, at the renderDirectionText level', () => {
	it('the same direction rendered twice is byte-identical', () => {
		const direction = gateCContract.oracles[0]?.direction
		if (direction === undefined || direction === null)
			throw new Error('fixture missing')
		expect(renderDirectionText(direction, gateCIndex)).toBe(
			renderDirectionText(direction, gateCIndex),
		)
	})

	it('is byte-identical with evidenceTargets permuted (O-001, the temporal pair)', () => {
		const direction = gateCContract.oracles[0]?.direction
		if (direction === undefined || direction === null)
			throw new Error('fixture missing')
		const reversed = {
			...direction,
			evidenceTargets: [...direction.evidenceTargets].reverse(),
		}
		expect(renderDirectionText(direction, gateCIndex)).toBe(
			renderDirectionText(reversed, gateCIndex),
		)
	})

	it('is byte-identical against a permuted interactionPlan and permuted permittedInterfaces', () => {
		const direction = gateCContract.oracles[0]?.direction
		if (direction === undefined || direction === null)
			throw new Error('fixture missing')
		const baseline = renderDirectionText(direction, gateCIndex)
		const permutedIndex = buildPlanIndex(
			[...gateCInteractionPlan].reverse(),
			gateCPermittedInterfaces.map((iface) => ({
				...iface,
				operations: [...iface.operations].reverse(),
			})),
		)
		expect(renderDirectionText(direction, permutedIndex)).toBe(baseline)
	})
})
