/**
 * Budgeted endpoint-set interpreter. Native RegExp only evaluates individual
 * character atoms and zero-width anchors. Each set merge and traversal spends
 * budget, including ambiguous alternatives and repetitions. Captures have no
 * observable effect because backreferences are outside the supported grammar.
 */
import { RuntimeFault } from '../schemas/faults.ts'

type Node =
	| { kind: 'atom'; pattern: RegExp }
	| { kind: 'sequence'; children: Node[] }
	| { kind: 'choice'; children: Node[] }
	| { kind: 'repeat'; child: Node; min: number; max: number }
	| { kind: 'assertion'; child: Node; positive: boolean }

export const REGEX_SOURCE_LIMIT = 4096
export const REGEX_DEPTH_LIMIT = 64

/** Counts captures outside escaped text and character classes, including forward references. */
function captureCounts(source: string): { total: number; named: number } {
	let total = 0
	let named = 0
	let inClass = false
	for (let index = 0; index < source.length; index++) {
		const character = source[index]
		if (character === '\\') {
			index++
			continue
		}
		if (character === '[' && !inClass) {
			inClass = true
			continue
		}
		if (character === ']' && inClass) {
			inClass = false
			continue
		}
		if (inClass || character !== '(') continue
		if (source[index + 1] !== '?') total++
		else if (
			source[index + 2] === '<' &&
			source[index + 3] !== '=' &&
			source[index + 3] !== '!'
		) {
			total++
			named++
		}
	}
	return { total, named }
}

/** Public safe subset: character atoms, anchors, groups, alternation and repetition. */
export function parseBoundedRegex(source: string): Node {
	if (source.length > REGEX_SOURCE_LIMIT)
		throw new Error(`regex source exceeds ${REGEX_SOURCE_LIMIT} code units`)
	new RegExp(source) // Validate context-sensitive escape and group syntax without matching input.
	const captures = captureCounts(source)
	let cursor = 0
	const atom = (text: string, flags: string): Node => ({
		kind: 'atom',
		pattern: new RegExp(text, `y${flags}`),
	})
	const choice = (depth: number, flags = ''): Node => {
		if (depth > REGEX_DEPTH_LIMIT)
			throw new Error(`regex nesting exceeds ${REGEX_DEPTH_LIMIT}`)
		const branches: Node[] = []
		do {
			const children: Node[] = []
			while (
				cursor < source.length &&
				source[cursor] !== ')' &&
				source[cursor] !== '|'
			) {
				const start = cursor
				const character = source[cursor++]
				let node: Node
				let atomSource: string | undefined
				if (character === '(') {
					let positive: boolean | undefined
					let groupFlags = flags
					if (source[cursor] === '?') {
						const marker = source[cursor + 1]
						if (marker === '=' || marker === '!') {
							positive = marker === '='
							cursor += 2
						} else if (marker === ':') cursor += 2
						else if (
							marker === '<' &&
							source[cursor + 2] !== '=' &&
							source[cursor + 2] !== '!'
						) {
							const end = source.indexOf('>', cursor + 2)
							if (end === -1) throw new Error('unclosed named group')
							new RegExp(`(?<${source.slice(cursor + 2, end)}>)`)
							cursor = end + 1
						} else {
							const modifiers = /^([ims]*)(?:-([ims]+))?:/.exec(
								source.slice(cursor + 1),
							)
							if (modifiers === null)
								throw new Error(
									'lookbehind and unknown group constructs are unsupported',
								)
							const enabled = new Set(flags)
							for (const flag of modifiers[1] ?? '') enabled.add(flag)
							for (const flag of modifiers[2] ?? '') enabled.delete(flag)
							groupFlags = [...enabled].sort().join('')
							cursor += 1 + modifiers[0].length
						}
					}
					node = choice(depth + 1, groupFlags)
					if (source[cursor++] !== ')') throw new Error('unclosed regex group')
					if (positive !== undefined)
						node = { kind: 'assertion', child: node, positive }
				} else {
					if (character === '[') {
						while (cursor < source.length && source[cursor] !== ']') {
							if (source[cursor] === '\\') cursor++
							cursor++
						}
						if (source[cursor++] !== ']')
							throw new Error('unclosed regex character class')
					} else if (character === '\\') {
						const escaped = source[cursor++]
						if (escaped === undefined)
							throw new Error('incomplete regex escape')
						if (escaped === 'k' && captures.named > 0)
							throw new Error(
								'named backreferences are outside the bounded subset',
							)
						if (/^[1-9]$/.test(escaped)) {
							const decimal = /^\d+/.exec(source.slice(cursor - 1))![0]
							if (Number(decimal) <= captures.total)
								throw new Error(
									'numeric backreferences are outside the bounded subset',
								)
							// Annex B falls back to octal (one atom) or decimal identity (one digit).
							const limit = escaped <= '3' ? 3 : 2
							let digits = 1
							if (escaped <= '7')
								while (digits < limit && /^[0-7]$/.test(source[cursor] ?? '')) {
									cursor++
									digits++
								}
						}
						if (
							escaped === 'x' &&
							/^[0-9a-fA-F]{2}$/.test(source.slice(cursor, cursor + 2))
						)
							cursor += 2
						else if (
							escaped === 'u' &&
							/^[0-9a-fA-F]{4}$/.test(source.slice(cursor, cursor + 4))
						)
							cursor += 4
						else if (escaped === 'c') {
							if (/^[a-zA-Z]$/.test(source[cursor] ?? '')) cursor++
							else {
								cursor--
								atomSource = '\\\\'
							}
						} else if (escaped === '0') {
							// Annex B octal escapes beginning with zero consume at most three digits.
							let digits = 1
							while (digits < 3 && /^[0-7]$/.test(source[cursor] ?? '')) {
								cursor++
								digits++
							}
						}
					} else if (character !== undefined && '*+?'.includes(character)) {
						throw new Error('unescaped regex quantifier outside an atom')
					}
					node = atom(atomSource ?? source.slice(start, cursor), flags)
				}
				const marker = source[cursor]
				let min: number | undefined
				let max = Number.POSITIVE_INFINITY
				if (marker === '*' || marker === '+' || marker === '?') {
					cursor++
					min = marker === '+' ? 1 : 0
					if (marker === '?') max = 1
				} else if (marker === '{') {
					const count = /^\{(\d+)(?:,(\d*))?\}/.exec(source.slice(cursor))
					if (count !== null) {
						cursor += count[0].length
						min = Number(count[1])
						max =
							count[2] === undefined
								? min
								: count[2] === ''
									? Number.POSITIVE_INFINITY
									: Number(count[2])
						if (max < min) throw new Error('invalid repetition bounds')
					}
				}
				if (min !== undefined) {
					if (source[cursor] === '?') cursor++ // greediness cannot change boolean membership
					node = { kind: 'repeat', child: node, min, max }
				}
				children.push(node)
			}
			branches.push({ kind: 'sequence', children })
			if (source[cursor] !== '|') break
			cursor++
		} while (cursor <= source.length)
		return branches.length === 1
			? branches[0]!
			: { kind: 'choice', children: branches }
	}
	const result = choice(0)
	if (cursor !== source.length) throw new Error('unmatched regex closing group')
	return result
}

export function boundedRegexTest(
	source: string,
	value: string,
	budget: number,
	artifactPath: string,
): boolean {
	let root: Node
	try {
		root = parseBoundedRegex(source)
	} catch (cause) {
		throw new RuntimeFault(
			'operator-cannot-accept-operand',
			artifactPath,
			`pattern is outside the bounded regex subset: ${source}`,
			{ cause },
		)
	}
	let remaining = budget
	const spend = () => {
		if (--remaining < 0)
			throw new RuntimeFault(
				'budget-exhausted',
				artifactPath,
				`regex work exceeds the declared budget of ${budget}`,
			)
	}
	const memo = new Map<Node, Map<number, Set<number>>>()
	const merge = (target: Set<number>, values: Set<number>) => {
		for (const end of values) {
			spend()
			target.add(end)
		}
	}
	const match = (node: Node, start: number): Set<number> => {
		spend()
		let cache = memo.get(node)
		const cached = cache?.get(start)
		if (cached !== undefined) return cached
		if (cache === undefined) {
			cache = new Map()
			memo.set(node, cache)
		}
		let result = new Set<number>()
		if (node.kind === 'atom') {
			node.pattern.lastIndex = start
			if (node.pattern.test(value)) result.add(node.pattern.lastIndex)
		} else if (node.kind === 'assertion') {
			if ((match(node.child, start).size !== 0) === node.positive)
				result.add(start)
		} else if (node.kind === 'choice') {
			for (const child of node.children) merge(result, match(child, start))
		} else if (node.kind === 'sequence') {
			result.add(start)
			for (const child of node.children) {
				const next = new Set<number>()
				for (const position of result) merge(next, match(child, position))
				result = next
				if (result.size === 0) break
			}
		} else {
			let current = new Set([start])
			if (node.min === 0) result.add(start)
			for (let count = 1; count <= node.max; count++) {
				spend()
				const next = new Set<number>()
				for (const position of current) merge(next, match(node.child, position))
				if (count >= node.min) merge(result, next)
				if (next.size === 0) break
				// A fixed point represents all later repetition counts, including huge minima.
				if (
					next.size === current.size &&
					[...next].every((position) => {
						spend()
						return current.has(position)
					})
				) {
					merge(result, next)
					break
				}
				current = next
			}
		}
		cache.set(start, result)
		return result
	}
	// Unanchored calls are supported at the operator boundary, with each start budgeted.
	const anchored =
		root.kind === 'sequence' &&
		root.children[0]?.kind === 'atom' &&
		root.children[0].pattern.source === '^'
	for (let start = 0; start <= (anchored ? 0 : value.length); start++) {
		if (match(root, start).size !== 0) return true
	}
	return false
}
