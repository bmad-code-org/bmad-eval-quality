import { describe, expect, it } from 'vitest'
import type { RunModeValue } from '../../src/core/schemas/sealed-run-record.ts'
import { checkModeAgreement } from '../../src/core/score/mode-agreement.ts'

const recordOf = (mode: RunModeValue) => ({ mode })
const artifactOf = (mode: RunModeValue) => ({ mode })

describe('checkModeAgreement', () => {
	it('agrees when the record and the artifact carry the same mode', () => {
		expect(
			checkModeAgreement(recordOf('production'), artifactOf('production')),
		).toEqual({
			agrees: true,
			mode: 'production',
		})
		expect(
			checkModeAgreement(
				recordOf('contract-scoring'),
				artifactOf('contract-scoring'),
			),
		).toEqual({ agrees: true, mode: 'contract-scoring' })
	})

	// The I/O matrix's own scenario: a production record paired with a
	// contract-scoring artifact, rejected as an AD-32 disagreement.
	it('rejects a production record paired with a contract-scoring artifact', () => {
		const result = checkModeAgreement(
			recordOf('production'),
			artifactOf('contract-scoring'),
		)
		expect(result).toEqual({
			agrees: false,
			recordMode: 'production',
			artifactMode: 'contract-scoring',
		})
	})

	// "rejected the same way in the reverse pairing"
	it('rejects the reverse pairing the same way', () => {
		const result = checkModeAgreement(
			recordOf('contract-scoring'),
			artifactOf('production'),
		)
		expect(result).toEqual({
			agrees: false,
			recordMode: 'contract-scoring',
			artifactMode: 'production',
		})
	})
})
