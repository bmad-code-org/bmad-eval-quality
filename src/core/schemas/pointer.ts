/** the three pointer spellings and the consumers each is assigned to. */
import { z } from 'zod'
import { IDENTIFIER_CHARSET_SOURCE } from './primitives.ts'

// An RFC 6901 reference token: any character but "/" and "~", plus the two
// escapes. A token may be empty, which is RFC 6901's spelling for a key that is
// the empty string.
const TOKEN = '(?:[^/~]|~[01])*'
const TAIL = `(?:/${TOKEN})*`

// AD-26's closed channel vocabulary, split by whether a tail is meaningful.
// A status code and an exit code are scalars, so a pointer into one addresses
// nothing and is a syntax error rather than an unreachable-evidence finding.
const CHANNELS_WITH_TAIL = 'response-body|response-headers|stdout|stderr'
const SCALAR_CHANNELS = 'response-status|exit-code'
// AD-19's four transport channels. `call-inputs` alone has no declared
// structure to resolve against, which is the defect AD-26 records revision 3
// carrying, so the channel is mandatory rather than optional.
const TRANSPORT_CHANNELS = 'path|query|header|body'

export const INTERACTION_POINTER_PATTERN = new RegExp(
	`^/interactions/${IDENTIFIER_CHARSET_SOURCE}/(?:(?:${CHANNELS_WITH_TAIL})${TAIL}|(?:${SCALAR_CHANNELS})|call-inputs/(?:${TRANSPORT_CHANNELS})${TAIL})$`,
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
