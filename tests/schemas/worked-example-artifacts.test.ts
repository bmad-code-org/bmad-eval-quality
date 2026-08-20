import { describe, expect, it } from 'vitest'
import { EvidenceArtifact } from '../../src/core/schemas/evidence-artifact.ts'
import { SealedRunRecord } from '../../src/core/schemas/sealed-run-record.ts'
import {
	WORKED_EXAMPLE_EVIDENCE_ISSUES,
	WORKED_EXAMPLE_RECORD_ISSUES,
	workedExampleEvidenceArtifact,
	workedExampleSealedRunRecord,
} from './fixtures/worked-example-artifacts.ts'

const issuesOf = (result: {
	error?: { issues: readonly { path: readonly PropertyKey[]; code: string }[] }
}) =>
	(result.error?.issues ?? []).map((issue) => ({
		path: issue.path,
		code: issue.code,
	}))

describe('the spike worked example, re-checked and not repaired', () => {
	// A bare `success === false` would stay green if the shapes broke somewhere
	// else entirely, and the recorded finding would quietly stop being true.
	it('fails the Sealed Run Record in exactly the sixty recorded ways', () => {
		const result = SealedRunRecord.safeParse(workedExampleSealedRunRecord)
		expect(result.success).toBe(false)
		expect(issuesOf(result)).toEqual(WORKED_EXAMPLE_RECORD_ISSUES)
		expect(WORKED_EXAMPLE_RECORD_ISSUES).toHaveLength(60)
	})

	it('fails the Evidence Artifact in exactly the nineteen recorded ways', () => {
		const result = EvidenceArtifact.safeParse(workedExampleEvidenceArtifact)
		expect(result.success).toBe(false)
		expect(issuesOf(result)).toEqual(WORKED_EXAMPLE_EVIDENCE_ISSUES)
		expect(WORKED_EXAMPLE_EVIDENCE_ISSUES).toHaveLength(19)
	})

	// The half of the record worth keeping: the evidence artifact's mode union,
	// its verdict, its trial block, and its caller-attested input list all parse
	// unchanged, so this story's shapes are not a wholesale re-invention.
	it("leaves the evidence artifact's settled fields untouched", () => {
		const failing = new Set(
			WORKED_EXAMPLE_EVIDENCE_ISSUES.map((issue) => issue.path[0]),
		)
		for (const field of [
			'mode',
			'contractVerdict',
			'systemRecommendationRecorded',
			'verdictBasis',
			'trials',
			'callerAttestedInputs',
			'uncitedFindings',
			'coverageGaps',
		]) {
			expect(failing.has(field), field).toBe(false)
		}
	})
})
