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
 * Each flag with its reason, so a future author does not silence a genuine
 * finding by widening the wrong one:
 *
 * - `strict: true` stays on. Ajv's strict mode independently reproduced AD-13's
 *   predicted arity defect against the uninjected export, and `strictTuples`
 *   (part of strict) is the standing check that catches it again if a future
 *   export ships a bare `prefixItems`.
 * - `strictTypes: false` is required. The `minProperties: 1` injection lands at
 *   the root of `InputBindingChannel`, which exports as
 *   `{ anyOf: [objectBranch, { type: "null" }] }` and carries no `type` of its
 *   own; ajv's style opinion reports `missing type "object" for keyword
 *   "minProperties"`. The schema is correct — `minProperties` is ignored on a
 *   non-object instance, which is exactly why the ledger addresses the
 *   definition root.
 * - `formats: { 'date-time': true }` registers the format as always-true. The
 *   constraint is carried by the exported `pattern` (RFC 3339 UTC: trailing
 *   `Z` accepted, numeric offset rejected), so this silences ajv's
 *   unknown-format complaint without weakening anything. `ajv-formats` is
 *   deliberately not added (Decision 6): its `date-time` accepts numeric
 *   offsets and would manufacture a differential disagreement with Zod.
 */
export const VALIDATOR_OPTIONS: Options = {
	strict: true,
	strictTypes: false,
	formats: { 'date-time': true },
}

/**
 * Compiles one document on a fresh instance, with `allErrors: true` because
 * every consumer of this function reads the error set rather than only the
 * verdict. A fresh instance per call rather than one shared registry: the
 * synthesised `$id`s are unique across the twelve so either would work, and a
 * fresh instance is what the callers that compile variants of one document
 * need anyway.
 *
 * The two call sites that deviate from `VALIDATOR_OPTIONS` do so deliberately
 * and both spread it rather than restating it: the mutation sweep drops to
 * `allErrors: false` because it reads only the verdict, and the generator's
 * internal navigation compiles relax `strict` because they slice nodes out of
 * context. Neither belongs behind this function, which is why it takes no
 * options rather than carrying a parameter nothing passes.
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
