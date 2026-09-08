// Every hand-maintained count over the published schemas, written down once.
//
// These numbers were duplicated across five test files, each carrying a comment
// cross-referencing the others, so a schema change had five places to update in
// lockstep and the risk compounded with every change. They live here now, and
// each file asserts against the constant rather than against its own copy.
//
// They stay pinned integers rather than becoming derived values, which is the
// point of having them at all. A floor cannot catch a narrowed walk: dropping
// `propertyNames` from the occurrence descent silently removes 28 occurrences
// while every other assertion still passes. Pinning is safe because `schemas/`
// is compared byte for byte by `npm run check:schemas`, so a number cannot
// drift without the committed documents being regenerated in the same commit.
//
// When a schema change moves one of these, run the change, read the failure,
// and move the number here. That is one edit, and the failure names which
// number moved.

/** Mutable keyword occurrences per published document (AC 8's census). */
export const CENSUS_BY_DOCUMENT: Readonly<Record<string, number>> = {
	'artifact-reference': 21,
	'eval-contract': 1073,
	'evaluator-configuration': 69,
	'evidence-artifact': 441,
	'isolation-manifest': 141,
	'preflight-verdict': 34,
	'private-artifact-manifest': 31,
	probe: 532,
	rubric: 51,
	'scoring-policy': 35,
	'sealed-evaluator-brief': 102,
	'sealed-run-record': 374,
}

/** The same occurrences counted by keyword instead of by document. */
export const CENSUS_BY_KEYWORD: Readonly<Record<string, number>> = {
	additionalProperties: 277,
	anyOf: 150,
	const: 91,
	enum: 73,
	exclusiveMinimum: 2,
	format: 1,
	items: 152,
	maxItems: 3,
	maximum: 105,
	minItems: 42,
	minLength: 127,
	minProperties: 2,
	minimum: 106,
	oneOf: 21,
	pattern: 184,
	prefixItems: 24,
	propertyNames: 47,
	required: 230,
	type: 1267,
}

/**
 * Each of the three is independently load-bearing: the per-document map catches
 * a document dropping out of the walk, the per-keyword map catches one
 * keyword's descent being removed, and the total catches an arithmetic slip in
 * either.
 */
export const CENSUS_TOTAL = 2904

/** Named `$defs` keys per published document. */
export const DEFS_BY_DOCUMENT: Readonly<Record<string, number>> = {
	'artifact-reference': 0,
	'eval-contract': 7,
	'evaluator-configuration': 1,
	'evidence-artifact': 4,
	'isolation-manifest': 0,
	'preflight-verdict': 0,
	'private-artifact-manifest': 0,
	probe: 7,
	rubric: 0,
	'scoring-policy': 0,
	'sealed-evaluator-brief': 0,
	'sealed-run-record': 5,
}

/**
 * The hand-written reject corpus, by list. `contract` is `REJECT_CASES`, which
 * mutates the eval contract's own accept fixture; `artifact` is
 * `ARTIFACT_REJECT_CASES`, which covers every artifact and carries the eval
 * contract's union-branch cases under their own `seed`.
 */
export const REJECT_CASE_COUNTS = {
	contract: 55,
	artifact: 94,
	total: 149,
} as const

/**
 * The positive corpus, by list, and the number of distinct instances behind
 * them. The ids outnumber the instances because several fixtures appear under
 * more than one name; the distinct count is pinned so a fixture quietly
 * collapsing into an alias of another shows up.
 */
export const ACCEPT_FIXTURE_COUNTS = {
	accepts: 12,
	probeClasses: 4,
	qualificationRoutes: 5,
	unionBranches: 8,
	relevanceContracts: 3,
	distinctInstances: 22,
} as const

export const ACCEPT_FIXTURE_TOTAL =
	ACCEPT_FIXTURE_COUNTS.accepts +
	ACCEPT_FIXTURE_COUNTS.probeClasses +
	ACCEPT_FIXTURE_COUNTS.qualificationRoutes +
	ACCEPT_FIXTURE_COUNTS.unionBranches +
	ACCEPT_FIXTURE_COUNTS.relevanceContracts

/** The constraint ledger's two dispositions, and the lineage carriers it derives from. */
export const LEDGER_COUNTS = {
	inject: 26,
	notExpressible: 18,
	lineageCarriers: 11,
} as const
