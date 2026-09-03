/**
 * The command line, parsed. Pure and synchronous over an `argv` array: no
 * filesystem, no `process`, no environment, no prompt and no terminal check,
 * because every command is non-interactive. Paths are carried through exactly
 * as given and resolved by the caller.
 */

export type Command = 'compile' | 'seal' | 'preflight' | 'score'

/** Eleven input flags across four commands. Closed, so a usage error can name the flag set. */
export type InputKey =
	| 'in'
	| 'contract'
	| 'probes'
	| 'observations'
	| 'record'
	| 'isolation-manifest'
	| 'evaluator-configuration'
	| 'probe'
	| 'preflight-verdict'
	| 'policy'
	| 'private-manifest'

export type ParsedInvocation =
	| { readonly kind: 'help'; readonly command: Command | null }
	| { readonly kind: 'version' }
	| { readonly kind: 'usage-error'; readonly message: string }
	| {
			readonly kind: 'run'
			readonly command: Command
			readonly inputs: Readonly<Partial<Record<InputKey, string>>>
			readonly out: string | null
			readonly runId: string | null
			/** `score`'s AD-11 caller-attested scoring-version input; `null` for every other command. */
			readonly corpusDigest: string | null
			/** `score`'s optional corpus-port root; `null` for every other command, and legal for `score` too when no private reference needs resolving. */
			readonly corpusRoot: string | null
			readonly strictInputs: boolean
			readonly strict: boolean
	  }

export const COMMANDS: readonly Command[] = [
	'compile',
	'seal',
	'preflight',
	'score',
]

/** The input flags each command takes, and which of them it requires. */
const INPUT_KEYS: Readonly<Record<Command, readonly InputKey[]>> = {
	compile: ['in'],
	seal: ['in'],
	preflight: ['contract', 'probes', 'observations'],
	score: [
		'record',
		'isolation-manifest',
		'evaluator-configuration',
		'contract',
		'probe',
		'preflight-verdict',
		'policy',
		'private-manifest',
	],
}

/**
 * Keys whose absence is legal even though the command declares them: `in`
 * falls back to stdin, and `score`'s three name artifacts that are genuinely
 * optional at the domain level (AD-16's absent isolation manifest, an absent
 * evaluator configuration, and an optional private-manifest no stage row
 * requires).
 */
const OPTIONAL_INPUT_KEYS: ReadonlySet<InputKey> = new Set([
	'in',
	'isolation-manifest',
	'evaluator-configuration',
	'private-manifest',
])

/** `--strict-inputs` is AD-4's compile mode; `preflight` and `score` have no compile step. */
const TAKES_STRICT_INPUTS: Readonly<Record<Command, boolean>> = {
	compile: true,
	seal: true,
	preflight: false,
	score: false,
}

/** `--run-id` names the run a verdict is minted for, which only `preflight` does: `score` reads its run identifier off `--record` instead. */
const TAKES_RUN_ID: Readonly<Record<Command, boolean>> = {
	compile: false,
	seal: false,
	preflight: true,
	score: false,
}

/** `--corpus-digest` supplies `score`'s one caller-attested scoring-version input with no artifact source; required whenever it applies, the same posture `--run-id` takes for `preflight`. */
const TAKES_CORPUS_DIGEST: Readonly<Record<Command, boolean>> = {
	compile: false,
	seal: false,
	preflight: false,
	score: true,
}

/** `--corpus-root` names the directory `score`'s corpus-port adapter resolves a private reference under; always optional at this layer, since whether one is actually needed depends on the artifacts' own content, not the argument grammar. */
const TAKES_CORPUS_ROOT: Readonly<Record<Command, boolean>> = {
	compile: false,
	seal: false,
	preflight: false,
	score: true,
}

const STDIN = '-'

const isCommand = (token: string): token is Command =>
	(COMMANDS as readonly string[]).includes(token)

const usageError = (message: string): ParsedInvocation => ({
	kind: 'usage-error',
	message,
})

/** `--flag=value`, split on the first `=` so a value may contain one. */
function splitFlag(token: string): { flag: string; inline: string | null } {
	const equals = token.indexOf('=')
	if (equals === -1) return { flag: token, inline: null }
	return { flag: token.slice(0, equals), inline: token.slice(equals + 1) }
}

export function parseArguments(argv: readonly string[]): ParsedInvocation {
	const first = argv[0]
	if (first === undefined) {
		return usageError(
			`no command given; expected one of ${COMMANDS.join(', ')}`,
		)
	}
	if (first === '--help' || first === '-h' || first === 'help') {
		const target = argv[1]
		if (target === undefined) return { kind: 'help', command: null }
		if (isCommand(target)) return { kind: 'help', command: target }
		return usageError(
			`unknown command "${target}"; expected one of ${COMMANDS.join(', ')}`,
		)
	}
	if (first === '--version' || first === '-V') return { kind: 'version' }
	if (!isCommand(first)) {
		return usageError(
			`unknown command "${first}"; expected one of ${COMMANDS.join(', ')}`,
		)
	}
	return parseCommand(first, argv.slice(1))
}

function parseCommand(
	command: Command,
	rest: readonly string[],
): ParsedInvocation {
	const valueFlags = new Map<
		string,
		InputKey | 'out' | 'run-id' | 'corpus-digest' | 'corpus-root'
	>()
	for (const key of INPUT_KEYS[command]) valueFlags.set(`--${key}`, key)
	valueFlags.set('--out', 'out')
	if (TAKES_RUN_ID[command]) valueFlags.set('--run-id', 'run-id')
	if (TAKES_CORPUS_DIGEST[command]) {
		valueFlags.set('--corpus-digest', 'corpus-digest')
	}
	if (TAKES_CORPUS_ROOT[command]) valueFlags.set('--corpus-root', 'corpus-root')

	const inputs: Partial<Record<InputKey, string>> = {}
	const seen = new Map<string, string>()
	let out: string | null = null
	let runId: string | null = null
	let corpusDigest: string | null = null
	let corpusRoot: string | null = null
	let strictInputs = true
	let strict = false

	const takeValue = (
		flag: string,
		inline: string | null,
		index: number,
	): { value: string; next: number } | ParsedInvocation => {
		if (inline !== null) {
			if (inline === '') return usageError(`${flag} was given an empty value`)
			return { value: inline, next: index + 1 }
		}
		const value = rest[index + 1]
		if (value === undefined) return usageError(`${flag} requires a value`)
		if (value === '') return usageError(`${flag} was given an empty value`)
		// A flag-shaped token is the next flag, so the space form treats it as a
		// missing value. Bare `-` stays legal because it names stdin, and a path
		// beginning with `-` is what the equals form is for.
		if (value.length > 1 && value.startsWith('-')) {
			return usageError(
				`${flag} requires a value, but the next token is "${value}"; use ${flag}=${value} for a value that begins with "-"`,
			)
		}
		return { value, next: index + 2 }
	}

	for (let index = 0; index < rest.length; ) {
		const token = rest[index] as string
		if (token === '--') {
			const positional = rest[index + 1]
			if (positional === undefined) break
			return usageError(
				`${command} takes no positional argument, but got "${positional}"`,
			)
		}
		if (token === '--help' || token === '-h') {
			return { kind: 'help', command }
		}
		const { flag, inline } = splitFlag(token)
		const target = valueFlags.get(flag)
		if (target !== undefined) {
			const taken = takeValue(flag, inline, index)
			if ('kind' in taken) return taken
			const previous = seen.get(flag)
			if (previous !== undefined && previous !== taken.value) {
				return usageError(
					`${flag} given twice with different values, "${previous}" and "${taken.value}"`,
				)
			}
			seen.set(flag, taken.value)
			if (target === 'out') out = taken.value
			else if (target === 'run-id') runId = taken.value
			else if (target === 'corpus-digest') corpusDigest = taken.value
			else if (target === 'corpus-root') corpusRoot = taken.value
			else inputs[target] = taken.value
			index = taken.next
			continue
		}
		if (inline !== null) {
			return usageError(`unknown flag "${flag}" in "${token}"`)
		}
		if (flag === '--strict') {
			strict = true
			index += 1
			continue
		}
		if (TAKES_STRICT_INPUTS[command] && flag === '--strict-inputs') {
			strictInputs = true
			index += 1
			continue
		}
		if (TAKES_STRICT_INPUTS[command] && flag === '--no-strict-inputs') {
			strictInputs = false
			index += 1
			continue
		}
		return usageError(`unknown flag "${token}" for ${command}`)
	}

	const missing = INPUT_KEYS[command]
		.filter((key) => !OPTIONAL_INPUT_KEYS.has(key) && inputs[key] === undefined)
		.map((key) => `--${key}`)
	if (TAKES_RUN_ID[command] && runId === null) missing.push('--run-id')
	if (TAKES_CORPUS_DIGEST[command] && corpusDigest === null) {
		missing.push('--corpus-digest')
	}
	// `PreflightVerdict.runId` is `z.string().min(1)`, which a run of spaces
	// satisfies. It then renders as blank in every diagnostic line and names
	// nothing a reader can correlate, so the argument surface refuses it here
	// rather than the schema refusing what it declares legal.
	if (runId !== null && runId.trim() === '') {
		return usageError('--run-id must contain a non-whitespace character')
	}
	if (missing.length > 0) {
		return usageError(`${command} requires ${missing.join(', ')}`)
	}

	// One stdin cannot serve two readers, so at most one input may be `-`.
	const fromStdin = INPUT_KEYS[command].filter((key) => inputs[key] === STDIN)
	if (fromStdin.length > 1) {
		const flags = fromStdin.map((key) => `--${key}`)
		const named =
			flags.length === 2
				? `${flags.join(' and ')} both name`
				: `${flags.join(', ')} all name`
		return usageError(`only one input may read stdin, but ${named} "-"`)
	}

	return {
		kind: 'run',
		command,
		inputs,
		out,
		runId,
		corpusDigest,
		corpusRoot,
		strictInputs,
		strict,
	}
}
