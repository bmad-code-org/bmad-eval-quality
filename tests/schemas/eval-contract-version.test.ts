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
 * The expected value is `eval-contract.ts`'s own `EVAL_CONTRACT_SCHEMA_VERSION`,
 * imported. This file declared a local copy of it for as long as the constant
 * existed, which is the transcription class it was written to catch
 * reproducing itself inside the catcher. An earlier docblock here said no
 * reader declares an expected version constant, which was true when written
 * and stopped being true when `src/core/compile/compile.ts` started comparing
 * a contract's stamp against exactly this constant.
 *
 * Raising `EVAL_CONTRACT_SCHEMA_VERSION` is what a real bump looks like, and
 * the failures it produces name every literal that has not moved with it. The
 * source walk that used to live here covers every artifact with a version
 * constant now, in `artifact-version.test.ts`; the enumeration below stays
 * because it names the importable literals and reports them one case each.
 */
import { describe, expect, it } from 'vitest'

import { buildDevCorpus } from '../../scripts/dev-corpus-target.ts'
import { buildWorkedExampleChain } from '../../scripts/worked-example-target.ts'
import {
	EVAL_CONTRACT_SCHEMA_VERSION,
	type EvalContract,
} from '../../src/core/schemas/eval-contract.ts'
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
// failing anything. The source walk that answered that now runs over every
// artifact with a version constant, in `artifact-version.test.ts`, reading each
// literal to its own closing brace rather than to a fixed window.
