/**
 * What a refused target-policy mapping throws, read the way a consumer reads
 * it: a `RuntimeFault` whose `cause` is the `ZodError` carrying every issue.
 * Shared by the command and MCP parser suites, which hold one contract.
 */
import { expect } from 'vitest'
import { z } from 'zod'
import { RuntimeFault } from '../../../src/core/schemas/faults.ts'

export type PolicyParser = (value: unknown) => unknown

/** The fault a refused input throws; fails the test when nothing throws. */
export function refusal(
	parse: PolicyParser,
	artifactPath: string,
	value: unknown,
): RuntimeFault {
	try {
		parse(value)
	} catch (error) {
		expect(error).toBeInstanceOf(RuntimeFault)
		const fault = error as RuntimeFault
		expect(fault.code).toBe('schema-parse-failure')
		expect(fault.artifactPath).toBe(artifactPath)
		return fault
	}
	throw new Error(`the ${artifactPath} parser accepted the input`)
}

/** The Zod issues a refused input carries as its cause. */
export function issuesOf(
	parse: PolicyParser,
	artifactPath: string,
	value: unknown,
): readonly z.core.$ZodIssue[] {
	const cause = refusal(parse, artifactPath, value).cause
	expect(cause).toBeInstanceOf(z.ZodError)
	return (cause as z.ZodError).issues
}

/** The unrecognized-key issues alone, as path and keys. */
export const unrecognized = (issues: readonly z.core.$ZodIssue[]) =>
	issues
		.filter((issue) => issue.code === 'unrecognized_keys')
		.map((issue) => ({
			path: issue.path,
			keys: (issue as z.core.$ZodIssueUnrecognizedKeys).keys,
		}))

/**
 * Inputs whose reads throw out of Zod itself: a proxy whose `get` throws, a
 * throwing enumerable accessor at the root and on an authorization field, an
 * `authorizations` array whose `length` throws, and a revoked proxy. The first
 * throws `boom`, so a suite can check the cause is what was thrown.
 */
export function hostileInputs(
	validAuthorization: Record<string, unknown>,
	field: string,
	boom: Error,
): unknown[] {
	const thrower = () => {
		throw boom
	}
	const revocable = Proxy.revocable({ authorizations: [] }, {})
	revocable.revoke()
	return [
		new Proxy({ authorizations: [] }, { get: thrower }),
		Object.defineProperty({}, 'authorizations', {
			enumerable: true,
			get: thrower,
		}),
		{
			authorizations: [
				Object.defineProperty({ ...validAuthorization }, field, {
					enumerable: true,
					get: thrower,
				}),
			],
		},
		{
			authorizations: new Proxy([validAuthorization], {
				get: (target, key, receiver) =>
					key === 'length' ? thrower() : Reflect.get(target, key, receiver),
			}),
		},
		revocable.proxy,
	]
}
