/** the value domain every AD-4 operator resolves over. */
import type { JsonValue } from '../schemas/primitives.ts'

/**
 * AD-26: "A pointer that does not resolve yields the distinct value `absent`,
 * which is not `null`." A unique symbol, not a string literal or `null`
 * itself, so it can never collide with a legitimately resolved JSON value —
 * `null` is itself a valid `JsonValue` and a distinct outcome from `absent`.
 */
export const ABSENT: unique symbol = Symbol('absent')

export type ResolvedValue = JsonValue | typeof ABSENT
