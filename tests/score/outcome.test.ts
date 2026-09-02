// AD-33's reference decision procedure: the four rule tables, the fixture set
// that exercises them, and the invariants the tables exist to hold.
//
// The whole fixture set runs through `resolveOutcome` once and every
// set-level assertion reads that one pass, so a case added to the fixtures
// reaches every invariant below without being wired to any of them.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { discoverSourceFiles } from '../../scripts/discover-source-files.ts'
import { STAGE_SIGNATURES } from '../../src/core/lineage/stage-table.ts'
import {
	CORROBORATION_VALUES,
	OUTCOME_STATES,
} from '../../src/core/schemas/evidence-artifact.ts'
import type { SealedRunRecord } from '../../src/core/schemas/sealed-run-record.ts'
import {
	CORROBORATION_RULES,
	FINDING_BUCKETS,
	INVALIDATING_CONDITIONS,
	JUDGE_CONDUCT_STATES,
	OUTCOME_RULES,
	type OutcomeInputs,
	resolveOutcome,
	uncitedFindingIds,
	WAIVABLE_FAILURES,
	WAIVER_RULES,
	WAIVER_STATES,
} from '../../src/core/score/outcome.ts'
import {
	mapFindings,
	PROBE_WITNESS_RESULTS,
} from '../../src/core/score/witness.ts'
import {
	CONSTRAINED_FIELDS,
	citationOf,
	dispositionOf,
	feasiblePairs,
	fixtureCases,
	INPUT_DOMAINS,
	INPUT_FIELDS,
	infeasiblePairs,
	NEAR_MISS_PAIRS,
	NEUTRAL_INPUTS,
	NONE,
	ONE,
	pairKeyOf,
	pairwiseCases,
	RULE_WITNESS_CASES,
	realizedPairKeys,
	SEVERAL,
	STRUCTURAL_CONSTRAINTS,
	satisfiesConstraints,
	signedProbe,
	unsignedCanaryProbe,
	witnessOf,
} from './fixtures/outcome-inputs.ts'

const OUTCOME_SOURCE = readFileSync(
	fileURLToPath(new URL('../../src/core/score/outcome.ts', import.meta.url)),
	'utf8',
)

const CASES = fixtureCases()
const RESOLVED = CASES.map((inputs) => ({
	inputs,
	resolution: resolveOutcome(inputs),
}))

const caseByLabel = new Map(
	RULE_WITNESS_CASES.map((entry) => [entry.label, entry.inputs]),
)

const namedInputs = (label: string): OutcomeInputs => {
	const found = caseByLabel.get(label)
	expect(found, `named case ${label}`).toBeDefined()
	return found as OutcomeInputs
}

const resolveNamed = (label: string) => resolveOutcome(namedInputs(label))

const provisionalStateOf = (ruleId: string) => {
	const rule = OUTCOME_RULES.find((candidate) => candidate.id === ruleId)
	expect(rule, `ladder rule ${ruleId}`).toBeDefined()
	return rule!.state
}

const countBy = <T extends string>(
	keys: readonly T[],
	predicate: (entry: (typeof RESOLVED)[number], key: T) => boolean,
): Record<string, number> =>
	Object.fromEntries(
		keys.map((key) => [
			key,
			RESOLVED.filter((entry) => predicate(entry, key)).length,
		]),
	)

describe('the declared vocabularies', () => {
	it('names the four buckets the finding map sorts into', () => {
		const buckets = mapFindings([], [], { observations: [], findings: [] })
		expect(new Set(FINDING_BUCKETS)).toEqual(new Set(Object.keys(buckets)))
	})

	it('keeps the four waiver states and the three judge-conduct states closed', () => {
		expect(WAIVER_STATES).toEqual([
			'none',
			'applied-condition-met',
			'applied-condition-unmet',
			'expired',
		])
		expect(JUDGE_CONDUCT_STATES).toEqual(['absent', 'conforming', 'malformed'])
	})

	it('declares ten conditions, twenty ladder rules, two waiver rules, and eight corroboration rules, each identifier unique', () => {
		const identifiers = [
			INVALIDATING_CONDITIONS.map((entry) => entry.id),
			OUTCOME_RULES.map((entry) => entry.id),
			WAIVER_RULES.map((entry) => entry.id),
			CORROBORATION_RULES.map((entry) => entry.id),
		]
		expect(identifiers.map((list) => list.length)).toEqual([10, 20, 2, 8])
		for (const list of identifiers) {
			expect(new Set(list).size).toBe(list.length)
			for (const identifier of list) expect(identifier).toMatch(/^[a-z0-9-]+$/)
		}
	})

	it('flags exactly the four rows that resolve their state from the citation', () => {
		expect(
			OUTCOME_RULES.filter((rule) => rule.resolvesFromCitation).map(
				(rule) => rule.id,
			),
		).toEqual([
			'finding-dangling-probe',
			'clean-control-false-positive',
			'canary-detected',
			'oracle-cited-defect',
		])
		// Those four are exactly the rows whose guard requires a citation to be
		// present. `canary-undetected` reads the citation too and resolves from
		// its absence, so it carries `false`.
		for (const rule of OUTCOME_RULES) {
			if (!rule.resolvesFromCitation) continue
			expect(
				rule.holds({ ...NEUTRAL_INPUTS, citedFinding: null }),
				rule.id,
			).toBe(false)
		}
	})

	it('pins the guard prose every table publishes, because no predicate can check it', () => {
		// The emitted document copies these strings verbatim, and nothing ties a
		// guard to the predicate beside it. Pinned here, so a guard edit that
		// does not match the code it describes fails before it is published.
		expect(
			INVALIDATING_CONDITIONS.map((entry) => [entry.id, entry.guard]),
		).toEqual([
			['evaluation-fault', 'an AD-26 evaluation fault was recorded'],
			['judge-malformed', 'judge conduct `malformed`'],
			[
				'unqualified-probe-in-sealed-set',
				'a probe is present and its qualification failed',
			],
			['dangling-probe-citation', "the cited finding's bucket is `dangling`"],
			['unwitnessed-detection-claim', 'witness result `unwitnessed-claim`'],
			['vacuous-signature', 'witness result `vacuous`'],
			[
				'selector-ambiguity',
				'a step matched several observations under a single-valued cardinality',
			],
			[
				'canary-non-detection',
				'class `canary`, some selection resolved other than `none`, and no defect finding cites the oracle',
			],
			[
				'unsupported-disposition',
				'the disposition is `held` or `violated` with empty `observationIds`',
			],
			[
				'disposition-missing',
				'the oracle is required and its disposition is `null`',
			],
		])
		expect(OUTCOME_RULES.map((entry) => [entry.id, entry.guard])).toEqual([
			['evaluation-fault', 'an AD-26 evaluation fault was recorded'],
			['judge-malformed', 'judge conduct `malformed`'],
			['probe-unqualified', 'a probe is present and its qualification failed'],
			['finding-dangling-probe', "the cited finding's bucket is `dangling`"],
			['witness-unwitnessed-claim', 'witness result `unwitnessed-claim`'],
			['witness-vacuous', 'witness result `vacuous`'],
			[
				'selector-ambiguous',
				'a step matched several observations under a single-valued cardinality',
			],
			[
				'witness-unexercised',
				'witness result `unexercised` on a probe outside the `expectedClean` branch',
			],
			[
				'steps-unreached',
				'no witness or witness result `not-triggered`; `selections` non-empty; every member resolved `none`',
			],
			[
				'zero-action-detected',
				'class `zero-action` on the seeding branch with witness result `matched`',
			],
			[
				'clean-control-false-positive',
				'`expectedClean` and a defect finding cites the oracle',
			],
			[
				'clean-control-passed',
				'`expectedClean` and the check root did not resolve `insufficient-evidence`',
			],
			[
				'canary-detected',
				'class `canary` and a defect finding cites the oracle',
			],
			[
				'canary-undetected',
				'class `canary`, some selection resolved other than `none`, and no defect finding cites the oracle',
			],
			[
				'witness-matched',
				'witness result `matched` on a probe outside the `expectedClean` branch',
			],
			[
				'witness-manifested-unclaimed',
				'witness result `manifested-unclaimed` on a probe outside the `expectedClean` branch',
			],
			[
				'oracle-cited-defect',
				"no witness and the cited finding's bucket is `mapped`",
			],
			[
				'check-insufficient-evidence',
				'the check root resolved `insufficient-evidence`',
			],
			['witness-not-triggered', 'witness result `not-triggered`'],
			['outcome-clear', 'the stated negation of every guard above'],
		])
		expect(WAIVER_RULES.map((entry) => [entry.id, entry.guard])).toEqual([
			[
				'waiver-honoured',
				'waiver `applied-condition-met` over a waivable failure',
			],
			[
				'waiver-bypassed',
				'waiver `applied-condition-unmet` over a waivable failure',
			],
		])
		expect(CORROBORATION_RULES.map((entry) => [entry.id, entry.guard])).toEqual(
			[
				[
					'disposition-unsupported',
					'the disposition is `held` or `violated` with empty `observationIds`',
				],
				[
					'disposition-contradicts-evidence',
					'`violated` with no defect finding, `held` with one, or `not-attempted` with one',
				],
				[
					'citation-declined',
					"the cited finding's bucket is `unmapped` or `signatureless`",
				],
				['examined-nothing', 'the check root resolved `insufficient-evidence`'],
				[
					'never-ran',
					'the final state is `unreached`, or the check root resolution is `null`',
				],
				[
					'check-confirms-silence',
					'the check satisfies and no defect finding cited the oracle',
				],
				[
					'check-confirms-finding',
					'the check does not satisfy and a defect finding cited the oracle',
				],
				[
					'check-and-findings-diverge',
					'the check satisfies with a finding cited, or does not satisfy with none',
				],
			],
		)
	})

	it('names in each guard every literal its predicate compares against, and the other way round', () => {
		// A pin catches a guard edited alone; it passes when the guard and its
		// pin are edited together, which is the natural response to a red pin.
		// This reads the predicate source instead, expanded through the
		// module-level helpers it names, and requires the two to agree on the
		// vocabulary. Five rows are listed as exempt with the reason each one
		// cannot agree.
		const exempt = new Map([
			['outcome-clear', 'its guard is the negation of every guard above it'],
			[
				'disposition-contradicts-evidence',
				'its prose enumerates arms the predicate reaches by negation',
			],
			['check-confirms-silence', 'it delegates to the satisfaction predicate'],
			['check-confirms-finding', 'it delegates to the satisfaction predicate'],
			[
				'check-and-findings-diverge',
				'it delegates to the satisfaction predicate',
			],
		])
		const bindingBody = (name: string): string | null => {
			const start = OUTCOME_SOURCE.indexOf(`\nconst ${name} = `)
			if (start === -1) return null
			const end = OUTCOME_SOURCE.indexOf('\n\n', start + 1)
			return OUTCOME_SOURCE.slice(start, end === -1 ? undefined : end)
		}
		const expand = (source: string, seen: Set<string>): string => {
			let text = source
			for (const name of source.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []) {
				if (seen.has(name)) continue
				seen.add(name)
				const body = bindingBody(name)
				if (body === null) continue
				text += expand(body, seen)
			}
			return text
		}
		const flagged: string[] = []
		for (const entry of [
			...INVALIDATING_CONDITIONS,
			...OUTCOME_RULES,
			...WAIVER_RULES,
			...CORROBORATION_RULES,
		]) {
			const source = expand(entry.holds.toString(), new Set())
			const named = [...entry.guard.matchAll(/`([^`]+)`/g)].map(
				(match) => match[1] ?? '',
			)
			// An indexed access in a type position, such as
			// `ProbeWitnessMatch['result']`, is erased first: it is a field name
			// the predicate never compares against.
			const compared = [
				...source.replace(/\['[^']*'\]/g, '[]').matchAll(/'([^']*)'/g),
			].map((match) => match[1] ?? '')
			const unnamed = compared.filter((literal) => !named.includes(literal))
			const absent = named.filter(
				(token) =>
					!source.includes(`'${token}'`) &&
					!new RegExp(
						`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
					).test(source),
			)
			if (unnamed.length === 0 && absent.length === 0) continue
			flagged.push(entry.id)
			expect(
				exempt.has(entry.id),
				`${entry.id}: guard names ${JSON.stringify(absent)} its predicate does not carry, and the predicate compares against ${JSON.stringify(unnamed)} its guard does not name`,
			).toBe(true)
		}
		// A subset assertion: an exempt row whose guard is tightened into agreement
		// stops being flagged without turning the build red. Every guard string,
		// exempt or not, is pinned by the test above.
		for (const id of flagged) expect([...exempt.keys()], id).toContain(id)
	})

	it('pins the constraint prose the table publishes beside each predicate', () => {
		expect(
			STRUCTURAL_CONSTRAINTS.map((entry) => [entry.id, entry.implication]),
		).toEqual([
			[
				'class-and-control-travel-together',
				'`expectedClean`, `probeSigned`, and `probeQualified` are non-`null` exactly where `probeClass` is, since with no probe there is no qualification result',
			],
			[
				'clean-control-carries-no-signature',
				'`expectedClean` implies `probeSigned` is `false`, because the clean-control branch carries no signature key at all',
			],
			[
				'witness-requires-a-signature',
				'a witness result exists only where `probeSigned` holds and `expectedClean` does not, which is the signed-probe shape AD-40 matches against and which admits a signed canary, and it always exists where that probe also qualified. The one gap is the unqualified signed probe, which can reach a scorer that performed no match, so a signed seeding probe carrying no witness stays representable exactly where its qualification failed',
			],
			[
				'signed-canary-cannot-qualify',
				'a signed canary fails qualification under `signature-present-on-canary`',
			],
			[
				'unsigned-non-canary-cannot-qualify',
				'an unsigned non-canary on the seeding branch fails qualification under `signature-absent`',
			],
			[
				'illegal-control-pairing-cannot-qualify',
				'a clean control outside class `zero-action` fails qualification, because the admissible-route list is empty for those three pairings',
			],
			[
				'ambiguity-requires-several',
				"`selectorAmbiguity` implies some member of `selections` resolved `several`. The field is an aggregate over the oracle's own declared steps, and the shipped predicate it mirrors reads `several` under a non-`any` cardinality on one step",
			],
		])
	})

	it('ties every corroboration value column to the value its rule produces', () => {
		// The `value` column is prose the document publishes, like the guards.
		// Seven rows produce one value for every input, so the string is checked
		// against the function; the eighth is conditional and both of its arms
		// are exercised.
		const conditional: string[] = []
		for (const rule of CORROBORATION_RULES) {
			const produced = new Set(
				CASES.map((inputs) => rule.corroboration(inputs)),
			)
			if (produced.size === 1) {
				const [only] = [...produced]
				expect(rule.value, rule.id).toBe(`\`${only}\``)
				continue
			}
			conditional.push(rule.id)
			expect(produced, rule.id).toEqual(new Set(['agrees', 'disagrees']))
		}
		expect(conditional).toEqual(['examined-nothing'])
		expect(
			CORROBORATION_RULES.find((rule) => rule.id === 'examined-nothing')?.value,
		).toBe(
			'`disagrees` where a defect finding cited the oracle, `agrees` where none did',
		)
		// The waiver rows publish their effect from the state they set, so the
		// same class of drift has no room there.
		for (const rule of WAIVER_RULES) {
			expect(rule.state, rule.id).toMatch(/^(not-applicable|bypassed)$/)
		}
	})

	it('produces every one of the twelve states from a ladder rule or the waiver adjustment', () => {
		const produced = new Set<string>([
			...OUTCOME_RULES.map((rule) => rule.state),
			...WAIVER_RULES.map((rule) => rule.state),
		])
		expect(produced).toEqual(new Set(OUTCOME_STATES))
		expect(WAIVABLE_FAILURES).toEqual(['missed'])
	})

	it('declares one domain per input field and fifty-seven values across them', () => {
		expect(new Set(INPUT_FIELDS)).toEqual(new Set(Object.keys(NEUTRAL_INPUTS)))
		const total = INPUT_FIELDS.reduce(
			(sum, field) => sum + INPUT_DOMAINS[field].length,
			0,
		)
		expect(total).toBe(57)
	})
})

describe('totality', () => {
	it('returns one defined resolution for every fixture case', () => {
		const conditionIds = new Set<string>(
			INVALIDATING_CONDITIONS.map((entry) => entry.id),
		)
		const ruleIds = new Set<string>(OUTCOME_RULES.map((entry) => entry.id))
		const waiverIds = new Set<string>(WAIVER_RULES.map((entry) => entry.id))
		const corroborationIds = new Set<string>(
			CORROBORATION_RULES.map((entry) => entry.id),
		)
		for (const { resolution } of RESOLVED) {
			expect(OUTCOME_STATES).toContain(resolution.state)
			expect(CORROBORATION_VALUES).toContain(resolution.corroboration)
			expect(ruleIds.has(resolution.rule)).toBe(true)
			expect(corroborationIds.has(resolution.corroborationRule)).toBe(true)
			if (resolution.waiverRule !== null) {
				expect(waiverIds.has(resolution.waiverRule)).toBe(true)
			}
			const fired = [...resolution.invalidatingConditions]
			expect(new Set(fired).size).toBe(fired.length)
			expect(fired).toEqual([...fired].sort())
			for (const condition of fired) {
				expect(conditionIds.has(condition)).toBe(true)
			}
		}
	})

	it('reports a rule whose guard holds and above which no guard holds', () => {
		for (const { inputs, resolution } of RESOLVED) {
			const fired = OUTCOME_RULES.findIndex(
				(rule) => rule.id === resolution.rule,
			)
			expect(fired, resolution.rule).toBeGreaterThanOrEqual(0)
			expect(OUTCOME_RULES[fired]?.holds(inputs), resolution.rule).toBe(true)
			for (const above of OUTCOME_RULES.slice(0, fired)) {
				expect(
					above.holds(inputs),
					`${resolution.rule} under ${above.id}`,
				).toBe(false)
			}
		}
		expect(
			RESOLVED.filter(({ resolution }) => resolution.rule === 'outcome-clear')
				.length,
		).toBeGreaterThan(0)
	})

	it('matches a ladder rule on every tuple of the declared guard domains', () => {
		// The ten fields the ladder guards read, crossed in full: 378,000
		// tuples, which is what makes the final row's negation checkable rather
		// than argued. The fixture set covers the other five fields.
		const guardFields = [
			'evaluationFault',
			'judgeConduct',
			'probeClass',
			'probeQualified',
			'citedFinding',
			'witness',
			'selectorAmbiguity',
			'selections',
			'expectedClean',
			'checkResolution',
		] as const
		const above = OUTCOME_RULES.slice(0, -1)
		const final = OUTCOME_RULES[OUTCOME_RULES.length - 1]
		expect(final?.id).toBe('outcome-clear')
		let tuples = 0
		let unmatched = 0
		let negationBroken = 0
		const walk = (depth: number, inputs: OutcomeInputs): void => {
			if (depth === guardFields.length) {
				tuples += 1
				if (!OUTCOME_RULES.some((rule) => rule.holds(inputs))) unmatched += 1
				// The final row's guard is written out as the negation of every
				// guard above it. Widening it changes nothing under first match,
				// so the property that matters is that it is exactly the
				// negation, and this is where that is enforced.
				if (
					final?.holds(inputs) !== above.every((rule) => !rule.holds(inputs))
				) {
					negationBroken += 1
				}
				return
			}
			const field = guardFields[depth]
			if (field === undefined) return
			for (const entry of INPUT_DOMAINS[field]) {
				walk(depth + 1, { ...inputs, [field]: entry.value } as OutcomeInputs)
			}
		}
		walk(0, NEUTRAL_INPUTS)
		expect(tuples).toBe(378_000)
		expect(unmatched).toBe(0)
		expect(negationBroken).toBe(0)
	})

	it('matches a corroboration rule on every tuple of its guard domains and every state', () => {
		let unmatched = 0
		for (const disposition of INPUT_DOMAINS.disposition)
			for (const citedFinding of INPUT_DOMAINS.citedFinding)
				for (const checkResolution of INPUT_DOMAINS.checkResolution)
					for (const polarity of INPUT_DOMAINS.polarity)
						for (const state of OUTCOME_STATES) {
							const inputs: OutcomeInputs = {
								...NEUTRAL_INPUTS,
								disposition: disposition.value,
								citedFinding: citedFinding.value,
								checkResolution: checkResolution.value,
								polarity: polarity.value,
							}
							if (
								!CORROBORATION_RULES.some((rule) => rule.holds(inputs, state))
							) {
								unmatched += 1
							}
						}
		expect(unmatched).toBe(0)
	})

	it('fires a waiver rule over no state outside the waivable group', () => {
		for (const waiver of INPUT_DOMAINS.waiver)
			for (const state of OUTCOME_STATES) {
				const inputs: OutcomeInputs = {
					...NEUTRAL_INPUTS,
					waiver: waiver.value,
				}
				for (const rule of WAIVER_RULES) {
					if (!rule.holds(inputs, state)) continue
					expect(WAIVABLE_FAILURES).toContain(state)
				}
			}
	})

	it('resolves the same input to the same resolution twice', () => {
		for (const inputs of CASES) {
			expect(resolveOutcome(inputs)).toEqual(resolveOutcome(inputs))
		}
	})
})

describe('the fixture set', () => {
	it('satisfies every named structural constraint', () => {
		for (const inputs of CASES) {
			for (const constraint of STRUCTURAL_CONSTRAINTS) {
				expect(constraint.holds(inputs), constraint.id).toBe(true)
			}
		}
		expect(satisfiesConstraints(NEUTRAL_INPUTS)).toBe(true)
	})

	it('derives seven constraints into a non-empty infeasible-pair list', () => {
		expect(STRUCTURAL_CONSTRAINTS.length).toBe(7)
		expect(infeasiblePairs().length).toBe(71)
		expect(feasiblePairs().length + infeasiblePairs().length).toBe(1496)
	})

	it('reaches no derived infeasible pair', () => {
		const forbidden = new Set(infeasiblePairs().map(pairKeyOf))
		for (const inputs of CASES) {
			// Non-null for every case, and asserted: a value the domains do not declare
			// would otherwise skip this case silently.
			const keys = realizedPairKeys(inputs)
			expect(keys).not.toBeNull()
			for (const key of keys ?? []) {
				expect(forbidden.has(key), key).toBe(false)
			}
		}
	})

	it('reads no constraint against a field outside the constrained group', () => {
		const free = INPUT_FIELDS.filter(
			(field) => !CONSTRAINED_FIELDS.some((named) => named === field),
		)
		for (const inputs of CASES) {
			const base = satisfiesConstraints(inputs)
			for (const field of free) {
				for (const entry of INPUT_DOMAINS[field]) {
					const varied = { ...inputs, [field]: entry.value } as OutcomeInputs
					expect(satisfiesConstraints(varied), `${field}=${entry.label}`).toBe(
						base,
					)
				}
			}
		}
	})

	it('covers every feasible pair', () => {
		const covered = new Set<string>()
		for (const inputs of pairwiseCases()) {
			const keys = realizedPairKeys(inputs)
			expect(keys).not.toBeNull()
			for (const key of keys ?? []) covered.add(key)
		}
		for (const pair of feasiblePairs()) {
			expect(covered.has(pairKeyOf(pair)), pairKeyOf(pair)).toBe(true)
		}
	})

	it('pins the case counts exactly, so a narrowed walk shows in the diff', () => {
		expect(pairwiseCases().length).toBe(80)
		expect(RULE_WITNESS_CASES.length).toBe(35)
		expect(CASES.length).toBe(115)
	})

	it('exercises both arms of every guard in all four tables', () => {
		const arms = (holds: (entry: (typeof RESOLVED)[number]) => boolean) => {
			const results = RESOLVED.map(holds)
			return { held: results.some(Boolean), failed: results.some((v) => !v) }
		}
		for (const condition of INVALIDATING_CONDITIONS) {
			expect(
				arms(({ inputs }) => condition.holds(inputs)),
				condition.id,
			).toEqual({ held: true, failed: true })
		}
		for (const rule of OUTCOME_RULES) {
			expect(
				arms(({ inputs }) => rule.holds(inputs)),
				rule.id,
			).toEqual({
				held: true,
				failed: true,
			})
		}
		for (const rule of WAIVER_RULES) {
			expect(
				arms(({ inputs, resolution }) =>
					rule.holds(inputs, provisionalStateOf(resolution.rule)),
				),
				rule.id,
			).toEqual({ held: true, failed: true })
		}
		for (const rule of CORROBORATION_RULES) {
			expect(
				arms(({ inputs, resolution }) => rule.holds(inputs, resolution.state)),
				rule.id,
			).toEqual({ held: true, failed: true })
		}
	})

	it('reaches every state, rule, and condition at least once', () => {
		// A zero detector, so it protects only a key whose count is exactly one:
		// dropping a named case fires it for 10 of the 35. The exact literals
		// below are what catch the other 25.
		const censuses = [
			countBy(
				OUTCOME_STATES,
				({ resolution }, key) => resolution.state === key,
			),
			countBy(
				OUTCOME_RULES.map((rule) => rule.id),
				({ resolution }, key) => resolution.rule === key,
			),
			countBy(
				WAIVER_RULES.map((rule) => rule.id),
				({ resolution }, key) => resolution.waiverRule === key,
			),
			countBy(
				CORROBORATION_RULES.map((rule) => rule.id),
				({ resolution }, key) => resolution.corroborationRule === key,
			),
			countBy(
				INVALIDATING_CONDITIONS.map((condition) => condition.id),
				({ resolution }, key) =>
					resolution.invalidatingConditions.some((fired) => fired === key),
			),
		]
		for (const census of censuses) {
			for (const [key, count] of Object.entries(census)) {
				expect(count, key).toBeGreaterThan(0)
			}
		}
	})

	it('pins every census count exactly, because a floor cannot catch a narrowed walk', () => {
		expect(
			countBy(
				OUTCOME_STATES,
				({ resolution }, key) => resolution.state === key,
			),
		).toEqual({
			caught: 7,
			confirmed: 18,
			missed: 2,
			'passed-clean-control': 1,
			'false-positive': 1,
			abstained: 2,
			bypassed: 1,
			unreached: 4,
			'oracle-error': 14,
			'judge-error': 7,
			'infrastructure-error': 54,
			'not-applicable': 4,
		})
		expect(
			countBy(
				OUTCOME_RULES.map((rule) => rule.id),
				({ resolution }, key) => resolution.rule === key,
			),
		).toEqual({
			'evaluation-fault': 14,
			'judge-malformed': 7,
			'probe-unqualified': 44,
			'finding-dangling-probe': 3,
			'witness-unwitnessed-claim': 1,
			'witness-vacuous': 2,
			'selector-ambiguous': 3,
			'witness-unexercised': 3,
			'steps-unreached': 4,
			'zero-action-detected': 1,
			'clean-control-false-positive': 1,
			'clean-control-passed': 1,
			'canary-detected': 2,
			'canary-undetected': 1,
			'witness-matched': 1,
			'witness-manifested-unclaimed': 4,
			'oracle-cited-defect': 3,
			'check-insufficient-evidence': 2,
			'witness-not-triggered': 1,
			'outcome-clear': 17,
		})
		expect(
			countBy(
				WAIVER_RULES.map((rule) => rule.id),
				({ resolution }, key) => resolution.waiverRule === key,
			),
		).toEqual({ 'waiver-honoured': 1, 'waiver-bypassed': 1 })
		expect(
			countBy(
				CORROBORATION_RULES.map((rule) => rule.id),
				({ resolution }, key) => resolution.corroborationRule === key,
			),
		).toEqual({
			'disposition-unsupported': 23,
			'disposition-contradicts-evidence': 23,
			'citation-declined': 13,
			'examined-nothing': 5,
			'never-ran': 7,
			'check-confirms-silence': 33,
			'check-confirms-finding': 2,
			'check-and-findings-diverge': 9,
		})
		expect(
			countBy(
				INVALIDATING_CONDITIONS.map((condition) => condition.id),
				({ resolution }, key) =>
					resolution.invalidatingConditions.some((fired) => fired === key),
			),
		).toEqual({
			'evaluation-fault': 14,
			'judge-malformed': 14,
			'unqualified-probe-in-sealed-set': 57,
			'dangling-probe-citation': 13,
			'unwitnessed-detection-claim': 9,
			'vacuous-signature': 8,
			'selector-ambiguity': 13,
			'canary-non-detection': 2,
			'unsupported-disposition': 23,
			'disposition-missing': 2,
		})
	})
})

describe('the twelve states, positive and near miss', () => {
	it('pairs every state with a case producing it and one differing in a single field', () => {
		expect(new Set(NEAR_MISS_PAIRS.map((pair) => pair.state))).toEqual(
			new Set(OUTCOME_STATES),
		)
		for (const pair of NEAR_MISS_PAIRS) {
			const positive = namedInputs(pair.positive)
			const nearMiss = namedInputs(pair.nearMiss)
			expect(resolveOutcome(positive).state, pair.state).toBe(pair.state)
			expect(resolveOutcome(nearMiss).state, pair.state).not.toBe(pair.state)
			const differing = INPUT_FIELDS.filter(
				(field) =>
					JSON.stringify(positive[field]) !== JSON.stringify(nearMiss[field]),
			)
			expect(differing, pair.state).toEqual([pair.field])
		}
	})
})

describe('Stage A: the invalidating conditions', () => {
	it('returns all six conditions of the six-condition fixture, none masked', () => {
		const resolution = resolveNamed('six-conditions')
		expect(resolution.invalidatingConditions).toEqual([
			'dangling-probe-citation',
			'evaluation-fault',
			'judge-malformed',
			'selector-ambiguity',
			'unqualified-probe-in-sealed-set',
			'unwitnessed-detection-claim',
		])
	})

	it('fires each condition from at least one case whose state came from elsewhere', () => {
		for (const condition of INVALIDATING_CONDITIONS) {
			const firing = RESOLVED.filter(({ resolution }) =>
				resolution.invalidatingConditions.some((id) => id === condition.id),
			)
			expect(firing.length, condition.id).toBeGreaterThan(0)
			for (const { inputs } of firing) {
				expect(condition.holds(inputs), condition.id).toBe(true)
			}
		}
	})

	it('records a declared-but-unproduced canary as unreached, indicting nothing', () => {
		const resolution = resolveOutcome({
			...NEUTRAL_INPUTS,
			...unsignedCanaryProbe(true),
			selections: [NONE],
		})
		expect(resolution.invalidatingConditions).toEqual([])
		expect(resolution.state).toBe('unreached')
		expect(resolution.corroboration).toBe('not-evaluable')
	})

	it('records a canary that declared no step on the final row', () => {
		// A different case from the one above, and it lands differently. AD-6
		// scopes `unreached` to an oracle's declared steps, so an oracle that
		// declared none falls to the tail. AD-7 keeps canaries out of the
		// dominance vector by class, so no rate moves either way.
		const resolution = resolveOutcome({
			...NEUTRAL_INPUTS,
			...unsignedCanaryProbe(true),
		})
		expect(resolution.invalidatingConditions).toEqual([])
		expect(resolution.rule).toBe('outcome-clear')
		expect(resolution.state).toBe('confirmed')
	})

	it('reads a dangling citation as a detection claim, so the canary condition stays silent', () => {
		const exercised = {
			...NEUTRAL_INPUTS,
			...unsignedCanaryProbe(true),
			selections: [ONE],
		}
		expect(resolveOutcome(exercised).invalidatingConditions).toEqual([
			'canary-non-detection',
		])
		const dangling = { ...exercised, citedFinding: citationOf('dangling') }
		// The evaluator did file against this oracle; it is the probe the finding
		// names that the sealed set does not declare, which has its own condition
		// and reaches the same rung.
		expect(resolveOutcome(dangling).invalidatingConditions).toEqual([
			'dangling-probe-citation',
		])
		expect(resolveOutcome(dangling).state).toBe('infrastructure-error')
	})

	it('fires disposition-missing only where the oracle is required', () => {
		expect(resolveNamed('disposition-missing').invalidatingConditions).toEqual([
			'disposition-missing',
		])
		expect(resolveNamed('outcome-clear').invalidatingConditions).toEqual([])
	})
})

describe('Stage B: the state ladder', () => {
	it('maps each of the six witness results as declared', () => {
		const expected = {
			matched: 'caught',
			'manifested-unclaimed': 'missed',
			'not-triggered': 'confirmed',
			unexercised: 'not-applicable',
			vacuous: 'infrastructure-error',
			'unwitnessed-claim': 'infrastructure-error',
		} as const
		for (const result of PROBE_WITNESS_RESULTS) {
			const resolution = resolveOutcome({
				...NEUTRAL_INPUTS,
				...signedProbe('defect', true),
				witness: witnessOf(result),
			})
			expect(resolution.state, result).toBe(expected[result])
		}
	})

	it('never resolves an unwitnessed claim as a miss', () => {
		for (const { inputs, resolution } of RESOLVED) {
			if (inputs.witness?.result !== 'unwitnessed-claim') continue
			expect(resolution.state).not.toBe('missed')
		}
	})

	it('resolves caught from a mapped citation and declines the other two buckets', () => {
		expect(resolveNamed('oracle-cited-defect').state).toBe('caught')
		expect(resolveNamed('oracle-cited-defect').resolvedFrom).toBe(
			'finding-mapped',
		)
		for (const bucket of ['unmapped', 'signatureless'] as const) {
			const resolution = resolveOutcome({
				...NEUTRAL_INPUTS,
				citedFinding: citationOf(bucket),
			})
			expect(resolution.state, bucket).not.toBe('caught')
			expect(resolution.declinedFindingIds).toEqual([`finding-${bucket}`])
			expect(resolution.corroboration).toBe('disagrees')
		}
		expect(
			resolveNamed('finding-dangling-probe').invalidatingConditions,
		).toContain('dangling-probe-citation')
	})

	it('lets the witness decide on a signed probe, whatever the bucket', () => {
		for (const bucket of ['mapped', 'unmapped', 'signatureless'] as const) {
			const resolution = resolveOutcome({
				...NEUTRAL_INPUTS,
				...signedProbe('defect', true),
				witness: witnessOf('matched'),
				citedFinding: citationOf(bucket),
			})
			expect(resolution.state, bucket).toBe('caught')
			expect(resolution.rule).toBe('witness-matched')
		}
	})

	it('takes AD-26 and AD-17 from declared inputs', () => {
		expect(resolveNamed('evaluation-fault').state).toBe('oracle-error')
		expect(resolveNamed('judge-malformed').state).toBe('judge-error')
	})

	it('scopes unreached to an oracle that declared steps and produced none', () => {
		expect(resolveNamed('steps-unreached').state).toBe('unreached')
		expect(resolveNamed('steps-unreached').corroboration).toBe('not-evaluable')
		expect(resolveOutcome({ ...NEUTRAL_INPUTS, selections: [] }).state).toBe(
			'confirmed',
		)
		expect(
			resolveOutcome({ ...NEUTRAL_INPUTS, selections: [NONE, ONE] }).state,
		).toBe('confirmed')
		for (const result of PROBE_WITNESS_RESULTS) {
			const resolution = resolveOutcome({
				...NEUTRAL_INPUTS,
				...signedProbe('defect', true),
				witness: witnessOf(result),
				selections: [NONE],
			})
			if (result === 'not-triggered') {
				expect(resolution.state).toBe('unreached')
				continue
			}
			expect(resolution.state, result).not.toBe('unreached')
		}
	})

	it('keeps a clean control to its two behavioural verdicts', () => {
		expect(resolveNamed('clean-control-passed').state).toBe(
			'passed-clean-control',
		)
		expect(resolveNamed('clean-control-false-positive').state).toBe(
			'false-positive',
		)
	})

	it('holds a clean control to the states AD-9 and AD-6 leave open, over the whole input type', () => {
		// The sweep covers the whole input type: the constraints model what the
		// upstream records carry, so a claim about every `expectedClean` input has
		// to be checked against the type itself. The ten fields any ladder guard
		// reads, plus the waiver, crossed in full.
		const swept = [
			'evaluationFault',
			'judgeConduct',
			'probeClass',
			'probeQualified',
			'citedFinding',
			'witness',
			'selectorAmbiguity',
			'selections',
			'checkResolution',
			'waiver',
		] as const
		const reached = new Set<string>()
		const reachedUnderConstraints = new Set<string>()
		let waiverFired = 0
		let tuples = 0
		const walk = (depth: number, inputs: OutcomeInputs): void => {
			if (depth === swept.length) {
				tuples += 1
				const resolution = resolveOutcome(inputs)
				reached.add(resolution.state)
				if (resolution.waiverRule !== null) waiverFired += 1
				if (satisfiesConstraints(inputs)) {
					reachedUnderConstraints.add(resolution.state)
				}
				return
			}
			const field = swept[depth]
			if (field === undefined) return
			for (const entry of INPUT_DOMAINS[field]) {
				walk(depth + 1, { ...inputs, [field]: entry.value } as OutcomeInputs)
			}
		}
		// `probeSigned: false` in the base, because a clean control carries no
		// signature; without it every tuple would violate the first constraint
		// and the constrained set below would be empty.
		walk(0, { ...NEUTRAL_INPUTS, expectedClean: true, probeSigned: false })
		expect(tuples).toBe(504_000)
		// AD-9's two behavioural verdicts, `abstained` where the check examined
		// nothing, AD-6's `unreached`, and its three invalidating states. Seven,
		// and the same seven under the constraints: the three witness rows above
		// the pair each carry `expectedClean`, so the set no longer depends on a
		// constraint holding.
		const legal = new Set([
			'passed-clean-control',
			'false-positive',
			'abstained',
			'unreached',
			'oracle-error',
			'judge-error',
			'infrastructure-error',
		])
		expect(reached).toEqual(legal)
		expect(reachedUnderConstraints).toEqual(legal)
		// `not-applicable` among them would be spine-unlicensed: AD-6 legalises
		// it for a probe AD-40 records as unexercised, and a clean control
		// carries no signature for AD-40 to record anything about.
		expect(reached.has('not-applicable')).toBe(false)
		for (const forbidden of ['caught', 'missed', 'bypassed', 'confirmed']) {
			expect(reached.has(forbidden), forbidden).toBe(false)
		}
		// Stage C is closed for a clean control over the whole input type, which
		// is what the waivable group being `missed` alone is supposed to mean.
		expect(waiverFired).toBe(0)
	})

	it('abstains on a clean control whose check examined nothing', () => {
		// AD-4 makes `insufficient-evidence` terminal so a build cannot pass
		// green on an oracle that examined an empty collection, and AD-6 lands
		// that resolution on `abstained`. AD-9's two legal behavioural verdicts
		// keep a clean control off `caught` and `missed`, which is what they are
		// for.
		const resolution = resolveNamed('clean-control-examined-nothing')
		expect(resolution.rule).toBe('check-insufficient-evidence')
		expect(resolution.state).toBe('abstained')
		expect(resolution.corroboration).toBe('agrees')
		// A filed finding still outranks it: a detection is evidence a check
		// that examined nothing does not weaken.
		expect(
			resolveOutcome({
				...namedInputs('clean-control-examined-nothing'),
				citedFinding: citationOf('signatureless'),
			}).state,
		).toBe('false-positive')
		// A `null` root resolution keeps the pass, with a corroboration saying
		// the check never ran, which is the tail's own reading of measuring
		// nothing.
		expect(
			resolveOutcome({
				...namedInputs('clean-control-passed'),
				checkResolution: null,
			}).state,
		).toBe('passed-clean-control')
	})

	it('resolves a satisfied zero-action probe as caught and never as a clean pass', () => {
		expect(resolveNamed('zero-action-detected').state).toBe('caught')
		expect(resolveNamed('zero-action-detected').rule).toBe(
			'zero-action-detected',
		)
		for (const { inputs, resolution } of RESOLVED) {
			if (inputs.probeClass !== 'zero-action') continue
			if (inputs.expectedClean !== false) continue
			if (inputs.witness?.result !== 'matched') continue
			expect(resolution.state).not.toBe('passed-clean-control')
		}
	})

	it('abstains where the check examined nothing, above the not-triggered row', () => {
		expect(resolveNamed('check-insufficient-evidence').state).toBe('abstained')
		const abstentionIndex = OUTCOME_RULES.findIndex(
			(rule) => rule.id === 'check-insufficient-evidence',
		)
		const notTriggeredIndex = OUTCOME_RULES.findIndex(
			(rule) => rule.id === 'witness-not-triggered',
		)
		const mappedIndex = OUTCOME_RULES.findIndex(
			(rule) => rule.id === 'oracle-cited-defect',
		)
		expect(abstentionIndex).toBeLessThan(notTriggeredIndex)
		expect(mappedIndex).toBeLessThan(abstentionIndex)
		const detectionRelabelled = RESOLVED.filter(
			({ inputs, resolution }) =>
				resolution.state === 'abstained' &&
				(inputs.witness?.result === 'matched' ||
					inputs.citedFinding?.bucket === 'mapped'),
		)
		expect(detectionRelabelled).toEqual([])
	})
})

describe('Stage C: the waiver adjustment', () => {
	it('honours a waiver over a miss and records a bypass without its condition', () => {
		expect(resolveNamed('waiver-honoured').state).toBe('not-applicable')
		expect(resolveNamed('waiver-honoured').waiverRule).toBe('waiver-honoured')
		expect(resolveNamed('waiver-bypassed').state).toBe('bypassed')
		expect(resolveNamed('waiver-bypassed').waiverRule).toBe('waiver-bypassed')
	})

	it('leaves every other provisional state and every other waiver value alone', () => {
		for (const waiver of WAIVER_STATES) {
			for (const label of [
				'witness-matched',
				'steps-unreached',
				'check-insufficient-evidence',
				'clean-control-false-positive',
				'clean-control-passed',
			]) {
				const inputs = { ...namedInputs(label), waiver }
				const resolution = resolveOutcome(inputs)
				expect(resolution.waiverRule, `${label}/${waiver}`).toBeNull()
				expect(resolution.state, `${label}/${waiver}`).toBe(
					resolveNamed(label).state,
				)
			}
		}
		for (const waiver of ['none', 'expired'] as const) {
			const resolution = resolveOutcome({
				...namedInputs('witness-manifested-unclaimed'),
				waiver,
			})
			expect(resolution.state).toBe('missed')
			expect(resolution.waiverRule).toBeNull()
		}
	})

	it('never converts a witnessed detection or a clean control through the waiver', () => {
		for (const { inputs, resolution } of RESOLVED) {
			if (inputs.witness?.result === 'matched') {
				expect(resolution.state).not.toBe('not-applicable')
			}
			if (inputs.expectedClean === true) {
				expect(resolution.waiverRule).toBeNull()
				expect(resolution.state).not.toBe('bypassed')
			}
			if (resolution.rule === 'check-insufficient-evidence') {
				expect(resolution.state).toBe('abstained')
			}
		}
	})
})

describe('corroboration', () => {
	it('never records not-evaluable where the check examined nothing', () => {
		for (const { inputs, resolution } of RESOLVED) {
			if (inputs.checkResolution !== 'insufficient-evidence') continue
			expect(resolution.corroboration).not.toBe('not-evaluable')
		}
		expect(resolveNamed('check-insufficient-evidence').corroboration).toBe(
			'agrees',
		)
		expect(resolveNamed('examined-nothing-disagrees').corroboration).toBe(
			'disagrees',
		)
	})

	it('disagrees on an unsupported disposition ahead of every check-derived rule', () => {
		const resolution = resolveOutcome({
			...NEUTRAL_INPUTS,
			disposition: dispositionOf('held', []),
			checkResolution: 'insufficient-evidence',
		})
		expect(resolution.corroborationRule).toBe('disposition-unsupported')
		expect(resolution.corroboration).toBe('disagrees')
		const violatedSupported = resolveOutcome({
			...NEUTRAL_INPUTS,
			disposition: dispositionOf('violated', ['obs-1']),
			checkResolution: 'insufficient-evidence',
		})
		expect(violatedSupported.corroborationRule).toBe(
			'disposition-contradicts-evidence',
		)
		expect(violatedSupported.corroboration).toBe('disagrees')
	})

	it('reads the disposition against the findings in both directions', () => {
		const cited = citationOf('mapped')
		expect(
			resolveOutcome({
				...NEUTRAL_INPUTS,
				disposition: dispositionOf('held', ['obs-1']),
				citedFinding: cited,
			}).corroborationRule,
		).toBe('disposition-contradicts-evidence')
		expect(
			resolveOutcome({
				...NEUTRAL_INPUTS,
				disposition: dispositionOf('not-attempted', ['obs-1']),
				citedFinding: cited,
			}).corroborationRule,
		).toBe('disposition-contradicts-evidence')
		expect(
			resolveOutcome({
				...NEUTRAL_INPUTS,
				disposition: dispositionOf('not-attempted', ['obs-1']),
			}).corroborationRule,
		).toBe('check-confirms-silence')
	})

	it('reads a null root resolution as never having run', () => {
		expect(resolveNamed('never-ran').corroboration).toBe('not-evaluable')
		expect(resolveNamed('never-ran').corroborationRule).toBe('never-ran')
	})

	it('partitions the remainder on satisfaction and citation under both polarities', () => {
		expect(resolveNamed('outcome-clear').corroborationRule).toBe(
			'check-confirms-silence',
		)
		expect(resolveNamed('check-confirms-finding').corroborationRule).toBe(
			'check-confirms-finding',
		)
		expect(resolveNamed('check-and-findings-diverge').corroborationRule).toBe(
			'check-and-findings-diverge',
		)
		const violationPolarity = resolveOutcome({
			...NEUTRAL_INPUTS,
			polarity: 'expects-violation',
			checkResolution: 'false',
		})
		expect(violationPolarity.corroborationRule).toBe('check-confirms-silence')
	})

	it('catches both halves of the worked chain', () => {
		const resolution = resolveNamed('worked-chain')
		expect(resolution.state).toBe('unreached')
		expect(resolution.corroboration).toBe('disagrees')
		expect(resolution.invalidatingConditions).toEqual([
			'unsupported-disposition',
		])
	})
})

describe('what the resolution carries back', () => {
	it('concatenates the selections then the witness, keeping first appearance', () => {
		const resolution = resolveOutcome({
			...NEUTRAL_INPUTS,
			...signedProbe('defect', true),
			witness: witnessOf('matched'),
			selections: [NONE, ONE, SEVERAL],
		})
		expect(resolution.selectedObservationIds).toEqual([
			'obs-1',
			'obs-2',
			'obs-3',
			'obs-w1',
		])
		expect(
			resolveOutcome({ ...NEUTRAL_INPUTS, selections: [ONE] })
				.selectedObservationIds,
		).toEqual(['obs-1'])
		expect(resolveNamed('outcome-clear').selectedObservationIds).toEqual([])
	})

	it('names the finding a state resolved from, and declines the rest', () => {
		expect(resolveNamed('canary-detected').resolvedFrom).toBe(
			'finding-signatureless',
		)
		expect(resolveNamed('canary-detected').declinedFindingIds).toEqual([])
		expect(resolveNamed('clean-control-false-positive').resolvedFrom).toBe(
			'finding-signatureless',
		)
		// Row 4 names the finding its infrastructure error came from. `null`
		// there would say no finding was cited when one was, which is the one
		// thing the field's own description forbids.
		expect(resolveNamed('finding-dangling-probe').resolvedFrom).toBe(
			'finding-dangling',
		)
		expect(resolveNamed('finding-dangling-probe').declinedFindingIds).toEqual(
			[],
		)
		expect(resolveNamed('probe-unqualified').resolvedFrom).toBeNull()
		expect(resolveNamed('citation-declined').resolvedFrom).toBeNull()
		expect(resolveNamed('citation-declined').declinedFindingIds).toEqual([
			'finding-unmapped',
		])
		expect(resolveNamed('outcome-clear').resolvedFrom).toBeNull()
	})

	it('returns the findings citing no oracle, sorted, and discards none', () => {
		const findings = [
			{ findingId: 'finding-c', oracleId: null },
			{ findingId: 'finding-a', oracleId: null },
			{ findingId: 'finding-b', oracleId: 'oracle-1' },
		] as unknown as SealedRunRecord['findings']
		expect(uncitedFindingIds({ findings })).toEqual(['finding-a', 'finding-c'])
		expect(uncitedFindingIds({ findings: [] })).toEqual([])
		// Two entries under one identifier come back as two, because collapsing
		// them would be the discarding AD-33 forbids.
		const repeated = [
			{ findingId: 'finding-a', oracleId: null },
			{ findingId: 'finding-a', oracleId: null },
		] as unknown as SealedRunRecord['findings']
		expect(uncitedFindingIds({ findings: repeated })).toEqual([
			'finding-a',
			'finding-a',
		])
	})
})

describe('the conjuncts the fixture set cannot reach', () => {
	// Three ladder conjuncts are excluded from the covering array by a
	// structural constraint or by the row order above them. They are the
	// defensive halves that fire on a shape the schemas admit and the gate
	// rejects, so they are exercised here directly.
	it('ignores a qualification verdict carrying no probe', () => {
		expect(
			resolveOutcome({
				...NEUTRAL_INPUTS,
				probeClass: null,
				probeQualified: false,
			}).rule,
		).toBe('outcome-clear')
	})

	it('keeps the zero-action row off a clean control', () => {
		expect(
			resolveOutcome({
				...NEUTRAL_INPUTS,
				probeClass: 'zero-action',
				expectedClean: true,
				probeSigned: false,
				probeQualified: true,
				witness: witnessOf('matched'),
			}).rule,
		).toBe('clean-control-passed')
	})

	it('keeps the citation row off an oracle carrying a witness', () => {
		expect(
			resolveOutcome({
				...NEUTRAL_INPUTS,
				...signedProbe('defect', true),
				witness: witnessOf('not-triggered'),
				citedFinding: citationOf('mapped'),
				selections: [ONE],
			}).rule,
		).toBe('witness-not-triggered')
	})

	it('overlaps the zero-action row with the witness row and moves no state', () => {
		const zeroAction = OUTCOME_RULES.findIndex(
			(rule) => rule.id === 'zero-action-detected',
		)
		const matched = OUTCOME_RULES.findIndex(
			(rule) => rule.id === 'witness-matched',
		)
		expect(zeroAction).toBeLessThan(matched)
		expect(OUTCOME_RULES[zeroAction]?.state).toBe(OUTCOME_RULES[matched]?.state)
		expect(OUTCOME_RULES[zeroAction]?.resolvesFromCitation).toBe(
			OUTCOME_RULES[matched]?.resolvesFromCitation,
		)
		for (const { inputs } of RESOLVED) {
			if (OUTCOME_RULES[zeroAction]?.holds(inputs) !== true) continue
			expect(OUTCOME_RULES[matched]?.holds(inputs)).toBe(true)
		}
	})

	it('reads no rule against probeSigned', () => {
		for (const { inputs, resolution } of RESOLVED) {
			for (const signed of [null, true, false] as const) {
				expect(
					resolveOutcome({ ...inputs, probeSigned: signed }),
					String(signed),
				).toEqual(resolution)
			}
		}
	})
})

describe('the boundary the procedure holds', () => {
	it('is the only module in the package that names an AD-6 state', () => {
		const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
		return discoverSourceFiles(repoRoot).then((files) => {
			for (const state of OUTCOME_STATES) {
				const naming = [...files]
					.filter(([, source]) => source.includes(`'${state}'`))
					.map(([path]) => path)
					.sort()
				expect(naming, state).toEqual([
					'src/core/schemas/evidence-artifact.ts',
					'src/core/score/outcome.ts',
				])
			}
		})
	})

	it('claims no lineage stage', () => {
		expect(STAGE_SIGNATURES.score.module).toBeNull()
	})
})
