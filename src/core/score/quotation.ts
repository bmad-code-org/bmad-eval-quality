/**
 * AD-40's quotation half, kept out of the verdict path on purpose.
 *
 * Every defect finding carries two operands: the identifiers of the
 * observations it relies on, and the verbatim quoted evidence with its channel.
 * Requiring both without ranking them left the disagreement case with three
 * conforming answers, and ADR-009 Decision 2 ranks them: "the match resolves
 * over identifiers alone; quoted evidence that appears in no cited observation
 * invalidates the run as an AD-32 declared-versus-observed inconsistency." So
 * the witness match reads identifiers and this module audits quotation, and no
 * verdict path reads what this module returns.
 *
 * The invalidation itself belongs to ingest, which owns no module yet, so
 * `auditQuotation` ships with no caller by design.
 *
 * Nothing in `src/` compared a quote against an observation before this, so
 * there was no procedure to inherit. Two shipped mechanisms look like
 * candidates and are not: AD-4's containment operator falls through to `false`
 * on an object container rather than serializing it, and the canonical digest
 * returns bytes rather than the string a substring test needs.
 */
import { serialize } from '../canonical/canonicalize.ts'
import type { EvidenceChannelName } from '../schemas/pointer.ts'
import type {
	Observation,
	SealedRunRecord,
} from '../schemas/sealed-run-record.ts'

type DefectFinding = Extract<
	SealedRunRecord['findings'][number],
	{ findingType: 'defect' }
>

type QuotedEvidence = DefectFinding['quotedEvidence'][number]

/**
 * One evidence channel of one observation, rendered as the text a quotation is
 * asked to be a substring of.
 *
 * `stdout` and `stderr` project as themselves; `response-status` and
 * `exit-code` through the ordinary integer rendering; `response-body`,
 * `response-headers`, and `call-inputs` through the same RFC 8785 serialization
 * the digest uses.
 *
 * No case folding and no whitespace normalization: AD-23 requires the evidence
 * verbatim, and a normalizing match would accept a quote the record does not
 * contain. Canonical serialization re-spells a body with sorted keys and no
 * whitespace, so a quote taken from a pretty-printed rendering is not a
 * substring of it. The record stores JSON values and has no pretty-printed form
 * to quote.
 *
 * A `null` channel projects to nothing and witnesses nothing. On
 * `response-body` that also swallows a body that genuinely was JSON `null`,
 * which is the schema's own stated cost of one uniform spelling for "absent".
 *
 * Should canonicalization fault on a caller's record, the fault propagates,
 * which is what keeps this procedure from being circular with it.
 */
export function projectChannel(
	observation: Observation,
	channel: EvidenceChannelName,
	artifactPath: string,
): string | null {
	switch (channel) {
		case 'stdout':
			return observation.stdout
		case 'stderr':
			return observation.stderr
		case 'response-status':
			return observation.responseStatus === null
				? null
				: observation.responseStatus.toString()
		case 'exit-code':
			return observation.exitCode === null
				? null
				: observation.exitCode.toString()
		case 'response-body':
			return observation.responseBody === null
				? null
				: serialize(observation.responseBody, artifactPath)
		case 'response-headers':
			return observation.responseHeaders === null
				? null
				: serialize(observation.responseHeaders, artifactPath)
		case 'call-inputs':
			return serialize(observation.callInputs, artifactPath)
	}
}

/**
 * Whether one quotation appears in one observation's named channel, verbatim.
 */
function quotationWitnessed(
	quoted: QuotedEvidence,
	observation: Observation,
	artifactPath: string,
): boolean {
	const projected = projectChannel(observation, quoted.channel, artifactPath)
	// A null projection witnesses nothing, and `false` is the answer: an
	// optional chain here would hand a caller `undefined` where the return type
	// says boolean.
	if (projected === null) return false
	return projected.includes(quoted.quote)
}

export type UnwitnessedQuotation = {
	readonly findingId: string
	/** the position of the quotation within the finding's own list. */
	readonly quoteIndex: number
	readonly channel: EvidenceChannelName
	readonly quote: string
	/** the observations the finding cited and this audit could read. */
	readonly citedObservationIds: readonly string[]
}

/**
 * Every defect finding's quoted evidence, checked against the observations that
 * finding itself cited.
 *
 * Over every defect finding in the record regardless of which bucket the
 * finding maps to, because AD-40 makes an unwitnessed quote a property of the
 * finding rather than of the probe it maps to. A cited identifier naming no
 * observation in the record contributes nothing to read, which is a separate
 * cross-artifact inconsistency and is not this audit's to report.
 */
export function auditQuotation(
	record: Pick<SealedRunRecord, 'observations' | 'findings'>,
): readonly UnwitnessedQuotation[] {
	const byId = new Map(
		record.observations.map((observation) => [
			observation.observationId,
			observation,
		]),
	)
	const unwitnessed: UnwitnessedQuotation[] = []
	for (const finding of record.findings) {
		if (finding.findingType !== 'defect') continue
		const cited = finding.observationIds
			.map((id) => byId.get(id))
			.filter(
				(observation): observation is Observation => observation !== undefined,
			)
		const artifactPath = `SealedRunRecord.findings[findingId=${finding.findingId}]`
		finding.quotedEvidence.forEach((quoted, quoteIndex) => {
			const witnessed = cited.some((observation) =>
				quotationWitnessed(quoted, observation, artifactPath),
			)
			if (witnessed) return
			unwitnessed.push({
				findingId: finding.findingId,
				quoteIndex,
				channel: quoted.channel,
				quote: quoted.quote,
				citedObservationIds: cited.map(
					(observation) => observation.observationId,
				),
			})
		})
	}
	// `findings` carries no ordering field, so reading it in array order would
	// make the result depend on a position NFR9 forbids reading. Sorted by
	// finding identifier, then by the quotation's index within that finding,
	// which is the one order the record itself declares.
	return unwitnessed.sort(
		(a, b) =>
			(a.findingId < b.findingId ? -1 : a.findingId > b.findingId ? 1 : 0) ||
			a.quoteIndex - b.quoteIndex,
	)
}

export type ReconstructedDetection = {
	/**
	 * AD-40 forbids pooling a detection derived this way with a measured catch
	 * rate, so the label travels with the result and is never optional.
	 */
	readonly basis: 'reconstructed'
	readonly detected: boolean
	readonly witnessObservationIds: readonly string[]
}

/**
 * The containment procedure AD-40 keeps defined for exactly one purpose:
 * re-deriving detection from records written before observation identifiers
 * were required.
 *
 * Nothing in v0 calls it, and nothing can. At least one observation identifier
 * has been required on the defect branch since the schema's first version, so
 * no version of this schema predates the identifier requirement, and AD-11
 * makes a reader reject an unequal version anyway. The procedure exists for
 * records from outside this schema entirely.
 *
 * It takes the satisfying partition the witness match already computed and asks
 * which of those observations the finding's own quotations appear in. Detection
 * so derived is `reconstructed`; the witness match's is `measured`, and the two
 * are never pooled.
 */
export function reconstructDetection(
	finding: { readonly quotedEvidence: readonly QuotedEvidence[] },
	satisfying: readonly Observation[],
	artifactPath: string,
): ReconstructedDetection {
	// A finding quoting nothing proves nothing, which the schema already forbids
	// on this branch; a record from outside it can still present the shape, and
	// an `every` over an empty list would otherwise report every satisfying
	// observation as a witness.
	const witnessObservationIds =
		finding.quotedEvidence.length === 0
			? []
			: satisfying
					.filter((observation) =>
						finding.quotedEvidence.every((quoted) =>
							quotationWitnessed(quoted, observation, artifactPath),
						),
					)
					.map((observation) => observation.observationId)
	return {
		basis: 'reconstructed',
		detected: witnessObservationIds.length > 0,
		witnessObservationIds,
	}
}
