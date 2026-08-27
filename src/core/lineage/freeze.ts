/**
 * AD-29's "created once and never edited in place", made mechanical. A stage
 * freezes the artifact it owns; `application/` freezes what crosses the
 * package boundary.
 */

/**
 * Arrays and plain objects, every node an AD-27 JSON artifact has. Freezing a
 * `Date`, `Map`, or `Set` protects nothing they hold, and `Object.freeze` on a
 * non-empty typed array throws.
 */
function isJsonContainer(value: unknown): value is object {
	if (value === null || typeof value !== 'object') return false
	if (Array.isArray(value)) return true
	const prototype = Object.getPrototypeOf(value)
	return prototype === Object.prototype || prototype === null
}

/**
 * Deep-freezes a parsed artifact in place and returns it. Call it on a value
 * you own: every wired site hands it a Zod clone or a fresh literal. An
 * already-frozen node stops the walk, which is what terminates a cycle and
 * what leaves a hand-frozen subtree's descendants alone.
 */
export function freezeArtifact<T>(value: T): T {
	if (!isJsonContainer(value)) return value
	if (Object.isFrozen(value)) return value
	Object.freeze(value)
	// An array's indices are its enumerable own keys, so this covers both.
	for (const member of Object.values(value)) freezeArtifact(member)
	return value
}
