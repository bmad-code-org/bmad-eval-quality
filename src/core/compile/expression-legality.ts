/**
 * Checks expression operands, regex constructs, quantifier use, and
 * reference-set resolution. Each check reports the first structural failure.
 */
import { digestArtifact } from '../canonical/digest.ts'
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'
import type { Expression, Operand, SetOperand } from '../schemas/expression.ts'
import type { Operation } from '../schemas/interface.ts'
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

/**
 * The one expression walker in this package. Contract-free and a superset of
 * the narrower walks the checks below need, so a probe-side legality pass
 * reuses it rather than adding a fifth traversal that can drift from it.
 */
export function walkExpression(
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

/**
 * One expression the contract declares, with the artifact path of its root and
 * whatever it needs to resolve a pointer. An oracle check resolves a step
 * through the interaction plan. A witness relation roots at a leg id, and
 * `checkWitnessLegIdentifiers` keeps a leg id out of the plan, so a witness site
 * carries its own operation.
 */
type ExpressionSite = {
	readonly expression: Expression
	readonly artifactPath: string
	readonly witnessScope: {
		readonly operation: Operation
		readonly legIds: readonly string[]
	} | null
}

/**
 * Every expression the contract declares, oracle checks first and then each
 * operation's sensitivity witness. Generalized from an oracle-only enumerator:
 * a witness relation that escaped these five checks would be a declaration that
 * looks checked and is not, which is the defect class AD-10 exists to catch.
 */
function forEachContractExpression(
	contract: EvalContract,
	visit: (site: ExpressionSite) => void,
): void {
	contract.oracles.forEach((oracle) => {
		if (oracle.check === null) return
		visit({
			expression: oracle.check,
			artifactPath: `EvalContract.oracles[id=${oracle.id}].check`,
			witnessScope: null,
		})
	})
	contract.permittedInterfaces.forEach((iface, interfaceIndex) => {
		iface.operations.forEach((operation, operationIndex) => {
			const witness = operation.sensitivityWitness
			if (witness === null) return
			visit({
				expression: witness.relation,
				artifactPath: `EvalContract.permittedInterfaces[${interfaceIndex}].operations[${operationIndex}].sensitivityWitness.relation`,
				witnessScope: {
					operation,
					legIds: witness.legs.map((leg) => leg.legId),
				},
			})
		})
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

/**
 * One operand's two position rules: the `OPERAND_LEGALITY` table, and the
 * `ordering`-over-`call-inputs` rule that sits beside it. Both are decidable
 * from the operand alone, so both cross over to a bare `Expression`.
 */
function checkOperandAtPosition(
	operand: Operand,
	op: OperandBearingOp,
	position: OperandPosition,
	artifactPath: string,
): void {
	const legal = OPERAND_LEGALITY[op]?.[String(position)]
	if (legal === undefined) return
	const kind = kindOf(operand)
	if (!legal.has(kind)) {
		throw new StructuralFailure(
			'malformed-operator-expression',
			artifactPath,
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
			artifactPath,
			'"ordering" accepts observed output only, never call-inputs (AD-4)',
		)
	}
}

/**
 * `checkOperandLegality` over one bare `Expression`, minus the `covers-by-key`
 * `expectedKey` uniqueness rule, which reads the contract's declared reference
 * sets and has no probe-side form: a probe-side condition may carry no
 * `{ referenceSet }` operand at all.
 */
export function checkExpressionOperandLegality(
	expression: Expression,
	artifactPath: string,
): void {
	walkExpression(expression, 0, '', {
		onOperand: (operand, op, position, path) => {
			checkOperandAtPosition(operand, op, position, `${artifactPath}${path}`)
		},
	})
}

/** `checkRegexConstructs` over one bare `Expression`. */
export function checkExpressionRegexConstructs(
	expression: Expression,
	artifactPath: string,
): void {
	walkExpression(expression, 0, '', {
		onRegex: (pattern, path) => {
			const rejection = regexRejection(pattern)
			if (rejection !== null) {
				throw new StructuralFailure(
					'malformed-operator-expression',
					`${artifactPath}${path}.pattern`,
					`regex pattern "${pattern}" ${rejection}, a rejected construct (AD-4)`,
				)
			}
		},
	})
}

/** `checkQuantifierNesting` over one bare `Expression`. */
export function checkExpressionQuantifierNesting(
	expression: Expression,
	artifactPath: string,
): void {
	walkExpression(expression, 0, '', {
		onQuantifier: (_expr, path, quantifierDepth) => {
			if (quantifierDepth >= 1) {
				throw new StructuralFailure(
					'quantifier-nesting-exceeded',
					`${artifactPath}${path}`,
					"a quantifier appears inside another quantifier's predicate; quantifiers may not nest more than one level (AD-4)",
				)
			}
		},
		onCoversByKey: (_expr, path, quantifierDepth) => {
			if (quantifierDepth >= 1) {
				throw new StructuralFailure(
					'quantifier-nesting-exceeded',
					`${artifactPath}${path}`,
					"covers-by-key appears inside a quantifier's predicate, where it may never nest (AD-4)",
				)
			}
		},
	})
}

/** Checks each operator's operands against its position-specific constraints. */
export function checkOperandLegality(contract: EvalContract): void {
	forEachContractExpression(contract, (site) => {
		walkExpression(site.expression, 0, '', {
			onOperand: (operand, op, position, path) => {
				checkOperandAtPosition(
					operand,
					op,
					position,
					`${site.artifactPath}${path}`,
				)
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
	forEachContractExpression(contract, (site) => {
		walkExpression(site.expression, 0, '', {
			onRegex: (pattern, path) => {
				const rejection = regexRejection(pattern)
				if (rejection !== null) {
					throw new StructuralFailure(
						'malformed-operator-expression',
						`${site.artifactPath}${path}.pattern`,
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
	forEachContractExpression(contract, (site) => {
		walkExpression(site.expression, 0, '', {
			onQuantifier: (_expr, path, quantifierDepth) => {
				if (quantifierDepth >= 1) {
					throw new StructuralFailure(
						'quantifier-nesting-exceeded',
						`${site.artifactPath}${path}`,
						"a quantifier appears inside another quantifier's predicate; quantifiers may not nest more than one level (AD-4)",
					)
				}
			},
			onCoversByKey: (_expr, path, quantifierDepth) => {
				if (quantifierDepth >= 1) {
					throw new StructuralFailure(
						'quantifier-nesting-exceeded',
						`${site.artifactPath}${path}`,
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

/**
 * The check itself, against whatever resolves a step identifier to the
 * operation that answers it. The contract path resolves through the plan index
 * or the witness scope; a probe-side condition resolves the one reserved step
 * identifier to the signature's home operation.
 */
function checkQuantifiersAgainst(
	expression: Expression,
	artifactPath: string,
	operationFor: (stepId: string) => Operation | undefined,
): void {
	forEachQuantifierCollection(expression, null, '', (pointer, path) => {
		const target = parseEvidenceTarget(pointer)
		if (target.channel !== 'response-body') return
		const operation = operationFor(target.stepId)
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
				`${artifactPath}${path}`,
				`"${pointer}" is declared "${declaredType}" by operation "${operation.operationId}", not a collection (AD-4)`,
			)
		}
	})
}

/**
 * `checkQuantifierOverNonCollection` over one bare `Expression` rooted at a
 * known set of step identifiers, all of which resolve to one operation. The
 * `legIds` argument is load-bearing: omit it and the check silently no-ops on
 * every expression, which is the trap the witness branch below already warns
 * about. It reads the operation's declared response types, never its
 * `collectionLocations`; a declared non-array type beats a contradictory
 * collection location, and a re-derivation that read the other field would
 * disagree with the compiler on a committed fixture.
 */
export function checkExpressionQuantifierOverNonCollection(
	expression: Expression,
	artifactPath: string,
	scope: { readonly operation: Operation; readonly legIds: readonly string[] },
): void {
	checkQuantifiersAgainst(expression, artifactPath, (stepId) =>
		scope.legIds.includes(stepId) ? scope.operation : undefined,
	)
}

/** Checks response-body collection pointers, after bound-element substitution. */
export function checkQuantifierOverNonCollection(contract: EvalContract): void {
	const index: PlanIndex = buildPlanIndex(
		contract.interactionPlan,
		contract.permittedInterfaces,
		{ duplicateIds: 'unresolved' },
	)
	// A leg-rooted pointer cannot resolve through the plan index: a leg id
	// colliding with a step id is itself a compile failure. Without the
	// witness-scoped lookup below, this check silently no-ops on every legal
	// witness, and the generalized enumerator buys four checks out of five.
	const operationFor = (
		site: ExpressionSite,
		stepId: string,
	): Operation | undefined => {
		const scope = site.witnessScope
		if (scope !== null) {
			return scope.legIds.includes(stepId) ? scope.operation : undefined
		}
		const step = index.stepOf(stepId)
		if (step === undefined) return undefined
		return index.operationOf(step.operationId)
	}
	forEachContractExpression(contract, (site) => {
		checkQuantifiersAgainst(site.expression, site.artifactPath, (stepId) =>
			operationFor(site, stepId),
		)
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
	forEachContractExpression(contract, (site) => {
		const reject = (id: string, path: string): void => {
			throw new StructuralFailure(
				'unresolved-reference-set',
				`${site.artifactPath}${path}`,
				`referenceSet "${id}" is not declared on the contract (AD-26)`,
			)
		}
		walkExpression(site.expression, 0, '', {
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
