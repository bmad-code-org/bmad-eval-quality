/** Audit the documentation site's complete dependency graph. */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))

export function assessWebsiteAudit(report) {
	if (
		report === null ||
		typeof report !== 'object' ||
		report.auditReportVersion !== 2 ||
		report.vulnerabilities === null ||
		typeof report.vulnerabilities !== 'object' ||
		Array.isArray(report.vulnerabilities) ||
		!Number.isInteger(report.metadata?.vulnerabilities?.high) ||
		!Number.isInteger(report.metadata?.vulnerabilities?.critical)
	)
		return {
			ok: false,
			reason: 'npm returned an incomplete vulnerability report',
		}

	const high = Object.values(report.vulnerabilities).filter((item) =>
		['high', 'critical'].includes(item?.severity),
	)
	if (
		high.length !==
		report.metadata.vulnerabilities.high +
			report.metadata.vulnerabilities.critical
	)
		return { ok: false, reason: 'npm vulnerability report totals disagree' }
	if (high.length > 0)
		return { ok: false, reason: 'website graph has a high severity advisory' }
	return { ok: true }
}

export function assessAuditExecution(audit) {
	if (audit.error || audit.signal || ![0, 1].includes(audit.status))
		return { ok: false, reason: 'npm audit did not complete normally' }
	let report
	try {
		report = JSON.parse(audit.stdout)
	} catch {
		return { ok: false, reason: 'npm audit returned invalid JSON' }
	}
	const result = assessWebsiteAudit(report)
	if (!result.ok) return result
	if (audit.status !== 0)
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
	const result = assessAuditExecution(audit)
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
	} else {
		process.stdout.write('website graph: no high severity advisory\n')
	}
}
