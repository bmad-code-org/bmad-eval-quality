/**
 * A caller-typed token as a message quotes it: every C0 and C1 control
 * character and DEL escaped, everything else verbatim. A newline or a
 * carriage return left raw splits a one-line diagnostic, and an escape
 * sequence would reach the terminal. Backslashes and quotes stay as typed, so
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

export function displayToken(token: string): string {
	let out = ''
	for (const character of token) {
		const code = character.codePointAt(0) as number
		if (code >= 0x20 && (code < 0x7f || code > 0x9f)) out += character
		else
			out +=
				CONTROL_ESCAPES[character] ?? `\\u${code.toString(16).padStart(4, '0')}`
	}
	return out
}
