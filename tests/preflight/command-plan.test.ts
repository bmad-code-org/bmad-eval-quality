// Pre-flight against a system under test that runs behind a command: the leg
// the plan mints, the request the port is handed, and the observation the
// reducer reads back.
//
// The port carries two request shapes and two observation shapes now, and this
// is what proves the command halves are reachable end to end rather than merely
// representable.

import { describe, expect, it } from 'vitest'
import { compile } from '../../src/core/compile/compile.ts'
import { planPreflight } from '../../src/core/preflight/plan.ts'
import { reducePreflight } from '../../src/core/preflight/reduce.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import type { ProbeObservation } from '../../src/core/schemas/port-messages.ts'
import { commandContract } from '../schemas/fixtures/command-contract.ts'

const RUN_ID = 'command-run-0001'

const planOf = () =>
	planPreflight({
		contract: compile(EvalContract.parse(commandContract), { strict: true }),
		probes: [],
		runId: RUN_ID,
	})

const observationFor = (
	legId: string,
	fragments: readonly string[],
): ProbeObservation => ({
	probeId: legId,
	interfaceId: 'fragment-selection-runner',
	operationId: 'select-fragments',
	kind: 'cli',
	exitCode: 0,
	stdout: { kind: 'json', value: { fragments: [...fragments] } },
	stderr: { kind: 'absent' },
	artifacts: {},
})

describe('planning a command interface', () => {
	it('mints one leg per witness leg and hands the port a command request', () => {
		const plan = planOf()
		const legs = plan.legs.filter((leg) => leg.purpose === 'sensitivity')
		expect(legs.map((leg) => leg.legId)).toEqual([
			'leg-first-task',
			'leg-second-task',
		])
		const [first] = legs
		const request = first?.request
		if (request?.kind !== 'cli')
			throw new Error('a command operation plans a command request')
		expect(request.executable).toBe('fragment-selection-runner')
		expect(request.subcommandPath).toEqual(['select'])
		expect(request.channels.stdin).toEqual({
			kind: 'json',
			value: { prompt: 'the first task' },
		})
		// AD-35: the request names the logical executable the contract declared
		// and nothing that could resolve to a target on its own.
		expect(JSON.stringify(request)).not.toContain('/')
	})

	it('plans no transport request for any leg', () => {
		for (const leg of planOf().legs) expect(leg.request.kind).toBe('cli')
	})
})

describe('reducing a command run', () => {
	const reduceWith = (observations: readonly ProbeObservation[]) =>
		reducePreflight(planOf(), { observations })

	it('satisfies the input-sensitivity check when the two legs differ', () => {
		const verdict = reduceWith([
			observationFor('leg-first-task', ['a']),
			observationFor('leg-second-task', ['b']),
			...planOf()
				.legs.filter((leg) => leg.purpose !== 'sensitivity')
				.map((leg) => observationFor(leg.legId, ['a'])),
		])
		const sensitivity = verdict.checks.find(
			(check) => check.kind === 'input-sensitivity',
		)
		expect(sensitivity?.outcome).toBe('satisfied')
	})

	it('fails the input-sensitivity check when the two legs agree', () => {
		const verdict = reduceWith([
			observationFor('leg-first-task', ['a']),
			observationFor('leg-second-task', ['a']),
			...planOf()
				.legs.filter((leg) => leg.purpose !== 'sensitivity')
				.map((leg) => observationFor(leg.legId, ['a'])),
		])
		const sensitivity = verdict.checks.find(
			(check) => check.kind === 'input-sensitivity',
		)
		expect(sensitivity?.outcome).toBe('failed')
	})

	// A command's analogue of a 4xx on a control leg.
	it('fails the clean-control check on a non-zero exit', () => {
		const plan = planOf()
		const observations = plan.legs.map((leg) => ({
			...observationFor(leg.legId, ['a']),
			exitCode: leg.purpose === 'sensitivity' ? 0 : 3,
		}))
		const verdict = reducePreflight(plan, { observations })
		const control = verdict.checks.find(
			(check) => check.kind === 'clean-control',
		)
		expect(control?.outcome).toBe('failed')
		expect(control?.note).toContain('exit code 3')
	})
})
