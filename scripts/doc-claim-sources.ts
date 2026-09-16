// This repository's own answers for the `doc-claims` gate: the sets its pages
// transcribe, the bytes its pages reprint, and the predicates that settle its
// time-sensitive claims.
//
// The gate carries none of this. It holds a sentence against a value and names
// where the value came from; which claims this repository makes, and what
// settles each one, is its own decision, so it lives here and
// `eval-quality.config.json` names these exports.
//
// A predicate answers `true` while the claim holds. A claim no artifact in this
// tree can decide is registered in the configuration as `"read"` with the reason
// nothing mechanical reaches it, and no predicate appears here for it.
//
// Run by `node` directly: type stripping erases types only, so no TypeScript
// enum, namespace, parameter property, or non-type re-export may appear here or
// in anything it imports.
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import {
	SUPPORTED_INTERFACE_KINDS,
	UNSUPPORTED_INTERFACE_KINDS,
} from '../src/core/compile/interface-inventory.ts'
import { resolveCheck } from '../src/core/evaluate/resolution.ts'
import { EVAL_CONTRACT_SCHEMA_VERSION } from '../src/core/schemas/eval-contract.ts'
import { McpDescriptorChannel } from '../src/core/schemas/interface.ts'
import { PROBE_SCHEMA_VERSION } from '../src/core/schemas/probe.ts'
import { QUALIFICATION_FAILURES } from '../src/core/score/qualification.ts'
import { ORDERING_WITNESS_VIOLATIONS } from './check-dependency-direction.ts'

const repoRoot = new URL('../', import.meta.url)
const pathOf = (relative: string): string =>
	new URL(relative, repoRoot).pathname

const refuse = (message: string): never => {
	throw new Error(`doc-claim-sources: ${message}`)
}

const sourceFiles = async (root: string): Promise<readonly string[]> => {
	const info = await stat(pathOf(root)).catch(() => null)
	if (info === null) return []
	if (info.isFile()) return [root]
	const entries = await readdir(pathOf(root))
	const nested = await Promise.all(
		entries.map((entry) => sourceFiles(join(root, entry))),
	)
	return nested.flat()
}

const srcPaths = (await sourceFiles('src')).filter((file) =>
	file.endsWith('.ts'),
)
const srcBodies = new Map<string, string>()
for (const file of srcPaths) {
	srcBodies.set(file, await readFile(pathOf(file), 'utf8'))
}
const allSource = [...srcBodies.values()].join('\n')

const pageLines = async (page: string): Promise<readonly string[]> =>
	(await readFile(pathOf(page), 'utf8')).split('\n')

/**
 * The conformance runners, read off their own definitions rather than off a
 * published constant, because no constant names them: `src/testing/index.ts`
 * re-exports them one by one and `cli-commands.md` spells all six in a sentence.
 */
export const CONFORMANCE_RUNNERS = [
	...allSource.matchAll(
		/export\s+async\s+function\s+(run[A-Za-z]*Conformance)/g,
	),
]
	.map((match) => match[1] as string)
	.sort()

/**
 * The stages that perform AD-11's version equality, read off the tree rather
 * than off a list somebody kept. The map says which stage a file is; membership
 * is derived, so a file that starts performing the comparison and is absent from
 * the map fails here and the published sentence has to move with it.
 *
 * Two ways a file performs it, because the helper is not the only route.
 * `checkSchemaVersion` is one, and `chain.ts` is the standing proof of the
 * other: it compares against `acceptedSchemaVersion` and constructs the fault
 * directly, calling no helper, so a reader written that way would have been
 * invisible to a helper-only derivation. Both are matched.
 *
 * The helper match reads the import of the symbol rather than any call spelling.
 * A spelling match catches the three call sites written today and misses a
 * fourth passing a prebuilt object, which the throw form would miss too, since
 * the throw lives inside the helper. An import is every call form at once and
 * carries no comment ambiguity: a docblock naming the function does not import
 * it. The fault match reads the throw form for the same reason the helper match
 * avoids the bare name, since the bare code string appears in descriptions and
 * module comments across the schemas, none of which raises anything.
 */
const VERSION_READER_BY_FILE: Readonly<Record<string, string>> = {
	'src/core/compile/compile.ts': 'compile',
	'src/core/preflight/plan.ts': 'preflight',
	'src/core/score/score.ts': 'score',
}

/**
 * Files that perform the comparison and are no stage on that page. One entry:
 * `chain.ts` reads a presented lineage chain, has no caller inside this package,
 * and words the fault its own way, so it is a reader for somebody else's code
 * and the sentence about this pipeline's stages is right to leave it out.
 */
const VERSION_READERS_OUTSIDE_THE_PIPELINE: Readonly<Record<string, string>> = {
	'src/core/lineage/chain.ts':
		'reads a presented chain for a caller outside this package, with no in-package call site',
}

const IMPORTS_VERSION_CHECK =
	/import\s*\{[^}]*\bcheckSchemaVersion\b[^}]*\}\s*from\s*'[^']*schema-version\.ts'/
const RAISES_VERSION_FAULT = /new RuntimeFault\(\s*'schema-version-mismatch'/

const performsVersionEquality = (body: string): boolean =>
	IMPORTS_VERSION_CHECK.test(body) || RAISES_VERSION_FAULT.test(body)

export const VERSION_READERS = [
	...new Set(
		srcPaths
			.filter((file) => !file.endsWith('compile/schema-version.ts'))
			.filter((file) => performsVersionEquality(srcBodies.get(file) as string))
			.map((file) => {
				const named = VERSION_READER_BY_FILE[file]
				if (named !== undefined) return named
				if (VERSION_READERS_OUTSIDE_THE_PIPELINE[file] !== undefined)
					return null
				return refuse(
					`${file} performs AD-11's version equality and neither VERSION_READER_BY_FILE nor ` +
						'VERSION_READERS_OUTSIDE_THE_PIPELINE names it; a new version reader means the ' +
						'published sentence naming them has to move too',
				)
			})
			.filter((name): name is string => name !== null),
	),
].sort()

for (const [file, reason] of Object.entries(
	VERSION_READERS_OUTSIDE_THE_PIPELINE,
)) {
	const body = srcBodies.get(file)
	if (body === undefined) {
		refuse(
			`${file} is exempted as a version reader, and no such file is under src/`,
		)
		continue
	}
	if (performsVersionEquality(body)) continue
	refuse(
		`${file} is exempted as a version reader (${reason}), and it performs no version ` +
			'equality any more; drop the entry',
	)
}

/** The manifest the release workflow stamps, and the engine floor it declares. */
const manifest = JSON.parse(await readFile(pathOf('package.json'), 'utf8')) as {
	version: string
	engines: { node: string }
}

const publishedMajor = manifest.version.split('.')[0] as string

/**
 * A version a sentence pins a reading to. Two prepositions, which are the ones
 * this repository's pages use when they say a claim was checked at a release,
 * plus the bare `as of` that carries the same thing with no verb at all.
 */
const VERSION_PIN =
	/\b(?:at|against|as of) (?:eval-quality )?(\d+\.\d+\.\d+)\b/i

/**
 * How far a version-pinned reading can be settled from inside the tree: the
 * version the sentence names is in the published major line, and the record that
 * reading was written down in names the same version.
 *
 * The first half decides currency and never the reading. Whether the route a
 * sentence describes still runs is settled by running it, which no check here
 * does. What this holds is the one thing semantic versioning makes mechanical: a
 * release that breaks the reading moves the major, so a sentence left behind by
 * one fails and somebody re-runs the route. A minor or a patch leaves the pin
 * standing, which is the promise the version number itself makes.
 *
 * The second half closes the cheapest way of passing the first, which is to type
 * the new numeral over the old one. A version in the page has to be a version in
 * the record too, so passing means somebody opened the record and wrote down
 * what they saw.
 *
 * The match is read from the key forward. Scanning the whole line would take
 * whichever pin came first on it, which is the wrong one on any line carrying
 * two.
 */
const pinnedVersionIsCurrentMajor = async (
	page: string,
	key: string,
	recordPath: string,
): Promise<boolean> => {
	const line = (await pageLines(page)).find((each) => each.includes(key)) ?? ''
	const at = line.indexOf(key)
	const pinned = at === -1 ? null : VERSION_PIN.exec(line.slice(at))
	if (pinned === null) return false
	const version = pinned[1] as string
	if (version.split('.')[0] !== publishedMajor) return false
	return (await readFile(pathOf(recordPath), 'utf8')).includes(version)
}

const GATES_PAGE = 'docs/how-to/run-the-gates-on-your-repository.md'
const TOOL_USE_PAGE = 'docs/how-to/evaluate-tool-use-behavior.md'
const ORDERING_WITNESS_KEY = 'swapping those two rows reports'

/**
 * The direction gate's ordering witness, stated on its page as a measurement of
 * this repository's own tree and so read as a dated claim.
 *
 * It is settled by the constant rather than by a reading:
 * `dependency-direction.test.ts` swaps the two nesting layer rows against the
 * real tree and asserts `ORDERING_WITNESS_VIOLATIONS`, and the `doc-counts` gate
 * holds the page's numeral against the same constant. What is left for this
 * predicate is the sentence's own shape, so a rewrite that drops the numeral
 * fails here instead of leaving the count entry dead.
 */
export const orderingWitnessIsStated = async (): Promise<boolean> =>
	(await pageLines(GATES_PAGE)).some((line) =>
		line.includes(
			`${ORDERING_WITNESS_KEY} ${ORDERING_WITNESS_VIOLATIONS} violations`,
		),
	)

export const threeKindsCompile = (): boolean =>
	SUPPORTED_INTERFACE_KINDS.length === 3

export const oneKindIsRefused = (): boolean =>
	UNSUPPORTED_INTERFACE_KINDS.length === 1

export const cliCompiles = (): boolean =>
	(SUPPORTED_INTERFACE_KINDS as readonly string[]).includes('cli')

export const mcpCompiles = (): boolean =>
	(SUPPORTED_INTERFACE_KINDS as readonly string[]).includes('mcp')

export const webIsRefused = (): boolean =>
	(UNSUPPORTED_INTERFACE_KINDS as readonly string[]).includes('web')

/**
 * The CLI reference's ports table: which of the four ports the application
 * layer wires and which it does not. AD-34 makes `application/` the only
 * layer that awaits a port, so a port's own name appears somewhere under
 * `src/application/` if, and only if, something there threads it through to
 * `invokePort`; that is what the table's "Wired today" column reads off. A
 * "No" row is settled by absence, which a content hash of an existing file
 * could never detect, so this is a predicate rather than an `asOf` pin.
 */
export const portsTableIsCurrent = (): boolean => {
	const applicationSource = srcPaths
		.filter((file) => file.startsWith('src/application/'))
		.map((file) => srcBodies.get(file) as string)
		.join('\n')
	const wires = (port: string): boolean =>
		new RegExp(`\\b${port}\\b`).test(applicationSource)
	return (
		wires('EnvironmentProbePort') &&
		wires('CorpusPort') &&
		!wires('ClockPort') &&
		!wires('FileSystemPort')
	)
}

/**
 * The tool-use guide says a channel model is missing. `McpDescriptorChannel`'s
 * one member is `structured-result`; a second member would be the model the
 * sentence says is absent.
 */
export const mcpDescriptorHasOneChannel = (): boolean =>
	McpDescriptorChannel.options.length === 1

/**
 * Whether the qualification gate still publishes the code it refuses an
 * `artifact`-channel signature with. The day a signature may address a written
 * file, that code stops being the reason and the sentence has to move.
 */
export const artifactChannelHasNoSignature = (): boolean =>
	(QUALIFICATION_FAILURES as readonly string[]).includes(
		'condition-artifact-channel-contract-local',
	)

/**
 * A budget large enough that no check settled here can exhaust it. The parameter
 * exists for a regular-expression operator's step count; nothing here uses one.
 */
const REGEX_STEP_BUDGET = 1_000_000

/**
 * Resolves a `count-tolerance` check over a collection-typed pointer answered
 * present and empty, which is the path the sentence is about: `countTolerance`
 * alone answers `true` for any empty array under any wiring, and what the
 * sentence reports is `resolution.ts` marking the operand total rather than
 * needing a member.
 */
export const countToleranceResolvesTrue = (): boolean =>
	resolveCheck(
		{
			op: 'count-tolerance',
			operands: [{ pointer: '/interactions/observed/response-body/items' }],
			expected: 0,
			tolerance: 0,
			relative: false,
		},
		() => [],
		(pointer) => pointer.endsWith('/items'),
		{},
		REGEX_STEP_BUDGET,
		'doc-claim-sources',
	).resolution === 'true'

export const toolUseRoutePinIsCurrent = (): Promise<boolean> =>
	pinnedVersionIsCurrentMajor(
		TOOL_USE_PAGE,
		'was run end to end against the built CLI at',
		'_bmad-output/implementation-artifacts/11-1-whether-tool-use-evaluation-is-one-gap-or-two.md',
	)

/**
 * The schema stamps the tool-use route carries. Both halves read a build
 * constant. Reading the probe's stamp off a committed worked-example chain would
 * have compared a hand-typed literal against a copy of itself, since
 * `check:worked-example` rebuilds that chain from a target that used to spell the
 * stamp as a literal. So a bump would have left the literal, the chain, and the
 * page agreeing on a stale number, with the version equality AD-11 asks for
 * performed nowhere.
 */
export const SCHEMA_STAMP_SENTENCE =
	`the contract is \`schemaVersion\` ${EVAL_CONTRACT_SCHEMA_VERSION}, ` +
	`the probe is ${PROBE_SCHEMA_VERSION}`

/**
 * The engine floor as two pages spell it, from the range `package.json`
 * declares. A range this cannot render, `^22` say, is a refusal of its own: the
 * pages spell one version, so a range that is not a floor is not the thing they
 * are transcribing.
 */
const nodeFloorVersion = /^>=\s*(\d+\.\d+\.\d+)$/.exec(manifest.engines.node)

export const NODE_FLOOR_SENTENCE = `Node.js ${
	nodeFloorVersion?.[1] ??
	refuse(
		`package.json's engines.node is "${manifest.engines.node}", which is not a floor; ` +
			'the pages spelling it each carry one version, so nothing here can hold them',
	)
} or newer`

/**
 * The skill chain's defect strength vector, read out of the committed artifact.
 * It is a transcription rather than a dated claim: the page reprints three
 * numbers out of an artifact, and `check:worked-example` proves the artifact
 * matches its builder without reading what the guide says about it.
 */
export const skillDefectVector = async (): Promise<string> => {
	const artifact = JSON.parse(
		await readFile(
			pathOf(
				'_bmad-output/worked-examples/skill-defect/evidence-artifact.json',
			),
			'utf8',
		),
	) as { strength: { vector: { defect: Record<string, number> } } }
	const { caught, exercised, rate } = artifact.strength.vector.defect as {
		caught: number
		exercised: number
		rate: number
	}
	return `{"caught": ${caught}, "exercised": ${exercised}, "rate": ${rate}}`
}

/**
 * A tutorial chain's caller-attested corpus digest, read out of the chain's own
 * committed file. A page teaching a runnable `score` has to print the literal,
 * because a shell substitution is not something the invocation gate can
 * execute, and a literal nothing holds is the placeholder this whole rework
 * exists to remove. Editing a chain's probes moves the digest and the page that
 * prints the old one fails here.
 */
const corpusDigestOf = async (chain: string): Promise<string> =>
	(
		await readFile(
			pathOf(`examples/tutorials/${chain}/corpus-digest.txt`),
			'utf8',
		)
	).trim()

export const walkthroughCorpusDigest = (): Promise<string> =>
	corpusDigestOf('walkthrough')

export const agentCorpusDigest = (): Promise<string> => corpusDigestOf('agent')

export const skillCorpusDigest = (): Promise<string> => corpusDigestOf('skill')

export const workflowCorpusDigest = (): Promise<string> =>
	corpusDigestOf('workflow')
