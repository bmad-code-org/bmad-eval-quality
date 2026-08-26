/**
 * AD-37's conformance suite: six assertions per port method, run against a
 * caller-supplied subject.
 *
 * Imports no test runner. A published module that imported vitest would make
 * it a runtime dependency, or fail to load for an adopter using something
 * else. `scripts/dependency-direction.ts` enforces that.
 *
 * Imports no `core/probe/` either. A suite sharing the subject's decision
 * procedure would pass any subject that shared it too.
 */
import { RUNTIME_FAULT_CODES } from '../core/schemas/faults.ts'
import type {
	ClockReadRequest,
	CorpusResolveRequest,
	FileReadRequest,
	FileWriteRequest,
} from '../core/schemas/port-messages.ts'
import { clockReadParsers } from '../ports/clock-port.ts'
import { corpusResolveParsers } from '../ports/corpus-port.ts'
import { fileReadParsers, fileWriteParsers } from '../ports/file-system-port.ts'
import type { BoundaryParser } from '../ports/port.ts'

export type ConformanceOutcome = {
	/** `<method>/<assertion>`, e.g. `readFile/typed-fault`. Unique within a report. */
	readonly id: string
	readonly title: string
	readonly passed: boolean
	readonly detail: string
}

export type ConformancePort =
	| 'corpus'
	| 'clock'
	| 'file-system'
	| 'environment-probe'

/** how many outcomes a complete run of each port produces. Asserted as literals by fixture 58. */
export const CONFORMANCE_OUTCOME_COUNTS = {
	corpus: 6,
	clock: 6,
	'file-system': 12,
	'environment-probe': 19,
} as const

export type ConformanceReport = {
	readonly subject: string
	readonly port: ConformancePort
	readonly outcomes: readonly ConformanceOutcome[]
	readonly passed: boolean
}

export type ScenarioKind = 'resolves' | 'fails' | 'in-band-error' | 'hangs'

export type BuiltSubject<Request> = {
	readonly port: (request: Request, signal: AbortSignal) => Promise<unknown>
	readonly underlyingCalls: () => number
	readonly dispose?: () => Promise<void>
}

export type PortSubject<Request> = {
	readonly name: string
	readonly sampleRequest: Request
	/**
	 * A FRESH instance per scenario. The call counter must count the
	 * underlying mechanism (the filesystem call, the HTTP request), never the
	 * port invocation, or the retry assertion counts the wrong thing and
	 * passes for every adapter.
	 */
	readonly build: (scenario: ScenarioKind) => Promise<BuiltSubject<Request>>
	/** how long "promptly" is for this subject. Default 1000. */
	readonly abortBudgetMs?: number
}

/** "Promptly" with no bound is unfalsifiable. One second clears any real adapter's abort latency and sits well inside a default test timeout. */
export const DEFAULT_ABORT_BUDGET_MS = 1000

const TITLES: Record<string, string> = {
	'typed-fault': 'a mechanism failure rejects with a declared RuntimeFault',
	'single-underlying-call-on-success':
		'exactly one underlying call on a successful invocation',
	'single-underlying-call-on-failure':
		'exactly one underlying call on a failing invocation (no internal retry)',
	'prompt-abort': 'an aborted signal rejects promptly with code "aborted"',
	'no-in-band-error':
		'a value the response schema rejects throws rather than resolving',
	'schema-valid-return':
		'a successful invocation returns a schema-valid response',
}

/** The six ids in report order. Every port method emits all six, prefixed by its own name. */
const SHARED_ASSERTION_IDS = [
	'typed-fault',
	'single-underlying-call-on-success',
	'single-underlying-call-on-failure',
	'prompt-abort',
	'no-in-band-error',
	'schema-valid-return',
] as const

/**
 * A thrown value read as AD-28's fault shape. Structural, not `instanceof`: a
 * published suite can see a `RuntimeFault` from a second copy of this package.
 * A plain `Error` fails it (fixture 45).
 */
export type FaultView = { readonly code: string; readonly artifactPath: string }

export function faultView(error: unknown): FaultView | undefined {
	if (!(error instanceof Error)) return undefined
	const candidate = error as Error & {
		code?: unknown
		artifactPath?: unknown
	}
	const { code, artifactPath } = candidate
	if (typeof code !== 'string' || typeof artifactPath !== 'string') {
		return undefined
	}
	if (!RUNTIME_FAULT_CODES.some((declared: string) => declared === code)) {
		return undefined
	}
	return { code, artifactPath }
}

export function describeThrown(error: unknown): string {
	if (error instanceof Error) return `${error.name}: ${error.message}`
	return `a non-Error value: ${String(error)}`
}

function outcome(
	prefix: string,
	id: string,
	passed: boolean,
	detail: string,
): ConformanceOutcome {
	return {
		id: `${prefix}/${id}`,
		title: TITLES[id] ?? id,
		passed,
		detail,
	}
}

/** For assertions carrying their own title. `probe-conformance.ts` is the only caller; `index.ts` re-exports none of this machinery. */
export function titledOutcome(
	id: string,
	title: string,
	passed: boolean,
	detail: string,
): ConformanceOutcome {
	return { id, title, passed, detail }
}

export type BuildResult<Request> =
	| { readonly ok: true; readonly built: BuiltSubject<Request> }
	| { readonly ok: false; readonly detail: string }

export async function buildScenario<Request>(
	subject: PortSubject<Request>,
	scenario: ScenarioKind,
): Promise<BuildResult<Request>> {
	try {
		return { ok: true, built: await subject.build(scenario) }
	} catch (error) {
		return {
			ok: false,
			detail: `build('${scenario}') threw ${describeThrown(error)}`,
		}
	}
}

/** `undefined` when dispose succeeded or was absent; the throw's description otherwise. */
export async function disposeScenario<Request>(
	built: BuiltSubject<Request>,
): Promise<string | undefined> {
	if (built.dispose === undefined) return undefined
	try {
		await built.dispose()
		return undefined
	} catch (error) {
		return `dispose() threw ${describeThrown(error)}`
	}
}

/** A counter that throws is a broken subject. */
export function countCalls<Request>(
	built: BuiltSubject<Request>,
): number | string {
	try {
		return built.underlyingCalls()
	} catch (error) {
		return `underlyingCalls() threw ${describeThrown(error)}`
	}
}

/** Folds a `dispose` throw into an outcome that had passed. */
export function withDispose(
	base: ConformanceOutcome,
	disposeDetail: string | undefined,
): ConformanceOutcome {
	if (disposeDetail === undefined) return base
	return {
		...base,
		passed: false,
		detail: `${base.detail}; ${disposeDetail}`,
	}
}

export type Settled =
	| { readonly kind: 'resolved'; readonly value: unknown }
	| { readonly kind: 'rejected'; readonly error: unknown }

export async function settle(call: Promise<unknown>): Promise<Settled> {
	try {
		return { kind: 'resolved', value: await call }
	} catch (error) {
		return { kind: 'rejected', error }
	}
}

/**
 * The `resolves` build, shared by two assertions: one underlying call, and a
 * response the port schema accepts. The schema is the suite's, so a subject
 * cannot widen what counts as valid.
 */
async function resolvesOutcomes<Request>(
	prefix: string,
	subject: PortSubject<Request>,
	responseParser: BoundaryParser<unknown>,
): Promise<ConformanceOutcome[]> {
	const run = await buildScenario(subject, 'resolves')
	if (!run.ok) {
		return [
			outcome(prefix, 'single-underlying-call-on-success', false, run.detail),
			outcome(prefix, 'schema-valid-return', false, run.detail),
		]
	}
	const settled = await settle(
		run.built.port(subject.sampleRequest, new AbortController().signal),
	)
	const calls = countCalls(run.built)
	const disposeDetail = await disposeScenario(run.built)

	const callOutcome =
		settled.kind === 'rejected'
			? outcome(
					prefix,
					'single-underlying-call-on-success',
					false,
					`the 'resolves' scenario rejected with ${describeThrown(settled.error)}`,
				)
			: typeof calls === 'string'
				? outcome(prefix, 'single-underlying-call-on-success', false, calls)
				: outcome(
						prefix,
						'single-underlying-call-on-success',
						calls === 1,
						`underlyingCalls() was ${calls}, expected 1`,
					)

	const schemaOutcome =
		settled.kind === 'rejected'
			? outcome(
					prefix,
					'schema-valid-return',
					false,
					`the 'resolves' scenario rejected with ${describeThrown(settled.error)}`,
				)
			: outcome(
					prefix,
					'schema-valid-return',
					responseParser.safeParse(settled.value).success,
					'the resolved value failed the port response schema',
				)

	return [
		withDispose(callOutcome, disposeDetail),
		withDispose(schemaOutcome, disposeDetail),
	]
}

/**
 * The `fails` build, shared by two assertions. The second catches an internal
 * retry: a retry happens on failure and not on success, so a single id would
 * report a retrying adapter and a double-dispatching one identically.
 */
async function failsOutcomes<Request>(
	prefix: string,
	subject: PortSubject<Request>,
): Promise<ConformanceOutcome[]> {
	const run = await buildScenario(subject, 'fails')
	if (!run.ok) {
		return [
			outcome(prefix, 'typed-fault', false, run.detail),
			outcome(prefix, 'single-underlying-call-on-failure', false, run.detail),
		]
	}
	const settled = await settle(
		run.built.port(subject.sampleRequest, new AbortController().signal),
	)
	const calls = countCalls(run.built)
	const disposeDetail = await disposeScenario(run.built)

	let typed: ConformanceOutcome
	if (settled.kind === 'resolved') {
		typed = outcome(
			prefix,
			'typed-fault',
			false,
			"the 'fails' scenario resolved instead of rejecting",
		)
	} else {
		const view = faultView(settled.error)
		typed =
			view === undefined
				? outcome(
						prefix,
						'typed-fault',
						false,
						`rejected with ${describeThrown(settled.error)}, which carries no declared AD-28 code`,
					)
				: outcome(
						prefix,
						'typed-fault',
						view.artifactPath.length > 0,
						`the ${view.code} fault carries an empty artifactPath`,
					)
	}

	const callOutcome =
		typeof calls === 'string'
			? outcome(prefix, 'single-underlying-call-on-failure', false, calls)
			: outcome(
					prefix,
					'single-underlying-call-on-failure',
					calls === 1,
					`underlyingCalls() was ${calls}, expected 1; more than one is an internal retry, which AD-28 forbids`,
				)

	return [
		withDispose(typed, disposeDetail),
		withDispose(callOutcome, disposeDetail),
	]
}

/** The `hangs` build. The signal aborts once the call is in flight; a promise that never settles fails on the budget. */
async function abortOutcome<Request>(
	prefix: string,
	subject: PortSubject<Request>,
): Promise<ConformanceOutcome> {
	const run = await buildScenario(subject, 'hangs')
	if (!run.ok) return outcome(prefix, 'prompt-abort', false, run.detail)

	const budgetMs = subject.abortBudgetMs ?? DEFAULT_ABORT_BUDGET_MS
	const controller = new AbortController()
	// Handlers are attached before the abort, so a late rejection is never an
	// unhandled one even when the budget wins the race.
	const call = settle(run.built.port(subject.sampleRequest, controller.signal))
	await new Promise((resolve) => setTimeout(resolve, 0))
	controller.abort()

	let timer: ReturnType<typeof setTimeout> | undefined
	const budget = new Promise<'budget-expired'>((resolve) => {
		timer = setTimeout(() => resolve('budget-expired'), budgetMs)
	})
	const raced = await Promise.race([call, budget])
	if (timer !== undefined) clearTimeout(timer)
	const disposeDetail = await disposeScenario(run.built)

	let result: ConformanceOutcome
	if (raced === 'budget-expired') {
		result = outcome(
			prefix,
			'prompt-abort',
			false,
			`the call had not settled ${budgetMs}ms after the signal aborted`,
		)
	} else if (raced.kind === 'resolved') {
		result = outcome(
			prefix,
			'prompt-abort',
			false,
			'the call resolved after the signal aborted instead of rejecting',
		)
	} else {
		const view = faultView(raced.error)
		result = outcome(
			prefix,
			'prompt-abort',
			view?.code === 'aborted',
			`rejected with ${view === undefined ? describeThrown(raced.error) : `code "${view.code}"`}, expected the "aborted" fault`,
		)
	}
	return withDispose(result, disposeDetail)
}

/**
 * The `in-band-error` build: AD-28's "a port never returns a partial success
 * or an in-band error value". The code is left unpinned, since an adapter may
 * recognize its own mechanism's error shape and throw `port-failure` first.
 * Resolving fails.
 */
async function inBandOutcome<Request>(
	prefix: string,
	subject: PortSubject<Request>,
): Promise<ConformanceOutcome> {
	const run = await buildScenario(subject, 'in-band-error')
	if (!run.ok) return outcome(prefix, 'no-in-band-error', false, run.detail)

	const settled = await settle(
		run.built.port(subject.sampleRequest, new AbortController().signal),
	)
	const disposeDetail = await disposeScenario(run.built)

	const result =
		settled.kind === 'resolved'
			? outcome(
					prefix,
					'no-in-band-error',
					false,
					'the in-band error value was returned instead of thrown',
				)
			: outcome(
					prefix,
					'no-in-band-error',
					faultView(settled.error) !== undefined,
					`rejected with ${describeThrown(settled.error)}, which carries no declared AD-28 code`,
				)
	return withDispose(result, disposeDetail)
}

/** The six outcomes for one port method, in report order. */
export async function runSharedAssertions<Request>(
	prefix: string,
	subject: PortSubject<Request>,
	responseParser: BoundaryParser<unknown>,
): Promise<ConformanceOutcome[]> {
	const gathered = [
		...(await resolvesOutcomes(prefix, subject, responseParser)),
		...(await failsOutcomes(prefix, subject)),
		await abortOutcome(prefix, subject),
		await inBandOutcome(prefix, subject),
	]
	const byId = new Map(gathered.map((each) => [each.id, each]))
	return SHARED_ASSERTION_IDS.map(
		(id: string) =>
			byId.get(`${prefix}/${id}`) ??
			outcome(prefix, id, false, 'the suite produced no outcome for this id'),
	)
}

/** The count is part of the verdict, so an empty or short outcome list cannot read as a pass. */
export function reportOf(
	subject: string,
	port: ConformancePort,
	outcomes: readonly ConformanceOutcome[],
): ConformanceReport {
	return {
		subject,
		port,
		outcomes,
		passed:
			outcomes.length === CONFORMANCE_OUTCOME_COUNTS[port] &&
			outcomes.every((each: ConformanceOutcome) => each.passed),
	}
}

/** One line per outcome; this string is an adapter author's only view of a failure. A failure leads with `FAIL` and carries its detail. */
export function formatConformanceReport(report: ConformanceReport): string {
	const passes = report.outcomes.filter(
		(each: ConformanceOutcome) => each.passed,
	).length
	const header = `${report.passed ? 'PASS' : 'FAIL'} ${report.port} conformance for "${report.subject}": ${passes}/${report.outcomes.length} assertions passed`
	const lines = report.outcomes.map((each: ConformanceOutcome) =>
		each.passed
			? `pass ${each.id}: ${each.title}`
			: `FAIL ${each.id}: ${each.title} - ${each.detail}`,
	)
	return [header, ...lines].join('\n')
}

export async function runCorpusPortConformance(
	subject: PortSubject<CorpusResolveRequest>,
): Promise<ConformanceReport> {
	return reportOf(
		subject.name,
		'corpus',
		await runSharedAssertions(
			'resolve',
			subject,
			corpusResolveParsers.response,
		),
	)
}

export async function runClockPortConformance(
	subject: PortSubject<ClockReadRequest>,
): Promise<ConformanceReport> {
	return reportOf(
		subject.name,
		'clock',
		await runSharedAssertions('read', subject, clockReadParsers.response),
	)
}

export async function runFileSystemPortConformance(
	readSubject: PortSubject<FileReadRequest>,
	writeSubject: PortSubject<FileWriteRequest>,
): Promise<ConformanceReport> {
	const name =
		readSubject.name === writeSubject.name
			? readSubject.name
			: `${readSubject.name} + ${writeSubject.name}`
	return reportOf(name, 'file-system', [
		...(await runSharedAssertions(
			'readFile',
			readSubject,
			fileReadParsers.response,
		)),
		...(await runSharedAssertions(
			'writeFile',
			writeSubject,
			fileWriteParsers.response,
		)),
	])
}
