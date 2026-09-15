// This repository's own answers for the `doc-counts` and `doc-claims` gates:
// the numbers and the sets its published pages state, each derived from the
// artifact that owns it.
//
// The gates carry none of this. A gate holds a sentence against a value and
// says where the value came from; which values this repository has is its own
// decision, so it lives here, in code that can be read and tested, and
// `eval-quality.config.json` names these exports the way any other consumer
// names its own.
//
// Three guards run at load, because each catches a shape where every sentence
// below would still agree with a source that had gone wrong: a corpus the
// fixtures and the published tree disagree about, a barrel exporting no schema
// version at all, and a version stamped or compared under `src/` that the barrel
// does not export. Each throws rather than returning a number, so the gate
// reports a refusal naming the module instead of holding a page against a
// silently wrong value.
//
// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here or
// in anything it imports.
import { readdir, readFile } from 'node:fs/promises'
import * as adapters from '../src/adapters/index.ts'
import {
	CORPUS_CONTRACTS,
	DEV_CORPUS_CONTRACTS,
} from '../tests/coverage/fixtures/corpus.ts'
import { CORPUS_INDEX, CORPUS_LABEL } from './dev-corpus-target.ts'
import { SKILL_EXAMPLE_LABEL } from './skill-example-target.ts'
import {
	buildWorkedExample,
	WORKED_EXAMPLE_LABEL,
} from './worked-example-target.ts'
import { WORKFLOW_EXAMPLE_LABEL } from './workflow-example-target.ts'

const repoRoot = new URL('../', import.meta.url)

const refuse = (message: string): never => {
	throw new Error(`doc-count-sources: ${message}`)
}

type ManifestEntry = {
	readonly path: string
	readonly kind: string
	readonly structuralFailure?: string
}

const manifest = JSON.parse(await readFile(CORPUS_INDEX, 'utf8')) as {
	entries: readonly ManifestEntry[]
}

// The manifest is byte-gated by `check:corpus`, so these read a value another
// gate already proved against the bytes on disk.
const publishedContracts = manifest.entries.filter(
	(entry) =>
		entry.kind === 'contract' &&
		entry.path.startsWith(`${CORPUS_LABEL}/contracts/`),
)

// The corpus total has two sources that must agree: the fixture array the
// generator reads, and the contracts it wrote. Disagreement means the tree was
// not regenerated, which is `check:corpus`'s job to say, so this states it
// plainly rather than picking one.
if (publishedContracts.length !== DEV_CORPUS_CONTRACTS.length) {
	refuse(
		`DEV_CORPUS_CONTRACTS holds ${DEV_CORPUS_CONTRACTS.length} contracts and ` +
			`${CORPUS_LABEL}/contracts/ holds ${publishedContracts.length}; run \`npm run generate:dev-corpus\``,
	)
}

/**
 * The per-contract facts the sentences count, read out of the published JSON
 * rather than out of the fixture array. Off the fixtures, an interface or a plan
 * edited without regeneration would keep these green against a corpus that does
 * not carry the edit.
 */
type PublishedFacts = {
	readonly kinds: readonly string[]
	readonly capturesAValue: boolean
	readonly declaresAFixtureReset: boolean
}

const published: readonly PublishedFacts[] = await Promise.all(
	publishedContracts.map(async (entry) => {
		const text = await readFile(new URL(entry.path, repoRoot), 'utf8')
		const contract = JSON.parse(text) as {
			permittedInterfaces: readonly { kind: string }[]
			interactionPlan: readonly {
				inputBinding: Record<string, unknown>
			}[]
			fixtureReset: unknown
		}
		return {
			kinds: contract.permittedInterfaces.map((iface) => iface.kind),
			// A `{ captured }` binding, on any input channel of any step. An unbound
			// channel is `null` and a bound one is a map of key to binding value, so
			// the shape is walked rather than pattern-matched against the JSON text:
			// a contract whose oracle commentary happened to spell the word would
			// otherwise be counted.
			capturesAValue: contract.interactionPlan.some((step) =>
				Object.values(step.inputBinding).some(
					(channel) =>
						channel !== null &&
						typeof channel === 'object' &&
						Object.values(channel as Record<string, unknown>).some(
							(value) =>
								value !== null &&
								typeof value === 'object' &&
								'captured' in value,
						),
				),
			),
			declaresAFixtureReset: contract.fixtureReset !== null,
		}
	}),
)

const declaringKind = (kind: string): number =>
	published.filter((facts) => facts.kinds.includes(kind)).length

/** Every contract the published corpus carries. */
export const PUBLISHED_CONTRACTS = publishedContracts.length

/** The contracts one per discipline rule, which is the fixture array's own total. */
export const DISCIPLINE_RULE_CONTRACTS = CORPUS_CONTRACTS.length

export const FAILING_BY_DESIGN = publishedContracts.filter(
	(entry) => entry.structuralFailure !== undefined,
).length

export const COMPILING_CONTRACTS = PUBLISHED_CONTRACTS - FAILING_BY_DESIGN

export const CAPTURING_CONTRACTS = published.filter(
	(facts) => facts.capturesAValue,
).length

export const RESETTING_CONTRACTS = published.filter(
	(facts) => facts.declaresAFixtureReset,
).length

export const API_CONTRACTS = declaringKind('api')
export const CLI_CONTRACTS = declaringKind('cli')
export const MCP_CONTRACTS = declaringKind('mcp')

/**
 * How many end-to-end chains this repository commits.
 *
 * The count is the label list, and the registry is what proves the list is
 * complete: every key `buildWorkedExample` emits has to sit under one of the
 * labels, so a chain added to that registry and left out here fails at load
 * rather than leaving four sentences stale with nothing to notice. Counting
 * distinct parent directories of the keys instead would be one line shorter and
 * would inflate on the first chain that emitted a file into a subdirectory of
 * its own.
 */
const CHAIN_LABELS = [
	WORKED_EXAMPLE_LABEL,
	SKILL_EXAMPLE_LABEL,
	WORKFLOW_EXAMPLE_LABEL,
] as const

const unlabelled = [...buildWorkedExample().keys()].filter(
	(path) => !CHAIN_LABELS.some((label) => path.startsWith(`${label}/`)),
)
if (unlabelled.length > 0) {
	refuse(
		'the committed-chain registry emits file(s) under no known chain label, so the ' +
			`chain count is wrong: ${unlabelled.join(', ')}`,
	)
}

export const COMMITTED_CHAINS = CHAIN_LABELS.length

export const REFERENCE_ADAPTERS = Object.keys(adapters)
	.filter((name) => /^create[A-Za-z]*Adapter$/.test(name))
	.sort()

/** Every `.ts` file under `src/`, as one string. */
const readSourceTree = async (directory: URL): Promise<string> => {
	const entries = await readdir(directory, { withFileTypes: true })
	const bodies = await Promise.all(
		entries.map((entry) => {
			if (entry.isDirectory()) {
				return readSourceTree(new URL(`${entry.name}/`, directory))
			}
			return entry.name.endsWith('.ts')
				? readFile(new URL(entry.name, directory), 'utf8')
				: Promise.resolve('')
		}),
	)
	return bodies.join('\n')
}

const sourceTree = await readSourceTree(new URL('src/', repoRoot))
const barrelSource = await readFile(new URL('src/index.ts', repoRoot), 'utf8')

/**
 * The schema versions the barrel publishes, split into the three groups the
 * pages count. Read off the source text the way
 * `tests/schemas/artifact-version.test.ts` reads the barrel, so this needs no
 * build.
 *
 * A writer stamps `schemaVersion: <CONSTANT>` and a reader compares
 * `accepted: <CONSTANT>`, which are the two forms every stamp and every equality
 * under `src/` is written in. What is left on the barrel is what a caller
 * assembles, so the third group is a set difference over the other two.
 *
 * A version reader written some third way would land in the caller-assembled
 * group. The `doc-claims` gate is what catches one: its list entry walks `src/`
 * for the comparison itself and names the file that performs it.
 */
export const BARREL_SCHEMA_VERSIONS = [
	...barrelSource.matchAll(/export \{ ([A-Z0-9_]+_SCHEMA_VERSION) \}/g),
].map((match) => match[1] as string)

if (BARREL_SCHEMA_VERSIONS.length === 0) {
	refuse(
		'src/index.ts exports no `<NAME>_SCHEMA_VERSION`, so every sentence counting them ' +
			'would be held against zero',
	)
}

const versionNamesIn = (pattern: RegExp): readonly string[] => [
	...new Set(
		[...sourceTree.matchAll(pattern)].map((match) => match[1] as string),
	),
]

export const STAMPED_VERSIONS = versionNamesIn(
	/\bschemaVersion: ([A-Z0-9_]+_SCHEMA_VERSION)\b/g,
)

export const COMPARED_VERSIONS = versionNamesIn(
	/\baccepted: ([A-Z0-9_]+_SCHEMA_VERSION)\b/g,
)

const unpublished = [...STAMPED_VERSIONS, ...COMPARED_VERSIONS].filter(
	(name) => !BARREL_SCHEMA_VERSIONS.includes(name),
)
if (unpublished.length > 0) {
	refuse(
		`${unpublished.join(', ')} is stamped or compared under src/ and the barrel does not ` +
			'export it, so the three groups do not partition the published set',
	)
}

export const CALLER_ASSEMBLED_VERSIONS = BARREL_SCHEMA_VERSIONS.filter(
	(name) =>
		!STAMPED_VERSIONS.includes(name) && !COMPARED_VERSIONS.includes(name),
)
