import { describe, expect, it } from 'vitest'
import {
	type Diagnostic,
	type DiagnosticSink,
	emit,
} from '../../src/application/diagnostics.ts'

const diagnostic: Diagnostic = {
	runId: 'run-7f3c',
	stage: 'preflight',
	message: 'probe P-001 answered leg L-001',
}

describe('emit', () => {
	it('case 113: calls a supplied sink once with the diagnostic', () => {
		const seen: Diagnostic[] = []
		const sink: DiagnosticSink = (received) => {
			seen.push(received)
		}
		emit(sink, diagnostic)
		expect(seen).toEqual([diagnostic])
	})

	it('case 114: does nothing when no sink was supplied', () => {
		expect(() => emit(undefined, diagnostic)).not.toThrow()
	})

	it('case 115: propagates a throwing sink', () => {
		// A broken sink is the caller's defect. Swallowing it would make the run
		// look quiet.
		const sink: DiagnosticSink = () => {
			throw new Error('sink is broken')
		}
		expect(() => emit(sink, diagnostic)).toThrow('sink is broken')
	})

	it('case 116: hands the sink a diagnostic carrying both runId and stage', () => {
		// The Conventions Logging row: every diagnostic names the run and the
		// stage that emitted it.
		let received: Diagnostic | undefined
		emit((value) => {
			received = value
		}, diagnostic)
		expect(received?.runId).toBe('run-7f3c')
		expect(received?.stage).toBe('preflight')
		expect(received?.message).toBe('probe P-001 answered leg L-001')
	})
})
