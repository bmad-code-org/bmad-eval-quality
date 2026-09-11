import type { Sealed } from '../model/record.ts'

/** The one declared writer. It sets every field the configuration names. */
export const mint = (id: string, owner: string, at: string): Sealed => ({
	id,
	ownerId: owner,
	sealedAt: at,
})
