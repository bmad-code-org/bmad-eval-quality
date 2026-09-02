/**
 * AD-9's corpus gate: whether one probe earned its ground truth, and which
 * probes may enter a sealed set.
 *
 * Pure and total, like the rest of `core/score`: every verdict and every reason
 * comes back as data, nothing throws on a badly-shaped probe, and no AD-6
 * outcome state is assigned. The failure vocabulary is closed and separate from
 * AD-5's, because AD-5 is compile-time over contracts and `compile` never sees
 * a probe.
 *
 * The gate is what keeps the witness match's ordinary path total. `resolveCheck`
 * throws in seven places; four of them are reachable only through operand
 * classes rejected here, `{ referenceSet }` above all, which resolves absent
 * against the probe side's empty reference-set map and then throws a plain
 * `Error`.
 */
import {
	checkExpressionOperandLegality,
	checkExpressionQuantifierNesting,
	checkExpressionQuantifierOverNonCollection,
	checkExpressionRegexConstructs,
	walkExpression,
} from '../compile/expression-legality.ts'
import { operationSignature } from '../compile/interface-inventory.ts'
import {
	checkExpressionBoundElementScope,
	checkExpressionEvidenceReachability,
	forEachExpressionPointer,
} from '../compile/reachability.ts'
import { StructuralFailure } from '../failure-codes.ts'
import {
	type DefectSignature,
	OBSERVED_STEP_ID,
} from '../schemas/defect-signature.ts'
import type { Expression, Operand } from '../schemas/expression.ts'
import type { Operation, PermittedInterface } from '../schemas/interface.ts'
import {
	type EvidenceChannelName,
	TRANSPORT_CHANNELS,
} from '../schemas/pointer.ts'
import type { Probe } from '../schemas/probe.ts'
import type { QualificationRouteValue } from '../schemas/probe-qualification.ts'
import { parseEvidenceTarget } from '../seal/plan-index.ts'

/**
 * The closed reason set. Nothing outside it can come back from `qualifyProbe`,
 * so a caller routing a rejection to a rung has a finite table to write.
 */
export const QUALIFICATION_FAILURES = [
	'qualification-route-incompatible',
	'qualification-defect-sources-mixed',
	'qualification-evidence-unverified',
	'signature-absent',
	'signature-present-on-canary',
	'signature-interface-kind-unsupported',
	'signature-observable-channel-not-response-side',
	'condition-channels-underspecified',
	'condition-disjunct-without-response-channel',
	'condition-selector-key-undeclared',
	'condition-pointer-not-observation-rooted',
	'condition-pointer-unwritable',
	'condition-text-channel-on-api',
	'condition-reference-set-operand',
	'condition-operand-illegal',
	'condition-regex-illegal',
	'condition-quantifier-nesting',
	'condition-quantifier-over-non-collection',
	'condition-bound-element-outside-quantifier',
] as const

export type QualificationFailureCode = (typeof QUALIFICATION_FAILURES)[number]

export type QualificationFailure = {
	readonly code: QualificationFailureCode
	/** the probe-rooted path, in the same spelling a structural failure uses. */
	readonly artifactPath: string
	readonly detail: string
}

export type QualificationResult = {
	readonly qualified: boolean
	readonly failures: readonly QualificationFailure[]
	/**
	 * Whether the declaration-dependent checks ran. Three of them read the home
	 * operation's declared request and response shapes, which a corpus holds
	 * nowhere: the quantifier-over-non-collection rule, evidence reachability,
	 * and the selector's own keys. The first two catch a predicate that was
	 * never writable; the third catches a selector that matches nothing, which
	 * is a different failure with the same silent outcome. A caller qualifying
	 * against no inventory is told which three did not run rather than being
	 * handed a pass that hid them.
	 */
	readonly declarationChecksRan: boolean
}

/**
 * Resolves a signature's home operation against a contract's operation
 * inventory, comparing method plus path template with parameter names erased
 * first, so a corpus signature on `/notes/{id}` binds a contract declaring
 * `/notes/{noteId}`. A post-erasure collision inside one contract has already
 * failed compilation under `duplicate-operation-signature`, so the first match
 * is the only match for any contract that compiled.
 */
export function resolveHomeOperation(
	signature: DefectSignature,
	interfaces: readonly PermittedInterface[],
): Operation | null {
	const wanted = operationSignature(signature)
	for (const iface of interfaces) {
		for (const operation of iface.operations) {
			if (operationSignature(operation) === wanted) return operation
		}
	}
	return null
}

// AD-26's channels that carry what came back, as opposed to what was sent. The
// channel rule below needs at least one of these, or a condition naming two
// channels could name `call-inputs` twice and pass.
const RESPONSE_SIDE_CHANNELS: ReadonlySet<string> = new Set([
	'response-body',
	'response-headers',
	'response-status',
	'stdout',
	'stderr',
	'exit-code',
])

// The three channels an `api` signature can never manifest in. The contract
// side cannot decide this: reachability rejects a tailed `stdout` pointer and
// returns reachable for a bare one unconditionally, because an operation
// carries no interface kind. The signature's own declared kind is what makes
// the rule decidable, so it is spent here rather than left as prose.
const TEXT_CHANNELS: ReadonlySet<string> = new Set([
	'stdout',
	'stderr',
	'exit-code',
])

const probePath = (probe: Probe, tail: string): string =>
	`Probe[probeId=${probe.probeId}]${tail}`

/**
 * Which routes this probe's class and control status admit. An empty list is
 * the illegal cell: a pairing no route can satisfy, which the schema admits so
 * this gate can name it.
 *
 * `expectedClean` is read first, because it is the schema's own discriminator,
 * which is what makes a canary clean control an illegal cell rather than a
 * probe owing two routes.
 */
function admissibleRoutes(probe: Probe): readonly QualificationRouteValue[] {
	if (probe.expectedClean) {
		return probe.probeClass === 'zero-action' ? ['clean-control'] : []
	}
	switch (probe.probeClass) {
		case 'gameability':
			return ['gameability']
		case 'canary':
			return ['canary']
		default: {
			// A class that seeds admits no route when it seeds nothing. Both
			// source rules read "every seeded source is X", which is vacuously
			// true of an empty array both ways, so a literal reading hands a
			// probe with no defect BOTH routes and lets a corpus author attach
			// either route's evidence to a defect that does not exist. AD-9
			// qualifies a seeded defect, so with none there is nothing for the
			// evidence to be about.
			if (probe.defects.length === 0) return []
			const sources = new Set(probe.defects.map((defect) => defect.source))
			const routes: QualificationRouteValue[] = []
			if (!sources.has('controlled-mutation')) routes.push('historical')
			if (!sources.has('natural')) routes.push('controlled-mutation')
			return routes
		}
	}
}

/**
 * The route rules: a route the pairing admits, and a `defects` array whose
 * sources agree with a single route.
 *
 * A mixed array is its own failure rather than being resolved by majority or by
 * first entry: a probe seeding one mined defect and one introduced mutation has
 * two qualification arguments and AD-9 gives it one record.
 */
function checkRoute(probe: Probe, failures: QualificationFailure[]): void {
	const path = probePath(probe, '.qualification.route')
	if (
		!probe.expectedClean &&
		probe.probeClass !== 'gameability' &&
		probe.probeClass !== 'canary'
	) {
		const sources = new Set(probe.defects.map((defect) => defect.source))
		if (sources.size > 1) {
			failures.push({
				code: 'qualification-defect-sources-mixed',
				artifactPath: probePath(probe, '.defects'),
				detail:
					'seeds both a natural defect and a controlled mutation, which no single AD-9 route qualifies (AD-9)',
			})
		}
	}
	const admissible = admissibleRoutes(probe)
	if (!admissible.includes(probe.qualification.route)) {
		failures.push({
			code: 'qualification-route-incompatible',
			artifactPath: path,
			// Three conditions empty the admissible list and they send a corpus
			// author to three different fields, so the detail names which one
			// fired rather than blaming the class pairing for all of them.
			detail:
				admissible.length > 0
					? `route "${probe.qualification.route}" is not one of ${admissible.map((route) => `"${route}"`).join(', ')} for probeClass "${probe.probeClass}" with expectedClean ${probe.expectedClean} (AD-9)`
					: emptyRouteReason(probe),
		})
	}
}

/** Why no route is admissible, in the terms of the field that caused it. */
function emptyRouteReason(probe: Probe): string {
	if (!probe.expectedClean && probe.defects.length === 0) {
		return `probeClass "${probe.probeClass}" seeds a defect and this probe's defects array is empty, so no AD-9 route has a seeded defect to qualify (AD-9)`
	}
	if (new Set(probe.defects.map((defect) => defect.source)).size > 1) {
		return 'the defects array seeds both a natural defect and a controlled mutation, so no single AD-9 route qualifies this probe (AD-9)'
	}
	return `probeClass "${probe.probeClass}" with expectedClean ${probe.expectedClean} admits no AD-9 route at all, so no qualification record can be written for it (AD-9)`
}

/** The two routes whose evidence carries its own verified/not-verified flag. */
function checkRouteEvidence(
	probe: Probe,
	failures: QualificationFailure[],
): void {
	const { qualification } = probe
	if (
		qualification.route === 'historical' &&
		!qualification.oracleStableAcrossRevisions
	) {
		failures.push({
			code: 'qualification-evidence-unverified',
			artifactPath: probePath(
				probe,
				'.qualification.oracleStableAcrossRevisions',
			),
			detail:
				'AD-9 qualifies a historical probe only with the oracle stable across both revisions, and this record states it was not',
		})
	}
	if (
		qualification.route === 'controlled-mutation' &&
		!qualification.rollbackVerified
	) {
		failures.push({
			code: 'qualification-evidence-unverified',
			artifactPath: probePath(probe, '.qualification.rollbackVerified'),
			detail:
				'AD-9 qualifies a controlled mutation only with verified rollback or cleanup, and this record states it was not verified',
		})
	}
}

/**
 * The predicate's own operands: no reference set, every fully-rooted pointer at
 * the reserved step identifier, and no text channel on an `api` signature.
 * Returns the distinct channels the fully-rooted pointers name, which is what
 * the channel rule counts.
 */
function checkOperandsAndCollectChannels(
	probe: Probe,
	signature: DefectSignature,
	failures: QualificationFailure[],
): ReadonlySet<EvidenceChannelName> {
	const conditionPath = probePath(probe, '.defectSignature.condition.predicate')
	const channels = new Set<EvidenceChannelName>()
	walkExpression(signature.condition.predicate, 0, '', {
		onOperand: (operand, _op, _position, path) => {
			if ('referenceSet' in operand) {
				failures.push({
					code: 'condition-reference-set-operand',
					artifactPath: `${conditionPath}${path}`,
					detail: `names referenceSet "${operand.referenceSet}"; a corpus signature declares no reference sets, so the operand resolves absent and faults the evaluator rather than discriminating (AD-4, AD-26)`,
				})
			}
		},
		onSetOperand: (setOperand, path) => {
			if ('referenceSet' in setOperand) {
				failures.push({
					code: 'condition-reference-set-operand',
					artifactPath: `${conditionPath}${path}`,
					detail: `names referenceSet "${setOperand.referenceSet}"; a corpus signature declares no reference sets (AD-4, AD-26)`,
				})
			}
		},
	})
	forEachExpressionPointer(signature.condition.predicate, (pointer, path) => {
		// A bound-element pointer is relative to whatever a quantifier bound and
		// roots at no step identifier at all.
		if (pointer.startsWith('@')) return
		const target = parseEvidenceTarget(pointer)
		if (target.stepId !== OBSERVED_STEP_ID) {
			failures.push({
				code: 'condition-pointer-not-observation-rooted',
				artifactPath: `${conditionPath}${path}`,
				detail: `"${pointer}" roots at step "${target.stepId}"; a signature is authored against a corpus and roots every pointer at "${OBSERVED_STEP_ID}", since a step identifier is contract-relative and resolves nothing against a second contract (AD-40)`,
			})
			return
		}
		channels.add(target.channel)
		if (
			signature.interfaceKind === 'api' &&
			TEXT_CHANNELS.has(target.channel)
		) {
			failures.push({
				code: 'condition-text-channel-on-api',
				artifactPath: `${conditionPath}${path}`,
				detail: `"${pointer}" addresses ${target.channel}, which an api interface never produces (AD-19, AD-26)`,
			})
		}
	})
	return channels
}

/**
 * The selector's own keys against the home operation's declared request shape.
 *
 * A selector binding a key the operation declares in neither `requiredKeys`
 * nor `permittedKeys` matches no observation at all, so every candidate is
 * filtered out, the probe reports `not-triggered`, and a typo becomes a
 * silently passing run. Same shape as the pointer writability check, reached
 * through the selector.
 *
 * Stricter than the contract side deliberately. `compile/bindings.ts` leaves the
 * equivalent key rule to `undeclared-mandatory-input`, which AD-4 makes
 * strict-only, because a contract may be compiled either way. A corpus gate has
 * no lenient mode: AD-9's "an unqualified probe cannot enter a sealed set" states
 * one bar, so the probe side applies the rule unconditionally.
 *
 * Declaration-dependent, so it runs only where the caller supplied an inventory,
 * and `declarationChecksRan` says when it did not.
 */
function checkSelectorKeys(
	probe: Probe,
	signature: DefectSignature,
	operation: Operation,
	failures: QualificationFailure[],
): void {
	const { inputBinding } = signature.condition.selector
	for (const channel of TRANSPORT_CHANNELS) {
		const binding = inputBinding[channel]
		if (binding === null) continue
		const { requiredKeys, permittedKeys, types } =
			operation.requestShape[channel]
		for (const key of Object.keys(binding)) {
			const at = probePath(
				probe,
				`.defectSignature.condition.selector.inputBinding.${channel}[${JSON.stringify(key)}]`,
			)
			if (!requiredKeys.includes(key) && !permittedKeys.includes(key)) {
				failures.push({
					code: 'condition-selector-key-undeclared',
					artifactPath: at,
					detail: `operation "${operation.operationId}" declares "${key}" in neither requiredKeys nor permittedKeys of its ${channel} channel, so this selector matches no observation and the probe can never be triggered (AD-4, AD-40)`,
				})
				continue
			}
			// "Declared" has a second, narrower meaning for the one member that
			// reads the type map: a key may be permitted and still carry no
			// declared type, and a type-violating binding fails closed on an
			// indeterminate type because it cannot prove a violation. Checking
			// only key presence would leave that member matching nothing, which
			// is the same silent pass through the other definition of declared.
			// The other two members never read the type map and get no rule here.
			const value = binding[key]
			if (value === undefined || !('matcher' in value)) continue
			if (value.matcher !== 'type-violating') continue
			const declared = types[key]
			if (declared !== undefined && declared !== null) continue
			failures.push({
				code: 'condition-selector-key-undeclared',
				artifactPath: at,
				detail: `operation "${operation.operationId}" ${declared === undefined ? 'does not declare' : 'declares an indeterminate'} type for "${key}" in its ${channel} channel, and a type-violating binding cannot prove a violation against one, so this selector matches no observation (AD-4, AD-40)`,
			})
		}
	}
}

/**
 * The declared observable channel's own two rules, which the pointer walk above
 * cannot supply because it only sees what the predicate wrote.
 *
 * AD-40 calls it "the observable channel it manifests in", so it names what came
 * back. `call-inputs` names what was sent and can never be where a defect
 * manifests, and the channel rule reads this field first, so leaving it
 * unchecked would make an unchecked field load-bearing. On an `api` signature
 * the three text channels are rejected for the same reason a pointer into one
 * is: an api interface never produces them, which is the same rule the pointer
 * walk applies, read on the declaration too.
 */
function checkObservableChannel(
	probe: Probe,
	signature: DefectSignature,
	failures: QualificationFailure[],
): void {
	const path = probePath(probe, '.defectSignature.observableChannel')
	if (!RESPONSE_SIDE_CHANNELS.has(signature.observableChannel)) {
		failures.push({
			code: 'signature-observable-channel-not-response-side',
			artifactPath: path,
			detail: `declares observableChannel "${signature.observableChannel}", which records what was sent rather than what came back, so no defect manifests in it (AD-40)`,
		})
		return
	}
	if (
		signature.interfaceKind === 'api' &&
		TEXT_CHANNELS.has(signature.observableChannel)
	) {
		failures.push({
			code: 'condition-text-channel-on-api',
			artifactPath: path,
			detail: `declares observableChannel "${signature.observableChannel}", which an api interface never produces (AD-19, AD-26)`,
		})
	}
}

/**
 * AD-40's "name the response channel or at least two channels", made decidable:
 * the set of distinct channels the predicate's fully-rooted pointers name must
 * contain the declared observable channel, or hold two or more members with at
 * least one on the response side.
 *
 * The selector's own bindings do not count, since they describe what was sent.
 * The rule exists to reject "the evidence contains the string I sent", so
 * `call-inputs` twice must not pass, and does not.
 */
function checkChannels(
	probe: Probe,
	signature: DefectSignature,
	channels: ReadonlySet<EvidenceChannelName>,
	failures: QualificationFailure[],
): void {
	// Guarded on the response side rather than testing membership alone. An
	// unguarded early return lets `observableChannel: 'call-inputs'` pass a
	// predicate whose only pointer is a call-inputs pointer, which is the
	// "the evidence contains the string I sent" condition this rule exists to
	// reject, arriving through the field that names the rule. The declared
	// channel is rejected outright one check up, and this guard keeps the rule
	// true of this function on its own.
	if (
		RESPONSE_SIDE_CHANNELS.has(signature.observableChannel) &&
		channels.has(signature.observableChannel)
	)
		return
	const namesTwo = channels.size >= 2
	const namesResponse = [...channels].some((channel) =>
		RESPONSE_SIDE_CHANNELS.has(channel),
	)
	if (namesTwo && namesResponse) return
	failures.push({
		code: 'condition-channels-underspecified',
		artifactPath: probePath(probe, '.defectSignature.condition.predicate'),
		detail: `names ${channels.size === 0 ? 'no channel' : [...channels].map((channel) => `"${channel}"`).join(', ')}, which is neither the declared observableChannel "${signature.observableChannel}" nor two channels with a response-side member (AD-40)`,
	})
}

/**
 * Every distinct channel one expression reads.
 *
 * A bound-element pointer roots at no step identifier, so it names no channel of
 * its own; it reads whatever the enclosing quantifier's collection is rooted in,
 * which `boundChannel` carries. Without that inheritance a disjunct made
 * entirely of `@/` comparisons over a response-body collection would look like
 * it reads nothing at all.
 */
function channelsNamedBy(
	expression: Expression,
	boundChannel: string | null,
): ReadonlySet<string> {
	const named = new Set<string>()
	forEachExpressionPointer(expression, (pointer) => {
		if (pointer.startsWith('@')) {
			if (boundChannel !== null) named.add(boundChannel)
			return
		}
		named.add(parseEvidenceTarget(pointer).channel)
	})
	return named
}

/** The channel a quantifier's collection is rooted in, where it has one. */
function collectionChannel(collection: Operand): string | null {
	if (!('pointer' in collection)) return null
	if (collection.pointer.startsWith('@')) return null
	return parseEvidenceTarget(collection.pointer).channel
}

/**
 * A disjunct that names only what was sent decides the whole condition on its
 * own, so the channel rule above passes on a predicate that discriminates
 * nothing.
 *
 * The channel rule counts the channels a condition names and cannot see where
 * the truth value comes from. `any(existence(call-inputs/body/title),
 * existence(response-body/message))` names two channels, one of them
 * response-side, and passes. Its first disjunct is true of every candidate,
 * because the selector's own binding already guarantees that key is present on
 * anything that became a candidate. The condition then resolves
 * `true` on the observation where the system behaved correctly, and a finding
 * citing it reports a catch: the catch rate 1.00 by construction, one level in
 * from the direct spelling.
 *
 * The rule is scoped to `any` and nothing else, because only a disjunction lets
 * one operand carry the verdict alone. Under `all` no single operand can, so a
 * sent-side conjunct is a legitimate half of the two-channel conditions AD-40's
 * wording exists to admit: "the response echoes the request body" is exactly
 * that shape. Syntactic and decidable from the expression, rather than an
 * attempt to decide what a predicate's truth actually depends on, which
 * quantifiers make undecidable.
 */
function checkDisjuncts(
	probe: Probe,
	signature: DefectSignature,
	failures: QualificationFailure[],
): void {
	const conditionPath = probePath(probe, '.defectSignature.condition.predicate')
	walkAnyNodes(
		signature.condition.predicate,
		'',
		null,
		(operand, path, bound) => {
			const named = channelsNamedBy(operand, bound)
			if ([...named].some((channel) => RESPONSE_SIDE_CHANNELS.has(channel))) {
				return
			}
			failures.push({
				code: 'condition-disjunct-without-response-channel',
				artifactPath: `${conditionPath}${path}`,
				detail: `this operand of "any" names ${named.size === 0 ? 'no channel at all' : [...named].map((channel) => `"${channel}"`).join(', ')}, so it can satisfy the whole condition without examining anything that came back (AD-40)`,
			})
		},
	)
}

/**
 * Visits each direct operand of every `any` node, wherever it sits, carrying the
 * channel the nearest enclosing quantifier's collection is rooted in. Path
 * spellings follow `walkExpression`'s, so a failure's artifact path reads the
 * same as every other one this module emits.
 */
function walkAnyNodes(
	expression: Expression,
	path: string,
	boundChannel: string | null,
	visit: (operand: Expression, path: string, bound: string | null) => void,
): void {
	if (expression.op === 'any') {
		expression.operands.forEach((operand, index) => {
			visit(operand, `${path}.operands[${index}]`, boundChannel)
		})
	}
	switch (expression.op) {
		case 'not':
		case 'all':
		case 'any':
			expression.operands.forEach((operand, index) => {
				walkAnyNodes(operand, `${path}.operands[${index}]`, boundChannel, visit)
			})
			return
		case 'for-all':
		case 'for-any':
			walkAnyNodes(
				expression.predicate,
				`${path}.predicate`,
				collectionChannel(expression.collection),
				visit,
			)
			return
		default:
			return
	}
}

// Each shipped legality check, run over the bare predicate and reported as a
// qualification reason. The structural failure's own artifact path and message
// are carried through, so a rejection reads the same on both sides of the
// boundary.
const LEGALITY_CHECKS: readonly {
	readonly code: QualificationFailureCode
	readonly needsOperation: boolean
	readonly run: (
		signature: DefectSignature,
		artifactPath: string,
		operation: Operation | null,
	) => void
}[] = [
	{
		code: 'condition-bound-element-outside-quantifier',
		needsOperation: false,
		run: (signature, artifactPath) => {
			checkExpressionBoundElementScope(
				signature.condition.predicate,
				artifactPath,
			)
		},
	},
	{
		code: 'condition-operand-illegal',
		needsOperation: false,
		run: (signature, artifactPath) => {
			checkExpressionOperandLegality(
				signature.condition.predicate,
				artifactPath,
			)
		},
	},
	{
		code: 'condition-regex-illegal',
		needsOperation: false,
		run: (signature, artifactPath) => {
			checkExpressionRegexConstructs(
				signature.condition.predicate,
				artifactPath,
			)
		},
	},
	{
		code: 'condition-quantifier-nesting',
		needsOperation: false,
		run: (signature, artifactPath) => {
			checkExpressionQuantifierNesting(
				signature.condition.predicate,
				artifactPath,
			)
		},
	},
	{
		code: 'condition-quantifier-over-non-collection',
		needsOperation: true,
		run: (signature, artifactPath, operation) => {
			if (operation === null) return
			checkExpressionQuantifierOverNonCollection(
				signature.condition.predicate,
				artifactPath,
				{ operation, legIds: [OBSERVED_STEP_ID] },
			)
		},
	},
	{
		code: 'condition-pointer-unwritable',
		needsOperation: true,
		run: (signature, artifactPath, operation) => {
			if (operation === null) return
			checkExpressionEvidenceReachability(
				signature.condition.predicate,
				artifactPath,
				operation,
			)
		},
	},
]

function runLegalityChecks(
	probe: Probe,
	signature: DefectSignature,
	homeOperation: Operation | null,
	failures: QualificationFailure[],
): void {
	const artifactPath = probePath(probe, '.defectSignature.condition.predicate')
	for (const check of LEGALITY_CHECKS) {
		if (check.needsOperation && homeOperation === null) continue
		try {
			check.run(signature, artifactPath, homeOperation)
		} catch (error) {
			if (!(error instanceof StructuralFailure)) throw error
			failures.push({
				code: check.code,
				artifactPath: error.artifactPath,
				detail: error.message,
			})
		}
	}
}

/**
 * AD-9's gate over one probe. `homeOperation` is the operation the signature
 * resolves to in whatever inventory the caller is qualifying against, or `null`
 * when there is none to qualify against; the three declaration-dependent checks
 * are skipped in that case and `declarationChecksRan` says so.
 */
export function qualifyProbe(
	probe: Probe,
	homeOperation: Operation | null,
): QualificationResult {
	const failures: QualificationFailure[] = []
	checkRoute(probe, failures)
	checkRouteEvidence(probe, failures)
	const signature = probe.expectedClean ? null : probe.defectSignature
	if (!probe.expectedClean) {
		if (probe.probeClass === 'canary') {
			if (signature !== null) {
				failures.push({
					code: 'signature-present-on-canary',
					artifactPath: probePath(probe, '.defectSignature'),
					detail:
						'a canary seeds no defect, so it declares no signature; AD-9 qualifies it by demonstrating that non-detection indicts the corpus or the fixture',
				})
			}
		} else if (signature === null) {
			failures.push({
				code: 'signature-absent',
				artifactPath: probePath(probe, '.defectSignature'),
				detail: `probeClass "${probe.probeClass}" seeds a defect, and AD-33 assigns an outcome only from a signature match, so a null signature makes this probe unscoreable (AD-40)`,
			})
		}
	}
	if (signature !== null) {
		if (signature.interfaceKind !== 'api') {
			failures.push({
				code: 'signature-interface-kind-unsupported',
				artifactPath: probePath(probe, '.defectSignature.interfaceKind'),
				detail: `"${signature.interfaceKind}" declares a method and a path template that mean nothing off an api interface; v0 keeps all four kinds in the enum so unsupported-interface-kind stays fireable contract-side (AD-19)`,
			})
		}
		checkObservableChannel(probe, signature, failures)
		const channels = checkOperandsAndCollectChannels(probe, signature, failures)
		checkChannels(probe, signature, channels, failures)
		checkDisjuncts(probe, signature, failures)
		if (homeOperation !== null) {
			checkSelectorKeys(probe, signature, homeOperation, failures)
		}
		runLegalityChecks(probe, signature, homeOperation, failures)
	}
	return {
		qualified: failures.length === 0,
		failures,
		declarationChecksRan: signature === null || homeOperation !== null,
	}
}

export type QualifiedProbe = {
	readonly probe: Probe
	readonly result: QualificationResult
}

export type SealedProbeSet = {
	/**
	 * Each admitted probe with the result that admitted it, not a bare probe.
	 * `declarationChecksRan` is the reason: an admission granted without an
	 * operation inventory skipped the three checks that read declared shapes,
	 * and a bare `Probe[]` would drop that fact at the seal. A sealed set whose
	 * admissions were only half-checked is a different artifact from one whose
	 * admissions were fully checked, and whoever scores it has to be able to
	 * tell them apart.
	 */
	readonly admitted: readonly QualifiedProbe[]
	readonly rejected: readonly QualifiedProbe[]
}

/**
 * AD-9's "an unqualified probe cannot enter a sealed set", as a
 * construction-time filter that reports its exclusions.
 *
 * Construction-time, and score never re-filters. Silently dropping an
 * unqualified probe at score time would shrink AD-7's denominator and
 * desynchronise the AD-8 corpus digest from the probes actually scored, while
 * AD-7 makes comparability the corpus digest restricted to the probes both
 * results cover. A sealed set that nonetheless contains an unqualified probe is
 * an invalidating condition for whoever scores it, never something the witness
 * match quietly repairs.
 *
 * `homeOperationOf` is required rather than defaulted. A default resolving
 * nothing would make the unchecked path the one a caller reaches by writing
 * less, and the three checks it skips are the ones that catch a signature that
 * was never writable and a selector that matches nothing. A caller who holds
 * no inventory writes `() => null` at the call site, where the choice shows up
 * in a diff.
 */
export function sealProbeSet(
	probes: readonly Probe[],
	homeOperationOf: (probe: Probe) => Operation | null,
): SealedProbeSet {
	const admitted: QualifiedProbe[] = []
	const rejected: QualifiedProbe[] = []
	for (const probe of probes) {
		const result = qualifyProbe(probe, homeOperationOf(probe))
		if (result.qualified) admitted.push({ probe, result })
		else rejected.push({ probe, result })
	}
	return { admitted, rejected }
}
