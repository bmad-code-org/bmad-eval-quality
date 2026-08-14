import { describe, expect, it } from 'vitest'
import { digestArtifact } from '../../src/core/canonical/digest.ts'
import {
	BEHAVIOR_ID_PATTERN,
	DEFECT_ID_PATTERN,
	DecimalString,
	DIGEST_FORM,
	Digest,
	FINDING_ID_PATTERN,
	Identifier,
	JsonValue,
	KeyedShapeDescriptor,
	ORACLE_ID_PATTERN,
	PROBE_ID_PATTERN,
	Rfc3339Utc,
	RUBRIC_CRITERION_ID_PATTERN,
	RUBRIC_ID_PATTERN,
	UnsignedDecimalString,
	WAIVER_ID_PATTERN,
} from '../../src/core/schemas/primitives.ts'

describe('the shared identifier charset', () => {
	it.each(['exports-api', 'expected-export-rows', 'exports-api-v1', 'poll'])(
		'accepts %s',
		(value) => {
			expect(Identifier.safeParse(value).success).toBe(true)
		},
	)

	it.each([
		['Exports-Api', 'uppercase'],
		['exports_api', 'underscore'],
		['exports/api', 'a slash, which spelling 1 could not embed'],
		['exports~api', 'a tilde, which is an RFC 6901 escape character'],
		['-leading', 'a leading separator'],
		['', 'empty'],
	])('rejects %s (%s)', (value) => {
		expect(Identifier.safeParse(value).success).toBe(false)
	})
})

describe('the eight identifier prefixes', () => {
	const patterns = {
		'B-': BEHAVIOR_ID_PATTERN,
		'O-': ORACLE_ID_PATTERN,
		'P-': PROBE_ID_PATTERN,
		'W-': WAIVER_ID_PATTERN,
		'D-': DEFECT_ID_PATTERN,
		'F-': FINDING_ID_PATTERN,
		'R-': RUBRIC_ID_PATTERN,
		'RC-': RUBRIC_CRITERION_ID_PATTERN,
	}

	// All eight are defined here even though this artifact uses five. Story 1.4
	// imports P-, D-, and F- rather than re-spelling the {3,} quantifier, and a
	// second spelling is exactly the drift the convention forbids.
	it('defines all eight', () => {
		expect(Object.keys(patterns)).toHaveLength(8)
	})

	it.each(Object.entries(patterns))(
		'%s requires three or more digits',
		(prefix, pattern) => {
			expect(pattern.test(`${prefix}001`)).toBe(true)
			expect(pattern.test(`${prefix}0001`)).toBe(true)
			expect(pattern.test(`${prefix}1`)).toBe(false)
			expect(pattern.test(`${prefix}01`)).toBe(false)
			expect(pattern.test(`${prefix}abc`)).toBe(false)
		},
	)

	it('keeps R- and RC- distinct', () => {
		expect(RUBRIC_ID_PATTERN.test('RC-001')).toBe(false)
		expect(RUBRIC_CRITERION_ID_PATTERN.test('R-001')).toBe(false)
	})
})

describe('the digest form, shared with Story 1.2 rather than re-spelled', () => {
	it('accepts a digest the canonical module actually computes', () => {
		const digest = digestArtifact({ a: 1 }, 'tests/schemas/primitives.test.ts')
		expect(DIGEST_FORM.test(digest)).toBe(true)
		expect(Digest.safeParse(digest).success).toBe(true)
	})

	it.each([
		'sha256:ABCDEF',
		'SHA256:0000000000000000000000000000000000000000000000000000000000000000',
		'0000000000000000000000000000000000000000000000000000000000000000',
	])('rejects %s', (value) => {
		expect(Digest.safeParse(value).success).toBe(false)
	})
})

describe('the decimal-string format AD-36 requires for money', () => {
	it.each(['0', '1', '1.5', '-1.5', '1000000', '0.001'])(
		'accepts %s',
		(value) => {
			expect(DecimalString.safeParse(value).success).toBe(true)
		},
	)

	it.each(['1e3', '01', '.5', '1.', '+1', 'NaN', 'Infinity', ''])(
		'rejects %s',
		(value) => {
			expect(DecimalString.safeParse(value).success).toBe(false)
		},
	)

	it('rejects a negative in the unsigned form', () => {
		expect(UnsignedDecimalString.safeParse('-1').success).toBe(false)
		expect(UnsignedDecimalString.safeParse('1').success).toBe(true)
	})
})

describe('RFC 3339 in UTC', () => {
	it('accepts a trailing Z and rejects a numeric offset', () => {
		expect(Rfc3339Utc.safeParse('2026-08-13T00:00:00Z').success).toBe(true)
		expect(Rfc3339Utc.safeParse('2026-08-13T00:00:00+02:00').success).toBe(
			false,
		)
	})
})

describe('the named value container', () => {
	it.each([
		'text',
		42,
		true,
		null,
		[1, 2, 3],
		{ nested: { deep: [{ id: 1 }] } },
		{},
		[],
	])('admits %o', (value) => {
		expect(JsonValue.safeParse(value).success).toBe(true)
	})

	it('rejects undefined, which JSON has no spelling for', () => {
		expect(JsonValue.safeParse(undefined).success).toBe(false)
	})
})

describe('the shared keyed shape descriptor', () => {
	it('admits an empty declaration, which is "declared, no keys"', () => {
		expect(
			KeyedShapeDescriptor.safeParse({
				requiredKeys: [],
				permittedKeys: [],
				types: {},
			}).success,
		).toBe(true)
	})

	it('admits a null type value, which is "declared, type not stated"', () => {
		expect(
			KeyedShapeDescriptor.safeParse({
				requiredKeys: ['id'],
				permittedKeys: ['id'],
				types: { id: null },
			}).success,
		).toBe(true)
	})

	it('rejects a type outside the six JSON type names', () => {
		expect(
			KeyedShapeDescriptor.safeParse({
				requiredKeys: [],
				permittedKeys: [],
				types: { id: 'uuid' },
			}).success,
		).toBe(false)
	})
})
