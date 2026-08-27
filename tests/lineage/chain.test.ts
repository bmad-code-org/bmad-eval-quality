/**
 * AD-12's presented-chain reader and AD-29's constructor (Story 6.4, AC 11
 * cases 16 through 40). Assertions carry `code`, `artifactPath`, and the
 * affected `checks` boolean; `detail` is asserted by substring only where the
 * test is about what the message names.
 */
import { describe, expect, it } from 'vitest'
import { digestArtifact } from '../../src/core/canonical/digest.ts'
import {
	CHECK_PROJECTION,
	LINEAGE_DEFECT_CODES,
	type LineageChainOptions,
	type LineageDefectCode,
	type LineageFields,
	reviseArtifact,
	validateLineageChain,
} from '../../src/core/lineage/chain.ts'
import { RuntimeFault } from '../../src/core/schemas/faults.ts'

const PATH = 'SealedEvaluatorBrief'

/** a lineage-bearing artifact with a body, so a digest covers more than the three fields. */
type Member = LineageFields & {
	readonly label: string
	readonly tags?: readonly string[]
}

const root: Member = {
	schemaVersion: 1,
	parentDigest: null,
	revisionCount: 0,
	label: 'r0',
}

const revise = (parent: Member, label: string): Member =>
	reviseArtifact<Member>(parent, { schemaVersion: 1, label }, PATH)

/** root plus `revisions` successive revisions, oldest first. */
function chainOf(revisions: number): Member[] {
	const members: Member[] = [root]
	for (let i = 1; i <= revisions; i++) {
		const parent = members[members.length - 1]
		if (parent === undefined) throw new Error('fixture setup failed')
		members.push(revise(parent, `r${i}`))
	}
	return members
}

const options = (
	overrides: Partial<LineageChainOptions> = {},
): LineageChainOptions => ({
	artifactPath: PATH,
	acceptedSchemaVersion: 1,
	declaredRevisionCount: 0,
	remediationCap: null,
	...overrides,
})

const codesOf = (
	report: ReturnType<typeof validateLineageChain>,
): LineageDefectCode[] => report.findings.map((finding) => finding.code)

const findingOf = (
	report: ReturnType<typeof validateLineageChain>,
	code: LineageDefectCode,
) => {
	const found = report.findings.find((finding) => finding.code === code)
	if (found === undefined) {
		throw new Error(`expected a ${code} finding, got ${codesOf(report).join()}`)
	}
	return found
}

/** the same member with one field changed, unfrozen so a fixture can build on it. */
const mutated = (member: Member, patch: Partial<Member>): Member => ({
	...structuredClone(member),
	...patch,
})

/** two conflict groups plus a length defect: two codes, two same-code findings. */
const defective = (): Member[] => {
	const a = revise(root, 'a')
	const b = revise(root, 'b')
	return [root, a, b, revise(a, 'c'), revise(a, 'd')]
}

/** one member presented twice, which is the only way two findings share an address. */
const duplicated = (): Member[] => {
	const broken = mutated(root, { parentDigest: `sha256:${'c'.repeat(64)}` })
	return [broken, structuredClone(broken)]
}

describe('validateLineageChain accepts', () => {
	// 16
	it('a lone root, a root plus one revision, and a five-member chain', () => {
		for (const revisions of [0, 1, 4]) {
			const report = validateLineageChain(
				chainOf(revisions),
				options({ declaredRevisionCount: revisions }),
			)
			expect(report.findings).toEqual([])
			expect(report.passed).toBe(true)
			expect(report.checks).toEqual({
				lengthConsistent: true,
				noRepeatedDigest: true,
				noGap: true,
			})
		}
	})
})

describe('validateLineageChain rejects', () => {
	// 17
	it('a member whose parentDigest and revisionCount disagree', () => {
		const broken = mutated(root, { parentDigest: `sha256:${'a'.repeat(64)}` })
		const report = validateLineageChain(
			[broken],
			options({ declaredRevisionCount: 0 }),
		)
		const finding = findingOf(report, 'lineage-root-invalid')
		expect(finding.artifactPath).toBe(
			`${PATH}[digest=${digestArtifact(broken, PATH)}]`,
		)
		expect(report.checks.noGap).toBe(false)
	})

	// 18
	it('the same artifact presented twice', () => {
		const report = validateLineageChain(
			[root, structuredClone(root)],
			options({ declaredRevisionCount: 1 }),
		)
		const finding = findingOf(report, 'lineage-duplicate-artifact')
		expect(finding.artifactPath).toBe(
			`${PATH}[digest=${digestArtifact(root, PATH)}]`,
		)
		expect(report.checks.noRepeatedDigest).toBe(false)
	})

	// 19
	it('a chain with no member at revision zero', () => {
		const report = validateLineageChain(
			chainOf(2).slice(1),
			options({ declaredRevisionCount: 1 }),
		)
		const finding = findingOf(report, 'lineage-no-root')
		expect(finding.artifactPath).toBe(PATH)
		expect(report.checks.noGap).toBe(false)
	})

	// 20
	it('two roots', () => {
		const other = mutated(root, { label: 'other-root' })
		const report = validateLineageChain(
			[root, other],
			options({ declaredRevisionCount: 1 }),
		)
		const finding = findingOf(report, 'lineage-multiple-roots')
		expect(finding.artifactPath).toBe(PATH)
		expect(report.checks.noGap).toBe(false)
	})

	// 21
	it('a member naming a parent no member digests to', () => {
		const orphan = mutated(chainOf(1)[1] as Member, {
			parentDigest: `sha256:${'b'.repeat(64)}`,
		})
		const report = validateLineageChain(
			[root, orphan],
			options({ declaredRevisionCount: 1 }),
		)
		const finding = findingOf(report, 'lineage-parent-absent')
		expect(finding.artifactPath).toBe(
			`${PATH}[digest=${digestArtifact(orphan, PATH)}]`,
		)
		expect(report.checks.noGap).toBe(false)
	})

	// 22
	it('a revision count that skips its parent', () => {
		const skipped = mutated(chainOf(1)[1] as Member, { revisionCount: 3 })
		const report = validateLineageChain(
			[root, skipped],
			options({ declaredRevisionCount: 1 }),
		)
		const finding = findingOf(report, 'lineage-revision-not-successor')
		expect(finding.artifactPath).toBe(
			`${PATH}[digest=${digestArtifact(skipped, PATH)}]`,
		)
		expect(report.checks.noGap).toBe(false)
	})

	// 23. AD-29's conflict, addressed by its group so an n-way conflict is one
	// finding naming n digests.
	it('two differing members claiming one parent and revision', () => {
		const first = revise(root, 'a')
		const second = revise(root, 'b')
		const report = validateLineageChain(
			[root, first, second],
			options({ declaredRevisionCount: 2 }),
		)
		const finding = findingOf(report, 'lineage-revision-conflict')
		expect(finding.artifactPath).toBe(
			`${PATH}[parent=${digestArtifact(root, PATH)},revision=1]`,
		)
		expect(finding.detail).toContain(digestArtifact(first, PATH))
		expect(finding.detail).toContain(digestArtifact(second, PATH))
		expect(report.checks.noGap).toBe(false)
	})

	// 24
	it('a length that disagrees with the declared revision count', () => {
		const report = validateLineageChain(
			chainOf(2),
			options({ declaredRevisionCount: 5 }),
		)
		const finding = findingOf(report, 'lineage-length-inconsistent')
		expect(finding.artifactPath).toBe(PATH)
		expect(report.checks.lengthConsistent).toBe(false)
	})

	// 25. The cap maps onto no AD-12 boolean: `Remediation` records it beside
	// `lineageChain`, outside the three.
	it('a declared revision count above the caller-attested cap', () => {
		const report = validateLineageChain(
			chainOf(4),
			options({ declaredRevisionCount: 4, remediationCap: 3 }),
		)
		const finding = findingOf(report, 'lineage-remediation-cap-exceeded')
		expect(finding.artifactPath).toBe(PATH)
		expect(report.checks).toEqual({
			lengthConsistent: true,
			noRepeatedDigest: true,
			noGap: true,
		})
	})
})

describe('validateLineageChain reporting', () => {
	// 26
	it('collects every defect in one pass', () => {
		const report = validateLineageChain(
			duplicated(),
			options({ declaredRevisionCount: 4 }),
		)
		expect(new Set(codesOf(report))).toEqual(
			new Set([
				'lineage-root-invalid',
				'lineage-duplicate-artifact',
				'lineage-multiple-roots',
				'lineage-parent-absent',
				'lineage-length-inconsistent',
			]),
		)
	})

	// 27
	it('reports identically under every permutation of the input', () => {
		for (const members of [defective(), duplicated()]) {
			const expected = JSON.stringify(
				validateLineageChain(members, options({ declaredRevisionCount: 9 })),
			)
			const rotations = members.map((_, index) => [
				...members.slice(index),
				...members.slice(0, index),
			])
			for (const order of [...rotations, [...members].reverse()]) {
				expect(
					JSON.stringify(
						validateLineageChain(order, options({ declaredRevisionCount: 9 })),
					),
				).toBe(expected)
			}
		}
	})

	// 28
	it('reports identically on a repeat run', () => {
		const members = defective()
		const once = validateLineageChain(
			members,
			options({ declaredRevisionCount: 9 }),
		)
		const twice = validateLineageChain(
			members,
			options({ declaredRevisionCount: 9 }),
		)
		expect(JSON.stringify(twice)).toBe(JSON.stringify(once))
	})

	// 29. Two byte-identical members produce two findings at one address, which
	// is the tie the comparator has to return 0 on. `defective()` has no
	// duplicate member and can only see the first half of this.
	it('sorts stably when two findings share a code and an address', () => {
		const spread = validateLineageChain(
			defective(),
			options({ declaredRevisionCount: 9 }),
		)
		const spreadAddresses = spread.findings.map(
			(finding) => `${finding.code} ${finding.artifactPath}`,
		)
		expect(new Set(spreadAddresses).size).toBe(spreadAddresses.length)

		const tied = validateLineageChain(
			duplicated(),
			options({ declaredRevisionCount: 9 }),
		)
		const tiedAddresses = tied.findings.map(
			(finding) => `${finding.code} ${finding.artifactPath}`,
		)
		expect(new Set(tiedAddresses).size).toBeLessThan(tiedAddresses.length)
		const ranks = codesOf(tied).map((code) =>
			LINEAGE_DEFECT_CODES.indexOf(code),
		)
		expect(ranks).toEqual([...ranks].sort((left, right) => left - right))
	})

	// 30
	it('reports an empty chain as rootless and short', () => {
		const report = validateLineageChain([], options())
		expect(new Set(codesOf(report))).toEqual(
			new Set(['lineage-no-root', 'lineage-length-inconsistent']),
		)
	})

	// 31. A tenth code with no bucket would leave all three booleans true on a
	// failing chain, which is the defect the projection exists to prevent.
	it('projects every code onto exactly one check, the cap excepted', () => {
		expect(Object.keys(CHECK_PROJECTION).sort()).toEqual(
			[...LINEAGE_DEFECT_CODES].sort(),
		)
		const unmapped = LINEAGE_DEFECT_CODES.filter(
			(code) => CHECK_PROJECTION[code] === null,
		)
		expect(unmapped).toEqual(['lineage-remediation-cap-exceeded'])
		for (const code of LINEAGE_DEFECT_CODES) {
			const bucket = CHECK_PROJECTION[code]
			if (bucket === null) continue
			expect(['lengthConsistent', 'noRepeatedDigest', 'noGap']).toContain(
				bucket,
			)
		}
	})

	// 32
	it('returns a frozen report', () => {
		const report = validateLineageChain([root], options())
		expect(() => {
			;(report as { passed: boolean }).passed = false
		}).toThrow(TypeError)
		expect(() => {
			;(report.findings as unknown[]).push({})
		}).toThrow(TypeError)
	})

	// 33
	it('refuses a declared count or a cap that is not a whole number', () => {
		expect(() =>
			validateLineageChain(
				[root],
				options({ declaredRevisionCount: Number.NaN }),
			),
		).toThrow(TypeError)
		expect(() =>
			validateLineageChain([root], options({ declaredRevisionCount: -1 })),
		).toThrow(TypeError)
		expect(() =>
			validateLineageChain([root], options({ remediationCap: 1.5 })),
		).toThrow(TypeError)
	})

	// 34
	it('throws schema-version-mismatch on a mixed-version chain', () => {
		const members = chainOf(1)
		const mixed = [
			members[0] as Member,
			mutated(members[1] as Member, { schemaVersion: 2 }),
		]
		let thrown: unknown
		try {
			validateLineageChain(mixed, options({ declaredRevisionCount: 1 }))
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(RuntimeFault)
		expect((thrown as RuntimeFault).code).toBe('schema-version-mismatch')
	})

	// 35
	it('propagates non-canonicalizable-value from the digest', () => {
		const unhashable = {
			...root,
			ratio: Number.POSITIVE_INFINITY,
		} as unknown as Member
		let thrown: unknown
		try {
			validateLineageChain([unhashable], options())
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(RuntimeFault)
		expect((thrown as RuntimeFault).code).toBe('non-canonicalizable-value')
	})

	// 36. The precondition the parameter type cannot carry: a member narrowed
	// to the three lineage fields digests differently and breaks its own chain.
	it('needs whole artifacts', () => {
		const members = chainOf(2)
		expect(
			validateLineageChain(members, options({ declaredRevisionCount: 2 }))
				.passed,
		).toBe(true)
		const narrowed = members.map((member) => ({
			schemaVersion: member.schemaVersion,
			parentDigest: member.parentDigest,
			revisionCount: member.revisionCount,
		}))
		const report = validateLineageChain(
			narrowed,
			options({ declaredRevisionCount: 2 }),
		)
		expect(report.passed).toBe(false)
		expect(codesOf(report)).toContain('lineage-parent-absent')
	})
})

describe('reviseArtifact', () => {
	// 37
	it('mints a new artifact and leaves the body it was handed alone', () => {
		const body = { schemaVersion: 1, label: 'r1', tags: ['a'] }
		const child = reviseArtifact<Member>(root, body, PATH)
		expect(child.revisionCount).toBe(1)
		expect(child.parentDigest).toBe(digestArtifact(root, PATH))
		expect(Object.isFrozen(child)).toBe(true)
		expect(Object.isFrozen(body)).toBe(false)
		expect(Object.isFrozen(body.tags)).toBe(false)
	})

	// 38
	it('produces a chain the reader accepts', () => {
		const child = revise(root, 'r1')
		const report = validateLineageChain(
			[root, child],
			options({ declaredRevisionCount: 1 }),
		)
		expect(report.passed).toBe(true)
	})

	// 39
	it('rejects a malformed parent, an unusable count, and a body carrying lineage', () => {
		const withParent = (revisionCount: number): Member => ({
			schemaVersion: 1,
			parentDigest: `sha256:${'d'.repeat(64)}`,
			revisionCount,
			label: 'p',
		})
		// guard 1: the biconditional
		expect(() => revise(mutated(root, { revisionCount: 2 }), 'x')).toThrow(
			TypeError,
		)
		// guard 2: reachable only past guard 1, so the parent carries a digest
		expect(() => revise(withParent(1.5), 'x')).toThrow(TypeError)
		expect(() => revise(withParent(-2), 'x')).toThrow(TypeError)
		// guard 3: bounds the successor
		expect(() => revise(withParent(Number.MAX_SAFE_INTEGER), 'x')).toThrow(
			TypeError,
		)
		// guard 4: a body at another schema version
		expect(() =>
			reviseArtifact<Member>(root, { schemaVersion: 2, label: 'x' }, PATH),
		).toThrow(TypeError)
		// guard 5: a body carrying a field the producing stage owns
		expect(() =>
			reviseArtifact<Member>(
				root,
				{ schemaVersion: 1, label: 'x', revisionCount: 7 } as never,
				PATH,
			),
		).toThrow(TypeError)
	})

	// 40
	it('revises a frozen parent, which is the only kind a stage emits', () => {
		const frozenParent = revise(root, 'r1')
		expect(Object.isFrozen(frozenParent)).toBe(true)
		expect(revise(frozenParent, 'r2').revisionCount).toBe(2)
	})
})
