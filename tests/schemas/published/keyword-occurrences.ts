// One enumeration of mutable keyword occurrences, shared by the keyword-
// mutation sweep (AC 8) and the mutant generator (AC 9), so the two checks
// cannot disagree about what a "keyword occurrence" is; and one computed
// exemption rule for the occurrences that are structurally unkillable, so the
// exempt set is derived from the document rather than from a committed list a
// schema change could quietly outgrow.

/** an RFC 6901 token, escaped. */
export const escapeToken = (token: string): string =>
	token.replace(/~/g, '~0').replace(/\//g, '~1')

/** resolves an RFC 6901 pointer against a document. */
export const resolvePointer = (document: unknown, pointer: string): unknown => {
	if (pointer === '') return document
	let node: any = document
	for (const token of pointer.slice(1).split('/')) {
		const key = token.replace(/~1/g, '/').replace(/~0/g, '~')
		node = node?.[key]
	}
	return node
}

/**
 * Ajv reports `schemaPath` relative to the closest schema resource — an error
 * inside `$defs/Expression` arrives as `#/oneOf/0/...`, never as
 * `#/$defs/Expression/oneOf/0/...` — so an occurrence pointer matches a
 * reported path when the path is its def-relative suffix and the stripped
 * prefix is exactly one `$defs` entry (or empty, for root occurrences).
 *
 * Two tightenings, because a bare suffix rule over-matches: the fragment is
 * percent-decoded (ajv URI-encodes `schemaPath` while occurrence pointers are
 * raw JSON Pointers), and a def-relative reading is accepted only when the
 * same relative path names nothing at the document root — a root error such
 * as `#/oneOf/0/minItems` must not falsely witness
 * `/$defs/Foo/oneOf/0/minItems`. Residual slack, documented rather than
 * hidden: two `$defs` entries sharing an internal path are indistinguishable
 * from `schemaPath` alone; every call site also pins the instance path, and
 * no such collision exists in the current export (the three-way equality
 * checks would surface one as an unreachable/exempt mismatch).
 */
export const pointerMatchesSchemaPath = (
	document: Record<string, unknown>,
	occurrencePointer: string,
	schemaPath: string,
): boolean => {
	const fragment = schemaPath.startsWith('#') ? schemaPath.slice(1) : schemaPath
	let relative: string
	try {
		relative = decodeURIComponent(fragment)
	} catch {
		relative = fragment
	}
	if (occurrencePointer === relative) return true
	if (!occurrencePointer.endsWith(relative)) return false
	const prefix = occurrencePointer.slice(0, -relative.length)
	if (!/^\/\$defs\/[^/]+$/.test(prefix)) return false
	// conservative: when the relative path is ambiguous between the root and a
	// def, refuse the def reading — a wrongly refused genuine match surfaces as
	// an unreachable-vs-exempt inequality, never as a silent false witness
	return resolvePointer(document, relative) === undefined
}

export type KeywordOccurrence = {
	readonly keyword: string
	/** pointer to the keyword itself, e.g. `/$defs/Expression/oneOf/0/properties/operands/minItems`. */
	readonly pointer: string
	/** pointer to the schema node carrying the keyword. */
	readonly nodePointer: string
}

/**
 * Everything that is not a keyword occurrence: identity and annotation keys,
 * plus the two container maps whose member names are field names rather than
 * keywords — a walk that treated `properties` names as keywords would try to
 * delete a field called `type` from an artifact and report nonsense, and
 * deleting a whole `properties` object is a multi-violation mutation, which is
 * the shape AD-13's per-constraint proof rule forbids.
 */
export const EXCLUDED_KEYS: ReadonlySet<string> = new Set([
	'$schema',
	'$id',
	'$defs',
	'$ref',
	'description',
	'title',
	'properties',
	'definitions',
])

/** the keywords whose values are themselves schemas (or arrays of schemas). */
const SCHEMA_LIST_KEYWORDS = new Set(['anyOf', 'oneOf', 'prefixItems'])
const SCHEMA_VALUE_KEYWORDS = new Set([
	'items',
	'additionalProperties',
	'propertyNames',
])

export const mutableKeywordOccurrences = (
	document: Record<string, unknown>,
): KeywordOccurrence[] => {
	const occurrences: KeywordOccurrence[] = []
	const walk = (node: unknown, pointer: string): void => {
		if (node === null || typeof node !== 'object' || Array.isArray(node)) return
		for (const [key, value] of Object.entries(node)) {
			const childPointer = `${pointer}/${escapeToken(key)}`
			if (key === '$defs' || key === 'properties') {
				// Descend into values without treating the member names as keywords.
				for (const [name, child] of Object.entries(
					value as Record<string, unknown>,
				))
					walk(child, `${childPointer}/${escapeToken(name)}`)
				continue
			}
			if (EXCLUDED_KEYS.has(key)) continue
			occurrences.push({
				keyword: key,
				pointer: childPointer,
				nodePointer: pointer,
			})
			if (SCHEMA_LIST_KEYWORDS.has(key) && Array.isArray(value))
				value.forEach((child, index) => {
					walk(child, `${childPointer}/${index}`)
				})
			else if (SCHEMA_VALUE_KEYWORDS.has(key)) walk(value, childPointer)
		}
	}
	walk(document, '')
	return occurrences
}

const stripAnnotations = (node: any): any => {
	if (node === null || typeof node !== 'object') return node
	if (Array.isArray(node)) return node.map(stripAnnotations)
	const out: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(node)) {
		if (key === 'description' || key === 'title') continue
		out[key] = stripAnnotations(value)
	}
	return out
}

const deepEqual = (a: unknown, b: unknown): boolean =>
	JSON.stringify(a) === JSON.stringify(b)

/**
 * The `$defs` names whose definition is the universal-JSON acceptor: `anyOf`
 * over string, number, boolean, null, array of itself, and object of itself —
 * the Consistency Conventions' named exception. Such a subschema admits every
 * JSON instance, so no mutant can violate any keyword inside it and no
 * deletion inside it changes a verdict.
 */
export const universalAcceptorDefs = (
	document: Record<string, unknown>,
): Set<string> => {
	const names = new Set<string>()
	for (const [name, definition] of Object.entries(
		(document.$defs as Record<string, unknown>) ?? {},
	)) {
		const self = { $ref: `#/$defs/${name}` }
		const expected = {
			anyOf: [
				{ type: 'string' },
				{ type: 'number' },
				{ type: 'boolean' },
				{ type: 'null' },
				{ type: 'array', items: self },
				{
					type: 'object',
					propertyNames: { type: 'string' },
					additionalProperties: self,
				},
			],
		}
		if (deepEqual(stripAnnotations(definition), expected)) names.add(name)
	}
	return names
}

const PRIMITIVE_OF: Record<string, (value: unknown) => boolean> = {
	string: (value) => typeof value === 'string',
	number: (value) => typeof value === 'number',
	integer: (value) => typeof value === 'number' && Number.isInteger(value),
	boolean: (value) => typeof value === 'boolean',
	null: (value) => value === null,
	object: (value) =>
		typeof value === 'object' && value !== null && !Array.isArray(value),
	array: (value) => Array.isArray(value),
}

/**
 * The computed exempt set: occurrences whose deletion can change no verdict,
 * derived from the document by rule and never hand-listed. Both AC 8's
 * survivor list and AC 9's unreachable list are asserted equal to this —
 * a survivor outside it is a missing fixture, and an exempt occurrence that
 * becomes killable means a schema changed under the exemption.
 */
export const exemptOccurrencePointers = (
	document: Record<string, unknown>,
): Set<string> => {
	const acceptors = universalAcceptorDefs(document)
	const acceptorPrefixes = [...acceptors].map(
		(name) => `/$defs/${escapeToken(name)}/`,
	)
	const isBareAcceptorRef = (value: unknown): boolean =>
		typeof value === 'object' &&
		value !== null &&
		Object.keys(value).length === 1 &&
		typeof (value as { $ref?: unknown }).$ref === 'string' &&
		acceptors.has((value as { $ref: string }).$ref.replace('#/$defs/', ''))
	// 6. A subschema reached only through the universal acceptor's admission:
	//    a node carrying nothing but an `anyOf` in which one branch is the bare
	//    `{ "$ref": "#/$defs/JsonValue" }` admits every instance (the nullable
	//    value container, e.g. `responseBody`), so the `anyOf` and everything
	//    inside its sibling branches constrain nothing. This is AC 8's rule 1
	//    "or inside a subschema reached only through a $ref to it", computed.
	const vacuousUnionPrefixes: string[] = []
	const findVacuousUnions = (node: unknown, pointer: string): void => {
		if (node === null || typeof node !== 'object' || Array.isArray(node)) return
		const record = node as Record<string, unknown>
		const keys = Object.keys(record).filter(
			(key) => key !== 'description' && key !== 'title',
		)
		if (
			keys.length === 1 &&
			keys[0] === 'anyOf' &&
			Array.isArray(record.anyOf) &&
			record.anyOf.some(isBareAcceptorRef)
		) {
			vacuousUnionPrefixes.push(`${pointer}/`)
			return
		}
		for (const [key, value] of Object.entries(record)) {
			if (key === '$defs' || key === 'properties') {
				for (const [name, child] of Object.entries(
					value as Record<string, unknown>,
				))
					findVacuousUnions(
						child,
						`${pointer}/${escapeToken(key)}/${escapeToken(name)}`,
					)
				continue
			}
			if (Array.isArray(value))
				value.forEach((child, index) => {
					findVacuousUnions(child, `${pointer}/${escapeToken(key)}/${index}`)
				})
			else findVacuousUnions(value, `${pointer}/${escapeToken(key)}`)
		}
	}
	findVacuousUnions(document, '')
	const exempt = new Set<string>()
	for (const occurrence of mutableKeywordOccurrences(document)) {
		// 1. Inside a universal-JSON acceptor definition: admits every instance,
		//    so nothing inside it constrains anything.
		if (
			acceptorPrefixes.some((prefix) => occurrence.pointer.startsWith(prefix))
		) {
			exempt.add(occurrence.pointer)
			continue
		}
		if (
			vacuousUnionPrefixes.some((prefix) =>
				occurrence.pointer.startsWith(prefix),
			)
		) {
			exempt.add(occurrence.pointer)
			continue
		}
		const node = resolvePointer(document, occurrence.nodePointer) as Record<
			string,
			any
		>
		const value = node[occurrence.keyword]
		// 2. A `propertyNames` whose value is exactly `{ type: "string" }`, or the
		//    `type` inside any `propertyNames`: a JSON object key is always a
		//    string, so neither constrains anything.
		if (
			occurrence.keyword === 'propertyNames' &&
			deepEqual(stripAnnotations(value), { type: 'string' })
		) {
			exempt.add(occurrence.pointer)
			continue
		}
		if (
			occurrence.keyword === 'type' &&
			occurrence.nodePointer.endsWith('/propertyNames')
		) {
			exempt.add(occurrence.pointer)
			continue
		}
		// 3. `format`: registered always-true on the validator (Decision 6), so
		//    its deletion is a no-op by construction.
		if (occurrence.keyword === 'format') {
			exempt.add(occurrence.pointer)
			continue
		}
		// 7. An `items` subschema under `maxItems: 0`, and the `items` keyword
		//    itself on such a node: the array must be empty for the node to admit
		//    anything (the clean-control probe's `defects`), so no element ever
		//    exists for the item schema to constrain and deleting any of it
		//    changes no verdict. Computed like the others; a Story 1.5
		//    construction recorded in the story's Dev Agent Record.
		const deadItems = (nodePointer: string): boolean => {
			const holder = resolvePointer(document, nodePointer) as
				| Record<string, unknown>
				| undefined
			return (
				holder !== undefined &&
				holder.maxItems === 0 &&
				holder.items !== undefined
			)
		}
		if (occurrence.keyword === 'items' && deadItems(occurrence.nodePointer)) {
			exempt.add(occurrence.pointer)
			continue
		}
		{
			let deadAncestor = false
			for (
				let itemsIndex = occurrence.pointer.indexOf('/items/');
				itemsIndex > 0;
				itemsIndex = occurrence.pointer.indexOf('/items/', itemsIndex + 1)
			) {
				if (deadItems(occurrence.pointer.slice(0, itemsIndex))) {
					deadAncestor = true
					break
				}
			}
			if (deadAncestor) {
				exempt.add(occurrence.pointer)
				continue
			}
		}
		// 4. An `items` or `additionalProperties` whose value is the bare
		//    `{ "$ref": "#/$defs/JsonValue" }` (any universal acceptor): it left
		//    its members unconstrained before the deletion and after it.
		if (
			(occurrence.keyword === 'items' ||
				occurrence.keyword === 'additionalProperties') &&
			typeof value === 'object' &&
			value !== null &&
			Object.keys(value).length === 1 &&
			typeof value.$ref === 'string' &&
			acceptors.has(value.$ref.replace('#/$defs/', ''))
		) {
			exempt.add(occurrence.pointer)
			continue
		}
		// 5. A `type` made redundant by a sibling `const` or `enum` whose every
		//    member is of the stated type. Zod exports `z.literal` and `z.enum`
		//    with both keys, and any instance the type rejects is already rejected
		//    by the const or enum, so the deletion changes no verdict. This clause
		//    is a Story 1.5 construction: AC 8 named four rules, the sweep found
		//    87 such occurrences surviving outside them, and the pinned decision
		//    rule says to settle the gap here and record it rather than reopen the
		//    architecture. Computed from the document like the other four.
		if (occurrence.keyword === 'type' && typeof value === 'string') {
			const admits = PRIMITIVE_OF[value]
			const members: unknown[] | undefined =
				node.const !== undefined
					? [node.const]
					: Array.isArray(node.enum)
						? node.enum
						: undefined
			if (admits !== undefined && members?.every((member) => admits(member))) {
				exempt.add(occurrence.pointer)
			}
		}
	}
	return exempt
}
