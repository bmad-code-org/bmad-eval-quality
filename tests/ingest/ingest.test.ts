/**
 * One case per row of the ingest stage's edge-case matrix, each failing
 * independently: the matrix is the specification, so a row that only fails as
 * part of a larger assertion proves nothing about that row.
 *
 * Built from the shipped artifact fixtures. `tests/preflight/fixtures/
 * observations.ts` looks adjacent and is not a source: it builds
 * `ProbeObservation` from the port message schema, an unrelated type.
 */
import { describe, expect, it } from 'vitest'
import { digestArtifact } from '../../src/core/canonical/digest.ts'
import {
	type IngestCondition,
	ingest,
	LADDER_TARGETS,
} from '../../src/core/ingest/index.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import type { IsolationManifest } from '../../src/core/schemas/isolation-manifest.ts'
import {
	type Observation,
	SealedRunRecord,
} from '../../src/core/schemas/sealed-run-record.ts'
import { auditQuotation } from '../../src/core/score/quotation.ts'
import {
	evaluatorConfigurationFixture,
	isolationManifestFixture,
	sealedRunRecordFixture,
} from '../schemas/fixtures/artifact-fixtures.ts'

type DefectFinding = Extract<
	SealedRunRecord['findings'][number],
	{ findingType: 'defect' }
>

const configuration = evaluatorConfigurationFixture

/**
 * The digest `evaluatorConfigurationFixture` actually produces. Both shipped
 * fixtures declare `digestOf(4)`, a placeholder that is not this artifact's
 * digest, so a record taken straight from them fires
 * `evaluator-configuration-digest-mismatch`. Every case that is not about that
 * condition declares the computed value on both artifacts instead.
 */
const CONFIGURATION_DIGEST = digestArtifact(
	configuration,
	'EvaluatorConfiguration',
)

const declaring = (record: SealedRunRecord): SealedRunRecord => ({
	...record,
	evaluatorConfigurationDigest: CONFIGURATION_DIGEST,
})

/** The fixture manifest, declaring the digest the configuration really has. */
const honestManifest: IsolationManifest = {
	...isolationManifestFixture,
	evaluatorConfigurationDigest: CONFIGURATION_DIGEST,
}

const conditionsOf = <Kind extends IngestCondition['kind']>(
	conditions: readonly IngestCondition[],
	kind: Kind,
): readonly Extract<IngestCondition, { kind: Kind }>[] =>
	conditions.filter(
		(condition): condition is Extract<IngestCondition, { kind: Kind }> =>
			condition.kind === kind,
	)

const kindsOf = (
	conditions: readonly IngestCondition[],
): readonly IngestCondition['kind'][] =>
	conditions.map((condition) => condition.kind)

/**
 * The fixture's defect finding quotes `{"ok":true,"note":{"title":"Revised"}}`,
 * which RFC 8785 never produces: canonical serialization sorts keys and the
 * fixture body also carries an `id`. Witnessed spelling, so a clean record is
 * actually clean.
 */
const witnessedQuotes: DefectFinding['quotedEvidence'] = [
	{ quote: '"title":"Revised"', channel: 'response-body' },
	{ quote: '200', channel: 'response-status' },
]

const withQuotes = (
	record: SealedRunRecord,
	quotedEvidence: DefectFinding['quotedEvidence'],
): SealedRunRecord => ({
	...record,
	findings: record.findings.map((finding) =>
		finding.findingType === 'defect' ? { ...finding, quotedEvidence } : finding,
	),
})

/**
 * The fixture record minus its three conditions: the unwitnessed quotation, the
 * judge result carrying `score: null` that the schema is required to parse, and
 * the placeholder evaluator configuration digest.
 */
const cleanRecord: SealedRunRecord = declaring({
	...withQuotes(sealedRunRecordFixture, witnessedQuotes),
	judgeResults: sealedRunRecordFixture.judgeResults.map((result) => ({
		...result,
		score: result.score ?? 2,
	})),
})

/** The fixture manifest minus its one admitted forbidden input. */
const cleanManifest: IsolationManifest = {
	...honestManifest,
	forbiddenInputAccounting: {
		...honestManifest.forbiddenInputAccounting,
		'human-labels': { withheld: true, note: null },
	},
}

const inertObservation = (
	observationId: string,
	sequence: number,
): Observation => ({
	observationId,
	sequence,
	operationId: 'get-note',
	provenance: 'evaluator-chosen',
	callInputs: { path: null, query: null, header: null, body: null },
	responseBody: null,
	responseHeaders: null,
	responseStatus: 200,
	stdout: null,
	stderr: null,
	exitCode: null,
})

/** A defect finding citing one observation and quoting one channel of it. */
const quotingFinding = (
	findingId: string,
	observationId: string,
	quotedEvidence: DefectFinding['quotedEvidence'],
): DefectFinding => ({
	findingType: 'defect',
	findingId,
	oracleId: 'O-001',
	probeId: 'P-001',
	behaviorId: 'B-001',
	severity: 'critical',
	summary: 'A quoted channel that canonicalization cannot render.',
	confidence: 0.9,
	observationIds: [observationId],
	evidenceArtifacts: [],
	quotedEvidence,
})

/** A defect finding citing identifiers no observation declares. */
const citingFinding = (
	findingId: string,
	observationIds: readonly string[],
): DefectFinding => ({
	...quotingFinding(findingId, 'unused', witnessedQuotes),
	observationIds: [...observationIds],
})

describe('the ingest stage', () => {
	// Matrix row 1.
	it('records nothing when three agreeing artifacts carry an unviolated manifest', () => {
		const result = ingest(cleanRecord, cleanManifest, configuration)

		expect(result.conditions).toEqual([])
		expect(result.isolationViolation).toEqual([])
		expect(result.unwitnessedQuotations).toEqual([])
		expect(result.mode).toBe('contract-scoring')
		expect(result.observations.map((each) => each.observationId)).toEqual([
			'obs-001',
			'obs-003',
			'obs-004',
			'obs-005',
		])
		expect(result.findings).toEqual(cleanRecord.findings)
		expect(result.dispositions).toEqual(cleanRecord.oracleDispositions)
	})

	// `mode` is restated off the record, never derived or defaulted. The shipped
	// fixture is `contract-scoring`, so the case that proves the restatement has
	// to present the other value.
	it('restates the mode the record carries', () => {
		const record: SealedRunRecord = { ...cleanRecord, mode: 'production' }

		expect(ingest(record, cleanManifest, configuration).mode).toBe('production')
	})

	// `evaluatorRecommendation` is restated off the record the same way `mode`
	// is, never derived or defaulted. The shipped fixture carries `FAIL`, so
	// the case that proves the restatement has to present a different value.
	it('restates the evaluatorRecommendation the record carries', () => {
		const record: SealedRunRecord = {
			...cleanRecord,
			evaluatorRecommendation: 'CONCERNS',
		}

		expect(
			ingest(record, cleanManifest, configuration).evaluatorRecommendation,
		).toBe('CONCERNS')
	})

	// `runId` is restated off the record on the same terms as `mode` and
	// `evaluatorRecommendation`: never derived, recomputed, or defaulted.
	// `score.ts` reads it the same way (Story 8.2's own round-3 finding for
	// `evaluatorRecommendation`, not repeated here).
	it('restates the runId the record carries', () => {
		const record: SealedRunRecord = { ...cleanRecord, runId: 'a-different-run' }

		expect(ingest(record, cleanManifest, configuration).runId).toBe(
			'a-different-run',
		)
	})

	// Ascending `sequence`, then `observationId`, matching `selectObservations`.
	// The record here is deliberately one that could not parse: `sequence` is
	// refined unique per record, so the tie-break is unreachable on real input and
	// is kept for comparator identity with the shipped sort. Asserted so a later
	// edit to the comparator is caught rather than silently accepted.
	it('exposes observations in ascending sequence, breaking ties on identifier', () => {
		const record: SealedRunRecord = {
			...cleanRecord,
			findings: [],
			observations: [
				inertObservation('obs-b', 1),
				inertObservation('obs-c', 1),
				inertObservation('obs-a', 1),
				inertObservation('obs-z', 9),
			],
		}

		expect(
			ingest(record, cleanManifest, configuration).observations.map(
				(each) => each.observationId,
			),
		).toEqual(['obs-a', 'obs-b', 'obs-c', 'obs-z'])
	})

	// `sequence` is the primary key and the identifier only breaks its ties, so
	// the case that holds the primary key in place is one where the two orders
	// disagree.
	it('orders by sequence even when the identifiers order the other way', () => {
		const record: SealedRunRecord = {
			...cleanRecord,
			findings: [],
			observations: [
				inertObservation('obs-a', 2),
				inertObservation('obs-b', 1),
			],
		}

		expect(
			ingest(record, cleanManifest, configuration).observations.map(
				(each) => each.observationId,
			),
		).toEqual(['obs-b', 'obs-a'])
	})

	// The product's three arrays are copies. A stage that sorted its caller's
	// record in place, or handed back an array a consumer could `push` into,
	// would be indistinguishable from this one without these assertions.
	it('copies rather than aliases, and leaves the record it was given untouched', () => {
		const record: SealedRunRecord = {
			...cleanRecord,
			observations: [
				inertObservation('obs-z', 2),
				inertObservation('obs-a', 1),
			],
			findings: [],
		}
		const presentedOrder = record.observations.map((each) => each.observationId)

		const result = ingest(record, cleanManifest, configuration)

		expect(record.observations.map((each) => each.observationId)).toEqual(
			presentedOrder,
		)
		expect(result.observations).not.toBe(record.observations)
		expect(result.findings).not.toBe(record.findings)
		expect(result.dispositions).not.toBe(record.oracleDispositions)
	})

	// The identifier sort is total on any record that does not repeat one, and a
	// record that does says so. Both halves in one case: the repeat is reported
	// per subject with its count, and the pair it makes unaddressable is the only
	// thing left whose product order follows presentation.
	it('reports an identifier the record uses twice, per subject', () => {
		const [defect] = cleanRecord.findings
		const [held] = cleanRecord.oracleDispositions
		if (defect === undefined || held === undefined) throw new Error('fixture')
		const record: SealedRunRecord = {
			...cleanRecord,
			findings: [defect, { ...defect, summary: 'a second finding, same id' }],
			oracleDispositions: [held, { ...held, note: 'a second disposition' }],
		}

		expect(
			conditionsOf(
				ingest(record, cleanManifest, configuration).conditions,
				'duplicate-record-identifier',
			),
		).toEqual([
			{
				kind: 'duplicate-record-identifier',
				subject: 'finding',
				identifier: 'F-001',
				occurrences: 2,
			},
			{
				kind: 'duplicate-record-identifier',
				subject: 'oracle-disposition',
				identifier: 'O-001',
				occurrences: 2,
			},
		])
		expect(LADDER_TARGETS['duplicate-record-identifier']).toBe(
			'duplicateRecordIdentifiers',
		)
	})

	// Two repeated identifiers in one subject, presented out of order, so the
	// conditions carry their own order rather than the array's.
	it('orders repeated identifiers by identifier, not by where they appear', () => {
		const [defect, confirmation] = cleanRecord.findings
		if (defect === undefined || confirmation === undefined)
			throw new Error('fixture')
		const record: SealedRunRecord = {
			...cleanRecord,
			findings: [
				confirmation,
				{ ...confirmation, summary: 'the second F-002' },
				defect,
				{ ...defect, summary: 'the second F-001' },
			],
		}

		expect(
			conditionsOf(
				ingest(record, cleanManifest, configuration).conditions,
				'duplicate-record-identifier',
			).map((condition) => condition.identifier),
		).toEqual(['F-001', 'F-002'])
	})

	// The repeat with teeth. A `Map` keyed on `observationId` is last-write-wins,
	// so which body a quotation is checked against follows presentation order,
	// and whether a defect finding's evidence is witnessed changes with it. Both
	// permutations must report the ambiguity rather than answering differently.
	it('reports a repeated observation identifier, whichever way it is presented', () => {
		const carrying = (body: unknown, sequence: number): Observation => ({
			...inertObservation('obs-dup', sequence),
			responseBody: body as Observation['responseBody'],
		})
		const withNeedle = carrying({ note: 'needle' }, 1)
		const without = carrying({ note: 'nothing' }, 2)
		const finding = quotingFinding('F-100', 'obs-dup', [
			{ quote: 'needle', channel: 'response-body' },
		])

		for (const observations of [
			[withNeedle, without],
			[without, withNeedle],
		]) {
			const record = SealedRunRecord.parse({
				...cleanRecord,
				observations,
				findings: [finding],
			})

			expect(
				conditionsOf(
					ingest(record, cleanManifest, configuration).conditions,
					'duplicate-record-identifier',
				),
			).toEqual([
				{
					kind: 'duplicate-record-identifier',
					subject: 'observation',
					identifier: 'obs-dup',
					occurrences: 2,
				},
			])
		}
	})

	// `occurrences` is a count and not a flag, so the case that holds it in place
	// is one where the identifier appears more than twice.
	it('counts every occurrence of a repeated identifier', () => {
		const [defect] = cleanRecord.findings
		if (defect === undefined) throw new Error('fixture')
		const record: SealedRunRecord = {
			...cleanRecord,
			findings: [
				defect,
				{ ...defect, summary: 'the second F-001' },
				{ ...defect, summary: 'the third F-001' },
			],
		}

		expect(
			conditionsOf(
				ingest(record, cleanManifest, configuration).conditions,
				'duplicate-record-identifier',
			).map((condition) => condition.occurrences),
		).toEqual([3])
	})

	// The condition sorts segment by segment, which is what the joined key's
	// separator buys: `F-001` precedes `F-0011` because the first segment ends,
	// and a separator above the identifier charset would order them the other
	// way. Both identifiers are legal under `^F-[0-9]{3,}$`.
	it('orders a prefix identifier before the one that extends it', () => {
		const record: SealedRunRecord = {
			...cleanRecord,
			findings: [
				citingFinding('F-0011', ['obs-aaa']),
				citingFinding('F-001', ['obs-zzz']),
			],
		}

		expect(
			conditionsOf(
				ingest(record, cleanManifest, configuration).conditions,
				'dangling-citation',
			).map((condition) => condition.findingId),
		).toEqual(['F-001', 'F-0011'])
	})

	// A record that addresses each entry once says nothing, which is what makes
	// the condition above a report of a defect rather than noise on every run.
	it('says nothing about identifiers a well-formed record uses once', () => {
		expect(
			conditionsOf(
				ingest(cleanRecord, cleanManifest, configuration).conditions,
				'duplicate-record-identifier',
			),
		).toEqual([])
	})

	// Neither `findings` nor `oracleDispositions` declares an order, so the
	// product carries its own rather than the record's array position. Presented
	// reversed, since the fixture already lists both in identifier order.
	it('exposes findings and dispositions in identifier order, not the presented one', () => {
		const record: SealedRunRecord = {
			...cleanRecord,
			findings: [...cleanRecord.findings].reverse(),
			oracleDispositions: [...cleanRecord.oracleDispositions].reverse(),
		}

		const result = ingest(record, cleanManifest, configuration)

		expect(result.findings.map((each) => each.findingId)).toEqual([
			'F-001',
			'F-002',
			'F-003',
		])
		expect(result.dispositions.map((each) => each.oracleId)).toEqual([
			'O-001',
			'O-002',
			'O-003',
		])
	})

	// Matrix row 2.
	it('names every unresolved identifier a finding cited', () => {
		const record: SealedRunRecord = {
			...cleanRecord,
			findings: cleanRecord.findings.map((finding) =>
				finding.findingId === 'F-002'
					? { ...finding, observationIds: ['obs-001', 'obs-777', 'obs-888'] }
					: finding,
			),
		}

		const dangling = conditionsOf(
			ingest(record, cleanManifest, configuration).conditions,
			'dangling-citation',
		)

		expect(dangling).toEqual([
			{
				kind: 'dangling-citation',
				findingId: 'F-002',
				unresolvedObservationIds: ['obs-777', 'obs-888'],
			},
		])
		expect(LADDER_TARGETS['dangling-citation']).toBe('danglingCitations')
	})

	// One bad citation, cited twice, is one bad citation. The payload is what a
	// consumer renders, so the repeat is collapsed rather than passed through.
	it('names a repeated unresolved identifier once', () => {
		const record: SealedRunRecord = {
			...cleanRecord,
			findings: [citingFinding('F-100', ['obs-777', 'obs-001', 'obs-777'])],
		}

		expect(
			conditionsOf(
				ingest(record, cleanManifest, configuration).conditions,
				'dangling-citation',
			),
		).toEqual([
			{
				kind: 'dangling-citation',
				findingId: 'F-100',
				unresolvedObservationIds: ['obs-777'],
			},
		])
	})

	// `findings` carries no uniqueness refinement, so two findings may share an
	// identifier. The exposed order has to be a function of the entries and not
	// of the order the record happened to list them in.
	it('orders dangling citations identically however the findings are presented', () => {
		const first = citingFinding('F-100', ['obs-777'])
		const second = citingFinding('F-100', ['obs-111'])
		const third = citingFinding('F-200', ['obs-333'])
		const expected = [
			{
				kind: 'dangling-citation',
				findingId: 'F-100',
				unresolvedObservationIds: ['obs-111'],
			},
			{
				kind: 'dangling-citation',
				findingId: 'F-100',
				unresolvedObservationIds: ['obs-777'],
			},
			{
				kind: 'dangling-citation',
				findingId: 'F-200',
				unresolvedObservationIds: ['obs-333'],
			},
		]

		for (const findings of [
			[first, second, third],
			[third, second, first],
			[second, third, first],
		]) {
			expect(
				conditionsOf(
					ingest({ ...cleanRecord, findings }, cleanManifest, configuration)
						.conditions,
					'dangling-citation',
				),
			).toEqual(expected)
		}
	})

	// The record's second citation site, and the rule that a repeated citation is
	// one bad citation holds on it too.
	it('names a disposition citation that resolves to nothing, once', () => {
		const record: SealedRunRecord = {
			...cleanRecord,
			oracleDispositions: cleanRecord.oracleDispositions.map((disposition) =>
				disposition.oracleId === 'O-002'
					? {
							...disposition,
							observationIds: ['obs-999', 'obs-001', 'obs-999'],
						}
					: disposition,
			),
		}

		expect(
			conditionsOf(
				ingest(record, cleanManifest, configuration).conditions,
				'dangling-disposition-citation',
			),
		).toEqual([
			{
				kind: 'dangling-disposition-citation',
				oracleId: 'O-002',
				unresolvedObservationIds: ['obs-999'],
			},
		])
		expect(LADDER_TARGETS['dangling-disposition-citation']).toBe(
			'danglingDispositionCitations',
		)
	})

	// Two findings that are equal as far as this condition can see produce two
	// equal entries, and the comparator has to say so rather than ordering them
	// against each other.
	it('keeps both entries when two findings dangle identically', () => {
		const record: SealedRunRecord = {
			...cleanRecord,
			findings: [
				citingFinding('F-100', ['obs-777']),
				citingFinding('F-100', ['obs-777']),
			],
		}

		expect(
			conditionsOf(
				ingest(record, cleanManifest, configuration).conditions,
				'dangling-citation',
			),
		).toEqual([
			{
				kind: 'dangling-citation',
				findingId: 'F-100',
				unresolvedObservationIds: ['obs-777'],
			},
			{
				kind: 'dangling-citation',
				findingId: 'F-100',
				unresolvedObservationIds: ['obs-777'],
			},
		])
	})

	// Matrix row 3.
	it("carries the quotation audit's own array, unchanged, onto the condition and the product", () => {
		const record = withQuotes(
			cleanRecord,
			sealedRunRecordFixture.findings.flatMap((finding) =>
				finding.findingType === 'defect' ? finding.quotedEvidence : [],
			),
		)
		const result = ingest(record, cleanManifest, configuration)
		const unwitnessed = conditionsOf(result.conditions, 'unwitnessed-quotation')

		expect(unwitnessed).toHaveLength(1)
		expect(unwitnessed[0]?.quotations).toBe(result.unwitnessedQuotations)
		expect(result.unwitnessedQuotations).toEqual([
			{
				findingId: 'F-001',
				quoteIndex: 0,
				channel: 'response-body',
				quote: '{"ok":true,"note":{"title":"Revised"}}',
				citedObservationIds: ['obs-003', 'obs-004'],
			},
		])
		expect(LADDER_TARGETS['unwitnessed-quotation']).toBe(
			'unwitnessedQuotations',
		)
	})

	// Matrix row 4. Both halves of the rule in one case: the isolation family
	// collapses to the absent condition, and every record-internal check still
	// runs, so a manifest-less and internally inconsistent run reports both.
	it('records an absent manifest and still runs every record-internal check', () => {
		const record: SealedRunRecord = declaring({
			...sealedRunRecordFixture,
			findings: sealedRunRecordFixture.findings.map((finding) =>
				finding.findingId === 'F-003'
					? { ...finding, observationIds: ['obs-404'] }
					: finding,
			),
		})

		const result = ingest(record, null, configuration)

		expect(kindsOf(result.conditions)).toEqual([
			'dangling-citation',
			'unwitnessed-quotation',
			'isolation-manifest-absent',
			'judge-result-unscored',
		])
		expect(result.isolationViolation).toEqual(['isolation manifest absent'])
		expect(LADDER_TARGETS['isolation-manifest-absent']).toBe(
			'isolationViolation',
		)
	})

	// Matrix row 5, and the acceptance case that counts payload items rather
	// than conditions: three allowlists each exceeded once, one admitted
	// forbidden input, and a declared violation is two conditions naming five
	// items between them.
	it('names the declared violation and every out-of-allowlist value', () => {
		const manifest: IsolationManifest = {
			...honestManifest,
			observedMounts: ['/workspace', '/secrets'],
			observedNetworkTargets: ['fixture-host', 'exfil-host'],
			observedToolCalls: ['http', 'shell'],
			violation: 'the harness reported a mount it did not allow',
		}

		const result = ingest(cleanRecord, manifest, configuration)

		expect(result.conditions).toEqual([
			{
				kind: 'isolation-manifest-violation',
				violation: 'the harness reported a mount it did not allow',
				mountsOutsideAllowlist: ['/secrets'],
				networkTargetsOutsideAllowlist: ['exfil-host'],
				toolCallsOutsideAllowlist: ['shell'],
			},
			{
				kind: 'forbidden-input-not-withheld',
				inputs: ['human-labels'],
			},
		])
		expect(result.isolationViolation).toEqual([
			'manifest violation: the harness reported a mount it did not allow',
			'mount outside allowlist: /secrets',
			'network target outside allowlist: exfil-host',
			'tool call outside allowlist: shell',
		])
		expect(LADDER_TARGETS['isolation-manifest-violation']).toBe(
			'isolationViolation',
		)
	})

	// The same row with no allowlist exceeded. A declared violation on its own
	// is the half of AD-16 no schema shape stands behind, which is why the stage
	// owns it, and it is the half a single-disjunct guard would drop.
	it('records a declared violation even when every allowlist is respected', () => {
		const manifest: IsolationManifest = {
			...cleanManifest,
			violation: 'the harness reported an escape',
		}

		const result = ingest(cleanRecord, manifest, configuration)

		expect(result.conditions).toEqual([
			{
				kind: 'isolation-manifest-violation',
				violation: 'the harness reported an escape',
				mountsOutsideAllowlist: [],
				networkTargetsOutsideAllowlist: [],
				toolCallsOutsideAllowlist: [],
			},
		])
		expect(result.isolationViolation).toEqual([
			'manifest violation: the harness reported an escape',
		])
	})

	// The same row with no declared violation: an exceeded allowlist alone is
	// the violating case AD-16 has this stage record.
	it('records an exceeded allowlist even when the manifest declares no violation', () => {
		const manifest: IsolationManifest = {
			...cleanManifest,
			observedMounts: ['/workspace', '/secrets', '/keys'],
		}

		const result = ingest(cleanRecord, manifest, configuration)

		expect(result.conditions).toEqual([
			{
				kind: 'isolation-manifest-violation',
				violation: null,
				mountsOutsideAllowlist: ['/secrets', '/keys'],
				networkTargetsOutsideAllowlist: [],
				toolCallsOutsideAllowlist: [],
			},
		])
		expect(result.isolationViolation).toEqual([
			'mount outside allowlist: /secrets',
			'mount outside allowlist: /keys',
		])
	})

	// The third site of the same rule: a value observed twice outside its
	// allowlist is one value outside its allowlist, which is what "one entry per
	// offending value" asks for on the rendered list as well as the payload.
	it('names a value observed twice outside its allowlist once', () => {
		const manifest: IsolationManifest = {
			...cleanManifest,
			observedMounts: ['/workspace', '/secrets', '/secrets'],
		}

		const result = ingest(cleanRecord, manifest, configuration)

		expect(
			conditionsOf(result.conditions, 'isolation-manifest-violation'),
		).toEqual([
			{
				kind: 'isolation-manifest-violation',
				violation: null,
				mountsOutsideAllowlist: ['/secrets'],
				networkTargetsOutsideAllowlist: [],
				toolCallsOutsideAllowlist: [],
			},
		])
		expect(result.isolationViolation).toEqual([
			'mount outside allowlist: /secrets',
		])
	})

	// Matrix row 6. The manifest's own key order is the caller's, so the case
	// presents the accounting reversed and expects the floor's order back.
	it('names each admitted forbidden input in floor order', () => {
		const admitted = { withheld: false, note: null }
		const manifest: IsolationManifest = {
			...cleanManifest,
			forbiddenInputAccounting: {
				'human-labels': { withheld: true, note: null },
				'comparator-results': { withheld: true, note: null },
				'implementation-logs': { withheld: true, note: null },
				'builder-transcript': { withheld: true, note: null },
				repository: { withheld: true, note: null },
				'source-code': { withheld: false, note: 'the repository was mounted' },
				'original-spec': admitted,
			},
		}

		expect(ingest(cleanRecord, manifest, configuration).conditions).toEqual([
			{
				kind: 'forbidden-input-not-withheld',
				inputs: ['original-spec', 'source-code'],
			},
		])
		expect(LADDER_TARGETS['forbidden-input-not-withheld']).toBe(
			'forbiddenInputsNotWithheld',
		)
	})

	// Matrix row 7. One condition per field, each carrying both values, so a
	// consumer never re-reads either artifact to learn what disagreed.
	it('reports each field the record and the manifest disagree on', () => {
		const manifest: IsolationManifest = {
			...cleanManifest,
			runId: 'some-other-run',
			contractDigest: `sha256:${'a'.repeat(64)}`,
			evaluatorConfigurationDigest: `sha256:${'b'.repeat(64)}`,
			conditionArm: 'a different arm entirely',
		}

		expect(ingest(cleanRecord, manifest, configuration).conditions).toEqual([
			{
				kind: 'cross-artifact-disagreement',
				field: 'runId',
				recordValue: 'spike-run-0001',
				manifestValue: 'some-other-run',
			},
			{
				kind: 'cross-artifact-disagreement',
				field: 'contractDigest',
				recordValue: cleanRecord.contractDigest,
				manifestValue: `sha256:${'a'.repeat(64)}`,
			},
			{
				kind: 'cross-artifact-disagreement',
				field: 'evaluatorConfigurationDigest',
				recordValue: cleanRecord.evaluatorConfigurationDigest,
				manifestValue: `sha256:${'b'.repeat(64)}`,
			},
		])
		expect(LADDER_TARGETS['cross-artifact-disagreement']).toBe(
			'crossArtifactDisagreements',
		)
	})

	// AD-24 and AD-11: the one scoring-version input this stage recomputes. The
	// shipped fixtures declare a placeholder digest, so the record they ship
	// with is itself the failing case.
	it('recomputes the evaluator configuration digest and reports a mismatch', () => {
		const record: SealedRunRecord = {
			...cleanRecord,
			evaluatorConfigurationDigest:
				sealedRunRecordFixture.evaluatorConfigurationDigest,
		}
		const manifest: IsolationManifest = {
			...cleanManifest,
			evaluatorConfigurationDigest:
				sealedRunRecordFixture.evaluatorConfigurationDigest,
		}

		expect(ingest(record, manifest, configuration).conditions).toEqual([
			{
				kind: 'evaluator-configuration-digest-mismatch',
				declaredDigest: sealedRunRecordFixture.evaluatorConfigurationDigest,
				computedDigest: CONFIGURATION_DIGEST,
			},
		])
		expect(LADDER_TARGETS['evaluator-configuration-digest-mismatch']).toBe(
			'evaluatorConfigurationDigestMismatches',
		)
	})

	// The record's declaration is the operand. Two artifacts agreeing on a
	// digest neither of them computed is the substitution AD-32 calls the trust
	// boundary, and it fires here with no cross-artifact disagreement beside it.
	it('reports the mismatch even when the two artifacts agree with each other', () => {
		const record: SealedRunRecord = {
			...cleanRecord,
			evaluatorConfigurationDigest: `sha256:${'c'.repeat(64)}`,
		}
		const manifest: IsolationManifest = {
			...cleanManifest,
			evaluatorConfigurationDigest: `sha256:${'c'.repeat(64)}`,
		}

		expect(kindsOf(ingest(record, manifest, configuration).conditions)).toEqual(
			['evaluator-configuration-digest-mismatch'],
		)
	})

	// AD-24's other clause. Absent is a shape no schema can describe, so it is
	// this stage's, exactly as an absent manifest is; incomplete is a schema
	// rejection raised before the stage sees anything.
	it('records an absent evaluator configuration and skips the recomputation', () => {
		const result = ingest(cleanRecord, cleanManifest, null)

		expect(result.conditions).toEqual([
			{ kind: 'evaluator-configuration-absent' },
		])
		expect(LADDER_TARGETS['evaluator-configuration-absent']).toBe(
			'evaluatorConfigurationAbsent',
		)
	})

	// Matrix row 8.
	it('records every unscored judge result by rubric and criterion', () => {
		const record: SealedRunRecord = {
			...cleanRecord,
			judgeResults: [
				{ rubricId: 'R-001', criterionId: 'RC-002', score: null, note: null },
				{ rubricId: 'R-001', criterionId: 'RC-003', score: null, note: null },
				{ rubricId: 'R-001', criterionId: 'RC-001', score: 4, note: null },
				{ rubricId: 'R-001', criterionId: 'RC-000', score: null, note: null },
			],
		}

		expect(ingest(record, cleanManifest, configuration).conditions).toEqual([
			{
				kind: 'judge-result-unscored',
				rubricId: 'R-001',
				criterionId: 'RC-000',
			},
			{
				kind: 'judge-result-unscored',
				rubricId: 'R-001',
				criterionId: 'RC-002',
			},
			{
				kind: 'judge-result-unscored',
				rubricId: 'R-001',
				criterionId: 'RC-003',
			},
		])
		expect(LADDER_TARGETS['judge-result-unscored']).toBe('judgeResultsUnscored')
	})

	// The rubric is the primary key and the criterion only breaks its ties, so
	// the case that holds the rubric in place is one where the two orders
	// disagree.
	it('orders unscored judge results by rubric before criterion', () => {
		const record: SealedRunRecord = {
			...cleanRecord,
			judgeResults: [
				{ rubricId: 'R-002', criterionId: 'RC-001', score: null, note: null },
				{ rubricId: 'R-001', criterionId: 'RC-002', score: null, note: null },
			],
		}

		expect(
			ingest(record, cleanManifest, configuration).conditions.map(
				(condition) =>
					condition.kind === 'judge-result-unscored'
						? `${condition.rubricId}/${condition.criterionId}`
						: condition.kind,
			),
		).toEqual(['R-001/RC-002', 'R-002/RC-001'])
	})

	// `judgeResults` carries no uniqueness refinement either, so one criterion
	// may be reported unscored twice. The pair is what addresses the result, so
	// the two collapse to one condition a basis line can act on, and the output
	// stays a function of the entries rather than of the order they were listed
	// in.
	it('records one condition per criterion however the results are presented', () => {
		const unscored = (
			rubricId: string,
			criterionId: string,
			note: string,
		): SealedRunRecord['judgeResults'][number] => ({
			rubricId,
			criterionId,
			score: null,
			note,
		})

		for (const judgeResults of [
			[
				unscored('R-002', 'RC-001', 'first'),
				unscored('R-001', 'RC-001', 'second'),
				unscored('R-001', 'RC-001', 'third'),
			],
			[
				unscored('R-001', 'RC-001', 'third'),
				unscored('R-002', 'RC-001', 'first'),
				unscored('R-001', 'RC-001', 'second'),
			],
		]) {
			expect(
				conditionsOf(
					ingest({ ...cleanRecord, judgeResults }, cleanManifest, configuration)
						.conditions,
					'judge-result-unscored',
				).map((condition) => `${condition.rubricId}/${condition.criterionId}`),
			).toEqual(['R-001/RC-001', 'R-002/RC-001'])
		}
	})

	// Matrix row 9. Emptying the observations also leaves the defect finding's
	// quotes unwitnessable, so the full condition list is asserted rather than
	// only the dangling family: a case that filtered would not notice the
	// isolation family firing here.
	it('reports one dangling citation per citing finding when the record declares no observations', () => {
		const [defect, confirmation, observation] = sealedRunRecordFixture.findings
		const record: SealedRunRecord = {
			...cleanRecord,
			observations: [],
			// Deliberately not in identifier order: the exposed order is the
			// stage's own, never the array's.
			findings: [confirmation, observation, defect].flatMap((finding) =>
				finding === undefined ? [] : [finding],
			),
		}

		const result = ingest(record, cleanManifest, configuration)

		expect(result.observations).toEqual([])
		expect(kindsOf(result.conditions)).toEqual([
			'dangling-citation',
			'dangling-citation',
			'dangling-citation',
			'dangling-disposition-citation',
			'dangling-disposition-citation',
			'unwitnessed-quotation',
		])
		expect(conditionsOf(result.conditions, 'dangling-citation')).toEqual([
			{
				kind: 'dangling-citation',
				findingId: 'F-001',
				unresolvedObservationIds: ['obs-003', 'obs-004'],
			},
			{
				kind: 'dangling-citation',
				findingId: 'F-002',
				unresolvedObservationIds: ['obs-001', 'obs-003'],
			},
			{
				kind: 'dangling-citation',
				findingId: 'F-003',
				unresolvedObservationIds: ['obs-005'],
			},
		])
	})

	// Matrix row 10. The fault is `core/canonical`'s, raised through
	// `auditQuotation` when a quoted channel is one of the three that reach
	// RFC 8785 serialization. Canonicalization, not projection, is what makes it
	// reachable: `projectChannel` handles all seven channels and only three
	// serialize. Each record is parsed rather than asserted into shape, so a
	// later tightening of `z.number()` or `z.string()` fails this case instead
	// of leaving it green over an unreachable path.
	it('lets a canonicalization fault propagate out of the quotation audit', () => {
		const carrying = (
			observation: Observation,
			channel: DefectFinding['quotedEvidence'][number]['channel'],
		): SealedRunRecord =>
			SealedRunRecord.parse({
				...cleanRecord,
				observations: [observation],
				findings: [
					quotingFinding('F-001', observation.observationId, [
						{ quote: 'total', channel },
					]),
				],
			})

		const records = [
			carrying(
				{ ...inertObservation('obs-100', 1), responseBody: { total: 2 ** 53 } },
				'response-body',
			),
			carrying(
				{
					...inertObservation('obs-101', 1),
					// U+D800, a high surrogate with no low surrogate after it.
					responseHeaders: { total: '\uD800' },
				},
				'response-headers',
			),
			carrying(
				{
					...inertObservation('obs-102', 1),
					callInputs: {
						path: null,
						query: null,
						header: null,
						body: { total: 2 ** 53 },
					},
				},
				'call-inputs',
			),
		]

		for (const record of records) {
			let thrown: unknown
			try {
				ingest(record, cleanManifest, configuration)
			} catch (error) {
				thrown = error
			}
			expect(thrown).toBeInstanceOf(RuntimeFault)
			expect((thrown as RuntimeFault).code).toBe('non-canonicalizable-value')
		}
	})

	// The same fault, reached through the digest recomputation rather than the
	// quotation audit. `decodingParameters` is caller-keyed JSON inside AD-36's
	// value domain, which is what makes the second call site reachable.
	it('lets a canonicalization fault propagate out of the digest recomputation', () => {
		let thrown: unknown
		try {
			ingest(cleanRecord, cleanManifest, {
				...configuration,
				decodingParameters: { temperature: 2 ** 53 },
			})
		} catch (error) {
			thrown = error
		}

		expect(thrown).toBeInstanceOf(RuntimeFault)
		expect((thrown as RuntimeFault).code).toBe('non-canonicalizable-value')
	})

	// Story 8.2 gave every condition kind a rung, so a condition that used to
	// be rungless still reaches the product, and the mapping now names a real
	// `EvidenceIntegrityInputs` field for it rather than `null`.
	it('exposes every condition on the product with a real, non-null target', () => {
		const record: SealedRunRecord = {
			...cleanRecord,
			evaluatorConfigurationDigest: `sha256:${'d'.repeat(64)}`,
			findings: cleanRecord.findings.map((finding) =>
				finding.findingId === 'F-003'
					? { ...finding, observationIds: ['obs-404'] }
					: finding,
			),
			judgeResults: [
				{ rubricId: 'R-001', criterionId: 'RC-001', score: null, note: null },
			],
		}
		const manifest: IsolationManifest = {
			...isolationManifestFixture,
			runId: 'some-other-run',
		}

		const result = ingest(record, manifest, configuration)
		const kinds = kindsOf(result.conditions)

		expect(kinds).toEqual([
			'dangling-citation',
			'forbidden-input-not-withheld',
			'cross-artifact-disagreement',
			'cross-artifact-disagreement',
			'evaluator-configuration-digest-mismatch',
			'judge-result-unscored',
		])
		expect(
			kinds.every((kind) => typeof LADDER_TARGETS[kind] === 'string'),
		).toBe(true)
	})

	// A caller has to be able to tell an invalid run from a crashed one, so
	// every condition above is data and only the canonicalization fault throws.
	it('throws on nothing else, however much fired at once', () => {
		const record: SealedRunRecord = {
			...sealedRunRecordFixture,
			findings: sealedRunRecordFixture.findings.map((finding) => ({
				...finding,
				observationIds: ['obs-404'],
			})),
		}
		const manifest: IsolationManifest = {
			...isolationManifestFixture,
			runId: 'some-other-run',
			observedToolCalls: ['http', 'shell'],
			violation: 'everything at once',
		}

		expect(() => ingest(record, manifest, configuration)).not.toThrow()
		expect(kindsOf(ingest(record, manifest, configuration).conditions)).toEqual(
			[
				'dangling-citation',
				'dangling-citation',
				'dangling-citation',
				'unwitnessed-quotation',
				'isolation-manifest-violation',
				'forbidden-input-not-withheld',
				'cross-artifact-disagreement',
				'evaluator-configuration-digest-mismatch',
				'judge-result-unscored',
			],
		)
	})

	// The audit's own result reaches the product unchanged, which is what lets
	// the next stage bind `OutcomeStateInputs.unwitnessedQuotations` directly.
	it('derives the quotation audit once and exposes the same array', () => {
		const record = withQuotes(
			cleanRecord,
			sealedRunRecordFixture.findings.flatMap((finding) =>
				finding.findingType === 'defect' ? finding.quotedEvidence : [],
			),
		)

		expect(
			ingest(record, cleanManifest, configuration).unwitnessedQuotations,
		).toEqual(auditQuotation(record))
	})
})
