import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { assessAuditExecution, isStaticPagesSite } from './audit-website.mjs'

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
const cli = fileURLToPath(new URL('./audit-website.mjs', import.meta.url))

const runCli = (auditJson, auditStatus = 1) => {
	const bin = mkdtempSync(join(tmpdir(), 'website-audit-test-'))
	try {
		if (auditJson !== null) {
			writeFileSync(
				join(bin, 'npm'),
				'#!/bin/sh\nprintf "%s" "$AUDIT_JSON"\nexit "$AUDIT_STATUS"\n',
				{
					mode: 0o755,
				},
			)
		}
		return spawnSync(process.execPath, [cli], {
			encoding: 'utf8',
			env: {
				...process.env,
				PATH: bin,
				AUDIT_JSON: auditJson ?? '',
				AUDIT_STATUS: String(auditStatus),
			},
		})
	} finally {
		rmSync(bin, { recursive: true, force: true })
	}
}

describe('website audit exception', () => {
	it('accepts only the known static build graph before expiry', () => {
		assert.deepEqual(assessAuditExecution(execution(), context()), {
			ok: true,
			exception: true,
		})
	})

	it('accepts the cache package alone once npm sees a fixed release', () => {
		const alone = report()
		for (const name of Object.keys(alone.vulnerabilities))
			if (name !== 'http-cache-semantics') delete alone.vulnerabilities[name]
		alone.metadata.vulnerabilities.high = 1
		assert.deepEqual(assessAuditExecution(execution(alone), context()), {
			ok: true,
			exception: true,
		})
		alone.vulnerabilities['http-cache-semantics'].via[0].url =
			'https://example.test/advisory'
		assert.equal(assessAuditExecution(execution(alone), context()).ok, false)
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

	it('exits nonzero when npm cannot start or returns invalid or incomplete JSON', () => {
		assert.equal(runCli(null).status, 1)
		assert.equal(runCli('{').status, 1)
		const missingMetadata = report()
		delete missingMetadata.metadata
		assert.equal(runCli(JSON.stringify(missingMetadata)).status, 1)
	})

	it('does not print advisory text that could masquerade as a transport failure', () => {
		const extra = report()
		extra.vulnerabilities.other = {
			...high('other', ['astro']),
			via: [{ title: 'Service Unavailable in remote request handler' }],
		}
		extra.metadata.vulnerabilities.high = 6
		const result = runCli(JSON.stringify(extra))
		assert.equal(result.status, 1)
		assert.doesNotMatch(result.stderr, /Service Unavailable/)
	})

	it('emits a retry marker for an actual npm transport failure', () => {
		const result = runCli('ENOTFOUND registry.npmjs.org')
		assert.equal(result.status, 1)
		assert.match(result.stderr, /audit endpoint returned an error/)
	})

	it('detects the actual static Pages build and rejects inline server output', () => {
		const config = readFileSync(
			new URL('../website/astro.config.mjs', import.meta.url),
			'utf8',
		)
		const workflow = readFileSync(
			new URL('../.github/workflows/docs.yaml', import.meta.url),
			'utf8',
		)
		assert.equal(isStaticPagesSite(config, workflow), true)
		assert.equal(
			isStaticPagesSite(
				config.replace('defineConfig({', "defineConfig({ output: 'server',"),
				workflow,
			),
			false,
		)
		assert.equal(
			isStaticPagesSite(
				config,
				workflow.replace('actions/deploy-pages@', 'actions/deploy-other@'),
			),
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
