import { bumpOwner } from '../model/bump.ts'
import type { Sealed } from '../model/record.ts'

/**
 * The seeded defect. Nothing in this file names an owned field, spells one as a
 * string, or assigns anything; both fields move all the same, through a helper
 * one directory away.
 */
export const publish = (record: Sealed, owner: string, at: string): Sealed =>
	bumpOwner(record, owner, at)
