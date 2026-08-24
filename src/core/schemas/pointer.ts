/** the three pointer spellings and the consumers each is assigned to. */
import { z } from 'zod'
import { IDENTIFIER_CHARSET_SOURCE } from './primitives.ts'

/**
 * AD-26's closed channel vocabulary, in AD-26's own order: order matters
 * because enum order lands in the export, and Story 1.5's drift check pins
 * whatever ships. Story 1.3 held these only as private regex fragments; they
 * are exported here because the Sealed Run Record's quoted evidence needs to
 * name a channel by one shared spelling.
 */
export const EVIDENCE_CHANNELS = [
	'response-body',
	'response-headers',
	'response-status',
	'call-inputs',
	'stdout',
	'stderr',
	'exit-code',
] as const

export type EvidenceChannelName = (typeof EVIDENCE_CHANNELS)[number]

export const EvidenceChannel = z.enum(EVIDENCE_CHANNELS).meta({
	id: 'EvidenceChannel',
	description:
		"AD-26's closed evidence channel vocabulary. The same seven the interaction-rooted pointer addresses; a channel outside this set is a syntax error rather than an unreachable-evidence finding.",
})

/**
 * AD-19's four transport channels. `call-inputs` alone has no declared
 * structure to resolve against (the defect AD-26 revision 3 records), so a
 * transport channel is mandatory immediately after it.
 */
export const TRANSPORT_CHANNELS = ['path', 'query', 'header', 'body'] as const

export type TransportChannelName = (typeof TRANSPORT_CHANNELS)[number]

export const TransportChannel = z.enum(TRANSPORT_CHANNELS).meta({
	id: 'TransportChannel',
	description:
		"AD-19's four transport channels. They are the segment `call-inputs` takes before its tail, and the four keys an observation's recorded call inputs are keyed by.",
})

// The pattern is not rebuilt from the flat seven. It rests on a three-way
// partition the enum does not carry: channels that take an RFC 6901 tail,
// scalar channels that take none, and `call-inputs`, which takes a transport
// segment first. The partition is spelled by naming its members and typing
// them against the enum, so a typo fails the typecheck; a test asserts it
// stays disjoint and exhaustive over the enum.
//
// A status code and an exit code are scalars, so a pointer into one is a
// syntax error rather than an unreachable-evidence finding.
export const TAIL_BEARING_CHANNELS = [
	'response-body',
	'response-headers',
	'stdout',
	'stderr',
] as const satisfies readonly EvidenceChannelName[]

export const SCALAR_CHANNELS = [
	'response-status',
	'exit-code',
] as const satisfies readonly EvidenceChannelName[]

export const TRANSPORT_ROOTED_CHANNEL =
	'call-inputs' as const satisfies EvidenceChannelName

// An RFC 6901 reference token: any character but "/" and "~", plus the two
// escapes. A token may be empty, which is RFC 6901's spelling for a key that is
// the empty string.
const TOKEN = '(?:[^/~]|~[01])*'
const TAIL = `(?:/${TOKEN})*`

const alternation = (members: readonly string[]): string => members.join('|')

export const INTERACTION_POINTER_PATTERN = new RegExp(
	`^/interactions/${IDENTIFIER_CHARSET_SOURCE}/(?:(?:${alternation(TAIL_BEARING_CHANNELS)})${TAIL}|(?:${alternation(SCALAR_CHANNELS)})|${TRANSPORT_ROOTED_CHANNEL}/(?:${alternation(TRANSPORT_CHANNELS)})${TAIL})$`,
)

export const BOUND_ELEMENT_POINTER_PATTERN = new RegExp(`^@(?:/${TOKEN})+$`)

export const DESCRIPTOR_POINTER_PATTERN = new RegExp(`^(?:/${TOKEN})*$`)

/**
 * Spelling 1, interaction-rooted. Consumers: `{ pointer }` operands, a
 * direction's evidence targets, and a rubric criterion's evidence.
 */
export const InteractionPointer = z
	.string()
	.regex(INTERACTION_POINTER_PATTERN)
	.describe(
		'AD-26 interaction-rooted pointer: "/interactions/{stepId}/" followed by one channel of the closed vocabulary. `call-inputs` takes one of the four transport channels as its next segment; `response-status` and `exit-code` take no tail. Syntax only: whether the step exists and whether the evidence is reachable are compile-time checks, not schema checks.',
	)

/**
 * Spelling 2, bound-element relative. Consumer: a `{ pointer }` operand inside
 * a quantifier predicate. Never an evidence target, because AD-3 computes
 * containment after quantifier substitution, by which point every target is
 * fully rooted.
 */
export const BoundElementPointer = z
	.string()
	.regex(BOUND_ELEMENT_POINTER_PATTERN)
	.describe(
		'AD-26 bound-element pointer: "@/" plus an RFC 6901 tail, addressing the element a quantifier binds. Bare "@/" addresses the element itself. That it appears only inside a quantifier is a compile-time check (Story 4.1), not a schema check.',
	)

/**
 * Spelling 3, descriptor-relative. Consumers: a nominated success indicator,
 * every channel-role key, a collection location's pointer, and volatile
 * pointers. Gate C authoring point 7 fixed this spelling's scope and never gave
 * it a syntax; this is the syntax.
 */
export const DescriptorPointer = z
	.string()
	.regex(DESCRIPTOR_POINTER_PATTERN)
	.describe(
		"A plain RFC 6901 pointer into one operation's response descriptor. It resolves through the operation an interaction step names, never through the interaction root. A request or response shape's descriptor keys are plain key names rather than pointers, so this spelling does not apply there. The empty string is admitted and carries RFC 6901's own meaning, the whole document: as a nominated success indicator it says success is visible in the response taken as a whole rather than at any one key, and as a channel-role key it assigns a role to the whole body.",
	)

/**
 * The pointer form an operand may carry: rooted at an interaction, or relative
 * to a quantifier's bound element.
 */
export const EvidencePointer = z.union([
	InteractionPointer,
	BoundElementPointer,
])
