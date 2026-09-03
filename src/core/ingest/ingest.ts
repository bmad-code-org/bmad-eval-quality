/**
 * AD-24's ingest stage: three already-parsed artifacts in, the validated
 * observations plus every condition detected out.
 *
 * The organizing rule is the isolation manifest's own `.meta` sentence, "a
 * schema rejection is the correct expression of unparseable and incomplete, so
 * nothing is admitted for their sake, and the violating case is
 * `core/ingest`'s". Bytes that will not parse are the application layer's to
 * reject; bytes that parse and then contradict each other are a finding about
 * the run. So a detected problem is returned as data and nothing here throws.
 *
 * One fault does propagate and is named, from two call sites into the same
 * module. `auditQuotation` canonicalizes the three structured evidence
 * channels, and the evaluator configuration's digest is recomputed by
 * canonicalizing the whole artifact, so an unsafe integer or a lone surrogate in
 * either raises AD-28's `non-canonicalizable-value` out of `core/canonical`. It
 * is neither caught nor re-raised here, which is what lets a caller tell an
 * invalid run from a crashed one.
 *
 * Nothing here re-derives what `resolveOutcome` already decides. Its ten
 * invalidating conditions are per oracle and reach the ladder through
 * `outcome.resolution.invalidatingConditions`; these ten are per record and
 * reach it through `EvidenceIntegrityInputs` and `OutcomeStateInputs`. Two
 * pairs are related rather than identical: `judge-result-unscored` is the
 * derivation `OutcomeInputs.judgeConduct` has never had, and a
 * `dangling-citation` and an `unwitnessed-detection-claim` can both fire on one
 * finding, in which case the basis names both and the rung is the same either
 * way.
 */
import { digestArtifact } from '../canonical/digest.ts'
import { FORBIDDEN_INPUT_FLOOR } from '../schemas/eval-contract.ts'
import type {
	Observation,
	OracleDisposition,
	RunModeValue,
	SealedRunRecord,
} from '../schemas/sealed-run-record.ts'
import {
	auditQuotation,
	type UnwitnessedQuotation,
} from '../score/quotation.ts'
import type { IngestStage } from '../stage-contracts.ts'
import { AGREEMENT_FIELDS, type IngestCondition } from './conditions.ts'

/**
 * `validated-observations`, the internal product AD-24 exempts from
 * publication: a TypeScript type with no Zod schema, no registry entry, and no
 * `schemaVersion`.
 *
 * `unwitnessedQuotations` and `isolationViolation` are derived here rather than
 * left for the next stage to rebuild out of condition entries, because both are
 * shapes the ladder already declares.
 *
 * The three carried arrays are copies and their elements are not: an
 * observation, a finding, or a disposition on this product is the same object
 * the record holds. The stage is pure and mutates nothing, so a caller that also
 * does not mutate the record it passed in sees a stable product; deep-copying
 * every observation to defend against a caller mutating its own input is a cost
 * no consumer in this package asks for. `isolationViolation` is a list where
 * `EvidenceIntegrityInputs` still declares one nullable string: the ladder's own
 * row type says a multi-entry `reasons` "names each affected oracle, gap, or
 * finding separately, matching AD-21's 'the record carries every condition that
 * fired'", so the single-valued field is the shape that is wrong. Collapsing to
 * it here would mean inventing a separator and an ordering rule that the field's
 * widening then deletes.
 */
export type ValidatedObservations = {
	readonly mode: RunModeValue
	/** ascending `sequence`, then `observationId`, so the record's array order is never what a consumer reads. */
	readonly observations: readonly Observation[]
	/** ascending `findingId`; entries sharing one keep their presented order, which is all the record supplies. */
	readonly findings: readonly SealedRunRecord['findings'][number][]
	/** ascending `oracleId`, on the same terms as `findings`. */
	readonly dispositions: readonly OracleDisposition[]
	readonly conditions: readonly IngestCondition[]
	readonly unwitnessedQuotations: readonly UnwitnessedQuotation[]
	/** empty when nothing fired; one entry per offending value, never a joined summary. */
	readonly isolationViolation: readonly string[]
}

/**
 * Observed values with no entry in their allowlist, in the manifest's own array
 * order and each named once. A value observed twice outside its allowlist is one
 * value outside its allowlist; the payload is what a consumer renders, and
 * `isolationViolation` is specified as one entry per offending value.
 */
const outsideAllowlist = (
	observed: readonly string[],
	allowed: readonly string[],
): readonly string[] => {
	const permitted = new Set(allowed)
	return [...new Set(observed)].filter((value) => !permitted.has(value))
}

/** The path AD-27 digests the evaluator configuration under, matching `seal.ts`'s treatment of the contract. */
const EVALUATOR_CONFIGURATION_ARTIFACT_PATH = 'EvaluatorConfiguration'

/**
 * A total order over the two condition families whose source array declares no
 * order of its own. A finding carries no sequence field and a judge result is
 * addressed by its `(rubricId, criterionId)` pair, so reading either in array
 * position would make the recorded conditions depend on a position NFR9 forbids
 * reading; `auditQuotation` sorts its own result for the same reason.
 *
 * Keyed on the whole payload rather than on the identifier alone. `observations`
 * is the only one of the three arrays the record schema refines for uniqueness,
 * so a repeated `findingId` and a repeated `(rubricId, criterionId)` are both
 * representable, and a comparator keyed on the identifier would leave the tied
 * pair ordered by the array position the sort exists to stop reading. Entries
 * that still tie here are equal values, so the order between them cannot be
 * observed.
 *
 * Joined on U+0000 rather than compared position by position. Every identifier
 * in a key is drawn from `IDENTIFIER_SOURCE` or a `X-digits` prefix form, whose
 * lowest code point is U+002D, so the separator sorts below every character a
 * segment can carry and the joined comparison is the element-wise one.
 */
const compareKeys = (
	left: readonly string[],
	right: readonly string[],
): number => {
	const a = left.join('\u0000')
	const b = right.join('\u0000')
	return a < b ? -1 : a > b ? 1 : 0
}

/**
 * The stage. Reads nothing outside its three declared inputs: a rule needing
 * the eval contract, the rubric, or bytes resolved through the corpus port is
 * routed to whoever declares them rather than absorbed here on the strength of
 * being nearby.
 *
 * Two rules read the evaluator configuration and they are separate. AD-32's
 * agreement rule compares the digest the record declares against the one the
 * manifest declares, which is `cross-artifact-disagreement` and never reads the
 * artifact. AD-24 and AD-11 require the digest to be recomputed from the
 * artifact, which is the only one of the three that is not caller-attested and
 * is why the artifact is a declared input at all.
 *
 * AD-24's "absent or incomplete" splits the same way the manifest's does:
 * incomplete is a schema rejection the application boundary already raises, and
 * absent is a shape no schema can describe, so the parameter admits `null`.
 */
export const ingest: IngestStage<ValidatedObservations> = (
	record,
	manifest,
	configuration,
) => {
	const conditions: IngestCondition[] = []

	// A cited identifier matching a declared observation is the cross-artifact
	// rule `observationIds` leaves to this stage. Declared on every finding
	// branch, so the check is too: AD-23's word is "additionally", a floor on
	// `defect` rather than a prohibition on the other two.
	const declared = new Set(
		record.observations.map((observation) => observation.observationId),
	)
	const dangling = record.findings
		.map((finding) => ({
			findingId: finding.findingId,
			// Deduplicated first, in first-citation order: the condition names
			// which identifiers resolved to nothing, and a finding citing one
			// twice has one bad citation to report rather than two.
			unresolvedObservationIds: [...new Set(finding.observationIds)].filter(
				(observationId) => !declared.has(observationId),
			),
		}))
		.filter((entry) => entry.unresolvedObservationIds.length > 0)
		.sort((a, b) =>
			compareKeys(
				[a.findingId, ...a.unresolvedObservationIds],
				[b.findingId, ...b.unresolvedObservationIds],
			),
		)
	for (const entry of dangling) {
		conditions.push({ kind: 'dangling-citation', ...entry })
	}

	// The same rule over the record's second citation site. `resolveOutcome`
	// reads a disposition's `observationIds` only for emptiness, so a `violated`
	// disposition whose one citation names nothing would otherwise be believed,
	// which is the shape AD-33 says invalidates rather than being believed.
	const danglingDispositions = record.oracleDispositions
		.map((disposition) => ({
			oracleId: disposition.oracleId,
			unresolvedObservationIds: [...new Set(disposition.observationIds)].filter(
				(observationId) => !declared.has(observationId),
			),
		}))
		.filter((entry) => entry.unresolvedObservationIds.length > 0)
		.sort((a, b) =>
			compareKeys(
				[a.oracleId, ...a.unresolvedObservationIds],
				[b.oracleId, ...b.unresolvedObservationIds],
			),
		)
	for (const entry of danglingDispositions) {
		conditions.push({ kind: 'dangling-disposition-citation', ...entry })
	}

	// ADR-009 Decision 2's precedence: cited identifiers govern the witness
	// match and quotation audits it. This is that audit's caller.
	const unwitnessedQuotations = auditQuotation(record)
	if (unwitnessedQuotations.length > 0) {
		conditions.push({
			kind: 'unwitnessed-quotation',
			quotations: unwitnessedQuotations,
		})
	}

	const isolationViolation: string[] = []
	if (manifest === null) {
		// AD-16's absent case. The agreement and forbidden-input checks read
		// manifest fields and cannot run; every record-internal check still does,
		// so a run that is both manifest-less and internally inconsistent reports
		// both rather than only the first.
		conditions.push({ kind: 'isolation-manifest-absent' })
		isolationViolation.push('isolation manifest absent')
	} else {
		const mounts = outsideAllowlist(
			manifest.observedMounts,
			manifest.allowedMounts,
		)
		const networkTargets = outsideAllowlist(
			manifest.observedNetworkTargets,
			manifest.networkAllowlist,
		)
		const toolCalls = outsideAllowlist(
			manifest.observedToolCalls,
			manifest.toolAllowlist,
		)
		// One count over the three allowlists. The condition is "some observed
		// value sits outside its allowlist", and asking it as three
		// short-circuiting disjuncts would leave two of them evaluated in one
		// direction only.
		const exceeded = mounts.length + networkTargets.length + toolCalls.length
		if (manifest.violation !== null || exceeded > 0) {
			conditions.push({
				kind: 'isolation-manifest-violation',
				violation: manifest.violation,
				mountsOutsideAllowlist: mounts,
				networkTargetsOutsideAllowlist: networkTargets,
				toolCallsOutsideAllowlist: toolCalls,
			})
			// The declared violation first, then mounts, network targets, and tool
			// calls, each in the manifest's own array order and one entry per
			// offending value.
			if (manifest.violation !== null) {
				isolationViolation.push(`manifest violation: ${manifest.violation}`)
			}
			for (const value of mounts) {
				isolationViolation.push(`mount outside allowlist: ${value}`)
			}
			for (const value of networkTargets) {
				isolationViolation.push(`network target outside allowlist: ${value}`)
			}
			for (const value of toolCalls) {
				isolationViolation.push(`tool call outside allowlist: ${value}`)
			}
		}

		// AD-16's "account for each forbidden input by name". Read off the floor
		// rather than off the manifest's own key order, so the seven are named in
		// the order the list that generates them declares.
		const admitted = FORBIDDEN_INPUT_FLOOR.filter(
			(input) => !manifest.forbiddenInputAccounting[input].withheld,
		)
		if (admitted.length > 0) {
			conditions.push({
				kind: 'forbidden-input-not-withheld',
				inputs: admitted,
			})
		}

		// AD-32's agreement rule. Both artifacts carry all three fields, so the
		// comparison is between them and never against the configuration artifact
		// standing behind the digest.
		for (const field of AGREEMENT_FIELDS) {
			if (record[field] === manifest[field]) continue
			conditions.push({
				kind: 'cross-artifact-disagreement',
				field,
				recordValue: record[field],
				manifestValue: manifest[field],
			})
		}
	}

	// AD-24: "ingest computes its digest from the artifact and invalidates the
	// run when it is absent or incomplete", restated by AD-11 as the one
	// scoring-version input this stage recomputes. The record's declaration is
	// the operand because AD-32 puts the trust boundary there: a caller that
	// declares one configuration and runs another leaves the two declarations
	// agreeing and only the recomputation disagreeing.
	if (configuration === null) {
		conditions.push({ kind: 'evaluator-configuration-absent' })
	} else {
		const computedDigest = digestArtifact(
			configuration,
			EVALUATOR_CONFIGURATION_ARTIFACT_PATH,
		)
		if (computedDigest !== record.evaluatorConfigurationDigest) {
			conditions.push({
				kind: 'evaluator-configuration-digest-mismatch',
				declaredDigest: record.evaluatorConfigurationDigest,
				computedDigest,
			})
		}
	}

	// AD-17's record-decidable half. `null` is the shape AD-6's `judge-error`
	// fires on, which is why the schema must parse it and why this is a condition
	// rather than a parse failure.
	//
	// Deduplicated by the pair that addresses the result: `judgeResults` carries
	// no uniqueness refinement, so one criterion may appear twice, and two
	// byte-identical conditions naming one criterion are one finding a basis line
	// can act on rather than two.
	//
	// The two citation families deduplicate identifiers inside an entry and never
	// the entries themselves, which is the opposite answer to the same shape and
	// is deliberate. A repeated `(rubricId, criterionId)` is one criterion scored
	// twice, so the second entry names nothing new. Two findings sharing a
	// `findingId` are two findings the record cannot address apart, and their
	// citations may differ, so collapsing them would drop a bad citation on the
	// floor.
	const unscored = [
		...new Map(
			record.judgeResults
				.filter((result) => result.score === null)
				.map((result) => [
					`${result.rubricId}/${result.criterionId}`,
					{ rubricId: result.rubricId, criterionId: result.criterionId },
				]),
		).values(),
	].sort((a, b) =>
		compareKeys([a.rubricId, a.criterionId], [b.rubricId, b.criterionId]),
	)
	for (const entry of unscored) {
		conditions.push({ kind: 'judge-result-unscored', ...entry })
	}

	return {
		// Read off the record and restated, never derived, recomputed, or
		// defaulted: AD-21 fixes mode before ingest and there is no fourth
		// parameter for a caller to disagree with it through.
		mode: record.mode,
		// `selectObservations`' own sort, matched exactly so two readers of one
		// record cannot disagree about which observation came first. The
		// identifier tie-break cannot fire on a record that parsed, since
		// `sequence` is refined unique per record; it is kept for comparator
		// identity with the shipped sort rather than because the case is real.
		observations: [...record.observations].sort(
			(a, b) =>
				a.sequence - b.sequence || (a.observationId < b.observationId ? -1 : 1),
		),
		// Sorted for the same reason the conditions are: neither array declares an
		// order, so carrying the record's would make the product depend on a
		// position nothing may read. A repeated identifier is a caller defect the
		// schema admits, and the tied pair keeps its presented order because the
		// record supplies nothing else to separate them by.
		findings: [...record.findings].sort((a, b) =>
			compareKeys([a.findingId], [b.findingId]),
		),
		dispositions: [...record.oracleDispositions].sort((a, b) =>
			compareKeys([a.oracleId], [b.oracleId]),
		),
		conditions,
		unwitnessedQuotations,
		isolationViolation,
	}
}
