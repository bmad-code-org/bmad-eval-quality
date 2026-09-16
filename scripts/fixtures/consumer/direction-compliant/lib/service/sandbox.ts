// A mock of a sandbox's own `require`, the shape a test hands to a script
// runner. The method shorthand and the member call below are ordinary
// JavaScript and neither is a CommonJS require site; a gate that read them as
// one taught a consumer to rename a mock.
export const sandbox = {
	require(name: string): unknown {
		if (name === 'fs') return {}
		throw new Error(`unexpected dependency: ${name}`)
	},
}

export const loaded = sandbox.require('fs')
