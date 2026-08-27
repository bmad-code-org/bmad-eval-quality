/**
 * AD-34's planning half for pre-flight (Story 6.2). The plan is pure and
 * synchronous, and it carries everything the reducer reads, because
 * `ReduceStage` gets the plan and the observations and nothing else.
 */
import { describe, expect, it } from 'vitest'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import {
	type PlannedLeg,
	type PreflightPlan,
	planPreflight,
} from '../../src/core/preflight/plan.ts'
import type { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import type { Probe } from '../../src/core/schemas/probe.ts'
import { Probe as ProbeSchema } from '../../src/core/schemas/probe.ts'
import {
	cleanControlProbe,
	contractDraft,
	inputsOf,
	parseContract,
	preflightContract,
	probeDraft,
	resetContract,
	seededProbe,
} from './fixtures/observations.ts'

const planOf = (
	contract: EvalContract = preflightContract,
	probes: readonly Probe[] = [seededProbe],
): PreflightPlan => planPreflight({ contract, probes, runId: 'run-1' })

const legsFor = (plan: PreflightPlan, operationId: string): PlannedLeg[] =>
	plan.legs.filter((leg) => leg.operation.operationId === operationId)

const failureOf = (act: () => unknown): StructuralFailure => {
	try {
		act()
	} catch (error) {
		if (error instanceof StructuralFailure) return error
		throw error
	}
	throw new Error('expected a StructuralFailure to be thrown')
}

describe('the sensitivity legs', () => {
	it('91. plans two legs per witness, each with probeId equal to its leg id', () => {
		const plan = planOf()
		const legs = legsFor(plan, 'create-thing').filter(
			(leg) => leg.purpose === 'sensitivity',
		)
		expect(legs.map((leg) => leg.legId)).toEqual(['create-a', 'create-b'])
		for (const leg of legs) expect(leg.request.probeId).toBe(leg.legId)
	})

	it("92. carries the operation's method and path template unchanged", () => {
		const [leg] = legsFor(planOf(), 'read-thing')
		expect(leg?.request.method).toBe('GET')
		expect(leg?.request.pathTemplate).toBe('/things/{id}')
		expect(leg?.request.interfaceId).toBe('thing-api')
		expect(leg?.request.operationId).toBe('read-thing')
	})

	it('93. maps WitnessInputs onto ProbeRequest.channels with no conversion loss', () => {
		const leg = planOf().legs.find(
			(candidate) => candidate.legId === 'create-a',
		)
		expect(leg?.request.channels).toEqual({
			path: {},
			query: {},
			header: {},
			body: { kind: 'json', value: { name: 'alpha' } },
		})
		expect(leg?.request.channels).toEqual(leg?.inputs)
	})

	it('94. plans no leg and one exempt-bound check for an operation with a null witness', () => {
		const plan = planOf()
		expect(legsFor(plan, 'reset-things')).toEqual([])
		const checks = plan.checks.filter(
			(check) =>
				check.kind === 'input-sensitivity' &&
				check.operationId === 'reset-things',
		)
		expect(checks).toHaveLength(1)
		expect(
			checks[0]?.kind === 'input-sensitivity' ? checks[0].witness : undefined,
		).toBeNull()
	})
})

describe('the control legs', () => {
	const controlLegs = (plan: PreflightPlan) =>
		plan.legs.filter((leg) => leg.purpose.startsWith('control-'))

	it('95. plans the repeated-read branch when fixtureReset is null', () => {
		expect(controlLegs(planOf()).map((leg) => leg.purpose)).toEqual([
			'control-observe',
			'control-observe',
		])
	})

	it('96. plans the four-leg branch, in order, when fixtureReset and a mutating operation both exist', () => {
		const legs = controlLegs(planOf(resetContract))
		expect(legs.map((leg) => leg.purpose)).toEqual([
			'control-observe',
			'control-mutate',
			'control-reset',
			'control-observe',
		])
		const stateReset = planOf(resetContract).checks.find(
			(check) => check.kind === 'state-reset',
		)
		// AD-10 counts the first and third observations; here the reset is a leg
		// like any other, so the check names the first and the fourth.
		expect(stateReset?.kind === 'state-reset' ? stateReset.legIds : []).toEqual(
			[legs[0]?.legId, legs[3]?.legId],
		)
	})

	it('97. does not plan the four-leg branch when no operation on that interface changes state', () => {
		const draft = contractDraft()
		for (const operation of draft.permittedInterfaces[0].operations)
			operation.stateChangeMarker = false
		// `body` is only legal where the marker is true, so the write's witness
		// moves with it; this fixture is about the branch, not the channel.
		draft.permittedInterfaces[0].operations[0].sensitivityWitness.channel =
			'query'
		draft.fixtureReset = {
			legId: 'reset-leg',
			interfaceId: 'thing-api',
			operationId: 'reset-things',
			inputs: inputsOf(),
		}
		expect(
			controlLegs(planOf(parseContract(draft))).map((leg) => leg.purpose),
		).toEqual(['control-observe', 'control-observe'])
	})

	// Pinned so a later change to the selection rule is visible here rather
	// than silent.
	it('98. selects the control operations in declaration order', () => {
		const legs = controlLegs(planOf(resetContract))
		expect(legs.map((leg) => leg.operation.operationId)).toEqual([
			'read-thing',
			'create-thing',
			'reset-things',
			'read-thing',
		])
	})
})

describe('the seeded-fault legs', () => {
	it('99. plans one leg per defect of an expectedClean: false probe', () => {
		const legs = planOf().legs.filter((leg) => leg.purpose === 'seeded-fault')
		expect(legs.map((leg) => leg.legId)).toEqual(['fault-leg'])
	})

	it('100. plans zero legs for an expectedClean: true probe', () => {
		const plan = planOf(preflightContract, [cleanControlProbe])
		expect(plan.legs.filter((leg) => leg.purpose === 'seeded-fault')).toEqual(
			[],
		)
		expect(
			plan.checks.filter((check) => check.kind.startsWith('seeded-fault')),
		).toEqual([])
	})

	it('101. plans no leg and one check for a defect with a null manifestation witness', () => {
		const draft = probeDraft()
		draft.defects[0].manifestationWitness = null
		const plan = planOf(preflightContract, [ProbeSchema.parse(draft)])
		expect(plan.legs.filter((leg) => leg.purpose === 'seeded-fault')).toEqual(
			[],
		)
		const seeded = plan.checks.filter((check) =>
			check.kind.startsWith('seeded-fault'),
		)
		expect(seeded.map((check) => check.kind)).toEqual(['seeded-fault-fired'])
	})

	// `Probe` is not part of the contract, so the compiler never sees this;
	// the plan is where the artifact is available.
	it('102. throws unreachable-check-evidence for a witness naming an undeclared operation', () => {
		const draft = probeDraft()
		draft.defects[0].manifestationWitness.operationId = 'purge-things'
		const failure = failureOf(() =>
			planOf(preflightContract, [ProbeSchema.parse(draft)]),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toBe(
			'Probe[probeId=P-001].defects[defectId=D-001].manifestationWitness',
		)
	})
})

describe('the plan as a whole', () => {
	it('103. throws unsupported-interface-kind for a web interface', () => {
		const draft = contractDraft()
		draft.permittedInterfaces[0].kind = 'web'
		const failure = failureOf(() => planOf(parseContract(draft)))
		expect(failure.code).toBe('unsupported-interface-kind')
		expect(failure.artifactPath).toBe(
			'EvalContract.permittedInterfaces[logicalId=thing-api].kind',
		)
	})

	it('104. is deterministic: two calls on the same input produce deep-equal plans', () => {
		expect(planOf(resetContract)).toEqual(planOf(resetContract))
		expect(planOf()).toEqual(planOf())
	})

	// Sourcing control-leg inputs from a witness alone made the immutability
	// branch unreachable for exactly the contract that most needs it: AD-10
	// exempts a keyless operation from carrying a witness, so a read-only
	// contract whose only safe read is a parameterless GET planned no control
	// leg at all and passed with no immutability evidence.
	it('119. still plans the control legs when the only safe read is keyless and carries no witness', () => {
		const draft = contractDraft()
		draft.permittedInterfaces[0].operations = [
			{
				...structuredClone(draft.permittedInterfaces[0].operations[3]),
				operationId: 'ping-thing',
				method: 'GET',
				pathTemplate: '/ping',
				stateChangeMarker: false,
			},
		]
		const plan = planOf(parseContract(draft), [cleanControlProbe])
		expect(plan.legs.map((leg) => leg.purpose)).toEqual([
			'control-observe',
			'control-observe',
		])
		expect(plan.checks.map((check) => check.kind).sort()).toEqual([
			'clean-control',
			'input-sensitivity',
			'interface-present',
			'state-reset',
		])
	})

	// AC 10 rule 3 names the mutating operation "on the interface `fixtureReset`
	// names", which does not require the observed read to live there.
	it('120. plans the four-leg branch when the fixture reset names a different interface than the observed read', () => {
		const draft = contractDraft()
		const other = structuredClone(draft.permittedInterfaces[0])
		other.logicalId = 'other-api'
		other.operations = [
			{
				...structuredClone(draft.permittedInterfaces[0].operations[3]),
				operationId: 'purge-things',
				method: 'POST',
				pathTemplate: '/purge',
				stateChangeMarker: true,
			},
		]
		draft.permittedInterfaces.push(other)
		draft.fixtureReset = {
			legId: 'reset-leg',
			interfaceId: 'other-api',
			operationId: 'purge-things',
			inputs: inputsOf(),
		}
		const legs = planOf(parseContract(draft)).legs.filter((leg) =>
			leg.purpose.startsWith('control-'),
		)
		expect(legs.map((leg) => leg.purpose)).toEqual([
			'control-observe',
			'control-mutate',
			'control-reset',
			'control-observe',
		])
		expect(legs.map((leg) => leg.request.interfaceId)).toEqual([
			'thing-api',
			'other-api',
			'other-api',
			'thing-api',
		])
	})

	// AD-11 makes the fixture digest required, and a digest over no observation
	// would certify a pre-flight that verified nothing.
	it('121. throws unreachable-check-evidence for a contract that offers nothing to probe', () => {
		const draft = contractDraft()
		draft.permittedInterfaces = []
		const failure = failureOf(() =>
			planOf(parseContract(draft), [cleanControlProbe]),
		)
		expect(failure.code).toBe('unreachable-check-evidence')
		expect(failure.artifactPath).toBe('EvalContract.permittedInterfaces')
	})

	// `Operation.operationId` is scoped to a `PermittedInterface`, and its own
	// schema description says two interfaces may declare the same one. Grouped
	// by operation id alone, one interface's legs become another's clean legs.
	it("123. keeps two interfaces' legs apart when they declare the same operation id", () => {
		const draft = contractDraft()
		const other = structuredClone(draft.permittedInterfaces[0])
		other.logicalId = 'other-api'
		for (const operation of other.operations) {
			operation.pathTemplate = `/other${operation.pathTemplate}`
			for (const leg of operation.sensitivityWitness?.legs ?? [])
				leg.legId = `other-${leg.legId}`
			if (operation.sensitivityWitness !== null)
				operation.sensitivityWitness.relation = {
					op: 'existence',
					operands: [
						{
							pointer: `/interactions/${operation.sensitivityWitness.legs[0].legId}/response-body`,
						},
					],
				}
		}
		draft.permittedInterfaces.push(other)
		const plan = planOf(parseContract(draft))
		const presence = plan.checks.filter(
			(check) => check.kind === 'interface-present',
		)
		for (const check of presence) {
			if (check.kind !== 'interface-present') continue
			const prefixed = check.interfaceId === 'other-api'
			for (const legId of check.legIds)
				expect(
					legId.startsWith('other-'),
					`${check.interfaceId}/${legId}`,
				).toBe(prefixed)
		}
		const scoped = plan.checks.find(
			(check) => check.kind === 'seeded-faults-scoped',
		)
		expect(
			scoped?.kind === 'seeded-faults-scoped' ? scoped.cleanLegIds : [],
		).toEqual(['list-a', 'list-b'])
	})
})
