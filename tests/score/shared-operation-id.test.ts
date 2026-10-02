/**
 * Scoring over two interfaces that declare one operation id: an observation
 * names the pair `(interfaceId, operationId)`, and selection, the witness match
 * and the finding map all read the pair. The two interfaces are scored as two
 * operations.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { selectObservations } from '../../src/core/score/selection.ts'
import { mapFindings, matchProbeWitness } from '../../src/core/score/witness.ts'
import {
	commandObservation,
	scoreSharedOperation,
	sharedOperationContract,
	sharedOperationProbe,
	sharedOperationProbeOnV1,
	sharedToolOperationContract,
	sharedToolOperationProbe,
	toolObservation,
} from '../fixtures/shared-operation-id.ts'
import { defectFinding, recordOf } from './fixtures/probe-witness.ts'

const [readOld, readNew] = sharedOperationContract.interactionPlan
if (readOld === undefined || readNew === undefined) {
	throw new Error('the fixture declares two steps')
}
const interfaces = sharedOperationContract.permittedInterfaces

const printed = { fragments: [{ id: 'a' }] }
const printedNothing = {}

describe('selection reads the interface as well as the operation', () => {
	const oldObservation = commandObservation('obs-old', 1, 'notes-v1', printed)
	const newObservation = commandObservation('obs-new', 2, 'notes-v2', printed)

	it('resolves each step to the one observation of its own interface', () => {
		const observations = [oldObservation, newObservation]
		expect(selectObservations(readOld, observations)).toEqual({
			result: 'one',
			matchedObservationIds: ['obs-old'],
		})
		expect(selectObservations(readNew, observations)).toEqual({
			result: 'one',
			matchedObservationIds: ['obs-new'],
		})
	})

	it('resolves none for a step whose interface has no observation, though another interface has one for the same operation id', () => {
		expect(selectObservations(readNew, [oldObservation])).toEqual({
			result: 'none',
			matchedObservationIds: [],
		})
	})
})

describe('the witness match reads the interface of the probe', () => {
	const onV1 = commandObservation('obs-v1', 1, 'notes-v1', printedNothing)
	const onV2 = commandObservation('obs-v2', 2, 'notes-v2', printedNothing)

	it('leaves a probe signed on notes-v2 unexercised when only notes-v1 was read', () => {
		const match = matchProbeWitness(
			sharedOperationProbe,
			interfaces,
			recordOf([onV1]),
		)
		expect(match.homeOperationResolved).toBe(true)
		expect(match.exercised).toBe(false)
		expect(match.result).toBe('unexercised')
	})

	it('exercises it once a notes-v2 observation joins the record', () => {
		const match = matchProbeWitness(
			sharedOperationProbe,
			interfaces,
			recordOf([onV1, onV2]),
		)
		expect(match.exercised).toBe(true)
		expect(match.observationIds).toEqual(['obs-v2'])
	})

	it('exercises the same defect signed on notes-v1 by the notes-v1 observation alone', () => {
		const match = matchProbeWitness(
			sharedOperationProbeOnV1,
			interfaces,
			recordOf([onV1]),
		)
		expect(match.exercised).toBe(true)
		expect(match.observationIds).toEqual(['obs-v1'])
	})

	it('does not map a defect finding that cites only the notes-v1 observation', () => {
		const finding = defectFinding(['obs-v1'], { probeId: 'P-001' })
		const mapped = mapFindings(
			[sharedOperationProbe],
			interfaces,
			recordOf([onV1, onV2], [finding]),
		)
		expect(mapped.mapped).toEqual([])
		expect(mapped.unmapped.map((entry) => entry.findingId)).toEqual(['F-001'])
	})

	it('maps a defect finding once it cites the notes-v2 observation', () => {
		const finding = defectFinding(['obs-v1', 'obs-v2'], { probeId: 'P-001' })
		const mapped = mapFindings(
			[sharedOperationProbe],
			interfaces,
			recordOf([onV1, onV2], [finding]),
		)
		expect(mapped.mapped.map((entry) => entry.findingId)).toEqual(['F-001'])
		expect(mapped.unmapped).toEqual([])
	})
})

describe('runScore over two interfaces declaring one operation id', () => {
	const outcomesOf = (
		result: Awaited<ReturnType<typeof scoreSharedOperation>>,
	) =>
		Object.fromEntries(
			(result.artifact?.outcomes ?? []).map((outcome) => [
				outcome.oracleId,
				{
					selected: outcome.selectedObservationIds,
					resolution: outcome.checkResolution?.resolution,
				},
			]),
		)

	it('scores the command twin: notes-v1 output satisfies O-001 and notes-v2 output does not satisfy O-002', async () => {
		const result = await scoreSharedOperation({
			contract: sharedOperationContract,
			probe: sharedOperationProbe,
			observations: [
				commandObservation('obs-1', 1, 'notes-v1', printed),
				commandObservation('obs-2', 2, 'notes-v2', printedNothing),
			],
		})
		// The evidence artifact is minted, and the ladder is not Invalid.
		expect(result.artifact).not.toBeNull()
		expect(result.ladder.verdict).not.toBeNull()
		expect(result.ladder.basis.join('\n')).not.toContain('collision')
		expect(outcomesOf(result)).toEqual({
			'O-001': { selected: ['obs-1'], resolution: 'true' },
			'O-002': { selected: ['obs-2'], resolution: 'insufficient-evidence' },
		})
	})

	it('swaps the outcomes when the two observations swap their interfaces', async () => {
		const result = await scoreSharedOperation({
			contract: sharedOperationContract,
			probe: sharedOperationProbe,
			observations: [
				commandObservation('obs-1', 1, 'notes-v2', printed),
				commandObservation('obs-2', 2, 'notes-v1', printedNothing),
			],
		})
		expect(result.ladder.verdict).not.toBeNull()
		expect(outcomesOf(result)).toEqual({
			'O-001': { selected: ['obs-2'], resolution: 'insufficient-evidence' },
			'O-002': { selected: ['obs-1'], resolution: 'true' },
		})
	})

	it('scores the tool-server twin the same way', async () => {
		const found = { ok: true, matches: [{ noteId: 'n-1' }], totalCount: 1 }
		const empty = { ok: true, matches: [], totalCount: 0 }
		const result = await scoreSharedOperation({
			contract: sharedToolOperationContract,
			probe: sharedToolOperationProbe,
			observations: [
				toolObservation('obs-1', 1, 'notes-server-v1', found),
				toolObservation('obs-2', 2, 'notes-server-v2', empty),
			],
		})
		expect(result.ladder.verdict).not.toBeNull()
		expect(outcomesOf(result)).toEqual({
			'O-001': { selected: ['obs-1'], resolution: 'true' },
			'O-002': { selected: ['obs-2'], resolution: 'false' },
		})
	})
})

describe('runScore over an interface that declares one operation id twice', () => {
	// The schema admits it and `compile` does not reject it before `score`, so
	// `score` meets it as a domain input: the index resolves neither declaration,
	// and a throwing index would crash the stage before any verdict.
	it('scores to a verdict', async () => {
		const contract = structuredClone(sharedOperationContract)
		const [first] = contract.permittedInterfaces
		if (first?.kind !== 'cli') throw new Error('the fixture declares cli')
		const [operation] = first.operations
		if (operation === undefined) throw new Error('the fixture declares no op')
		first.operations.push({
			...structuredClone(operation),
			invocation: { executable: 'notes-v1', subcommandPath: ['read-again'] },
		})
		const result = await scoreSharedOperation({
			contract,
			probe: sharedOperationProbe,
			observations: [
				commandObservation('obs-1', 1, 'notes-v1', printed),
				commandObservation('obs-2', 2, 'notes-v2', printed),
			],
		})
		expect(result.ladder.verdict).not.toBeNull()
		const selected = Object.fromEntries(
			(result.artifact?.outcomes ?? []).map((outcome) => [
				outcome.oracleId,
				outcome.selectedObservationIds,
			]),
		)
		expect(selected).toEqual({ 'O-001': ['obs-1'], 'O-002': ['obs-2'] })
	})
})

describe('the ladder has no operation-identifier-collision row', () => {
	it('is absent from the AD-21 decision table', () => {
		const table = readFileSync(
			new URL('../../docs/ad21-verdict-decision.generated.md', import.meta.url),
			'utf8',
		)
		expect(table).not.toContain('operation-identifier-collision')
		expect(table).toContain('trial-set-field-disagreement')
	})
})
