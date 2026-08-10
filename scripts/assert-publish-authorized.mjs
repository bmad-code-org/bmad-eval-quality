#!/usr/bin/env node
// Closes the local-publish bypass (AD-18): even with a valid NPM_TOKEN, `npm publish` run by hand
// from a laptop must not succeed, or the guard step in publish.yml is decorative. This is npm's own
// `prepublishOnly` lifecycle hook, so it runs for every `npm publish` regardless of caller. Only the
// guarded workflow's "Publish to npmjs.org" step sets EVAL_QUALITY_PUBLISH_AUTHORIZED.

if (process.env.EVAL_QUALITY_PUBLISH_AUTHORIZED !== 'true') {
	console.error(
		'Publish blocked: this package may only be published by the guarded publish.yml workflow.',
	)
	console.error(
		'EVAL_QUALITY_PUBLISH_AUTHORIZED is not set to "true" - refusing to publish from a local run.',
	)
	process.exit(1)
}
