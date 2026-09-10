/**
 * The tool-server exemplar through all four stages as one chain: `compile`,
 * `seal`, `runPreflight`, and `runScore`.
 *
 * `score` is the kind's last unrun stage. Compile and seal run over every
 * corpus member in `scripts/generate-dev-corpus.ts`; `runPreflight` runs over
 * a tool call in `preflight.test.ts` case 113 and against the real adapter in
 * `tests/adapters/mcp-adapter.test.ts`. Nothing anywhere reads an `mcp` sealed
 * run record, so without this a contract of this kind would reach the score
 * stage for the first time in a caller's hands.
 *
 * What this file asserts that those do not is the join: the verdict the
 * pre-flight minted is the one the evidence artifact names, and seven oracles
 * over tool-call evidence resolve against the declarations the contract makes.
 * The leg count and the pre-flight check list belong to case 113 and are not
 * restated here.
 *
 * In-process over authored values against a hand-written fake port, per AD-30:
 * no filesystem and no child process. The record's isolation manifest is
 * public storage, so `runScore` resolves no private reference and takes no
 * `CorpusPort`.
 */
import { describe, expect, it } from 'vitest'
import { compile } from '../../src/application/compile.ts'
import { runPreflight } from '../../src/application/preflight.ts'
import { runScore } from '../../src/application/score.ts'
import { seal } from '../../src/application/seal.ts'
import { digestArtifact } from '../../src/core/canonical/digest.ts'
import type { IsolationManifest } from '../../src/core/schemas/isolation-manifest.ts'
import type {
	JsonObject,
	JsonValue,
} from '../../src/core/schemas/primitives.ts'
import type { SealedRunRecord } from '../../src/core/schemas/sealed-run-record.ts'
import { mcpEchoPort } from '../preflight/fixtures/probe-port.ts'
import { toolCallProbe } from '../schemas/fixtures/artifact-fixtures.ts'
import { mcpContract } from '../schemas/fixtures/mcp-contract.ts'
import {
	corpusDigestFixture,
	evaluatorConfigurationDigestFixture,
	evaluatorConfigurationFixture,
	isolationManifestFixtureForScore,
	scoringPolicyFixtureForScore,
} from './fixtures/score-fixtures.ts'

const RUN_ID = 'mcp-run-0001'

/** Attested identically by the record and the manifest, which is one of `ingest`'s three agreement fields. */
const CONTRACT_DIGEST = digestArtifact(mcpContract, 'EvalContract')

/** The brief the chain seals below, digested here so the record attests the real one. */
const BRIEF_DIGEST = digestArtifact(
	seal(mcpContract, { strict: true }),
	'SealedEvaluatorBrief',
)

const MINTED_ID = 'n-1'
const CREATED_TITLE = 'a new note'

/** Eight of the nine channels are `null` on a tool call, and `arguments` carries the whole of what was sent. */
const argumentsOnly = (supplied: JsonObject) => ({
	path: null,
	query: null,
	header: null,
	body: null,
	argument: null,
	option: null,
	environment: null,
	stdin: null,
	arguments: supplied,
})

/**
 * The five steps share two operations, so `operationId` alone resolves several
 * for every one of them and the step's own input binding is what separates
 * them: `search` binds the literal query, `malformed-search` binds a
 * type-violating one, and `read-back` binds the identifier the creation
 * minted.
 */
const observation = (
	observationId: string,
	sequence: number,
	operationId: string,
	supplied: JsonObject,
	responseBody: JsonValue,
) => ({
	observationId,
	sequence,
	operationId,
	provenance: 'evaluator-chosen' as const,
	principal: null,
	callInputs: argumentsOnly(supplied),
	responseBody,
	responseHeaders: null,
	// A tool call has no transport status, so AD-26's numeric channel carries
	// the envelope's error flag, 0 for a call the tool did not report an error
	// on. This is the same projection the shipped adapter writes.
	responseStatus: 0,
	stdout: { kind: 'absent' as const },
	stderr: { kind: 'absent' as const },
	exitCode: null,
	artifacts: {},
})

const manifest: IsolationManifest = {
	...isolationManifestFixtureForScore,
	runId: RUN_ID,
	contractId: mcpContract.contractId,
	contractDigest: CONTRACT_DIGEST,
}

const held = (oracleId: string, observationIds: readonly string[]) => ({
	oracleId,
	disposition: 'held' as const,
	observationIds: [...observationIds],
	note: null,
})

const record: SealedRunRecord = {
	schemaVersion: 6,
	parentDigest: null,
	revisionCount: 0,
	runId: RUN_ID,
	conditionArm: 'independent',
	mode: 'production',
	trialIndex: 1,
	contractDigest: CONTRACT_DIGEST,
	sealedBriefDigest: BRIEF_DIGEST,
	evaluatorConfigurationDigest: evaluatorConfigurationDigestFixture,
	evaluatorRecommendation: 'PASS',
	oracleDispositions: [
		held('O-001', ['obs-search']),
		held('O-002', ['obs-search']),
		held('O-003', ['obs-create']),
		held('O-004', ['obs-create', 'obs-read-back']),
		held('O-005', ['obs-search', 'obs-create']),
		held('O-006', ['obs-malformed-search']),
		held('O-007', ['obs-malformed-create']),
	],
	findings: [],
	observations: [
		observation(
			'obs-search',
			1,
			'search-notes',
			{ query: 'alpha' },
			{
				ok: true,
				matches: [{ noteId: MINTED_ID }],
				totalCount: 1,
			},
		),
		observation(
			'obs-create',
			2,
			'create-note',
			{ title: CREATED_TITLE },
			{
				ok: true,
				noteId: MINTED_ID,
			},
		),
		// The type-violating pair. Both tools declare their one argument as a
		// string, so a number is what the `type-violating` matcher binds, and a
		// correct server refuses the call rather than answering it.
		observation(
			'obs-malformed-search',
			3,
			'search-notes',
			{ query: 42 },
			{
				ok: false,
				matches: [],
				totalCount: 0,
			},
		),
		observation(
			'obs-malformed-create',
			4,
			'create-note',
			{ title: 42 },
			{
				ok: false,
			},
		),
		// The read-back's argument is the identifier the creation answered
		// with, which is what the step's captured binding resolves to, and its
		// `topMatch.title` is what AD-20 rule 7's flat comparison reads.
		observation(
			'obs-read-back',
			5,
			'search-notes',
			{ query: MINTED_ID },
			{
				ok: true,
				matches: [{ noteId: MINTED_ID }],
				totalCount: 1,
				topMatch: { title: CREATED_TITLE },
			},
		),
	],
	judgeResults: [],
	actionsArtifact: {
		storage: 'public',
		path: 'evidence/actions.jsonl',
		privateRef: null,
		digest:
			'sha256:0000000000000000000000000000000000000000000000000000000000000014',
	},
	isolationManifestArtifact: {
		storage: 'public',
		path: 'evidence/isolation-manifest.json',
		privateRef: null,
		digest: digestArtifact(manifest, 'IsolationManifest'),
	},
	resourceUse: {
		toolCalls: 5,
		inputTokens: 0,
		outputTokens: 0,
		wallClockSeconds: 0,
		costUsd: '0',
	},
	evidenceDisclosure: { truncationBound: null, reportedIncomplete: false },
}

/** The whole chain, run once: each assertion below reads a different stage's output. */
const chain = async () => {
	const contract = compile(mcpContract, { strict: true })
	const brief = seal(mcpContract, { strict: true })
	const verdict = await runPreflight({
		contract,
		probes: [],
		runId: RUN_ID,
		port: { probe: mcpEchoPort() },
		signal: new AbortController().signal,
	})
	const scored = await runScore({
		record,
		manifest,
		configuration: evaluatorConfigurationFixture,
		contract,
		probe: toolCallProbe,
		preflightVerdict: verdict,
		policy: scoringPolicyFixtureForScore,
		privateManifest: null,
		corpusDigest: corpusDigestFixture,
		signal: new AbortController().signal,
	})
	return { contract, brief, verdict, scored }
}

const ran = chain()

describe('the tool-server exemplar compiles, seals, pre-flights and scores', () => {
	it('seals a brief over the contract the record attests', async () => {
		// The one thing tying `CONTRACT_DIGEST` to the contract that was
		// actually sealed. Without it the record could attest an arbitrary
		// digest and every other assertion here would still pass.
		const { brief } = await ran
		expect(brief.contractDigest).toBe(CONTRACT_DIGEST)
	})

	it('pre-flights to a passing verdict', async () => {
		const { verdict } = await ran
		expect(verdict.passed).toBe(true)
	})

	it('scores the run record to PASS with an empty basis', async () => {
		const { scored } = await ran
		expect(scored.ladder).toEqual({
			verdict: 'PASS',
			exitCode: 0,
			strictPromotable: true,
			basis: [],
		})
		expect(scored.qualification).toEqual({
			qualified: true,
			failures: [],
			declarationChecksRan: true,
		})
	})

	it('resolves every oracle over tool-call evidence, each corroborated', async () => {
		const { scored } = await ran
		const outcomes = scored.artifact?.outcomes ?? []
		expect(outcomes.map((outcome) => outcome.oracleId)).toEqual([
			'O-001',
			'O-002',
			'O-003',
			'O-004',
			'O-005',
			'O-006',
			'O-007',
		])
		const polarityOf = new Map(
			mcpContract.oracles.map((oracle) => [oracle.id, oracle.polarity]),
		)
		for (const outcome of outcomes) {
			expect(outcome.state).toBe('confirmed')
			// `disagrees` here would mean the evaluator's disposition and the
			// check's own resolution point different ways, which is what an
			// inverted polarity on the type-violating oracles produced.
			expect(outcome.corroboration).toBe('agrees')
			expect(outcome.disposition).toBe('held')
			// Read off the declared polarity rather than hard-coded, because an
			// `expects-violation` oracle is satisfied by a check that resolves
			// false and O-006 is one. Hard-coding `'true'` would fail against a
			// correct contract the next time one is added.
			expect(outcome.checkResolution?.resolution).toBe(
				polarityOf.get(outcome.oracleId) === 'expects-hold' ? 'true' : 'false',
			)
		}
	})

	it('carries the fixture digest the pre-flight minted onto the artifact', async () => {
		const { verdict, scored } = await ran
		// The one assertion that makes this a chain rather than four calls: the
		// digest AD-11 puts in the scoring version is the one the pre-flight
		// stage minted, not a fixture literal.
		expect(scored.artifact?.scoringVersionInputs.fixtureDigest).toBe(
			verdict.fixtureDigest,
		)
		expect(scored.artifact?.scoringVersionInputs.corpusDigest).toBe(
			corpusDigestFixture,
		)
		expect(scored.artifact?.exitCode).toBe(0)
	})
})
