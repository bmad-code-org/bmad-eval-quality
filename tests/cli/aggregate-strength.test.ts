/**
 * The `aggregate-strength` command in memory: its argument grammar, the one
 * orchestration call, the exit codes (0 whatever a floor decides, 4 for a
 * refused set, 5 for an unreadable input, 64 for a usage error), the output
 * routing, and the same behavior against the built binary. Evidence comes
 * from the real `runScore` chain.
 */
import { spawnSync } from 'node:child_process'
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { aggregateStrength } from '../../src/application/aggregate-strength.ts'
import { serializeArtifact } from '../../src/application/serialize.ts'
import { parseArguments } from '../../src/cli/arguments.ts'
import {
	type CommandOutcome,
	EXIT_FAULT,
	EXIT_OK,
	EXIT_STRUCTURAL_FAILURE,
	EXIT_USAGE,
	exitCodeFor,
} from '../../src/cli/exit-codes.ts'
import {
	APPLICATION,
	helpText,
	type RunEnvironment,
	run,
} from '../../src/cli/run.ts'
import type { EvidenceArtifact } from '../../src/core/schemas/evidence-artifact.ts'
import {
	REAL_POLICY,
	scoreDefectProbe,
} from '../aggregate/fixtures/real-evidence.ts'

const VERSION = '9.9.9-test'

type Fake = RunEnvironment & {
	readonly out: string[]
	readonly diagnostics: string[]
	readonly writes: { path: string; body: string }[]
}

const normalise = (path: string): string => {
	const segments: string[] = []
	for (const segment of path.split('/')) {
		if (segment === '' || segment === '.') continue
		if (segment === '..') segments.pop()
		else segments.push(segment)
	}
	return `${path.startsWith('/') ? '/' : ''}${segments.join('/')}`
}

const environmentOf = (files: Readonly<Record<string, string>>): Fake => {
	const out: string[] = []
	const diagnostics: string[] = []
	const writes: { path: string; body: string }[] = []
	return {
		out,
		diagnostics,
		writes,
		readInput: async (source) => {
			const text = source === null ? undefined : files[source]
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
		sameFile: async () => false,
		corpusPort: () => {
			throw new Error('aggregate-strength resolves no private reference')
		},
		signal: new AbortController().signal,
		version: VERSION,
	}
}

const invoke = async (
	argv: readonly string[],
	files: Readonly<Record<string, string>>,
	application = APPLICATION,
) => {
	const environment = environmentOf(files)
	const invocation = parseArguments(argv)
	const { outcome } = await run(invocation, environment, application)
	return {
		environment,
		outcome,
		exit: exitCodeFor(outcome, {
			strict: invocation.kind === 'run' && invocation.strict,
		}),
	}
}

const json = (artifact: unknown, path = 'EvidenceArtifact'): string =>
	serializeArtifact(artifact, path)

let fourOfFive: EvidenceArtifact[]

beforeAll(async () => {
	fourOfFive = [
		await scoreDefectProbe('P-001', [true, true, true]),
		await scoreDefectProbe('P-002', [true, true, true]),
		await scoreDefectProbe('P-003', [true, true, true]),
		await scoreDefectProbe('P-004', [true, true, true]),
		await scoreDefectProbe('P-005', [false, false, false]),
	]
})

const filesOf = (
	evidence: readonly EvidenceArtifact[],
	floors: unknown,
): Record<string, string> => ({
	...Object.fromEntries(
		evidence.map((artifact, index) => [`e${index + 1}.json`, json(artifact)]),
	),
	'floors.json': JSON.stringify(floors),
})

const evidenceFlags = (count: number): string[] =>
	Array.from({ length: count }, (_, index) => [
		'--evidence',
		`e${index + 1}.json`,
	]).flat()

describe('aggregate-strength: the argument grammar', () => {
	it('collects every --evidence and requires --floors', () => {
		const parsed = parseArguments([
			'aggregate-strength',
			'--evidence',
			'a.json',
			'--evidence=b.json',
			'--floors',
			'f.json',
		])
		expect(parsed).toMatchObject({
			kind: 'run',
			command: 'aggregate-strength',
			inputs: { evidence: ['a.json', 'b.json'], floors: 'f.json' },
			out: null,
		})
	})

	it('names every missing flag in one usage error', () => {
		expect(parseArguments(['aggregate-strength'])).toEqual({
			kind: 'usage-error',
			message: 'aggregate-strength requires --evidence, --floors',
		})
		expect(
			parseArguments(['aggregate-strength', '--floors', 'f.json']),
		).toEqual({
			kind: 'usage-error',
			message: 'aggregate-strength requires --evidence',
		})
		expect(
			parseArguments(['aggregate-strength', '--evidence', 'a.json']),
		).toEqual({
			kind: 'usage-error',
			message: 'aggregate-strength requires --floors',
		})
	})

	it('refuses a flag another command owns', () => {
		expect(
			parseArguments([
				'aggregate-strength',
				'--evidence',
				'a.json',
				'--floors',
				'f.json',
				'--record',
				'r.json',
			]),
		).toEqual({
			kind: 'usage-error',
			message: 'unknown flag "--record" for aggregate-strength',
		})
		expect(parseArguments(['score', '--evidence', 'a.json'])).toEqual({
			kind: 'usage-error',
			message: 'unknown flag "--evidence" for score',
		})
	})

	it('refuses two different --floors and allows an identical repeat', () => {
		const base = ['aggregate-strength', '--evidence', 'a.json']
		expect(
			parseArguments([...base, '--floors', 'f.json', '--floors', 'g.json']),
		).toMatchObject({ kind: 'usage-error' })
		expect(
			parseArguments([...base, '--floors', 'f.json', '--floors', 'f.json']),
		).toMatchObject({ kind: 'run' })
	})

	it('allows one input on stdin and refuses two', () => {
		expect(
			parseArguments([
				'aggregate-strength',
				'--evidence',
				'-',
				'--floors',
				'f.json',
			]),
		).toMatchObject({ kind: 'run' })
		expect(
			parseArguments([
				'aggregate-strength',
				'--evidence',
				'-',
				'--floors',
				'-',
			]),
		).toEqual({
			kind: 'usage-error',
			message:
				'only one input may read stdin, but --evidence and --floors both name "-"',
		})
	})

	it('prints its own help block, and lists itself in the general usage', () => {
		const block = helpText('aggregate-strength')
		expect(block).toContain('--evidence <path>')
		expect(block).toContain('--floors <path>')
		expect(block).toContain('strength-aggregate.json')
		expect(helpText(null)).toContain(
			'eval-quality aggregate-strength --evidence',
		)
	})
})

describe('aggregate-strength: the command', () => {
	it('writes the canonical aggregate to stdout and exits 0 when the floor is met', async () => {
		const { environment, outcome, exit } = await invoke(
			['aggregate-strength', ...evidenceFlags(5), '--floors', 'floors.json'],
			filesOf(fourOfFive, { defect: 0.75 }),
		)
		expect(outcome).toEqual({ kind: 'artifact' })
		expect(exit).toBe(EXIT_OK)
		expect(environment.diagnostics).toEqual([])
		const expected = serializeArtifact(
			aggregateStrength({
				evidence: fourOfFive,
				floors: { defect: 0.75 },
				engineVersion: VERSION,
			}),
			'StrengthAggregate',
		)
		expect(environment.out).toEqual([expected])
		expect(JSON.parse(environment.out[0] as string)).toMatchObject({
			engineVersion: VERSION,
			floorDecisions: { defect: { decision: 'meets', floor: 0.75 } },
		})
	})

	it('exits 0 when a floor is not met, and records the decision in the artifact', async () => {
		const { environment, outcome, exit } = await invoke(
			['aggregate-strength', ...evidenceFlags(5), '--floors', 'floors.json'],
			filesOf(fourOfFive, { defect: 0.9 }),
		)
		expect(outcome).toEqual({ kind: 'artifact' })
		expect(exit).toBe(EXIT_OK)
		expect(
			JSON.parse(environment.out[0] as string).floorDecisions.defect,
		).toEqual({
			floor: 0.9,
			decision: 'does-not-meet',
			basis: 'rate-below-floor',
		})
	})

	it('never promotes an unmet floor under --strict', async () => {
		const { exit } = await invoke(
			[
				'aggregate-strength',
				...evidenceFlags(5),
				'--floors',
				'floors.json',
				'--strict',
			],
			filesOf(fourOfFive, { defect: 0.9 }),
		)
		expect(exit).toBe(EXIT_OK)
	})

	it('makes exactly one orchestration call, handing it the parsed inputs and the binary version', async () => {
		const spy = vi.fn(APPLICATION.aggregateStrength)
		await invoke(
			['aggregate-strength', ...evidenceFlags(5), '--floors', 'floors.json'],
			filesOf(fourOfFive, { defect: 0.75 }),
			{ ...APPLICATION, aggregateStrength: spy },
		)
		expect(spy).toHaveBeenCalledTimes(1)
		const options = spy.mock.calls[0]?.[0]
		expect(options?.engineVersion).toBe(VERSION)
		expect(options?.floors).toEqual({ defect: 0.75 })
		expect(options?.evidence).toHaveLength(5)
	})

	it('writes to --out as a file or into a directory taking strength-aggregate.json', async () => {
		const files = filesOf(fourOfFive, { defect: 0.75 })
		const base = [
			'aggregate-strength',
			...evidenceFlags(5),
			'--floors',
			'floors.json',
		]
		const toFile = await invoke([...base, '--out', 'run/aggregate.json'], files)
		expect(toFile.environment.writes.map((write) => write.path)).toEqual([
			'run/aggregate.json',
		])
		expect(toFile.environment.out).toEqual([])
		const toDirectory = await invoke([...base, '--out', 'run'], files)
		expect(toDirectory.environment.writes.map((write) => write.path)).toEqual([
			'run/strength-aggregate.json',
		])
		expect(toDirectory.environment.writes[0]?.body).toBe(
			toFile.environment.writes[0]?.body,
		)
	})

	it('refuses an --out that is one of its own inputs, exiting 64', async () => {
		const { environment, exit } = await invoke(
			[
				'aggregate-strength',
				...evidenceFlags(5),
				'--floors',
				'floors.json',
				'--out',
				'e3.json',
			],
			filesOf(fourOfFive, { defect: 0.75 }),
		)
		expect(exit).toBe(EXIT_USAGE)
		expect(environment.writes).toEqual([])
		expect(environment.diagnostics[0]).toContain('--evidence "e3.json"')
	})

	it('exits 4 and writes nothing for a set that is not one run', async () => {
		const other = await scoreDefectProbe('P-006', [true, true, true], {
			policy: { ...REAL_POLICY, policyId: 'other-policy', catchThreshold: 0.6 },
		})
		const { environment, outcome, exit } = await invoke(
			['aggregate-strength', ...evidenceFlags(6), '--floors', 'floors.json'],
			filesOf([...fourOfFive, other], { defect: 0.75 }),
		)
		expect(outcome).toEqual({ kind: 'structural-failure' })
		expect(exit).toBe(EXIT_STRUCTURAL_FAILURE)
		expect(environment.out).toEqual([])
		expect(environment.diagnostics).toHaveLength(1)
		expect(environment.diagnostics[0]).toMatch(
			/^eval-quality: strength-inputs-disagree: EvidenceArtifact\[5\]: /,
		)
	})

	it('exits 4 for a tampered artifact', async () => {
		const forged = structuredClone(fourOfFive[0]) as any
		forged.reducedProbeOutcomes[0].caught = false
		const { environment, exit } = await invoke(
			['aggregate-strength', ...evidenceFlags(5), '--floors', 'floors.json'],
			filesOf([forged, ...fourOfFive.slice(1)], { defect: 0.75 }),
		)
		expect(exit).toBe(EXIT_STRUCTURAL_FAILURE)
		expect(environment.out).toEqual([])
		expect(environment.diagnostics[0]).toMatch(
			/^eval-quality: strength-input-inconsistent: EvidenceArtifact\[0\]: /,
		)
	})

	it('exits 4 for two artifacts of one probe', async () => {
		const { exit, environment } = await invoke(
			['aggregate-strength', ...evidenceFlags(2), '--floors', 'floors.json'],
			filesOf(
				[fourOfFive[0] as EvidenceArtifact, fourOfFive[0] as EvidenceArtifact],
				{},
			),
		)
		expect(exit).toBe(EXIT_STRUCTURAL_FAILURE)
		expect(environment.diagnostics[0]).toContain('strength-inputs-disagree')
	})

	it('exits 5 for an input that is not JSON, and for one that is not an evidence artifact', async () => {
		const notJson = await invoke(
			[
				'aggregate-strength',
				'--evidence',
				'e1.json',
				'--floors',
				'floors.json',
			],
			{ 'e1.json': 'nope', 'floors.json': '{}' },
		)
		expect(notJson.exit).toBe(EXIT_FAULT)
		expect(notJson.environment.diagnostics[0]).toBe(
			'eval-quality: schema-parse-failure: EvidenceArtifact: --evidence "e1.json" is not JSON: ' +
				'Unexpected token \'o\', "nope" is not valid JSON',
		)
		const wrongShape = await invoke(
			[
				'aggregate-strength',
				'--evidence',
				'e1.json',
				'--floors',
				'floors.json',
			],
			{ 'e1.json': '{}', 'floors.json': '{}' },
		)
		expect(wrongShape.exit).toBe(EXIT_FAULT)
		expect(wrongShape.environment.diagnostics[0]).toContain(
			'schema-parse-failure: EvidenceArtifact[]',
		)
	})

	it('names the first unreadable file when several are not JSON', async () => {
		const { exit, environment } = await invoke(
			[
				'aggregate-strength',
				'--evidence',
				'e1.json',
				'--evidence',
				'e2.json',
				'--floors',
				'floors.json',
			],
			{ 'e1.json': '{', 'e2.json': 'nope', 'floors.json': '{}' },
		)
		expect(exit).toBe(EXIT_FAULT)
		expect(environment.diagnostics[0]).toContain('--evidence "e1.json"')
	})

	it('exits 5 for floors naming a class the engine does not key', async () => {
		const { exit, environment } = await invoke(
			['aggregate-strength', ...evidenceFlags(1), '--floors', 'floors.json'],
			filesOf([fourOfFive[0] as EvidenceArtifact], { canary: 1 }),
		)
		expect(exit).toBe(EXIT_FAULT)
		expect(environment.diagnostics[0]).toContain(
			'schema-parse-failure: StrengthFloors',
		)
	})

	it('reads one input from stdin through "-"', async () => {
		const environment = environmentOf({ 'floors.json': '{}' })
		const evidence = json(fourOfFive[0])
		const stdinReading: Fake = {
			...environment,
			readInput: async (source) =>
				source === null ? evidence : await environment.readInput(source),
		}
		const invocation = parseArguments([
			'aggregate-strength',
			'--evidence',
			'-',
			'--floors',
			'floors.json',
		])
		const { outcome } = await run(invocation, stdinReading)
		expect(outcome).toEqual({ kind: 'artifact' } satisfies CommandOutcome)
		expect(JSON.parse(stdinReading.out[0] ?? 'null').inputs).toHaveLength(1)
	})
})

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const BUILT_MAIN = join(REPO, 'dist/cli/main.js')

describe.skipIf(!existsSync(BUILT_MAIN))(
	'aggregate-strength: the built binary',
	() => {
		let directory: string
		const path = (name: string): string => join(directory, name)

		beforeAll(() => {
			directory = mkdtempSync(join(tmpdir(), 'eval-quality-aggregate-'))
			for (const [index, artifact] of fourOfFive.entries()) {
				writeFileSync(path(`e${index + 1}.json`), json(artifact))
			}
			writeFileSync(path('floors-met.json'), '{"defect":0.75}')
			writeFileSync(path('floors-unmet.json'), '{"defect":0.9}')
		})
		afterAll(() => rmSync(directory, { recursive: true, force: true }))

		const binary = (args: readonly string[]) =>
			spawnSync(process.execPath, [BUILT_MAIN, ...args], {
				encoding: 'utf8',
			})
		const evidence = (count = 5): string[] =>
			Array.from({ length: count }, (_, index) => [
				'--evidence',
				path(`e${index + 1}.json`),
			]).flat()

		it('prints the aggregate, reports the package version, and exits 0 on a met floor', () => {
			const version = JSON.parse(
				readFileSync(join(REPO, 'package.json'), 'utf8'),
			).version
			const result = binary([
				'aggregate-strength',
				...evidence(),
				'--floors',
				path('floors-met.json'),
			])
			expect(result.status).toBe(0)
			expect(result.stderr).toBe('')
			const aggregate = JSON.parse(result.stdout)
			expect(aggregate.engineVersion).toBe(version)
			expect(aggregate.floorDecisions.defect.decision).toBe('meets')
			expect(aggregate.classes.defect).toMatchObject({ eligible: 5, caught: 4 })
		})

		it('exits 0 on an unmet floor, with the decision in the artifact', () => {
			const result = binary([
				'aggregate-strength',
				...evidence(),
				'--floors',
				path('floors-unmet.json'),
			])
			expect(result.status).toBe(0)
			expect(JSON.parse(result.stdout).floorDecisions.defect.decision).toBe(
				'does-not-meet',
			)
		})

		it('reproduces the same bytes on a second run and under another input order', () => {
			const args = (order: readonly number[]): string[] => [
				'aggregate-strength',
				...order.flatMap((n) => ['--evidence', path(`e${n}.json`)]),
				'--floors',
				path('floors-met.json'),
			]
			const first = binary(args([1, 2, 3, 4, 5]))
			const second = binary(args([1, 2, 3, 4, 5]))
			const shuffled = binary(args([5, 3, 1, 4, 2]))
			expect(second.stdout).toBe(first.stdout)
			expect(shuffled.stdout).toBe(first.stdout)
		})

		it('exits 4 and writes nothing to stdout when one artifact was altered', () => {
			const forged = structuredClone(fourOfFive[4]) as any
			forged.reducedProbeOutcomes[0].caught = true
			writeFileSync(path('forged.json'), json(forged))
			const result = binary([
				'aggregate-strength',
				...evidence(4),
				'--evidence',
				path('forged.json'),
				'--floors',
				path('floors-met.json'),
			])
			expect(result.status).toBe(4)
			expect(result.stdout).toBe('')
			expect(result.stderr).toContain(
				'eval-quality: strength-input-inconsistent: EvidenceArtifact[4]',
			)
		})

		it('writes --out as a file', () => {
			const result = binary([
				'aggregate-strength',
				...evidence(),
				'--floors',
				path('floors-met.json'),
				'--out',
				path('out/aggregate.json'),
			])
			expect(result.status).toBe(0)
			expect(result.stdout).toBe('')
			const written = readFileSync(path('out/aggregate.json'), 'utf8')
			expect(JSON.parse(written).schemaVersion).toBe(1)
			expect(written.endsWith('\n')).toBe(true)
		})

		it('exits 64 without --floors', () => {
			const result = binary(['aggregate-strength', ...evidence(1)])
			expect(result.status).toBe(64)
			expect(result.stderr).toBe(
				'eval-quality: usage: aggregate-strength requires --floors\n',
			)
		})
	},
)
