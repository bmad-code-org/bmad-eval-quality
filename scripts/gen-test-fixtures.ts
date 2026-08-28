import { mkdirSync, writeFileSync } from 'node:fs'
import { planPreflight } from '../src/core/preflight/plan.ts'
import {
	contractDraft,
	observationsFor,
	preflightContract,
	seededProbe,
} from '../tests/preflight/fixtures/observations.ts'

mkdirSync('dist/test-fixtures', { recursive: true })
writeFileSync(
	'dist/test-fixtures/draft.json',
	JSON.stringify(contractDraft(), null, 2),
)
writeFileSync(
	'dist/test-fixtures/contract.json',
	JSON.stringify(preflightContract, null, 2),
)
writeFileSync(
	'dist/test-fixtures/probes.json',
	JSON.stringify([seededProbe], null, 2),
)

const plan = planPreflight({
	contract: preflightContract,
	probes: [seededProbe],
	runId: 'run-1',
})
const obs = observationsFor(plan.legs)
writeFileSync(
	'dist/test-fixtures/observations.json',
	JSON.stringify(obs, null, 2),
)
console.log('Test fixtures created in dist/test-fixtures/')
