import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { assessAuditExecution } from './audit-website.mjs'

const report = (vulnerabilities = {}) => ({
	auditReportVersion: 2,
	vulnerabilities,
	metadata: {
		vulnerabilities: {
			high: Object.values(vulnerabilities).filter(
				(item) => item.severity === 'high',
			).length,
			critical: Object.values(vulnerabilities).filter(
				(item) => item.severity === 'critical',
			).length,
		},
	},
})
const execution = (body = report(), status = 0) => ({
	status,
	signal: null,
	error: null,
	stdout: JSON.stringify(body),
})
const cli = fileURLToPath(new URL('./audit-website.mjs', import.meta.url))

const runCli = (auditJson, auditStatus = 1) => {
	const bin = mkdtempSync(join(tmpdir(), 'website-audit-test-'))
	try {
		if (auditJson !== null)
			writeFileSync(
				join(bin, 'npm'),
				'#!/bin/sh\nprintf "%s" "$AUDIT_JSON"\nexit "$AUDIT_STATUS"\n',
				{ mode: 0o755 },
			)
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

describe('website advisory audit', () => {
	it('passes a complete clean report at the configured high severity threshold', () => {
		assert.deepEqual(assessAuditExecution(execution()), { ok: true })
		const moderate = report({ postcss: { severity: 'moderate' } })
		assert.deepEqual(assessAuditExecution(execution(moderate)), { ok: true })
		const result = runCli(JSON.stringify(moderate), 0)
		assert.equal(result.status, 0)
		assert.match(result.stdout, /no high severity advisory/)
	})

	it('rejects any high or critical advisory, including the former exception', () => {
		for (const severity of ['high', 'critical']) {
			const finding = report({
				'http-cache-semantics': {
					severity,
					via: [{ url: 'https://github.com/advisories/GHSA-ch52-4w7c-c8xp' }],
				},
			})
			assert.deepEqual(assessAuditExecution(execution(finding, 1)), {
				ok: false,
				reason: 'website graph has a high severity advisory',
			})
			assert.equal(runCli(JSON.stringify(finding)).status, 1)
		}
	})

	it('fails closed on missing, incomplete, or inconsistent reports', () => {
		assert.equal(runCli(null).status, 1)
		assert.equal(runCli('{').status, 1)
		assert.equal(runCli(JSON.stringify({ auditReportVersion: 2 })).status, 1)
		assert.equal(assessAuditExecution(execution(report(), 1)).ok, false)
		const inconsistent = report({ other: { severity: 'high' } })
		inconsistent.metadata.vulnerabilities.high = 0
		assert.equal(assessAuditExecution(execution(inconsistent, 1)).ok, false)
		assert.equal(assessAuditExecution({ ...execution(), status: 2 }).ok, false)
		assert.equal(
			assessAuditExecution({ ...execution(), signal: 'SIGTERM' }).ok,
			false,
		)
	})

	it('does not echo advisory text that could masquerade as a transport error', () => {
		const finding = report({
			other: { severity: 'high', via: [{ title: 'Service Unavailable' }] },
		})
		const result = runCli(JSON.stringify(finding))
		assert.equal(result.status, 1)
		assert.doesNotMatch(result.stderr, /Service Unavailable/)
	})

	it('emits a retry marker for an actual npm transport failure', () => {
		const result = runCli('ENOTFOUND registry.npmjs.org')
		assert.equal(result.status, 1)
		assert.match(result.stderr, /audit endpoint returned an error/)
	})
})
