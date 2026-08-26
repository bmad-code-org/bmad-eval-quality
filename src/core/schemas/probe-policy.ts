/** AD-35's default-deny target authorization, as a declared mapping. */
import { z } from 'zod'
import { HttpMethod } from './interface.ts'
import { Identifier } from './primitives.ts'

/**
 * One authorized target. AD-35: "An adapter denies by default and permits only
 * what that mapping names." Every field is required and none has a default:
 * an omitted cap is an unbounded cap, which is the failure this declaration
 * exists to prevent.
 */
export const ProbeTargetAuthorization = z.strictObject({
	interfaceId: Identifier.describe(
		'The logical identifier the contract names. This mapping is where it becomes a target, outside the contract.',
	),
	scheme: z.enum(['http', 'https']),
	host: z.string().min(1),
	port: z.int().min(1).max(65535),
	addresses: z
		.array(z.string().min(1))
		.min(1)
		.describe(
			'The exact resolved addresses this authorization permits, compared after parsing rather than as strings. AD-35 requires every resolved address and every redirect to be revalidated, and requires a loopback, private, link-local, or metadata address to be authorized explicitly rather than by class, so the authorization names addresses rather than a range.',
		),
	methods: z.array(HttpMethod).min(1),
	safeMethods: z
		.array(HttpMethod)
		.describe(
			'AD-35: "Differential body-sensitivity probes use only methods the mapping marks safe for that target." Empty is legal and means no method is safe for a differential here; it is not a synonym for "all of them".',
		),
	maxRedirects: z.int().min(0),
	maxElapsedMs: z.int().min(1),
	maxRequestBytes: z.int().min(1),
	maxResponseBytes: z.int().min(1),
})

export const ProbeTargetPolicy = z.strictObject({
	authorizations: z
		.array(ProbeTargetAuthorization)
		.describe(
			'An empty array is legal and authorizes nothing, which is the default-deny base case and must stay representable.',
		),
})

export type ProbeTargetAuthorization = z.infer<typeof ProbeTargetAuthorization>
export type ProbeTargetPolicy = z.infer<typeof ProbeTargetPolicy>
