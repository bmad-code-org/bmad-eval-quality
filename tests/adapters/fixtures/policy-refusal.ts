/**
 * What a refused target-policy mapping throws, read the way a consumer reads
 * it: a `RuntimeFault` whose `cause` is the `ZodError` carrying every issue.
 * Shared by the command, MCP, and HTTP parser suites, which hold one contract.
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

/** A value a hostile input throws, and the thrown-value shapes a boundary must carry whole. */
const THROWN: readonly unknown[] = [
	new Error('boom'),
	'a thrown string',
	undefined,
]

export type HostileInput = {
	readonly label: string
	readonly value: unknown
	/** Holds when the fault's `cause` is exactly what this input makes Zod's read throw. */
	readonly expectCause: (cause: unknown) => void
}

/**
 * Inputs whose reads throw out of Zod itself: a proxy whose `get` throws, a
 * throwing enumerable accessor at the root and on an authorization field, and
 * an `authorizations` array whose `length` throws, each throwing an `Error`, a
 * string, and `undefined`, so a boundary that rethrows or drops anything but an
 * `Error` fails. A revoked proxy throws the engine's own `TypeError`. Each
 * input carries the check that its refusal's `cause` is exactly what was thrown.
 */
export function hostileInputs(
	validAuthorization: Record<string, unknown>,
	field: string,
): HostileInput[] {
	const inputs: HostileInput[] = []
	for (const thrown of THROWN) {
		const thrower = () => {
			throw thrown
		}
		const name = thrown instanceof Error ? 'an Error' : String(thrown)
		const expectCause = (cause: unknown) => expect(cause).toBe(thrown)
		inputs.push(
			{
				label: `a proxy whose get throws ${name}`,
				value: new Proxy({ authorizations: [] }, { get: thrower }),
				expectCause,
			},
			{
				label: `a root accessor that throws ${name}`,
				value: Object.defineProperty({}, 'authorizations', {
					enumerable: true,
					get: thrower,
				}),
				expectCause,
			},
			{
				label: `an authorization accessor that throws ${name}`,
				value: {
					authorizations: [
						Object.defineProperty({ ...validAuthorization }, field, {
							enumerable: true,
							get: thrower,
						}),
					],
				},
				expectCause,
			},
			{
				label: `an array whose length throws ${name}`,
				value: {
					authorizations: new Proxy([validAuthorization], {
						get: (target, key, receiver) =>
							key === 'length' ? thrower() : Reflect.get(target, key, receiver),
					}),
				},
				expectCause,
			},
		)
	}
	const revocable = Proxy.revocable({ authorizations: [] }, {})
	revocable.revoke()
	inputs.push({
		label: 'a revoked proxy',
		value: revocable.proxy,
		expectCause: (cause) => expect(cause).toBeInstanceOf(TypeError),
	})
	return inputs
}

/**
 * Every hostile input is refused as `schema-parse-failure` whose message says
 * the input could not be read, with exactly the thrown value as its `cause`:
 * no other error escapes, and a thrown non-`Error` is carried, not replaced.
 */
export function expectUnreadableRefusals(
	parse: PolicyParser,
	artifactPath: string,
	validAuthorization: Record<string, unknown>,
	field: string,
): void {
	for (const input of hostileInputs(validAuthorization, field)) {
		const fault = refusal(parse, artifactPath, input.value)
		expect(fault.message, input.label).toContain('input could not be read')
		expect(Object.hasOwn(fault, 'cause'), input.label).toBe(true)
		input.expectCause(fault.cause)
	}
}
