import { describe, expect, it } from 'vitest'
import {
	boundedRegexTest,
	parseBoundedRegex,
	REGEX_DEPTH_LIMIT,
	REGEX_SOURCE_LIMIT,
} from '../../src/core/evaluate/bounded-regex.ts'
import { regexMatch } from '../../src/core/evaluate/operators.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'

const scopedModifiersSupported = (() => {
	try {
		new RegExp(['(?i:', 'a)'].join(''))
		return true
	} catch {
		return false
	}
})()
const scopedPatterns = [
	'^(?i:a)$',
	'^(?s:.)$',
	'^(?i-m:a)$',
	'^(?i:a(?-i:b))$',
	'^(?s:(?=.)[^x])$',
	'(?m:^a$)',
	'^(?i:(?<name>a)(?=b)b)$',
	'^(?i:a)+$',
]
const patterns = [
	...(scopedModifiersSupported ? scopedPatterns : []),
	'^$',
	'^a$',
	'^a+b+c+$',
	'^(?:GET|POST)+$',
	'^(\\d\\+)+$',
	'^[a\\]b+]$',
	'^[^a-c]{0,3}$',
	'^.{1,3}$',
	'^\\x61\\u0062\\cA$',
	'^\\0$',
	'^\\01$',
	'^\\08$',
	'^\\xq$',
	'^\\uq$',
	'^\\c*$',
	'^\\c1*$',
	'^\\c_$',
	'^\\k$',
	'^a{bad}$',
	'^a}$',
	'^a{99999999999999999}$',
	'^(){999999999999999999999999999999999999999999999}$',
	'^(?=a)a$',
	'^(?!b)a$',
	'^(?<name>a)$',
	'^(?<名>ab)$',
	'^(?=a|b)[ab]$',
	'^(?!aa)a*$',
	'^(?=(?:a|aa)*b)a+b$',
	'^a(?=b)(?<tail>b)$',
	'^(?=a)?a$',
	'^\\bword\\b$',
	'^\\B.$',
	'^(|a)$',
	'^(a|)$',
	'^(a||b)$',
	'^(?:|a){2,4}$',
	'^(a|aa)*$',
	'^(a|a)*$',
	'^a??b*?c+?$',
	'^a{2}$',
	'^a{1,3}?$',
	'^a{2,}$',
	'^(){999999999}$',
	'^a^b$',
	'^a$b$',
	'a',
	'a|b',
	'^a|b$',
	'^\\+\\*\\?\\{\\}\\[\\]$',
]
const inputs = [
	'',
	'a',
	'A',
	'AB',
	'Ab',
	'aB',
	'foo\na\nbar',
	'b',
	'ab',
	'abc',
	'aaa',
	'aaaaab',
	'GETPOSTGET',
	'1+2+',
	'abcde',
	'a\nb',
	'\n',
	'word',
	' word ',
	'😀',
	'ab\x01',
	'\0',
	'+*?{}[]',
	'\\',
	'\\c',
	'\\cc',
	'\\c1',
	'\\c111',
	'\\c_',
	'\x01',
	'\x008',
	'xq',
	'uq',
	'k',
	'a{bad}',
	'a}',
]

describe('bounded regex semantic compatibility', () => {
	it.each(patterns)('agrees with native boolean matching for %s', (pattern) => {
		for (const value of inputs) {
			expect(
				boundedRegexTest(pattern, value, 1_000_000, 'test'),
				JSON.stringify({ pattern, value }),
			).toBe(new RegExp(pattern).test(value))
		}
	})

	it.each([
		'^(?<=a)b$',
		'^(?<!a)b$',
		'^(?<name$',
		'^(?what)a$',
		'^(a)\\1$',
		'^(?<name>a)\\k<name>$',
		'^a{4,2}$',
		'^(a$',
		'^a)$',
		'^[a$',
		'^a**$',
		'\\',
	])('refuses unsupported or malformed syntax: %s', (pattern) => {
		expect(() => parseBoundedRegex(pattern)).toThrow()
	})

	it.each([
		['^\\1$', '\x01'],
		['^\\123$', 'S'],
		['^\\400$', ' 0'],
		['^\\777$', '?7'],
		['^\\8$', '8'],
		['^\\89+$', '899'],
		['^(a)\\18$', 'a\x018'],
		['^\\(\\1$', '(\x01'],
		['^[(]\\1$', '(\x01'],
		['^(?:a)\\1$', 'a\x01'],
		['^(?=a)a\\1$', 'a\x01'],
		['^\\k<name>$', 'k<name>'],
		['^\\k<$', 'k<'],
		['^\\k<>$', 'k<>'],
	])(
		'accepts legacy escape grammar and matches native: %s',
		(pattern, matching) => {
			expect(() => parseBoundedRegex(pattern)).not.toThrow()
			for (const value of [matching, '', 'a', 'x', `${matching}x`])
				expect(boundedRegexTest(pattern, value, 1_000_000, 'test')).toBe(
					new RegExp(pattern).test(value),
				)
			expect(regexMatch(matching, pattern, 1_000_000, 'test')).toBe(true)
		},
	)
	it.each([
		'^(a)\\1$',
		'^\\1(a)$',
		'^(a)?\\1$',
		'^(?=(a))a\\1$',
		'^(?<name>a)\\1$',
		'^(?<name>a)\\k<name>$',
		`^${'(a)'.repeat(12)}\\12$`,
	])(
		'rejects an actual backreference under the public policy: %s',
		(pattern) => {
			expect(() => new RegExp(pattern)).not.toThrow()
			expect(() => parseBoundedRegex(pattern)).toThrow('backreferences')
		},
	)

	it('bounds source size before native compilation and limits recursive nesting', () => {
		expect(() => parseBoundedRegex('a'.repeat(REGEX_SOURCE_LIMIT + 1))).toThrow(
			'source exceeds',
		)
		expect(() =>
			regexMatch('', 'a'.repeat(REGEX_SOURCE_LIMIT + 1), 1_000_000, 'test'),
		).toThrow(RuntimeFault)
		expect(() =>
			parseBoundedRegex(
				`${'('.repeat(REGEX_DEPTH_LIMIT + 1)}a${')'.repeat(REGEX_DEPTH_LIMIT + 1)}`,
			),
		).toThrow('nesting exceeds')
	})

	it('budgets ambiguity, set merging and unanchored search', () => {
		for (const [pattern, value] of [
			['^(a|aa)*$', `${'a'.repeat(1000)}b`],
			['^\\d*\\d*\\d*\\d*\\d*\\d*x$', '1'.repeat(400)],
			['x', 'a'.repeat(1000)],
		]) {
			expect(() => boundedRegexTest(pattern!, value!, 1000, 'test')).toThrow(
				'budget-exhausted',
			)
		}
	})

	it.skipIf(!scopedModifiersSupported)(
		'supports repeated groups with scoped modifiers through the operator',
		() => {
			expect(regexMatch('AaA', '^(?i:a)+$', 10000, 'test')).toBe(true)
		},
	)

	it('reports unsupported syntax safely at the operator boundary', () => {
		expect(() => boundedRegexTest('(?<=a)', 'a', 1000, 'test')).toThrow(
			'operator-cannot-accept-operand',
		)
	})
})
