/**
 * AD-12's presented-chain reader and AD-29's one constructor. Nothing here
 * holds state between calls, and no lineage is tracked across invocations
 * (AD-12). `checks` is AD-12's three named booleans, the shape `emit`
 * serializes onto every Evidence Artifact; `findings` says which of the three
 * failed and why.
 *
 * Chain defects are returned. AD-29 commands no code in either registry and
 * AD-28's audit rule makes minting one a spine amendment, so the nine codes
 * below are a module-local vocabulary in neither registry. Two faults are
 * still thrown, both already registered and both commanded by another AD:
 * `schema-version-mismatch` (AD-11) and, from `digestArtifact`,
 * `non-canonicalizable-value` (AD-36).
 *
 * Each member must be a whole artifact already parsed against one published
 * schema, the precondition every `core/` function has. A member narrowed to
 * the three lineage fields digests differently and breaks its own chain.
 */
import { digestArtifact } from '../canonical/digest.ts'
import type { LineageChain } from '../schemas/evidence-artifact.ts'
import { RuntimeFault } from '../schemas/faults.ts'
import { freezeArtifact } from './freeze.ts'

export const LINEAGE_DEFECT_CODES = [
	'lineage-root-invalid',
	'lineage-duplicate-artifact',
	'lineage-no-root',
	'lineage-multiple-roots',
	'lineage-parent-absent',
	'lineage-revision-not-successor',
	'lineage-revision-conflict',
	'lineage-length-inconsistent',
	'lineage-remediation-cap-exceeded',
] as const

export type LineageDefectCode = (typeof LINEAGE_DEFECT_CODES)[number]

/** The three fields `lineage.ts` spreads, as the shape this module reads. */
export type LineageFields = {
	readonly schemaVersion: number
	readonly parentDigest: string | null
	readonly revisionCount: number
}

export type LineageFinding = {
	readonly code: LineageDefectCode
	readonly artifactPath: string
	readonly detail: string
}

export type LineageChainOptions = {
	readonly artifactPath: string
	/** AD-11: a member outside this version throws `schema-version-mismatch`. */
	readonly acceptedSchemaVersion: number
	/** AD-12's declared revision; the chain's length must be one greater. */
	readonly declaredRevisionCount: number
	/** AD-12's remediation cap from the scoring policy, or null when none is presented. */
	readonly remediationCap: number | null
}

export type LineageChainReport = {
	readonly artifactPath: string
	readonly findings: readonly LineageFinding[]
	readonly checks: LineageChain
	readonly passed: boolean
}

/**
 * Which of AD-12's three booleans each code clears. A `Record` over the code
 * union, so a tenth code is a compile error here before it can reach a report
 * with no boolean to affect. The cap maps to null; AD-12 records it in
 * `Remediation.cap`, beside `lineageChain`.
 */
export const CHECK_PROJECTION: Record<
	LineageDefectCode,
	keyof LineageChain | null
> = {
	'lineage-root-invalid': 'noGap',
	'lineage-duplicate-artifact': 'noRepeatedDigest',
	'lineage-no-root': 'noGap',
	'lineage-multiple-roots': 'noGap',
	'lineage-parent-absent': 'noGap',
	'lineage-revision-not-successor': 'noGap',
	'lineage-revision-conflict': 'noGap',
	'lineage-length-inconsistent': 'lengthConsistent',
	'lineage-remediation-cap-exceeded': null,
}

const codeRank = (code: LineageDefectCode): number =>
	LINEAGE_DEFECT_CODES.indexOf(code)

function groupBy<T>(
	items: readonly T[],
	key: (item: T) => string,
): Map<string, T[]> {
	const groups = new Map<string, T[]>()
	for (const item of items) {
		const bucket = groups.get(key(item))
		if (bucket === undefined) groups.set(key(item), [item])
		else bucket.push(item)
	}
	return groups
}

type Member = {
	readonly digest: string
	readonly parentDigest: string | null
	readonly revisionCount: number
}

function readMembers<T extends LineageFields>(
	artifacts: readonly T[],
	options: LineageChainOptions,
): Member[] {
	return artifacts.map((artifact) => {
		if (artifact.schemaVersion !== options.acceptedSchemaVersion) {
			throw new RuntimeFault(
				'schema-version-mismatch',
				options.artifactPath,
				`chain member carries "schemaVersion" ${artifact.schemaVersion} where the reader accepts ${options.acceptedSchemaVersion} (AD-11)`,
			)
		}
		return {
			digest: digestArtifact(artifact, options.artifactPath),
			parentDigest: artifact.parentDigest,
			revisionCount: artifact.revisionCount,
		}
	})
}

function assertCount(value: number, label: string, path: string): void {
	if (Number.isSafeInteger(value) && value >= 0) return
	throw new TypeError(
		`validateLineageChain() received a "${label}" that is not a non-negative safe integer: ${path}`,
	)
}

/**
 * Validates one presented chain of revisions of a single artifact type
 * (AD-12, AD-29). Every defect is collected, so a chain with three problems
 * reports three findings.
 */
export function validateLineageChain<T extends LineageFields>(
	artifacts: readonly T[],
	options: LineageChainOptions,
): LineageChainReport {
	const { artifactPath } = options
	assertCount(
		options.declaredRevisionCount,
		'declaredRevisionCount',
		artifactPath,
	)
	if (options.remediationCap !== null) {
		assertCount(options.remediationCap, 'remediationCap', artifactPath)
	}
	const members = readMembers(artifacts, options)
	const at = (digest: string): string => `${artifactPath}[digest=${digest}]`
	const findings: LineageFinding[] = []
	const add = (code: LineageDefectCode, path: string, detail: string): void => {
		findings.push({ code, artifactPath: path, detail })
	}

	// The biconditional `lineage.ts` states and the constraint ledger records
	// as not expressible in the published schema.
	for (const member of members) {
		const isRoot = member.revisionCount === 0
		if (isRoot === (member.parentDigest === null)) continue
		add(
			'lineage-root-invalid',
			at(member.digest),
			isRoot
				? '"revisionCount" is 0 with a non-null "parentDigest" (AD-29)'
				: `"revisionCount" is ${member.revisionCount} with a null "parentDigest" (AD-29)`,
		)
	}

	for (const [digest, group] of groupBy(members, (member) => member.digest)) {
		if (group.length < 2) continue
		add(
			'lineage-duplicate-artifact',
			at(digest),
			`${group.length} members share this digest, so one artifact is presented more than once (AD-12)`,
		)
	}

	const roots = members.filter((member) => member.revisionCount === 0)
	if (roots.length === 0) {
		add(
			'lineage-no-root',
			artifactPath,
			`no member carries "revisionCount" 0, so the chain of ${members.length} has no origin (AD-29)`,
		)
	} else if (roots.length > 1) {
		add(
			'lineage-multiple-roots',
			artifactPath,
			`${roots.length} members carry "revisionCount" 0, so the presented set is more than one lineage (AD-29)`,
		)
	}

	const byDigest = new Map(members.map((member) => [member.digest, member]))
	for (const member of members) {
		if (member.parentDigest === null) continue
		const parent = byDigest.get(member.parentDigest)
		if (parent === undefined) {
			add(
				'lineage-parent-absent',
				at(member.digest),
				`names parent "${member.parentDigest}", which no presented member digests to (AD-12)`,
			)
			continue
		}
		if (member.revisionCount === parent.revisionCount + 1) continue
		add(
			'lineage-revision-not-successor',
			at(member.digest),
			`carries "revisionCount" ${member.revisionCount} where its parent carries ${parent.revisionCount} (AD-29)`,
		)
	}

	// AD-29's conflict is same parent, same count, differing content. A group of
	// byte-identical members is reported as a duplicate above.
	const revisions = members.filter((member) => member.parentDigest !== null)
	for (const [, group] of groupBy(
		revisions,
		(member) => `${member.parentDigest} ${member.revisionCount}`,
	)) {
		const distinct = [...new Set(group.map((member) => member.digest))].sort()
		if (distinct.length < 2) continue
		const first = group[0]
		if (first === undefined) continue
		add(
			'lineage-revision-conflict',
			`${artifactPath}[parent=${first.parentDigest},revision=${first.revisionCount}]`,
			`${distinct.length} differing members claim this parent and revision: ${distinct.join(', ')} (AD-29)`,
		)
	}

	if (members.length !== options.declaredRevisionCount + 1) {
		add(
			'lineage-length-inconsistent',
			artifactPath,
			`presents ${members.length} members against a declared revision count of ${options.declaredRevisionCount} (AD-12)`,
		)
	}

	if (
		options.remediationCap !== null &&
		options.declaredRevisionCount > options.remediationCap
	) {
		add(
			'lineage-remediation-cap-exceeded',
			artifactPath,
			`declares ${options.declaredRevisionCount} revisions against a caller-attested cap of ${options.remediationCap} (AD-12)`,
		)
	}

	// Addresses are content-derived, so this order holds for any permutation of
	// the input. Two byte-identical members produce two findings at one address
	// with identical details, so an equal key is a genuine tie.
	findings.sort((left, right) => {
		const byCode = codeRank(left.code) - codeRank(right.code)
		if (byCode !== 0) return byCode
		if (left.artifactPath === right.artifactPath) return 0
		return left.artifactPath < right.artifactPath ? -1 : 1
	})

	const checks: LineageChain = {
		lengthConsistent: true,
		noRepeatedDigest: true,
		noGap: true,
	}
	for (const finding of findings) {
		const bucket = CHECK_PROJECTION[finding.code]
		if (bucket !== null) checks[bucket] = false
	}

	return freezeArtifact({
		artifactPath,
		findings,
		checks,
		passed: findings.length === 0,
	})
}

/**
 * Mints the next revision of `parent`: a new artifact carrying the parent's
 * digest and a revision count one greater (AD-29). The clone is load-bearing.
 * `{ ...body }` shares its subtrees with the caller and `freezeArtifact`
 * freezes in place, so without it this call would freeze the caller's `body`.
 */
export function reviseArtifact<T extends LineageFields>(
	parent: T,
	body: Omit<T, 'parentDigest' | 'revisionCount'>,
	artifactPath: string,
): T {
	if ((parent.revisionCount === 0) !== (parent.parentDigest === null)) {
		throw new TypeError(
			`reviseArtifact() received a parent whose parentDigest and revisionCount disagree: ${artifactPath}`,
		)
	}
	const next = parent.revisionCount + 1
	if (!Number.isSafeInteger(parent.revisionCount) || parent.revisionCount < 0) {
		throw new TypeError(
			`reviseArtifact() received a parent whose revisionCount is not a non-negative safe integer: ${artifactPath}`,
		)
	}
	if (!Number.isSafeInteger(next)) {
		throw new TypeError(
			`reviseArtifact() would mint a revisionCount outside the safe integer range: ${artifactPath}`,
		)
	}
	if (body.schemaVersion !== parent.schemaVersion) {
		throw new TypeError(
			`reviseArtifact() received a body at schemaVersion ${body.schemaVersion} for a parent at ${parent.schemaVersion}: ${artifactPath}`,
		)
	}
	// The type forbids these keys and a cast defeats the type, so the guard is
	// what stops a stale count winning or losing on spread order.
	for (const field of ['parentDigest', 'revisionCount'] as const) {
		if (!Object.hasOwn(body, field)) continue
		throw new TypeError(
			`reviseArtifact() received a body carrying "${field}", which the producing stage owns: ${artifactPath}`,
		)
	}
	return freezeArtifact(
		structuredClone({
			...body,
			parentDigest: digestArtifact(parent, artifactPath),
			revisionCount: next,
		}),
	) as T
}
