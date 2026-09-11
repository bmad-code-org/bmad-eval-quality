// The configuration a consumer writes for the gates it has chosen to run, and
// the loader every published gate reads it through.
//
// One JSON file in the consumer's repository, `eval-quality.config.json` at the
// repository root by default and any path `--config` names. The top level is an
// object keyed by gate name, and it carries only the gates the consumer has
// chosen to run: configuring a gate is what opts into it, so a repository
// adopting one gate never reads, writes, or understands the others. That is the
// format's own property and the schema's own description states it.
//
// A gate invoked with no configuration for it refuses by name. There is no
// fallback to this package's own values, which sit in this repository's own
// `eval-quality.config.json` like anyone else's. `check-doc-invocations.mjs` and
// `audit-lockfile-age.mjs` set the register: fail closed on an absent or
// malformed value, and say what was expected.
//
// The loader reads and rewrites nothing. It validates one named section per
// call, so a malformed section for a gate the caller is not running never blocks
// the gate it is running.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports, or the gate fails at load.
import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { z } from 'zod'

/** The file a consumer writes, resolved against the directory the gate runs in. */
export const DEFAULT_CONFIG_FILE = 'eval-quality.config.json'

/** The gates this build publishes, in the order the usage text lists them. */
export const GATE_NAMES = ['lockfile-age', 'licences'] as const

export type GateName = (typeof GATE_NAMES)[number]

/**
 * The audit window when a configuration names none, in days.
 *
 * A duration and not a date, which is what keeps it out of the class of settings
 * a hand maintains: a cutoff date goes stale the day after it is written and a
 * window never does. It matches `.npmrc`'s `min-release-age`, which filters
 * resolution and fails open on a lockfile already carrying a young entry; this
 * audit is what closes that.
 */
export const LOCKFILE_WINDOW_DAYS_DEFAULT = 7

const NonEmpty = z.string().min(1)

/**
 * An SPDX short identifier. The charset admits `MIT`, `Apache-2.0`, `0BSD` and
 * `LGPL-3.0-or-later`, and refuses `@` and `/`, so a `name@version` pin cannot
 * be written here. An allowlist entry names a licence; a version pin would be a
 * value a hand maintains in step with the dependency graph.
 */
const SpdxIdentifier = NonEmpty.regex(
	/^[A-Za-z0-9][A-Za-z0-9.+-]*$/,
	'is not an SPDX short identifier: the allowlist takes identifiers such as MIT or Apache-2.0, and a package-and-version pin is not one',
)

const LockfileAgeSection = z
	.strictObject({
		lockfiles: z
			.array(NonEmpty)
			.min(1)
			.describe(
				'Every lockfile to audit, repository-relative. One invocation covers all of them.',
			),
		windowDays: z
			.int()
			.min(0)
			.default(LOCKFILE_WINDOW_DAYS_DEFAULT)
			.describe(
				'How old an entry has to be, in days. A duration, so nothing here goes stale as time passes.',
			),
	})
	.describe(
		'Fails on a locked entry published inside the window, on metadata that could not be fetched, and on an entry that does not resolve to the npm registry at all.',
	)

/**
 * The per-lockfile split, keyed by lockfile path. `also` extends the top-level
 * allowlist instead of restating it, so the two lists cannot drift apart: there
 * is one allowlist and one delta.
 */
const LicencePolicy = z.strictObject({
	label: NonEmpty.describe(
		'What a reader of CI output sees beside the result, so two policies can never be confused.',
	),
	reason: NonEmpty.describe(
		'Why this lockfile may allow more than the others. A policy that widens the allowlist says so in the file that widens it.',
	),
	also: z
		.array(SpdxIdentifier)
		.min(1)
		.describe('Identifiers this lockfile allows on top of the allowlist.'),
})

/**
 * A scoped exception, and it is not an allowlist entry: it names a family of
 * packages by prefix, the licence text tolerated inside them, and the condition
 * under which the exception holds at all.
 */
const LicenceTolerance = z.strictObject({
	reason: NonEmpty.describe(
		'Why the exception is sound. It is printed on every run that uses it.',
	),
	lockfiles: z
		.array(NonEmpty)
		.min(1)
		.describe('The lockfiles this exception applies to, and no others.'),
	prefix: NonEmpty.describe(
		'The package-name prefix the exception covers. A prefix, so no version is pinned here.',
	),
	license: NonEmpty.describe(
		"The licence text the exception tolerates, matched as a substring of the entry's licence expression.",
	),
	optional: z
		.boolean()
		.default(true)
		.describe(
			'Whether the exception is limited to entries npm recorded as optional.',
		),
	marker: z
		.strictObject({ file: NonEmpty, contains: NonEmpty })
		.optional()
		.describe(
			'The exception holds only while this file carries this text. An absent or unreadable file withdraws it.',
		),
})

const LicencesSection = z
	.strictObject({
		lockfiles: z
			.array(NonEmpty)
			.min(1)
			.describe(
				'Every lockfile to scan, repository-relative. One invocation covers all of them.',
			),
		allowlist: z
			.array(SpdxIdentifier)
			.min(1)
			.describe(
				'The identifiers every entry is held against. Required: an absent allowlist would either fail everything or silently permit everything, and this gate does neither.',
			),
		policies: z
			.record(NonEmpty, LicencePolicy)
			.optional()
			.describe(
				'Per-lockfile additions, keyed by lockfile path. A lockfile with no entry here is held against the allowlist alone.',
			),
		tolerances: z
			.array(LicenceTolerance)
			.optional()
			.describe('Scoped exceptions, each carrying its own reason.'),
	})
	.describe(
		"Holds every locked entry's licence expression against an allowlist of SPDX identifiers, and fails on an entry that does not resolve to the npm registry.",
	)

/**
 * The whole document, as one schema. It is where the format states its own
 * incremental-adoption property, and `check-doc-claims.ts` parses the
 * documented example through it so the page a consumer copies is held.
 *
 * The loader never uses it. Validating the document whole would block a gate
 * the caller is running on a gate it is not, which is the opposite of the
 * property this object describes.
 */
export const GateConfiguration = z
	.object({
		'lockfile-age': LockfileAgeSection.optional(),
		licences: LicencesSection.optional(),
	})
	.describe(
		"The gates this repository has chosen to run, keyed by gate name. Incremental adoption is structural: the file carries only the gates you have adopted, and configuring a gate is what opts into it. A gate you invoke with no section here refuses by name; it falls back to nobody else's values.",
	)

export type LockfileAgeConfig = z.infer<typeof LockfileAgeSection>
export type LicencesConfig = z.infer<typeof LicencesSection>

export type GateConfigResult<Section> =
	| {
			readonly kind: 'section'
			readonly path: string
			readonly section: Section
	  }
	| { readonly kind: 'refused'; readonly message: string }

export type GateConfigOptions = {
	readonly configPath?: string
	readonly cwd?: string
}

const refuse = (message: string): { kind: 'refused'; message: string } => ({
	kind: 'refused',
	message,
})

/** Which other gates the file does configure, so a refusal says what is there. */
const otherGates = (
	gate: GateName,
	document: Record<string, unknown>,
): string => {
	const present = GATE_NAMES.filter(
		(name) => name !== gate && document[name] !== undefined,
	)
	return present.length === 0
		? 'it configures no gate at all'
		: `it configures ${present.join(', ')}`
}

/**
 * Zod's issues, one line each, addressed by the key path inside the section so a
 * reader finds the setting without counting braces. Typed structurally, so the
 * renderer does not carry Zod's error generics through every call site.
 */
type IssueList = {
	readonly issues: readonly {
		readonly path: readonly PropertyKey[]
		readonly message: string
	}[]
}

const renderIssues = (error: IssueList): string =>
	error.issues
		.map((issue) => {
			const at =
				issue.path.length === 0 ? '(the section itself)' : issue.path.join('.')
			return `  ${at}: ${issue.message}`
		})
		.join('\n')

type FoundSection =
	| { readonly kind: 'found'; readonly path: string; readonly raw: unknown }
	| { readonly kind: 'refused'; readonly message: string }

/**
 * Four refusals, each its own because the repair is different: the file is not
 * there, the file is not JSON, the file configures some other gate, and the
 * section is there and wrong. Every one names the file and the gate.
 */
async function findSection(
	gate: GateName,
	options: GateConfigOptions,
): Promise<FoundSection> {
	const cwd = options.cwd ?? process.cwd()
	const named = options.configPath ?? DEFAULT_CONFIG_FILE
	const path = isAbsolute(named) ? named : resolve(cwd, named)

	let text: string
	try {
		text = await readFile(path, 'utf8')
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return refuse(
				`${path} does not exist, and the ${gate} gate is configured there; write the file, or name another with --config <path>`,
			)
		}
		return refuse(
			`${path} could not be read: ${error instanceof Error ? error.message : String(error)}`,
		)
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(text)
	} catch (error) {
		return refuse(
			`${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
		)
	}

	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return refuse(
			`${path} is not a JSON object; the top level is an object keyed by gate name, and the ${gate} gate reads its "${gate}" key`,
		)
	}

	const document = parsed as Record<string, unknown>
	const section = document[gate]
	if (section === undefined) {
		return refuse(
			`${path} declares no "${gate}" section, and ${otherGates(gate, document)}; configuring a gate is what opts into it, so add a "${gate}" object to run this one`,
		)
	}
	return { kind: 'found', path, raw: section }
}

async function loadSection<Schema extends z.ZodType>(
	gate: GateName,
	schema: Schema,
	options: GateConfigOptions,
): Promise<GateConfigResult<z.infer<Schema>>> {
	const found = await findSection(gate, options)
	if (found.kind === 'refused') return found
	const result = schema.safeParse(found.raw)
	if (!result.success) {
		return refuse(
			`${found.path}'s "${gate}" section is malformed:\n${renderIssues(result.error)}`,
		)
	}
	return {
		kind: 'section',
		path: found.path,
		section: result.data as z.infer<Schema>,
	}
}

export const loadLockfileAgeConfig = (
	options: GateConfigOptions = {},
): Promise<GateConfigResult<LockfileAgeConfig>> =>
	loadSection('lockfile-age', LockfileAgeSection, options)

export const loadLicencesConfig = (
	options: GateConfigOptions = {},
): Promise<GateConfigResult<LicencesConfig>> =>
	loadSection('licences', LicencesSection, options)
