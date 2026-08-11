// Runtime fault registry (AD-28): thrown, typed errors carrying a stable machine
// code and the path of the artifact that produced them. Disjoint from AD-5's
// compile-time code registry — the two share at most this base shape, never a
// code table. Only codes with a genuine thrower belong here.
export type RuntimeFaultCode =
	| 'non-canonicalizable-value'
	| 'schema-parse-failure'

export class RuntimeFault extends Error {
	readonly code: RuntimeFaultCode
	readonly artifactPath: string

	constructor(code: RuntimeFaultCode, artifactPath: string, detail: string) {
		super(`${code} in ${artifactPath}: ${detail}`)
		this.name = 'RuntimeFault'
		this.code = code
		this.artifactPath = artifactPath
	}
}
