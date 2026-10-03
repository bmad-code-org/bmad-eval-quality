import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assessAuditExecution } from './audit-website.mjs'

const advisory = 'https://github.com/advisories/GHSA-ch52-4w7c-c8xp'
const high = (name, via) => ({
	name,
	severity: 'high',
	nodes: [`node_modules/${name}`],
	via,
})
const report = () => ({
	auditReportVersion: 2,
	vulnerabilities: {
		'http-cache-semantics': high('http-cache-semantics', [
			{ url: advisory, range: '<=4.2.0' },
		]),
		astro: high('astro', ['http-cache-semantics']),
		'@astrojs/mdx': high('@astrojs/mdx', ['astro']),
		'astro-expressive-code': high('astro-expressive-code', ['astro']),
		'@astrojs/starlight': high('@astrojs/starlight', ['astro']),
	},
	metadata: { vulnerabilities: { high: 5, critical: 0 } },
})
const context = () => ({
	lock: {
		packages: {
			'node_modules/http-cache-semantics': { version: '4.2.0' },
			'node_modules/astro': {
				dependencies: { 'http-cache-semantics': '^4.2.0' },
			},
		},
	},
	staticSite: true,
	now: Date.parse('2026-10-02T12:00:00Z'),
})
const execution = (body = report()) => ({
	status: 1,
	signal: null,
	error: null,
	stdout: JSON.stringify(body),
})

describe('website audit exception', () => {
	it('accepts only the known static build graph before expiry', () => {
		assert.deepEqual(assessAuditExecution(execution(), context()), {
			ok: true,
			exception: true,
		})
	})

	it('fails closed when npm cannot run or is killed', () => {
		assert.equal(
			assessAuditExecution(
				{ ...execution(), error: new Error('spawn failed') },
				context(),
			).ok,
			false,
		)
		assert.equal(
			assessAuditExecution({ ...execution(), signal: 'SIGTERM' }, context()).ok,
			false,
		)
		assert.equal(
			assessAuditExecution({ ...execution(), status: null }, context()).ok,
			false,
		)
	})

	it('fails closed on truncated or incomplete JSON', () => {
		assert.equal(
			assessAuditExecution({ ...execution(), stdout: '{' }, context()).ok,
			false,
		)
		const missingMetadata = report()
		delete missingMetadata.metadata
		assert.equal(
			assessAuditExecution(execution(missingMetadata), context()).ok,
			false,
		)
		const missingEntry = report()
		delete missingEntry.vulnerabilities.astro
		assert.equal(
			assessAuditExecution(execution(missingEntry), context()).ok,
			false,
		)
	})

	it('fails when exit status and report disagree', () => {
		assert.equal(
			assessAuditExecution({ ...execution(), status: 0 }, context()).ok,
			false,
		)
		assert.equal(
			assessAuditExecution({ ...execution(), status: 2 }, context()).ok,
			false,
		)
	})

	it('fails for another high severity finding or a second advisory', () => {
		const extra = report()
		extra.vulnerabilities.other = high('other', ['astro'])
		extra.metadata.vulnerabilities.high = 6
		assert.equal(assessAuditExecution(execution(extra), context()).ok, false)
		const second = report()
		second.vulnerabilities.astro.via.push({
			url: 'https://example.test/advisory',
		})
		assert.equal(assessAuditExecution(execution(second), context()).ok, false)
	})

	it('fails after expiry, for a deployed server, or after a lockfile change', () => {
		assert.equal(
			assessAuditExecution(execution(), {
				...context(),
				now: Date.parse('2026-10-17T00:00:00Z'),
			}).ok,
			false,
		)
		assert.equal(
			assessAuditExecution(execution(), { ...context(), staticSite: false }).ok,
			false,
		)
		const changed = context()
		changed.lock.packages['node_modules/http-cache-semantics'].version = '4.2.1'
		assert.equal(assessAuditExecution(execution(), changed).ok, false)
	})

	it('passes a complete clean audit with status zero', () => {
		assert.deepEqual(
			assessAuditExecution(
				{
					...execution({
						auditReportVersion: 2,
						vulnerabilities: {},
						metadata: { vulnerabilities: { high: 0, critical: 0 } },
					}),
					status: 0,
				},
				context(),
			),
			{ ok: true, exception: false },
		)
	})
})
