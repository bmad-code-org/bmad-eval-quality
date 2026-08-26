// The third-party validator, configured once so every check reads one option
// set (Decision 7 of Story 1.5). A validator written in this repository would
// be co-designed with the generator and agree with it by construction, which
// proves nothing about the consumer AD-13 exists to protect; ajv 8.20.0 earned
// its place by independently reporting the arity defect the constraint ledger
// repairs (`strict mode: "prefixItems" is 2-tuple, but minItems or
// maxItems/items are not specified`).

import { Ajv2020, type Options, type ValidateFunction } from 'ajv/dist/2020.js'
import type { InterchangeArtifactKey } from '../../../src/core/schemas/artifact.ts'
import { publishedDocuments } from '../../../src/core/schemas/publish.ts'

/**
 * Each flag with its reason, so a future author doesn't silence a genuine
 * finding by widening the wrong one:
 *
 * - `strict: true` stays on: it independently reproduced AD-13's predicted
 *   arity defect against the uninjected export, and `strictTuples` (part of
 *   strict) catches it again if a future export ships a bare `prefixItems`.
 * - `strictTypes: false` is required: the `minProperties: 1` injection lands
 *   on `InputBindingChannel`'s root, which exports as
 *   `{ anyOf: [objectBranch, { type: "null" }] }` with no `type` of its own,
 *   so ajv's style opinion reports `missing type "object" for keyword
 *   "minProperties"` on a schema that is correct as written.
 * - `formats: { 'date-time': true }` registers the format as always-true: the
 *   constraint is already carried by the exported `pattern` (RFC 3339 UTC),
 *   so this only silences ajv's unknown-format complaint. `ajv-formats` is
 *   deliberately not added (Decision 6): its `date-time` accepts numeric
 *   offsets and would manufacture a disagreement with Zod.
 */
export const VALIDATOR_OPTIONS: Options = {
	strict: true,
	strictTypes: false,
	formats: { 'date-time': true },
}

/**
 * Compiles one document on a fresh instance, with `allErrors: true` since
 * every consumer reads the error set, not just the verdict. Fresh per call,
 * not a shared registry: callers that compile variants of one document need
 * that anyway.
 *
 * The two call sites that deviate from `VALIDATOR_OPTIONS` spread it rather
 * than restate it: the mutation sweep drops to `allErrors: false` (verdict
 * only), and the generator's internal navigation relaxes `strict` (slices
 * nodes out of context). Neither belongs behind this function, so it takes no
 * options parameter.
 */
export const compileDocument = (
	document: Record<string, unknown>,
): ValidateFunction =>
	new Ajv2020({ ...VALIDATOR_OPTIONS, allErrors: true }).compile(
		structuredClone(document),
	)

const publishedCache = publishedDocuments()

/** the published document for one artifact, built once per test run. */
export const publishedDocumentOf = (
	key: InterchangeArtifactKey,
): Record<string, unknown> => publishedCache[key]

const validatorCache = new Map<InterchangeArtifactKey, ValidateFunction>()

/** the compiled published document, with `allErrors: true`, cached. */
export const publishedValidatorOf = (
	key: InterchangeArtifactKey,
): ValidateFunction => {
	const cached = validatorCache.get(key)
	if (cached) return cached
	const compiled = compileDocument(publishedCache[key])
	validatorCache.set(key, compiled)
	return compiled
}
