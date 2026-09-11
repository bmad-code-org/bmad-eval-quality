#!/usr/bin/env node
/**
 * The `bin` entry for the published gates: one binary, dispatching on
 * `argv[2]`, over the gate names `gate-config.ts` publishes.
 *
 * It is the only file in the gate surface that reads `process.argv` or writes to
 * a stream, so its whole body is turning a configuration section into a report
 * and a report into `process.exitCode`. A gate returns its report or raises a
 * coded error; the stream and the exit code are this file's alone.
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
import {
	auditLockfileAge,
	LOCKFILE_SHAPE_ERROR,
} from './audit-lockfile-age.mjs'
import type { DependencyDirectionConfig } from './check-dependency-direction.ts'
import { runDependencyDirection } from './check-dependency-direction.ts'
import { checkLicenses } from './check-licenses.mjs'
import type {
	GateName,
	LicencesConfig,
	LockfileAgeConfig,
} from './gate-config.ts'
import {
	DEFAULT_CONFIG_FILE,
	GATE_NAMES,
	loadDependencyDirectionConfig,
	loadFieldOwnershipConfig,
	loadLicencesConfig,
	loadLockfileAgeConfig,
	loadPackageBoundaryConfig,
} from './gate-config.ts'
import type { FieldOwnershipConfig } from './lineage-ownership.ts'
import {
	runFieldOwnership,
	TYPESCRIPT_UNAVAILABLE,
} from './lineage-ownership.ts'
import type { PackageBoundaryConfig } from './package-boundary.ts'
import {
	runPackageBoundary,
	SCAN_PATH_ERROR,
	SCAN_UNREADABLE,
} from './package-boundary.ts'

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
	'dependency-direction':
		'every import in the trees you name, against a layer graph you declare',
	'package-boundary':
		'every line your package would publish, against the patterns you forbid',
	'field-ownership':
		'every write to a field you own, against the modules you let write it',
}

/** The widest gate name, plus the two spaces that separate it from its summary. */
const GATE_COLUMN = Math.max(...GATE_NAMES.map((gate) => gate.length)) + 2

const GATE_LINES = GATE_NAMES.map(
	(gate) => `  ${gate.padEnd(GATE_COLUMN)}${GATE_SUMMARY[gate]}`,
).join('\n')

const USAGE = `Usage:
  ${BINARY} <gate> [--config <path>]

${GATE_LINES}

  --config <path>  the configuration file; ${DEFAULT_CONFIG_FILE} in the working directory by default
  --help, -h       this text

Each gate reads its own section of that file, and configuring a gate is what
opts into it. A gate invoked with no section refuses by name and falls back to
nothing. Every path a section names is relative to the configuration file.

dependency-direction and field-ownership read your source with the TypeScript
scanner, so those two need the optional peer dependency "typescript". Install it
only if you run one of them; each refuses by name when it is absent.

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
			source: relative,
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
			source: relative,
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

/** The order every violation report prints in, so two runs read the same. */
const byFileThenLine = <
	Violation extends { readonly file: string; readonly line: number },
>(
	violations: readonly Violation[],
): Violation[] =>
	[...violations].sort((a, b) =>
		a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1,
	)

/**
 * The direction gate writes to no stream and hands back what to print, so this
 * is the whole mapping. `summary` is written on every outcome, including a clean
 * one and a report-only one, which is what stops a report-only run being silent:
 * a green run that printed nothing is the vacuous pass report-only mode exists
 * to prevent.
 *
 * The violation lines go to stdout under report-only and to stderr otherwise.
 * Report-only output is the thing the run was for, and a caller that redirects
 * stderr away should still get it.
 */
async function runDirection(
	configPath: string,
	root: string,
	section: DependencyDirectionConfig,
): Promise<number> {
	const outcome = await runDependencyDirection({ section, root, configPath })
	if (outcome.kind === 'refused') {
		writeDiagnostic(`${BINARY}: ${outcome.message}`)
		return EXIT_USAGE
	}
	writeOut(outcome.summary)
	const write = outcome.reportOnly ? writeOut : writeDiagnostic
	for (const line of outcome.lines) write(line)
	return outcome.failed ? EXIT_GATE_FAILED : EXIT_OK
}

async function runBoundary(
	root: string,
	section: PackageBoundaryConfig,
): Promise<number> {
	const report = await runPackageBoundary(root, section, 'package-boundary')
	if (report.violations.length === 0) {
		const where = report.counts
			.map((count) => `${count.files} from ${count.path}`)
			.join(', ')
		writeOut(
			`package-boundary: ${report.scanned} entr(ies) scanned, 0 violations (${where})`,
		)
		return EXIT_OK
	}
	writeDiagnostic(
		`\npackage-boundary: ${report.violations.length} violation(s) across ${report.scanned} scanned entr(ies):`,
	)
	for (const violation of byFileThenLine(report.violations)) {
		writeDiagnostic(
			`  ${violation.file}:${violation.line} [${violation.pattern}] ${violation.text}`,
		)
		writeDiagnostic(`    ${violation.reason}`)
	}
	return EXIT_GATE_FAILED
}

async function runOwnership(
	root: string,
	section: FieldOwnershipConfig,
): Promise<number> {
	const report = await runFieldOwnership(root, section, 'field-ownership')
	if (report.violations.length === 0) {
		writeOut(`field-ownership: ${report.scanned} file(s) scanned, 0 violations`)
		return EXIT_OK
	}
	writeDiagnostic(
		`\nfield-ownership: ${report.violations.length} violation(s) across ${report.scanned} scanned file(s):`,
	)
	for (const violation of byFileThenLine(report.violations)) {
		writeDiagnostic(
			`  ${violation.file}:${violation.line} ${violation.subject}: ${violation.rule}`,
		)
	}
	return EXIT_GATE_FAILED
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

	switch (invocation.gate) {
		case 'lockfile-age': {
			const loaded = await loadLockfileAgeConfig(options)
			if (loaded.kind === 'refused') return refused(loaded.message)
			const passed = await runLockfileAge(
				loaded.path,
				dirname(loaded.path),
				loaded.section,
			)
			return passed ? EXIT_OK : EXIT_GATE_FAILED
		}
		case 'licences': {
			const loaded = await loadLicencesConfig(options)
			if (loaded.kind === 'refused') return refused(loaded.message)
			const passed = await runLicences(
				loaded.path,
				dirname(loaded.path),
				loaded.section,
			)
			return passed ? EXIT_OK : EXIT_GATE_FAILED
		}
		case 'dependency-direction': {
			const loaded = await loadDependencyDirectionConfig(options)
			if (loaded.kind === 'refused') return refused(loaded.message)
			return runDirection(loaded.path, dirname(loaded.path), loaded.section)
		}
		case 'package-boundary': {
			const loaded = await loadPackageBoundaryConfig(options)
			if (loaded.kind === 'refused') return refused(loaded.message)
			return runBoundary(dirname(loaded.path), loaded.section)
		}
		case 'field-ownership': {
			const loaded = await loadFieldOwnershipConfig(options)
			if (loaded.kind === 'refused') return refused(loaded.message)
			return runOwnership(dirname(loaded.path), loaded.section)
		}
	}

	// Exhaustive over `GateName`: a gate added to `GATE_NAMES` with no arm above
	// is a type error here rather than a binary that names it in its usage text
	// and does nothing when invoked.
	const unhandled: never = invocation.gate
	throw new Error(`no dispatch arm for the gate "${String(unhandled)}"`)
}

/**
 * The refusals a gate raises as a coded error rather than as a return value,
 * and the exit each takes.
 *
 * A lockfile or a path the configuration named and the tree does not have is a
 * configuration error, so it takes the usage code: the repair is in the file.
 * So is an absent optional peer dependency. A tree the scan could not read to
 * the end takes the gate's own failure code instead, because that gate ran and
 * refused rather than being misinvoked.
 *
 * Sharing one code across the two would let "scanned nothing" and "found
 * nothing" answer a caller the same way, which is the pass these refusals exist
 * to stop.
 */
const CODED_EXITS: ReadonlyMap<string, number> = new Map([
	[LOCKFILE_SHAPE_ERROR, EXIT_USAGE],
	[SCAN_PATH_ERROR, EXIT_USAGE],
	[TYPESCRIPT_UNAVAILABLE, EXIT_USAGE],
	[SCAN_UNREADABLE, EXIT_GATE_FAILED],
])

async function main(argv: readonly string[]): Promise<void> {
	try {
		process.exitCode = await run(parseArguments(argv))
	} catch (error) {
		if (error instanceof ConfigurationError) {
			writeDiagnostic(`${BINARY}: ${error.message}`)
			process.exitCode = EXIT_USAGE
			return
		}
		const code =
			error !== null && typeof error === 'object'
				? (error as { code?: unknown }).code
				: undefined
		const mapped = typeof code === 'string' ? CODED_EXITS.get(code) : undefined
		if (mapped !== undefined) {
			writeDiagnostic(`${BINARY}: ${(error as Error).message}`)
			process.exitCode = mapped
			return
		}
		writeDiagnostic(
			error instanceof Error ? (error.stack ?? error.message) : String(error),
		)
		process.exitCode = EXIT_GATE_FAILED
	}
}

await main(process.argv.slice(2))
