/**
 * The committed chain that scores a seeded defect against a skill contract,
 * read at value level.
 *
 * `buildSkillExampleChain` is the pure builder the generator renders and the
 * drift check compares, so nothing here touches the filesystem and nothing
 * here can disagree with what is committed. Every assertion below reads a
 * value the chain computed rather than a value the builder was handed: the
 * qualification result, the pre-flight verdict, the witness partition, the
 * outcome states, and the strength vector are all returns of the shipped
 * stages.
 *
 * The one number this file exists for is `strength.vector.defect`. It is
 * `null` in every published skill-contract result the project can cite, which
 * is what made the seeded-defect claim for this shape an assertion rather than
 * evidence.
 */
import { describe, expect, it } from 'vitest'
import { buildSkillExampleChain } from '../../scripts/skill-example-target.ts'
import { compile } from '../../src/application/compile.ts'
import { serializeArtifact } from '../../src/application/serialize.ts'
import { digestBytes } from '../../src/core/canonical/digest.ts'
import { commandSignature } from '../../src/core/compile/interface-inventory.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { resolveHomeOperation } from '../../src/core/score/qualification.ts'
import { commandContract } from '../schemas/fixtures/command-contract.ts'
import { skillContract } from '../schemas/fixtures/skill-contract.ts'

const chain = buildSkillExampleChain()
const { contract, probe, record, artifact, preflightVerdict, witness } = chain

const outcomeOf = (oracleId: string) =>
	artifact.outcomes.find((outcome) => outcome.oracleId === oracleId)

describe('the skill chain, as the shipped stages computed it', () => {
	it('resolves the signature home to the operation the contract declares', () => {
		const [declared] = contract.permittedInterfaces
		const operation = declared?.operations[0]
		if (operation === undefined || !('invocation' in operation)) {
			throw new Error('the skill contract declares no command operation')
		}
		const signature = probe.defectSignature
		if (signature.interfaceKind !== 'cli') {
			throw new Error('the probe declares no command signature')
		}
		// The one agreement `resolveHomeOperation` rests on: a subcommand on one
		// side and not the other renders two strings and the resolver returns
		// null, which is a silent downgrade rather than a failure. The builder
		// aborts on that too, through `declarationChecksRan`; what this states
		// is the mechanism underneath it.
		expect(commandSignature(signature)).toBe(commandSignature(operation))
		expect(resolveHomeOperation(signature, contract.permittedInterfaces)).toBe(
			operation,
		)
		// And the identity discriminates. `commandContract` is another `cli`
		// contract in the same corpus with another executable, so a resolver
		// matching on the shape family alone would bind this signature to its
		// operation and the chain would score against the wrong contract.
		expect(
			resolveHomeOperation(
				signature,
				EvalContract.parse(commandContract).permittedInterfaces,
			),
		).toBeNull()
	})

	it('emits a pre-flight verdict its own reducer computed', () => {
		// The builder aborts on a failed verdict, so this line catches nothing
		// the build does not. It stays because it is the acceptance criterion
		// stated literally and it reads as the boundary between the two halves
		// of the chain; the check list below it is what actually pins the plan.
		expect(preflightVerdict.passed).toBe(true)
		// Every planned leg reached a resolved check. `seeded-fault-fired` is the
		// row that fails when a defect declares no manifestation witness, and it
		// is satisfied here, so the seeded fault was observed to fire on its own
		// leg rather than assumed to.
		expect(
			preflightVerdict.checks.map((check) => [check.kind, check.outcome]),
		).toEqual([
			['interface-present', 'satisfied'],
			['input-sensitivity', 'satisfied'],
			['state-reset', 'satisfied'],
			['clean-control', 'satisfied'],
			['seeded-faults-scoped', 'satisfied'],
			['seeded-fault-fired', 'satisfied'],
		])
		// The verdict is what `emit` was handed as the fixture digest, the same
		// restatement `runScore` performs, so a chain that authored a verdict
		// beside the one it scored under would disagree here.
		expect(preflightVerdict.fixtureDigest).toBe(
			artifact.scoringVersionInputs.fixtureDigest,
		)
	})

	it('partitions the candidates rather than only finding one that fits', () => {
		// Duplicates a builder guard, kept for the reason the pre-flight line
		// above is kept.
		expect(witness.result).toBe('matched')
		// The refuting member is what says the condition discriminates: the
		// evaluator ran the same operation on the other declared case, the
		// selection carried no excluded item, and the condition resolved false
		// over it. A partition holding only satisfying members is consistent
		// with a condition true of everything the selector admits.
		//
		// This is the whole of what the partition can say here. `basis` is typed
		// to one literal, and `witnessObservationIds` and
		// `unwitnessedFindingIds` are both entailed by `matched` over this
		// partition, so asserting them would read as three more checks and be
		// none.
		expect(witness.partition).toEqual({
			satisfying: ['obs-002'],
			refuting: ['obs-001'],
			inconclusive: [],
		})
	})

	it('reads the two oracles apart', () => {
		// The inclusion half holds over the same reply the exclusion half
		// rejects, which is the whole reason a skill contract carries both.
		//
		// Both oracles read their authored disposition beside the resolution the
		// evaluator computed. Without the disposition lines, flipping O-001's to
		// `violated` scores identically and the suite stays green: `state` holds
		// at `confirmed` and the field that moves is `corroboration`.
		//
		// `corroboration` itself is deliberately not asserted. It is a function
		// of the two values on either side of it, both pinned here, so no
		// mutation this chain admits moves it alone; the rules that derive it
		// are tied to their values exhaustively in `tests/score/outcome.test.ts`.
		//
		// O-001's `state` is the one line here that is the sole catcher of
		// nothing. `confirmed` is the outcome table's catch-all row, so it holds
		// against both the resolution and the disposition moving. It stays
		// because the pair `confirmed` and `caught` is the claim this chain
		// exists to make, and a reader should not have to derive it.
		expect(outcomeOf('O-001')?.state).toBe('confirmed')
		expect(outcomeOf('O-001')?.checkResolution?.resolution).toBe('true')
		expect(outcomeOf('O-001')?.disposition).toBe('held')
		expect(outcomeOf('O-002')?.state).toBe('caught')
		expect(outcomeOf('O-002')?.checkResolution?.resolution).toBe('false')
		expect(outcomeOf('O-002')?.disposition).toBe('violated')
	})

	it('puts a number where the skill guide reported null', () => {
		expect(artifact.strength.vector.defect).toEqual({
			exercised: 1,
			caught: 1,
			rate: 1,
		})
		expect(artifact.strength.vector.gameability).toBeNull()
		expect(artifact.strength.vector['zero-action']).toBeNull()
	})

	it('marks the vector non-comparable and says why', () => {
		expect(artifact.trials).toEqual({
			declaredMinimum: 3,
			completed: 1,
			invalidatedAttempts: [],
		})
		expect(artifact.strength.comparable).toBe(false)
		expect(artifact.strength.note).toContain('Below the declared minimum of 3')
	})

	it('lands on a rung with the trial-set shortfall named in its basis', () => {
		expect(artifact.mode).toBe('contract-scoring')
		if (artifact.mode !== 'contract-scoring') return
		expect(artifact.contractVerdict).toBe('CONCERNS')
		expect(artifact.exitCode).toBe(0)
		expect(artifact.verdictBasis).toEqual([
			'coverage gap malformed-input unsatisfied at or above the severity floor',
			'coverage gap sibling-cross-check unsatisfied at or above the severity floor',
			'1 completed trials below the declared minimum of 3',
		])
	})

	it('scores the contract the corpus publishes', () => {
		// The bytes `dev-corpus-target.ts` writes to
		// `corpus/dev/contracts/checklist-selection.json`, rebuilt here from the
		// same fixture rather than read off disk, since a test reading that
		// directory would be filesystem I/O AD-30 forbids. Hashing them with the
		// trailing newline stripped is what an adopter runs, and it reproduces
		// the digest the chain's own run record carries. A chain that authored
		// its own copy of the contract instead of importing the fixture fails
		// here.
		const published = serializeArtifact(
			compile(EvalContract.parse(skillContract)),
			'EvalContract',
		)
		expect(contract.contractId).toBe('checklist-selection')
		expect(
			digestBytes(new TextEncoder().encode(published.replace(/\n$/, ''))),
		).toBe(record.contractDigest)
	})
})
