// Reachability against a command operation, whose declared output channel is
// its own rather than the response body.
//
// The rule this exercises is one rule, not two: an operation's response
// descriptor describes whichever channel `descriptorChannel` names, and the
// pointer that addresses that channel descends through the descriptor exactly
// as a `response-body` pointer does off an interface that speaks HTTP.

import { describe, expect, it } from 'vitest'
import { checkArtifactReferences } from '../../src/core/compile/interface-inventory.ts'
import { evaluatePointerReachability } from '../../src/core/compile/reachability.ts'
import { StructuralFailure } from '../../src/core/failure-codes.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { buildPlanIndex } from '../../src/core/seal/plan-index.ts'
import {
	artifactCommandContract,
	commandContract,
} from '../schemas/fixtures/command-contract.ts'

const indexOf = (contract: unknown) => {
	const parsed = EvalContract.parse(contract)
	return buildPlanIndex(parsed.interactionPlan, parsed.permittedInterfaces)
}

const index = indexOf(commandContract)

describe('a command operation whose descriptor describes standard output', () => {
	it('admits a tailed stdout pointer naming a declared key', () => {
		expect(
			evaluatePointerReachability(
				'/interactions/select/stdout/fragments',
				index,
			),
		).toEqual({ reachable: true })
	})

	it('admits the bare stdout pointer', () => {
		expect(
			evaluatePointerReachability('/interactions/select/stdout', index),
		).toEqual({ reachable: true })
	})

	it('rejects a tailed stdout pointer naming an undeclared key', () => {
		const result = evaluatePointerReachability(
			'/interactions/select/stdout/summary',
			index,
		)
		expect(result.reachable).toBe(false)
		expect(result.reachable === false && result.reason).toContain(
			'addresses stdout field "summary"',
		)
	})

	it('rejects a tail inside stderr, which no descriptor describes', () => {
		const result = evaluatePointerReachability(
			'/interactions/select/stderr/fragments',
			index,
		)
		expect(result.reachable).toBe(false)
		expect(result.reachable === false && result.reason).toContain(
			'declares no structure for',
		)
	})

	it('admits the exit code, a scalar channel with no tail', () => {
		expect(
			evaluatePointerReachability('/interactions/select/exit-code', index),
		).toEqual({ reachable: true })
	})

	it('rejects a response-body pointer, which a command produces nothing for', () => {
		const result = evaluatePointerReachability(
			'/interactions/select/response-body/fragments',
			index,
		)
		expect(result.reachable).toBe(false)
		expect(result.reachable === false && result.reason).toContain(
			'runs behind a command and produces no HTTP response',
		)
	})

	it('admits a call-inputs pointer on a declared command channel', () => {
		expect(
			evaluatePointerReachability(
				'/interactions/select/call-inputs/stdin/prompt',
				index,
			),
		).toEqual({ reachable: true })
	})

	it('rejects a call-inputs pointer on a channel of the other kind', () => {
		const result = evaluatePointerReachability(
			'/interactions/select/call-inputs/query/prompt',
			index,
		)
		expect(result.reachable).toBe(false)
		expect(result.reachable === false && result.reason).toContain(
			'a channel operation "select-fragments" does not accept input on',
		)
	})
})

describe('an api operation is unmoved by the second kind', () => {
	it('still rejects a tail inside stdout, whose descriptor describes the body', async () => {
		const { populatedContract } = await import(
			'../schemas/fixtures/relevance-contracts.ts'
		)
		const apiIndex = indexOf(populatedContract)
		const result = evaluatePointerReachability(
			'/interactions/list/stdout/items',
			apiIndex,
		)
		expect(result.reachable).toBe(false)
		expect(result.reachable === false && result.reason).toContain(
			'declares no structure for',
		)
	})
})

describe('a command operation whose descriptor describes a written file', () => {
	const artifactIndex = indexOf(artifactCommandContract)

	it('admits a tailed artifact pointer naming the nominated file and a declared key', () => {
		expect(
			evaluatePointerReachability(
				'/interactions/select/artifact/verdict/fragments',
				artifactIndex,
			),
		).toEqual({ reachable: true })
	})

	it('rejects a tailed artifact pointer naming an undeclared key', () => {
		const result = evaluatePointerReachability(
			'/interactions/select/artifact/verdict/summary',
			artifactIndex,
		)
		expect(result.reachable).toBe(false)
		expect(result.reachable === false && result.reason).toContain(
			'addresses the "verdict" artifact field "summary"',
		)
	})

	// Declared to exist, and nothing declares its shape: the operation's one
	// descriptor describes the other file.
	it('rejects a tail inside a declared artifact the descriptor does not nominate', () => {
		const result = evaluatePointerReachability(
			'/interactions/select/artifact/report/fragments',
			artifactIndex,
		)
		expect(result.reachable).toBe(false)
		expect(result.reachable === false && result.reason).toContain(
			'declares it writes but declares no structure for',
		)
	})

	it('admits a bare pointer at a declared artifact the descriptor does not nominate', () => {
		expect(
			evaluatePointerReachability(
				'/interactions/select/artifact/report',
				artifactIndex,
			),
		).toEqual({ reachable: true })
	})

	it('rejects a tailed stdout pointer, since the descriptor describes a file', () => {
		const result = evaluatePointerReachability(
			'/interactions/select/stdout/fragments',
			artifactIndex,
		)
		expect(result.reachable).toBe(false)
		expect(result.reachable === false && result.reason).toContain(
			'declares no structure for',
		)
	})
})

describe('unresolved-artifact-reference', () => {
	const failureOf = (contract: unknown): StructuralFailure => {
		try {
			checkArtifactReferences(EvalContract.parse(contract))
		} catch (error) {
			if (error instanceof StructuralFailure) return error
			throw error
		}
		throw new Error('expected a StructuralFailure')
	}

	it('fires on a pointer naming an artifact the operation does not declare', () => {
		const contract = structuredClone(artifactCommandContract) as any
		contract.oracles[0].check.operands[0].pointer =
			'/interactions/select/artifact/transcript/fragments'
		contract.oracles[0].direction.evidenceTargets[0] =
			'/interactions/select/artifact/transcript/fragments'
		const failure = failureOf(contract)
		expect(failure.code).toBe('unresolved-artifact-reference')
		expect(failure.message).toContain('does not declare it writes')
	})

	it('fires on a descriptor nominating an artifact the operation does not declare', () => {
		const contract = structuredClone(artifactCommandContract) as any
		contract.permittedInterfaces[0].operations[0].descriptorChannel = {
			kind: 'artifact',
			artifactId: 'transcript',
		}
		const failure = failureOf(contract)
		expect(failure.code).toBe('unresolved-artifact-reference')
		expect(failure.artifactPath).toContain('descriptorChannel.artifactId')
	})

	it('says nothing about a contract whose artifact references all resolve', () => {
		expect(() =>
			checkArtifactReferences(EvalContract.parse(artifactCommandContract)),
		).not.toThrow()
	})
})
