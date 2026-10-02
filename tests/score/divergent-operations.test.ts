/**
 * Scoring over two interfaces that declare one `operationId` and disagree about
 * the types their inputs declare (see `divergent-operations.ts`). A
 * `type-violating` binding compares an observed value against the type the
 * step's own operation declares, so which interface's operation is read decides
 * whether an observation matches.
 */
import { describe, expect, it } from 'vitest'
import { makePointerDenotesCollection } from '../../src/core/evaluate/evidence-resolution.ts'
import type { InteractionStep } from '../../src/core/schemas/plan.ts'
import { selectWithBindings } from '../../src/core/score/bindings.ts'
import { buildPlanIndex } from '../../src/core/seal/plan-index.ts'
import { divergentOperationContract } from '../fixtures/divergent-operations.ts'
import { commandObservation } from '../fixtures/shared-operation-id.ts'

const index = buildPlanIndex(
	divergentOperationContract.interactionPlan,
	divergentOperationContract.permittedInterfaces,
)

/** A step on `interfaceId` binding the option `format` as a malformed value. */
const malformedFormatStep = (interfaceId: string): InteractionStep => ({
	stepId: 'malformed-format',
	interfaceId,
	operationId: 'read-note',
	after: null,
	cardinality: 'exactly-one',
	inputBinding: {
		argument: null,
		option: { format: { matcher: 'type-violating' } },
		environment: null,
		stdin: null,
	},
})

/** An observation of `read-note` on `interfaceId` that passed `format` as a number. */
const numericFormat = (interfaceId: string) => ({
	...commandObservation('obs-format', 1, interfaceId, {}),
	callInputs: {
		path: null,
		query: null,
		header: null,
		body: null,
		argument: null,
		option: { format: 5 },
		environment: null,
		stdin: null,
		arguments: null,
	},
})

describe('a type-violating binding reads the type its own interface declares', () => {
	it('matches a number given to the option notes-v2 declares a string', () => {
		const step = malformedFormatStep('notes-v2')
		expect(
			selectWithBindings(step, [numericFormat('notes-v2')], index, new Map()),
		).toEqual({ result: 'one', matchedObservationIds: ['obs-format'] })
	})

	it('fails closed on an option notes-v1 never declares, so no violation can be proved', () => {
		const step = malformedFormatStep('notes-v1')
		expect(
			selectWithBindings(step, [numericFormat('notes-v1')], index, new Map()),
		).toEqual({ result: 'none', matchedObservationIds: [] })
	})
})

describe('a pointer denotes a collection through its own interface', () => {
	const denotes = makePointerDenotesCollection(divergentOperationContract)

	it('names the collection notes-v1 prints on standard output', () => {
		expect(denotes('/interactions/read-old/stdout/fragments')).toBe(true)
		expect(denotes('/interactions/read-old/stdout/entries')).toBe(false)
	})

	it('names the collection notes-v2 writes into its report file', () => {
		expect(denotes('/interactions/read-new/artifact/report/entries')).toBe(true)
		expect(denotes('/interactions/read-new/stdout/fragments')).toBe(false)
	})
})
