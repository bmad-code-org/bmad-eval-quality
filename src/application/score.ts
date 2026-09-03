/**
 * The one orchestration call chaining `ingest` -> `score` -> `emit` (AD-24),
 * awaiting `CorpusPort.resolve` (AD-34: `application/` is the only layer
 * that awaits) for two digest-verification obligations: each
 * `--private-manifest` entry, and `SealedRunRecord.isolationManifestArtifact`
 * when it names a private reference. The public branch of an
 * `ArtifactReference` has no port and no byte-read to reuse, so it stays out
 * of scope.
 *
 * Both digest comparisons are over `digestBytes(response.bytes)`, never
 * `digestArtifact`: `CorpusResolveResponse.bytes` is already the stored
 * bytes a manifest digest is declared against, and a canonical-form digest
 * over a parsed object would be the unsound comparison `deferred-work.md`
 * names as the reason this check waited for a port-awaiting caller.
 *
 * No decision logic lives here: every branch is a parse, a digest
 * comparison, an await, or a call into `ingest`/`score`/`emit` (AD-14).
 */
import { digestBytes } from '../core/canonical/digest.ts'
import { emit } from '../core/emit/emit.ts'
import { checkPrivateArtifactManifestDigests } from '../core/emit/private-artifact-digest.ts'
import { ingest } from '../core/ingest/index.ts'
import { EvalContract } from '../core/schemas/eval-contract.ts'
import { EvaluatorConfiguration } from '../core/schemas/evaluator-configuration.ts'
import type { EvidenceArtifact } from '../core/schemas/evidence-artifact.ts'
import { RuntimeFault } from '../core/schemas/faults.ts'
import { IsolationManifest } from '../core/schemas/isolation-manifest.ts'
import { PreflightVerdict } from '../core/schemas/preflight-verdict.ts'
import { Digest } from '../core/schemas/primitives.ts'
import { PrivateArtifactManifest } from '../core/schemas/private-artifact-manifest.ts'
import { Probe } from '../core/schemas/probe.ts'
import { ScoringPolicy } from '../core/schemas/scoring-policy.ts'
import { SealedRunRecord } from '../core/schemas/sealed-run-record.ts'
import type { LadderResolution } from '../core/score/ladder.ts'
import { score } from '../core/score/score.ts'
import { type CorpusPort, corpusResolveParsers } from '../ports/corpus-port.ts'
import { invokePort } from './invoke-port.ts'

export type RunScoreOptions = {
	readonly record: SealedRunRecord
	readonly manifest: IsolationManifest | null
	readonly configuration: EvaluatorConfiguration | null
	readonly contract: EvalContract
	readonly probe: Probe
	readonly preflightVerdict: PreflightVerdict
	readonly policy: ScoringPolicy
	/** Present, its entries are checked; absent, the check is skipped: no stage row declares `private-artifact-manifest` as an input, so the command exposes it as its own optional flag. */
	readonly privateManifest: PrivateArtifactManifest | null
	/**
	 * AD-11's one scoring-version input with no artifact source anywhere in
	 * this pipeline, so it arrives caller-attested, the same posture
	 * `--run-id` already takes for a value with no JSON artifact behind it.
	 */
	readonly corpusDigest: string
	/**
	 * Absent when neither `privateManifest` nor a private-storage
	 * `record.isolationManifestArtifact` needs resolving: `score` then
	 * resolves no private reference.
	 */
	readonly port?: CorpusPort
	readonly signal: AbortSignal
}

export type RunScoreResult = {
	/**
	 * `null` only on the Invalid rung: `emit`'s own module comment says
	 * reaching that rung "is the caller's own signal to stop before minting
	 * an artifact at all", mirroring `worked-example-target.ts`'s own
	 * `if (ladder.verdict === null) fail(...)` guard before its `emit` call.
	 * No legal `EvidenceArtifact` carries a `null` verdict, so this is the
	 * one case with nothing to return here.
	 */
	readonly artifact: EvidenceArtifact | null
	readonly ladder: LadderResolution
}

function parseFault(artifactPath: string, cause: unknown): RuntimeFault {
	return new RuntimeFault(
		'schema-parse-failure',
		artifactPath,
		`input does not conform to the ${artifactPath} schema`,
		{ cause },
	)
}

function parseRecord(input: SealedRunRecord): SealedRunRecord {
	const parsed = SealedRunRecord.safeParse(input)
	if (!parsed.success) throw parseFault('SealedRunRecord', parsed.error)
	return parsed.data
}

function parseManifest(
	input: IsolationManifest | null,
): IsolationManifest | null {
	if (input === null) return null
	const parsed = IsolationManifest.safeParse(input)
	if (!parsed.success) throw parseFault('IsolationManifest', parsed.error)
	return parsed.data
}

function parseConfiguration(
	input: EvaluatorConfiguration | null,
): EvaluatorConfiguration | null {
	if (input === null) return null
	const parsed = EvaluatorConfiguration.safeParse(input)
	if (!parsed.success) throw parseFault('EvaluatorConfiguration', parsed.error)
	return parsed.data
}

function parseContract(input: EvalContract): EvalContract {
	const parsed = EvalContract.safeParse(input)
	if (!parsed.success) throw parseFault('EvalContract', parsed.error)
	return parsed.data
}

function parseProbe(input: Probe): Probe {
	const parsed = Probe.safeParse(input)
	if (!parsed.success) throw parseFault('Probe', parsed.error)
	return parsed.data
}

function parsePreflightVerdict(input: PreflightVerdict): PreflightVerdict {
	const parsed = PreflightVerdict.safeParse(input)
	if (!parsed.success) throw parseFault('PreflightVerdict', parsed.error)
	return parsed.data
}

function parsePolicy(input: ScoringPolicy): ScoringPolicy {
	const parsed = ScoringPolicy.safeParse(input)
	if (!parsed.success) throw parseFault('ScoringPolicy', parsed.error)
	return parsed.data
}

function parsePrivateManifest(
	input: PrivateArtifactManifest | null,
): PrivateArtifactManifest | null {
	if (input === null) return null
	const parsed = PrivateArtifactManifest.safeParse(input)
	if (!parsed.success) throw parseFault('PrivateArtifactManifest', parsed.error)
	return parsed.data
}

function parseCorpusDigest(input: string): string {
	const parsed = Digest.safeParse(input)
	if (!parsed.success) {
		throw parseFault('ScoringVersionInputs.corpusDigest', parsed.error)
	}
	return parsed.data
}

/**
 * The port a private reference needs resolving through but was not given.
 * Unreachable from the CLI, which refuses the same shape as a usage error
 * before `runScore` is ever called; a bypass-only precondition violation, so
 * a plain `TypeError` per `emit.ts`'s own "reachable only through a
 * type-system bypass" precedent, never a `RuntimeFault` for a shape no
 * legitimate caller can reach.
 */
function requirePort(
	port: CorpusPort | undefined,
	artifactPath: string,
): CorpusPort {
	if (port === undefined) {
		throw new TypeError(
			`runScore(): ${artifactPath} names a private reference, but no CorpusPort was supplied`,
		)
	}
	return port
}

/** Resolves one private reference and digests its stored bytes -- never `digestArtifact`; see this module's header. */
async function resolvedDigestOf(
	privateRef: string,
	port: CorpusPort,
	signal: AbortSignal,
): Promise<string> {
	const response = await invokePort({
		request: { privateRef },
		requestParser: corpusResolveParsers.request,
		responseParser: corpusResolveParsers.response,
		port: port.resolve,
		signal,
		requestPath: 'CorpusResolveRequest',
		responsePath: 'CorpusResolveResponse',
	})
	return digestBytes(response.bytes)
}

/** Each `--private-manifest` entry's declared digest, checked against its resolved bytes. */
async function checkPrivateManifestEntries(
	manifest: PrivateArtifactManifest,
	port: CorpusPort | undefined,
	signal: AbortSignal,
): Promise<void> {
	// `PrivateArtifactManifest.entries` carries no `.min(1)`, so an empty
	// manifest is legal input with nothing to resolve. Checked before
	// `requirePort`: a manifest with zero entries needs no port at all, and
	// demanding one anyway would make an empty `--private-manifest` require
	// `--corpus-root` for no reason.
	if (manifest.entries.length === 0) return
	const resolvedPort = requirePort(port, 'PrivateArtifactManifest')
	const resolvedDigests = new Map<string, string>()
	// Sequential, matching `runPreflight`'s own precedent: no ordering
	// constraint applies here, but one seam awaiting a port is enough seams.
	for (const entry of manifest.entries) {
		resolvedDigests.set(
			entry.privateRef,
			await resolvedDigestOf(entry.privateRef, resolvedPort, signal),
		)
	}
	checkPrivateArtifactManifestDigests(manifest, resolvedDigests)
}

/** `isolationManifestArtifact`'s declared digest, checked against its resolved bytes, private storage only. */
async function checkIsolationManifestArtifact(
	record: SealedRunRecord,
	port: CorpusPort | undefined,
	signal: AbortSignal,
): Promise<void> {
	const reference = record.isolationManifestArtifact
	if (reference.storage !== 'private') return
	const resolvedPort = requirePort(
		port,
		'SealedRunRecord.isolationManifestArtifact',
	)
	const resolved = await resolvedDigestOf(
		reference.privateRef,
		resolvedPort,
		signal,
	)
	if (resolved !== reference.digest) {
		throw new RuntimeFault(
			'digest-mismatch',
			'SealedRunRecord.isolationManifestArtifact',
			`declares digest "${reference.digest}", but the resolved bytes digest to "${resolved}"`,
		)
	}
}

export async function runScore(
	options: RunScoreOptions,
): Promise<RunScoreResult> {
	const record = parseRecord(options.record)
	const manifest = parseManifest(options.manifest)
	const configuration = parseConfiguration(options.configuration)
	const contract = parseContract(options.contract)
	const probe = parseProbe(options.probe)
	const preflightVerdict = parsePreflightVerdict(options.preflightVerdict)
	const policy = parsePolicy(options.policy)
	const privateManifest = parsePrivateManifest(options.privateManifest)
	const corpusDigest = parseCorpusDigest(options.corpusDigest)
	const { port, signal } = options

	if (privateManifest !== null) {
		await checkPrivateManifestEntries(privateManifest, port, signal)
	}
	await checkIsolationManifestArtifact(record, port, signal)

	const validated = ingest(record, manifest, configuration)
	const scored = score(
		contract,
		[validated],
		probe,
		preflightVerdict,
		policy,
		// Neither has a declared-input source: the contract declares no
		// waiver and the run record carries no AD-26 evaluation fault field,
		// mirroring `worked-example-target.ts`'s own precedent for the
		// identical gap.
		'none',
		false,
	)

	if (scored.ladder.verdict === null) {
		return { artifact: null, ladder: scored.ladder }
	}

	const artifact = emit(
		scored,
		corpusDigest,
		// AD-11 names the same fixture digest `PreflightVerdict.fixtureDigest`
		// already carries: restated, never re-derived.
		preflightVerdict.fixtureDigest,
		record.evaluatorConfigurationDigest,
	)
	return { artifact, ladder: scored.ladder }
}
