import { describe, expect, it } from 'vitest'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import type { BriefDirection } from '../../src/core/schemas/sealed-evaluator-brief.ts'
import { SealedEvaluatorBrief } from '../../src/core/schemas/sealed-evaluator-brief.ts'
import { renderDirectionText } from '../../src/core/seal/direction-prose.ts'
import { buildPlanIndex } from '../../src/core/seal/plan-index.ts'
import { auditBriefScripting } from '../../src/core/seal/scripting-audit.ts'
import { digestOf } from '../schemas/fixtures/artifact-fixtures.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'
import { populatedContract } from '../schemas/fixtures/relevance-contracts.ts'
import {
	gateCInteractionPlan,
	gateCPermittedInterfaces,
	populatedInteractionPlan,
	populatedPermittedInterfaces,
} from './fixtures.ts'

/**
 * Minimal schema-valid `SealedEvaluatorBrief`, validated by `.parse` at call
 * time (AC 4). Every field but `directions` and `probeStepBound` is filler
 * the audit never reads.
 */
function minimalBrief(
	directions: readonly BriefDirection[],
	probeStepBound: number | null,
): SealedEvaluatorBrief {
	return SealedEvaluatorBrief.parse({
		schemaVersion: 2,
		parentDigest: null,
		revisionCount: 0,
		contractDigest: digestOf(1),
		behaviors: [
			{
				id: 'B-001',
				description:
					'A minimal behaviour, present so the brief declares something.',
				severity: 'low',
				observableSuccessCriterion: null,
				requirementLinks: [],
				riskLinks: [],
				oracles: [],
			},
		],
		directions,
		permittedInterfaces: [],
		scopedResources: [],
		principals: [],
		budgets: { maxToolCalls: 0, maxWallClockMinutes: 0, maxCostUsd: '0' },
		safetyLimits: [],
		probeStepBound,
	})
}

// ---- AC 4 point 1: real generated prose over gateCContract's eight oracles --
const gateCIndex = buildPlanIndex(
	gateCInteractionPlan,
	gateCPermittedInterfaces,
)
const gateCDirections: BriefDirection[] = gateCContract.oracles.map(
	(oracle) => {
		if (oracle.direction === null) {
			throw new Error(`fixture oracle ${oracle.id} carries no direction`)
		}
		return {
			oracleId: oracle.id,
			text: renderDirectionText(oracle.direction, gateCIndex),
		}
	},
)
const gateCAcceptBrief = minimalBrief(gateCDirections, null)

// ---- AC 4 point 2: the "not the first" regression, at a strict bound -------
// The story cites this as O-004's negative domain, but the actual carrier is
// O-005's scope field (O-004's own scope has no "not the first" text).
// Settled here by construction rather than escalated (project standing
// default).
const o005Direction = gateCDirections.find(
	(direction) => direction.oracleId === 'O-005',
)
if (o005Direction === undefined) {
	throw new Error('gateCContract fixture is missing O-005')
}
const notTheFirstRegressionBrief = minimalBrief([o005Direction], 0)

// ---- AC 4 point 3: populatedContract's own declared probeStepBound: 8 ------
const populatedIndex = buildPlanIndex(
	populatedInteractionPlan,
	populatedPermittedInterfaces,
)
const populatedOracle = populatedContract.oracles[0]
if (populatedOracle === undefined || populatedOracle.direction === null) {
	throw new Error('populatedContract fixture is missing its one direction')
}
const populatedDirection: BriefDirection = {
	oracleId: populatedOracle.id,
	text: renderDirectionText(populatedOracle.direction, populatedIndex),
}
const populatedBoundBrief = minimalBrief([populatedDirection], 8)

// ---- AC 4 point 4: hand-authored word-vocabulary reject fixture ------------
// Verified against SEQUENCE_MARKER_PATTERN directly, not the story's own
// restated count: `then` and `finally` match; `First` is excluded as a bare
// ordinal (Decision 4). Two markers, exceeding a bound of 1.
const wordVocabularyReject: BriefDirection = {
	oracleId: 'O-999',
	text: 'The check is asserted to hold. First send the request, then read the response, and finally confirm the record.',
}
const wordVocabularyRejectBrief = minimalBrief([wordVocabularyReject], 1)

// ---- AC 4 point 5: hand-authored numbered-list reject fixture --------------
// `first`/`second` are bare ordinals (excluded); only the numbered-list branch
// fires, twice (both digit runs open a list item: "1." starts the string and
// "2." follows a sentence-ending period plus whitespace), against a bound of 0.
const numberedListReject: BriefDirection = {
	oracleId: 'O-998',
	text: '1. Do the first thing. 2. Do the second thing.',
}
const numberedListRejectBrief = minimalBrief([numberedListReject], 0)

// ---- AC 4 point 6: probeStepBound: null always passes, vacuously -----------
const manyMarkersDirection: BriefDirection = {
	oracleId: 'O-997',
	text: 'First, then before after subsequently next finally afterward. 1. Step one. 2. Step two.',
}
const nullBoundAlwaysPassesBrief = minimalBrief([manyMarkersDirection], null)

// ---- Review finding 1: every marker in SEQUENCE_MARKER_PATTERN, proven -----
// individually under a non-null bound. `manyMarkersDirection` above carries
// every word but is asserted only under `probeStepBound: null`, which returns
// before the regex ever runs (Decision: null is vacuous), so it alone cannot
// prove any one word actually matches. Each word below is isolated in its own
// direction and checked against a strict bound of 0, which does run the regex.
const MARKER_WORDS = [
	'then',
	'before',
	'after',
	'subsequently',
	'subsequent',
	'next',
	'finally',
	'afterward',
	'afterwards',
] as const

// ---- Review finding 2: ordinary numeric prose must not false-positive -----
// None of these digit runs opens a list item: each follows a word, a currency
// sign, or a decimal point, never the start of the string, a newline, or a
// sentence-ending mark plus whitespace.
const ordinaryNumericProseDirection: BriefDirection = {
	oracleId: 'O-995',
	text: 'See item 5. It explains the retry policy. Rule 12. All calls must succeed. The fee is $2. 50 cents extra applies. Section 3.2 covers this in detail.',
}
const ordinaryNumericProseBrief = minimalBrief(
	[ordinaryNumericProseDirection],
	0,
)

// ---- Review finding 3: 3+ digit and end-of-string numbered markers --------
const threeDigitMarkerDirection: BriefDirection = {
	oracleId: 'O-994',
	text: '100. Do the hundredth thing.',
}
const threeDigitMarkerBrief = minimalBrief([threeDigitMarkerDirection], 0)

const endOfStringMarkerDirection: BriefDirection = {
	oracleId: 'O-993',
	text: 'Confirm the record. 2.',
}
const endOfStringMarkerBrief = minimalBrief([endOfStringMarkerDirection], 0)

// ---- Second-round peer review, finding 1: five reformatted repro cases ----
// An independent peer session's own direct Node repro found these five all
// returned zero matches under the prior-round pattern; each reuses the shape
// of an already-shipped reject fixture, reformatted the way the peer's own
// repro demonstrated the gap.
const indentedListDirection: BriefDirection = {
	oracleId: 'O-990',
	text: 'Read the setup.\n  1. Open the panel.\n  2. Click submit.',
}
const indentedListBrief = minimalBrief([indentedListDirection], 0)

const doubleSpaceDirection: BriefDirection = {
	oracleId: 'O-989',
	text: 'Confirm the record.  1. Verify the log entry.',
}
const doubleSpaceBrief = minimalBrief([doubleSpaceDirection], 0)

const noSpaceDirection: BriefDirection = {
	oracleId: 'O-988',
	text: '1.Do the first thing.2.Do the second thing.',
}
const noSpaceBrief = minimalBrief([noSpaceDirection], 0)

const subsequentToParaphraseDirection: BriefDirection = {
	oracleId: 'O-987',
	text: 'Send the request. Subsequent to that call, read the response.',
}
const subsequentToParaphraseBrief = minimalBrief(
	[subsequentToParaphraseDirection],
	0,
)

const letteredListDirection: BriefDirection = {
	oracleId: 'O-986',
	text: 'a) Open the panel. b) Click submit.',
}
const letteredListBrief = minimalBrief([letteredListDirection], 0)

// A genuine decimal fraction must still not false-positive under the new
// digit-lookahead boundary: the character after "12." is a digit ("5"), which
// is exactly what `(?!\d)` is there to reject.
const decimalFractionDirection: BriefDirection = {
	oracleId: 'O-985',
	text: 'The value is 12.5 percent, a common threshold.',
}
const decimalFractionBrief = minimalBrief([decimalFractionDirection], 0)

describe('AC 3/AC 4: accept fixtures', () => {
	it('passes over real generated prose from all eight gateCContract directions, under probeStepBound: null', () => {
		// The test's own name and AC 4 point 1 hard-code "all eight" directions;
		// this pins the premise so a future edit to the shared fixture that drops
		// or adds an oracle fails loudly here rather than silently narrowing what
		// the sweep actually covers (review finding 7).
		expect(gateCContract.oracles).toHaveLength(8)
		expect(() => auditBriefScripting(gateCAcceptBrief)).not.toThrow()
	})

	it('the "not the first" regression (O-005\'s real scope text): "Every element of the returned page, not the first." passes at a strict non-null bound (0), proving the marker vocabulary correctly excludes the bare-ordinal "first"', () => {
		expect(o005Direction.text).toContain('not the first')
		expect(() => auditBriefScripting(notTheFirstRegressionBrief)).not.toThrow()
	})

	it("passes over populatedContract's real generated prose under its own declared probeStepBound: 8", () => {
		expect(() => auditBriefScripting(populatedBoundBrief)).not.toThrow()
	})

	it('probeStepBound: null always passes, independent of how many markers the text carries', () => {
		expect(() => auditBriefScripting(nullBoundAlwaysPassesBrief)).not.toThrow()
	})
})

describe('AC 3/AC 4: reject fixtures', () => {
	it('throws brief-exceeds-scripting-bound, naming O-999, when a hand-authored direction smuggles "then"/"finally" past a bound of 1', () => {
		expect(() => auditBriefScripting(wordVocabularyRejectBrief)).toThrow(
			StructuralFailure,
		)
		try {
			auditBriefScripting(wordVocabularyRejectBrief)
			throw new Error('expected auditBriefScripting to throw')
		} catch (error) {
			expect(error).toBeInstanceOf(StructuralFailure)
			if (!(error instanceof StructuralFailure)) throw error
			expect(error.code).toBe('brief-exceeds-scripting-bound')
			expect(error.artifactPath).toBe(
				'SealedEvaluatorBrief.directions[oracleId=O-999].text',
			)
			expect(error.message).toContain('2 enumerated-probe-step marker(s)')
		}
	})

	it('the numbered-list branch fires on its own, independent of the word-vocabulary branch', () => {
		try {
			auditBriefScripting(numberedListRejectBrief)
			throw new Error('expected auditBriefScripting to throw')
		} catch (error) {
			expect(error).toBeInstanceOf(StructuralFailure)
			if (!(error instanceof StructuralFailure)) throw error
			expect(error.code).toBe('brief-exceeds-scripting-bound')
			expect(error.artifactPath).toBe(
				'SealedEvaluatorBrief.directions[oracleId=O-998].text',
			)
			expect(error.message).toContain('2 enumerated-probe-step marker(s)')
		}
	})

	it('a declared bound of 0 is a legal, strict value: zero markers of any kind are permitted', () => {
		const cleanBrief = minimalBrief(
			[{ oracleId: 'O-996', text: 'A clean direction with no marker at all.' }],
			0,
		)
		expect(() => auditBriefScripting(cleanBrief)).not.toThrow()
	})
})

describe('AC 3: every SEQUENCE_MARKER_PATTERN member proven under a non-null bound (review finding 1)', () => {
	it.each(MARKER_WORDS)(
		'the word "%s" alone exceeds a strict bound of 0',
		(word) => {
			const brief = minimalBrief(
				[{ oracleId: 'O-992', text: `Some text with ${word} inside it.` }],
				0,
			)
			expect(() => auditBriefScripting(brief)).toThrow(StructuralFailure)
		},
	)

	it('the ")"-spelled numbered-list marker exceeds a strict bound of 0, not only the "." spelling', () => {
		const brief = minimalBrief([{ oracleId: 'O-991', text: '2) Do this.' }], 0)
		expect(() => auditBriefScripting(brief)).toThrow(StructuralFailure)
	})
})

describe('AC 3: numbered-list boundary correctness (review findings 2 and 3)', () => {
	it('does not false-positive on ordinary numeric prose where no digit run opens a list item', () => {
		expect(() => auditBriefScripting(ordinaryNumericProseBrief)).not.toThrow()
	})

	it('matches a three-or-more-digit step number, not only one or two digits', () => {
		expect(() => auditBriefScripting(threeDigitMarkerBrief)).toThrow(
			StructuralFailure,
		)
	})

	it('matches a numbered marker at the very end of the text, with nothing following it', () => {
		expect(() => auditBriefScripting(endOfStringMarkerBrief)).toThrow(
			StructuralFailure,
		)
	})
})

describe('AC 3: paraphrase and reformatting robustness (second-round peer review finding 1)', () => {
	it('an indented list item (leading whitespace after a newline) still counts, twice', () => {
		expect(() => auditBriefScripting(indentedListBrief)).toThrow(
			StructuralFailure,
		)
	})

	it('a doubled sentence-terminal space before a list marker still counts', () => {
		expect(() => auditBriefScripting(doubleSpaceBrief)).toThrow(
			StructuralFailure,
		)
	})

	it('a list marker directly abutting its punctuation with no space at all still counts, twice', () => {
		expect(() => auditBriefScripting(noSpaceBrief)).toThrow(StructuralFailure)
	})

	it('"Subsequent to" (the adjective, not only "subsequently") still counts', () => {
		expect(() => auditBriefScripting(subsequentToParaphraseBrief)).toThrow(
			StructuralFailure,
		)
	})

	it('a lettered list ("a)"/"b)") counts alongside a numbered one', () => {
		expect(() => auditBriefScripting(letteredListBrief)).toThrow(
			StructuralFailure,
		)
	})

	it('a genuine decimal fraction ("12.5") still does not false-positive', () => {
		expect(() => auditBriefScripting(decimalFractionBrief)).not.toThrow()
	})
})

describe('AC 5: permutation, over a brief mixing a violator with a passer', () => {
	// A single-direction brief makes "permute brief.directions" a no-op, so the
	// permutation brief mixes the O-999 reject fixture with a genuinely passing
	// direction (O-005's "not the first" regression direction, 0 markers) under
	// a shared bound of 1 that the reject fixture's own 2 markers still exceed.
	it('names O-999 when the violator is first', () => {
		const brief = minimalBrief([wordVocabularyReject, o005Direction], 1)
		try {
			auditBriefScripting(brief)
			throw new Error('expected auditBriefScripting to throw')
		} catch (error) {
			expect(error).toBeInstanceOf(StructuralFailure)
			if (!(error instanceof StructuralFailure)) throw error
			expect(error.artifactPath).toBe(
				'SealedEvaluatorBrief.directions[oracleId=O-999].text',
			)
		}
	})

	it('names O-999 when the violator is last', () => {
		const brief = minimalBrief([o005Direction, wordVocabularyReject], 1)
		try {
			auditBriefScripting(brief)
			throw new Error('expected auditBriefScripting to throw')
		} catch (error) {
			expect(error).toBeInstanceOf(StructuralFailure)
			if (!(error instanceof StructuralFailure)) throw error
			expect(error.artifactPath).toBe(
				'SealedEvaluatorBrief.directions[oracleId=O-999].text',
			)
		}
	})
})
