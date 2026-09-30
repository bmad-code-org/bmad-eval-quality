/**
 * The runtime boundary for the HTTP `ProbeTargetPolicy`, the mapping a caller's
 * own `api` adapter and `evaluateTarget` take typed.
 *
 * Lives under `adapters/` for the reason `command-target-policy.ts` records for
 * itself: the mechanically-enforced dependency direction permits `adapters/` to
 * import `core/schemas` and never `core/`, and this parser needs only the
 * schema and the shared boundary. `evaluateTarget` stays in `core/probe/`, and
 * no shipped adapter calls it, because this package performs no network I/O.
 */
import {
	type ProbeTargetPolicy,
	safeParseProbeTargetPolicy,
} from '../core/schemas/probe-policy.ts'
import { parseTargetPolicy } from './parse-target-policy.ts'

/**
 * Validates a mapping an operator loaded from disk against the published
 * `ProbeTargetPolicy` shape before it reaches an adapter or `evaluateTarget`.
 * Every object is strict: an unknown key is refused, `__proto__` included.
 * Each authorization needs a `scheme` of `http` or `https`, a `port` from 1 to
 * 65535, at least one address and one method, a non-negative `maxRedirects`,
 * and ceilings of at least 1. Every `addresses` entry must be an address
 * literal `parseAddress` reads, since an entry it cannot read never matches and
 * so authorizes nothing. Several authorizations may name one `interfaceId`:
 * `evaluateTarget` tries them in declaration order. An empty `authorizations` array is valid and
 * authorizes nothing.
 *
 * Returns Zod's own deep copy of a valid mapping. A refusal throws
 * `RuntimeFault` with code `'schema-parse-failure'`, `artifactPath`
 * `'ProbeTargetPolicy'`, and the `ZodError` carrying every issue as its
 * `cause`; the message lists each issue as its RFC 6901 pointer and message.
 * Input whose own accessors or proxy traps throw is refused with the same code
 * and path, carrying the thrown value as its `cause`. No other error escapes.
 */
export const parseProbeTargetPolicy = (value: unknown): ProbeTargetPolicy =>
	parseTargetPolicy('ProbeTargetPolicy', safeParseProbeTargetPolicy, value)
