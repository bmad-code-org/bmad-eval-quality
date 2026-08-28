/**
 * AC 17, cases 1 through 30: the argv parser of AC 9. Every case is a pure
 * call over a string array. Cases 24 and 25 read the module source from disk
 * to pin the two things the parser must never contain.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ParsedInvocation } from '../../src/cli/arguments.ts'
import { COMMANDS, parseArguments } from '../../src/cli/arguments.ts'

type RunInvocation = Extract<ParsedInvocation, { kind: 'run' }>
type UsageError = Extract<ParsedInvocation, { kind: 'usage-error' }>

/** The four flags `preflight` requires, in the order the grammar lists them. */
const PREFLIGHT_INPUTS = [
	'--contract',
	'contract.json',
	'--probes',
	'probes.json',
	'--observations',
	'observations.json',
	'--run-id',
	'R-1',
]

function parseRun(argv: readonly string[]): RunInvocation {
	const parsed = parseArguments(argv)
	if (parsed.kind !== 'run') {
		throw new Error(`expected a run invocation, got "${parsed.kind}"`)
	}
	return parsed
}

function parseUsageError(argv: readonly string[]): UsageError {
	const parsed = parseArguments(argv)
	if (parsed.kind !== 'usage-error') {
		throw new Error(`expected a usage error, got "${parsed.kind}"`)
	}
	return parsed
}

describe('cli arguments: the three accepts (cases 1-3)', () => {
	it('case 1: compile accepts every flag it takes', () => {
		expect(
			parseArguments([
				'compile',
				'--in',
				'contract.json',
				'--out',
				'artifacts/',
				'--strict-inputs',
				'--strict',
			]),
		).toEqual({
			kind: 'run',
			command: 'compile',
			inputs: { in: 'contract.json' },
			out: 'artifacts/',
			runId: null,
			strictInputs: true,
			strict: true,
		})
	})

	it('case 2: seal accepts every flag it takes', () => {
		expect(
			parseArguments([
				'seal',
				'--in',
				'compiled.json',
				'--out',
				'artifacts/sealed.json',
				'--strict-inputs',
				'--strict',
			]),
		).toEqual({
			kind: 'run',
			command: 'seal',
			inputs: { in: 'compiled.json' },
			out: 'artifacts/sealed.json',
			runId: null,
			strictInputs: true,
			strict: true,
		})
	})

	it('case 3: preflight accepts every flag it takes', () => {
		expect(
			parseArguments([
				'preflight',
				...PREFLIGHT_INPUTS,
				'--out',
				'artifacts/',
				'--strict',
			]),
		).toEqual({
			kind: 'run',
			command: 'preflight',
			inputs: {
				contract: 'contract.json',
				probes: 'probes.json',
				observations: 'observations.json',
			},
			out: 'artifacts/',
			runId: 'R-1',
			strictInputs: true,
			strict: true,
		})
	})
})

describe('cli arguments: the four defaults (cases 4-7)', () => {
	it('case 4: an absent input key means stdin, so a bare compile carries no inputs', () => {
		const parsed = parseRun(['compile'])
		expect(parsed.inputs).toEqual({})
		expect(parsed.inputs.in).toBeUndefined()
	})

	it('case 5: no --out means stdout, spelled as a null out', () => {
		expect(parseRun(['compile', '--in', 'contract.json']).out).toBeNull()
		expect(parseRun(['seal']).out).toBeNull()
		expect(parseRun(['preflight', ...PREFLIGHT_INPUTS]).out).toBeNull()
	})

	it('case 6: --strict-inputs is on by default on every command', () => {
		expect(parseRun(['compile']).strictInputs).toBe(true)
		expect(parseRun(['seal']).strictInputs).toBe(true)
		expect(parseRun(['preflight', ...PREFLIGHT_INPUTS]).strictInputs).toBe(true)
	})

	it('case 7: --strict is off by default on every command', () => {
		expect(parseRun(['compile']).strict).toBe(false)
		expect(parseRun(['seal']).strict).toBe(false)
		expect(parseRun(['preflight', ...PREFLIGHT_INPUTS]).strict).toBe(false)
	})
})

describe('cli arguments: --strict on all three commands (cases 8-10)', () => {
	it('case 8: compile --strict', () => {
		expect(parseRun(['compile', '--strict']).strict).toBe(true)
	})

	it('case 9: seal --strict', () => {
		expect(parseRun(['seal', '--strict']).strict).toBe(true)
	})

	it('case 10: preflight --strict', () => {
		expect(
			parseRun(['preflight', ...PREFLIGHT_INPUTS, '--strict']).strict,
		).toBe(true)
	})
})

describe('cli arguments: the input mode (cases 11-12)', () => {
	it('case 11: --no-strict-inputs turns the compile mode off and --strict-inputs turns it on', () => {
		expect(parseRun(['compile', '--no-strict-inputs']).strictInputs).toBe(false)
		expect(parseRun(['compile', '--strict-inputs']).strictInputs).toBe(true)
		expect(parseRun(['seal', '--no-strict-inputs']).strictInputs).toBe(false)
		expect(parseRun(['seal', '--strict-inputs']).strictInputs).toBe(true)
	})

	it('case 12: the last input-mode flag wins in both orders', () => {
		expect(
			parseRun(['compile', '--strict-inputs', '--no-strict-inputs'])
				.strictInputs,
		).toBe(false)
		expect(
			parseRun(['compile', '--no-strict-inputs', '--strict-inputs'])
				.strictInputs,
		).toBe(true)
	})
})

describe('cli arguments: stdin (cases 13-15)', () => {
	it('case 13: --in - names stdin explicitly and is carried through as "-"', () => {
		expect(parseRun(['compile', '--in', '-']).inputs).toEqual({ in: '-' })
	})

	it('case 14: one input may be "-" while the others name paths', () => {
		const parsed = parseRun([
			'preflight',
			'--contract',
			'-',
			'--probes',
			'probes.json',
			'--observations',
			'observations.json',
			'--run-id',
			'R-1',
		])
		expect(parsed.inputs).toEqual({
			contract: '-',
			probes: 'probes.json',
			observations: 'observations.json',
		})
	})

	it('case 15: two inputs naming "-" collide, and the message names both flags', () => {
		const { message } = parseUsageError([
			'preflight',
			'--contract',
			'-',
			'--probes',
			'-',
			'--observations',
			'observations.json',
			'--run-id',
			'R-1',
		])
		expect(message).toContain('--contract')
		expect(message).toContain('--probes')
		expect(message).toContain('stdin')
	})
})

describe('cli arguments: equals form and the -- terminator (cases 16-17)', () => {
	it('case 16: --in=-name.json expresses a path beginning with a dash', () => {
		expect(parseRun(['compile', '--in=-name.json']).inputs).toEqual({
			in: '-name.json',
		})
	})

	it('case 17: a positional after -- is a usage error naming that token', () => {
		const { message } = parseUsageError(['compile', '--', 'contract.json'])
		expect(message).toContain('contract.json')
		expect(message).toContain('compile')
	})
})

describe('cli arguments: the six usage-error shapes (cases 18-23)', () => {
	it('case 18: an unknown flag, in both the bare and the equals spelling', () => {
		expect(parseUsageError(['compile', '--nope']).message).toContain('--nope')
		expect(parseUsageError(['compile', '--nope=x']).message).toContain('--nope')
	})

	it('case 19: a flag missing its value', () => {
		const { message } = parseUsageError(['compile', '--in'])
		expect(message).toContain('--in')
		expect(message).toContain('value')
	})

	it('case 20: a single-value flag repeated with two different values names both', () => {
		const { message } = parseUsageError([
			'compile',
			'--in',
			'first.json',
			'--in',
			'second.json',
		])
		expect(message).toContain('--in')
		expect(message).toContain('first.json')
		expect(message).toContain('second.json')
	})

	it('case 21: a missing required preflight input names the flag that is absent', () => {
		const { message } = parseUsageError([
			'preflight',
			'--contract',
			'contract.json',
			'--probes',
			'probes.json',
			'--run-id',
			'R-1',
		])
		expect(message).toContain('--observations')
		expect(message).toContain('preflight')
	})

	// The expected list is derived from `COMMANDS`, so a command added there
	// without reaching the usage message fails these two.
	it('case 22: an unknown command names the token and the three commands', () => {
		const { message } = parseUsageError(['compilee'])
		expect(message).toContain('compilee')
		expect(message).toContain(COMMANDS.join(', '))
	})

	it('case 23: an empty argv names the three commands it expected', () => {
		const { message } = parseUsageError([])
		expect(message).toContain(COMMANDS.join(', '))
	})
})

describe('cli arguments: source scans (cases 24-25)', () => {
	const source = readFileSync(
		new URL('../../src/cli/arguments.ts', import.meta.url),
		'utf8',
	)

	it('case 24: the parser source carries no isTTY, because every command is non-interactive', () => {
		expect(source).not.toContain('isTTY')
	})

	it('case 25: the parser source carries no node:fs and no node:path, so paths stay unresolved strings', () => {
		expect(source).not.toContain('node:fs')
		expect(source).not.toContain('node:path')
	})
})

describe('cli arguments: help and version (cases 26-28)', () => {
	it('case 26: help with no command, in all three spellings', () => {
		expect(parseArguments(['--help'])).toEqual({ kind: 'help', command: null })
		expect(parseArguments(['-h'])).toEqual({ kind: 'help', command: null })
		expect(parseArguments(['help'])).toEqual({ kind: 'help', command: null })
	})

	it('case 27: help with a command, as a help target and as a flag on the command', () => {
		expect(parseArguments(['help', 'compile'])).toEqual({
			kind: 'help',
			command: 'compile',
		})
		expect(parseArguments(['seal', '--help'])).toEqual({
			kind: 'help',
			command: 'seal',
		})
		// Help wins over the missing required inputs `preflight` would otherwise
		// reject, so `--help` is reachable from a wrong command line.
		expect(parseArguments(['preflight', '-h'])).toEqual({
			kind: 'help',
			command: 'preflight',
		})
	})

	it('case 28: --version and -V', () => {
		expect(parseArguments(['--version'])).toEqual({ kind: 'version' })
		expect(parseArguments(['-V'])).toEqual({ kind: 'version' })
	})
})

describe('cli arguments: values carried through unresolved (cases 29-30)', () => {
	it('case 29: --out is carried through exactly as given', () => {
		const target = '../artifacts/./nested/out.json'
		expect(parseRun(['compile', '--out', target]).out).toBe(target)
		expect(parseRun(['compile', `--out=${target}`]).out).toBe(target)
	})

	it('case 30: --run-id is carried through exactly as given', () => {
		const runId = 'RUN 2026-08-28/attempt.2'
		expect(
			parseRun([
				'preflight',
				'--contract',
				'contract.json',
				'--probes',
				'probes.json',
				'--observations',
				'observations.json',
				'--run-id',
				runId,
			]).runId,
		).toBe(runId)
	})
})
