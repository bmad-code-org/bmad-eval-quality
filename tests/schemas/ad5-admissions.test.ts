// Walks AD-5's twenty-three codes plus AD-28's schema-version-mismatch fault.
// Rule: where AD-5 gives the compiler a literal code, the schema admits the
// shape and Epic 4 or Epic 5 rejects it; tightening past a code would convert
// a coded, artifact-path-carrying structural error into an anonymous
// schema-parse-failure fault. Operator arity is the one deliberate exception.

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { INTERCHANGE_ARTIFACTS } from '../../src/core/schemas/artifact.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { ARTIFACT_ACCEPT_FIXTURES } from './fixtures/artifact-fixtures.ts'
import { populatedContract } from './fixtures/relevance-contracts.ts'

const admits = (mutate: (contract: any) => void): void => {
	const contract = structuredClone(populatedContract) as any
	mutate(contract)
	const result = EvalContract.safeParse(contract)
	expect(result.error?.issues ?? []).toEqual([])
	expect(result.success).toBe(true)
}

const listThings = (contract: any) =>
	contract.permittedInterfaces[0].operations.find(
		(operation: any) => operation.operationId === 'list-things',
	)

describe('AD-5 code walk — every coded shape stays representable', () => {
	it('missing-requirement-linkage: both link arrays empty on a behaviour', () => {
		admits((contract) => {
			contract.behaviors[0].requirementLinks = []
			contract.behaviors[0].riskLinks = []
		})
	})

	it('no-observable-success-criterion: a null criterion', () => {
		admits((contract) => {
			contract.behaviors[0].observableSuccessCriterion = null
		})
	})

	it('no-observable-success-criterion: an empty oracle list parses and is not this code', () => {
		admits((contract) => {
			contract.oracles = []
			contract.behaviors[0].oracles = []
		})
	})

	it('oracle-missing-channel: a null direction', () => {
		admits((contract) => {
			contract.oracles[0].direction = null
		})
	})

	it('oracle-missing-channel: a null check', () => {
		admits((contract) => {
			contract.oracles[0].check = null
		})
	})

	it('direction-check-misaligned: targets, relation, and polarity all disagreeing with check', () => {
		admits((contract) => {
			contract.oracles[0].direction.evidenceTargets = [
				'/interactions/create/response-body/ok',
			]
			contract.oracles[0].direction.relation = 'existence'
			contract.oracles[0].direction.polarity = 'expects-violation'
		})
	})

	it('unreachable-check-evidence: a pointer naming an undeclared step', () => {
		admits((contract) => {
			contract.oracles[0].check.operands[1] = {
				pointer: '/interactions/no-such-step/response-body/items',
			}
		})
	})

	it('unreachable-check-evidence: an empty interaction plan', () => {
		admits((contract) => {
			contract.interactionPlan = []
		})
	})

	it('malformed-operator-expression: a reference-set operand outside AD-26 three legal positions', () => {
		admits((contract) => {
			contract.oracles[0].check = {
				op: 'equality',
				operands: [
					{ referenceSet: 'expected-things' },
					{ referenceSet: 'expected-things' },
				],
			}
		})
	})

	it('malformed-operator-expression: a regex carrying a backreference and one carrying a lookbehind', () => {
		admits((contract) => {
			contract.oracles[0].check = {
				op: 'regex',
				operands: [{ pointer: '/interactions/list/response-body/items' }],
				pattern: '^(a)\\1$',
			}
		})
		admits((contract) => {
			contract.oracles[0].check = {
				op: 'regex',
				operands: [{ pointer: '/interactions/list/response-body/items' }],
				pattern: '^(?<=a)b$',
			}
		})
	})

	it('quantifier-over-non-collection: a quantifier over a pointer the descriptor types as a scalar', () => {
		admits((contract) => {
			contract.oracles[0].check = {
				op: 'for-all',
				collection: { pointer: '/interactions/create/response-body/id' },
				predicate: { op: 'existence', operands: [{ pointer: '@/x' }] },
			}
		})
	})

	it('quantifier-nesting-exceeded: a quantifier inside a quantifier', () => {
		admits((contract) => {
			contract.oracles[0].check = {
				op: 'for-all',
				collection: { pointer: '/interactions/list/response-body/items' },
				predicate: {
					op: 'for-any',
					collection: { pointer: '@/children' },
					predicate: { op: 'existence', operands: [{ pointer: '@/id' }] },
				},
			}
		})
	})

	it('quantifier-nesting-exceeded: covers-by-key inside a quantifier', () => {
		admits((contract) => {
			contract.oracles[0].check = {
				op: 'for-all',
				collection: { pointer: '/interactions/list/response-body/items' },
				predicate: {
					op: 'covers-by-key',
					operands: [
						{ referenceSet: 'expected-things' },
						{ pointer: '@/rows' },
					],
					expectedKey: 'id',
					actualKey: 'id',
				},
			}
		})
	})

	it('unresolved-reference-set: an operand naming an identifier the contract does not declare', () => {
		admits((contract) => {
			contract.oracles[0].check.operands[0] = { referenceSet: 'never-declared' }
		})
	})

	// The code is about a collision "after parameter-name erasure", so the two
	// templates differ in the parameter name and agree on nothing else: erasing
	// the names makes both `/things/{}`. Identical strings would only exercise
	// the trivial case and leave the erasure untested in Story 4.2's fixture.
	it('duplicate-operation-signature: two operations colliding after parameter-name erasure', () => {
		admits((contract) => {
			const operations = contract.permittedInterfaces[0].operations
			operations[1].pathTemplate = '/things/{id}'
			const twin = structuredClone(operations[1])
			twin.operationId = 'list-things-again'
			twin.pathTemplate = '/things/{identifier}'
			operations.push(twin)
		})
	})

	it('undeclared-mandatory-input: a step binding a key the request shape does not declare', () => {
		admits((contract) => {
			contract.interactionPlan[0].inputBinding.body.undeclaredKey = {
				literal: 'x',
			}
		})
	})

	it('nested-temporal-clause: a temporal clause naming a step that carries one', () => {
		admits((contract) => {
			contract.interactionPlan.push({
				stepId: 'third',
				operationId: 'list-things',
				inputBinding: { path: null, query: null, header: null, body: null },
				after: 'list',
				cardinality: 'exactly-one',
			})
		})
	})

	it('plan-exceeds-scripting-bound: sixty-four independent write/read pairs', () => {
		admits((contract) => {
			contract.interactionPlan = Array.from({ length: 64 }, (_, index) => [
				{
					stepId: `write-${index + 1}`,
					operationId: 'create-thing',
					inputBinding: {
						path: null,
						query: null,
						header: null,
						body: { name: { matcher: 'any' } },
					},
					after: null,
					cardinality: 'exactly-one',
				},
				{
					stepId: `read-${index + 1}`,
					operationId: 'list-things',
					inputBinding: { path: null, query: null, header: null, body: null },
					after: `write-${index + 1}`,
					cardinality: 'exactly-one',
				},
			]).flat()
		})
	})

	it('plan-exceeds-scripting-bound: an eight-step single-root chain', () => {
		admits((contract) => {
			contract.interactionPlan = Array.from({ length: 8 }, (_, index) => ({
				stepId: `chain-${index + 1}`,
				operationId: 'list-things',
				inputBinding: { path: null, query: null, header: null, body: null },
				after: index === 0 ? null : `chain-${index}`,
				cardinality: 'exactly-one',
			}))
		})
	})

	it('binding-cycle: a step capturing from its own response', () => {
		admits((contract) => {
			contract.interactionPlan[0].inputBinding.body.name = {
				captured: '/interactions/create/response-body/id',
			}
		})
	})

	it('captured-channel-undeclared: a captured pointer on a non-body channel', () => {
		admits((contract) => {
			contract.interactionPlan[1].inputBinding.query.limit = {
				captured: '/interactions/create/response-status',
			}
		})
	})

	it('unreachable-check-evidence: a captured scalar typed differently from the parameter it binds', () => {
		admits((contract) => {
			contract.interactionPlan[1].inputBinding.query.limit = {
				captured: '/interactions/create/response-body/id',
			}
		})
	})

	it('undeclared-mandatory-input: a binding naming a principal testData.principals does not declare', () => {
		admits((contract) => {
			contract.interactionPlan[0].inputBinding.body.name = {
				principal: 'ghost',
			}
		})
	})

	it('scoped-reference-resolves-forbidden: a declared test-data resource at all', () => {
		admits((contract) => {
			contract.testData.resources = { 'seed-manifest': { kind: 'fixture' } }
		})
	})

	it.each(['web', 'cli', 'mcp'])(
		'unsupported-interface-kind: a %s interface',
		(kind) => {
			admits((contract) => {
				contract.permittedInterfaces[0].kind = kind
			})
		},
	)

	it.each(['rule', 'rationale', 'approval', 'expiresAt'])(
		'waiver-incomplete: a waiver whose %s is null',
		(part) => {
			admits((contract) => {
				contract.waivers[0][part] = null
			})
		},
	)

	it('waiver-incomplete: a null condition is a complete waiver and also parses', () => {
		admits((contract) => {
			contract.waivers[0].condition = null
		})
	})

	it('forbidden-input-floor-incomplete: a list short of the seven', () => {
		admits((contract) => {
			contract.forbiddenInputs = ['original-spec']
		})
		admits((contract) => {
			contract.forbiddenInputs = []
		})
	})

	it('scoped-reference-resolves-forbidden: a scoped resource reference at all', () => {
		admits((contract) => {
			contract.scopedResources = [
				{ reference: 'the-original-spec', kind: 'document' },
			]
		})
	})

	it('rubric-unanchored: an unanchored scale, an unbounded length, and missing penalties', () => {
		admits((contract) => {
			contract.rubrics[0].scaleLevels = null
		})
		admits((contract) => {
			contract.rubrics[0].scaleLevels = []
		})
		admits((contract) => {
			contract.rubrics[0].maxLength = null
		})
		admits((contract) => {
			contract.rubrics[0].failureModePenalties = null
		})
	})

	it('rubric-evidence-unreachable: a criterion evidence pointer resolving nowhere', () => {
		admits((contract) => {
			contract.rubrics[0].criteria[0].evidence =
				'/interactions/no-such-step/response-body/items'
		})
	})

	it('rubric-scores-reasoning-prose: a criterion scoring stated reasoning', () => {
		admits((contract) => {
			contract.rubrics[0].criteria[0].text =
				'Score the quality of the reasoning the agent stated before answering.'
		})
	})

	// This code's enforcement point is Story 2.3's post-generation
	// `auditBriefScripting` over the emitted brief, not `compile` over the
	// contract. `scope`/`negativeDomain` are opaque author-facing strings with
	// no content constraint, so the contract schema admits sequencing
	// vocabulary here; the audit rejects it once generated.
	it('brief-exceeds-scripting-bound: a direction scope/negativeDomain carrying sequencing vocabulary parses; the post-generation brief audit rejects it, not the contract schema', () => {
		admits((contract) => {
			contract.oracles[0].direction.scope =
				'First send the request, then read the response, and finally confirm the record.'
		})
	})

	it('schema-version-mismatch (AD-28): a non-equal schemaVersion parses', () => {
		admits((contract) => {
			contract.schemaVersion = 2
		})
	})
})

describe('operator arity — the one deliberate exception, recorded', () => {
	it('rejects a wrong-arity operator rather than admitting it', () => {
		const contract = structuredClone(populatedContract) as any
		contract.oracles[0].check.operands = [{ referenceSet: 'expected-things' }]
		expect(EvalContract.safeParse(contract).success).toBe(false)
	})
})

describe('cross-field rules with no AD-5 code, unenforced in v0 by decision', () => {
	// AC 8's named exception: "where no code exists the schema enforces" collides
	// with "prefer pushing cross-field rules to the compiler".
	it('admits a behaviour naming an oracle identifier no oracle declares', () => {
		admits((contract) => {
			contract.behaviors[0].oracles = ['O-999']
		})
	})

	it('admits a collection location naming a reference set the contract does not declare', () => {
		admits((contract) => {
			listThings(
				contract,
			).responseDescriptor.collectionLocations[0].referenceSet =
				'never-declared'
		})
	})

	it('admits a step naming an operation the inventory does not declare', () => {
		admits((contract) => {
			contract.interactionPlan[0].operationId = 'no-such-operation'
		})
	})

	it('admits a reference-set member missing a declared comparison key', () => {
		admits((contract) => {
			contract.referenceSets['expected-things'].members = [{ other: 'x' }]
		})
	})

	it('admits a descriptor key carrying no channel role', () => {
		admits((contract) => {
			listThings(contract).responseDescriptor.channelRoles = {}
		})
	})

	it('admits a rubric scale with duplicate and negative levels', () => {
		admits((contract) => {
			contract.rubrics[0].scaleLevels = [
				{ level: 1, anchor: 'first' },
				{ level: 1, anchor: 'also first' },
				{ level: -3, anchor: 'below the floor' },
			]
		})
	})

	it('admits a descriptor whose permitted keys do not cover its required keys', () => {
		admits((contract) => {
			listThings(contract).responseDescriptor.requiredKeys = ['items']
			listThings(contract).responseDescriptor.permittedKeys = []
		})
	})

	it('admits a lineage root whose revision count disagrees with its parent digest', () => {
		admits((contract) => {
			contract.parentDigest = null
			contract.revisionCount = 3
		})
	})
})

// Story 1.4 extends the list above: rules some AD states that no AD-5 code
// names and no schema over ONE artifact can decide, mostly because they
// compare two artifacts. Named here rather than silently dropped, so a later
// epic adds a code deliberately instead of discovering the hole.
describe('cross-artifact and cross-field rules this story leaves unenforced', () => {
	const admitsArtifact = (
		artifact: keyof typeof INTERCHANGE_ARTIFACTS,
		mutate: (subject: any) => void,
	): void => {
		const subject = structuredClone(
			ARTIFACT_ACCEPT_FIXTURES[artifact],
		) as unknown
		mutate(subject)
		const result = INTERCHANGE_ARTIFACTS[artifact].schema.safeParse(subject)
		expect(result.error?.issues ?? []).toEqual([])
		expect(result.success).toBe(true)
	}

	// 1. AD-23 makes a missing disposition an AD-21 invalidating condition, so
	//    the schema admits the shape and ingest fires the rung.
	it('admits a run record whose dispositions omit a required oracle', () => {
		admitsArtifact('sealed-run-record', (record) => {
			record.oracleDispositions = []
		})
	})

	// 2. One disposition per required oracle, not two.
	it('admits two dispositions naming one oracle', () => {
		admitsArtifact('sealed-run-record', (record) => {
			record.oracleDispositions.push(
				structuredClone(record.oracleDispositions[0]),
			)
		})
	})

	// 3. A citation is checked against the observations at ingest, not here.
	it('admits a finding citing an observation no observation declares', () => {
		admitsArtifact('sealed-run-record', (record) => {
			record.findings[0].observationIds = ['obs-does-not-exist']
		})
	})

	// 4. ADR-009 Decision 2: "cited identifiers govern the witness match;
	//    quotation audits it." Quoted text appearing in no cited observation is
	//    an AD-32 declared-versus-observed inconsistency at ingest.
	it('admits a defect whose quotation appears in none of its cited observations', () => {
		admitsArtifact('sealed-run-record', (record) => {
			record.findings[0].quotedEvidence = [
				{ quote: 'text that appears in no observation', channel: 'stdout' },
			]
		})
	})

	// 5. AD-17 requires one judge call scoring all named rubric criteria.
	it('admits a judge result citing an undeclared criterion, and a second call', () => {
		admitsArtifact('sealed-run-record', (record) => {
			record.judgeResults.push({
				rubricId: 'R-999',
				criterionId: 'RC-999',
				score: 1,
				note: null,
			})
		})
	})

	// 6. AD-16 makes an exceeded allowlist a violation recorded at ingest.
	it('admits a manifest whose observations exceed every allowlist', () => {
		admitsArtifact('isolation-manifest', (manifest) => {
			manifest.observedMounts = ['/etc', '/home']
			manifest.observedNetworkTargets = ['example.invalid']
			manifest.observedToolCalls = ['shell']
		})
	})

	// 7. AD-32 requires these digests to agree between two artifacts, and a
	//    schema cannot see two artifacts at once.
	it('admits a run record whose digests disagree with the manifest fixture', () => {
		admitsArtifact('sealed-run-record', (record) => {
			record.evaluatorConfigurationDigest = `sha256:${'f'.repeat(64)}`
			record.contractDigest = `sha256:${'e'.repeat(64)}`
		})
	})

	// 8. AD-8: "a manifest digest is never a trusted label." The core recomputes
	//    from resolved bytes and a mismatch is an AD-28 `digest-mismatch` fault.
	it('admits a manifest entry whose digest matches no resolved bytes', () => {
		admitsArtifact('private-artifact-manifest', (manifest) => {
			manifest.entries[0].digest = `sha256:${'d'.repeat(64)}`
		})
	})

	// 9. The per-class entry carries `caught`, `exercised`, and `rate`, and their
	//    arithmetic is the scorer's.
	it('admits a strength rate disagreeing with its own numerator and denominator', () => {
		admitsArtifact('evidence-artifact', (artifact) => {
			artifact.strength.vector.defect = { caught: 0, exercised: 4, rate: 1 }
		})
	})

	// 10. AD-7 excludes clean controls from the vector and AD-9 fixes their legal
	//     states at two, so the scorer reads the pair. No AD-5 code names the
	//     contradiction in either direction.
	it('admits a defect-class probe declaring itself clean, and one seeding nothing', () => {
		admitsArtifact('probe', (probe) => {
			probe.expectedClean = true
			probe.defects = []
		})
		admitsArtifact('probe', (probe) => {
			probe.probeClass = 'defect'
			probe.expectedClean = false
			probe.defects = []
		})
	})

	// 11. `Operation.operationId` is scoped to a `PermittedInterface`, and
	//     `duplicate-operation-signature` covers method plus path template only.
	it('admits observations whose operation identifiers collide across interfaces', () => {
		admitsArtifact('sealed-run-record', (record) => {
			for (const observation of record.observations) {
				observation.operationId = 'get-note'
			}
		})
	})

	// 12. AD-18. Unenforceable over opaque strings; it is in the constraint
	//     ledger as not expressible and enforced by the publication guard.
	it('admits an artifact carrying something shaped like a credential', () => {
		admitsArtifact('evaluator-configuration', (configuration) => {
			configuration.toolInventory = ['http?api_key=sk-live-0000000000']
			configuration.evaluatorIdentity = 'evaluator@example.invalid'
		})
		admitsArtifact('private-artifact-manifest', (manifest) => {
			manifest.entries[0].privateRef = '/Users/someone/private/trace.jsonl'
		})
	})

	// 13. AD-9: "An unqualified probe cannot enter a sealed set." With the
	//     qualification record deferred, nothing catches one: not this schema,
	//     not an AD-5 code, not an AD-21 rung. The accepted cost of that
	//     deferral, named rather than dropped.
	it('admits a probe carrying no qualification record at all', () => {
		const probe = structuredClone(ARTIFACT_ACCEPT_FIXTURES.probe) as any
		expect(Object.keys(probe)).not.toContain('qualification')
		expect(INTERCHANGE_ARTIFACTS.probe.schema.safeParse(probe).success).toBe(
			true,
		)
	})

	// 14. AD-9 puts the behaviour on the probe, the prior art puts one on each
	//     defect, and this story carries both.
	it("admits a probe whose behaviour disagrees with its defect's behaviour", () => {
		admitsArtifact('probe', (probe) => {
			probe.behaviorId = 'B-001'
			probe.defects[0].behaviorId = 'B-002'
		})
	})

	// 15. AD-17: "must retain evidence contradicting the leading verdict." No
	//     field on any artifact decides it; `evidenceDisclosure` declares the two
	//     caller-stated conditions and this is not one of them.
	it('admits a truncated record that discloses nothing about disconfirming evidence', () => {
		admitsArtifact('sealed-run-record', (record) => {
			record.evidenceDisclosure = {
				truncationBound: 1,
				reportedIncomplete: false,
			}
			record.observations = []
		})
	})

	// 16. Already on Story 1.3's list. Asserted as an exact census rather than a
	//     skip list: AD-10's manifestation witness put the expression grammar on
	//     `Defect`, and `shape`'s descriptor travels with it, so the same
	//     unenforced rule now has a second document carrying it. The set is
	//     pinned in both directions, so a third document acquiring a descriptor,
	//     or either of these two losing one, fails here.
	it('carries the keyed shape descriptor in exactly the two documents that declare an expression', () => {
		const carriers: string[] = []
		for (const [key, entry] of Object.entries(INTERCHANGE_ARTIFACTS)) {
			const document = JSON.stringify(
				z.toJSONSchema(entry.schema, { io: 'input' }),
			)
			const carriesRequired = document.includes('requiredKeys')
			const carriesPermitted = document.includes('permittedKeys')
			// The pair is one descriptor, so one without the other would mean a new
			// half-shape rather than the descriptor this rule is about.
			expect(carriesPermitted, key).toBe(carriesRequired)
			if (carriesRequired) carriers.push(key)
		}
		expect(carriers.sort()).toEqual(['eval-contract', 'probe'])
	})
	// 17. AD-21 assigns an exit code per verdict: PASS, WAIVED, and CONCERNS exit
	//     zero and FAIL exits two. Both fields sit on one artifact, so a
	//     refinement could compare them, but a refinement is dropped from the
	//     published schema and the CLI is the thing that actually exits.
	it('admits an evidence artifact whose exit code contradicts its verdict', () => {
		admitsArtifact('evidence-artifact', (artifact) => {
			artifact.productionVerdict = 'FAIL'
			artifact.exitCode = 0
		})
	})

	// 18. AD-6 requires each invalidated attempt's reason; nothing makes the
	//     attempt numbers a set. Two attempts numbered 2 parse.
	it('admits invalidated attempts sharing one attempt number', () => {
		admitsArtifact('evidence-artifact', (artifact) => {
			artifact.trials.invalidatedAttempts = [
				{ attempt: 2, reason: 'port fault during probing' },
				{ attempt: 2, reason: 'a second, differently numbered thing' },
			]
		})
	})
})
