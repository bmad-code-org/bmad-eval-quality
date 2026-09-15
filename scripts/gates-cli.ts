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
	readPublishCache,
} from './audit-lockfile-age.mjs'
import type { DependencyDirectionConfig } from './check-dependency-direction.ts'
import { runDependencyDirection } from './check-dependency-direction.ts'
import type { DocClaimsConfig } from './check-doc-claims.ts'
import { DOC_CLAIM_PATH, runDocClaims } from './check-doc-claims.ts'
import type { DocCountsConfig } from './check-doc-counts.ts'
import { DOC_COUNT_SOURCE, runDocCounts } from './check-doc-counts.ts'
import { DOC_PATH_ERROR, runDocInvocations } from './check-doc-invocations.mjs'
import { checkLicenses } from './check-licenses.mjs'
import type {
	DocInvocationsConfig,
	GateName,
	LicencesConfig,
	LockfileAgeConfig,
} from './gate-config.ts'
import {
	DEFAULT_CONFIG_FILE,
	GATE_NAMES,
	loadDependencyDirectionConfig,
	loadDocClaimsConfig,
	loadDocCountsConfig,
	loadDocInvocationsConfig,
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
import { MODULE_VALUE_ERROR } from './module-value.ts'
import type { PackageBoundaryConfig } from './package-boundary.ts'
import { runPackageBoundary } from './package-boundary.ts'
import { SCAN_PATH_ERROR, SCAN_UNREADABLE } from './scanned-paths.ts'

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
	'doc-invocations':
		'every fenced command in your pages, against the exit code the page claims',
	'doc-counts':
		'every hand-written count in your pages, against the thing it counts',
	'doc-claims':
		'every prose claim in your pages, against the tree those pages describe',
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

doc-counts and doc-claims read values out of modules your configuration names,
which means importing them, which runs them. doc-invocations runs the commands
your pages document, each inside a temporary directory it owns.

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
type Undeclared = NonNullable<LicencesConfig['undeclared']>[number]

/**
 * What the three `.mjs` gate modules return. They carry no declaration file, so
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
	readonly excludedEntries: readonly AgeEntry[]
}

type LicenceViolation = {
	readonly name: string
	readonly version: string
	readonly license: unknown
	readonly reason?: string
	readonly dependencyPath?: string
}

/** An undeclared entry the gate admitted, with the row's evidence and reason. */
type EvidenceReading = {
	readonly entry: string
	readonly readAs: string
	readonly evidence: string
	readonly reason: string
}

type LicenceReport = {
	readonly violations: readonly LicenceViolation[]
	readonly entryCount: number
	readonly tolerated: readonly string[]
	readonly toleranceReasons: readonly string[]
	readonly readByEvidence: readonly EvidenceReading[]
	readonly unusedUndeclared: readonly string[]
}

type InvocationFailure = {
	readonly file: string
	readonly line: number
	readonly invocation: string
	readonly reason: string
	readonly stderr: string
}

type InvocationReport = {
	readonly failures: readonly InvocationFailure[]
	readonly scanned: number
	readonly judged: number
	readonly compared: number
	readonly pages: number
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

/**
 * The committed publication cache, if the section names one. A path that is not
 * there is a configuration error rather than a silent full-fetch run: a mistyped
 * path would read as a cache answering nothing, which is the shape that turns a
 * gate into one that passes for the wrong reason.
 */
async function readCache(
	configFile: string,
	root: string,
	named: string | undefined,
): Promise<Record<string, string>> {
	if (named === undefined) return {}
	const path = resolve(root, named)
	let text: string
	try {
		text = await readFile(path, 'utf8')
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code
		const detail =
			code === 'ENOENT'
				? 'does not exist'
				: `could not be read: ${error instanceof Error ? error.message : String(error)}`
		throw new ConfigurationError(
			`${path} ${detail}; ${configFile}'s "lockfile-age" section names it under cache`,
		)
	}
	try {
		return readPublishCache(JSON.parse(text), path) as Record<string, string>
	} catch (error) {
		throw new ConfigurationError(
			error instanceof Error ? error.message : String(error),
		)
	}
}

/**
 * Which (row, lockfile) pairs a run has not yet seen reach an entry. A row
 * naming two lockfiles is held in each: a scope where it never reaches anything
 * is a value nobody is holding, whatever it reaches in the other.
 *
 * The refusal comes after every lockfile has reported, and it never outranks a
 * gate failure: a run that found a violation exits 1 and prints the stale rows
 * as a diagnostic, because a caller branching on the code must see the finding
 * first. The usage code is for the run that would otherwise have passed.
 */
class UnreachedRows<Row extends { readonly lockfiles: readonly string[] }> {
	private readonly pending = new Map<Row, Set<string>>()

	constructor(rows: readonly Row[]) {
		for (const row of rows) this.pending.set(row, new Set(row.lockfiles))
	}

	reached(row: Row, lockfile: string): void {
		this.pending.get(row)?.delete(lockfile)
	}

	/** Each stale row with the lockfiles it reached nothing in, or nothing. */
	remaining(): readonly { readonly row: Row; readonly lockfiles: string[] }[] {
		return [...this.pending]
			.filter(([, lockfiles]) => lockfiles.size > 0)
			.map(([row, lockfiles]) => ({ row, lockfiles: [...lockfiles] }))
	}
}

function exitAfter(passed: boolean, stale: string | null): number {
	if (stale !== null) writeDiagnostic(`\n${BINARY}: ${stale}`)
	if (!passed) return EXIT_GATE_FAILED
	return stale === null ? EXIT_OK : EXIT_USAGE
}

async function runLockfileAge(
	configFile: string,
	root: string,
	section: LockfileAgeConfig,
): Promise<number> {
	const cache = await readCache(configFile, root, section.cache)
	const now = new Date()
	// The line `.github/actions/audit-lockfile-age/action.yml` greps for: a
	// clock-parsing bug that made every entry look permanently old would
	// otherwise be invisible.
	writeOut(`Effective clock: ${now.toISOString()}`)
	if (section.cache !== undefined) {
		writeOut(
			`lockfile-age: ${Object.keys(cache).length} publication time(s) read from ${section.cache}; only an entry absent from it is fetched.`,
		)
	}

	let passed = true
	const unreached = new UnreachedRows(section.exclude ?? [])
	for (const relative of section.lockfiles) {
		const lockfile = await readLockfile(
			root,
			relative,
			configFile,
			'lockfile-age',
		)
		const exclusions = (section.exclude ?? []).filter((row) =>
			row.lockfiles.includes(relative),
		)
		const report = (await auditLockfileAge({
			lockfile,
			now,
			windowDays: section.windowDays,
			exclude: exclusions.map((row) => row.name),
			source: relative,
			cache,
		})) as unknown as AgeReport

		// The exclusions are part of what the run did, on a failing run as on a
		// passing one, so they print on both with the scanned total beside them,
		// each with the reason its row gave.
		const excluded = report.excludedEntries
		const writeExcluded = (): void => {
			for (const entry of excluded) {
				const row = exclusions.find(
					(candidate) => candidate.name === entry.name,
				)
				if (row !== undefined) unreached.reached(row, relative)
				writeOut(`  excluded: ${entry.name}@${entry.version} (${entry.path})`)
				if (row !== undefined) writeOut(`    because: ${row.reason}`)
			}
		}

		if (
			report.youngEntries.length === 0 &&
			report.unfetchableEntries.length === 0 &&
			report.offRegistryEntries.length === 0
		) {
			const cutoff = report.cutoff.toISOString()
			const scanned = report.entries.length
			writeOut(
				excluded.length === 0
					? `lockfile-age ${relative}: passed, ${scanned} entrie(s), all published before ${cutoff}.`
					: `lockfile-age ${relative}: passed, ${scanned} entrie(s), ${scanned - excluded.length} published before ${cutoff} and ${excluded.length} excluded by name.`,
			)
			writeExcluded()
			continue
		}

		passed = false
		if (excluded.length > 0) {
			writeOut(
				`lockfile-age ${relative}: ${report.entries.length} entrie(s), ${excluded.length} excluded by name.`,
			)
			writeExcluded()
		}
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
	const stale = unreached.remaining()
	return exitAfter(
		passed,
		stale.length === 0
			? null
			: `${configFile}'s "lockfile-age" section excludes ${stale
					.map(
						({ row, lockfiles }) => `"${row.name}" in ${lockfiles.join(', ')}`,
					)
					.join(
						'; ',
					)}, and no entry there carries that name; the package left the lockfile or the name is mistyped, so remove the row or narrow its lockfiles`,
	)
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
): Promise<number> {
	let passed = true
	const unreached = new UnreachedRows(section.undeclared ?? [])
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
		const undeclared: Undeclared[] = (section.undeclared ?? []).filter((row) =>
			row.lockfiles.includes(relative),
		)

		const report = checkLicenses(lockfile, {
			allowlist,
			label,
			tolerances: applicable,
			undeclared,
			source: relative,
		}) as unknown as LicenceReport

		for (const row of undeclared) {
			if (!report.unusedUndeclared.includes(row.prefix)) {
				unreached.reached(row, relative)
			}
		}

		// An entry read by evidence is printed on every run that used the row,
		// and apart from the tolerated: a tolerance widens the allowlist for a
		// licence the entry declares, and this row supplies one the entry does not.
		// Both print on a failing run too, since both are part of what the run did.
		const writeExceptions = (): void => {
			for (const reading of report.readByEvidence) {
				writeOut(`  read by evidence: ${reading.entry} as ${reading.readAs}`)
				writeOut(`    evidence: ${reading.evidence}`)
				writeOut(`    because: ${reading.reason}`)
			}
			if (report.tolerated.length > 0) {
				writeOut(`  tolerated: ${report.tolerated.join(', ')}`)
				for (const reason of report.toleranceReasons) {
					writeOut(`  because: ${reason}`)
				}
			}
		}

		if (report.violations.length === 0) {
			writeOut(
				`licences ${relative}: passed against ${label}, ${report.entryCount} entrie(s), all allowlisted.`,
			)
			if (policy !== undefined) writeOut(`  ${label}: ${policy.reason}`)
			writeExceptions()
			continue
		}

		passed = false
		writeExceptions()
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
	const stale = unreached.remaining()
	return exitAfter(
		passed,
		stale.length === 0
			? null
			: `${configFile}'s "licences" section reads ${stale
					.map(
						({ row, lockfiles }) =>
							`"${row.prefix}" in ${lockfiles.join(', ')}`,
					)
					.join(
						'; ',
					)} by evidence, and no entry there under that prefix declares no licence; the package now declares one or the prefix is mistyped, so remove the row or narrow its lockfiles`,
	)
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

/**
 * The three documentation gates share a report shape: a summary line that is
 * written whatever the outcome, and a list of failures. The summary on a clean
 * run is what stops a gate reading as green because it scanned nothing.
 */
function reportDocFailures(
	gate: string,
	failures: readonly string[],
	noun: string,
): number {
	if (failures.length === 0) return EXIT_OK
	writeDiagnostic(`\n${gate}: ${failures.length} ${noun}:`)
	for (const failure of failures) writeDiagnostic(`  ${failure}`)
	return EXIT_GATE_FAILED
}

function runInvocations(root: string, section: DocInvocationsConfig): number {
	const report = runDocInvocations(root, section) as unknown as InvocationReport
	writeOut(
		`doc-invocations: ${report.scanned} invocation(s) scanned across ${report.pages} page(s), ` +
			`${report.judged} run faithfully over real inputs, ${report.compared} with their output compared, ` +
			`${report.failures.length} failure(s)`,
	)
	if (report.failures.length === 0) return EXIT_OK
	writeDiagnostic(
		`\ndoc-invocations: ${report.failures.length} failing invocation(s):`,
	)
	for (const failure of [...report.failures].sort((a, b) =>
		a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1,
	)) {
		writeDiagnostic(
			`  ${failure.file}:${failure.line} [${failure.reason}] ${failure.invocation}`,
		)
		for (const line of failure.stderr.split('\n')) {
			if (line !== '') writeDiagnostic(`    ${line}`)
		}
	}
	return EXIT_GATE_FAILED
}

async function runCounts(
	root: string,
	section: DocCountsConfig,
): Promise<number> {
	const report = await runDocCounts(root, section)
	writeOut(
		`doc-counts: ${report.numerals} numeral(s) across ${report.files} file(s) held against their source, ` +
			`plus ${report.digits} count(s) written as digits, ${report.failures.length} disagreement(s)`,
	)
	return reportDocFailures(
		'doc-counts',
		report.failures,
		'count(s) disagree with their source',
	)
}

async function runClaims(
	root: string,
	section: DocClaimsConfig,
): Promise<number> {
	const report = await runDocClaims(root, section)
	writeOut(`doc-claims: ${report.summary}`)
	return reportDocFailures(
		'doc-claims',
		report.failures,
		'prose claim(s) disagree with the tree',
	)
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
			return runLockfileAge(loaded.path, dirname(loaded.path), loaded.section)
		}
		case 'licences': {
			const loaded = await loadLicencesConfig(options)
			if (loaded.kind === 'refused') return refused(loaded.message)
			return runLicences(loaded.path, dirname(loaded.path), loaded.section)
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
		case 'doc-invocations': {
			const loaded = await loadDocInvocationsConfig(options)
			if (loaded.kind === 'refused') return refused(loaded.message)
			return runInvocations(dirname(loaded.path), loaded.section)
		}
		case 'doc-counts': {
			const loaded = await loadDocCountsConfig(options)
			if (loaded.kind === 'refused') return refused(loaded.message)
			return runCounts(dirname(loaded.path), loaded.section)
		}
		case 'doc-claims': {
			const loaded = await loadDocClaimsConfig(options)
			if (loaded.kind === 'refused') return refused(loaded.message)
			return runClaims(dirname(loaded.path), loaded.section)
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
 * A lockfile, a page root, a built entry point, or a module export the
 * configuration named and the tree does not have is a configuration error, so it
 * takes the usage code: the repair is in the file. So is an absent optional peer
 * dependency. A tree the scan could not read to the end takes the gate's own
 * failure code instead, because that gate ran and refused rather than being
 * misinvoked.
 *
 * Sharing one code across the two would let "scanned nothing" and "found
 * nothing" answer a caller the same way, which is the pass these refusals exist
 * to stop.
 */
const CODED_EXITS: ReadonlyMap<string, number> = new Map([
	[LOCKFILE_SHAPE_ERROR, EXIT_USAGE],
	[SCAN_PATH_ERROR, EXIT_USAGE],
	[TYPESCRIPT_UNAVAILABLE, EXIT_USAGE],
	[DOC_PATH_ERROR, EXIT_USAGE],
	[DOC_CLAIM_PATH, EXIT_USAGE],
	[DOC_COUNT_SOURCE, EXIT_USAGE],
	[MODULE_VALUE_ERROR, EXIT_USAGE],
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
