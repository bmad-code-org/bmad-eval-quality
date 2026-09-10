/**
 * The committed chain that carries a captured step binding and a fixture reset
 * end to end, read at value level.
 *
 * `buildWorkflowExampleChain` is the pure builder the generator renders and the
 * drift check compares, so nothing here touches the filesystem and nothing here
 * can disagree with what is committed. Every assertion below reads a value the
 * chain computed rather than a value the builder was handed: the plan, the
 * pre-flight verdict, the resolved capture, the witness partition, the outcome
 * states, and the strength vector are all returns of the shipped stages.
 *
 * The two things this file exists for are the capture and the control branch.
 * A `{ captured }` binding had a schema, three compile checks, and unit tests
 * behind it and no artifact; the four-leg control branch a `fixtureReset` plans
 * had `tests/preflight/plan.test.ts` and no artifact. Both are values here.
 */
import { describe, expect, it } from 'vitest'
import { buildWorkflowExampleChain } from '../../scripts/workflow-example-target.ts'
import { compile } from '../../src/application/compile.ts'
import { serializeArtifact } from '../../src/application/serialize.ts'
import { digestBytes } from '../../src/core/canonical/digest.ts'
import { planPreflight } from '../../src/core/preflight/plan.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { resolveCapturedBindings } from '../../src/core/score/bindings.ts'
import { resolveHomeOperation } from '../../src/core/score/qualification.ts'
import { buildPlanIndex } from '../../src/core/seal/plan-index.ts'
import {
	SEEDED_ID,
	SUBSTITUTED_NAME,
	WRITTEN_NAME,
	workflowContract,
} from '../schemas/fixtures/workflow-contract.ts'

const chain = buildWorkflowExampleChain()
const { contract, probe, record, artifact, preflightVerdict, witness } = chain

const outcomeOf = (oracleId: string) =>
	artifact.outcomes.find((outcome) => outcome.oracleId === oracleId)

const observationNamed = (observationId: string) => {
	const found = record.observations.find(
		(observation) => observation.observationId === observationId,
	)
	if (found === undefined) {
		throw new Error(`the chain's record carries no "${observationId}"`)
	}
	return found
}

/** The response body as an object, which every observation in this chain carries. */
const bodyOf = (observation: {
	readonly responseBody: unknown
}): Record<string, unknown> =>
	observation.responseBody as Record<string, unknown>

/** The plan the chain's own verdict was reduced over, replanned from the same inputs. */
const plan = planPreflight({
	contract: EvalContract.parse(workflowContract),
	probes: [probe],
	runId: 'workflow-capture-run-0001',
})

describe('the workflow chain, as the shipped stages computed it', () => {
	it('plans the four control legs in order, around the reset the contract names', () => {
		// The order is the claim. `state-reset` compares the first
		// control-observe against the last, so a plan that emitted the reset
		// before the mutation, or dropped either, would compare two reads of a
		// fixture nothing had disturbed and report a reset that never happened.
		expect(
			plan.legs
				.filter((leg) => leg.purpose.startsWith('control-'))
				.map((leg) => [leg.legId, leg.purpose, leg.operation.operationId]),
		).toEqual([
			['preflight-control-observe', 'control-observe', 'get-thing'],
			['preflight-control-mutate', 'control-mutate', 'create-thing'],
			['reset-the-store', 'control-reset', 'reset-things'],
			['preflight-control-observe-2', 'control-observe', 'get-thing'],
		])
		// The third element of each tuple is where the contract's own addition
		// sits: the mutating leg and the reset leg are two different operations,
		// where the tool-server exemplar's reset names the operation the mutating
		// leg already used. `contract.fixtureReset.operationId` is not asserted
		// beside it, because the reset leg's operation above is that field read
		// through the planner.
		// `state-reset` names the first and the fourth, and `clean-control` all
		// four. Both are read off the plan rather than restated, so a planner
		// that minted a third observe leg would move these together.
		const stateReset = plan.checks.find((check) => check.kind === 'state-reset')
		const cleanControl = plan.checks.find(
			(check) => check.kind === 'clean-control',
		)
		expect(
			stateReset?.kind === 'state-reset' ? stateReset.legIds : null,
		).toEqual(['preflight-control-observe', 'preflight-control-observe-2'])
		expect(
			cleanControl?.kind === 'clean-control' ? cleanControl.legIds : null,
		).toEqual([
			'preflight-control-observe',
			'preflight-control-mutate',
			'reset-the-store',
			'preflight-control-observe-2',
		])
	})

	it('emits a pre-flight verdict its own reducer computed', () => {
		// The builder aborts on a failed verdict, so this line catches nothing
		// the build does not. It stays because it is the boundary between the two
		// halves of the chain; the check list below it is what pins the plan.
		expect(preflightVerdict.passed).toBe(true)
		// Every planned leg reached a resolved check. `state-reset` and
		// `clean-control` are the two rows the planner emits only when control
		// legs could be planned at all, so their presence here is what the
		// committed bytes carry of the four legs: `PreflightVerdict` records
		// checks and a fixture digest and no leg list.
		expect(
			preflightVerdict.checks.map((check) => [check.kind, check.outcome]),
		).toEqual([
			['interface-present', 'satisfied'],
			['interface-present', 'satisfied'],
			['interface-present', 'satisfied'],
			['input-sensitivity', 'satisfied'],
			['input-sensitivity', 'satisfied'],
			['input-sensitivity', 'satisfied'],
			['state-reset', 'satisfied'],
			['clean-control', 'satisfied'],
			['seeded-faults-scoped', 'satisfied'],
			['seeded-fault-fired', 'satisfied'],
		])
		// The verdict is what `emit` was handed as the fixture digest, the same
		// restatement `runScore` performs, so a chain that authored a verdict
		// beside the one it scored under would disagree here.
		expect(preflightVerdict.fixtureDigest).toBe(
			artifact.scoringVersionInputs.fixtureDigest,
		)
	})

	it('resolves the capture to the identifier the write minted', () => {
		const index = buildPlanIndex(
			contract.interactionPlan,
			contract.permittedInterfaces,
		)
		const resolved = [
			...resolveCapturedBindings(
				contract.interactionPlan,
				index,
				record.observations,
			).values(),
		]
		// One capture in the plan, and it resolves to a value no literal in the
		// contract could have named: the service minted it during the run.
		expect(resolved).toEqual([
			{
				status: 'resolved',
				value: 't-7',
				observationId: 'obs-create',
				sequence: 3,
			},
		])
		// The value the capture read is the one the write's own response carried,
		// stated against the record rather than against the literal above.
		expect(bodyOf(observationNamed('obs-create')).id).toBe('t-7')
		// And it is a field the contract declares volatile, so the pre-flight
		// projection prunes it and the write's two sensitivity legs are left
		// differing on the name they echo rather than on a counter. The capture
		// reads the raw observation and resolves the same field anyway. The two
		// readings of one field are the reason this contract holds both.
		const write = contract.permittedInterfaces[0]?.operations.find(
			(operation) => operation.operationId === 'create-thing',
		)
		expect(write?.volatilePointers).toEqual(['/id'])
	})

	it('resolves the signature home to the read rather than to the write', () => {
		const signature = probe.defectSignature
		if (signature.interfaceKind !== 'api') {
			throw new Error('the probe declares no api signature')
		}
		const home = resolveHomeOperation(signature, contract.permittedInterfaces)
		// The write's own response is indistinguishable from a correct one, so a
		// signature homed there would separate nothing, and what this line proves
		// is that the resolver matched on the declared template rather than on
		// the interface. It does not prove the kind-only case: `get-thing` is
		// declared first, so a resolver taking the first operation of the
		// matching family lands on the expected value here. That mutation is
		// caught in `tests/score/qualification.test.ts`, over contracts written
		// for it.
		expect(home?.operationId).toBe('get-thing')
	})

	it('partitions the candidates rather than only finding one that fits', () => {
		// Duplicates a builder guard, kept for the reason the pre-flight line
		// above is kept.
		expect(witness.result).toBe('matched')
		// The refuting member is what says the condition discriminates: the
		// evaluator read a record the reset had just seeded, the name came back
		// as the reset had given it, and the condition resolved false over it. A
		// partition holding only satisfying members is consistent with a
		// condition true of everything the selector admits.
		expect(witness.partition).toEqual({
			satisfying: ['obs-read-back'],
			refuting: ['obs-reset-read-back', 'obs-malformed-read'],
			inconclusive: [],
		})
	})

	it('catches the defect on the oracle that reads the captured step', () => {
		// O-002 is the read-back relation, and the step it addresses is the one
		// the capture feeds. Its `state` and `checkResolution` are pinned beside
		// its authored `disposition`, because flipping the disposition alone
		// scores identically on `state` and moves `corroboration`; all three are
		// read so no one of them can move unnoticed.
		expect(outcomeOf('O-002')?.state).toBe('caught')
		expect(outcomeOf('O-002')?.checkResolution?.resolution).toBe('false')
		expect(outcomeOf('O-002')?.disposition).toBe('violated')
		expect(outcomeOf('O-002')?.corroboration).toBe('agrees')
		// The reset's own read-back holds over the same relation, which is what
		// makes the defect a property of the write rather than of the read.
		expect(outcomeOf('O-007')?.state).toBe('confirmed')
		expect(outcomeOf('O-007')?.checkResolution?.resolution).toBe('true')
		expect(outcomeOf('O-007')?.corroboration).toBe('agrees')
	})

	it('reaches every oracle the contract declares', () => {
		// Seven oracles, seven outcomes, and no `unreached` among them. The
		// three type-violating steps are `at-most-one`, so a record that skipped
		// them would still score: O-003 would resolve against no observation,
		// come back `unreached`, and put itself in the verdict basis. The run
		// makes all three calls, which is what keeps the published exemplar's
		// own chain from shipping with three of its seven steps unexercised.
		expect(
			artifact.outcomes.map((outcome) => [
				outcome.oracleId,
				outcome.state,
				outcome.corroboration,
			]),
		).toEqual([
			['O-001', 'confirmed', 'agrees'],
			['O-002', 'caught', 'agrees'],
			['O-003', 'confirmed', 'agrees'],
			['O-004', 'confirmed', 'agrees'],
			['O-005', 'confirmed', 'agrees'],
			['O-006', 'confirmed', 'agrees'],
			['O-007', 'confirmed', 'agrees'],
		])
	})

	it('puts a number where the workflow guide reported none', () => {
		expect(artifact.strength.vector.defect).toEqual({
			exercised: 1,
			caught: 1,
			rate: 1,
		})
		expect(artifact.strength.vector.gameability).toBeNull()
		expect(artifact.strength.vector['zero-action']).toBeNull()
	})

	it('marks the vector non-comparable and says why', () => {
		expect(artifact.trials).toEqual({
			declaredMinimum: 3,
			completed: 1,
			invalidatedAttempts: [],
		})
		expect(artifact.strength.comparable).toBe(false)
		expect(artifact.strength.note).toContain('Below the declared minimum of 3')
	})

	it('lands on a rung with the trial-set shortfall named in its basis', () => {
		expect(artifact.mode).toBe('contract-scoring')
		if (artifact.mode !== 'contract-scoring') return
		expect(artifact.contractVerdict).toBe('CONCERNS')
		expect(artifact.exitCode).toBe(0)
		// One entry, and it is the trial count. The skill chain's basis also
		// names two coverage gaps; this contract satisfies every discipline rule
		// its declarations make relevant, and every oracle it declares is
		// reached, so the trial-set shortfall is all that is left.
		expect(artifact.verdictBasis).toEqual([
			'1 completed trials below the declared minimum of 3',
		])
	})

	it('scores the contract the corpus publishes', () => {
		// The bytes `dev-corpus-target.ts` writes to
		// `corpus/dev/contracts/captured-read-back.json`, rebuilt here from the
		// same fixture rather than read off disk, since a test reading that
		// directory would be filesystem I/O AD-30 forbids. Hashing them with the
		// trailing newline stripped is what an adopter runs, and it reproduces
		// the digest the chain's own run record carries. A chain that authored
		// its own copy of the contract instead of importing the fixture fails
		// here.
		const published = serializeArtifact(
			compile(EvalContract.parse(workflowContract)),
			'EvalContract',
		)
		expect(contract.contractId).toBe('captured-read-back')
		expect(
			digestBytes(new TextEncoder().encode(published.replace(/\n$/, ''))),
		).toBe(record.contractDigest)
	})

	it('quotes the two names the defect is the difference between', () => {
		// The record's own evidence, so the prose in the finding and the bytes in
		// the observations cannot drift apart. The read answered at the seeded
		// identifier with the name the reset gave it, and at the minted one with
		// the placeholder the store filled in where the write's own name should
		// have gone.
		const readBack = observationNamed('obs-read-back')
		const seededRead = observationNamed('obs-reset-read-back')
		const write = observationNamed('obs-create')
		expect(bodyOf(readBack).thing).toEqual({
			id: 't-7',
			name: SUBSTITUTED_NAME,
		})
		expect(bodyOf(seededRead).thing).toEqual({
			id: SEEDED_ID,
			name: 'alpha',
		})
		expect(readBack.callInputs.path).toEqual({ id: 't-7' })
		expect(write.callInputs.body).toEqual({ name: WRITTEN_NAME })
	})
})
