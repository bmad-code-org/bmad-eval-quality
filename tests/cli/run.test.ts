/**
 * `run` (Story 6.5, AC 11): the three commands, each one orchestration call
 * plus serialization. Every effect is a member of `RunEnvironment`, so the
 * whole file runs in memory: no stream, no filesystem, no `process`.
 *
 * The environment below is the only fake. `resolvePath` is a hand-written
 * normaliser: `src/cli/run.ts` may not import `node:path`, and a test that
 * imported it would resolve against this process's working directory.
 */
import { describe, expect, it, vi } from 'vitest'
import {
	compile,
	type PreflightFromObservationsOptions,
	preflightFromObservations,
	RuntimeFault,
	StructuralFailure,
	seal,
	serializeArtifact,
} from '../../src/application/index.ts'
import type { ParsedInvocation } from '../../src/cli/arguments.ts'
import { parseArguments } from '../../src/cli/arguments.ts'
import {
	type CommandOutcome,
	EXIT_CONCERNS_PROMOTED,
	EXIT_FAIL,
	EXIT_FAULT,
	EXIT_INVALID,
	EXIT_OK,
	EXIT_STRUCTURAL_FAILURE,
	EXIT_USAGE,
	exitCodeFor,
} from '../../src/cli/exit-codes.ts'
import { EXIT_CODE_TABLE } from '../../src/cli/render.ts'
import {
	APPLICATION,
	type ApplicationFacade,
	type RunEnvironment,
	run,
} from '../../src/cli/run.ts'
import { planPreflight } from '../../src/core/preflight/plan.ts'
import type { ProbeObservation } from '../../src/core/schemas/port-messages.ts'
import {
	jsonBody,
	observationsFor,
	preflightContract,
	satisfiedPatches,
	seededProbe,
} from '../preflight/fixtures/observations.ts'
import { gateCContract } from '../schemas/fixtures/gate-c-contract.ts'

/**
 * A `node:path`-free normaliser standing in for `main.ts`'s `resolve`. It folds
 * the same things `resolve` folds, so a case here measures what production
 * measures. It deliberately does not model an alias no string fold can reach:
 * `sameFile` below is the member that answers those, and `main.ts` implements
 * it by comparing device and inode.
 */
const normalise = (path: string): string => {
	const rooted = path.startsWith('/')
	const segments: string[] = []
	for (const segment of path.split('/')) {
		if (segment === '' || segment === '.') continue
		if (segment === '..' && segments.length > 0 && segments.at(-1) !== '..') {
			segments.pop()
			continue
		}
		segments.push(segment)
	}
	return `${rooted ? '/' : ''}${segments.join('/')}`
}

type TestEnvironment = RunEnvironment & {
	readonly reads: (string | null)[]
	readonly writes: { path: string; body: string }[]
	readonly out: string[]
	readonly diagnostics: string[]
}

const environmentOf = (
	files: Readonly<Record<string, string>> = {},
	stdin = '',
	aliases: readonly (readonly [string, string])[] = [],
): TestEnvironment => {
	const reads: (string | null)[] = []
	const writes: { path: string; body: string }[] = []
	const out: string[] = []
	const diagnostics: string[] = []
	return {
		reads,
		writes,
		out,
		diagnostics,
		readInput: async (source) => {
			reads.push(source)
			if (source === null) return stdin
			const text = files[source]
			if (text === undefined) throw new Error(`the fixture has no ${source}`)
			return text
		},
		writeArtifact: async (path, body) => {
			writes.push({ path, body })
		},
		writeOut: (body) => {
			out.push(body)
		},
		writeDiagnostic: (line) => {
			diagnostics.push(line)
		},
		resolvePath: normalise,
		joinPath: (directory, name) => `${directory.replace(/\/+$/, '')}/${name}`,
		// The fixture map has no inodes, so two distinct spellings are two
		// distinct files here. `aliases` lets a case declare an alias pair the
		// way a symlink or a case-insensitive filesystem would present one.
		sameFile: async (left, right) =>
			aliases.some(
				(pair) =>
					(pair[0] === left && pair[1] === right) ||
					(pair[0] === right && pair[1] === left),
			),
		version: '0.0.0-test',
	}
}

/** `main.ts`'s own derivation, so a case can assert the code a run exits with. */
const exitOf = (
	invocation: ParsedInvocation,
	outcome: CommandOutcome,
): number =>
	exitCodeFor(outcome, {
		strict: invocation.kind === 'run' && invocation.strict,
	})

const invoke = async (
	argv: readonly string[],
	environment: TestEnvironment,
	application?: ApplicationFacade,
) => {
	const invocation = parseArguments(argv)
	const { outcome } = await run(invocation, environment, application)
	return { invocation, outcome, exit: exitOf(invocation, outcome) }
}

/** The three entry points, recorded. Cases 60 through 62 count these calls. */
const facadeOf = (overrides: Partial<ApplicationFacade> = {}) => ({
	compile: vi.fn(overrides.compile ?? APPLICATION.compile),
	seal: vi.fn(overrides.seal ?? APPLICATION.seal),
	preflightFromObservations: vi.fn(
		overrides.preflightFromObservations ??
			APPLICATION.preflightFromObservations,
	),
})

const CONTRACT_JSON = JSON.stringify(gateCContract)
const CONTRACT_INPUT = JSON.parse(CONTRACT_JSON) as unknown

const COMPILED_BYTES = serializeArtifact(
	compile(CONTRACT_INPUT),
	'EvalContract',
)
const SEALED_BYTES = serializeArtifact(
	seal(CONTRACT_INPUT),
	'SealedEvaluatorBrief',
)

const preflightPlan = planPreflight({
	contract: preflightContract,
	probes: [seededProbe],
	runId: 'run-1',
})

const FULL_OBSERVATIONS = observationsFor(
	preflightPlan.legs,
	satisfiedPatches(preflightPlan.legs),
)

/**
 * Literal, written from a green run and frozen, matching
 * `tests/application/preflight.test.ts`. Deriving these from `planPreflight`
 * would let a plan reduced to zero legs satisfy the diagnostic assertions.
 */
const PLANNED_LEG_IDS = [
	'create-a',
	'create-b',
	'read-a',
	'read-b',
	'list-a',
	'list-b',
	'preflight-control-observe',
	'preflight-control-observe-2',
	'fault-leg',
] as const

const PROBES_JSON = JSON.stringify([seededProbe])
const CONTRACT_FILE = JSON.stringify(preflightContract)

const preflightFiles = (
	observations: readonly ProbeObservation[] = FULL_OBSERVATIONS,
): Record<string, string> => ({
	'contract.json': CONTRACT_FILE,
	'probes.json': PROBES_JSON,
	'observations.json': JSON.stringify(observations),
})

const PREFLIGHT_ARGV = [
	'preflight',
	'--contract',
	'contract.json',
	'--probes',
	'probes.json',
	'--observations',
	'observations.json',
	'--run-id',
	'run-1',
] as const

const preflightArgv = (
	extra: readonly string[] = [],
	runId = 'run-1',
): string[] => [...PREFLIGHT_ARGV.slice(0, -1), runId, ...extra]

const verdictBytes = (
	observations: readonly ProbeObservation[] = FULL_OBSERVATIONS,
	runId = 'run-1',
): string =>
	serializeArtifact(
		preflightFromObservations({
			contract: preflightContract,
			probes: [seededProbe],
			runId,
			observations,
		}),
		'PreflightVerdict',
	)

/** `renderDiagnostic` over the lines `preflightFromObservations` emits. */
const preflightDiagnostics = (
	runId: string,
	options: { readonly missing?: readonly string[]; readonly passed: boolean },
): string[] => [
	...PLANNED_LEG_IDS.flatMap((legId) => [
		`eval-quality: preflight: ${runId}: leg "${legId}": planned`,
		`eval-quality: preflight: ${runId}: leg "${legId}": ${
			(options.missing ?? []).includes(legId) ? 'no observation' : 'observed'
		}`,
	]),
	`eval-quality: preflight: ${runId}: reduced ${PLANNED_LEG_IDS.length} leg(s): ${
		options.passed ? 'passed' : 'failed'
	}`,
]

describe('run: the happy paths', () => {
	it('case 57: compile writes the serialized contract to stdout and exits 0', async () => {
		const environment = environmentOf({ 'contract.json': CONTRACT_JSON })
		const { outcome, exit } = await invoke(
			['compile', '--in', 'contract.json'],
			environment,
		)
		expect(environment.out).toEqual([COMPILED_BYTES])
		expect(
			(JSON.parse(COMPILED_BYTES) as { contractId: string }).contractId,
		).toBe('exports-api-v1')
		expect(COMPILED_BYTES.endsWith('\n')).toBe(true)
		expect(outcome).toEqual({ kind: 'artifact' })
		expect(exit).toBe(EXIT_OK)
	})

	it('case 58: seal writes the serialized brief to stdout and exits 0', async () => {
		const environment = environmentOf({ 'contract.json': CONTRACT_JSON })
		const { outcome, exit } = await invoke(
			['seal', '--in', 'contract.json'],
			environment,
		)
		expect(environment.out).toEqual([SEALED_BYTES])
		expect(
			(JSON.parse(SEALED_BYTES) as { contractDigest: string }).contractDigest,
		).toMatch(/^sha256:[0-9a-f]{64}$/)
		expect(outcome).toEqual({ kind: 'artifact' })
		expect(exit).toBe(EXIT_OK)
	})

	it('case 59: preflight writes the serialized verdict to stdout and exits 0', async () => {
		const environment = environmentOf(preflightFiles())
		const { outcome, exit } = await invoke(preflightArgv(), environment)
		expect(environment.out).toEqual([verdictBytes()])
		expect((JSON.parse(verdictBytes()) as { runId: string }).runId).toBe(
			'run-1',
		)
		expect(outcome).toEqual({ kind: 'preflight', passed: true })
		expect(exit).toBe(EXIT_OK)
	})
})

describe('run: exactly one orchestration call', () => {
	it('case 60: compile calls the facade compile once with the parsed input and the strict option', async () => {
		const environment = environmentOf({ 'contract.json': CONTRACT_JSON })
		const facade = facadeOf()
		await invoke(['compile', '--in', 'contract.json'], environment, facade)
		expect(facade.compile).toHaveBeenCalledTimes(1)
		expect(facade.compile).toHaveBeenCalledWith(CONTRACT_INPUT, {
			strict: true,
		})
		expect(facade.seal).not.toHaveBeenCalled()
		expect(facade.preflightFromObservations).not.toHaveBeenCalled()
	})

	// `application/seal.ts` compiles before it seals. That compile is inside
	// the one call, so the facade's own `compile` stays untouched.
	it('case 61: seal calls the facade seal once and the facade compile never', async () => {
		const environment = environmentOf({ 'contract.json': CONTRACT_JSON })
		const facade = facadeOf()
		await invoke(['seal', '--in', 'contract.json'], environment, facade)
		expect(facade.seal).toHaveBeenCalledTimes(1)
		expect(facade.seal).toHaveBeenCalledWith(CONTRACT_INPUT, { strict: true })
		expect(facade.compile).not.toHaveBeenCalled()
		expect(facade.preflightFromObservations).not.toHaveBeenCalled()
	})

	it('case 62: preflight calls the facade entry once with its three inputs, the run id, and a sink', async () => {
		const environment = environmentOf(preflightFiles())
		const facade = facadeOf()
		await invoke(preflightArgv(), environment, facade)
		expect(facade.preflightFromObservations).toHaveBeenCalledTimes(1)
		const options = facade.preflightFromObservations.mock.calls[0]?.[0] as
			| PreflightFromObservationsOptions
			| undefined
		expect(options?.contract).toEqual(JSON.parse(CONTRACT_FILE))
		expect(options?.probes).toEqual(JSON.parse(PROBES_JSON))
		expect(options?.observations).toEqual(FULL_OBSERVATIONS)
		expect(options?.runId).toBe('run-1')
		expect(typeof options?.sink).toBe('function')
		expect(facade.compile).not.toHaveBeenCalled()
		expect(facade.seal).not.toHaveBeenCalled()
	})
})

describe('run: the I/O counts', () => {
	// AC 12 rule 5: one read to end per input key. A stream transform would
	// show up here as a second call for the same source.
	it('case 63: compile reads its one input once, writes no file, and writes stdout once', async () => {
		const environment = environmentOf({ 'contract.json': CONTRACT_JSON })
		await invoke(['compile', '--in', 'contract.json'], environment)
		expect(environment.reads).toEqual(['contract.json'])
		expect(environment.writes).toHaveLength(0)
		expect(environment.out).toHaveLength(1)
		expect(environment.diagnostics).toHaveLength(0)

		// An absent `--in` reads stdin, still exactly once.
		const piped = environmentOf({}, CONTRACT_JSON)
		await invoke(['compile'], piped)
		expect(piped.reads).toEqual([null])
		expect(piped.out).toEqual([COMPILED_BYTES])
	})

	it('case 64: preflight reads each of its three inputs exactly once and writes one file', async () => {
		const environment = environmentOf(preflightFiles())
		await invoke(preflightArgv(['--out', 'run-42']), environment)
		expect(environment.reads).toEqual([
			'contract.json',
			'probes.json',
			'observations.json',
		])
		expect(new Set(environment.reads).size).toBe(environment.reads.length)
		expect(environment.writes).toHaveLength(1)
		expect(environment.out).toHaveLength(0)
		expect(environment.diagnostics).toHaveLength(PLANNED_LEG_IDS.length * 2 + 1)
	})
})

describe('run: where the artifact goes', () => {
	it('case 65: without --out the artifact goes to stdout and nothing is written', async () => {
		const environment = environmentOf(preflightFiles())
		await invoke(preflightArgv(), environment)
		expect(environment.out).toEqual([verdictBytes()])
		expect(environment.writes).toEqual([])
		// Diagnostics go to the diagnostic stream either way.
		expect(environment.diagnostics).toEqual(
			preflightDiagnostics('run-1', { passed: true }),
		)
	})

	it('case 66: with --out the artifact is written and stdout stays silent', async () => {
		const environment = environmentOf(preflightFiles())
		await invoke(preflightArgv(['--out', 'run-42']), environment)
		expect(environment.writes).toEqual([
			{ path: 'run-42/preflight-verdict.json', body: verdictBytes() },
		])
		expect(environment.out).toEqual([])
		expect(environment.diagnostics).toEqual(
			preflightDiagnostics('run-1', { passed: true }),
		)
	})

	it('case 67: --out without a .json suffix is a directory taking <target>/<kind>.json', async () => {
		const contractFiles = { 'contract.json': CONTRACT_JSON }
		const compiled = environmentOf(contractFiles)
		await invoke(
			['compile', '--in', 'contract.json', '--out', 'run-42'],
			compiled,
		)
		const sealed = environmentOf(contractFiles)
		await invoke(['seal', '--in', 'contract.json', '--out', 'run-42'], sealed)
		const preflighted = environmentOf(preflightFiles())
		await invoke(preflightArgv(['--out', 'run-42']), preflighted)
		expect([
			compiled.writes[0]?.path,
			sealed.writes[0]?.path,
			preflighted.writes[0]?.path,
		]).toEqual([
			'run-42/eval-contract.json',
			'run-42/sealed-evaluator-brief.json',
			'run-42/preflight-verdict.json',
		])
	})

	it('case 68: --out ending in .json is the file path, written exactly', async () => {
		const environment = environmentOf({ 'contract.json': CONTRACT_JSON })
		await invoke(
			['compile', '--in', 'contract.json', '--out', 'run-42/named.json'],
			environment,
		)
		expect(environment.writes).toEqual([
			{ path: 'run-42/named.json', body: COMPILED_BYTES },
		])
		const sealed = environmentOf({ 'contract.json': CONTRACT_JSON })
		await invoke(
			['seal', '--in', 'contract.json', '--out', 'brief.json'],
			sealed,
		)
		expect(sealed.writes[0]?.path).toBe('brief.json')
	})
})

// AC 12 rule 1: artifacts, help, and the version go to stdout; diagnostics and
// errors go to stderr. `main.ts` binds the two writers to the two streams, so
// the split is asserted here through the writers themselves.
describe('run: the stream split', () => {
	it('case 69: an artifact, help, and the version reach writeOut and never the diagnostic stream', async () => {
		const environment = environmentOf(preflightFiles())
		await invoke(preflightArgv(), environment)
		expect(environment.out).toEqual([verdictBytes()])
		// The same run emits diagnostics; not one of them carries artifact text.
		expect(environment.diagnostics.length).toBeGreaterThan(0)
		for (const line of environment.diagnostics) {
			expect(line.startsWith('eval-quality: preflight: ')).toBe(true)
			expect(line).not.toContain('"checks"')
		}

		const helped = environmentOf()
		await invoke(['--help'], helped)
		expect(helped.out).toHaveLength(1)
		expect(helped.diagnostics).toEqual([])

		const versioned = environmentOf()
		await invoke(['--version'], versioned)
		expect(versioned.out).toEqual(['0.0.0-test\n'])
		expect(versioned.diagnostics).toEqual([])
	})

	it('case 70: a usage error, a fault, and a pre-flight diagnostic reach writeDiagnostic and never stdout', async () => {
		const usage = environmentOf()
		await invoke(['compile', '--out'], usage)
		expect(usage.diagnostics).toEqual([
			'eval-quality: usage: --out requires a value',
		])
		expect(usage.out).toEqual([])

		const faulted = environmentOf({ 'contract.json': 'not json' })
		await invoke(['compile', '--in', 'contract.json'], faulted)
		expect(faulted.diagnostics).toHaveLength(1)
		expect(faulted.out).toEqual([])

		// With the artifact going to a file, stdout takes nothing at all while
		// the diagnostic stream still takes every line.
		const preflighted = environmentOf(preflightFiles())
		await invoke(preflightArgv(['--out', 'run-42']), preflighted)
		expect(preflighted.out).toEqual([])
		expect(preflighted.diagnostics).toEqual(
			preflightDiagnostics('run-1', { passed: true }),
		)
	})
})

describe('run: the error mappings', () => {
	// AD-28: `schema-parse-failure` covers an artifact that does not parse, and
	// the CLI is the boundary that deserializes. Exit 5, never 64.
	it('case 71: malformed JSON is a schema-parse-failure fault naming the input artifact, exit 5', async () => {
		const environment = environmentOf({ 'contract.json': '{ "contractId": ' })
		const { outcome, exit } = await invoke(
			['compile', '--in', 'contract.json'],
			environment,
		)
		expect(outcome).toEqual({ kind: 'fault' })
		expect(exit).toBe(EXIT_FAULT)
		expect(environment.diagnostics[0]).toMatch(
			/^eval-quality: schema-parse-failure: EvalContract: --in is not JSON: /,
		)
		expect(environment.out).toEqual([])
		expect(environment.writes).toEqual([])

		// The artifact path follows the input key, so a broken observation file
		// names `ProbeObservation` rather than `EvalContract`.
		const preflighted = environmentOf({
			...preflightFiles(),
			'observations.json': 'not json at all',
		})
		const broken = await invoke(preflightArgv(), preflighted)
		expect(broken.outcome).toEqual({ kind: 'fault' })
		expect(preflighted.diagnostics[0]).toMatch(
			/^eval-quality: schema-parse-failure: ProbeObservation: --observations is not JSON: /,
		)
	})

	it('case 72: a StructuralFailure maps to structural-failure and exit 4', async () => {
		const environment = environmentOf({ 'contract.json': CONTRACT_JSON })
		const facade = facadeOf({
			compile: () => {
				throw new StructuralFailure(
					'missing-requirement-linkage',
					'EvalContract.behaviors[id=B-001]',
					'the behaviour links no requirement and no risk',
				)
			},
		})
		const { outcome, exit } = await invoke(
			['compile', '--in', 'contract.json'],
			environment,
			facade,
		)
		expect(outcome).toEqual({ kind: 'structural-failure' })
		expect(exit).toBe(EXIT_STRUCTURAL_FAILURE)
		expect(environment.diagnostics).toEqual([
			'eval-quality: missing-requirement-linkage: EvalContract.behaviors[id=B-001]: the behaviour links no requirement and no risk',
		])
		expect(environment.out).toEqual([])
		expect(environment.writes).toEqual([])
	})

	it('case 73: a RuntimeFault maps to fault and exit 5', async () => {
		const environment = environmentOf({ 'contract.json': CONTRACT_JSON })
		const facade = facadeOf({
			seal: () => {
				throw new RuntimeFault(
					'schema-parse-failure',
					'EvalContract',
					'the contract compiles but cannot be sealed: duplicate oracleId',
				)
			},
		})
		const { outcome, exit } = await invoke(
			['seal', '--in', 'contract.json'],
			environment,
			facade,
		)
		expect(outcome).toEqual({ kind: 'fault' })
		expect(exit).toBe(EXIT_FAULT)
		expect(environment.diagnostics).toEqual([
			'eval-quality: schema-parse-failure: EvalContract: the contract compiles but cannot be sealed: duplicate oracleId',
		])
		expect(environment.out).toEqual([])
	})

	// A defect in our own code surfaces as a stack. Swallowing it into exit 5
	// would let a bug read as a caller's bad input.
	it('case 74: a seeded TypeError is rethrown rather than mapped to an exit code', async () => {
		const environment = environmentOf({ 'contract.json': CONTRACT_JSON })
		const facade = facadeOf({
			compile: () => {
				throw new TypeError('a seeded defect in our own code')
			},
		})
		await expect(
			invoke(['compile', '--in', 'contract.json'], environment, facade),
		).rejects.toThrow(TypeError)
		expect(environment.diagnostics).toEqual([])
		expect(environment.out).toEqual([])
		expect(environment.writes).toEqual([])
	})

	it('case 75: an --out colliding with an input is a usage error naming both sides, exit 64', async () => {
		const environment = environmentOf({ 'contract.json': CONTRACT_JSON })
		const { outcome, exit } = await invoke(
			['compile', '--in', './contract.json', '--out', 'contract.json'],
			environment,
		)
		expect(outcome).toEqual({ kind: 'usage-error' })
		expect(exit).toBe(EXIT_USAGE)
		expect(environment.diagnostics).toEqual([
			'eval-quality: usage: --out resolves to "contract.json", which is also --in "./contract.json"',
		])
		// The check runs before the read, so a colliding invocation opens nothing.
		expect(environment.reads).toEqual([])
		expect(environment.writes).toEqual([])

		// The joined directory target collides the same way.
		const directory = environmentOf({
			'out/eval-contract.json': CONTRACT_JSON,
		})
		await invoke(
			['compile', '--in', 'out/eval-contract.json', '--out', './out'],
			directory,
		)
		expect(directory.diagnostics).toEqual([
			'eval-quality: usage: --out resolves to "out/eval-contract.json", which is also --in "out/eval-contract.json"',
		])
	})
})

describe('run: the pre-flight passthrough', () => {
	it('case 76: --run-id reaches the verdict and its diagnostics', async () => {
		const environment = environmentOf(preflightFiles())
		await invoke(preflightArgv([], 'run-76'), environment)
		expect(environment.out).toEqual([verdictBytes(FULL_OBSERVATIONS, 'run-76')])
		expect(
			(JSON.parse(environment.out[0] as string) as { runId: string }).runId,
		).toBe('run-76')
		for (const line of environment.diagnostics) {
			expect(line.startsWith('eval-quality: preflight: run-76: ')).toBe(true)
		}
	})

	it('case 77: the sink routes every planned and observed line to the diagnostic stream', async () => {
		const environment = environmentOf(preflightFiles())
		await invoke(preflightArgv(), environment)
		expect(environment.diagnostics).toEqual(
			preflightDiagnostics('run-1', { passed: true }),
		)
	})
})

describe('run: the three observation shapes', () => {
	// AD-10: a partially probed plan is a failed verdict, and a failed
	// pre-flight invalidates the run rather than becoming a contract verdict.
	it('case 78: a partial observation array gives a failed verdict and exit 3', async () => {
		const partial = FULL_OBSERVATIONS.filter(
			(observation) => observation.probeId !== 'read-a',
		)
		const environment = environmentOf(preflightFiles(partial))
		const { outcome, exit } = await invoke(preflightArgv(), environment)
		expect(outcome).toEqual({ kind: 'preflight', passed: false })
		expect(exit).toBe(EXIT_INVALID)
		expect(environment.out).toEqual([verdictBytes(partial)])
		expect(environment.diagnostics).toEqual(
			preflightDiagnostics('run-1', { missing: ['read-a'], passed: false }),
		)
	})

	// `ProbeRequest.probeId` is echoed unchanged by contract, so a wholly
	// unanswered plan means the port broke that contract.
	it('case 79: an empty observation array is a port-contract-violation fault and exit 5', async () => {
		const environment = environmentOf(preflightFiles([]))
		const { outcome, exit } = await invoke(preflightArgv(), environment)
		expect(outcome).toEqual({ kind: 'fault' })
		expect(exit).toBe(EXIT_FAULT)
		expect(environment.diagnostics.at(-1)).toBe(
			`eval-quality: port-contract-violation: PreflightVerdict: no observation echoed any of the ${PLANNED_LEG_IDS.length} planned probe ids, so no fixture was observed`,
		)
		expect(environment.out).toEqual([])
	})

	it('case 80: an observation array answering no planned leg gives the same fault', async () => {
		const unplanned = FULL_OBSERVATIONS.map((observation) => ({
			...observation,
			probeId: `unplanned-${observation.probeId}`,
		}))
		const environment = environmentOf(preflightFiles(unplanned))
		const { outcome, exit } = await invoke(preflightArgv(), environment)
		expect(outcome).toEqual({ kind: 'fault' })
		expect(exit).toBe(EXIT_FAULT)
		expect(environment.diagnostics.at(-1)).toBe(
			`eval-quality: port-contract-violation: PreflightVerdict: no observation echoed any of the ${PLANNED_LEG_IDS.length} planned probe ids, so no fixture was observed`,
		)
		expect(environment.out).toEqual([])
	})
})

describe('run: NFR9 at the boundary', () => {
	it('case 81: the same input twice serializes to identical bytes', async () => {
		const first = environmentOf({ 'contract.json': CONTRACT_JSON })
		const second = environmentOf({ 'contract.json': CONTRACT_JSON })
		await invoke(['compile', '--in', 'contract.json'], first)
		await invoke(['compile', '--in', 'contract.json'], second)
		expect(first.out).toEqual(second.out)

		const firstVerdict = environmentOf(preflightFiles())
		const secondVerdict = environmentOf(preflightFiles())
		await invoke(preflightArgv(), firstVerdict)
		await invoke(preflightArgv(), secondVerdict)
		expect(firstVerdict.out).toEqual(secondVerdict.out)
		expect(firstVerdict.diagnostics).toEqual(secondVerdict.diagnostics)
	})

	/**
	 * The permutation family. The unique-`probeId` half passes on the binding
	 * `reducePreflight` already does. The duplicate half is the one AD-30:445
	 * names: an arbitrary tie-break is stable within a process, and last-write-
	 * wins over a repeated `probeId` makes the order decide the verdict. A
	 * `probeId` echoed twice is not an echo, so both orders must land on the
	 * same `port-contract-violation` naming the repeat (AC 17).
	 */
	it('case 82: a permuted observation array gives an identical outcome', async () => {
		const forward = environmentOf(preflightFiles())
		const reversed = environmentOf(
			preflightFiles([...FULL_OBSERVATIONS].reverse()),
		)
		await invoke(preflightArgv(), forward)
		await invoke(preflightArgv(), reversed)
		expect(forward.out).toEqual(reversed.out)

		const readA = FULL_OBSERVATIONS.find(
			(observation) => observation.probeId === 'read-a',
		) as ProbeObservation
		const duplicated = [
			...FULL_OBSERVATIONS,
			{ ...readA, body: jsonBody({ id: 't-2', value: 'alpha' }) },
		]
		const duplicateForward = environmentOf(preflightFiles(duplicated))
		const duplicateReversed = environmentOf(
			preflightFiles([...duplicated].reverse()),
		)
		const first = await invoke(preflightArgv(), duplicateForward)
		const second = await invoke(preflightArgv(), duplicateReversed)
		expect(first.outcome).toEqual(second.outcome)
		expect(duplicateForward.out).toEqual(duplicateReversed.out)
		expect(duplicateForward.diagnostics).toEqual(duplicateReversed.diagnostics)
		expect(first.outcome).toEqual({ kind: 'fault' })
		expect(duplicateForward.diagnostics.at(-1)).toMatch(
			/^eval-quality: port-contract-violation: PreflightVerdict: .*"?read-a"?/,
		)
	})
})

describe('run: the two strict flags', () => {
	it('case 83: --strict-inputs reaches the application call as options.strict true', async () => {
		const environment = environmentOf({ 'contract.json': CONTRACT_JSON })
		const facade = facadeOf()
		await invoke(
			['compile', '--in', 'contract.json', '--strict-inputs'],
			environment,
			facade,
		)
		expect(facade.compile).toHaveBeenCalledWith(CONTRACT_INPUT, {
			strict: true,
		})

		// The default is on, so an invocation naming neither flag agrees.
		const defaulted = facadeOf()
		await invoke(
			['compile', '--in', 'contract.json'],
			environmentOf({ 'contract.json': CONTRACT_JSON }),
			defaulted,
		)
		expect(defaulted.compile).toHaveBeenCalledWith(CONTRACT_INPUT, {
			strict: true,
		})
	})

	it('case 84: --no-strict-inputs reaches the application call as options.strict false', async () => {
		const environment = environmentOf({ 'contract.json': CONTRACT_JSON })
		const facade = facadeOf()
		await invoke(
			['compile', '--in', 'contract.json', '--no-strict-inputs'],
			environment,
			facade,
		)
		expect(facade.compile).toHaveBeenCalledWith(CONTRACT_INPUT, {
			strict: false,
		})

		const sealed = facadeOf()
		await invoke(
			['seal', '--in', 'contract.json', '--no-strict-inputs'],
			environmentOf({ 'contract.json': CONTRACT_JSON }),
			sealed,
		)
		expect(sealed.seal).toHaveBeenCalledWith(CONTRACT_INPUT, { strict: false })
	})

	// AD-4's input strictness and AD-21's gate promotion share a word and
	// nothing else: `--strict` lands in `exitCodeFor` and never in the call.
	it('case 85: --strict reaches exitCodeFor and never the application call', async () => {
		const environment = environmentOf({ 'contract.json': CONTRACT_JSON })
		const facade = facadeOf()
		const { invocation } = await invoke(
			['compile', '--in', 'contract.json', '--strict', '--no-strict-inputs'],
			environment,
			facade,
		)
		expect(invocation.kind === 'run' && invocation.strict).toBe(true)
		expect(facade.compile).toHaveBeenCalledWith(CONTRACT_INPUT, {
			strict: false,
		})
		const concerns: CommandOutcome = {
			kind: 'verdict',
			verdict: 'CONCERNS',
			evidenceConditionsOnly: false,
		}
		expect(exitOf(invocation, concerns)).toBe(EXIT_CONCERNS_PROMOTED)
		expect(
			exitOf(parseArguments(['compile', '--in', 'contract.json']), concerns),
		).toBe(EXIT_OK)
		expect(
			exitOf(invocation, {
				kind: 'verdict',
				verdict: 'FAIL',
				evidenceConditionsOnly: false,
			}),
		).toBe(EXIT_FAIL)
	})

	// Neither command carries a run identifier, so any line either wrote would
	// name no run and no stage.
	it('case 86: compile and seal write nothing to the diagnostic stream on success', async () => {
		const compiled = environmentOf({ 'contract.json': CONTRACT_JSON })
		await invoke(['compile', '--in', 'contract.json'], compiled)
		const sealed = environmentOf({ 'contract.json': CONTRACT_JSON })
		await invoke(['seal', '--in', 'contract.json', '--out', 'run-42'], sealed)
		expect(compiled.diagnostics).toEqual([])
		expect(sealed.diagnostics).toEqual([])
	})
})

describe('run: help and version', () => {
	it('case 87: help and version render through the environment writers', async () => {
		const environment = environmentOf()
		const { outcome, exit } = await invoke(['--help'], environment)
		expect(environment.out).toHaveLength(1)
		const help = environment.out[0] as string
		expect(help.endsWith('\n')).toBe(true)
		expect(help).toContain('Usage:')
		for (const command of ['compile', 'seal', 'preflight']) {
			expect(help).toContain(`eval-quality ${command}`)
		}
		expect(environment.diagnostics).toEqual([])
		expect(outcome).toEqual({ kind: 'artifact' })
		expect(exit).toBe(EXIT_OK)

		// `help <command>` narrows to that command's flags.
		const scoped = environmentOf()
		await invoke(['help', 'compile'], scoped)
		expect(scoped.out[0]).toContain('--strict-inputs')
		expect(scoped.out[0]).not.toContain('--observations')

		const versioned = environmentOf()
		const version = await invoke(['--version'], versioned)
		expect(versioned.out).toEqual(['0.0.0-test\n'])
		expect(versioned.diagnostics).toEqual([])
		expect(version.exit).toBe(EXIT_OK)
	})

	it('case 88: help carries all seven exit codes', async () => {
		const codes = [
			EXIT_OK,
			EXIT_CONCERNS_PROMOTED,
			EXIT_FAIL,
			EXIT_INVALID,
			EXIT_STRUCTURAL_FAILURE,
			EXIT_FAULT,
			EXIT_USAGE,
		]
		expect(new Set(codes).size).toBe(7)
		for (const argv of [
			['--help'],
			['help', 'compile'],
			['help', 'preflight'],
		]) {
			const environment = environmentOf()
			await invoke(argv, environment)
			const help = environment.out[0] as string
			for (const code of codes) {
				expect(help).toMatch(new RegExp(`^ {2}${code} +\\S`, 'm'))
			}
			// AC 12 rule 4: the table `--help` prints and the one the README
			// carries are one string, so the two cannot drift.
			expect(help).toContain(EXIT_CODE_TABLE)
		}
	})

	// Outside AC 17's range: added after a review found that two spellings of
	// one file passed the collision check and the command overwrote its own
	// input. `resolvePath` folds what a string can fold; `sameFile` answers the
	// aliases it cannot, and this case pins that `collides` consults it.
	it('case 176: an alias no path fold reaches is still a collision', async () => {
		const environment = environmentOf({ 'link.json': CONTRACT_JSON }, '', [
			['link.json', 'artifact.json'],
		])
		const { outcome, exit } = await invoke(
			['compile', '--in', 'link.json', '--out', 'artifact.json'],
			environment,
		)

		expect(outcome).toEqual({ kind: 'usage-error' })
		expect(exit).toBe(EXIT_USAGE)
		expect(environment.writes).toEqual([])
		// Without the alias the two are distinct files and the write happens.
		const distinct = environmentOf({ 'link.json': CONTRACT_JSON })
		const second = await invoke(
			['compile', '--in', 'link.json', '--out', 'artifact.json'],
			distinct,
		)
		expect(second.outcome).toEqual({ kind: 'artifact' })
		expect(distinct.writes).toHaveLength(1)
	})
})
