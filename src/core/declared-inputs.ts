/**
 * What an operation declares it accepts, as predicates over `RequestShape`.
 *
 * At the `core/` root because `core/schemas/` holds Zod definitions only, and
 * because AD-10's exemption is read by two modules: the compile check that
 * enforces it and the reducer that records it.
 */
import type { Operation } from './schemas/interface.ts'
import { TRANSPORT_CHANNELS } from './schemas/pointer.ts'

/**
 * AD-10's exemption predicate. Any of a channel's three lists naming a key
 * counts: a permitted-only or types-only channel is still a surface a witness
 * can vary.
 */
export function declaresNoRequestKeys(operation: Operation): boolean {
	return TRANSPORT_CHANNELS.every((channel) => {
		const shape = operation.requestShape[channel]
		return (
			shape.requiredKeys.length === 0 &&
			shape.permittedKeys.length === 0 &&
			Object.keys(shape.types).length === 0
		)
	})
}

/** Whether no channel declares a required key. */
export function declaresNoRequiredKeys(operation: Operation): boolean {
	return TRANSPORT_CHANNELS.every(
		(channel) => operation.requestShape[channel].requiredKeys.length === 0,
	)
}
