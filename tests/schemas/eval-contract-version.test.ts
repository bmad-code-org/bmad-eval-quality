/**
 * One pin for the eval contract's current `schemaVersion`, and the agreement
 * check that holds every in-repo literal to it.
 *
 * Every other lineage-bearing artifact has a single fixture that is, in
 * `artifact-fixtures.ts`'s own words, "the only place a ... version number is
 * written down, which is what makes each bump visible". `EvalContract` has no
 * such fixture. Its version lives in five hand-maintained literals, two of them
 * the seeds `buildDevCorpus` and `buildWorkedExampleChain` build from, and all
 * five sat at `1` while the schema moved to `3`: `InteractionStep.cardinality`
 * took it to 2 and `testData.principals`/`testData.resources` took it to 3.
 * That stale stamp reached the published `corpus/dev/` and the published spike
 * evidence artifact's `contractSchemaVersion`, and it took three separate
 * hand sweeps to find every copy.
 *
 * Neither structural check over those files can catch it. `check:corpus` and
 * `check:worked-example` both rebuild through the same literal they compare the
 * commit against, so a wrong stamp and its check agree with each other. This
 * file is the check that does not, because the expected value is written here
 * and nowhere else.
 *
 * A test-side pin, and deliberately nothing more: `eval-contract.ts`'s own
 * published description records that no reader in this version declares an
 * expected version constant to compare a stamp against, and nothing here
 * changes that. Raising `EVAL_CONTRACT_SCHEMA_VERSION` is what a real bump
 * looks like, and the failures it produces name every literal that has not
 * moved with it.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

import { buildDevCorpus } from '../../scripts/dev-corpus-target.ts'
import { buildWorkedExampleChain } from '../../scripts/worked-example-target.ts'
import type { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import {
	CORPUS_CONTRACTS,
	DEV_CORPUS_CONTRACTS,
} from '../coverage/fixtures/corpus.ts'
import { satisfiedContract } from '../coverage/fixtures/satisfaction-contracts.ts'
import {
	preflightContract,
	resetContract,
} from '../preflight/fixtures/observations.ts'
import { gateCContract } from './fixtures/gate-c-contract.ts'
import {
	absentContract,
	explicitlyEmptyContract,
	populatedContract,
} from './fixtures/relevance-contracts.ts'

/**
 * The version the current `EvalContract` shape satisfies. Raise it in the same
 * change that makes the shape break, the way each artifact's own fixture
 * records its bumps.
 */
const EVAL_CONTRACT_SCHEMA_VERSION = 5

const LITERALS: readonly (readonly [
	string,
	{ readonly schemaVersion: number },
])[] = [
	['satisfaction-contracts.ts satisfiedContract', satisfiedContract],
	['relevance-contracts.ts absentContract', absentContract],
	['relevance-contracts.ts explicitlyEmptyContract', explicitlyEmptyContract],
	['relevance-contracts.ts populatedContract', populatedContract],
	['gate-c-contract.ts gateCContract', gateCContract],
	['observations.ts preflightContract', preflightContract],
	['observations.ts resetContract', resetContract],
]

describe('every authored EvalContract literal carries the current version', () => {
	it.each(LITERALS)('%s', (_label, contract) => {
		expect(contract.schemaVersion).toBe(EVAL_CONTRACT_SCHEMA_VERSION)
	})

	// The seed the dev corpus spreads from is `satisfiedContract`, but the
	// corpus is assembled rather than spread wholesale, so each member is
	// checked in its own right.
	it.each(CORPUS_CONTRACTS.map((contract) => [contract.contractId, contract]))(
		'CORPUS_CONTRACTS %s',
		(_id, contract) => {
			expect((contract as EvalContract).schemaVersion).toBe(
				EVAL_CONTRACT_SCHEMA_VERSION,
			)
		},
	)
})

// The two published surfaces, read as the bytes the builders actually emit
// rather than as the literals behind them, since a builder could stamp the
// value on its way out.
describe('every emitted EvalContract carries the current version', () => {
	it('the dev corpus the tarball ships', () => {
		const emitted = [...buildDevCorpus(DEV_CORPUS_CONTRACTS)]
			.filter(
				([path]) => path.endsWith('.json') && !path.endsWith('index.json'),
			)
			.map(
				([path, text]) =>
					[path, JSON.parse(text) as { schemaVersion?: number }] as const,
			)
			.filter(([, body]) => 'contractId' in body)
		expect(emitted.length).toBeGreaterThan(0)
		for (const [path, body] of emitted) {
			expect(body.schemaVersion, path).toBe(EVAL_CONTRACT_SCHEMA_VERSION)
		}
	})

	it('the worked example chain', () => {
		expect(buildWorkedExampleChain().contract.schemaVersion).toBe(
			EVAL_CONTRACT_SCHEMA_VERSION,
		)
	})
})

// The enumeration above names the literals a reader can import. It cannot
// reach a fixture a test file declares privately, and test files never import
// each other, so three contracts sat at a stale stamp for two versions without
// failing anything. This walks the source instead: every literal in the tree
// annotated as an `EvalContract`, whichever file declares it and whether or not
// it is exported.
describe('no EvalContract literal anywhere in the tree carries a stale stamp', () => {
	const ROOTS = ['tests', 'scripts', 'src']

	const sourceFiles = (directory: string): readonly string[] => {
		const found: string[] = []
		const walk = (current: string): void => {
			for (const entry of readdirSync(current, { withFileTypes: true })) {
				const full = join(current, entry.name)
				if (entry.isDirectory()) walk(full)
				else if (entry.name.endsWith('.ts')) found.push(full)
			}
		}
		walk(join(repoRoot, directory))
		return found
	}

	// Both annotations a contract literal carries in this tree: an explicit type
	// on the binding, and the `satisfies` form the relevance fixtures use.
	const ANNOTATION =
		/(?::\s*EvalContract\s*=\s*\{|\}\s*satisfies\s+EvalContract)/g
	const STAMP = /^\s*schemaVersion:\s*(\d+),/m

	it('walks every source file and finds at least the known literals', () => {
		const stale: string[] = []
		let checked = 0
		for (const directory of ROOTS) {
			for (const file of sourceFiles(directory)) {
				const text = readFileSync(file, 'utf8')
				for (const match of text.matchAll(ANNOTATION)) {
					// Read the stamp from the literal's own body: forwards from an
					// opening brace, backwards from a `satisfies` clause.
					const forwards = match[0].endsWith('{')
					const body = forwards
						? text.slice(match.index ?? 0, (match.index ?? 0) + 400)
						: text.slice(Math.max(0, (match.index ?? 0) - 4000), match.index)
					const stamp = STAMP.exec(body)
					if (stamp === null) continue
					checked += 1
					if (Number(stamp[1]) !== EVAL_CONTRACT_SCHEMA_VERSION) {
						stale.push(`${relative(repoRoot, file)}: schemaVersion ${stamp[1]}`)
					}
				}
			}
		}
		// A floor, not a pin: this walks whatever the tree holds, and the point
		// is that it walked something rather than that it walked exactly n.
		expect(checked).toBeGreaterThan(5)
		expect(stale).toEqual([])
	})
})
