/**
 * A caller-typed token as a message quotes it: every C0 and C1 control
 * character, DEL, the U+2028 and U+2029 separators and the bidirectional
 * formatting controls escaped, everything else verbatim. A newline or a
 * carriage return left raw splits a one-line diagnostic, a reader that splits
 * on Unicode line breaks splits on the two separators as well, an escape
 * sequence would reach the terminal, and a bidirectional override reorders
 * how the rest of the line displays. Backslashes and quotes stay as typed, so
 * a Windows path reads the way it was written.
 *
 * Here in `core/` because a library refusal quotes a caller's value too, and
 * the CLI reaches it through `application/display-token.ts`.
 */
const CONTROL_ESCAPES: Readonly<Record<string, string>> = {
	'\n': '\\n',
	'\r': '\\r',
	'\t': '\\t',
}

/**
 * The bidirectional formatting controls: ALM, LRM and RLM, the embeddings and
 * overrides U+202A to U+202E, and the isolates U+2066 to U+2069.
 */
const isBidiControl = (code: number): boolean =>
	code === 0x061c ||
	code === 0x200e ||
	code === 0x200f ||
	(code >= 0x202a && code <= 0x202e) ||
	(code >= 0x2066 && code <= 0x2069)

const isEscaped = (code: number): boolean =>
	code < 0x20 ||
	(code >= 0x7f && code <= 0x9f) ||
	code === 0x2028 ||
	code === 0x2029 ||
	isBidiControl(code)

/**
 * Every escape is printable ASCII, so the output holds nothing this escapes
 * again: `displayToken(displayToken(x)) === displayToken(x)`, which lets a
 * renderer escape a message that already quoted its values through it.
 */
export function displayToken(token: string): string {
	let out = ''
	for (const character of token) {
		const code = character.codePointAt(0) as number
		out += isEscaped(code)
			? (CONTROL_ESCAPES[character] ??
				`\\u${code.toString(16).padStart(4, '0')}`)
			: character
	}
	return out
}
