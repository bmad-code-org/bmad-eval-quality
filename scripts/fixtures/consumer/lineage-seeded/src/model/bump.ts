import type { Sealed } from './record.ts'

/**
 * A second helper that sets both owned fields. It sits in a declared path, so
 * writing them here is permitted; what the gate cannot see on its own is the
 * caller.
 */
export const bumpOwner = (record: Sealed, owner: string, at: string): Sealed => ({
	...record,
	ownerId: owner,
	sealedAt: at,
})
