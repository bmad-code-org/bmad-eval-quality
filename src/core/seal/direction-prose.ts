/**
 * The relation-keyed template (AC 3): turns one oracle's `Direction` into the
 * `text` of one `BriefDirection`. It composes four things in one fixed
 * non-imperative order: the derived evidence-target references of
 * `derived-reference.ts`, the relation's own verb phrase, the declared
 * polarity, and the author-written `scope` and `negativeDomain`. Each part is
 * lightly shaped into a standalone sentence (trimmed, capitalized at its
 * leading letter, given exactly one terminal punctuation mark); the author's
 * own words are never split, reordered, or otherwise rewritten.
 */
import type { Polarity, Relation } from '../schemas/expression.ts'
import type { Direction } from '../schemas/oracle.ts'
import { renderEvidenceReferences } from './derived-reference.ts'
import type { PlanIndex } from './plan-index.ts'

// Uppercases only the first alphabetic character found, leaving everything
// else in the text untouched, so a `scope`/`negativeDomain` string an author
// wrote lowercase still reads as its own sentence once joined after another.
function capitalizeFirst(text: string): string {
	const match = /[a-zA-Z]/.exec(text)
	if (match === null) return text
	const index = match.index
	const char = text[index]
	if (char === undefined) return text
	return `${text.slice(0, index)}${char.toUpperCase()}${text.slice(index + 1)}`
}

const ensureSentence = (text: string): string => {
	const capitalized = capitalizeFirst(text.trim())
	return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`
}

// Universal versus existential framing, kept distinct from each other.
// `for-all` and `for-any` carry no nested predicate on `Direction`; that lives
// on `check`, which this story does not read. So the claim names the
// quantification itself and says nothing about a condition it cannot see.
function quantifierClaim(
	relation: 'for-all' | 'for-any',
	evidence: string,
): string {
	return relation === 'for-all'
		? `Every element reachable through ${evidence} is asserted to meet the declared condition.`
		: `At least one element reachable through ${evidence} is asserted to meet the declared condition.`
}

// Connectives get their own family, and `not` its own skeleton. A shared
// affirmative skeleton over `not` would tell the sealed evaluator the opposite
// of the declared claim (Decision 10).
function connectiveClaim(
	relation: 'all' | 'any' | 'not',
	evidence: string,
): string {
	switch (relation) {
		case 'all':
			return `${evidence} is asserted to satisfy every declared condition together.`
		case 'any':
			return `${evidence} is asserted to satisfy at least one declared condition.`
		case 'not':
			return `${evidence} is asserted to fail the declared condition, not to satisfy it.`
	}
}

function presenceClaim(
	relation: 'existence' | 'absence',
	evidence: string,
): string {
	return relation === 'existence'
		? `${evidence} is asserted to be present.`
		: `${evidence} is asserted to be absent.`
}

function comparisonClaim(
	relation: 'equality' | 'deep-equality' | 'containment',
	evidence: string,
): string {
	switch (relation) {
		case 'equality':
			return `${evidence} is asserted to be equal.`
		case 'deep-equality':
			return `${evidence} is asserted to be deeply, structurally equal.`
		case 'containment':
			return `${evidence} is asserted to contain the declared member.`
	}
}

// The remaining six structural operators share one skeleton, parameterised by
// the relation's own name so the rendered text still says which relation is
// asserted. Typed to exactly these six, not the full sixteen-member `Relation`
// union, so a future addition to `RELATION_VOCABULARY` fails to compile here
// instead of silently falling through to this generic skeleton.
type StructuralRelation =
	| 'regex'
	| 'set-membership'
	| 'ordering'
	| 'count-tolerance'
	| 'shape'
	| 'covers-by-key'

function structuralClaim(
	relation: StructuralRelation,
	evidence: string,
): string {
	return `${evidence} is asserted to satisfy the declared "${relation}" condition.`
}

function renderRelationClaim(relation: Relation, evidence: string): string {
	if (relation === 'for-all' || relation === 'for-any') {
		return quantifierClaim(relation, evidence)
	}
	if (relation === 'all' || relation === 'any' || relation === 'not') {
		return connectiveClaim(relation, evidence)
	}
	if (relation === 'existence' || relation === 'absence') {
		return presenceClaim(relation, evidence)
	}
	if (
		relation === 'equality' ||
		relation === 'deep-equality' ||
		relation === 'containment'
	) {
		return comparisonClaim(relation, evidence)
	}
	return structuralClaim(relation, evidence)
}

function renderPolarityClause(polarity: Polarity): string {
	return polarity === 'expects-hold'
		? 'The declared polarity expects this relation to hold.'
		: 'The declared polarity expects this relation to be a violation.'
}

// `negativeDomain` is author-written, evaluator-facing free text (Decision 2).
// It is not spliced onto its framing sentence verbatim: any trailing
// terminator the author already wrote is stripped first, since the text
// becomes the subject of a larger sentence here rather than standing alone
// (an author-terminated string would otherwise read "...did not return. is
// treated as a defect.", a mid-sentence period followed by a lowercase
// clause). The words themselves are never split, reordered, or rewritten
// beyond that trim and the leading-letter capitalization `ensureSentence`
// applies uniformly to every clause.
function renderNegativeDomainClause(negativeDomain: string): string {
	const trimmed = negativeDomain.trim().replace(/[.!?]+$/, '')
	return `${trimmed} is treated as a defect.`
}

/**
 * `Direction.evidenceTargets` carries no minimum length in the schema, but an
 * empty array is a should-never-happen precondition violation here: AD-3's
 * alignment predicate requires every declared evidence target to appear in
 * `check`, so a direction reaching `seal` with none is not a shape a compiled
 * contract produces, and rendering it degenerates (a doubled space where the
 * evidence clause should be, a subjectless connective sentence). Throws the
 * same precondition-violation `TypeError` this story already uses for other
 * should-never-happen shapes (a duplicate `stepId`, an unresolvable pointer)
 * rather than rendering that degenerate text.
 */
export function renderDirectionText(
	direction: Direction,
	index: PlanIndex,
): string {
	if (direction.evidenceTargets.length === 0) {
		throw new TypeError(
			'direction carries no evidenceTargets; a schema-valid Direction reaching seal always names at least one',
		)
	}
	const evidence = renderEvidenceReferences(direction.evidenceTargets, index)
	const parts = [
		ensureSentence(renderRelationClaim(direction.relation, evidence)),
		ensureSentence(renderPolarityClause(direction.polarity)),
	]
	// `null` and an empty string both drop the clause. The schema admits `''`
	// as a value distinct from `null`, with no minimum length, and AC 3
	// requires `null` to drop its clause "rather than rendering... an empty
	// sentence". An empty string that passed the `!== null` check alone would
	// render exactly that.
	if (direction.scope !== null && direction.scope.trim() !== '') {
		parts.push(ensureSentence(direction.scope))
	}
	if (
		direction.negativeDomain !== null &&
		direction.negativeDomain.trim() !== ''
	) {
		parts.push(
			ensureSentence(renderNegativeDomainClause(direction.negativeDomain)),
		)
	}
	return parts.join(' ')
}
