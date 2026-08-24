/**
 * The relation-keyed template (AC 3): turns one oracle's `Direction` into the
 * `text` of one `BriefDirection`. It composes, in one fixed order, the
 * derived evidence-target references (`derived-reference.ts`), the relation's
 * verb phrase, the declared polarity, and the author-written `scope` and
 * `negativeDomain`. Each part is shaped into a standalone sentence (trimmed,
 * capitalized, one terminal mark); the author's own words are never split,
 * reordered, or rewritten.
 */
import type { Polarity, Relation } from '../schemas/expression.ts'
import type { Direction } from '../schemas/oracle.ts'
import { renderEvidenceReferences } from './derived-reference.ts'
import type { PlanIndex } from './plan-index.ts'

// Uppercases only the first letter found, so an author-written `scope` or
// `negativeDomain` string that starts lowercase still reads as its own
// sentence once joined after another.
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

// `for-all`/`for-any` carry no nested predicate on `Direction`; that lives on
// `check`, which this story does not read. So the claim names the
// quantification itself, saying nothing about a condition it cannot see.
function quantifierClaim(
	relation: 'for-all' | 'for-any',
	evidence: string,
): string {
	return relation === 'for-all'
		? `Every element reachable through ${evidence} is asserted to meet the declared condition.`
		: `At least one element reachable through ${evidence} is asserted to meet the declared condition.`
}

// A shared affirmative skeleton over `not` would tell the sealed evaluator
// the opposite of the declared claim (Decision 10).
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

// Typed to exactly these six, not the full sixteen-member `Relation` union,
// so a future addition to `RELATION_VOCABULARY` fails to compile here instead
// of silently falling through to this generic skeleton.
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
// Any trailing terminator the author already wrote is stripped first, since
// the text becomes the subject of a larger sentence rather than standing
// alone: an author-terminated string would otherwise read "...did not
// return. is treated as a defect." (a mid-sentence period followed by a
// lowercase clause).
function renderNegativeDomainClause(negativeDomain: string): string {
	const trimmed = negativeDomain.trim().replace(/[.!?]+$/, '')
	return `${trimmed} is treated as a defect.`
}

/**
 * An empty `evidenceTargets` array is a should-never-happen precondition
 * violation, not a shape a compiled contract produces (AD-3's alignment
 * predicate requires every declared evidence target to appear in `check`).
 * Throws the same precondition-violation `TypeError` as this story's other
 * should-never-happen shapes.
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
	// `null` and `''` both drop the clause: the schema allows `''` as distinct
	// from `null` with no minimum length, and AC 3 requires `null` to drop its
	// clause rather than render an empty sentence. Checking `!== null` alone
	// would still render that empty sentence for `''`.
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
