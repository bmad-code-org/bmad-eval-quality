/**
 * `applyCoverageWaivers`: the join between a contract's AD-5 waivers and the
 * AD-31 coverage gaps `score` hands the AD-21 ladder.
 */
import { describe, expect, it } from 'vitest'
import type { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import type { CoverageGap } from '../../src/core/schemas/evidence-artifact.ts'
import { applyCoverageWaivers } from '../../src/core/score/coverage-waivers.ts'

type Waiver = EvalContract['waivers'][number]

const SCORED_AT = '2026-11-19T12:00:00Z'

const gap = (rule: string, satisfied = false): CoverageGap => ({
	rule,
	relevancePredicate: `${rule}-relevance`,
	satisfactionPredicate: `${rule}-satisfaction`,
	satisfied,
	severity: 'critical',
	waiverId: null,
})

const waiver = (overrides: Partial<Waiver> = {}): Waiver => ({
	id: 'W-001',
	rule: 'malformed-input',
	rationale: 'the skill under test controls no input parsing',
	condition: 'The operation is run-skill.',
	approval: 'approver, 2026-11-18',
	expiresAt: '2027-11-18T00:00:00Z',
	...overrides,
})

describe('applyCoverageWaivers', () => {
	it('stamps the waiver id on the unsatisfied gap whose rule it names', () => {
		const gaps = applyCoverageWaivers(
			[gap('success-indicator-separation'), gap('malformed-input')],
			[waiver()],
			SCORED_AT,
		)
		expect(gaps.map((entry) => entry.waiverId)).toEqual([null, 'W-001'])
	})

	it('keeps the gap otherwise unchanged, still unsatisfied', () => {
		const [waived] = applyCoverageWaivers(
			[gap('malformed-input')],
			[waiver()],
			SCORED_AT,
		)
		expect(waived).toEqual({ ...gap('malformed-input'), waiverId: 'W-001' })
	})

	it('an expired waiver reinstates its gap', () => {
		const gaps = applyCoverageWaivers(
			[gap('malformed-input')],
			[waiver({ expiresAt: '2026-11-19T11:59:59Z' })],
			SCORED_AT,
		)
		expect(gaps[0]?.waiverId).toBeNull()
	})

	it('a waiver expiring at the scoring instant has expired', () => {
		const gaps = applyCoverageWaivers(
			[gap('malformed-input')],
			[waiver({ expiresAt: SCORED_AT })],
			SCORED_AT,
		)
		expect(gaps[0]?.waiverId).toBeNull()
	})

	it('compares instants, so an offset spelling of the same moment is not mistaken for a later one', () => {
		const gaps = applyCoverageWaivers(
			[gap('malformed-input')],
			[waiver({ expiresAt: '2026-11-19T12:00:00.000Z' })],
			SCORED_AT,
		)
		expect(gaps[0]?.waiverId).toBeNull()
	})

	it('the first unexpired waiver in contract order wins when several name one rule', () => {
		const gaps = applyCoverageWaivers(
			[gap('malformed-input')],
			[
				waiver({ id: 'W-003', expiresAt: '2026-01-01T00:00:00Z' }),
				waiver({ id: 'W-002' }),
				waiver({ id: 'W-001' }),
			],
			SCORED_AT,
		)
		expect(gaps[0]?.waiverId).toBe('W-002')
	})

	it('a satisfied gap takes no waiver: there is nothing to excuse', () => {
		const gaps = applyCoverageWaivers(
			[gap('malformed-input', true)],
			[waiver()],
			SCORED_AT,
		)
		expect(gaps[0]?.waiverId).toBeNull()
	})

	it('records the condition without evaluating it: a conditioned waiver still applies', () => {
		const gaps = applyCoverageWaivers(
			[gap('malformed-input')],
			[waiver({ condition: 'any prose this stage cannot test' })],
			SCORED_AT,
		)
		expect(gaps[0]?.waiverId).toBe('W-001')
	})

	it('refuses a scoring instant that is not a timestamp', () => {
		expect(() =>
			applyCoverageWaivers([gap('malformed-input')], [waiver()], 'yesterday'),
		).toThrow(TypeError)
	})
})
