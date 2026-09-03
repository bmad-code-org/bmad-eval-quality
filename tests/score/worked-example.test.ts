/**
 * The regenerated worked chain, driven through AD-40's witness match on real
 * data. `witness.test.ts` already proves the citation triad and both
 * permutation families against a synthetic two-observation fixture; this file
 * proves the same properties against the chain the corpus actually publishes,
 * which is the first end-to-end evidence that the reference functions agree
 * with each other (owed item 7).
 *
 * The chain is read as values, not bytes: `buildWorkedExampleChain` is the
 * pure builder the generator renders and the drift check compares, so nothing
 * here touches the filesystem and nothing here can disagree with what is
 * committed.
 */
import { describe, expect, it } from 'vitest'
import {
	buildWorkedExample,
	buildWorkedExampleChain,
	WORKED_EXAMPLE_FILES,
	WORKED_EXAMPLE_LABEL,
} from '../../scripts/worked-example-target.ts'
import type { Observation } from '../../src/core/schemas/sealed-run-record.ts'
import { matchProbeWitness } from '../../src/core/score/witness.ts'

const chain = buildWorkedExampleChain()
const { contract, probe, record } = chain

const recordOf = (
	observations: readonly Observation[],
	findings: (typeof record)['findings'] = record.findings,
) => ({ observations: [...observations], findings: [...findings] })

const match = (
	observations: readonly Observation[],
	findings?: (typeof record)['findings'],
) =>
	matchProbeWitness(
		probe,
		contract.permittedInterfaces,
		recordOf(observations, findings),
	)

/** The defect finding, re-cited at a different observation. */
const defectFindingCiting = (
	observationIds: readonly string[],
): (typeof record)['findings'] =>
	record.findings.map((finding) =>
		finding.findingType === 'defect'
			? { ...finding, observationIds: [...observationIds] }
			: finding,
	)

const withoutDefectFinding = (): (typeof record)['findings'] =>
	record.findings.filter((finding) => finding.findingType !== 'defect')

describe('the regenerated worked chain, through the witness match', () => {
	it('resolves matched on the observation the evaluator actually cited', () => {
		expect(chain.witness.result).toBe('matched')
		expect(chain.witness.basis).toBe('measured')
		expect(chain.witness.homeOperationResolved).toBe(true)
		expect(chain.witness.observationIds).toEqual(['obs-004'])
		expect(chain.witness.witnessObservationIds).toEqual(['obs-004'])
		expect(chain.witness.partition.satisfying).toEqual(['obs-004'])
	})

	// The same three rows `witness.test.ts` drives on the synthetic fixture,
	// here over the real chain: one input differs, the cited observation, and
	// the three results are different. `obs-001` is the baseline read of the
	// same note through the same home operation, so a claim citing it alone
	// witnesses nothing.
	it('resolves unwitnessed-claim when the finding cites the baseline read', () => {
		const result = match(record.observations, defectFindingCiting(['obs-001']))
		expect(result.result).toBe('unwitnessed-claim')
		expect(result.unwitnessedFindingIds).toEqual(['F-001'])
		expect(result.witnessObservationIds).toEqual([])
	})

	it('resolves manifested-unclaimed when no defect finding is filed', () => {
		const result = match(record.observations, withoutDefectFinding())
		expect(result.result).toBe('manifested-unclaimed')
		expect(result.partition.satisfying).toEqual(['obs-004'])
		expect(result.witnessObservationIds).toEqual([])
	})
})

describe('the reversed-order flip, on the regenerated chain', () => {
	const forward = record.observations
	const reversedArray = [...record.observations].reverse()

	// Permutation family one: array position is never read. A first-match
	// scorer would flip `matched` to `manifested-unclaimed` here. Anchored to
	// literals rather than to `chain.witness`, so a regression that moves the
	// builder's own match cannot move both sides of the comparison together.
	it.each([
		['declared order', forward],
		['reversed array', reversedArray],
	])('permutation by %s returns identical identifiers', (_label, order) => {
		const result = match(order)
		expect(result.result).toBe('matched')
		expect(result.observationIds).toEqual(['obs-004'])
		expect(result.partition).toEqual({
			satisfying: ['obs-004'],
			refuting: [],
			inconclusive: [],
		})
		expect(result.witnessObservationIds).toEqual(['obs-004'])
	})

	// Permutation family two: the same observations with the two reads' own
	// `sequence` values exchanged, which is the flip the synthetic fixture
	// pins. `obs-004` becomes the earlier read and `obs-001` the later one, and
	// the result and the identifier set are unchanged.
	it('holds when the two reads exchange their sequence values', () => {
		const swapped = record.observations.map((observation) =>
			observation.observationId === 'obs-001'
				? { ...observation, sequence: 4 }
				: observation.observationId === 'obs-004'
					? { ...observation, sequence: 1 }
					: observation,
		)
		const result = match(swapped)
		expect(result.result).toBe('matched')
		expect(result.observationIds).toEqual(['obs-004'])
		expect(result.witnessObservationIds).toEqual(['obs-004'])
	})

	// Permutation family three: `findings` carries no ordering field, so its
	// array position is the same non-meaning `sequence` was added to remove.
	it('returns identical finding identifiers under a permuted findings array', () => {
		const result = match(record.observations, [...record.findings].reverse())
		expect(result.result).toBe('matched')
		expect(result.unwitnessedFindingIds).toEqual([])
	})
})

describe('what the regeneration closes', () => {
	const outcomeOf = (oracleId: string) => {
		const outcome = chain.artifact.outcomes.find(
			(candidate) => candidate.oracleId === oracleId,
		)
		if (outcome === undefined) throw new Error(`no outcome for ${oracleId}`)
		return outcome
	}

	// Retraction defect 1: the step matches zero observations, and the
	// disposition narrates a rejection no observation shows. It was recorded
	// `confirmed`/`agrees`.
	it('records the zero-observation step as unreached and disagreeing', () => {
		expect(chain.selectionOf.get('malformed-write')).toEqual({
			result: 'none',
			matchedObservationIds: [],
		})
		expect(outcomeOf('O-005').state).toBe('unreached')
		expect(outcomeOf('O-005').corroboration).toBe('disagrees')
	})

	// Retraction defect 2: two steps each matching two observations, resolved
	// with no declared cardinality. Only `baseline-read` genuinely matches two;
	// `read-back`'s temporal clause floors it at the write.
	it('separates the two reads by the temporal clause, not by cardinality', () => {
		expect(chain.selectionOf.get('baseline-read')).toEqual({
			result: 'several',
			matchedObservationIds: ['obs-001', 'obs-004'],
		})
		expect(chain.selectionOf.get('read-back')).toEqual({
			result: 'one',
			matchedObservationIds: ['obs-004'],
		})
		const readBack = contract.interactionPlan.find(
			(step) => step.stepId === 'read-back',
		)
		expect(readBack?.after).toBe('write')
		expect(readBack?.cardinality).toBe('exactly-one')
	})

	// Retraction defect 3: the `for-all` over `notes: []` was vacuously true
	// and reported `confirmed`/`agrees`. AD-4 fixed it at the grammar level in
	// spine revision 4; this is the first place the fix is visible in the chain.
	it('resolves the empty-collection quantifier to insufficient-evidence', () => {
		const outcome = outcomeOf('O-004')
		expect(outcome.checkResolution?.resolution).toBe('insufficient-evidence')
		expect(outcome.checkResolution?.introductionCondition).toBe(
			'empty-collection',
		)
		expect(outcome.state).toBe('abstained')
	})

	// The fourth defect, added by owed item 7 and never written into the
	// retraction: the run cited a probe nothing defined.
	it('scores against a probe the qualification gate admitted', () => {
		expect(probe.probeId).toBe('P-001')
		expect(chain.artifact.excludedProbeIds).toEqual([])
		expect(
			record.findings.every((finding) => finding.probeId === probe.probeId),
		).toBe(true)
	})
})

describe('the headline result the prose is built on', () => {
	// The byte snapshot alone does not guard this: its documented repair is to
	// regenerate, so a change that moves the verdict moves the snapshot with
	// it. Flipping the policy's severity floor from `material` to `critical`
	// yields CONCERNS and exit 0 while every other value this file asserts
	// stays put, which is what these three assertions exist to catch.
	it('resolves FAIL on the contract-scoring ladder, exit 2', () => {
		if (chain.artifact.mode !== 'contract-scoring') {
			throw new Error('the regenerated artifact is not contract-scoring')
		}
		expect(chain.artifact.contractVerdict).toBe('FAIL')
		expect(chain.artifact.exitCode).toBe(2)
		expect(chain.artifact.verdictBasis).toEqual([
			'oracle O-004 resolved abstained at or above the severity floor',
		])
	})

	// AD-31's predicates over this contract, not a hand-written list: only
	// `patch-note` nominates a success indicator beside another roled pointer,
	// so two of the three operations leave rule 1 unsatisfied, and the gap
	// severity is the highest declared behaviour severity.
	it('records the three unsatisfied AD-20 coverage gaps at critical', () => {
		expect(
			chain.artifact.coverageGaps.map((gap) => [gap.rule, gap.severity]),
		).toEqual([
			['success-indicator-separation', 'critical'],
			['malformed-input', 'critical'],
			['sibling-cross-check', 'critical'],
		])
		expect(chain.artifact.coverageGaps.every((gap) => !gap.satisfied)).toBe(
			true,
		)
	})

	// The FAIL tier suppresses every CONCERNS reason, so the three gaps, the
	// single completed trial, and O-005's `unreached` stay readable in
	// `coverageGaps` and `trials` rather than in `verdictBasis`.
	it('keeps the suppressed CONCERNS evidence on the artifact', () => {
		expect(chain.artifact.trials).toEqual({
			declaredMinimum: 3,
			completed: 1,
			invalidatedAttempts: [],
		})
		expect(chain.artifact.strength.comparable).toBe(false)
	})
})

// The renderer, the emitted key set, and the cross-check against
// `WORKED_EXAMPLE_FILES` otherwise rest on `npm run check:worked-example`
// alone, which runs outside vitest. `brief.json` also lands here: it is the
// only place the `seal` leg of the chain reaches an assertion.
describe('the emitted file set', () => {
	const files = buildWorkedExample()

	it('emits exactly the five declared keys', () => {
		expect([...files.keys()].sort()).toEqual(
			WORKED_EXAMPLE_FILES.map(
				(name) => `${WORKED_EXAMPLE_LABEL}/${name}`,
			).sort(),
		)
	})

	it('renders each file as re-indented JSON that parses back to the artifact', () => {
		for (const [path, text] of files) {
			expect(text.endsWith('\n'), path).toBe(true)
			expect(() => JSON.parse(text) as unknown).not.toThrow()
		}
		const brief = JSON.parse(
			files.get(`${WORKED_EXAMPLE_LABEL}/brief.json`) ?? '',
		) as { readonly contractDigest?: unknown }
		expect(brief.contractDigest).toBe(chain.brief.contractDigest)
	})
})
