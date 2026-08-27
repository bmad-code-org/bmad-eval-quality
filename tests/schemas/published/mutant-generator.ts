// The schema-directed mutant generator (AC 9 of Story 1.5). Walks a published
// document alongside every positive fixture and, for each mutable keyword
// occurrence reachable from those fixtures, produces one instance that
// violates that keyword and, as far as it can, nothing else. Deleting keyword
// K is expected to make exactly the instance built to violate K start
// passing, which is what makes the keyword-mutation sweep decidable.
//
// The sweep mutates the SCHEMA (deletes a keyword occurrence); this generator
// mutates the INSTANCE (produces a value the intact keyword rejects).
//
// Deterministic on purpose: no Math.random, no clock, no filesystem access
// (AD-30). Every choice is a fixed candidate order or a value derived from the
// schema itself, so two runs produce byte-identical output.

import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js'
import {
	escapeToken,
	mutableKeywordOccurrences,
	pointerMatchesSchemaPath,
	resolvePointer,
} from './keyword-occurrences.ts'
import { VALIDATOR_OPTIONS } from './validator.ts'

export type GeneratedMutant = {
	/** occurrence pointer plus a discriminating suffix where one occurrence yields several mutants. */
	readonly id: string
	/** the keyword occurrence this instance is built to violate. */
	readonly occurrencePointer: string
	readonly keyword: string
	/** where in the instance the violation sits. */
	readonly instancePointer: string
	/** the full mutated artifact instance. */
	readonly value: unknown
}

export type MutantGeneration = {
	readonly mutants: readonly GeneratedMutant[]
	/**
	 * Valid instances synthesised for union branches and empty containers no
	 * fixture populates, each verified accepted by the intact document. They
	 * join the corpus so a schema deletion that NARROWS the document (e.g.
	 * deleting `prefixItems` beside `items: false`) has an accepted member to
	 * flip.
	 */
	readonly witnesses: readonly { id: string; value: unknown }[]
	/**
	 * Occurrences for which no mutant could be produced. Asserted equal to the
	 * computed exempt set, not merely a subset or non-empty: silent truncation
	 * would make a partial sweep read as a complete one.
	 */
	readonly unreachable: ReadonlySet<string>
}

type Seed = { readonly id: string; readonly value: unknown }

/** plants a replacement subtree into a fresh clone of the seed instance. */
type Plant = (subtree: unknown) => unknown

type Site = {
	readonly value: unknown
	readonly pointer: string
	readonly plant: Plant
	/** `key` when the schema node constrains object member NAMES (propertyNames). */
	readonly kind: 'value' | 'key'
	/** for `key` sites: plants a whole entries-map so a crafted key can be added. */
	readonly parentValue?: Record<string, unknown>
	readonly parentPlant?: Plant
	readonly memberSchema?: unknown
}

// Deterministic base pool for pattern-satisfying synthesis; the seeds' own
// strings are harvested on top of these, so every committed pattern that some
// fixture satisfies is synthesisable from the fixture that satisfies it.
const BASE_STRING_POOL = [
	'a',
	'a-b',
	'ab',
	'x',
	'B-001',
	'D-001',
	'F-001',
	'O-001',
	'P-001',
	'R-001',
	'RC-001',
	'W-001',
	`sha256:${'0'.repeat(64)}`,
	'2026-01-01T00:00:00Z',
	'0.01',
	'1.00',
	'GET',
	'POST',
	'/a',
	'/a/b',
	'/things',
	'/things/{id}',
	'@/id',
	'^(?:a)$',
	'',
]

// Candidates for "a string the pattern rejects": tried in order against the
// compiled node so sibling keywords stay satisfied.
const PATTERN_VIOLATION_POOL = [
	'ZZ !! not matching',
	'!',
	'_',
	'@/x',
	'a b',
	'A',
	'0',
	'',
	'sha256:ABC',
	'2026-01-01T00:00:00+02:00',
]

// Candidates for "a value matching no branch" and for violating an arbitrary
// subschema, tried in order.
const NO_BRANCH_POOL: readonly unknown[] = [
	42.5,
	false,
	'zz-no-branch-matches',
	{},
	[],
	null,
	0,
]

const harvestStrings = (value: unknown, into: Set<string>): void => {
	if (typeof value === 'string') into.add(value)
	else if (Array.isArray(value))
		for (const member of value) harvestStrings(member, into)
	else if (value !== null && typeof value === 'object')
		for (const [key, member] of Object.entries(value)) {
			into.add(key)
			harvestStrings(member, into)
		}
}

export const generateMutants = (
	document: Record<string, unknown>,
	seeds: readonly Seed[],
	fullValidator: ValidateFunction,
): MutantGeneration => {
	const occurrences = mutableKeywordOccurrences(document)
	const stringPool = ((): readonly string[] => {
		const harvested = new Set<string>(BASE_STRING_POOL)
		for (const seed of seeds) harvestStrings(seed.value, harvested)
		return [...harvested].sort()
	})()

	// Internal navigation compiles: branch-match tests and violating-value
	// searches. `strict: false` here on purpose, since these wrappers slice
	// nodes out of context and only guide where to mutate; the four checks
	// themselves run on the full documents under the recorded option set.
	const nodeValidators = new Map<string, ValidateFunction>()
	const validatorAt = (pointer: string): ValidateFunction => {
		const cached = nodeValidators.get(pointer)
		if (cached) return cached
		const node = resolvePointer(document, pointer)
		const compiled = new Ajv2020({
			...VALIDATOR_OPTIONS,
			strict: false,
		}).compile(
			structuredClone({
				...(node as Record<string, unknown>),
				$defs: document.$defs,
			}),
		)
		nodeValidators.set(pointer, compiled)
		return compiled
	}
	const matches = (pointer: string, value: unknown): boolean =>
		validatorAt(pointer)(value) === true

	// ---- schema-directed synthesis ------------------------------------------
	// Best-effort valid example of a subschema, used to descend into union
	// branches no fixture takes and into empty containers. Returns FAIL when a
	// constraint can't be satisfied from the pools; occurrences beneath it then
	// surface in the unreachable report instead of being silently skipped.
	//
	// Known unhandled keywords: `multipleOf`, `exclusiveMaximum`, `maxLength`,
	// `maxProperties`, `patternProperties` (none occur in the current export;
	// the census in keyword-mutation.test.ts enumerates what does). A
	// synthesized value violating one of these is dropped by the keep-criterion
	// and surfaces later as a confusing exempt-set inequality, so extend this
	// synthesiser first when that happens.
	const FAIL = Symbol('unsynthesisable')
	const synthesize = (
		node: any,
		stack: readonly string[],
	): unknown | typeof FAIL => {
		if (node === null || typeof node !== 'object') return FAIL
		if (typeof node.$ref === 'string') {
			if (stack.includes(node.$ref)) return FAIL
			return synthesize(resolvePointer(document, node.$ref.slice(1)), [
				...stack,
				node.$ref,
			])
		}
		if (node.const !== undefined) return structuredClone(node.const)
		if (Array.isArray(node.enum)) return structuredClone(node.enum[0])
		for (const composition of ['anyOf', 'oneOf'] as const) {
			if (Array.isArray(node[composition])) {
				for (const branch of node[composition]) {
					const candidate = synthesize(branch, stack)
					if (candidate !== FAIL) return candidate
				}
				return FAIL
			}
		}
		switch (node.type) {
			case 'string': {
				if (typeof node.pattern === 'string') {
					const expression = new RegExp(node.pattern)
					const found = stringPool.find(
						(candidate) =>
							expression.test(candidate) &&
							candidate.length >= (node.minLength ?? 0),
					)
					return found ?? FAIL
				}
				return 'x'.repeat(node.minLength ?? 1)
			}
			case 'integer':
			case 'number': {
				const value =
					node.exclusiveMinimum !== undefined
						? node.exclusiveMinimum + 1
						: (node.minimum ?? 0)
				// Clamping DOWN to `maximum` would violate the lower bound it was
				// derived from; a synthetic that violates its own subschema is worse
				// than none, since it's silently dropped later and resurfaces as a
				// confusing exempt-set inequality. Report unsynthesisable instead.
				if (node.maximum !== undefined && node.maximum < value) return FAIL
				return value
			}
			case 'boolean':
				return true
			case 'null':
				return null
			case 'array': {
				if (Array.isArray(node.prefixItems)) {
					const members = node.prefixItems.map((member: unknown) =>
						synthesize(member, stack),
					)
					return members.includes(FAIL) ? FAIL : members
				}
				const length = node.minItems ?? 0
				if (length === 0) return []
				const member = synthesize(node.items, stack)
				if (member === FAIL) return FAIL
				return Array.from({ length }, () => structuredClone(member))
			}
			case 'object': {
				const out: Record<string, unknown> = {}
				for (const [name, member] of Object.entries(
					(node.properties as Record<string, unknown>) ?? {},
				)) {
					const value = synthesize(member, stack)
					if (value === FAIL) return FAIL
					out[name] = value
				}
				if (
					Object.keys(out).length === 0 &&
					(node.minProperties ?? 0) > 0 &&
					node.additionalProperties !== undefined &&
					node.additionalProperties !== false
				) {
					const key = keySatisfying(node.propertyNames)
					const value = synthesize(node.additionalProperties, stack)
					if (key === FAIL || value === FAIL) return FAIL
					out[key as string] = value
				}
				return out
			}
			default:
				return FAIL
		}
	}

	const keySatisfying = (nameSchema: any): string | typeof FAIL => {
		if (nameSchema === undefined) return 'a'
		const expression =
			typeof nameSchema.pattern === 'string'
				? new RegExp(nameSchema.pattern)
				: null
		const found = stringPool.find(
			(candidate) =>
				(expression === null || expression.test(candidate)) &&
				candidate.length >= (nameSchema.minLength ?? 0),
		)
		return found ?? FAIL
	}

	/** first pool value the subschema at `pointer` rejects, or FAIL. */
	const violating = (pointer: string): unknown | typeof FAIL => {
		const found = NO_BRANCH_POOL.find(
			(candidate) => !matches(pointer, candidate),
		)
		return found === undefined ? FAIL : structuredClone(found)
	}

	// ---- navigation ---------------------------------------------------------
	// Two passes, first conforming location wins per schema node. Pass one
	// walks only what the fixtures actually contain, so every site backed by a
	// real instance is claimed before synthesis is allowed anywhere; pass two
	// fills the remainder (union branches no fixture takes, empty containers)
	// from synthesised values. Without this ordering, a synthetic context could
	// claim a shared definition first and plant mutants inside a subtree some
	// other constraint already rejects. The per-path stack guards recursion for
	// the self-referential definitions (Expression, JsonValue, CheckResolution).
	const sites = new Map<string, Site>()
	const witnesses: { id: string; value: unknown }[] = []
	const witnessed = new Set<string>()
	const visit = (
		pointer: string,
		value: unknown,
		instancePointer: string,
		plant: Plant,
		stack: ReadonlySet<string>,
		synthetic: boolean,
	): void => {
		if (stack.has(pointer)) return
		const deeper = new Set(stack).add(pointer)
		const node = resolvePointer(document, pointer) as any
		if (node === null || typeof node !== 'object') return
		if (typeof node.$ref === 'string') {
			visit(
				node.$ref.slice(1),
				value,
				instancePointer,
				plant,
				deeper,
				synthetic,
			)
			return
		}
		if (!sites.has(pointer))
			sites.set(pointer, {
				value,
				pointer: instancePointer,
				plant,
				kind: 'value',
			})
		// properties: seeds are valid and every declared key is required, so the
		// member is present whenever the instance took this shape.
		if (node.properties !== undefined && isRecord(value)) {
			for (const name of Object.keys(node.properties)) {
				if (!(name in value)) continue
				visit(
					`${pointer}/properties/${escapeToken(name)}`,
					value[name],
					`${instancePointer}/${escapeToken(name)}`,
					(subtree) => plant({ ...value, [name]: subtree }),
					deeper,
					synthetic,
				)
			}
		}
		for (const composition of ['anyOf', 'oneOf'] as const) {
			if (!Array.isArray(node[composition])) continue
			node[composition].forEach((_branch: unknown, index: number) => {
				const branchPointer = `${pointer}/${composition}/${index}`
				if (matches(branchPointer, value)) {
					visit(branchPointer, value, instancePointer, plant, deeper, synthetic)
					return
				}
				if (!synthetic) return
				// A branch no fixture takes is still reachable: descend on a
				// synthesised branch instance planted at the same location, so a
				// keyword inside it gets a real mutant, not a silent skip. The
				// planted instance also joins the corpus as a witness, because a
				// deletion can NARROW a branch (`prefixItems` beside `items: false`)
				// and only an accepted member can flip on that.
				const example = synthesize(resolvePointer(document, branchPointer), [])
				if (example === FAIL) return
				// `witnessed` is marked only on acceptance: a synthetic planted into
				// one seed context can be rejected there (another constraint on that
				// context) while a later context would accept it, and marking early
				// would block that later contribution permanently.
				if (!witnessed.has(branchPointer)) {
					const planted = plant(example)
					if (fullValidator(planted) === true) {
						witnessed.add(branchPointer)
						witnesses.push({ id: `witness${branchPointer}`, value: planted })
					}
				}
				visit(branchPointer, example, instancePointer, plant, deeper, synthetic)
			})
		}
		if (Array.isArray(node.prefixItems) && Array.isArray(value)) {
			node.prefixItems.forEach((_member: unknown, index: number) => {
				if (index >= value.length) return
				visit(
					`${pointer}/prefixItems/${index}`,
					value[index],
					`${instancePointer}/${index}`,
					(subtree) => plant(value.map((v, i) => (i === index ? subtree : v))),
					deeper,
					synthetic,
				)
			})
		}
		if (
			node.items !== undefined &&
			node.items !== false &&
			node.prefixItems === undefined &&
			// maxItems: 0 makes the item schema dead code (no element can exist for
			// it to constrain), so it's skipped here and exempted by rule.
			node.maxItems !== 0 &&
			Array.isArray(value)
		) {
			if (value.length > 0) {
				visit(
					`${pointer}/items`,
					value[0],
					`${instancePointer}/0`,
					(subtree) => plant(value.map((v, i) => (i === 0 ? subtree : v))),
					deeper,
					synthetic,
				)
			} else if (synthetic) {
				const example = synthesize(node.items, [])
				if (example !== FAIL) {
					const itemsPointer = `${pointer}/items`
					if (!witnessed.has(itemsPointer)) {
						const planted = plant([example])
						if (fullValidator(planted) === true) {
							witnessed.add(itemsPointer)
							witnesses.push({ id: `witness${itemsPointer}`, value: planted })
						}
					}
					visit(
						itemsPointer,
						example,
						`${instancePointer}/0`,
						(subtree) => plant([subtree]),
						deeper,
						synthetic,
					)
				}
			}
		}
		if (
			node.additionalProperties !== undefined &&
			node.additionalProperties !== false &&
			node.properties === undefined &&
			isRecord(value)
		) {
			const names = Object.keys(value)
			if (names.length > 0) {
				const name = names[0] as string
				visit(
					`${pointer}/additionalProperties`,
					value[name],
					`${instancePointer}/${escapeToken(name)}`,
					(subtree) => plant({ ...value, [name]: subtree }),
					deeper,
					synthetic,
				)
			} else if (synthetic) {
				const key = keySatisfying(node.propertyNames)
				const example = synthesize(node.additionalProperties, [])
				if (key !== FAIL && example !== FAIL)
					visit(
						`${pointer}/additionalProperties`,
						example,
						`${instancePointer}/${escapeToken(key as string)}`,
						(subtree) => plant({ ...value, [key as string]: subtree }),
						deeper,
						synthetic,
					)
			}
		}
		if (node.propertyNames !== undefined && isRecord(value)) {
			// The name schema constrains keys, not values: record a `key` site so
			// the mutation phase adds a crafted key rather than replacing a value.
			const namePointer = `${pointer}/propertyNames`
			if (!sites.has(namePointer)) {
				sites.set(namePointer, {
					value,
					pointer: instancePointer,
					plant,
					kind: 'key',
					parentValue: value,
					parentPlant: plant,
					memberSchema:
						node.additionalProperties === undefined ||
						node.additionalProperties === false
							? undefined
							: node.additionalProperties,
				})
			}
		}
	}

	// pass one: fixture-backed sites only; pass two: synthesis fills the rest.
	for (const synthetic of [false, true] as const)
		for (const seed of seeds)
			visit('', seed.value, '', (subtree) => subtree, new Set(), synthetic)

	// ---- mutation -----------------------------------------------------------
	const mutants: GeneratedMutant[] = []
	const reached = new Set<string>()

	type Evidence =
		| { readonly kind: 'exact'; readonly instancePointer: string }
		| { readonly kind: 'within'; readonly instancePointer: string }

	/**
	 * Keeps a candidate only when the full document rejects it, the rejection
	 * carries the target occurrence, and no sibling keyword at the same schema
	 * node also fired at the same instance location: the "and nothing else"
	 * half, which keeps a `type` beside a `const` out of the corpus and in the
	 * unreachable report, where the exemption rule expects it.
	 */
	const tryCandidate = (
		occurrence: { pointer: string; keyword: string; nodePointer: string },
		candidateInstance: unknown,
		evidence: Evidence,
	): boolean => {
		if (fullValidator(candidateInstance) === true) return false
		const errors = fullValidator.errors ?? []
		const target = errors.find((error) => {
			if (evidence.kind === 'exact')
				return (
					pointerMatchesSchemaPath(
						document,
						occurrence.pointer,
						error.schemaPath,
						error.instancePath,
					) && error.instancePath === evidence.instancePointer
				)
			return (
				error.instancePath === evidence.instancePointer ||
				error.instancePath.startsWith(`${evidence.instancePointer}/`)
			)
		})
		if (target === undefined) return false
		if (evidence.kind === 'exact') {
			const node = resolvePointer(document, occurrence.nodePointer) as Record<
				string,
				unknown
			>
			const siblingPointers = Object.keys(node)
				.filter((key) => key !== occurrence.keyword)
				.map((key) => `${occurrence.nodePointer}/${escapeToken(key)}`)
			const dirty = errors.some(
				(error) =>
					error.instancePath === evidence.instancePointer &&
					siblingPointers.some((pointer) =>
						pointerMatchesSchemaPath(
							document,
							pointer,
							error.schemaPath,
							error.instancePath,
						),
					),
			)
			if (dirty) return false
		}
		return true
	}

	const emit = (
		occurrence: { pointer: string; keyword: string; nodePointer: string },
		suffix: string,
		candidateInstance: unknown,
		instancePointer: string,
		evidence: Evidence,
	): boolean => {
		if (!tryCandidate(occurrence, candidateInstance, evidence)) return false
		mutants.push({
			id:
				suffix === '' ? occurrence.pointer : `${occurrence.pointer}#${suffix}`,
			occurrencePointer: occurrence.pointer,
			keyword: occurrence.keyword,
			instancePointer,
			value: candidateInstance,
		})
		reached.add(occurrence.pointer)
		return true
	}

	for (const occurrence of occurrences) {
		const site = sites.get(occurrence.nodePointer)
		if (site === undefined) continue
		const node = resolvePointer(document, occurrence.nodePointer) as any
		const raw = node[occurrence.keyword]
		const { value, pointer: at, plant } = site
		const exact: Evidence = { kind: 'exact', instancePointer: at }

		if (site.kind === 'key') {
			// Mutations against a name schema add one crafted key with a valid
			// member value; a key of a non-string type cannot exist, so `type`
			// inside propertyNames yields nothing here by construction.
			if (
				occurrence.keyword === 'pattern' ||
				occurrence.keyword === 'minLength'
			) {
				const memberValue =
					site.memberSchema === undefined
						? true
						: synthesize(site.memberSchema, [])
				if (memberValue === FAIL) continue
				const expression =
					occurrence.keyword === 'pattern' ? new RegExp(raw) : null
				const badKey =
					occurrence.keyword === 'minLength'
						? 'x'.repeat(Math.max(0, raw - 1))
						: PATTERN_VIOLATION_POOL.find((k) => !expression?.test(k))
				if (badKey === undefined) continue
				const mutated = site.parentPlant?.({
					...(site.parentValue as Record<string, unknown>),
					[badKey]: memberValue,
				})
				emit(occurrence, `key:${occurrence.keyword}`, mutated, at, exact)
			}
			continue
		}

		switch (occurrence.keyword) {
			case 'type': {
				const candidates: unknown[] =
					raw === 'string'
						? [1.5, true]
						: raw === 'integer'
							? // a fraction above the minimum violates only `integer`; the
								// numeric siblings still hold, so the deletion flips it cleanly
								[(node.minimum ?? 0) + 0.25, 'zz-not-a-number', true]
							: raw === 'number'
								? ['zz-not-a-number', true]
								: raw === 'boolean'
									? ['zz-not-a-boolean', 1.5]
									: raw === 'object'
										? [1.5, 'zz-not-an-object']
										: raw === 'array'
											? [1.5, 'zz-not-an-array']
											: [false, 1.5, 'zz-not-null']
				for (const candidate of candidates)
					if (emit(occurrence, '', plant(candidate), at, exact)) break
				break
			}
			case 'const': {
				const candidates: unknown[] =
					typeof raw === 'string'
						? [`${raw}-out-of-set`, 'zz-out-of-set']
						: typeof raw === 'number'
							? [raw + 1]
							: typeof raw === 'boolean'
								? [!raw]
								: ['zz-out-of-set']
				let emitted = false
				for (const candidate of candidates)
					if (emit(occurrence, '', plant(candidate), at, exact)) {
						emitted = true
						break
					}
				// A boolean `const` discriminating a two-branch `oneOf` admits no
				// rejected single-violation mutant: the only other boolean value is
				// the sibling branch's discriminator, so the flipped instance is
				// accepted through that branch. The keyword is still killable:
				// deleting it collapses the two branches, so the flipped instance
				// then matches both and fails `oneOf`. The honest pairing is
				// therefore a witness whose verdict changes on deletion (accepted
				// intact, rejected without the const), verified here by compiling
				// the deletion so a broken collapse surfaces as unreachable, not a
				// silent pass.
				if (!emitted && typeof raw === 'boolean') {
					const flipped = plant(!raw)
					if (fullValidator(flipped) === true) {
						const mutilated = structuredClone(document)
						const holder = resolvePointer(
							mutilated,
							occurrence.nodePointer,
						) as Record<string, unknown>
						delete holder[occurrence.keyword]
						try {
							const withoutConst = new Ajv2020(VALIDATOR_OPTIONS).compile(
								mutilated,
							)
							if (withoutConst(flipped) === false) {
								mutants.push({
									id: `${occurrence.pointer}#flip`,
									occurrencePointer: occurrence.pointer,
									keyword: occurrence.keyword,
									instancePointer: at,
									value: flipped,
								})
								reached.add(occurrence.pointer)
							}
						} catch {
							// uncompilable without the const: leave it unreachable
						}
					}
				}
				break
			}
			case 'enum': {
				const members: unknown[] = raw
				const candidates: unknown[] =
					typeof members[0] === 'string'
						? ['zz-out-of-set'].filter((c) => !members.includes(c))
						: typeof members[0] === 'number'
							? [Math.max(...(members as number[])) + 1]
							: ['zz-out-of-set']
				for (const candidate of candidates)
					if (emit(occurrence, '', plant(candidate), at, exact)) break
				break
			}
			case 'pattern': {
				const expression = new RegExp(raw)
				for (const candidate of PATTERN_VIOLATION_POOL) {
					if (expression.test(candidate)) continue
					if (emit(occurrence, '', plant(candidate), at, exact)) break
				}
				break
			}
			case 'minLength': {
				emit(occurrence, '', plant('x'.repeat(Math.max(0, raw - 1))), at, exact)
				break
			}
			case 'minimum': {
				emit(occurrence, '', plant(raw - 1), at, exact)
				break
			}
			case 'maximum': {
				emit(occurrence, '', plant(raw + 1), at, exact)
				break
			}
			case 'exclusiveMinimum': {
				// the boundary value itself
				emit(occurrence, '', plant(raw), at, exact)
				break
			}
			case 'required': {
				if (!isRecord(value)) break
				for (const member of raw as string[]) {
					const { [member]: _dropped, ...rest } = value
					emit(occurrence, member, plant(rest), at, exact)
				}
				break
			}
			case 'additionalProperties': {
				if (raw === false) {
					if (!isRecord(value)) break
					emit(
						occurrence,
						'',
						plant({ ...value, 'zz-undeclared': true }),
						at,
						exact,
					)
					break
				}
				// schema-valued: one member value that violates the member schema
				if (!isRecord(value)) break
				const bad = violating(occurrence.pointer)
				if (bad === FAIL) break
				const names = Object.keys(value)
				const name =
					names.length > 0
						? (names[0] as string)
						: keySatisfying(node.propertyNames)
				if (name === FAIL) break
				emit(
					occurrence,
					'member',
					plant({ ...value, [name as string]: bad }),
					`${at}/${escapeToken(name as string)}`,
					{
						kind: 'within',
						instancePointer: `${at}/${escapeToken(name as string)}`,
					},
				)
				break
			}
			case 'propertyNames': {
				// Only a non-vacuous name schema is violable; the mutation itself is
				// handled through the `key` site recorded on the same node, which
				// carries the crafted-key machinery.
				const keySite = sites.get(occurrence.pointer)
				if (keySite?.kind !== 'key' || !isRecord(keySite.parentValue)) break
				const nameSchema = raw
				const expression =
					typeof nameSchema.pattern === 'string'
						? new RegExp(nameSchema.pattern)
						: null
				const badKey = PATTERN_VIOLATION_POOL.find(
					(candidate) =>
						(expression !== null && !expression.test(candidate)) ||
						candidate.length < (nameSchema.minLength ?? 0),
				)
				if (badKey === undefined) break
				const memberValue =
					keySite.memberSchema === undefined
						? true
						: synthesize(keySite.memberSchema, [])
				if (memberValue === FAIL) break
				emit(
					occurrence,
					'',
					keySite.parentPlant?.({
						...(keySite.parentValue as Record<string, unknown>),
						[badKey]: memberValue,
					}),
					at,
					exact,
				)
				break
			}
			case 'minItems': {
				if (!Array.isArray(value)) break
				emit(
					occurrence,
					'',
					plant(value.slice(0, Math.max(0, raw - 1))),
					at,
					exact,
				)
				break
			}
			case 'maxItems': {
				if (!Array.isArray(value)) break
				const extra =
					value.length > 0
						? structuredClone(value[value.length - 1])
						: synthesize(node.items ?? {}, [])
				if (extra === FAIL) break
				emit(occurrence, '', plant([...value, extra]), at, exact)
				break
			}
			case 'items': {
				if (raw === false) {
					// append one element past the tuple
					if (!Array.isArray(value)) break
					emit(occurrence, '', plant([...value, true]), at, exact)
					break
				}
				// dead item schema under maxItems: 0, exempt by rule, nothing to pair
				if (node.maxItems === 0) break
				if (!Array.isArray(value)) break
				const bad = violating(occurrence.pointer)
				if (bad === FAIL) break
				// index 0 either way: the bad member replaces the first element, or
				// becomes the only element of an empty array
				const mutated =
					value.length > 0
						? value.map((member, i) => (i === 0 ? bad : member))
						: [bad]
				emit(occurrence, 'member', plant(mutated), `${at}/0`, {
					kind: 'within',
					instancePointer: `${at}/0`,
				})
				break
			}
			case 'prefixItems': {
				if (!Array.isArray(value)) break
				;(raw as unknown[]).forEach((_member, index) => {
					if (index >= value.length) return
					const bad = violating(`${occurrence.pointer}/${index}`)
					if (bad === FAIL) return
					emit(
						occurrence,
						String(index),
						plant(value.map((member, i) => (i === index ? bad : member))),
						`${at}/${index}`,
						{ kind: 'within', instancePointer: `${at}/${index}` },
					)
				})
				break
			}
			case 'minProperties': {
				emit(occurrence, '', plant({}), at, exact)
				break
			}
			case 'anyOf':
			case 'oneOf': {
				const bad = violating(occurrence.nodePointer)
				if (bad === FAIL) break
				emit(occurrence, '', plant(bad), at, exact)
				break
			}
			default:
				// `format` and any keyword without a strategy produce nothing and
				// surface in the unreachable report, never as a silent skip.
				break
		}
	}

	const unreachable = new Set<string>()
	for (const occurrence of occurrences)
		if (!reached.has(occurrence.pointer)) unreachable.add(occurrence.pointer)
	return { mutants, witnesses, unreachable }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
