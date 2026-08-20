// Digest-path throughput measurement (story 1.2, review round 2 follow-up).
//
// Round 2 flagged that the fused canonicalizer allocates a property descriptor
// per property — `Object.getOwnPropertyDescriptors` on every object, then
// `Object.entries` over the result — and that nobody had measured what that
// costs. The finding was deferred rather than optimized, on the grounds that
// optimizing an unmeasured path is how correct code becomes wrong code. This
// script is the measurement.
//
// Three serializers run over the same payloads:
//
//   fused      the shipped path: one descriptor snapshot per object, values read
//              from `descriptor.value`, structure and domain checks on that same
//              snapshot. This is what closes the TOCTOU channel, and it is the
//              only variant that is safe against an accessor or a lying Proxy.
//   keyed      identical output and identical domain assertions, but values read
//              through `[[Get]]` after `Object.keys`. Not adoptable: a second
//              read is exactly the channel the fused pass was written to close.
//              It exists here only to price the descriptor allocation.
//   stringify  `JSON.stringify` with no ordering, no validation, and no safety.
//              A floor, not an alternative: it does not produce JCS output.
//
// `fused` minus `keyed` is the descriptor allocation's share of the digest path.
// The digests of `fused` and `keyed` are asserted equal before any number is
// reported, because an A/B over two different outputs prices nothing.
//
// Not wired into `npm run validate`: a throughput number is a property of the
// machine that produced it, and a gate on one is a flake generator. Run it when
// the question comes up again, and record what it said.
//
// Usage:
//   npm run bench:digest
//   npm run bench:digest -- --trials 9

// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports, or the script fails at load.
import { createHash } from 'node:crypto'
import { canonicalize } from '../src/core/canonical/canonicalize.ts'
import {
	assertDomainNumber,
	assertDomainString,
} from '../src/core/canonical/value-domain.ts'

const trialsFlag = process.argv.indexOf('--trials')
const TRIALS = trialsFlag === -1 ? 7 : Number(process.argv[trialsFlag + 1])
if (!Number.isInteger(TRIALS) || TRIALS < 3) {
	console.error('bench-digest: --trials must be an integer of at least 3')
	process.exit(1)
}

// ---------------------------------------------------------------------------
// Payloads, shaped after the real artifacts rather than after a microbenchmark.
// ---------------------------------------------------------------------------

/** One observation, field for field as `SealedRunRecord['observations'][number]`. */
const observation = (index: number): Record<string, unknown> => ({
	observationId: `obs-${String(index).padStart(6, '0')}`,
	operationId: index % 2 === 0 ? 'get-note' : 'patch-note',
	provenance: index % 3 === 0 ? 'baseline' : 'evaluator-chosen',
	callInputs: {
		path: { id: `n-${index}` },
		query: index % 4 === 0 ? { include: 'history' } : null,
		header: null,
		body: index % 2 === 0 ? null : { title: `Revised ${index}` },
	},
	responseBody: {
		ok: index % 5 !== 0,
		note: {
			id: `n-${index}`,
			title: index % 2 === 0 ? 'Original' : `Revised ${index}`,
			tags: ['alpha', 'beta', 'gamma'],
		},
	},
	responseHeaders: {
		'content-type': 'application/json',
		'x-request-id': `r-${index}`,
	},
	responseStatus: index % 5 === 0 ? 500 : 200,
	stdout: null,
	stderr: null,
	exitCode: null,
})

/** One scored criterion, shaped after what the score half will carry. */
const score = (index: number): Record<string, unknown> => ({
	criterionId: `C-${String(index).padStart(5, '0')}`,
	behaviorId: `B-${String(index % 97).padStart(3, '0')}`,
	level: index % 5,
	weight: 1 / (1 + (index % 7)),
	catchRate: (index % 101) / 100,
	dominated: index % 11 === 0,
})

const arrayOf = <T>(count: number, make: (index: number) => T): T[] =>
	Array.from({ length: count }, (_, index) => make(index))

const PAYLOADS = [
	{
		label: 'observations x100',
		value: { observations: arrayOf(100, observation) },
	},
	{
		label: 'observations x1000',
		value: { observations: arrayOf(1_000, observation) },
	},
	{
		label: 'observations x10000',
		value: { observations: arrayOf(10_000, observation) },
	},
	{ label: 'scores x1000', value: { scores: arrayOf(1_000, score) } },
	{ label: 'scores x10000', value: { scores: arrayOf(10_000, score) } },
	{ label: 'scores x100000', value: { scores: arrayOf(100_000, score) } },
]

// ---------------------------------------------------------------------------
// The `keyed` comparison serializer. Same output, same domain assertions, one
// difference: no descriptor snapshot. See the header for why it is not shippable.
// ---------------------------------------------------------------------------

const keyedSerialize = (value: unknown, location: string): string => {
	if (value === null) return 'null'
	switch (typeof value) {
		case 'boolean':
			return value ? 'true' : 'false'
		case 'number':
			assertDomainNumber(value, '$', location)
			return JSON.stringify(value)
		case 'string':
			assertDomainString(value, '$', location)
			return JSON.stringify(value)
		case 'object':
			break
		default:
			throw new TypeError(`${typeof value} at ${location}`)
	}
	const object = value as object
	if (Array.isArray(object)) {
		return `[${object
			.map((element, index) => keyedSerialize(element, `${location}[${index}]`))
			.join(',')}]`
	}
	if (Object.getOwnPropertySymbols(object).length > 0) {
		throw new TypeError(`symbol-keyed property at ${location}`)
	}
	const keys = Object.keys(object).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
	return `{${keys
		.map((key) => {
			assertDomainString(key, '$', `${location} (object key)`)
			const entry = (object as Record<string, unknown>)[key]
			return `${JSON.stringify(key)}:${keyedSerialize(entry, `${location}.${key}`)}`
		})
		.join(',')}}`
}

const encoder = new TextEncoder()
const digestOf = (bytes: Uint8Array): string =>
	createHash('sha256').update(bytes).digest('hex')

const VARIANTS = [
	{
		label: 'fused',
		run: (value: unknown): Uint8Array => canonicalize(value, '$'),
	},
	{
		label: 'keyed',
		run: (value: unknown): Uint8Array =>
			encoder.encode(keyedSerialize(value, '$')),
	},
	{
		label: 'stringify',
		run: (value: unknown): Uint8Array => encoder.encode(JSON.stringify(value)),
	},
]

// ---------------------------------------------------------------------------
// Timing. Median of TRIALS, not mean: one descheduled trial should not move the
// reported number, and on a laptop there is always one.
// ---------------------------------------------------------------------------

const median = (values: number[]): number => {
	if (values.length === 0) throw new RangeError('median of nothing')
	const sorted = [...values].sort((a, b) => a - b)
	const middle = sorted.length >> 1
	const upper = sorted[middle] as number
	return sorted.length % 2 === 1
		? upper
		: ((sorted[middle - 1] as number) + upper) / 2
}

/** Milliseconds for one call, median over TRIALS after two warmup calls. */
const timeOne = (
	run: (value: unknown) => Uint8Array,
	value: unknown,
): number => {
	run(value)
	run(value)
	const samples: number[] = []
	for (let trial = 0; trial < TRIALS; trial++) {
		const started = process.hrtime.bigint()
		run(value)
		samples.push(Number(process.hrtime.bigint() - started) / 1e6)
	}
	return median(samples)
}

/** Own properties the fused pass allocates a descriptor for, counted exactly. */
const countProperties = (value: unknown): number => {
	if (value === null || typeof value !== 'object') return 0
	if (Array.isArray(value)) {
		// `length` gets a descriptor too, and is then skipped.
		return (
			1 +
			value.length +
			value.reduce<number>((sum, element) => sum + countProperties(element), 0)
		)
	}
	const entries = Object.entries(value as Record<string, unknown>)
	return (
		entries.length +
		entries.reduce((sum, [, entry]) => sum + countProperties(entry), 0)
	)
}

const pad = (text: string, width: number): string => text.padEnd(width)
const fixed = (value: number, places: number, width: number): string =>
	value.toFixed(places).padStart(width)

console.log(
	`bench-digest: node ${process.version}, ${TRIALS} trials per cell, median reported\n`,
)
console.log(
	`${pad('payload', 22)}${pad('bytes', 11)}${pad('props', 10)}${pad('fused ms', 11)}${pad('keyed ms', 11)}${pad('stringify ms', 14)}${pad('MB/s', 9)}descriptor share`,
)

for (const payload of PAYLOADS) {
	const timings = new Map<string, number>()
	let canonicalBytes = 0
	let reference: string | undefined
	for (const variant of VARIANTS) {
		const bytes = variant.run(payload.value)
		if (variant.label === 'fused') {
			canonicalBytes = bytes.length
			reference = digestOf(bytes)
		}
		// `stringify` is a floor, not an alternative: its output is not JCS and is
		// not expected to match. `keyed` is only a valid comparison if it does.
		if (variant.label === 'keyed' && digestOf(bytes) !== reference) {
			console.error(
				`bench-digest: the keyed variant disagreed with the fused one on ${payload.label}; the comparison prices nothing and is aborted`,
			)
			process.exit(1)
		}
		timings.set(variant.label, timeOne(variant.run, payload.value))
	}

	const fused = timings.get('fused') as number
	const keyed = timings.get('keyed') as number
	const stringify = timings.get('stringify') as number
	const share = ((fused - keyed) / fused) * 100
	console.log(
		pad(payload.label, 22) +
			pad(canonicalBytes.toLocaleString('en-US'), 11) +
			pad(countProperties(payload.value).toLocaleString('en-US'), 10) +
			fixed(fused, 2, 8) +
			'   ' +
			fixed(keyed, 2, 8) +
			'   ' +
			fixed(stringify, 2, 11) +
			'   ' +
			fixed(canonicalBytes / 1e6 / (fused / 1e3), 1, 7) +
			'  ' +
			`${share >= 0 ? '+' : ''}${share.toFixed(1)}%`,
	)
}

console.log(
	'\ndescriptor share = (fused - keyed) / fused: the fraction of the digest path\n' +
		'attributable to snapshotting property descriptors instead of reading values back.',
)
