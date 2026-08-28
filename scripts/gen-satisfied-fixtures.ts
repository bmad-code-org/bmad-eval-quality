import { readFileSync, writeFileSync } from 'node:fs'
import { compile } from '../src/core/compile/compile.ts'
import { planPreflight } from '../src/core/preflight/plan.ts'
import { absentBody } from '../tests/preflight/fixtures/observations.ts'

const raw = JSON.parse(
	readFileSync('corpus/dev/contracts/satisfied-declarations.json', 'utf8'),
)
const compiled = compile(raw, { strict: true })

const plan = planPreflight({ contract: compiled, probes: [], runId: 'run-1' })
const obs = plan.legs.map((leg) => ({
	probeId: leg.legId,
	interfaceId: leg.request.interfaceId,
	operationId: leg.request.operationId,
	status: 200,
	headers: {},
	body: absentBody(),
}))

writeFileSync(
	'dist/test-fixtures/satisfied-probes.json',
	JSON.stringify([], null, 2),
)
writeFileSync(
	'dist/test-fixtures/satisfied-obs.json',
	JSON.stringify(obs, null, 2),
)
console.log('Satisfied test fixtures created!')
