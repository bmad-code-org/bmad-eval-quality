import type { Sealed } from '../model/record.ts'

/** Reads both owned fields and writes neither. */
export const describe = (record: Sealed): string => {
	const { ownerId, sealedAt } = record
	return ownerId + ' at ' + sealedAt
}
