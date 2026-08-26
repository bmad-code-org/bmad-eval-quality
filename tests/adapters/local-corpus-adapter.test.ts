// Story 6.1 AC 12 fixtures 77-82: the shipped corpus adapter. The escape
// check is two checks at two times, and fixtures 79, 80, and 81 are the three
// that pin each half: the lexical half refuses before any filesystem call,
// and the real-path half is what catches a symlink inside the root pointing
// outside it.

import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
	type CorpusMechanism,
	createLocalCorpusAdapter,
} from '../../src/adapters/local-corpus-adapter.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type { CorpusResolveRequest } from '../../src/core/schemas/port-messages.ts'
import type { PortSubject } from '../../src/testing/conformance.ts'
import { runCorpusPortConformance } from '../../src/testing/conformance.ts'

function corpusSubject(root: string): PortSubject<CorpusResolveRequest> {
	return {
		name: 'createLocalCorpusAdapter',
		sampleRequest: { privateRef: 'one.bin' },
		abortBudgetMs: 200,
		build: async (scenario) => {
			let calls = 0
			const mechanism: CorpusMechanism = async () => {
				calls++
				if (scenario === 'resolves') return new Uint8Array([1, 2, 3])
				if (scenario === 'fails') {
					throw new Error('ENOENT: no such file or directory')
				}
				if (scenario === 'in-band-error') return { error: 'nope' }
				// Ignores the signal on purpose; the adapter's abort race is what
				// is under test.
				return new Promise<unknown>(() => {})
			}
			const port = createLocalCorpusAdapter({ root, mechanism })
			return {
				port: (request, signal) => port.resolve(request, signal),
				underlyingCalls: () => calls,
			}
		},
	}
}

/** The thrown value, or `undefined` when the call resolved. */
async function thrownBy(call: Promise<unknown>): Promise<unknown> {
	return call.then(
		() => undefined,
		(error: unknown) => error,
	)
}

function expectPortFailure(thrown: unknown): void {
	expect(thrown).toBeInstanceOf(RuntimeFault)
	expect((thrown as RuntimeFault).code).toBe('port-failure')
	expect((thrown as RuntimeFault).artifactPath).toBe('CorpusResolveRequest')
}

describe('the shipped corpus adapter (fixtures 77-82)', () => {
	let root = ''
	let outside = ''
	const signal = new AbortController().signal

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), 'eval-quality-corpus-'))
		outside = await mkdtemp(join(tmpdir(), 'eval-quality-outside-'))
		await writeFile(join(root, 'one.bin'), new Uint8Array([1, 2, 3]))
		await writeFile(join(outside, 'secret.bin'), new Uint8Array([9, 9]))
	})

	afterEach(async () => {
		await rm(root, { recursive: true, force: true })
		await rm(outside, { recursive: true, force: true })
	})

	it('fixture 77: passes the published corpus conformance suite, six outcomes', async () => {
		const report = await runCorpusPortConformance(corpusSubject(root))
		expect(report.outcomes).toHaveLength(6)
		expect(report.outcomes.filter((outcome) => !outcome.passed)).toEqual([])
		expect(report.passed).toBe(true)
	})

	it('fixture 78: resolves a real file under the root, bytes byte-identical', async () => {
		const port = createLocalCorpusAdapter({ root })
		const response = await port.resolve({ privateRef: 'one.bin' }, signal)
		expect(new Uint8Array(response.bytes)).toEqual(new Uint8Array([1, 2, 3]))
	})

	it('fixture 79: a "../outside" privateRef throws port-failure and never calls the mechanism', async () => {
		let calls = 0
		const mechanism: CorpusMechanism = async () => {
			calls++
			return new Uint8Array([0])
		}
		const port = createLocalCorpusAdapter({ root, mechanism })
		expectPortFailure(
			await thrownBy(port.resolve({ privateRef: '../outside' }, signal)),
		)
		expect(calls).toBe(0)
	})

	it('fixture 80: an absolute privateRef throws port-failure and never calls the mechanism', async () => {
		let calls = 0
		const mechanism: CorpusMechanism = async () => {
			calls++
			return new Uint8Array([0])
		}
		const port = createLocalCorpusAdapter({ root, mechanism })
		expectPortFailure(
			await thrownBy(
				port.resolve({ privateRef: join(outside, 'secret.bin') }, signal),
			),
		)
		expect(calls).toBe(0)
	})

	it('fixture 81: a symlink inside the root pointing outside it throws port-failure', async () => {
		await symlink(join(outside, 'secret.bin'), join(root, 'escape.bin'))
		const port = createLocalCorpusAdapter({ root })
		// The lexical half cannot see this: "escape.bin" is relative and holds no
		// ".." segment, so only the real-path half refuses it.
		expectPortFailure(
			await thrownBy(port.resolve({ privateRef: 'escape.bin' }, signal)),
		)
	})

	it('fixture 82: the response echoes the requested privateRef', async () => {
		const port = createLocalCorpusAdapter({ root })
		const response = await port.resolve({ privateRef: 'one.bin' }, signal)
		expect(response.privateRef).toBe('one.bin')
	})
})
