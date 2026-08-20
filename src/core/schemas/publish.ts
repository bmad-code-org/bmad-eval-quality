/** the published JSON Schema export: twelve self-contained documents. */
import { z } from 'zod'
import {
	INTERCHANGE_ARTIFACT_KEYS,
	INTERCHANGE_ARTIFACTS,
	type InterchangeArtifactKey,
} from './artifact.ts'
import {
	CONSTRAINT_LEDGER,
	type ConstraintLedgerEntry,
} from './constraint-ledger.ts'

// This module sits downstream of all twelve schema modules and of the
// constraint ledger. No module under `src/core/schemas/` may import it: the
// reverse edge closes an import cycle and fails at module load with a
// temporal-dead-zone ReferenceError. It is pure (AD-1): no filesystem, network,
// clock, or randomness, and it never imports a validator — the runtime
// dependency set stays Zod alone, and the validator is a development dependency
// reachable only from `tests/` and `scripts/`.

/**
 * The synthesised `$id`. A URN rather than an `https://` locator: every
 * document is self-contained with only local `#/$defs/...` references, so the
 * base never needs to resolve, and a URL would promise a retrievable document
 * nothing serves. The version is deliberately absent: `schemaVersion` is an
 * in-band field, and AD-11's additive-bump discipline keeps the identifier
 * stable across bumps.
 */
export const publishedSchemaId = (key: InterchangeArtifactKey): string =>
	`urn:eval-quality:schema:${key}`

const unresolved = (entry: ConstraintLedgerEntry, segment: string): Error =>
	new Error(
		`constraint "${entry.id}" does not resolve: ${segment}. ` +
			'A silently skipped injection is the failure AD-13 exists to prevent, so this is a throw rather than a warning.',
	)

/**
 * Applies one `inject` ledger entry to a document, resolving the address
 * exactly as `resolve()` in `tests/schemas/constraint-ledger.test.ts` does —
 * by the stated `artifact`, `kind`, `branch`, and `field`, never by searching —
 * and failing loudly on any segment that does not resolve.
 */
type SchemaNode = Record<string, unknown>

const isNode = (value: unknown): value is SchemaNode =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

/** the branch's discriminator const, or undefined where the shape has none. */
const opConstOf = (candidate: unknown): unknown => {
	if (!isNode(candidate) || !isNode(candidate.properties)) return undefined
	const op = candidate.properties.op
	return isNode(op) ? op.const : undefined
}

const propertyOf = (candidate: unknown, field: string): unknown =>
	isNode(candidate) && isNode(candidate.properties)
		? candidate.properties[field]
		: undefined

export const injectConstraint = (
	document: Record<string, unknown>,
	entry: ConstraintLedgerEntry,
): void => {
	if (entry.disposition.kind !== 'inject')
		throw unresolved(entry, 'its disposition is not "inject"')
	// `items: false` bounds a tuple only beside 2020-12's `prefixItems`; under
	// draft-7 the same injection overwrites the exported tuple and every operand
	// list rejects everything. Read the field, never assume it.
	if (entry.disposition.dialect !== 'draft-2020-12')
		throw unresolved(
			entry,
			`dialect "${entry.disposition.dialect}" is not the export target "draft-2020-12"`,
		)
	const definitions = document.$defs
	const definition =
		entry.location.kind === 'root'
			? document
			: isNode(definitions)
				? definitions[entry.location.name]
				: undefined
	if (!isNode(definition))
		throw unresolved(
			entry,
			entry.location.kind === 'root'
				? 'the document root is not an object'
				: `no definition named "${entry.location.name}"`,
		)
	const branches = Array.isArray(definition.oneOf)
		? (definition.oneOf as unknown[])
		: undefined
	// Matched rather than found: two branches carrying the same discriminator
	// would make `find` inject into the first and skip the rest, which is the
	// silent skip every other throw in this function exists to prevent.
	const matched =
		entry.branch === null
			? undefined
			: (branches?.filter(
					(candidate) => opConstOf(candidate) === entry.branch,
				) ?? [])
	if (matched !== undefined && matched.length > 1)
		throw unresolved(
			entry,
			`${matched.length} oneOf branches carry op const "${entry.branch}", so the address names more than one shape`,
		)
	const target = entry.branch === null ? definition : matched?.[0]
	if (!isNode(target))
		throw unresolved(
			entry,
			`no oneOf branch whose op const is "${entry.branch}"`,
		)
	// The union fallback, kept for parity with the resolver of record: a
	// union-rooted shape exports `{ $schema, oneOf, description }` with no
	// `properties` object, and the field is spread into every branch. For
	// injection the keywords land on every branch's copy — the copies are equal
	// by construction, but aliasing is neither guaranteed nor excluded, and
	// assigning to one copy of several would inject into a single branch and
	// silently skip the rest.
	const field = entry.field
	const targetBranches = Array.isArray(target.oneOf)
		? (target.oneOf as unknown[])
		: undefined
	const sites: unknown[] =
		field === null
			? [target]
			: isNode(target.properties)
				? [target.properties[field]]
				: targetBranches !== undefined && targetBranches.length > 0
					? targetBranches.map((branch) => propertyOf(branch, field))
					: [undefined]
	if (!sites.every(isNode))
		throw unresolved(
			entry,
			`no property named "${entry.field}" at the located shape`,
		)
	// Deduped by object identity: where two branches DO alias one copy, writing
	// through the first alias would make the second trip the no-overwrite guard
	// below on a keyword this very call just planted.
	for (const site of new Set(sites as SchemaNode[])) {
		for (const [keyword, value] of Object.entries(entry.disposition.keywords)) {
			// An injection never overwrites: a keyword already present means the
			// export changed under the ledger, and clobbering it would hide that.
			if (keyword in site)
				throw unresolved(
					entry,
					`keyword "${keyword}" is already present at the site`,
				)
			site[keyword] = value
		}
	}
}

/**
 * The one pure builder (AD-13). Output mode, because the published schemas
 * describe artifacts as consumers receive them; Story 1.4 asserts all twelve
 * export byte-identically in both modes, so this is a statement of intent
 * rather than a change of bytes. Zod emits no `$id` at any level, so it is
 * synthesised here, second after `$schema`, with Zod's own key order unchanged
 * after it.
 */
export const publishedDocument = (
	key: InterchangeArtifactKey,
): Record<string, unknown> => {
	const exported = z.toJSONSchema(INTERCHANGE_ARTIFACTS[key].schema, {
		io: 'output',
	}) as Record<string, unknown>
	// Cloned before injection so mutation never reaches objects Zod may retain
	// or share across toJSONSchema calls. structuredClone preserves aliasing
	// WITHIN the cloned graph — two sites aliased in the export stay aliased in
	// the clone — which is why the injector below dedupes its sites by identity
	// rather than relying on the clone to separate them.
	const { $schema, ...rest } = structuredClone(exported)
	const document: Record<string, unknown> = {
		$schema,
		$id: publishedSchemaId(key),
		...rest,
	}
	for (const entry of CONSTRAINT_LEDGER) {
		if (entry.disposition.kind !== 'inject') continue
		if (entry.location.artifact !== key) continue
		injectConstraint(document, entry)
	}
	return document
}

/** all twelve, keyed by registry key; the registry is the only list walked. */
export const publishedDocuments = (): Record<
	InterchangeArtifactKey,
	Record<string, unknown>
> =>
	Object.fromEntries(
		INTERCHANGE_ARTIFACT_KEYS.map((key) => [key, publishedDocument(key)]),
	) as Record<InterchangeArtifactKey, Record<string, unknown>>

/**
 * AC 3's exact serialisation, shared by the generator and the drift check so
 * the two cannot disagree about bytes: 2-space indent, one trailing newline,
 * and every code unit above U+007F escaped as `\uXXXX` so the committed files
 * are pure ASCII — the same rule the test fixtures follow, and one byte-level
 * encoding variable removed from a byte-exact comparison.
 */
export const serializePublishedDocument = (
	document: Record<string, unknown>,
): string =>
	`${JSON.stringify(document, null, 2).replace(
		/[\u0080-\uffff]/g,
		(unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`,
	)}\n`
