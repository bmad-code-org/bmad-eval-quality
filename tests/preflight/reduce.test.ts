/**
 * AD-10's verdict table (Story 6.2). One `it` per numbered fixture; each
 * `failed` fixture is a single mutation of its `satisfied` sibling, and each
 * assertion carries the literal outcome rather than re-deriving it.
 */
import { describe, expect, it } from 'vitest'
import { planPreflight } from '../../src/core/preflight/plan.ts'
import { reducePreflight } from '../../src/core/preflight/reduce.ts'
import type { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type { PreflightCheck } from '../../src/core/schemas/preflight-verdict.ts'
import type { Probe } from '../../src/core/schemas/probe.ts'
import { Probe as ProbeSchema } from '../../src/core/schemas/probe.ts'
import {
	cleanControlProbe,
	contractDraft,
	jsonBody,
	type ObservationPatch,
	observationsFor,
	parseContract,
	preflightContract,
	probeDraft,
	resetContract,
	satisfiedPatches,
	seededProbe,
} from './fixtures/observations.ts'

type Run = {
	readonly contract?: EvalContract
	readonly probes?: readonly Probe[]
	readonly patches?: Readonly<Record<string, ObservationPatch>>
	/** leg ids whose observation the port did not return. */
	readonly missing?: readonly string[]
}

const verdictOf = (run: Run = {}) => {
	const plan = planPreflight({
		contract: run.contract ?? preflightContract,
		probes: run.probes ?? [seededProbe],
		runId: 'run-1',
	})
	const answered = plan.legs.filter(
		(leg) => !(run.missing ?? []).includes(leg.legId),
	)
	const observations = observationsFor(answered, {
		...satisfiedPatches(answered),
		...(run.patches ?? {}),
	})
	return reducePreflight(plan, { observations })
}

const checkFor = (
	checks: readonly PreflightCheck[],
	kind: PreflightCheck['kind'],
	operationId: string | null = null,
): PreflightCheck => {
	const found = checks.filter(
		(check) => check.kind === kind && check.operationId === operationId,
	)
	if (found.length !== 1)
		throw new Error(
			`expected exactly one ${kind} check for ${operationId}, found ${found.length}`,
		)
	return found[0] as PreflightCheck
}

const outcomeOf = (
	run: Run,
	kind: PreflightCheck['kind'],
	operationId: string | null = null,
): PreflightCheck['outcome'] =>
	checkFor(verdictOf(run).checks, kind, operationId).outcome

describe('interface-present', () => {
	it('38. is satisfied when every planned leg answered with its own identifiers', () => {
		expect(outcomeOf({}, 'interface-present', 'read-thing')).toBe('satisfied')
	})

	it('39. fails when a planned leg produced no observation', () => {
		expect(
			outcomeOf({ missing: ['read-b'] }, 'interface-present', 'read-thing'),
		).toBe('failed')
	})

	it('40. fails when the echoed operationId differs from the request', () => {
		expect(
			outcomeOf(
				{ patches: { 'read-b': { operationId: 'create-thing' } } },
				'interface-present',
				'read-thing',
			),
		).toBe('failed')
	})
})

describe('input-sensitivity', () => {
	it('41. is satisfied on a body differential, which AD-10 selects for a mutating operation', () => {
		expect(outcomeOf({}, 'input-sensitivity', 'create-thing')).toBe('satisfied')
	})

	it("42. is satisfied on a path-parameter-only safe read, which is AD-10's named shape", () => {
		expect(outcomeOf({}, 'input-sensitivity', 'read-thing')).toBe('satisfied')
	})

	it('43. is satisfied on a query differential', () => {
		expect(outcomeOf({}, 'input-sensitivity', 'list-things')).toBe('satisfied')
	})

	// The input-blind negative: the read answers with the same body whatever
	// identifier it was given, which is the defect AD-10 exists to catch.
	it('44. fails on that same path-parameter-only safe read when the response is input-blind', () => {
		expect(
			outcomeOf(
				{
					patches: {
						'read-b': { body: jsonBody({ id: 't-1', value: 'alpha' }) },
					},
				},
				'input-sensitivity',
				'read-thing',
			),
		).toBe('failed')
	})

	it('45. fails when the relation resolves false on the body differential', () => {
		expect(
			outcomeOf(
				{
					patches: {
						'create-b': jsonPatch({ id: 'x-2', ok: true, echo: 'alpha' }),
					},
				},
				'input-sensitivity',
				'create-thing',
			),
		).toBe('failed')
	})

	// AD-10's own sentence and the story's most load-bearing line: a check that
	// examined nothing has not established sensitivity.
	it('46. fails when the relation resolves insufficient-evidence', () => {
		const check = checkFor(
			verdictOf({
				patches: {
					'list-a': jsonPatch({ items: [] }),
					'list-b': jsonPatch({ items: [] }),
				},
			}).checks,
			'input-sensitivity',
			'list-things',
		)
		expect(check.outcome).toBe('failed')
		// The note is asserted too, not decoration: `insufficient-evidence` and
		// `false` both land on `failed`, so without it the branch that tells them
		// apart could be deleted and this fixture would stay green.
		expect(check.note).toBe(
			'The witness relation resolved insufficient-evidence.',
		)
	})

	it('47. is exempt for an operation declaring no keys in any channel', () => {
		const check = checkFor(
			verdictOf().checks,
			'input-sensitivity',
			'reset-things',
		)
		expect(check.outcome).toBe('exempt')
		expect(check.note).toBe('The operation declares no inputs in any channel.')
	})
})

describe('state-reset', () => {
	it('48. is satisfied on the repeated-read branch', () => {
		expect(outcomeOf({}, 'state-reset')).toBe('satisfied')
	})

	it('49. fails when the two projections differ', () => {
		expect(
			outcomeOf(
				{
					patches: {
						'preflight-control-observe-2': jsonPatch({
							id: 't-1',
							value: 'changed',
						}),
					},
				},
				'state-reset',
			),
		).toBe('failed')
	})

	// The comparison is canonical, not `JSON.stringify`: two adapters, or one
	// adapter over a map-backed serialiser, can emit the same body with its keys
	// in a different order, and invalidating a run over that is invalidating it
	// over a difference that is not one.
	it('124. is satisfied when the two projections differ only in body key order', () => {
		expect(
			outcomeOf(
				{
					patches: {
						'preflight-control-observe': jsonPatch({
							id: 't-1',
							value: 'alpha',
						}),
						'preflight-control-observe-2': jsonPatch({
							value: 'alpha',
							id: 't-1',
						}),
					},
				},
				'state-reset',
			),
		).toBe('satisfied')
	})

	it('50. is satisfied on the four-leg branch with a declared fixtureReset', () => {
		expect(outcomeOf({ contract: resetContract }, 'state-reset')).toBe(
			'satisfied',
		)
	})

	// 51 and 52 are the pair that proves the pruning is real. If `pruneVolatile`
	// were a no-op both would fail; if it pruned unconditionally both would pass.
	it('51. fails when the fixture returns an undeclared volatile field', () => {
		expect(outcomeOf({ patches: driftPatches() }, 'state-reset')).toBe('failed')
	})

	it('52. is satisfied when that same field is declared volatile', () => {
		const draft = contractDraft()
		draft.permittedInterfaces[0].operations[1].volatilePointers = ['/servedAt']
		expect(
			outcomeOf(
				{ contract: parseContract(draft), patches: driftPatches() },
				'state-reset',
			),
		).toBe('satisfied')
	})
})

describe('clean-control', () => {
	it('53. is satisfied when every control leg observed a non-anomalous status', () => {
		expect(outcomeOf({}, 'clean-control')).toBe('satisfied')
	})

	// Both control-observe legs carry the status, not one: the projection
	// includes it, so patching a single leg would also flip `state-reset` and
	// the fixture would stop isolating the threshold it is about.
	const atStatus = (status: number) => ({
		'preflight-control-observe': { status },
		'preflight-control-observe-2': { status },
	})

	it('54. fails on a 500 on a control leg', () => {
		expect(outcomeOf({ patches: atStatus(500) }, 'clean-control')).toBe(
			'failed',
		)
	})

	it('55. is satisfied at the boundary: status 399', () => {
		const { checks } = verdictOf({ patches: atStatus(399) })
		expect(checkFor(checks, 'clean-control').outcome).toBe('satisfied')
		expect(checkFor(checks, 'state-reset').outcome).toBe('satisfied')
	})

	it('56. fails at the boundary: status 400', () => {
		const { checks } = verdictOf({ patches: atStatus(400) })
		expect(checkFor(checks, 'clean-control').outcome).toBe('failed')
		// the threshold alone moved: nothing else about the two legs changed
		expect(checkFor(checks, 'state-reset').outcome).toBe('satisfied')
	})

	// AD-10's own worked example: two distinct nonexistent identifiers both
	// returning 404. A `clean-control` that read sensitivity legs would fail a
	// contract that followed the architecture verbatim.
	it('57. is unaffected by a 404 on a sensitivity leg, and that leg still establishes sensitivity', () => {
		const patches = {
			'read-a': {
				status: 404,
				body: jsonBody({ id: 't-1', value: 'not found' }),
			},
			'read-b': {
				status: 404,
				body: jsonBody({ id: 't-2', value: 'not found' }),
			},
		}
		expect(outcomeOf({ patches }, 'clean-control')).toBe('satisfied')
		expect(outcomeOf({ patches }, 'input-sensitivity', 'read-thing')).toBe(
			'satisfied',
		)
	})
})

describe('the two seeded-fault checks, which are disjoint by construction', () => {
	it('58. seeded-faults-scoped is satisfied when the witness fires on no clean leg', () => {
		expect(outcomeOf({}, 'seeded-faults-scoped', 'list-things')).toBe(
			'satisfied',
		)
	})

	it('59. seeded-faults-scoped fails when the witness resolves true on a clean leg', () => {
		expect(
			outcomeOf(
				{ patches: { 'list-a': jsonPatch({ items: [{ broken: true }] }) } },
				'seeded-faults-scoped',
				'list-things',
			),
		).toBe('failed')
	})

	it('60. seeded-faults-scoped stays satisfied even when the witness resolves false on its own fault leg', () => {
		expect(
			outcomeOf(
				{ patches: faultSilentPatch() },
				'seeded-faults-scoped',
				'list-things',
			),
		).toBe('satisfied')
	})

	it('61. seeded-fault-fired is satisfied when the witness resolves true on its own fault leg', () => {
		expect(outcomeOf({}, 'seeded-fault-fired', 'list-things')).toBe('satisfied')
	})

	// The disjointness assertion: exactly one of the two checks flips.
	it('62. seeded-fault-fired fails when the relation resolves false, while seeded-faults-scoped stays satisfied', () => {
		const { checks } = verdictOf({ patches: faultSilentPatch() })
		expect(checkFor(checks, 'seeded-fault-fired', 'list-things').outcome).toBe(
			'failed',
		)
		expect(
			checkFor(checks, 'seeded-faults-scoped', 'list-things').outcome,
		).toBe('satisfied')
	})

	it('63. seeded-fault-fired fails when manifestationWitness is null', () => {
		const draft = probeDraft()
		draft.defects[0].manifestationWitness = null
		const { checks } = verdictOf({ probes: [ProbeSchema.parse(draft)] })
		expect(checkFor(checks, 'seeded-fault-fired').outcome).toBe('failed')
		expect(
			checks.filter((check) => check.kind === 'seeded-faults-scoped'),
		).toEqual([])
	})

	it('64. seeded-fault-fired fails when the relation resolves insufficient-evidence', () => {
		const check = checkFor(
			verdictOf({ patches: { 'fault-leg': jsonPatch({ items: [] }) } }).checks,
			'seeded-fault-fired',
			'list-things',
		)
		expect(check.outcome).toBe('failed')
		// Same reason as fixture 46: the note is what separates
		// `insufficient-evidence` from `false`, since both fail.
		expect(check.note).toContain('insufficient-evidence')
		expect(
			checkFor(
				verdictOf({ patches: faultSilentPatch() }).checks,
				'seeded-fault-fired',
				'list-things',
			).note,
		).toContain('false')
	})

	// `PreflightCheck` has nowhere to put a defect id, so defect identity lives
	// in `note`; two failing defects would otherwise be indistinguishable.
	it('65. distinguishes two failing defects by note', () => {
		const draft = probeDraft()
		draft.defects[0].manifestationWitness = null
		draft.defects.push({
			...structuredClone(draft.defects[0]),
			defectId: 'D-002',
			summary: 'A second defect with no declared witness.',
		})
		const { checks } = verdictOf({ probes: [ProbeSchema.parse(draft)] })
		const fired = checks.filter((check) => check.kind === 'seeded-fault-fired')
		expect(fired.map((check) => check.outcome)).toEqual(['failed', 'failed'])
		expect(fired[0]?.note).toContain('D-001')
		expect(fired[1]?.note).toContain('D-002')
	})
})

describe('the verdict itself', () => {
	it('66. passes when every check is satisfied or exempt, and fails when any check failed', () => {
		const clean = verdictOf()
		expect(clean.checks.map((check) => check.outcome)).toContain('exempt')
		expect(clean.checks.map((check) => check.outcome)).not.toContain('failed')
		expect(clean.passed).toBe(true)
		expect(verdictOf({ patches: faultSilentPatch() }).passed).toBe(false)
	})

	it('67. is an origin artifact: schemaVersion 1, no parent, revision 0', () => {
		const verdict = verdictOf()
		expect(verdict.schemaVersion).toBe(1)
		expect(verdict.parentDigest).toBeNull()
		expect(verdict.revisionCount).toBe(0)
		expect(verdict.runId).toBe('run-1')
	})

	// The port echoes `probeId` unchanged by contract, so a plan whose legs all
	// go unanswered is the port failing that contract. Before this it was an
	// untyped `TypeError` out of `fixtureDigest`, raised from inside the
	// returned object literal, which threw away the `interface-present: failed`
	// row computed to catch exactly this.
	it('122. raises a typed port-contract-violation, not a bare TypeError, when no observation echoes a planned probe id', () => {
		const plan = planPreflight({
			contract: preflightContract,
			probes: [seededProbe],
			runId: 'run-1',
		})
		const misEchoed = observationsFor(plan.legs).map((observation) => ({
			...observation,
			probeId: `stray-${observation.probeId}`,
		}))
		let thrown: unknown
		try {
			reducePreflight(plan, { observations: misEchoed })
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(RuntimeFault)
		expect(thrown).not.toBeInstanceOf(TypeError)
		expect((thrown as RuntimeFault).code).toBe('port-contract-violation')
		expect((thrown as RuntimeFault).artifactPath).toBe('PreflightVerdict')
	})

	it('68. emits no seeded-fault check at all for a contract with no seeded faults', () => {
		const { checks } = verdictOf({ probes: [cleanControlProbe] })
		expect(
			checks.filter((check) => check.kind.startsWith('seeded-fault')),
		).toEqual([])
		expect(checks.length).toBeGreaterThan(0)
	})
})

function jsonPatch(value: Parameters<typeof jsonBody>[0]): ObservationPatch {
	return { body: jsonBody(value) }
}

/** the two control-observe legs disagreeing on one undeclared response field. */
function driftPatches(): Record<string, ObservationPatch> {
	return {
		'preflight-control-observe': jsonPatch({
			id: 't-1',
			value: 'alpha',
			servedAt: 'T1',
		}),
		'preflight-control-observe-2': jsonPatch({
			id: 't-1',
			value: 'alpha',
			servedAt: 'T2',
		}),
	}
}

/** the seeded fault failing to fire on its own leg. */
function faultSilentPatch(): Record<string, ObservationPatch> {
	return { 'fault-leg': jsonPatch({ items: [{ id: 'r-1', broken: false }] }) }
}
