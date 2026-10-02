/**
 * Seal over two interfaces declaring one operation id: the plan index keys
 * every operation by the pair `(interfaceId, operationId)`, so two interfaces
 * may declare one `operationId`, and the derived reference tells the two apart.
 */
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { compile } from '../../src/application/compile.ts'
import { seal } from '../../src/application/seal.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import type { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import type { PermittedInterface } from '../../src/core/schemas/interface.ts'
import type { BindingValue } from '../../src/core/schemas/plan.ts'
import { renderEvidenceReferences } from '../../src/core/seal/derived-reference.ts'
import { buildPlanIndex } from '../../src/core/seal/plan-index.ts'
import { satisfiedContract } from '../coverage/fixtures/satisfaction-contracts.ts'
import { doubleInterface } from '../fixtures/doubled-interface-contract.ts'
import {
	SHARED_OPERATION_ID,
	sharedOperationContract,
	sharedToolOperationContract,
} from '../fixtures/shared-operation-id.ts'
import { commandContract } from '../schemas/fixtures/command-contract.ts'
import { notesInterface } from '../score/fixtures/probe-witness.ts'

const indexOf = (contract: EvalContract, duplicateIds?: 'unresolved') =>
	buildPlanIndex(
		contract.interactionPlan,
		contract.permittedInterfaces,
		duplicateIds === undefined ? undefined : { duplicateIds },
	)

describe('buildPlanIndex over two interfaces declaring one operation id', () => {
	it('does not throw in the default mode, and answers each interface its own operation', () => {
		const index = indexOf(sharedOperationContract)
		const first = index.commandOperationOf('notes-v1', SHARED_OPERATION_ID)
		const second = index.commandOperationOf('notes-v2', SHARED_OPERATION_ID)
		expect(first?.invocation.executable).toBe('notes-v1')
		expect(second?.invocation.executable).toBe('notes-v2')
		expect(index.isOperationIdShared(SHARED_OPERATION_ID)).toBe(true)
	})

	it('answers the tool-call accessor for a shared tool operation id', () => {
		const index = indexOf(sharedToolOperationContract)
		expect(
			index.mcpOperationOf('notes-server-v1', 'search-notes')?.toolName,
		).toBe('search_notes_v1')
		expect(
			index.mcpOperationOf('notes-server-v2', 'search-notes')?.toolName,
		).toBe('search_notes_v2')
	})

	it('answers each pair the steps that name it', () => {
		const index = indexOf(sharedOperationContract)
		expect(
			index
				.stepsUsing('notes-v1', SHARED_OPERATION_ID)
				.map((step) => step.stepId),
		).toEqual(['read-old'])
		expect(
			index
				.stepsUsing('notes-v2', SHARED_OPERATION_ID)
				.map((step) => step.stepId),
		).toEqual(['read-new'])
	})
})

describe('one interface declaring an operation id twice', () => {
	const duplicated = (): EvalContract => {
		const contract = structuredClone(sharedOperationContract)
		const [first] = contract.permittedInterfaces
		if (first === undefined || first.kind !== 'cli') {
			throw new Error('the fixture declares no command interface')
		}
		const [operation] = first.operations
		if (operation === undefined) throw new Error('the fixture declares no op')
		first.operations.push(structuredClone(operation))
		return contract
	}

	it('still throws in the default mode, naming the interface and the id', () => {
		expect(() => indexOf(duplicated())).toThrow(
			`duplicate operation id within interface notes-v1: ${SHARED_OPERATION_ID}`,
		)
	})

	it('resolves nothing for that pair in unresolved mode, and leaves the other interface alone', () => {
		const index = indexOf(duplicated(), 'unresolved')
		expect(
			index.commandOperationOf('notes-v1', SHARED_OPERATION_ID),
		).toBeUndefined()
		expect(
			index.commandOperationOf('notes-v2', SHARED_OPERATION_ID)?.invocation
				.executable,
		).toBe('notes-v2')
	})
})

describe('seal over two interfaces declaring one operation id', () => {
	const directionOf = (oracleId: string): string => {
		const direction = seal(sharedOperationContract, {
			strict: true,
		}).directions.find((candidate) => candidate.oracleId === oracleId)
		if (direction === undefined) throw new Error(`no direction for ${oracleId}`)
		return direction.text
	}

	it('seals', () => {
		expect(() => seal(sharedOperationContract, { strict: true })).not.toThrow()
		expect(() =>
			seal(sharedToolOperationContract, { strict: true }),
		).not.toThrow()
	})

	it('renders a different derived reference per step, each naming its interface', () => {
		const old = directionOf('O-001')
		const next = directionOf('O-002')
		expect(old).toContain('the read note command of interface "notes-v1"')
		expect(next).toContain('the read note command of interface "notes-v2"')
		expect(old).not.toBe(next)
		expect(old).not.toContain('notes-v2')
		expect(next).not.toContain('notes-v1')
	})

	it('names the server of a shared tool the same way', () => {
		const text = seal(sharedToolOperationContract, { strict: true })
			.directions.map((direction) => direction.text)
			.join('\n')
		expect(text).toContain(
			'the search notes tool of interface "notes-server-v1"',
		)
		expect(text).toContain(
			'the search notes tool of interface "notes-server-v2"',
		)
	})
})

describe('seal over a contract that shares no operation id', () => {
	// Pinned from the bytes `seal` rendered at 4.7.0: the interface qualifier
	// appears exactly when the contract declares one operation id on more than
	// one interface, so every other contract renders as it always did.
	it('renders the unqualified reference', () => {
		const brief = seal(compile(commandContract, { strict: true }), {
			strict: true,
		})
		expect(brief.directions).toEqual([
			{
				oracleId: 'O-001',
				text: 'The fragments field of its standard output from the select fragments command (with the supplied stdin prompt) is asserted to be present. The declared polarity expects this relation to hold. One selection call for one task. A selection naming no fragment at all is treated as a defect.',
			},
		])
	})
})

describe('the interface qualifier of a derived reference', () => {
	const cliInterface = (contract: EvalContract, logicalId: string) => {
		const found = contract.permittedInterfaces.find(
			(candidate) => candidate.logicalId === logicalId,
		)
		if (found === undefined || found.kind !== 'cli') {
			throw new Error(`the fixture declares no command interface ${logicalId}`)
		}
		return found
	}

	/**
	 * Two interfaces share `x`; `notes-v2` also declares `x-command-of-interface`.
	 * Unquoted, the qualifier of the shared pair on an interface named `command`
	 * reads "the x command of interface command", which is also how the unshared
	 * operation `x-command-of-interface` humanizes, so two different steps would
	 * render one phrase.
	 */
	const collidingContract = (): EvalContract => {
		const contract = structuredClone(sharedOperationContract)
		const first = cliInterface(contract, 'notes-v1')
		const second = cliInterface(contract, 'notes-v2')
		const [operation] = second.operations
		if (operation === undefined) throw new Error('the fixture declares no op')
		first.logicalId = 'command'
		for (const iface of [first, second]) {
			const [declared] = iface.operations
			if (declared !== undefined) declared.operationId = 'x'
		}
		second.operations.push({
			...structuredClone(operation),
			operationId: 'x-command-of-interface',
			invocation: { executable: 'notes-v2', subcommandPath: ['other'] },
		})
		const [readOld, readNew] = contract.interactionPlan
		if (readOld === undefined || readNew === undefined) {
			throw new Error('the fixture declares two steps')
		}
		readOld.interfaceId = 'command'
		readOld.operationId = 'x'
		readNew.operationId = 'x'
		contract.interactionPlan.push({
			...structuredClone(readNew),
			stepId: 'read-third',
			operationId: 'x-command-of-interface',
		})
		return contract
	}

	it('quotes the interface, so two different steps never render one phrase', () => {
		const contract = collidingContract()
		const index = indexOf(contract)
		const text = renderEvidenceReferences(
			[
				'/interactions/read-old/stdout/fragments',
				'/interactions/read-third/stdout/fragments',
			],
			index,
		)
		expect(text).toContain('the x command of interface "command" (with')
		expect(text).toContain('the x command of interface command (with')
	})
})

describe('irreducible step references over a shared operation id', () => {
	/** `read-old` and `read-old-2` both read `read-note` on notes-v1 and bind the same thing. */
	const twinSteps = (): EvalContract => {
		const contract = structuredClone(sharedOperationContract)
		const [readOld] = contract.interactionPlan
		if (readOld === undefined) throw new Error('the fixture declares a step')
		contract.interactionPlan.push({
			...structuredClone(readOld),
			stepId: 'read-old-2',
		})
		return contract
	}

	const failureOf = (run: () => unknown): StructuralFailure => {
		try {
			run()
		} catch (error) {
			if (error instanceof StructuralFailure) return error
			throw error
		}
		throw new Error('the references rendered where a collision was expected')
	}

	it('names the interface of the colliding steps, and no other, in the message and the path', () => {
		const contract = twinSteps()
		const failure = failureOf(() =>
			renderEvidenceReferences(
				[
					'/interactions/read-old/stdout/fragments',
					'/interactions/read-old-2/stdout/fragments',
					'/interactions/read-new/stdout/fragments',
				],
				indexOf(contract),
			),
		)
		expect(failure.code).toBe('irreducible-step-reference')
		expect(failure.message).toContain(
			'invoking operation "read-note" on interface "notes-v1"',
		)
		expect(failure.message).not.toContain('notes-v2')
		expect(failure.artifactPath).toBe(
			'EvalContract.interactionPlan[interfaceId=notes-v1][operationId=read-note]',
		)
	})

	it('keeps the path of an operation id no other interface declares', () => {
		const contract = twinSteps()
		for (const iface of contract.permittedInterfaces) {
			const [declared] = iface.operations
			if (iface.logicalId === 'notes-v2' && declared !== undefined) {
				declared.operationId = 'read-note-new'
			}
		}
		const [, readNew] = contract.interactionPlan
		if (readNew !== undefined) readNew.operationId = 'read-note-new'
		const failure = failureOf(() =>
			renderEvidenceReferences(
				[
					'/interactions/read-old/stdout/fragments',
					'/interactions/read-old-2/stdout/fragments',
				],
				indexOf(contract),
			),
		)
		expect(failure.artifactPath).toBe(
			'EvalContract.interactionPlan[operationId=read-note]',
		)
		expect(failure.message).not.toContain('on interface')
	})
})

describe('the interface qualifier follows the kind of the interface', () => {
	it('qualifies an endpoint of an api interface, and names the command of the cli interface that fed it', () => {
		const [commandInterface] = sharedOperationContract.permittedInterfaces
		if (commandInterface === undefined)
			throw new Error('the fixture declares none')
		const commandStep = (stepId: string, prompt: string) => ({
			stepId,
			interfaceId: 'notes-v1',
			operationId: 'read-note',
			after: null,
			cardinality: 'exactly-one' as const,
			inputBinding: {
				argument: null,
				option: null,
				environment: null,
				stdin: { prompt: { literal: prompt } },
			},
		})
		const apiStep = (stepId: string, from: string) => ({
			stepId,
			interfaceId: 'notes-api',
			operationId: 'read-note',
			after: null,
			cardinality: 'exactly-one' as const,
			inputBinding: {
				path: { noteId: { captured: `/interactions/${from}/stdout/token` } },
				query: null,
				header: null,
				body: null,
			},
		})
		const index = buildPlanIndex(
			[
				commandStep('seed-a', 'alpha'),
				commandStep('seed-b', 'beta'),
				apiStep('probe-a', 'seed-a'),
				apiStep('probe-b', 'seed-b'),
			],
			[commandInterface, notesInterface],
		)
		// The two api steps differ only in the command step each captures from, so
		// the reference has to expand each capture group to tell them apart.
		const text = renderEvidenceReferences(
			[
				'/interactions/probe-a/response-body/ok',
				'/interactions/probe-b/response-body/ok',
			],
			index,
		)
		expect(text).toContain('the read note endpoint of interface "notes-api"')
		expect(text).toContain('the read note command of interface "notes-v1"')
		expect(text).not.toContain('the read note endpoint of interface "notes-v1"')
		expect(text).not.toContain('the read note command of interface "notes-api"')
	})

	it('qualifies the endpoint of an api contract evaluated through two interfaces', () => {
		const doubled = doubleInterface(satisfiedContract)
		const text = seal(doubled.both, { strict: true })
			.directions.map((direction) => direction.text)
			.join('\n')
		expect(text).toContain('the create thing endpoint of interface "thing-api"')
		expect(text).toContain(
			'the create thing endpoint of interface "thing-api-v2"',
		)
	})
})

describe('a captured value expands by the operation of the interface that produced it', () => {
	const [commandInterface] = sharedOperationContract.permittedInterfaces
	if (commandInterface === undefined)
		throw new Error('the fixture declares none')

	const probe = (
		stepId: string,
		option: Record<string, z.infer<typeof BindingValue>>,
	) => ({
		stepId,
		interfaceId: 'notes-v1',
		operationId: 'read-note',
		after: null,
		cardinality: 'exactly-one' as const,
		inputBinding: {
			argument: null,
			option,
			environment: null,
			stdin: null,
		},
	})
	const apiStep = (stepId: string) => ({
		stepId,
		interfaceId: 'notes-api',
		operationId: 'read-note',
		after: null,
		cardinality: 'exactly-one' as const,
		inputBinding: {
			path: { noteId: { literal: stepId } },
			query: null,
			header: null,
			body: null,
		},
	})
	const capturedFrom = (stepId: string) => ({
		first: { captured: `/interactions/${stepId}/response-body/first` },
		second: { captured: `/interactions/${stepId}/response-body/second` },
	})

	it('names an endpoint, and the api interface, for a step that notes-api declares and notes-v1 declares as a command', () => {
		// The two probes differ only in the api step each captures from. A lookup
		// of that step's operation by id alone finds the command `notes-v1`
		// declares first, and the capture would read as a command.
		const index = buildPlanIndex(
			[
				probe('probe-a', capturedFrom('seed-a')),
				probe('probe-b', capturedFrom('seed-b')),
				apiStep('seed-a'),
				apiStep('seed-b'),
			],
			[commandInterface, notesInterface],
		)
		const text = renderEvidenceReferences(
			[
				'/interactions/probe-a/stdout/fragments',
				'/interactions/probe-b/stdout/fragments',
			],
			index,
		)
		expect(text).toContain(
			'from the read note endpoint of interface "notes-api"',
		)
		expect(text).not.toContain('read note command of interface "notes-api"')
	})

	it('expands nothing for a captured step whose interface does not declare its operation, though another interface does', () => {
		// `notes-api` declares no `read-note` here, and `notes-v1` does. The probes
		// differ only in a literal, so the escalation reaches the literal rung, where
		// each captured key reads on its own as one the evaluator obtained earlier.
		const [, withoutReadNote] = [commandInterface, notesInterface]
		const apiWithoutReadNote = {
			...structuredClone(withoutReadNote),
			operations: withoutReadNote.operations
				.slice(0, 1)
				.map((operation) => ({ ...operation, operationId: 'list-notes' })),
		} as PermittedInterface
		const index = buildPlanIndex(
			[
				probe('probe-a', { ...capturedFrom('ghost-a'), tag: { literal: 'a' } }),
				probe('probe-b', { ...capturedFrom('ghost-b'), tag: { literal: 'b' } }),
				apiStep('ghost-a'),
				apiStep('ghost-b'),
			],
			[commandInterface, apiWithoutReadNote],
		)
		const text = renderEvidenceReferences(
			[
				'/interactions/probe-a/stdout/fragments',
				'/interactions/probe-b/stdout/fragments',
			],
			index,
		)
		expect(text).toContain(
			'(with the option first you obtained earlier, the option second you obtained earlier, and the option tag "a")',
		)
	})
})

describe('a derived reference for a step whose interface does not declare its operation', () => {
	it('names the operation and the interface', () => {
		const contract = structuredClone(sharedOperationContract)
		const [, readNew] = contract.interactionPlan
		if (readNew === undefined) throw new Error('the fixture declares two steps')
		readNew.operationId = 'missing-op'
		expect(() =>
			renderEvidenceReferences(
				['/interactions/read-new/stdout/fragments'],
				indexOf(contract),
			),
		).toThrow(
			'step names operation "missing-op" on interface "notes-v2", which that interface does not declare',
		)
	})
})
