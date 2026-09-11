#!/usr/bin/env node
/**
 * The `bin` entry for the published gates: one binary, dispatching on
 * `argv[2]`, over the gate names `gate-config.ts` publishes.
 *
 * It is the only file in the gate surface that reads `process.argv` or writes to
 * a stream, so its whole body is turning a configuration section into a report
 * and a report into `process.exitCode`. The gates themselves stay pure over a
 * parsed lockfile and the data the consumer supplied.
 *
 * `process.exit` is called nowhere, for the reason `src/cli/main.ts` records:
 * exiting truncates a pending stdout write, and a gate over a large lockfile
 * writes more than a pipe buffer holds.
 *
 * Every path a configuration names resolves against the directory that
 * configuration file sits in, so a configuration file is self-contained and a
 * consumer can keep one outside the repository root and still have it mean what
 * it says.
 *
 * Run by `node` directly: Node's type stripping erases types only, so no
 * TypeScript enum, namespace, parameter property, or non-type re-export may
 * appear in this file or anything it imports, or the binary fails at load.
 */
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { auditLockfileAge } from './audit-lockfile-age.mjs'
import { checkLicenses } from './check-licenses.mjs'
import type {
	GateName,
	LicencesConfig,
	LockfileAgeConfig,
} from './gate-config.ts'
import {
	DEFAULT_CONFIG_FILE,
	GATE_NAMES,
	loadLicencesConfig,
	loadLockfileAgeConfig,
} from './gate-config.ts'

const EXIT_OK = 0
/** The gate ran and found what it exists to find. */
const EXIT_GATE_FAILED = 1
/**
 * sysexits.h EX_USAGE, the same number `src/cli/exit-codes.ts` assigns and for
 * the same reason: the caller repairs it by changing what it passed. This build
 * roots at `scripts/`, so it cannot import that module; a test case holds the
 * two numbers equal.
 */
const EXIT_USAGE = 64

const BINARY = 'eval-quality-gates'

/**
 * One line per gate. Keyed by `GateName`, so publishing a gate without
 * describing it here is a type error and the usage text cannot go stale.
 */
const GATE_SUMMARY: Readonly<Record<GateName, string>> = {
	'lockfile-age':
		"every locked entry's registry publication age, against a window you declare",
	licences:
		"every locked entry's licence, against an allowlist of identifiers you declare",
}

const GATE_LINES = GATE_NAMES.map(
	(gate) => `  ${gate.padEnd(14)}${GATE_SUMMARY[gate]}`,
).join('\n')

const USAGE = `Usage:
  ${BINARY} <gate> [--config <path>]

${GATE_LINES}

  --config <path>  the configuration file; ${DEFAULT_CONFIG_FILE} in the working directory by default
  --help, -h       this text

Each gate reads its own section of that file, and configuring a gate is what
opts into it. A gate invoked with no section refuses by name and falls back to
nothing. Every path a section names is relative to the configuration file.

Exit codes: ${EXIT_OK} the gate passed, ${EXIT_GATE_FAILED} the gate failed, ${EXIT_USAGE} a usage or configuration error.`

const writeOut = (line: string): void => {
	process.stdout.write(`${line}\n`)
}

const writeDiagnostic = (line: string): void => {
	process.stderr.write(`${line}\n`)
}

/** A refusal the caller repairs by editing its configuration, so it takes 64. */
class ConfigurationError extends Error {}

type Tolerance = NonNullable<LicencesConfig['tolerances']>[number]

/**
 * What the two gate modules return. They are `.mjs` with no declaration file, so
 * the shape this binary depends on is stated here, at the boundary. Inferring it
 * would tie the binary's types to whatever an unchecked module happened to
 * return on the day it was read.
 */
type AgeEntry = {
	readonly name: string
	readonly version: string
	readonly path: string
	readonly resolved?: string
	readonly publishedAt?: string
}

type AgeReport = {
	readonly cutoff: Date
	readonly entries: readonly AgeEntry[]
	readonly youngEntries: readonly AgeEntry[]
	readonly unfetchableEntries: readonly AgeEntry[]
	readonly offRegistryEntries: readonly AgeEntry[]
}

type LicenceViolation = {
	readonly name: string
	readonly version: string
	readonly license: unknown
	readonly reason?: string
	readonly dependencyPath?: string
}

type LicenceReport = {
	readonly violations: readonly LicenceViolation[]
	readonly entryCount: number
	readonly tolerated: readonly string[]
	readonly toleranceReasons: readonly string[]
}

type Invocation =
	| { readonly kind: 'help' }
	| {
			readonly kind: 'run'
			readonly gate: GateName
			readonly configPath: string | null
	  }
	| { readonly kind: 'usage-error'; readonly message: string }

const usageError = (message: string): Invocation => ({
	kind: 'usage-error',
	message,
})

const isGate = (token: string): token is GateName =>
	(GATE_NAMES as readonly string[]).includes(token)

/** `--flag=value`, split on the first `=` so a value may contain one. */
function splitFlag(token: string): { flag: string; inline: string | null } {
	const equals = token.indexOf('=')
	if (equals === -1) return { flag: token, inline: null }
	return { flag: token.slice(0, equals), inline: token.slice(equals + 1) }
}

function parseArguments(argv: readonly string[]): Invocation {
	const first = argv[0]
	if (first === undefined) {
		return usageError(`no gate given; expected one of ${GATE_NAMES.join(', ')}`)
	}
	if (first === '--help' || first === '-h' || first === 'help') {
		return { kind: 'help' }
	}
	if (!isGate(first)) {
		return usageError(
			`unknown gate "${first}"; expected one of ${GATE_NAMES.join(', ')}`,
		)
	}

	let configPath: string | null = null
	const rest = argv.slice(1)
	for (let index = 0; index < rest.length; ) {
		const token = rest[index] as string
		if (token === '--help' || token === '-h') return { kind: 'help' }
		const { flag, inline } = splitFlag(token)
		if (flag !== '--config') {
			return usageError(`unknown flag "${token}" for ${first}`)
		}
		let value: string
		if (inline !== null) {
			value = inline
		} else {
			const next = rest[index + 1]
			if (next === undefined) return usageError('--config requires a value')
			// A flag-shaped token is the next flag, so the space form treats it as a
			// missing value. A path beginning with "-" is what the equals form is for.
			if (next.length > 1 && next.startsWith('-')) {
				return usageError(
					`--config requires a value, but the next token is "${next}"; use --config=${next} for a path that begins with "-"`,
				)
			}
			value = next
		}
		if (value === '') return usageError('--config was given an empty value')
		if (configPath !== null && configPath !== value) {
			return usageError(
				`--config given twice with different values, "${configPath}" and "${value}"`,
			)
		}
		configPath = value
		index += inline === null ? 2 : 1
	}
	return { kind: 'run', gate: first, configPath }
}

/**
 * A lockfile the configuration named. A path that is not there is a
 * configuration error and says which setting named it, because the repair is in
 * the file rather than in the tree.
 */
async function readLockfile(
	root: string,
	relative: string,
	configFile: string,
	gate: GateName,
): Promise<unknown> {
	const path = resolve(root, relative)
	try {
		return JSON.parse(await readFile(path, 'utf8'))
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code
		const detail =
			code === 'ENOENT'
				? 'does not exist'
				: `could not be read: ${error instanceof Error ? error.message : String(error)}`
		throw new ConfigurationError(
			`${path} ${detail}; ${configFile}'s "${gate}" section names it under lockfiles`,
		)
	}
}

async function runLockfileAge(
	configFile: string,
	root: string,
	section: LockfileAgeConfig,
): Promise<boolean> {
	const now = new Date()
	// The line `.github/actions/audit-lockfile-age/action.yml` greps for: a
	// clock-parsing bug that made every entry look permanently old would
	// otherwise be invisible.
	writeOut(`Effective clock: ${now.toISOString()}`)

	let passed = true
	for (const relative of section.lockfiles) {
		const lockfile = await readLockfile(
			root,
			relative,
			configFile,
			'lockfile-age',
		)
		const report = (await auditLockfileAge({
			lockfile,
			now,
			windowDays: section.windowDays,
		})) as unknown as AgeReport

		if (
			report.youngEntries.length === 0 &&
			report.unfetchableEntries.length === 0 &&
			report.offRegistryEntries.length === 0
		) {
			writeOut(
				`lockfile-age ${relative}: passed, ${report.entries.length} entrie(s), all published before ${report.cutoff.toISOString()}.`,
			)
			continue
		}

		passed = false
		if (report.offRegistryEntries.length > 0) {
			writeDiagnostic(
				`\nlockfile-age ${relative}: failed closed, ${report.offRegistryEntries.length} entrie(s) do not resolve to the npm registry:`,
			)
			for (const entry of report.offRegistryEntries) {
				writeDiagnostic(
					`  - ${entry.name}@${entry.version} resolved=${JSON.stringify(entry.resolved ?? null)} (${entry.path})`,
				)
			}
		}
		if (report.unfetchableEntries.length > 0) {
			writeDiagnostic(
				`\nlockfile-age ${relative}: failed closed, could not fetch publish metadata for ${report.unfetchableEntries.length} entrie(s):`,
			)
			for (const entry of report.unfetchableEntries) {
				writeDiagnostic(`  - ${entry.name}@${entry.version} (${entry.path})`)
			}
		}
		if (report.youngEntries.length > 0) {
			writeDiagnostic(
				`\nlockfile-age ${relative}: ${report.youngEntries.length} entrie(s) published inside the ${section.windowDays}-day window (cutoff ${report.cutoff.toISOString()}):`,
			)
			for (const entry of report.youngEntries) {
				writeDiagnostic(
					`  - ${entry.name}@${entry.version} published ${entry.publishedAt} (${entry.path})`,
				)
			}
		}
	}
	return passed
}

/** A tolerance holds only while its marker does, so the file is read on every run. */
async function markerHolds(
	root: string,
	marker: { readonly file: string; readonly contains: string } | undefined,
): Promise<boolean> {
	if (marker === undefined) return true
	try {
		const text = await readFile(resolve(root, marker.file), 'utf8')
		return text.includes(marker.contains)
	} catch {
		return false
	}
}

async function runLicences(
	configFile: string,
	root: string,
	section: LicencesConfig,
): Promise<boolean> {
	let passed = true
	for (const relative of section.lockfiles) {
		const lockfile = await readLockfile(root, relative, configFile, 'licences')
		const policy = section.policies?.[relative]
		const allowlist =
			policy === undefined
				? section.allowlist
				: [...section.allowlist, ...policy.also]
		const label = policy === undefined ? 'the allowlist' : policy.label

		const applicable: Tolerance[] = []
		for (const tolerance of section.tolerances ?? []) {
			if (!tolerance.lockfiles.includes(relative)) continue
			if (!(await markerHolds(root, tolerance.marker))) continue
			applicable.push(tolerance)
		}

		const report = checkLicenses(lockfile, {
			allowlist,
			label,
			tolerances: applicable,
		}) as unknown as LicenceReport

		if (report.violations.length === 0) {
			writeOut(
				`licences ${relative}: passed against ${label}, ${report.entryCount} entrie(s), all allowlisted.`,
			)
			if (policy !== undefined) writeOut(`  ${label}: ${policy.reason}`)
			if (report.tolerated.length > 0) {
				writeOut(`  tolerated: ${report.tolerated.join(', ')}`)
				for (const reason of report.toleranceReasons) {
					writeOut(`  because: ${reason}`)
				}
			}
			continue
		}

		passed = false
		writeDiagnostic(
			`\nlicences ${relative}: ${report.violations.length} entrie(s) outside ${label}:`,
		)
		for (const violation of report.violations) {
			writeDiagnostic(
				`  - ${violation.name}@${violation.version}: license=${JSON.stringify(violation.license)}${violation.reason ? ` (${violation.reason})` : ''}`,
			)
			writeDiagnostic(`    dependency path: ${violation.dependencyPath}`)
		}
	}
	return passed
}

async function run(invocation: Invocation): Promise<number> {
	if (invocation.kind === 'help') {
		writeOut(USAGE)
		return EXIT_OK
	}
	if (invocation.kind === 'usage-error') {
		writeDiagnostic(`${BINARY}: usage: ${invocation.message}`)
		writeDiagnostic(USAGE)
		return EXIT_USAGE
	}

	const options = { configPath: invocation.configPath ?? undefined }
	const refused = (message: string): number => {
		writeDiagnostic(`${BINARY}: ${invocation.gate}: ${message}`)
		return EXIT_USAGE
	}

	if (invocation.gate === 'lockfile-age') {
		const loaded = await loadLockfileAgeConfig(options)
		if (loaded.kind === 'refused') return refused(loaded.message)
		const passed = await runLockfileAge(
			loaded.path,
			dirname(loaded.path),
			loaded.section,
		)
		return passed ? EXIT_OK : EXIT_GATE_FAILED
	}

	const loaded = await loadLicencesConfig(options)
	if (loaded.kind === 'refused') return refused(loaded.message)
	const passed = await runLicences(
		loaded.path,
		dirname(loaded.path),
		loaded.section,
	)
	return passed ? EXIT_OK : EXIT_GATE_FAILED
}

async function main(argv: readonly string[]): Promise<void> {
	try {
		process.exitCode = await run(parseArguments(argv))
	} catch (error) {
		if (error instanceof ConfigurationError) {
			writeDiagnostic(`${BINARY}: ${error.message}`)
			process.exitCode = EXIT_USAGE
			return
		}
		writeDiagnostic(
			error instanceof Error ? (error.stack ?? error.message) : String(error),
		)
		process.exitCode = EXIT_GATE_FAILED
	}
}

await main(process.argv.slice(2))
