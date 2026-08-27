/**
 * `freezeArtifact` and the four sites that call it (Story 6.4, AC 11 cases 11
 * through 15). Assertions are throwing writes, because the throw is the
 * guarantee a caller meets.
 */
import { describe, expect, it } from 'vitest'
import { compile } from '../../src/application/compile.ts'
import { runPreflight } from '../../src/application/preflight.ts'
import { freezeArtifact } from '../../src/core/lineage/freeze.ts'
import { planPreflight } from '../../src/core/preflight/plan.ts'
import { reducePreflight } from '../../src/core/preflight/reduce.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { seal } from '../../src/core/seal/seal.ts'
import {
	observationsFor,
	preflightContract,
	satisfiedPatches,
	seededProbe,
} from '../preflight/fixtures/observations.ts'
import { echoPort } from '../preflight/fixtures/probe-port.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'

const sealableGateCContract = EvalContract.parse(gateCContract)

/** asserts a write to `mutate` throws, which is what ESM strict mode gives. */
const rejectsWrite = (mutate: () => void): void => {
	expect(mutate).toThrow(TypeError)
}

describe('freezeArtifact', () => {
	// 11
	it('freezes a nested object and a nested array element', () => {
		const frozen = freezeArtifact({
			nested: { value: 1 },
			list: [{ value: 2 }],
		})
		rejectsWrite(() => {
			frozen.nested.value = 9
		})
		rejectsWrite(() => {
			const first = frozen.list[0]
			if (first === undefined) throw new Error('fixture setup failed')
			first.value = 9
		})
		rejectsWrite(() => {
			frozen.list.push({ value: 3 })
		})
	})

	// 12. Artifacts are JSON trees. `Object.freeze` on a non-empty typed array
	// throws, and freezing a Date or a Map protects nothing it holds, so the
	// walk leaves every non-plain value where it found it.
	it('passes through primitives and non-JSON values', () => {
		expect(freezeArtifact(7)).toBe(7)
		expect(freezeArtifact('x')).toBe('x')
		expect(freezeArtifact(null)).toBeNull()
		expect(freezeArtifact(undefined)).toBeUndefined()

		const bytes = new Uint8Array([1, 2, 3])
		expect(freezeArtifact({ bytes }).bytes).toBe(bytes)
		expect(Object.isFrozen(bytes)).toBe(false)

		const stamp = new Date(0)
		expect(freezeArtifact({ stamp }).stamp).toBe(stamp)
		expect(Object.isFrozen(stamp)).toBe(false)
	})

	// 13. A cycle is the only input that distinguishes the guarded walk from an
	// unguarded one: a subtree shared between two parents terminates either
	// way. Deleting the `Object.isFrozen` guard turns this into a RangeError.
	it('terminates on a cyclic value', () => {
		const cyclic: { self?: unknown; value: number } = { value: 1 }
		cyclic.self = cyclic
		expect(freezeArtifact(cyclic)).toBe(cyclic)
		rejectsWrite(() => {
			cyclic.value = 2
		})
	})
})

// 14. One case per wired site.
describe('the four wired sites', () => {
	it('seal() returns a frozen brief', () => {
		const brief = seal(sealableGateCContract)
		rejectsWrite(() => {
			;(brief as { runId?: string }).runId = 'leaked'
		})
		rejectsWrite(() => {
			const first = brief.directions[0]
			if (first === undefined) throw new Error('fixture setup failed')
			;(first as { text: string }).text = 'leaked'
		})
	})

	it('reducePreflight() returns a frozen verdict and freezes nothing else', () => {
		const plan = planPreflight({
			contract: preflightContract,
			probes: [seededProbe],
			runId: 'run-1',
		})
		const observations = observationsFor(plan.legs, satisfiedPatches(plan.legs))
		const verdict = reducePreflight(plan, { observations })
		rejectsWrite(() => {
			;(verdict as { runId: string }).runId = 'leaked'
		})
		// `checks` is built from `plan.checks`, so a reducer branch returning a
		// planned check unchanged would freeze the caller's plan through it.
		expect(Object.isFrozen(plan)).toBe(false)
		expect(Object.isFrozen(plan.checks[0])).toBe(false)
		expect(Object.isFrozen(observations)).toBe(false)
		expect(Object.isFrozen(observations[0])).toBe(false)
	})

	it('the application compile() returns a frozen contract and freezes nothing else', () => {
		const input = structuredClone(gateCContract) as { behaviors: unknown[] }
		const contract = compile(input)
		rejectsWrite(() => {
			;(contract as { contractId: string }).contractId = 'leaked'
		})
		expect(Object.isFrozen(input)).toBe(false)
		expect(Object.isFrozen(input.behaviors)).toBe(false)
		expect(Object.isFrozen(input.behaviors[0])).toBe(false)
	})

	it('runPreflight() returns a frozen verdict and freezes nothing else', async () => {
		const contract = EvalContract.parse(gateCContract)
		const probes = [structuredClone(seededProbe)]
		const verdict = await runPreflight({
			contract: preflightContract,
			probes,
			runId: 'run-1',
			port: { probe: echoPort() },
			signal: new AbortController().signal,
		})
		rejectsWrite(() => {
			;(verdict as { runId: string }).runId = 'leaked'
		})
		expect(Object.isFrozen(probes)).toBe(false)
		expect(Object.isFrozen(probes[0])).toBe(false)
		expect(Object.isFrozen(contract)).toBe(false)
		expect(Object.isFrozen(preflightContract)).toBe(false)
	})

	// 15. `seal` assembles a brief whose members alias the caller's contract.
	// The literal it assembles is never returned: `validateAssembledBrief`
	// hands back Zod's own deep clone, and the freeze lands there. Without this
	// case the property is accidental.
	it('seal() leaves the caller-supplied contract unfrozen', () => {
		const contract = EvalContract.parse(gateCContract)
		seal(contract)
		expect(Object.isFrozen(contract)).toBe(false)
		expect(Object.isFrozen(contract.behaviors)).toBe(false)
		expect(Object.isFrozen(contract.behaviors[0])).toBe(false)
		expect(Object.isFrozen(contract.budgets)).toBe(false)
	})
})
