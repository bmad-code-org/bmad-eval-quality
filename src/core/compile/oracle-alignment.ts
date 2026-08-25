/**
 * Checks AD-3 oracle channels and structural alignment. Alignment covers
 * evidence targets, relation, and polarity after bound-element resolution.
 */
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { Expression, Operand } from '../schemas/expression.ts'

/** Rejects the first oracle missing its direction or check channel. */
export function checkOracleChannel(contract: EvalContract): void {
	for (const oracle of contract.oracles) {
		if (oracle.direction === null || oracle.check === null) {
			const missingField = oracle.direction === null ? 'direction' : 'check'
			throw new StructuralFailure(
				'oracle-missing-channel',
				`EvalContract.oracles[id=${oracle.id}].${missingField}`,
				`omits its ${missingField} (AD-3)`,
			)
		}
	}
}

/**
 * Resolves a bound-element pointer against its enclosing collection.
 * Keep the RFC 6901 tail encoded. Bare `@/` refers to the bound element.
 */
function substitutePointer(
	pointer: string,
	boundElementRoot: string | null,
): string {
	if (!pointer.startsWith('@')) return pointer
	if (boundElementRoot === null) return pointer
	const tailSource = pointer.slice(1)
	return tailSource === '/'
		? boundElementRoot
		: `${boundElementRoot}${tailSource}`
}

function operandPointer(
	operand: Operand,
	boundElementRoot: string | null,
): string | null {
	if (!('pointer' in operand)) return null
	return substitutePointer(operand.pointer, boundElementRoot)
}

/** Collects operators and resolved evidence targets across nested quantifiers. */
function collectTargets(
	expr: Expression,
	boundElementRoot: string | null,
	targets: Set<string>,
	ops: Set<string>,
): void {
	ops.add(expr.op)
	switch (expr.op) {
		case 'not':
			collectTargets(expr.operands[0], boundElementRoot, targets, ops)
			return
		case 'all':
		case 'any':
			for (const child of expr.operands)
				collectTargets(child, boundElementRoot, targets, ops)
			return
		case 'for-all':
		case 'for-any': {
			const collectionPointer = operandPointer(
				expr.collection,
				boundElementRoot,
			)
			if (collectionPointer !== null) targets.add(collectionPointer)
			collectTargets(expr.predicate, collectionPointer, targets, ops)
			return
		}
		case 'set-membership': {
			const value = operandPointer(expr.operands[0], boundElementRoot)
			if (value !== null) targets.add(value)
			return
		}
		default:
			for (const operand of expr.operands) {
				const pointer = operandPointer(operand, boundElementRoot)
				if (pointer !== null) targets.add(pointer)
			}
	}
}

/**
 * Checks direction targets and relation against the check, then compares
 * direction polarity with the oracle.
 */
export function checkOracleAlignment(contract: EvalContract): void {
	for (const oracle of contract.oracles) {
		const { direction, check } = oracle
		if (direction === null || check === null) continue
		const targets = new Set<string>()
		const ops = new Set<string>()
		collectTargets(check, null, targets, ops)
		for (const target of direction.evidenceTargets) {
			if (!targets.has(target)) {
				throw new StructuralFailure(
					'direction-check-misaligned',
					`EvalContract.oracles[id=${oracle.id}].direction.evidenceTargets`,
					`"${target}" is not contained in check, even after quantifier substitution (AD-3)`,
				)
			}
		}
		if (!ops.has(direction.relation)) {
			throw new StructuralFailure(
				'direction-check-misaligned',
				`EvalContract.oracles[id=${oracle.id}].direction.relation`,
				`"${direction.relation}" does not appear anywhere in check (AD-3)`,
			)
		}
		if (direction.polarity !== oracle.polarity) {
			throw new StructuralFailure(
				'direction-check-misaligned',
				`EvalContract.oracles[id=${oracle.id}].direction.polarity`,
				`"${direction.polarity}" disagrees with the oracle's own polarity "${oracle.polarity}" (AD-3, AD-33)`,
			)
		}
	}
}
