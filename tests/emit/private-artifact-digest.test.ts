// The match and mismatch cases for `checkPrivateArtifactManifestDigests`:
// Story 8.3's own I/O Matrix row 7. Built on
// `tests/schemas/fixtures/artifact-fixtures.ts`'s
// `privateArtifactManifestFixture`, whose two entries already carry distinct
// `privateRef`/`digest` pairs.

import { describe, expect, it } from 'vitest'
import { checkPrivateArtifactManifestDigests } from '../../src/core/emit/private-artifact-digest.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'
import {
	digestOf,
	privateArtifactManifestFixture,
} from '../schemas/fixtures/artifact-fixtures.ts'

const faultOf = (fn: () => unknown): RuntimeFault => {
	try {
		fn()
	} catch (error) {
		if (error instanceof RuntimeFault) return error
		throw error
	}
	throw new Error('expected a RuntimeFault to be thrown')
}

const [firstEntry, secondEntry] = privateArtifactManifestFixture.entries
if (firstEntry === undefined || secondEntry === undefined) {
	throw new Error('privateArtifactManifestFixture must carry two entries')
}

const agreeingDigests = new Map([
	[firstEntry.privateRef, firstEntry.digest],
	[secondEntry.privateRef, secondEntry.digest],
])

describe('checkPrivateArtifactManifestDigests', () => {
	it('Matrix row 7 (match): every entry digest agrees with its resolved bytes, no throw', () => {
		expect(() =>
			checkPrivateArtifactManifestDigests(
				privateArtifactManifestFixture,
				agreeingDigests,
			),
		).not.toThrow()
	})

	it("Matrix row 7 (mismatch): a resolved digest disagreeing with the manifest's declared one throws digest-mismatch, naming the first offending entry", () => {
		const mismatching = new Map(agreeingDigests)
		mismatching.set(firstEntry.privateRef, digestOf(9999))

		const fault = faultOf(() =>
			checkPrivateArtifactManifestDigests(
				privateArtifactManifestFixture,
				mismatching,
			),
		)
		expect(fault.code).toBe('digest-mismatch')
		expect(fault.artifactPath).toBe('PrivateArtifactManifest.entries[0]')
	})

	it('reports a privateRef with no resolved digest at all the same way as a mismatch', () => {
		const missing = new Map(agreeingDigests)
		missing.delete(secondEntry.privateRef)

		const fault = faultOf(() =>
			checkPrivateArtifactManifestDigests(
				privateArtifactManifestFixture,
				missing,
			),
		)
		expect(fault.code).toBe('digest-mismatch')
		expect(fault.artifactPath).toBe('PrivateArtifactManifest.entries[1]')
	})

	it('stops at the first offending entry rather than collecting every one', () => {
		const bothWrong = new Map([
			[firstEntry.privateRef, digestOf(9999)],
			[secondEntry.privateRef, digestOf(9998)],
		])
		const fault = faultOf(() =>
			checkPrivateArtifactManifestDigests(
				privateArtifactManifestFixture,
				bothWrong,
			),
		)
		expect(fault.artifactPath).toBe('PrivateArtifactManifest.entries[0]')
	})

	it("two entries sharing one privateRef are each checked against that privateRef's one resolved digest, so a disagreeing pair still throws", () => {
		const duplicateRef = {
			...privateArtifactManifestFixture,
			entries: [
				firstEntry,
				{ ...secondEntry, privateRef: firstEntry.privateRef },
			],
		}
		const fault = faultOf(() =>
			checkPrivateArtifactManifestDigests(
				duplicateRef,
				new Map([[firstEntry.privateRef, firstEntry.digest]]),
			),
		)
		expect(fault.code).toBe('digest-mismatch')
		expect(fault.artifactPath).toBe('PrivateArtifactManifest.entries[1]')
	})

	it('a manifest with no entries never throws', () => {
		expect(() =>
			checkPrivateArtifactManifestDigests(
				{ ...privateArtifactManifestFixture, entries: [] },
				new Map(),
			),
		).not.toThrow()
	})
})
