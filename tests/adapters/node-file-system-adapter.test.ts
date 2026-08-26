// Story 6.1 AC 12 fixtures 73-76: the shipped file-system adapter, run
// against AD-37's published suite and then against a real temporary
// directory. Fixture 76 proves the response parse is load-bearing on a
// shipped adapter, where the mechanism is real.

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
	createNodeFileSystemAdapter,
	type FileSystemMechanism,
} from '../../src/adapters/node-file-system-adapter.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type {
	FileReadRequest,
	FileWriteRequest,
} from '../../src/core/schemas/port-messages.ts'
import type {
	BuiltSubject,
	PortSubject,
	ScenarioKind,
} from '../../src/testing/conformance.ts'
import { runFileSystemPortConformance } from '../../src/testing/conformance.ts'

/** The raw value each scenario's mechanism produces, counted once per call. */
function scenarioMechanism(
	scenario: ScenarioKind,
	valid: () => unknown,
): { readonly run: () => Promise<unknown>; readonly calls: () => number } {
	let calls = 0
	return {
		calls: () => calls,
		run: async () => {
			calls++
			if (scenario === 'resolves') return valid()
			if (scenario === 'fails') {
				const error: Error & { code?: string } = new Error(
					'ENOENT: no such file or directory',
				)
				error.code = 'ENOENT'
				throw error
			}
			if (scenario === 'in-band-error') return { error: 'nope' }
			// The mechanism deliberately ignores the signal: honouring it is the
			// adapter's obligation under AD-28, and step 3's race is what
			// discharges it.
			return new Promise<unknown>(() => {})
		},
	}
}

function readSubject(): PortSubject<FileReadRequest> {
	return {
		name: 'createNodeFileSystemAdapter',
		sampleRequest: { path: '/corpus/one.bin' },
		abortBudgetMs: 200,
		build: async (scenario): Promise<BuiltSubject<FileReadRequest>> => {
			const mechanism = scenarioMechanism(
				scenario,
				() => new Uint8Array([1, 2, 3]),
			)
			const port = createNodeFileSystemAdapter({
				readFile: mechanism.run,
				writeFile: mechanism.run,
			})
			return {
				port: (request, signal) => port.readFile(request, signal),
				underlyingCalls: mechanism.calls,
			}
		},
	}
}

function writeSubject(): PortSubject<FileWriteRequest> {
	return {
		name: 'createNodeFileSystemAdapter',
		sampleRequest: { path: '/corpus/one.bin', bytes: new Uint8Array([4, 5]) },
		abortBudgetMs: 200,
		build: async (scenario): Promise<BuiltSubject<FileWriteRequest>> => {
			const mechanism = scenarioMechanism(scenario, () => 2)
			const port = createNodeFileSystemAdapter({
				readFile: mechanism.run,
				writeFile: mechanism.run,
			})
			return {
				port: (request, signal) => port.writeFile(request, signal),
				underlyingCalls: mechanism.calls,
			}
		},
	}
}

describe('the shipped file-system adapter (fixtures 73-76)', () => {
	let root = ''

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), 'eval-quality-fs-'))
	})

	afterEach(async () => {
		await rm(root, { recursive: true, force: true })
	})

	it('fixture 73: passes the published file-system conformance suite, twelve outcomes', async () => {
		const report = await runFileSystemPortConformance(
			readSubject(),
			writeSubject(),
		)
		expect(report.outcomes).toHaveLength(12)
		expect(report.outcomes.filter((outcome) => !outcome.passed)).toEqual([])
		expect(report.passed).toBe(true)
	})

	it('fixture 74: the default mechanism reads and writes a real file', async () => {
		const port = createNodeFileSystemAdapter()
		const path = join(root, 'round-trip.bin')
		const bytes = new Uint8Array([9, 8, 7, 6])
		const signal = new AbortController().signal

		const written = await port.writeFile({ path, bytes }, signal)
		expect(written.path).toBe(path)
		expect(new Uint8Array(await readFile(path))).toEqual(bytes)

		const read = await port.readFile({ path }, signal)
		expect(read.path).toBe(path)
		expect(new Uint8Array(read.bytes)).toEqual(bytes)
	})

	it('fixture 75: a write reports byteLength equal to the input length', async () => {
		const port = createNodeFileSystemAdapter()
		const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7])
		const response = await port.writeFile(
			{ path: join(root, 'sized.bin'), bytes },
			new AbortController().signal,
		)
		expect(response.byteLength).toBe(bytes.length)
		expect((await readFile(join(root, 'sized.bin'))).length).toBe(bytes.length)
	})

	it('fixture 76: a mechanism returning an in-band error throws port-contract-violation on FileReadResponse', async () => {
		const mechanism: FileSystemMechanism = {
			readFile: async () => ({ error: 'nope' }),
			writeFile: async () => 0,
		}
		const port = createNodeFileSystemAdapter(mechanism)
		const thrown = await port
			.readFile(
				{ path: join(root, 'absent.bin') },
				new AbortController().signal,
			)
			.then(
				() => undefined,
				(error: unknown) => error,
			)
		expect(thrown).toBeInstanceOf(RuntimeFault)
		expect((thrown as RuntimeFault).code).toBe('port-contract-violation')
		expect((thrown as RuntimeFault).artifactPath).toBe('FileReadResponse')
		// Real file, real write, so the temporary directory is exercised too.
		await writeFile(join(root, 'present.bin'), new Uint8Array([1]))
	})
})
