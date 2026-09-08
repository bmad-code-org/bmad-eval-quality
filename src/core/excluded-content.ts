/**
 * AD-18's excluded categories, as patterns that read a value rather than a name.
 *
 * AD-18 excludes "credentials, tokens, real names, email addresses, account
 * identifiers, and transaction content" from every artifact this package
 * produces or publishes, and binds "published examples and test fixtures as
 * strictly as real runs". Until this module the whole prohibition was carried by
 * one test that scans `corpus/dev`, so a contract carrying a live-shaped token
 * compiled clean and the token travelled into the sealed brief.
 *
 * Only the value-shaped half of that scan ships here, and the split is the point
 * rather than an economy. AD-18's own reading of the rule for the header channel
 * is that a declaration "names the header and its type and never carries a
 * credential value", so a name is what an author is supposed to write: an
 * operation declaring a `password` body key or an `Authorization` header is a
 * contract for an authentication API, and a gate matching `\bpassword\b` would
 * reject exactly the systems this package exists to evaluate. The patterns below
 * therefore match only strings whose shape is decidable without knowing what
 * field they sit in: a PEM header, a token with an issuer prefix, an address, a
 * checkable account number, a card-shaped digit run. The name-shaped patterns
 * stay in `tests/architecture/dev-corpus.test.ts`, where review rather than a
 * compiler decides.
 *
 * Each pattern carries a string it must fire on, and a test asserts every one
 * still does. A pattern that has rotted into a regex matching nothing is worse
 * than no pattern: it reports clean forever.
 */

/** AD-18's six categories, in the rule's own order. */
export const EXCLUDED_CATEGORIES = [
	'credentials',
	'tokens',
	'real names',
	'email addresses',
	'account identifiers',
	'transaction content',
] as const

export type ExcludedCategory = (typeof EXCLUDED_CATEGORIES)[number]

export type ExcludedContentPattern = {
	readonly category: ExcludedCategory
	readonly regex: RegExp
	/** a string the pattern must match, so a rotted pattern fails its own test. */
	readonly fires: string
}

/**
 * `real names` has no member here and never will: a personal name has no surface
 * form, so every pattern that reaches one reads the field that carries it, which
 * is a name-shaped test. The category stays in the tuple above because AD-18
 * names six and dropping one from the vocabulary would make the gate look total.
 */
export const EXCLUDED_VALUE_PATTERNS: readonly ExcludedContentPattern[] = [
	{
		category: 'credentials',
		regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
		fires: '-----BEGIN RSA PRIVATE KEY-----',
	},
	{
		category: 'tokens',
		regex:
			/(?<![A-Za-z])(?:[Bb]earer\s+[\w.~+/-]{16,}|eyJ[\w-]{8,}\.[\w-]{8,}|sk-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16})/,
		fires: 'Authorization: Bearer abcdefghijklmnopqrstuv',
	},
	{
		category: 'email addresses',
		regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
		fires: '{"contact":"ada@example.com"}',
	},
	{
		// Case-sensitive: an IBAN is upper case, and a case-insensitive form
		// matches a run inside a lower-case hex digest.
		category: 'account identifiers',
		regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b|\b\d{3}-\d{2}-\d{4}\b/,
		fires: 'GB29NWBK60161331926819',
	},
	{
		category: 'transaction content',
		regex: /(?<![0-9A-Za-z])\d{4}(?:[ -]\d{4}){3}(?![0-9A-Za-z])/,
		fires: 'charged 4111 1111 1111 1111',
	},
]

export type ExcludedContentHit = {
	readonly category: ExcludedCategory
	/** the artifact-rooted path of the string that matched. */
	readonly path: string
	/** the matched run, which is short by construction and is what a caller redacts. */
	readonly match: string
}

const step = (path: string, key: string | number): string =>
	typeof key === 'number' ? `${path}[${key}]` : `${path}.${key}`

/**
 * Every string anywhere inside one value, against every value-shaped pattern.
 *
 * Object keys are walked as paths and never scanned as content: a key is a name
 * by construction, which is the same line the pattern set is drawn on. The walk
 * is total over JSON and stops at nothing, so a token nested under a body
 * example twelve levels down is found; the first matching category per string
 * wins, since one string reported six times says nothing more than once.
 *
 * Order is the walk's order, which for an object is its own key order. A caller
 * that needs a stable report over two spellings of the same object sorts what
 * comes back; the compile gate below reads only the first hit and never the
 * order.
 */
export function scanExcludedContent(
	value: unknown,
	path: string,
): readonly ExcludedContentHit[] {
	const hits: ExcludedContentHit[] = []
	const visit = (node: unknown, at: string): void => {
		if (typeof node === 'string') {
			for (const { category, regex } of EXCLUDED_VALUE_PATTERNS) {
				const match = regex.exec(node)
				if (match === null) continue
				hits.push({ category, path: at, match: match[0] })
				return
			}
			return
		}
		if (Array.isArray(node)) {
			node.forEach((element, index) => {
				visit(element, step(at, index))
			})
			return
		}
		if (node === null || typeof node !== 'object') return
		for (const [key, child] of Object.entries(node)) visit(child, step(at, key))
	}
	visit(value, path)
	return hits
}
