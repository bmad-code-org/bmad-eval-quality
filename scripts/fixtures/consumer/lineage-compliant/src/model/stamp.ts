import type { Sealed } from './record.ts'

/** Sets both owned fields, so a caller naming it is a writer one line out. */
export const stampOwner = (id: string, owner: string, at: string): Sealed => ({
	id,
	ownerId: owner,
	sealedAt: at,
})
