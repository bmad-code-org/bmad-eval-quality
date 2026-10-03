/**
 * The one orchestration call over the `aggregate` stage (AD-24): parse the
 * per-probe evidence artifacts, the declared floors and the scoring policy,
 * read the evidence and scoring policy schema versions, and hand the parsed values to the pure stage. No decision
 * logic lives here (AD-14): every branch is a parse, a version comparison, or
 * the call.
 *
 * Synchronous: the stage awaits no port, so neither does this.
 */
import { aggregateStrength as aggregateStage } from '../core/aggregate/aggregate-strength.ts'
import { checkSchemaVersion } from '../core/compile/schema-version.ts'
import {
	EVIDENCE_ARTIFACT_SCHEMA_VERSION,
	EvidenceArtifact,
} from '../core/schemas/evidence-artifact.ts'
import { RuntimeFault } from '../core/schemas/faults.ts'
import {
	SCORING_POLICY_SCHEMA_VERSION,
	ScoringPolicy,
} from '../core/schemas/scoring-policy.ts'
import {
	type StrengthAggregate,
	StrengthFloors,
} from '../core/schemas/strength-aggregate.ts'
import {
	checkArtifactVersion,
	SCORING_POLICY_CONSEQUENCE,
} from './artifact-stamp.ts'

export type AggregateStrengthOptions = {
	/**
	 * Every per-probe evidence artifact of the run, in any order: the aggregate
	 * sorts what it records, so the order never reaches the bytes.
	 */
	readonly evidence: readonly EvidenceArtifact[]
	/** The adopter's declared floor per class; a class with no key declares none. */
	readonly floors: StrengthFloors
	/**
	 * The scoring policy the run was scored under. Every evidence artifact is
	 * verified against it, and the aggregate takes its minimum trial count from it.
	 */
	readonly policy: ScoringPolicy
}

function parseFault(artifactPath: string, cause: unknown): RuntimeFault {
	return new RuntimeFault(
		'schema-parse-failure',
		artifactPath,
		`input does not conform to the ${artifactPath} schema`,
		{ cause },
	)
}

/**
 * AD-11's version equality, first and before the strict parse. An artifact
 * stamped for another version rarely parses under this one's shape, and
 * `schema-parse-failure` names none of that: the stamp is read off the raw
 * value so the fault says which version this build reads. A value with no
 * numeric stamp is left to the parse, which names the missing field.
 */
function checkEvidenceVersions(input: readonly unknown[]): void {
	for (const [index, candidate] of input.entries()) {
		const stamped = (candidate as { schemaVersion?: unknown } | null)
			?.schemaVersion
		if (typeof stamped !== 'number') continue
		checkSchemaVersion({
			stamped,
			accepted: EVIDENCE_ARTIFACT_SCHEMA_VERSION,
			artifactPath: `EvidenceArtifact[${index}].schemaVersion`,
			consequence:
				'a class rate over a stale evidence artifact would rest on a reduction this build does not define',
		})
	}
}

function parseEvidence(
	input: readonly EvidenceArtifact[],
): readonly EvidenceArtifact[] {
	if (Array.isArray(input)) checkEvidenceVersions(input)
	const parsed = EvidenceArtifact.array().min(1).safeParse(input)
	if (!parsed.success) throw parseFault('EvidenceArtifact[]', parsed.error)
	return parsed.data
}

function parsePolicy(input: ScoringPolicy): ScoringPolicy {
	checkArtifactVersion(input, {
		accepted: SCORING_POLICY_SCHEMA_VERSION,
		artifactPath: 'ScoringPolicy.schemaVersion',
		consequence: SCORING_POLICY_CONSEQUENCE,
	})
	const parsed = ScoringPolicy.safeParse(input)
	if (!parsed.success) throw parseFault('ScoringPolicy', parsed.error)
	return parsed.data
}

function parseFloors(input: StrengthFloors): StrengthFloors {
	// `JSON.parse` makes `__proto__` an own key, and a schema that reads only
	// the keys it names would drop it, leaving the floor it carried undeclared.
	// A floor is never silently undeclared.
	if (
		typeof input === 'object' &&
		input !== null &&
		Object.hasOwn(input, '__proto__')
	) {
		throw parseFault(
			'StrengthFloors',
			new Error('"__proto__" is not a class and no floor reads it'),
		)
	}
	const parsed = StrengthFloors.safeParse(input)
	if (!parsed.success) throw parseFault('StrengthFloors', parsed.error)
	return parsed.data
}

/**
 * Reads the per-probe evidence artifacts of one run and mints the run-wide
 * `StrengthAggregate`. Throws `AggregationRefusal` for artifacts that disagree
 * or contradict themselves, `RuntimeFault` for an input that does not parse or carries a
 * stale schema version, and nothing else for a domain input.
 */
export function aggregateStrength(
	options: AggregateStrengthOptions,
): StrengthAggregate {
	return aggregateStage(
		parseEvidence(options.evidence),
		parseFloors(options.floors),
		parsePolicy(options.policy),
	)
}
