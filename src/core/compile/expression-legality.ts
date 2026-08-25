/**
 * Checks expression operands, regex constructs, quantifier use, and
 * reference-set resolution. Each check reports the first structural failure.
 */
import { digestArtifact } from '../canonical/digest.ts'
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { Expression, Operand, SetOperand } from '../schemas/expression.ts'
import { JsonTypeName } from '../schemas/primitives.ts'
import {
	buildPlanIndex,
	type PlanIndex,
	parseEvidenceTarget,
} from '../seal/plan-index.ts'
import { substitutePointer } from './oracle-alignment.ts'

// Shared expression traversal.

type OperandPosition = 0 | 1 | 'collection'
type OperandBearingOp = Exclude<Expression['op'], 'not' | 'all' | 'any'>

type Visitor = {
	onOperand?: (
		operand: Operand,
		op: OperandBearingOp,
		position: OperandPosition,
		path: string,
		quantifierDepth: number,
	) => void
	onSetOperand?: (setOperand: SetOperand, path: string) => void
	onQuantifier?: (
		expr: {
			op: 'for-all' | 'for-any'
			collection: Operand
			predicate: Expression
		},
		path: string,
		quantifierDepth: number,
	) => void
	onCoversByKey?: (
		expr: Extract<Expression, { op: 'covers-by-key' }>,
		path: string,
		quantifierDepth: number,
	) => void
	onRegex?: (pattern: string, path: string) => void
}

function walkExpression(
	expr: Expression,
	quantifierDepth: number,
	path: string,
	visitor: Visitor,
): void {
	switch (expr.op) {
		case 'not':
			walkExpression(
				expr.operands[0],
				quantifierDepth,
				`${path}.operands[0]`,
				visitor,
			)
			return
		case 'all':
		case 'any':
			expr.operands.forEach((child, index) => {
				walkExpression(
					child,
					quantifierDepth,
					`${path}.operands[${index}]`,
					visitor,
				)
			})
			return
		case 'for-all':
		case 'for-any':
			visitor.onOperand?.(
				expr.collection,
				expr.op,
				'collection',
				`${path}.collection`,
				quantifierDepth,
			)
			visitor.onQuantifier?.(expr, path, quantifierDepth)
			walkExpression(
				expr.predicate,
				quantifierDepth + 1,
				`${path}.predicate`,
				visitor,
			)
			return
		case 'set-membership':
			visitor.onOperand?.(
				expr.operands[0],
				expr.op,
				0,
				`${path}.operands[0]`,
				quantifierDepth,
			)
			visitor.onSetOperand?.(expr.operands[1], `${path}.operands[1]`)
			return
		case 'covers-by-key':
			visitor.onCoversByKey?.(expr, path, quantifierDepth)
			expr.operands.forEach((operand, index) => {
				visitor.onOperand?.(
					operand,
					expr.op,
					index as 0 | 1,
					`${path}.operands[${index}]`,
					quantifierDepth,
				)
			})
			return
		case 'regex':
			visitor.onRegex?.(expr.pattern, path)
			expr.operands.forEach((operand, index) => {
				visitor.onOperand?.(
					operand,
					expr.op,
					index as 0,
					`${path}.operands[${index}]`,
					quantifierDepth,
				)
			})
			return
		default:
			expr.operands.forEach((operand, index) => {
				visitor.onOperand?.(
					operand,
					expr.op,
					index as 0 | 1,
					`${path}.operands[${index}]`,
					quantifierDepth,
				)
			})
	}
}

function forEachOracleCheck(
	contract: EvalContract,
	visit: (check: Expression, oracleId: string) => void,
): void {
	contract.oracles.forEach((oracle) => {
		if (oracle.check === null) return
		visit(oracle.check, oracle.id)
	})
}

// Legal operand kinds by operator and position.

type OperandKind = 'pointer' | 'literal' | 'referenceSet'

function kindOf(operand: Operand): OperandKind {
	if ('pointer' in operand) return 'pointer'
	if ('literal' in operand) return 'literal'
	return 'referenceSet'
}

/**
 * The schema accepts a common operand union, so position constraints live here.
 * Set membership narrows its second operand in the schema.
 */
const OPERAND_LEGALITY: Record<
	OperandBearingOp,
	Partial<Record<string, ReadonlySet<OperandKind>>>
> = {
	equality: {
		0: new Set(['pointer', 'literal']),
		1: new Set(['pointer', 'literal']),
	},
	'deep-equality': {
		0: new Set(['pointer', 'literal']),
		1: new Set(['pointer', 'literal']),
	},
	containment: {
		0: new Set(['pointer']),
		1: new Set(['pointer', 'literal', 'referenceSet']),
	},
	existence: { 0: new Set(['pointer']) },
	absence: { 0: new Set(['pointer']) },
	regex: { 0: new Set(['pointer']) },
	'set-membership': { 0: new Set(['pointer']) },
	ordering: { 0: new Set(['pointer']) },
	'count-tolerance': { 0: new Set(['pointer']) },
	shape: { 0: new Set(['pointer']) },
	'covers-by-key': { 0: new Set(['referenceSet']), 1: new Set(['pointer']) },
	'for-all': { collection: new Set(['pointer']) },
	'for-any': { collection: new Set(['pointer']) },
}

const artifactKey = (key: string): string =>
	/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
		? `.${key}`
		: `[${JSON.stringify(key)}]`

/** Checks each operator's operands against its position-specific constraints. */
export function checkOperandLegality(contract: EvalContract): void {
	forEachOracleCheck(contract, (check, oracleId) => {
		walkExpression(check, 0, 'check', {
			onOperand: (operand, op, position, path) => {
				const legal = OPERAND_LEGALITY[op]?.[String(position)]
				if (legal === undefined) return
				const kind = kindOf(operand)
				if (!legal.has(kind)) {
					throw new StructuralFailure(
						'malformed-operator-expression',
						`EvalContract.oracles[id=${oracleId}].${path}`,
						`"${op}" does not accept a ${kind} operand at position ${position} (AD-4, AD-26)`,
					)
				}
				if (
					op === 'ordering' &&
					'pointer' in operand &&
					!operand.pointer.startsWith('@') &&
					parseEvidenceTarget(operand.pointer).channel === 'call-inputs'
				) {
					throw new StructuralFailure(
						'malformed-operator-expression',
						`EvalContract.oracles[id=${oracleId}].${path}`,
						'"ordering" accepts observed output only, never call-inputs (AD-4)',
					)
				}
			},
			onCoversByKey: (expr) => {
				const expected = expr.operands[0]
				if (!('referenceSet' in expected)) return
				const declarations = contract.referenceSets
				if (
					declarations === null ||
					!Object.hasOwn(declarations, expected.referenceSet)
				)
					return
				const declaration = declarations[expected.referenceSet]
				if (declaration === undefined) return
				const seen = new Set<string>()
				for (const [index, member] of declaration.members.entries()) {
					if (!Object.hasOwn(member, expr.expectedKey)) continue
					const memberPath = `EvalContract.referenceSets[id=${expected.referenceSet}].members[${index}]${artifactKey(expr.expectedKey)}`
					const digest = digestArtifact(member[expr.expectedKey], memberPath)
					if (seen.has(digest)) {
						throw new StructuralFailure(
							'malformed-operator-expression',
							memberPath,
							`referenceSet "${expected.referenceSet}" repeats expectedKey "${expr.expectedKey}" for covers-by-key (AD-4)`,
						)
					}
					seen.add(digest)
				}
			},
		})
	})
}

// Rejected regex constructs.

const BACKREFERENCE_PATTERN = /\\(?:[1-9][0-9]*|k<[^>]+>)/
const LOOKBEHIND_PATTERN = /\(\?<[=!]/

function isEscaped(pattern: string, index: number): boolean {
	let backslashes = 0
	for (
		let cursor = index - 1;
		cursor >= 0 && pattern[cursor] === '\\';
		cursor--
	)
		backslashes++
	return backslashes % 2 === 1
}

function hasTopLevelAlternation(pattern: string): boolean {
	let depth = 0
	let inCharacterClass = false
	for (let index = 0; index < pattern.length; index++) {
		const character = pattern[index]
		if (character === undefined || isEscaped(pattern, index)) continue
		if (character === '[') {
			inCharacterClass = true
			continue
		}
		if (character === ']') {
			inCharacterClass = false
			continue
		}
		if (inCharacterClass) continue
		if (character === '(') depth++
		else if (character === ')') depth--
		else if (character === '|' && depth === 0) return true
	}
	return false
}

function regexRejection(pattern: string): string | null {
	try {
		new RegExp(pattern)
	} catch {
		return 'is not a syntactically valid ECMA-262 pattern'
	}
	if (
		pattern[0] !== '^' ||
		pattern.at(-1) !== '$' ||
		isEscaped(pattern, pattern.length - 1) ||
		hasTopLevelAlternation(pattern)
	) {
		return 'is not anchored over the whole expression'
	}
	if (BACKREFERENCE_PATTERN.test(pattern)) return 'carries a backreference'
	if (LOOKBEHIND_PATTERN.test(pattern)) return 'carries a lookbehind'
	return null
}

/** Rejects invalid regexes, partial anchors, backreferences, and lookbehind. */
export function checkRegexConstructs(contract: EvalContract): void {
	forEachOracleCheck(contract, (check, oracleId) => {
		walkExpression(check, 0, 'check', {
			onRegex: (pattern, path) => {
				const rejection = regexRejection(pattern)
				if (rejection !== null) {
					throw new StructuralFailure(
						'malformed-operator-expression',
						`EvalContract.oracles[id=${oracleId}].${path}.pattern`,
						`regex pattern "${pattern}" ${rejection}, a rejected construct (AD-4)`,
					)
				}
			},
		})
	})
}

// Quantifier nesting.

/** Rejects nested quantifiers and covers-by-key inside a quantifier. */
export function checkQuantifierNesting(contract: EvalContract): void {
	forEachOracleCheck(contract, (check, oracleId) => {
		walkExpression(check, 0, 'check', {
			onQuantifier: (_expr, path, quantifierDepth) => {
				if (quantifierDepth >= 1) {
					throw new StructuralFailure(
						'quantifier-nesting-exceeded',
						`EvalContract.oracles[id=${oracleId}].${path}`,
						"a quantifier appears inside another quantifier's predicate; quantifiers may not nest more than one level (AD-4)",
					)
				}
			},
			onCoversByKey: (_expr, path, quantifierDepth) => {
				if (quantifierDepth >= 1) {
					throw new StructuralFailure(
						'quantifier-nesting-exceeded',
						`EvalContract.oracles[id=${oracleId}].${path}`,
						"covers-by-key appears inside a quantifier's predicate, where it may never nest (AD-4)",
					)
				}
			},
		})
	})
}

// Quantifiers over non-collections.

const NON_COLLECTION_TYPES: ReadonlySet<string> = new Set(
	JsonTypeName.options.filter((name) => name !== 'array'),
)

/**
 * Substitutes a quantifier's `@`-prefixed `collection` pointer against the
 * bound element its enclosing quantifier already opened, so a nested
 * quantifier's own collection resolves to an absolute pointer rather than
 * being skipped. Mirrors `oracle-alignment.ts`'s `collectTargets`.
 */
function forEachQuantifierCollection(
	expr: Expression,
	boundElementRoot: string | null,
	path: string,
	visit: (pointer: string, path: string) => void,
): void {
	switch (expr.op) {
		case 'not':
			forEachQuantifierCollection(
				expr.operands[0],
				boundElementRoot,
				`${path}.operands[0]`,
				visit,
			)
			return
		case 'all':
		case 'any':
			expr.operands.forEach((child, index) => {
				forEachQuantifierCollection(
					child,
					boundElementRoot,
					`${path}.operands[${index}]`,
					visit,
				)
			})
			return
		case 'for-all':
		case 'for-any': {
			const { collection } = expr
			const collectionPointer =
				'pointer' in collection
					? substitutePointer(collection.pointer, boundElementRoot)
					: null
			if (collectionPointer !== null && !collectionPointer.startsWith('@'))
				visit(collectionPointer, `${path}.collection`)
			forEachQuantifierCollection(
				expr.predicate,
				collectionPointer,
				`${path}.predicate`,
				visit,
			)
			return
		}
		default:
			return
	}
}

/** Checks response-body collection pointers, after bound-element substitution. */
export function checkQuantifierOverNonCollection(contract: EvalContract): void {
	const index: PlanIndex = buildPlanIndex(
		contract.interactionPlan,
		contract.permittedInterfaces,
		{ duplicateIds: 'unresolved' },
	)
	forEachOracleCheck(contract, (check, oracleId) => {
		forEachQuantifierCollection(check, null, 'check', (pointer, path) => {
			const target = parseEvidenceTarget(pointer)
			if (target.channel !== 'response-body') return
			const step = index.stepOf(target.stepId)
			if (step === undefined) return
			const operation = index.operationOf(step.operationId)
			if (operation === undefined) return
			const firstToken = target.tail.length === 1 ? target.tail[0] : undefined
			const declaredType =
				firstToken === undefined
					? undefined
					: operation.responseDescriptor.types[firstToken]
			if (
				declaredType !== undefined &&
				declaredType !== null &&
				NON_COLLECTION_TYPES.has(declaredType)
			) {
				throw new StructuralFailure(
					'quantifier-over-non-collection',
					`EvalContract.oracles[id=${oracleId}].${path}`,
					`"${pointer}" is declared "${declaredType}" by operation "${operation.operationId}", not a collection (AD-4)`,
				)
			}
		})
	})
}

// Reference-set resolution.

/**
 * Checks every reference-set operand with an own-property lookup.
 * This preserves legal identifiers such as `constructor`.
 */
export function checkReferenceSetResolution(contract: EvalContract): void {
	const declared = contract.referenceSets ?? {}
	const isDeclared = (id: string): boolean => Object.hasOwn(declared, id)
	forEachOracleCheck(contract, (check, oracleId) => {
		const reject = (id: string, path: string): void => {
			throw new StructuralFailure(
				'unresolved-reference-set',
				`EvalContract.oracles[id=${oracleId}].${path}`,
				`referenceSet "${id}" is not declared on the contract (AD-26)`,
			)
		}
		walkExpression(check, 0, 'check', {
			onOperand: (operand, _op, _position, path) => {
				if ('referenceSet' in operand && !isDeclared(operand.referenceSet)) {
					reject(operand.referenceSet, path)
				}
			},
			onSetOperand: (setOperand, path) => {
				if (
					'referenceSet' in setOperand &&
					!isDeclared(setOperand.referenceSet)
				) {
					reject(setOperand.referenceSet, path)
				}
			},
		})
	})
}
