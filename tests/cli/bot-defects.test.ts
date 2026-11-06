/** Regressions through the built compiler, preflight, scorer and sealer. */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { planPreflight } from '../../src/core/preflight/plan.ts'
import {
	corpusDigestFixture,
	evaluatorConfigurationFixture,
	isolationManifestFixtureForScore,
	passingPreflightVerdictForScore,
	scoreContractFixture,
	scoreProbeFixture,
	scoringPolicyFixtureForScore,
	sealedRunRecordFixtureForScore,
} from '../application/fixtures/score-fixtures.ts'
import {
	contractDraft,
	observationsFor,
	satisfiedPatches,
} from '../preflight/fixtures/observations.ts'

const root = fileURLToPath(new URL('../../', import.meta.url))
const scratch = mkdtempSync(join(tmpdir(), 'eval-quality-bot-defects-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const save = (name: string, value: unknown) => {
	const path = join(scratch, `${name}.json`)
	writeFileSync(path, JSON.stringify(value))
	return path
}
const cli = (args: string[]) =>
	spawnSync(process.execPath, [join(root, 'dist/cli/main.js'), ...args], {
		encoding: 'utf8',
		timeout: 3000,
	})
const scopedModifiersSupported = (() => {
	try {
		new RegExp(['(?i:', 'a)'].join(''))
		return true
	} catch {
		return false
	}
})()
const tutorial = () =>
	JSON.parse(
		readFileSync(
			join(root, 'examples/tutorials/tool-use/contract.json'),
			'utf8',
		),
	)

function preflight(selected: boolean, changed: boolean, reversed: boolean) {
	const contract: any = contractDraft()
	const op = contract.permittedInterfaces[0].operations[1]
	op.volatilePointers = reversed
		? ['/items/1', '/items/0']
		: ['/items/0', '/items/1']
	if (selected) op.stateResetPointers = ['/items/2']
	const plan = planPreflight({ contract, probes: [], runId: 'run-1' })
	const patches: any = satisfiedPatches(plan.legs)
	for (const [index, id] of [
		'preflight-control-observe',
		'preflight-control-observe-2',
	].entries()) {
		patches[id] = {
			body: {
				kind: 'json',
				value: {
					id: 't-1',
					value: 'alpha',
					items: [
						`volatile-${index}`,
						'same',
						changed && index === 1 ? 'leaked' : 'stable',
					],
				},
			},
		}
	}
	return cli([
		'preflight',
		'--contract',
		save('contract', contract),
		'--probes',
		save('probes', []),
		'--observations',
		save('observations', observationsFor(plan.legs, patches)),
		'--run-id',
		'run-1',
	])
}

describe('reported defects through the built CLI', () => {
	for (const selected of [false, true])
		for (const reversed of [false, true]) {
			it(`preserves stable array changes with selected=${selected}, reversed=${reversed}`, () => {
				const result = preflight(selected, true, reversed)
				expect(result.error).toBeUndefined()
				expect(result.status, result.stderr).toBe(3)
				expect(
					JSON.parse(result.stdout).checks.find(
						(check: any) => check.kind === 'state-reset',
					).outcome,
				).toBe('failed')
			})
			it(`ignores volatile array changes with selected=${selected}, reversed=${reversed}`, () => {
				const result = preflight(selected, false, reversed)
				expect(result.status, result.stderr).toBe(0)
				expect(
					JSON.parse(result.stdout).checks.find(
						(check: any) => check.kind === 'state-reset',
					).outcome,
				).toBe('satisfied')
			})
		}

	it('preserves the documented transport-only empty state-reset list', () => {
		const contract = tutorial()
		for (const op of contract.permittedInterfaces[0].operations)
			op.stateResetPointers = []
		const result = cli(['compile', '--in', save('empty-pointers', contract)])
		expect(result.status, result.stderr).toBe(0)
		expect(
			JSON.parse(result.stdout).permittedInterfaces[0].operations[0]
				.stateResetPointers,
		).toEqual([])
	})

	it.each(['^(a|a)*$', '^(a|aa)*$', '^\\d*\\d*\\d*\\d*\\d*\\d*x$'])(
		'bounds preflight regex work for %s',
		(pattern) => {
			const contract: any = contractDraft()
			contract.permittedInterfaces[0].operations[0].sensitivityWitness.relation =
				{
					op: 'regex',
					operands: [{ pointer: '/interactions/create-a/response-body/echo' }],
					pattern,
				}
			const plan = planPreflight({ contract, probes: [], runId: 'run-1' })
			const patches: any = satisfiedPatches(plan.legs)
			patches['create-a'] = {
				body: {
					kind: 'json',
					value: {
						id: 'x',
						ok: true,
						echo: pattern.includes('\\d')
							? '1'.repeat(400)
							: `${'a'.repeat(1000)}b`,
					},
				},
			}
			const result = cli([
				'preflight',
				'--contract',
				save('regex-contract', contract),
				'--probes',
				save('probes', []),
				'--observations',
				save('regex-observations', observationsFor(plan.legs, patches)),
				'--run-id',
				'run-1',
			])
			expect(result.error).toBeUndefined()
			expect([3, 5], result.stderr).toContain(result.status)
			if (result.status === 5)
				expect(result.stderr).toContain('budget-exhausted')
			else expect(JSON.parse(result.stdout).passed).toBe(false)
		},
	)

	it.each(['^(a|a)*$', '^(a|aa)*$', '^\\d*\\d*\\d*\\d*\\d*\\d*x$'])(
		'bounds score regex work and preserves missing-verdict-input exit 3: %s',
		(pattern) => {
			const probe: any = structuredClone(scoreProbeFixture)
			probe.defectSignature.observableChannel = 'response-body'
			probe.defectSignature.condition.predicate = {
				op: 'regex',
				operands: [{ pointer: '/interactions/observed/response-body/message' }],
				pattern,
			}
			const record: any = structuredClone(sealedRunRecordFixtureForScore)
			record.observations[0].callInputs.body.title = 42
			record.observations[0].responseBody.message = pattern.includes('\\d')
				? '1'.repeat(400)
				: `${'a'.repeat(1000)}b`
			// Public storage avoids a private byte resolver unrelated to regex evaluation.
			record.isolationManifestArtifact = {
				storage: 'public',
				path: 'manifest.json',
				privateRef: null,
				digest: record.isolationManifestArtifact.digest,
			}
			const args = [
				'score',
				'--record',
				save('record', record),
				'--contract',
				save('score-contract', scoreContractFixture),
				'--probe',
				save('probe', probe),
				'--preflight-verdict',
				save('pf', passingPreflightVerdictForScore),
				'--policy',
				save('policy', scoringPolicyFixtureForScore),
				'--corpus-digest',
				corpusDigestFixture,
			]
			save('probe', scoreProbeFixture)
			const absent = cli(args)
			expect(absent.status, absent.stderr).toBe(3)
			expect(absent.stderr).toContain('evaluator configuration absent')
			expect(absent.stderr).toContain('isolation manifest absent')
			save('probe', probe)
			const result = cli([
				...args,
				'--isolation-manifest',
				save('manifest', isolationManifestFixtureForScore),
				'--evaluator-configuration',
				save('config', evaluatorConfigurationFixture),
			])
			expect(result.error).toBeUndefined()
			expect([0, 5], result.stderr).toContain(result.status)
			if (result.status === 5)
				expect(result.stderr).toContain('budget-exhausted')
			else expect(JSON.parse(result.stdout).mode).toBe('production')
		},
	)

	it.each([`^${'a'.repeat(4096)}$`, `^${'('.repeat(65)}a${')'.repeat(65)}$`])(
		'refuses unsupported regex grammar at compile: %s',
		(pattern) => {
			const contract = tutorial()
			contract.oracles[0].direction.relation = 'regex'
			contract.oracles[0].direction.evidenceTargets = [
				'/interactions/create/response-body/noteId',
			]
			contract.oracles[0].check = {
				op: 'regex',
				operands: [{ pointer: '/interactions/create/response-body/noteId' }],
				pattern,
			}
			const result = cli(['compile', '--in', save('compile-regex', contract)])
			expect(result.status, result.stderr).toBe(4)
			expect(result.stderr).toContain('malformed-operator-expression')
		},
	)
	it.each([
		...(scopedModifiersSupported ? ['^(?i:a(?-i:b))$', '^(?s:(?=.)a)$'] : []),
		'^(?:GET|POST)+$',
		'^a+b+c+$',
		'^[\\1]$',
		'^[(?<=]$',
		'^\\x61{1,3}$',
		'^(?=a)a$',
		'^(?!b)(?<name>a)$',
		'^\\01$',
		'^a{bad}$',
		'^a{99999999999999999}$',
	])('compiles supported ordinary regex grammar: %s', (pattern) => {
		const contract = tutorial()
		contract.oracles[0].direction.relation = 'regex'
		contract.oracles[0].direction.evidenceTargets = [
			'/interactions/create/response-body/noteId',
		]
		contract.oracles[0].check = {
			op: 'regex',
			operands: [{ pointer: '/interactions/create/response-body/noteId' }],
			pattern,
		}
		const result = cli(['compile', '--in', save('compile-regex', contract)])
		expect(result.status, result.stderr).toBe(0)
	})

	it('explains verdict inputs in both help entrypoints', () => {
		for (const args of [['--help'], ['score', '--help']]) {
			const result = cli(args)
			expect(result.status).toBe(0)
			expect(result.stdout).toContain('either absence')
			expect(result.stdout).toContain('Invalid (exit 3)')
		}
	})

	it('seals relation-first prose for compound field evidence', () => {
		const result = cli(['seal', '--in', save('seal-contract', tutorial())])
		expect(result.status, result.stderr).toBe(0)
		const texts = JSON.parse(result.stdout).directions.map(
			(direction: any) => direction.text,
		)
		expect(
			texts.some((text: string) =>
				text.startsWith(
					'Check that every declared condition holds together. Evidence:',
				),
			),
		).toBe(true)
		expect(texts.join(' ')).not.toContain('field is asserted')
	})
})
