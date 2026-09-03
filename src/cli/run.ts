/**
 * The four commands. Each one reads its inputs, makes exactly one call into
 * `application/`, serializes what came back, and returns the outcome the exit
 * code is derived from. Every effect is a member of `RunEnvironment`, so this
 * module touches no stream, no `process`, and no Node builtin, and its tests
 * run in memory.
 */
import {
	compile,
	type Diagnostic,
	type DiagnosticSink,
	type PreflightFromObservationsOptions,
	preflightFromObservations,
	type RunScoreOptions,
	RuntimeFault,
	runScore,
	StructuralFailure,
	seal,
} from '../application/index.ts'
import type { Command, InputKey, ParsedInvocation } from './arguments.ts'
import type { CommandOutcome } from './exit-codes.ts'
import {
	EXIT_CODE_TABLE,
	renderArtifact,
	renderDiagnostic,
	renderError,
	renderUsage,
} from './render.ts'

export type RunEnvironment = {
	readonly readInput: (source: string | null) => Promise<string>
	readonly writeArtifact: (path: string, body: string) => Promise<void>
	readonly writeOut: (body: string) => void
	readonly writeDiagnostic: (line: string) => void
	readonly resolvePath: (path: string) => string
	readonly joinPath: (directory: string, name: string) => string
	/**
	 * Whether two paths name one file on disk. String normalization cannot
	 * settle it: a symlink and a case-insensitive filesystem both alias two
	 * spellings that no amount of folding brings together.
	 */
	readonly sameFile: (left: string, right: string) => Promise<boolean>
	/**
	 * `score`'s corpus-port factory over a caller-named root directory: a
	 * constructor, not a constructed value, since the root is only known once
	 * `--corpus-root` is parsed. `cli/` may not import `ports/` directly, so
	 * the port's own type is read off `RunScoreOptions` instead.
	 */
	readonly corpusPort: (root: string) => NonNullable<RunScoreOptions['port']>
	/** One per process invocation, the same shape `RunPreflightOptions.signal` already declares. */
	readonly signal: AbortSignal
	readonly version: string
}

/**
 * The four orchestration calls, behind one object so a test can count them.
 * An input/output count says nothing about how many calls into `application/`
 * happened, which is the property AD-14 constrains.
 */
export type ApplicationFacade = {
	readonly compile: typeof compile
	readonly seal: typeof seal
	readonly preflightFromObservations: typeof preflightFromObservations
	readonly runScore: typeof runScore
}

export const APPLICATION: ApplicationFacade = {
	compile,
	seal,
	preflightFromObservations,
	runScore,
}

export type RunResult = { readonly outcome: CommandOutcome }

/**
 * The published artifact types are read off the application entry points. The
 * matrix grants `cli/` the application and adapter layers only, so
 * `core/schemas` is out of reach here by construction.
 */
type EvalContract = PreflightFromObservationsOptions['contract']
type Probes = PreflightFromObservationsOptions['probes']
type Observations = PreflightFromObservationsOptions['observations']
type SealedEvaluatorBrief = ReturnType<typeof seal>
type PreflightVerdict = ReturnType<typeof preflightFromObservations>
type SealedRunRecordInput = RunScoreOptions['record']
type IsolationManifestInput = NonNullable<RunScoreOptions['manifest']>
type EvaluatorConfigurationInput = NonNullable<RunScoreOptions['configuration']>
type ProbeInput = RunScoreOptions['probe']
type ScoringPolicyInput = RunScoreOptions['policy']
type PrivateArtifactManifestInput = NonNullable<
	RunScoreOptions['privateManifest']
>
type ScoreResult = Awaited<ReturnType<typeof runScore>>
type EvidenceArtifact = NonNullable<ScoreResult['artifact']>
type Ladder = ScoreResult['ladder']

/** The artifact each command emits: its schema name and its file name. */
const EMITTED: Readonly<
	Record<Command, { readonly artifactPath: string; readonly kind: string }>
> = {
	compile: { artifactPath: 'EvalContract', kind: 'eval-contract' },
	seal: {
		artifactPath: 'SealedEvaluatorBrief',
		kind: 'sealed-evaluator-brief',
	},
	preflight: { artifactPath: 'PreflightVerdict', kind: 'preflight-verdict' },
	score: { artifactPath: 'EvidenceArtifact', kind: 'evidence-artifact' },
}

/** The schema an input key deserializes into, for the parse fault's path. */
const INPUT_ARTIFACT_PATH: Readonly<Record<InputKey, string>> = {
	in: 'EvalContract',
	contract: 'EvalContract',
	probes: 'Probe',
	observations: 'ProbeObservation',
	record: 'SealedRunRecord',
	'isolation-manifest': 'IsolationManifest',
	'evaluator-configuration': 'EvaluatorConfiguration',
	probe: 'Probe',
	'preflight-verdict': 'PreflightVerdict',
	policy: 'ScoringPolicy',
	'private-manifest': 'PrivateArtifactManifest',
}

const USAGE = `Usage:
  eval-quality compile          [--in <path>] [--out <target>]
                                [--strict-inputs | --no-strict-inputs] [--strict]
  eval-quality seal             [--in <path>] [--out <target>]
                                [--strict-inputs | --no-strict-inputs] [--strict]
  eval-quality preflight         --contract <path> --probes <path> --observations <path>
                                 --run-id <id> [--out <target>] [--strict]
  eval-quality score             --record <path> --contract <path> --probe <path>
                                  --preflight-verdict <path> --policy <path>
                                  --corpus-digest <digest>
                                  [--isolation-manifest <path>] [--evaluator-configuration <path>]
                                  [--private-manifest <path>] [--corpus-root <dir>]
                                  [--out <target>] [--strict]
  eval-quality --help | -h | help [<command>]
  eval-quality --version | -V`

const COMMAND_USAGE: Readonly<Record<Command, string>> = {
	compile: `Usage:
  eval-quality compile          [--in <path>] [--out <target>]
                                [--strict-inputs | --no-strict-inputs] [--strict]

  --in <path>              the contract to compile; stdin when absent or "-"
  --out <target>           a .json file path, or a directory taking eval-contract.json
  --strict-inputs          reject undeclared inputs (default)
  --no-strict-inputs       allow undeclared inputs
  --strict                 promote CONCERNS to exit 1`,
	seal: `Usage:
  eval-quality seal             [--in <path>] [--out <target>]
                                [--strict-inputs | --no-strict-inputs] [--strict]

  --in <path>              the contract to compile and seal; stdin when absent or "-"
  --out <target>           a .json file path, or a directory taking sealed-evaluator-brief.json
  --strict-inputs          reject undeclared inputs (default)
  --no-strict-inputs       allow undeclared inputs
  --strict                 promote CONCERNS to exit 1`,
	preflight: `Usage:
  eval-quality preflight         --contract <path> --probes <path> --observations <path>
                                 --run-id <id> [--out <target>] [--strict]

  --contract <path>        the compiled contract the plan is built from
  --probes <path>          the probe list the plan is built from
  --observations <path>    the observations to reduce over
  --run-id <id>            the run identifier the verdict is minted for
  --out <target>           a .json file path, or a directory taking preflight-verdict.json
  --strict                 promote CONCERNS to exit 1`,
	score: `Usage:
  eval-quality score             --record <path> --contract <path> --probe <path>
                                  --preflight-verdict <path> --policy <path>
                                  --corpus-digest <digest>
                                  [--isolation-manifest <path>] [--evaluator-configuration <path>]
                                  [--private-manifest <path>] [--corpus-root <dir>]
                                  [--out <target>] [--strict]

  --record <path>                   the sealed run record to ingest
  --contract <path>                 the compiled contract to score against
  --probe <path>                    the probe the record was run against
  --preflight-verdict <path>        the pre-flight verdict, also the source of the AD-11 fixture digest
  --policy <path>                   the scoring policy
  --corpus-digest <digest>          AD-11's caller-attested corpus digest; no artifact carries it
  --isolation-manifest <path>       the isolation manifest; absent invalidates the run under AD-16
  --evaluator-configuration <path>  the evaluator configuration; absent invalidates the run
  --private-manifest <path>         each entry's digest is checked against its resolved bytes
  --corpus-root <dir>               the directory a private reference resolves under; required only
                                     when --private-manifest or a private-storage isolation-manifest
                                     reference is present
  --out <target>                    a .json file path, or a directory taking evidence-artifact.json
  --strict                          promote CONCERNS to exit 1`,
}

const IO_RULES = `Inputs and outputs:
  --in is the only input that falls back to stdin: compile and seal read it
  when --in is left out. "-" names stdin explicitly on any input, and at most
  one input may be "-" per invocation. compile and seal each take one input;
  preflight takes three, all required; score takes eight, three of them
  optional (--isolation-manifest, --evaluator-configuration, and
  --private-manifest). Without --out the artifact goes to stdout. An --out
  ending in .json is a file path; anything else is a directory taking
  <target>/<kind>.json. Diagnostics and errors go to stderr.`

export function helpText(command: Command | null): string {
	if (command === null) {
		return `${USAGE}\n\n${IO_RULES}\n\n${EXIT_CODE_TABLE}`
	}
	return `${COMMAND_USAGE[command]}\n\n${EXIT_CODE_TABLE}`
}

/** `undefined` and `"-"` both mean stdin, which `readInput` takes as `null`. */
const sourceOf = (value: string | undefined): string | null =>
	value === undefined || value === '-' ? null : value

async function readJson(
	environment: RunEnvironment,
	key: InputKey,
	value: string | undefined,
): Promise<unknown> {
	const text = await environment.readInput(sourceOf(value))
	try {
		return JSON.parse(text) as unknown
	} catch (error) {
		// AD-28's `schema-parse-failure` covers an artifact that does not parse,
		// and the CLI is the boundary that deserializes.
		throw new RuntimeFault(
			'schema-parse-failure',
			INPUT_ARTIFACT_PATH[key],
			`--${key} is not JSON: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		)
	}
}

/** The file `--out` names, or `null` when the artifact goes to stdout. */
function outputPath(
	environment: RunEnvironment,
	out: string | null,
	kind: string,
): string | null {
	if (out === null) return null
	// The suffix is the whole classifier: the CLI never stats to decide this.
	// Matched case-insensitively, because a case-insensitive filesystem accepts
	// `run.JSON` for the same file and would otherwise be read as a directory.
	return out.toLowerCase().endsWith('.json')
		? out
		: environment.joinPath(out, `${kind}.json`)
}

/**
 * An input is never mutated in place. Two checks, because neither alone is
 * enough: comparing resolved paths catches `.`, `..`, and a doubled separator,
 * and `sameFile` catches a symlink and a case-insensitive filesystem, which no
 * string normalization can fold together.
 */
async function collides(
	environment: RunEnvironment,
	target: string,
	inputs: Readonly<Partial<Record<InputKey, string>>>,
): Promise<string | null> {
	const resolvedTarget = environment.resolvePath(target)
	for (const [key, value] of Object.entries(inputs)) {
		if (value === undefined || value === '-') continue
		const resolvedInput = environment.resolvePath(value)
		if (
			resolvedInput === resolvedTarget ||
			(await environment.sameFile(resolvedInput, resolvedTarget))
		) {
			return `--out resolves to "${resolvedTarget}", which is also --${key} "${value}"`
		}
	}
	return null
}

async function emitArtifact(
	environment: RunEnvironment,
	artifact:
		| EvalContract
		| SealedEvaluatorBrief
		| PreflightVerdict
		| EvidenceArtifact,
	command: Command,
	target: string | null,
): Promise<void> {
	const body = renderArtifact(artifact, EMITTED[command].artifactPath)
	if (target === null) {
		environment.writeOut(body)
		return
	}
	await environment.writeArtifact(target, body)
}

export async function run(
	invocation: ParsedInvocation,
	environment: RunEnvironment,
	application: ApplicationFacade = APPLICATION,
): Promise<RunResult> {
	switch (invocation.kind) {
		case 'help':
			environment.writeOut(`${helpText(invocation.command)}\n`)
			return { outcome: { kind: 'artifact' } }
		case 'version':
			environment.writeOut(`${environment.version}\n`)
			return { outcome: { kind: 'artifact' } }
		case 'usage-error':
			environment.writeDiagnostic(renderUsage(invocation.message))
			return { outcome: { kind: 'usage-error' } }
		case 'run':
			return await runCommand(invocation, environment, application)
	}
}

async function runCommand(
	invocation: Extract<ParsedInvocation, { kind: 'run' }>,
	environment: RunEnvironment,
	application: ApplicationFacade,
): Promise<RunResult> {
	const { command, inputs, out, strictInputs } = invocation
	const target = outputPath(environment, out, EMITTED[command].kind)
	if (target !== null) {
		const collision = await collides(environment, target, inputs)
		if (collision !== null) {
			environment.writeDiagnostic(renderUsage(collision))
			return { outcome: { kind: 'usage-error' } }
		}
	}

	try {
		// Exhaustive over `Command`, not a fallthrough: a fifth command with no
		// case here is a compile error ("not all code paths return a value"),
		// never a silent seal. `compile` and `seal` share one case body, and the
		// ternary inside it is itself exhaustive over the narrowed two-member
		// union the shared case leaves `command` as.
		switch (command) {
			case 'preflight': {
				const verdict = await runPreflightCommand(
					invocation,
					environment,
					application,
					target,
				)
				return { outcome: { kind: 'preflight', passed: verdict.passed } }
			}
			case 'score':
				return await runScoreCommand(
					invocation,
					environment,
					application,
					target,
				)
			case 'compile':
			case 'seal': {
				const input = await readJson(environment, 'in', inputs.in)
				const options = { strict: strictInputs }
				const artifact =
					command === 'compile'
						? application.compile(input, options)
						: application.seal(input, options)
				// No diagnostic on success: neither command carries a run
				// identifier, so any line either wrote would name no run and no
				// stage.
				await emitArtifact(environment, artifact, command, target)
				return { outcome: { kind: 'artifact' } }
			}
		}
	} catch (error) {
		if (error instanceof StructuralFailure) {
			environment.writeDiagnostic(renderError(error))
			return { outcome: { kind: 'structural-failure' } }
		}
		if (error instanceof RuntimeFault) {
			environment.writeDiagnostic(renderError(error))
			return { outcome: { kind: 'fault' } }
		}
		// A defect in our own code surfaces as a stack, never as exit 5.
		throw error
	}
}

async function runPreflightCommand(
	invocation: Extract<ParsedInvocation, { kind: 'run' }>,
	environment: RunEnvironment,
	application: ApplicationFacade,
	target: string | null,
): Promise<PreflightVerdict> {
	const { inputs, runId } = invocation
	const contract = (await readJson(
		environment,
		'contract',
		inputs.contract,
	)) as EvalContract
	const probes = (await readJson(
		environment,
		'probes',
		inputs.probes,
	)) as Probes
	const observations = (await readJson(
		environment,
		'observations',
		inputs.observations,
	)) as Observations
	const sink: DiagnosticSink = (diagnostic: Diagnostic) => {
		environment.writeDiagnostic(renderDiagnostic(diagnostic))
	}
	const verdict = application.preflightFromObservations({
		contract,
		probes,
		// The parser requires `--run-id` on this command, so it is never null.
		runId: runId ?? '',
		observations,
		sink,
	})
	await emitArtifact(environment, verdict, 'preflight', target)
	return verdict
}

/** `undefined` means the optional flag was not given; unlike `'in'`, none of `score`'s three optional inputs falls back to stdin. */
async function readOptionalJson(
	environment: RunEnvironment,
	key: InputKey,
	value: string | undefined,
): Promise<unknown> {
	return value === undefined ? null : await readJson(environment, key, value)
}

/**
 * Whether `score` needs a `CorpusPort` at all: a `--private-manifest` with at
 * least one entry, or a private-storage `isolationManifestArtifact`. Read off
 * unvalidated JSON with optional chaining throughout -- a malformed shape
 * here simply reads `undefined` and falls through to `application.runScore`'s
 * own real parse, which raises the accurate `schema-parse-failure` rather
 * than this pre-check inventing one.
 */
function needsCorpusPort(record: unknown, privateManifest: unknown): boolean {
	const manifest = privateManifest as { entries?: readonly unknown[] } | null
	if (manifest !== null && (manifest.entries?.length ?? 0) > 0) return true
	const typedRecord = record as {
		isolationManifestArtifact?: { storage?: unknown }
	}
	return typedRecord?.isolationManifestArtifact?.storage === 'private'
}

/** `CommandOutcome`'s `'verdict'` kind, read straight off `LadderResolution`: no inversion, no recomputation. */
function scoreOutcomeOf(ladder: Ladder): CommandOutcome {
	return {
		kind: 'verdict',
		verdict: ladder.verdict,
		exitCode: ladder.exitCode,
		strictPromotable: ladder.strictPromotable,
	}
}

async function runScoreCommand(
	invocation: Extract<ParsedInvocation, { kind: 'run' }>,
	environment: RunEnvironment,
	application: ApplicationFacade,
	target: string | null,
): Promise<RunResult> {
	const { inputs, corpusDigest, corpusRoot } = invocation
	const record = (await readJson(
		environment,
		'record',
		inputs.record,
	)) as SealedRunRecordInput
	const manifest = (await readOptionalJson(
		environment,
		'isolation-manifest',
		inputs['isolation-manifest'],
	)) as IsolationManifestInput | null
	const configuration = (await readOptionalJson(
		environment,
		'evaluator-configuration',
		inputs['evaluator-configuration'],
	)) as EvaluatorConfigurationInput | null
	const contract = (await readJson(
		environment,
		'contract',
		inputs.contract,
	)) as EvalContract
	const probe = (await readJson(
		environment,
		'probe',
		inputs.probe,
	)) as ProbeInput
	const preflightVerdict = (await readJson(
		environment,
		'preflight-verdict',
		inputs['preflight-verdict'],
	)) as PreflightVerdict
	const policy = (await readJson(
		environment,
		'policy',
		inputs.policy,
	)) as ScoringPolicyInput
	const privateManifest = (await readOptionalJson(
		environment,
		'private-manifest',
		inputs['private-manifest'],
	)) as PrivateArtifactManifestInput | null

	// A private reference with no `--corpus-root` to resolve it under is a
	// usage error naming the missing flag, not a silently skipped check.
	// `application.runScore` never returns `usage-error` itself (that
	// vocabulary is `cli/`'s alone), so this is checked here, before the call.
	if (corpusRoot === null && needsCorpusPort(record, privateManifest)) {
		environment.writeDiagnostic(
			renderUsage(
				'--corpus-root is required to resolve a --private-manifest entry or a private-storage isolationManifestArtifact reference',
			),
		)
		return { outcome: { kind: 'usage-error' } }
	}

	const result = await application.runScore({
		record,
		manifest,
		configuration,
		contract,
		probe,
		preflightVerdict,
		policy,
		privateManifest,
		// The parser requires `--corpus-digest` on this command, so it is
		// never null.
		corpusDigest: corpusDigest ?? '',
		port: corpusRoot === null ? undefined : environment.corpusPort(corpusRoot),
		signal: environment.signal,
	})

	if (result.artifact !== null) {
		await emitArtifact(environment, result.artifact, 'score', target)
	}
	return { outcome: scoreOutcomeOf(result.ladder) }
}
