/** the value domain every AD-4 operator resolves over. */
import type { JsonValue } from '../schemas/primitives.ts'

/**
 * AD-26: a pointer that fails to resolve yields the symbol `ABSENT`, not
 * `null` or a string literal, since `null` is itself a valid `JsonValue` and
 * must stay distinguishable from a value that never resolved.
 */
export const ABSENT: unique symbol = Symbol('absent')

export type ResolvedValue = JsonValue | typeof ABSENT
