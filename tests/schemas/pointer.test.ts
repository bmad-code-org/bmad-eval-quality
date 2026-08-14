import { describe, expect, it } from 'vitest'
import { Direction } from '../../src/core/schemas/oracle.ts'
import {
	BoundElementPointer,
	DescriptorPointer,
	InteractionPointer,
} from '../../src/core/schemas/pointer.ts'

describe('spelling 1 — interaction-rooted', () => {
	const accepted = [
		'/interactions/poll/response-body/submittedFilters',
		'/interactions/poll/response-body',
		'/interactions/submit/call-inputs/body/filters',
		'/interactions/first-page/call-inputs/query/limit',
		'/interactions/x/call-inputs/path/jobId',
		'/interactions/x/call-inputs/header/Idempotency-Key',
		'/interactions/x/response-headers/Content-Type',
		'/interactions/x/response-status',
		'/interactions/x/exit-code',
		'/interactions/x/stdout',
		'/interactions/x/stderr/0',
		// RFC 6901 escapes are permitted in the tail.
		'/interactions/x/response-body/a~1b',
		'/interactions/x/response-body/a~0b',
	]

	it.each(accepted)('accepts %s', (pointer) => {
		expect(InteractionPointer.safeParse(pointer).success).toBe(true)
	})

	const rejected = [
		// `call-inputs` rooted directly on a key name is the defect AD-26 records
		// revision 3 carrying: it had no declared structure to resolve against.
		['/interactions/x/call-inputs', 'no transport channel'],
		['/interactions/x/call-inputs/filters', 'not one of the four channels'],
		['/interactions/x/call-inputs/cookie/a', 'not one of the four channels'],
		['/interactions/x/response-status/code', 'a scalar channel takes no tail'],
		['/interactions/x/exit-code/0', 'a scalar channel takes no tail'],
		['/interactions/x/response-bodyish', 'not a declared channel'],
		['/interactions/x/bogus', 'not a declared channel'],
		['/interactions/X/response-body', 'step identifier outside the charset'],
		['/interactions/a~b/response-body', 'step identifier carrying a tilde'],
		['/interactions//response-body', 'empty step identifier'],
		['/state', 'a descriptor-relative pointer where spelling 1 belongs'],
		['@/id', 'a bound-element pointer where spelling 1 belongs'],
	] as const

	it.each(rejected)('rejects %s (%s)', (pointer) => {
		expect(InteractionPointer.safeParse(pointer).success).toBe(false)
	})
})

describe('spelling 2 — bound-element relative', () => {
	it.each(['@/', '@/id', '@/a/b', '@/~0key'])('accepts %s', (pointer) => {
		expect(BoundElementPointer.safeParse(pointer).success).toBe(true)
	})

	it.each(['@', '/id', '/interactions/x/response-body', '@id'])(
		'rejects %s',
		(pointer) => {
			expect(BoundElementPointer.safeParse(pointer).success).toBe(false)
		},
	)
})

describe('spelling 3 — descriptor-relative', () => {
	it.each(['', '/state', '/a/b', '/~0k', '/~1k'])('accepts %s', (pointer) => {
		expect(DescriptorPointer.safeParse(pointer).success).toBe(true)
	})

	it.each(['@/id', '@/', 'state', '/a~b'])('rejects %s', (pointer) => {
		expect(DescriptorPointer.safeParse(pointer).success).toBe(false)
	})

	// Recorded rather than enforced: an interaction-rooted pointer is also a
	// syntactically legal RFC 6901 pointer, so the wrong-direction reject in this
	// spelling only exists for the bound-element form. A response body may
	// legitimately carry an `interactions` key, so excluding that prefix here
	// would reject correct contracts. Whether a descriptor pointer resolves
	// anywhere is Epic 4's reachability check.
	it('cannot reject an interaction-rooted pointer, and that is deliberate', () => {
		expect(
			DescriptorPointer.safeParse('/interactions/x/response-body').success,
		).toBe(true)
	})
})

describe('each spelling is assigned to its consumers', () => {
	const direction = {
		evidenceTargets: ['/interactions/poll/response-body/state'],
		relation: 'equality',
		polarity: 'expects-hold',
		scope: null,
		negativeDomain: null,
	}

	it('accepts an interaction-rooted evidence target', () => {
		expect(Direction.safeParse(direction).success).toBe(true)
	})

	it('rejects "@/" in an evidence target, because containment is computed after quantifier substitution', () => {
		const result = Direction.safeParse({
			...direction,
			evidenceTargets: ['@/status'],
		})
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.path).toEqual(['evidenceTargets', 0])
		expect(result.error?.issues[0]?.code).toBe('invalid_format')
	})

	it('rejects a descriptor-relative pointer in an evidence target', () => {
		const result = Direction.safeParse({
			...direction,
			evidenceTargets: ['/state'],
		})
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.path).toEqual(['evidenceTargets', 0])
	})
})
