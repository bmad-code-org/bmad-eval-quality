/**
 * Audit the static documentation site's build graph.
 *
 * GHSA-ch52-4w7c-c8xp had no patched release on 2026-10-02. Release 4.3.0
 * appeared on 2026-10-04, inside the lockfile-age window, so the lockfile keeps
 * 4.2.0 until the window passes. Astro uses http-cache-semantics while building
 * the site, and GitHub Pages serves the generated files without an Astro or
 * Node server. npm reports either the whole Astro chain or, once a fix exists,
 * the cache package alone. This temporary exception applies only to that
 * advisory and those two report shapes. All other high and critical advisories
 * fail the gate.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const advisory = 'https://github.com/advisories/GHSA-ch52-4w7c-c8xp'
const expires = Date.parse('2026-10-17T00:00:00Z')
const affected = new Set([
	'http-cache-semantics',
	'astro',
	'@astrojs/mdx',
	'astro-expressive-code',
	'@astrojs/starlight',
])

export const isStaticPagesSite = (config, workflow) =>
	config.includes("outDir: '../build/site'") &&
	!/(?:\boutput|\badapter)\s*:/.test(config) &&
	workflow.includes('actions/upload-pages-artifact@') &&
	workflow.includes('actions/deploy-pages@')

const staticPagesSite = () => {
	const config = readFileSync(
		new URL('../website/astro.config.mjs', import.meta.url),
		'utf8',
	)
	const workflow = readFileSync(
		new URL('../.github/workflows/docs.yaml', import.meta.url),
		'utf8',
	)
	return isStaticPagesSite(config, workflow)
}

export function assessWebsiteAudit(report, { lock, staticSite, now }) {
	if (
		report === null ||
		typeof report !== 'object' ||
		report.auditReportVersion !== 2 ||
		report.vulnerabilities === null ||
		typeof report.vulnerabilities !== 'object' ||
		!Number.isInteger(report.metadata?.vulnerabilities?.high) ||
		!Number.isInteger(report.metadata?.vulnerabilities?.critical)
	)
		return {
			ok: false,
			reason: 'npm returned an incomplete vulnerability report',
		}
	const high = Object.entries(report.vulnerabilities).filter(([, item]) =>
		['high', 'critical'].includes(item?.severity),
	)
	if (
		high.length !==
		report.metadata.vulnerabilities.high +
			report.metadata.vulnerabilities.critical
	)
		return { ok: false, reason: 'npm vulnerability report totals disagree' }
	if (high.length === 0) return { ok: true, exception: false }
	if (now >= expires)
		return { ok: false, reason: 'website advisory exception expired' }
	if (!staticSite)
		return { ok: false, reason: 'website is no longer a static Pages build' }
	if (
		lock.packages?.['node_modules/http-cache-semantics']?.version !== '4.2.0' ||
		lock.packages?.['node_modules/astro']?.dependencies?.[
			'http-cache-semantics'
		] !== '^4.2.0'
	)
		return { ok: false, reason: 'the locked Astro cache dependency changed' }
	const cacheOnly = high.length === 1 && high[0][0] === 'http-cache-semantics'
	const wholeChain =
		high.length === affected.size && high.every(([name]) => affected.has(name))
	if (!cacheOnly && !wholeChain)
		return {
			ok: false,
			reason: 'website graph has another high severity advisory',
		}
	for (const [name, item] of high) {
		if (name === 'http-cache-semantics') {
			if (
				item.severity !== 'high' ||
				item.nodes?.join() !== 'node_modules/http-cache-semantics' ||
				item.via?.length !== 1 ||
				item.via[0]?.url !== advisory ||
				item.via[0]?.range !== '<=4.2.0'
			)
				return {
					ok: false,
					reason: 'the cache advisory or affected range changed',
				}
		} else if (
			item.severity !== 'high' ||
			!Array.isArray(item.via) ||
			item.via.length === 0 ||
			item.via.some(
				(cause) => typeof cause !== 'string' || !affected.has(cause),
			)
		) {
			return { ok: false, reason: `${name} has an independent advisory` }
		}
	}
	return { ok: true, exception: true }
}

export function assessAuditExecution(audit, context) {
	if (audit.error || audit.signal || ![0, 1].includes(audit.status))
		return { ok: false, reason: 'npm audit did not complete normally' }
	let report
	try {
		report = JSON.parse(audit.stdout)
	} catch {
		return { ok: false, reason: 'npm audit returned invalid JSON' }
	}
	const result = assessWebsiteAudit(report, context)
	if (!result.ok) return result
	if (audit.status !== (result.exception ? 1 : 0))
		return {
			ok: false,
			reason: 'npm audit exit status disagrees with its report',
		}
	return result
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	const audit = spawnSync(
		'npm',
		[
			'--prefix',
			'website',
			'audit',
			'--audit-level=high',
			'--json',
			'--fetch-timeout=30000',
		],
		{ cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
	)
	const lock = JSON.parse(
		readFileSync(
			new URL('../website/package-lock.json', import.meta.url),
			'utf8',
		),
	)
	const result = assessAuditExecution(audit, {
		lock,
		staticSite: staticPagesSite(),
		now: Date.now(),
	})
	if (!result.ok) {
		process.stderr.write(`${result.reason}\n`)
		if (
			[
				'npm audit did not complete normally',
				'npm audit returned invalid JSON',
				'npm returned an incomplete vulnerability report',
			].includes(result.reason) &&
			/audit endpoint returned an error|Service Unavailable|Gateway Time-?out|Bad Gateway|ETIMEDOUT|ENOTFOUND|ECONNRESET|socket hang up/.test(
				`${audit.stderr || ''}${audit.stdout || ''}`,
			)
		)
			process.stderr.write('audit endpoint returned an error\n')
		process.exitCode = 1
	} else if (result.exception) {
		process.stdout.write(
			`::warning::website graph: temporary static-site exception for ${advisory}; expires 2026-10-17.\n`,
		)
	} else {
		process.stdout.write('website graph: no high severity advisory\n')
	}
}
