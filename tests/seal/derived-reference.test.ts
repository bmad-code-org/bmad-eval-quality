import { describe, expect, it } from 'vitest'
import type { InteractionStep } from '../../src/core/schemas/plan.ts'
import {
	EVIDENCE_CHANNELS,
	TRANSPORT_CHANNELS,
} from '../../src/core/schemas/pointer.ts'
import {
	renderEvidenceReferences,
	renderStepReference,
} from '../../src/core/seal/derived-reference.ts'
import {
	buildPlanIndex,
	resolveOperation,
	resolveStep,
} from '../../src/core/seal/plan-index.ts'
import {
	capturedChainPair,
	capturedCollisionPair,
	createThenReadBack,
	fiveStepAfterChain,
	fourStepAfterChain,
	gateCInteractionPlan,
	gateCPermittedInterfaces,
	irreducibleCollisionPair,
	linearAfterChain,
	literalCollisionPair,
	outOfOrderBindingKeys,
	principalCollisionPair,
	reverseAfterPair,
	sameFieldTemporalPair,
	sameStepPair,
	sharedKeyAcrossChannels,
	threeStepSharedAfter,
	unboundStep,
} from './fixtures.ts'

const gateCIndex = buildPlanIndex(
	gateCInteractionPlan,
	gateCPermittedInterfaces,
)

describe('renderEvidenceReferences: operation naming and no step identifiers', () => {
	it('names the operation via the derived-reference vocabulary, never the step id', () => {
		const text = renderEvidenceReferences(
			['/interactions/poll/response-body/state'],
			gateCIndex,
		)
		expect(text).toContain('get export')
		expect(text).not.toContain('poll')
	})

	it("reproduces AD-16's own worked example category: a type-violating binding renders as malformed, never as the step id, and names only the malformed key (not a co-declared non-malformed one)", () => {
		const text = renderEvidenceReferences(
			['/interactions/malformed-submit/response-status'],
			gateCIndex,
		)
		expect(text.toLowerCase()).toMatch(/malformed|invalid/)
		expect(text).toContain('filters')
		expect(text).not.toContain('malformed-submit')
		// `malformed-submit` also binds `datasetId` (a plain, non-malformed
		// literal); the malformed-salience rule must name only the malformed
		// entry, not both.
		expect(text).not.toContain('datasetId')
	})
})

describe('renderStepReference: the escalation ladder and its injectivity', () => {
	it("the phrase map over gateCContract's six steps is injective when each is explicitly scoped against every step sharing its own operation (the escalation mechanism can fully disambiguate them, even though production scoping under Decision 12 is narrower, per direction)", () => {
		const phrases = gateCInteractionPlan.map((step) => {
			const operation = resolveOperation(gateCIndex, step.operationId)
			const siblings = gateCInteractionPlan.filter(
				(other) => other.operationId === step.operationId,
			)
			return renderStepReference(step, operation, siblings, gateCIndex)
		})
		expect(new Set(phrases).size).toBe(gateCInteractionPlan.length)
	})

	it('escalates from the generic form to the discriminating binding kind when both colliding siblings are explicitly in scope (poll vs. unknown-job-read)', () => {
		const poll = resolveStep(gateCIndex, 'poll')
		const unknownJobRead = resolveStep(gateCIndex, 'unknown-job-read')
		const operation = resolveOperation(gateCIndex, 'get-export')
		const siblings = [poll, unknownJobRead]
		const pollPhrase = renderStepReference(
			poll,
			operation,
			siblings,
			gateCIndex,
		)
		const unknownPhrase = renderStepReference(
			unknownJobRead,
			operation,
			siblings,
			gateCIndex,
		)
		expect(pollPhrase).not.toBe(unknownPhrase)
		expect(pollPhrase).toContain('supplied path jobId')
		expect(unknownPhrase).toContain('stated path jobId')
	})

	it("does not escalate when the colliding sibling is outside this call's own scope (Decision 12: distinctness is direction-scoped, not plan-wide): poll rendered alone stays at the generic level", () => {
		const poll = resolveStep(gateCIndex, 'poll')
		const operation = resolveOperation(gateCIndex, 'get-export')
		// This is poll's real production scope: gateCContract never references
		// poll and unknown-job-read together in one direction, so poll alone has
		// no collision to escalate against.
		const phrase = renderStepReference(poll, operation, [poll], gateCIndex)
		expect(phrase).toBe(
			'the get export endpoint (with the supplied path jobId)',
		)
	})

	it('two steps sharing an operation and colliding at the kind level escalate to the literal value', () => {
		const index = buildPlanIndex(
			literalCollisionPair.interactionPlan,
			literalCollisionPair.permittedInterfaces,
		)
		const [stepA, stepB] = literalCollisionPair.interactionPlan
		if (stepA === undefined || stepB === undefined)
			throw new Error('fixture malformed')
		const operation = resolveOperation(index, 'read-widget')
		const siblings = [stepA, stepB]
		const phraseA = renderStepReference(stepA, operation, siblings, index)
		const phraseB = renderStepReference(stepB, operation, siblings, index)
		expect(phraseA).not.toBe(phraseB)
		expect(phraseA).toContain('widget-a')
		expect(phraseB).toContain('widget-b')
	})

	it('an irreducible collision (identical bindings on one operation) throws once escalation is exhausted, rather than silently shipping an ambiguous phrase', () => {
		const index = buildPlanIndex(
			irreducibleCollisionPair.interactionPlan,
			irreducibleCollisionPair.permittedInterfaces,
		)
		const [stepA, stepB] = irreducibleCollisionPair.interactionPlan
		if (stepA === undefined || stepB === undefined)
			throw new Error('fixture malformed')
		const operation = resolveOperation(index, 'ping-service')
		const siblings = [stepA, stepB]
		expect(() =>
			renderStepReference(stepA, operation, siblings, index),
		).toThrow(TypeError)
		expect(() =>
			renderStepReference(stepB, operation, siblings, index),
		).toThrow(TypeError)
	})

	it('a step binding nothing in any channel still renders, with the binding clause omitted', () => {
		const index = buildPlanIndex(
			unboundStep.interactionPlan,
			unboundStep.permittedInterfaces,
		)
		const step = resolveStep(index, 'ping')
		const operation = resolveOperation(index, 'ping-service')
		const phrase = renderStepReference(step, operation, [step], index)
		expect(phrase).toBe('the ping service endpoint')
	})

	it('two steps binding one key to different declared principals escalate one rung: the generic form collides, the kind rung names each principal', () => {
		const index = buildPlanIndex(
			principalCollisionPair.interactionPlan,
			principalCollisionPair.permittedInterfaces,
		)
		const owner = resolveStep(index, 'read-as-owner')
		const auditor = resolveStep(index, 'read-as-auditor')
		const operation = resolveOperation(index, 'read-widget')
		// The generic rung, reached by rendering one of them alone: what the two
		// would share, and therefore what forces the escalation below.
		expect(renderStepReference(owner, operation, [owner], index)).toBe(
			'the read widget endpoint (with the supplied path widgetId)',
		)
		const siblings = [owner, auditor]
		expect(renderStepReference(owner, operation, siblings, index)).toBe(
			'the read widget endpoint (with the path widgetId of the owner account)',
		)
		expect(renderStepReference(auditor, operation, siblings, index)).toBe(
			'the read widget endpoint (with the path widgetId of the auditor account)',
		)
	})

	it('two steps capturing one key from different predecessors collide at the kind rung and escalate to the literal rung, where the captured-from operation and local phrase differ', () => {
		const index = buildPlanIndex(
			capturedCollisionPair.interactionPlan,
			capturedCollisionPair.permittedInterfaces,
		)
		const primary = resolveStep(index, 'probe-primary')
		const secondary = resolveStep(index, 'probe-secondary')
		const operation = resolveOperation(index, 'read-widget')
		const siblings = [primary, secondary]
		const primaryPhrase = renderStepReference(
			primary,
			operation,
			siblings,
			index,
		)
		const secondaryPhrase = renderStepReference(
			secondary,
			operation,
			siblings,
			index,
		)
		// Flattening the top rung to a level-independent phrase leaves these two
		// identical, which is what makes `renderStepReference` throw. Naming the
		// captured-from operation alone is not enough either: the rung recurses
		// one level into the predecessor, so its own binding clause is what
		// separates two predecessors sharing an operation.
		expect(primaryPhrase).not.toBe(secondaryPhrase)
		expect(primaryPhrase).toBe(
			'the read widget endpoint (with the path widgetId you obtained as its id field from the create alpha widget endpoint (with the supplied body title))',
		)
		expect(secondaryPhrase).toBe(
			'the read widget endpoint (with the path widgetId you obtained as its id field from the create beta widget endpoint (with the supplied body title))',
		)
	})

	it('a captured binding rendered at the literal rung names no step identifier, though its declared pointer carries one', () => {
		const index = buildPlanIndex(
			capturedCollisionPair.interactionPlan,
			capturedCollisionPair.permittedInterfaces,
		)
		const primary = resolveStep(index, 'probe-primary')
		const secondary = resolveStep(index, 'probe-secondary')
		const operation = resolveOperation(index, 'read-widget')
		const siblings = [primary, secondary]
		const phrases = siblings.map((step) =>
			renderStepReference(step, operation, siblings, index),
		)
		for (const phrase of phrases) {
			for (const step of capturedCollisionPair.interactionPlan) {
				expect(phrase).not.toContain(step.stepId)
			}
		}
	})

	it('a two-link capture chain follows the chain to where the links actually differ, rather than stopping one hop in', () => {
		// Both mid steps call one operation and bind one key, so showing only the
		// immediate predecessor renders the two probes identically and
		// `renderStepReference` throws. The literal that separates them sits on
		// the base steps, one link further back.
		const index = buildPlanIndex(
			capturedChainPair.interactionPlan,
			capturedChainPair.permittedInterfaces,
		)
		const alpha = resolveStep(index, 'probe-alpha')
		const beta = resolveStep(index, 'probe-beta')
		const operation = resolveOperation(index, 'read-widget')
		const siblings = [alpha, beta]

		const alphaPhrase = renderStepReference(alpha, operation, siblings, index)
		const betaPhrase = renderStepReference(beta, operation, siblings, index)
		expect(alphaPhrase).not.toBe(betaPhrase)
		expect(alphaPhrase).toContain('the body title "alpha"')
		expect(betaPhrase).toContain('the body title "beta"')
		for (const phrase of [alphaPhrase, betaPhrase]) {
			for (const step of capturedChainPair.interactionPlan) {
				expect(phrase).not.toContain(step.stepId)
			}
		}
	})

	it('a capture cycle driven straight into the renderer terminates on the on-path guard rather than recursing', () => {
		// `binding-cycle` rejects both shapes at compile time, so `seal()` never
		// meets one. The guard is what keeps this function total for a caller
		// holding an uncompiled plan.
		const [alphaWidget] = capturedChainPair.permittedInterfaces
		if (alphaWidget === undefined) throw new Error('fixture malformed')
		const cyclic: InteractionStep[] = [
			{
				stepId: 'loop-one',
				operationId: 'read-widget',
				inputBinding: {
					path: {
						widgetId: { captured: '/interactions/loop-two/response-body/id' },
					},
					query: null,
					header: null,
					body: null,
				},
				after: null,
				cardinality: 'exactly-one',
			},
			{
				stepId: 'loop-two',
				operationId: 'read-widget',
				inputBinding: {
					path: {
						widgetId: { captured: '/interactions/loop-one/response-body/id' },
					},
					query: null,
					header: null,
					body: null,
				},
				after: null,
				cardinality: 'exactly-one',
			},
			{
				stepId: 'loop-self',
				operationId: 'read-widget',
				inputBinding: {
					path: {
						widgetId: { captured: '/interactions/loop-self/response-body/id' },
					},
					query: null,
					header: null,
					body: null,
				},
				after: null,
				cardinality: 'exactly-one',
			},
		]
		const index = buildPlanIndex(cyclic, [alphaWidget])
		const operation = resolveOperation(index, 'read-widget')
		for (const stepId of ['loop-one', 'loop-two', 'loop-self']) {
			const step = resolveStep(index, stepId)
			expect(renderStepReference(step, operation, [step], index)).toBe(
				'the read widget endpoint (with the supplied path widgetId)',
			)
		}
	})

	it('a captured pointer the index cannot resolve falls back to the kind phrase rather than throwing, whether the step or its operation is the piece missing', () => {
		// `seal()` runs after `compile`, which rejects an unresolvable captured
		// pointer, so both shapes here are reachable only by driving the renderer
		// directly. The resolvable sibling keeps the pair distinct, so escalation
		// still reaches the literal rung and the fallback is what actually renders.
		const [widgetApi] = capturedCollisionPair.permittedInterfaces
		if (widgetApi === undefined) throw new Error('fixture malformed')
		const indexes = [
			buildPlanIndex(
				capturedCollisionPair.interactionPlan.filter(
					(step) => step.stepId !== 'stash-secondary',
				),
				capturedCollisionPair.permittedInterfaces,
			),
			buildPlanIndex(capturedCollisionPair.interactionPlan, [
				{
					...widgetApi,
					operations: widgetApi.operations.filter(
						(operation) => operation.operationId !== 'create-beta-widget',
					),
				},
			]),
		]
		for (const index of indexes) {
			const primary = resolveStep(index, 'probe-primary')
			const secondary = resolveStep(index, 'probe-secondary')
			const operation = resolveOperation(index, 'read-widget')
			const siblings = [primary, secondary]
			expect(renderStepReference(secondary, operation, siblings, index)).toBe(
				'the read widget endpoint (with the path widgetId you obtained earlier)',
			)
			expect(renderStepReference(primary, operation, siblings, index)).toBe(
				'the read widget endpoint (with the path widgetId you obtained as its id field from the create alpha widget endpoint (with the supplied body title))',
			)
		}
	})

	it("bindingEntries sorts keys canonically regardless of declared order, matching canonicalize.ts's key-sorting rule", () => {
		const index = buildPlanIndex(
			outOfOrderBindingKeys.interactionPlan,
			outOfOrderBindingKeys.permittedInterfaces,
		)
		const step = resolveStep(index, 'submit-both')
		const operation = resolveOperation(index, 'submit-multi')
		const phrase = renderStepReference(step, operation, [step], index)
		const appleIndex = phrase.indexOf('apple')
		const zebraIndex = phrase.indexOf('zebra')
		expect(appleIndex).toBeGreaterThanOrEqual(0)
		expect(zebraIndex).toBeGreaterThan(appleIndex)
	})
})

describe('the exhaustive evidence-channel sweep', () => {
	it('every evidence channel renders without throwing, sent-versus-obtained appropriately', () => {
		for (const channel of EVIDENCE_CHANNELS) {
			// No tail: exercises each channel's own base framing directly. The
			// tail-naming behavior ("its {field} field") is asserted separately
			// by the same-step-grouping and injectivity tests above.
			const pointer =
				channel === 'call-inputs'
					? '/interactions/submit/call-inputs/body'
					: `/interactions/poll/${channel}`
			const text = renderEvidenceReferences([pointer], gateCIndex)
			expect(text.length).toBeGreaterThan(0)
			if (channel === 'call-inputs') {
				expect(text).toContain('you sent')
			} else {
				expect(text).toMatch(/you obtained|transport status|exit code/)
			}
		}
	})

	it('every transport channel under call-inputs renders without throwing', () => {
		for (const transportChannel of TRANSPORT_CHANNELS) {
			const pointer = `/interactions/submit/call-inputs/${transportChannel}/x`
			expect(() =>
				renderEvidenceReferences([pointer], gateCIndex),
			).not.toThrow()
		}
	})

	it('response-headers, stdout, and stderr each render their tail-bearing field name directly, not only their no-tail framing', () => {
		expect(
			renderEvidenceReferences(
				['/interactions/poll/response-headers/etag'],
				gateCIndex,
			),
		).toContain('etag header')
		expect(
			renderEvidenceReferences(['/interactions/poll/stdout/line'], gateCIndex),
		).toContain('line field of its standard output')
		expect(
			renderEvidenceReferences(['/interactions/poll/stderr/line'], gateCIndex),
		).toContain('line field of its standard error')
	})

	it('response-body and stdout sharing a field name on one step render distinct wording, not the same "field" text for both channels', () => {
		const text = renderEvidenceReferences(
			[
				'/interactions/poll/response-body/line',
				'/interactions/poll/stdout/line',
			],
			gateCIndex,
		)
		expect(text).toContain('its line field')
		expect(text).toContain('the line field of its standard output')
	})

	it('call-inputs targets on different transport channels sharing a parameter name render distinctly, naming the channel every time (not only in the no-tail fallback)', () => {
		const index = buildPlanIndex(
			sharedKeyAcrossChannels.interactionPlan,
			sharedKeyAcrossChannels.permittedInterfaces,
		)
		const text = renderEvidenceReferences(
			[
				'/interactions/query-and-path/call-inputs/path/id',
				'/interactions/query-and-path/call-inputs/query/id',
			],
			index,
		)
		expect(text).toContain('the path id value you sent')
		expect(text).toContain('the query id value you sent')
	})
})

describe('an empty RFC 6901 tail token', () => {
	it('a wholly empty tail is treated as no tail rather than spliced in as a blank field name', () => {
		const text = renderEvidenceReferences(
			['/interactions/poll/response-body/'],
			gateCIndex,
		)
		expect(text).toContain('the response body you obtained')
		expect(text).not.toMatch(/\s{2,}/)
		expect(text).not.toMatch(/its\s+field/)
	})

	it('a trailing empty token after a real segment drops just the blank segment, not the whole tail', () => {
		const text = renderEvidenceReferences(
			['/interactions/poll/response-body/a/'],
			gateCIndex,
		)
		expect(text).toContain('its a field')
		expect(text).not.toMatch(/\s{2,}/)
	})
})

describe('a multi-segment tail (patch 11)', () => {
	it('renders the full path joined by "." so two different parents sharing one leaf field name do not collapse', () => {
		const text = renderEvidenceReferences(
			[
				'/interactions/poll/response-body/a/id',
				'/interactions/poll/response-body/b/id',
			],
			gateCIndex,
		)
		expect(text).toContain('its a.id field')
		expect(text).toContain('its b.id field')
	})
})

describe('same-step multi-target grouping', () => {
	it('groups two targets on one step into one reference naming both fields', () => {
		const text = renderEvidenceReferences(
			[
				'/interactions/poll/response-status',
				'/interactions/poll/response-body/state',
			],
			gateCIndex,
		)
		expect(text).toContain('get export')
		expect(text).toContain('transport status')
		expect(text).toContain('state field')
	})

	it('groups three targets on one step (O-003 shape)', () => {
		const text = renderEvidenceReferences(
			[
				'/interactions/poll/response-body/error',
				'/interactions/poll/response-body/failureReason',
				'/interactions/poll/response-body/jobId',
			],
			gateCIndex,
		)
		expect(text).toContain('error field')
		expect(text).toContain('failureReason field')
		expect(text).toContain('jobId field')
	})

	it('a same-step pair with no temporal relationship does not take the relational-phrase branch', () => {
		const index = buildPlanIndex(
			sameStepPair.interactionPlan,
			sameStepPair.permittedInterfaces,
		)
		const text = renderEvidenceReferences(
			sameStepPair.direction.evidenceTargets,
			index,
		)
		expect(text).not.toContain('compared with')
	})

	it('gateCContract O-008 (a sibling cross-check over two untemporal steps) does not take the relational-phrase branch', () => {
		const text = renderEvidenceReferences(
			[
				'/interactions/unknown-job-read/response-status',
				'/interactions/unknown-job-rows/response-status',
			],
			gateCIndex,
		)
		expect(text).not.toContain('compared with')
	})

	it('two unrelated single-step phrases, each carrying a binding clause, join with a recoverable structure: the binding clause is parenthesized, not comma-joined onto the outer "and"', () => {
		const text = renderEvidenceReferences(
			[
				'/interactions/unknown-job-read/response-status',
				'/interactions/unknown-job-rows/response-status',
			],
			gateCIndex,
		)
		expect(text).toMatch(
			/\(with the supplied path jobId\) and its transport status/,
		)
	})
})

describe('AC 4: the temporal read-back collision', () => {
	it('gateCContract O-001 (poll.after === submit) renders one relational phrase, sent side first, without sequencing language', () => {
		const text = renderEvidenceReferences(
			[
				'/interactions/poll/response-body/submittedFilters',
				'/interactions/submit/call-inputs/body/filters',
			],
			gateCIndex,
		)
		expect(text).toContain('compared with')
		expect(text).toContain('filters')
		expect(text).toContain('submittedFilters')
		// The "sent" (call-inputs) phrase prints first: pins the specific
		// expected order rather than only permutation-invariance, which a
		// constant argument order would trivially satisfy too.
		const sentIndex = text.indexOf('value you sent')
		const obtainedIndex = text.indexOf('field from')
		expect(sentIndex).toBeGreaterThanOrEqual(0)
		expect(obtainedIndex).toBeGreaterThan(sentIndex)
		for (const banned of ['first', 'then', 'before', 'after', 'subsequently']) {
			expect(text.toLowerCase()).not.toContain(banned)
		}
	})

	it('is byte-identical whichever of the two targets is listed first (declaration order is later-step first in the real fixture)', () => {
		const a = renderEvidenceReferences(
			[
				'/interactions/poll/response-body/submittedFilters',
				'/interactions/submit/call-inputs/body/filters',
			],
			gateCIndex,
		)
		const b = renderEvidenceReferences(
			[
				'/interactions/submit/call-inputs/body/filters',
				'/interactions/poll/response-body/submittedFilters',
			],
			gateCIndex,
		)
		expect(a).toBe(b)
	})

	it('a reverse-shaped pair (the response-reading step is the predecessor, the call-inputs-sending step is the successor) still prints the sent side first: order is governed by channel rank, not by which side the grouping assigned as predecessor', () => {
		const index = buildPlanIndex(
			reverseAfterPair.interactionPlan,
			reverseAfterPair.permittedInterfaces,
		)
		const text = renderEvidenceReferences(
			reverseAfterPair.direction.evidenceTargets,
			index,
		)
		const sentIndex = text.indexOf('value you sent')
		const obtainedIndex = text.indexOf('field from')
		expect(sentIndex).toBeGreaterThanOrEqual(0)
		expect(obtainedIndex).toBeGreaterThan(sentIndex)
		const reversed = renderEvidenceReferences(
			[...reverseAfterPair.direction.evidenceTargets].reverse(),
			index,
		)
		expect(reversed).toBe(text)
	})

	it('the authored create-then-read-back pair takes the relational-phrase branch with no sequencing language and no step id', () => {
		const index = buildPlanIndex(
			createThenReadBack.interactionPlan,
			createThenReadBack.permittedInterfaces,
		)
		const text = renderEvidenceReferences(
			createThenReadBack.direction.evidenceTargets,
			index,
		)
		expect(text).toContain('compared with')
		expect(text).toContain('create widget')
		expect(text).toContain('read widget')
		expect(text).not.toContain('stash')
		expect(text).not.toContain('fetch')
		for (const banned of ['first', 'then', 'before', 'after', 'subsequently']) {
			expect(text.toLowerCase()).not.toContain(banned)
		}
	})

	it('a genuine channel-signature tie (the same field read from two different after-linked steps) still orders deterministically, not by argument order', () => {
		const index = buildPlanIndex(
			sameFieldTemporalPair.interactionPlan,
			sameFieldTemporalPair.permittedInterfaces,
		)
		const [pointerA, pointerB] = sameFieldTemporalPair.direction.evidenceTargets
		if (pointerA === undefined || pointerB === undefined) {
			throw new Error('fixture malformed')
		}
		const declared = renderEvidenceReferences([pointerA, pointerB], index)
		const reversed = renderEvidenceReferences([pointerB, pointerA], index)
		expect(declared).toBe(reversed)
		expect(declared).toContain('compared with')
		expect(declared).toContain('read first widget')
		expect(declared).toContain('read second widget')
	})

	it('a repeated pointer is deduplicated, so a genuine temporal pair still forms even if one side is declared twice', () => {
		const text = renderEvidenceReferences(
			[
				'/interactions/poll/response-body/submittedFilters',
				'/interactions/submit/call-inputs/body/filters',
				'/interactions/submit/call-inputs/body/filters',
			],
			gateCIndex,
		)
		expect(text).toContain('compared with')
	})

	it('two later steps naming the same after predecessor: only one pairs with it, and the grouping does not depend on evidenceTargets order', () => {
		const index = buildPlanIndex(
			threeStepSharedAfter.interactionPlan,
			threeStepSharedAfter.permittedInterfaces,
		)
		const [base, reader1, reader2] =
			threeStepSharedAfter.direction.evidenceTargets
		if (base === undefined || reader1 === undefined || reader2 === undefined) {
			throw new Error('fixture malformed')
		}
		const orderings = [
			[base, reader1, reader2],
			[reader2, reader1, base],
			[reader1, base, reader2],
			[reader2, base, reader1],
		]
		const rendered = orderings.map((pointers) =>
			renderEvidenceReferences(pointers, index),
		)
		for (const text of rendered) {
			expect(text).toBe(rendered[0])
			// Exactly one relational-phrase group forms. `base` pairs with
			// whichever of reader1/reader2 wins and the other stands alone.
			// Never both, and never `base` reused across two "compared with"
			// clauses.
			expect(text.split('compared with').length - 1).toBe(1)
			expect(text).toContain('create base')
			expect(text).toContain('read one')
			expect(text).toContain('read two')
		}
	})

	it('a 3-step linear after chain (step-b names step-a, step-c names step-b) does not drop step-c: exactly one pair forms and the chained-off step renders standalone', () => {
		const index = buildPlanIndex(
			linearAfterChain.interactionPlan,
			linearAfterChain.permittedInterfaces,
		)
		const [a, b, c] = linearAfterChain.direction.evidenceTargets
		if (a === undefined || b === undefined || c === undefined) {
			throw new Error('fixture malformed')
		}
		const orderings = [
			[a, b, c],
			[c, b, a],
			[b, a, c],
			[c, a, b],
			[b, c, a],
		]
		const rendered = orderings.map((pointers) =>
			renderEvidenceReferences(pointers, index),
		)
		for (const text of rendered) {
			expect(text).toBe(rendered[0])
			// All three steps' evidence survives, none dropped, and only
			// `step-a`/`step-b` (the first link) form a relational phrase;
			// `step-b` cannot also pair with `step-c`, since it is already
			// used as `step-a`'s partner, so `step-c` renders on its own.
			expect(text).toContain('chain op a')
			expect(text).toContain('chain op b')
			expect(text).toContain('chain op c')
			expect(text.split('compared with').length - 1).toBe(1)
		}
	})

	it('a 4-step linear after chain forms two disjoint pairs, not one: (step-1, step-2) and (step-3, step-4), with nothing dropped', () => {
		const index = buildPlanIndex(
			fourStepAfterChain.interactionPlan,
			fourStepAfterChain.permittedInterfaces,
		)
		const [s1, s2, s3, s4] = fourStepAfterChain.direction.evidenceTargets
		if (
			s1 === undefined ||
			s2 === undefined ||
			s3 === undefined ||
			s4 === undefined
		) {
			throw new Error('fixture malformed')
		}
		const orderings = [
			[s1, s2, s3, s4],
			[s4, s3, s2, s1],
			[s3, s1, s4, s2],
			[s2, s4, s1, s3],
		]
		const rendered = orderings.map((pointers) =>
			renderEvidenceReferences(pointers, index),
		)
		for (const text of rendered) {
			expect(text).toBe(rendered[0])
			expect(text).toContain('chain op 1')
			expect(text).toContain('chain op 2')
			expect(text).toContain('chain op 3')
			expect(text).toContain('chain op 4')
			// The pre-fix collapse only ever formed the chain's first pair and
			// dropped the second pairing's relational phrase (both steps still
			// rendered, but each stood alone). Two pairs is the regression test:
			// past 4+ steps, every disjoint predecessor/successor link the chain
			// can support must survive, not just the first.
			expect(text.split('compared with').length - 1).toBe(2)
		}
	})

	it('a 5-step linear after chain forms two disjoint pairs plus one standalone step: the odd remainder does not silently vanish or get force-paired', () => {
		const index = buildPlanIndex(
			fiveStepAfterChain.interactionPlan,
			fiveStepAfterChain.permittedInterfaces,
		)
		const text = renderEvidenceReferences(
			fiveStepAfterChain.direction.evidenceTargets,
			index,
		)
		expect(text).toContain('chain op 1')
		expect(text).toContain('chain op 2')
		expect(text).toContain('chain op 3')
		expect(text).toContain('chain op 4')
		expect(text).toContain('chain op 5')
		expect(text.split('compared with').length - 1).toBe(2)

		const reversed = renderEvidenceReferences(
			[...fiveStepAfterChain.direction.evidenceTargets].reverse(),
			index,
		)
		expect(reversed).toBe(text)
	})
})

describe('AC 5: determinism by permutation', () => {
	it('the same input rendered twice is byte-identical', () => {
		const pointers = [
			'/interactions/poll/response-body/submittedFilters',
			'/interactions/submit/call-inputs/body/filters',
		]
		expect(renderEvidenceReferences(pointers, gateCIndex)).toBe(
			renderEvidenceReferences(pointers, gateCIndex),
		)
	})

	it("is byte-identical under every permutation of a three-target direction's evidenceTargets", () => {
		const pointers = [
			'/interactions/poll/response-body/error',
			'/interactions/poll/response-body/failureReason',
			'/interactions/poll/response-body/jobId',
		]
		const baseline = renderEvidenceReferences(pointers, gateCIndex)
		const permutations = [
			[pointers[2], pointers[0], pointers[1]],
			[pointers[1], pointers[2], pointers[0]],
			[pointers[2], pointers[1], pointers[0]],
		] as string[][]
		for (const permuted of permutations) {
			expect(renderEvidenceReferences(permuted, gateCIndex)).toBe(baseline)
		}
	})

	it('is byte-identical against an index built from a permuted interactionPlan and permuted permittedInterfaces', () => {
		const pointers = [
			'/interactions/poll/response-body/submittedFilters',
			'/interactions/submit/call-inputs/body/filters',
		]
		const baseline = renderEvidenceReferences(pointers, gateCIndex)
		const permutedPlan = [...gateCInteractionPlan].reverse()
		const permutedInterfaces = gateCPermittedInterfaces.map((iface) => ({
			...iface,
			operations: [...iface.operations].reverse(),
		}))
		const permutedIndex = buildPlanIndex(permutedPlan, permutedInterfaces)
		expect(renderEvidenceReferences(pointers, permutedIndex)).toBe(baseline)
	})
})

describe('resolution failures', () => {
	it('throws TypeError when an evidence target names a step the plan does not declare', () => {
		expect(() =>
			renderEvidenceReferences(
				['/interactions/does-not-exist/response-status'],
				gateCIndex,
			),
		).toThrow(TypeError)
	})
})
