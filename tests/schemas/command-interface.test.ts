// The `cli` branch of `permittedInterfaces`: what it admits, what it refuses,
// and the two directions in which an operation shape cannot be smuggled onto
// the wrong branch.

import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { commandContract } from './fixtures/command-contract.ts'
import { populatedContract } from './fixtures/relevance-contracts.ts'

const mutated = (mutate: (contract: any) => void) => {
	const clone = structuredClone(commandContract) as any
	mutate(clone)
	return EvalContract.safeParse(clone)
}

const operation = (contract: any) =>
	contract.permittedInterfaces[0].operations[0]

describe('the command branch', () => {
	it('parses and compiles a contract whose system under test runs behind a command', () => {
		const parsed = EvalContract.parse(commandContract)
		expect(() => compile(parsed, { strict: true })).not.toThrow()
	})

	it('refuses a command operation declaring a method', () => {
		expect(
			mutated((c) => {
				operation(c).method = 'POST'
			}).success,
		).toBe(false)
	})

	it('refuses an api operation declaring an invocation', () => {
		const clone = structuredClone(populatedContract) as any
		clone.permittedInterfaces[0].operations[0].invocation = {
			executable: 'thing',
			subcommandPath: [],
		}
		expect(EvalContract.safeParse(clone).success).toBe(false)
	})

	it.each(['/usr/local/bin/tool', './tool', 'tool.exe', 'host:1234'])(
		'refuses the executable %s, which discloses a target AD-35 keeps out of a contract',
		(executable) => {
			expect(
				mutated((c) => {
					operation(c).invocation.executable = executable
				}).success,
			).toBe(false)
		},
	)

	it('admits an empty subcommand path, which means the executable takes none', () => {
		expect(
			mutated((c) => {
				operation(c).invocation.subcommandPath = []
			}).success,
		).toBe(true)
	})

	it('refuses an untagged descriptor channel, since stdout is itself a legal identifier', () => {
		expect(
			mutated((c) => {
				operation(c).descriptorChannel = 'stdout'
			}).success,
		).toBe(false)
	})

	it('admits standard error as the descriptor channel', () => {
		expect(
			mutated((c) => {
				operation(c).descriptorChannel = { kind: 'stream', channel: 'stderr' }
			}).success,
		).toBe(true)
	})

	it('refuses a descriptor channel naming a channel outside the two streams', () => {
		expect(
			mutated((c) => {
				operation(c).descriptorChannel = {
					kind: 'stream',
					channel: 'exit-code',
				}
			}).success,
		).toBe(false)
	})

	it('carries artifacts as bare identifiers with no descriptor of their own', () => {
		expect(
			mutated((c) => {
				operation(c).artifacts = ['verdict', 'report']
			}).success,
		).toBe(true)
		expect(
			mutated((c) => {
				operation(c).artifacts = [{ artifactId: 'verdict' }]
			}).success,
		).toBe(false)
	})

	it('admits all three standard-input spellings on a witness leg', () => {
		for (const stdin of [
			{ kind: 'absent' },
			{ kind: 'text', value: 'a prompt that was never JSON' },
			{ kind: 'json', value: { prompt: 'a' } },
		]) {
			expect(
				mutated((c) => {
					operation(c).sensitivityWitness.legs[0].inputs.stdin = stdin
				}).success,
			).toBe(true)
		}
	})
})

describe('the kind whose probe semantics are still undeclared', () => {
	// `web` alone. `mcp` carries its own operation shape now, so the same
	// mutation is a parse failure there rather than the clean parse this
	// asserts, and the branch that keeps the code fireable is this one.
	it('admits a web interface carrying the api operation shape, so the code stays fireable', () => {
		const clone = structuredClone(populatedContract) as any
		clone.permittedInterfaces[0].kind = 'web'
		expect(EvalContract.safeParse(clone).success).toBe(true)
	})

	it('refuses a kind outside the four', () => {
		const clone = structuredClone(populatedContract) as any
		clone.permittedInterfaces[0].kind = 'grpc'
		expect(EvalContract.safeParse(clone).success).toBe(false)
	})
})

describe('an opaque standard input fills the one key its channel declares', () => {
	const withStdin = (
		requiredKeys: readonly string[],
		permittedKeys: readonly string[] = requiredKeys,
	) => {
		const clone = structuredClone(commandContract) as any
		const declared = operation(clone)
		declared.requestShape.stdin = {
			requiredKeys: [...requiredKeys],
			permittedKeys: [...permittedKeys],
			types: Object.fromEntries(permittedKeys.map((key) => [key, 'string'])),
		}
		for (const leg of declared.sensitivityWitness.legs) {
			leg.inputs.stdin = { kind: 'text', value: `text for ${leg.legId}` }
		}
		return EvalContract.parse(clone)
	}

	it('accepts a text leg against a channel declaring exactly one required key', () => {
		expect(() => compile(withStdin(['prompt']), { strict: true })).not.toThrow()
	})

	it('rejects a text leg where the channel declares no required key', () => {
		expect(() => compile(withStdin([], ['prompt']), { strict: true })).toThrow(
			/the text fills nothing/,
		)
	})

	it('rejects a text leg where the channel declares two required keys', () => {
		expect(() =>
			compile(withStdin(['prompt', 'context']), { strict: true }),
		).toThrow(/nothing says which the text fills/)
	})

	// The other half of the same rule: a command that genuinely parses a
	// document off standard input declares several keys and supplies them
	// through the leg's `json` arm, and the full key comparison applies.
	it('checks every declared key against a json leg', () => {
		const clone = structuredClone(commandContract) as any
		const declared = operation(clone)
		declared.requestShape.stdin = {
			requiredKeys: ['prompt', 'context'],
			permittedKeys: ['prompt', 'context'],
			types: { prompt: 'string', context: 'string' },
		}
		for (const leg of declared.sensitivityWitness.legs) {
			leg.inputs.stdin = {
				kind: 'json',
				value: { prompt: `p-${leg.legId}` },
			}
		}
		expect(() => compile(EvalContract.parse(clone), { strict: true })).toThrow(
			/omits "context"/,
		)
	})
})
