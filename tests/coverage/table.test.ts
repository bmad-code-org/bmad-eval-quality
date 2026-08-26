// AD-31's emitted document, one numbered fixture per assertion in Story 5.3
// AC 10. Drives the pure builder with in-memory corpora, the way
// `tests/architecture/ad28-registry.test.ts` drives `scripts/ad28-registry.ts`.
// Reads no file: AD-30 forbids test filesystem I/O outside a temp directory.

import { describe, expect, it } from 'vitest'
import { evaluateCoverage } from '../../src/core/coverage/coverage.ts'
import { evaluateRelevance } from '../../src/core/coverage/relevance.ts'
import {
	DISCIPLINE_RULES,
	type DisciplineRule,
} from '../../src/core/coverage/rules.ts'
import { evaluateSatisfaction } from '../../src/core/coverage/satisfaction.ts'
import {
	type CoverageCell,
	coveragePredicateTable,
	DECLARATION_STATES,
} from '../../src/core/coverage/table.ts'
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { DescriptorPointer } from '../../src/core/schemas/pointer.ts'
import { CORPUS_CELLS, CORPUS_CONTRACTS } from './fixtures/corpus.ts'

// Built on first use, not at import: a corpus the builder rejects would
// otherwise collapse all of these into one load error, and fixture 236, which
// asserts that very diagnosis, would never run.
let built: string | undefined
const documentOf = (): string => {
	built ??= coveragePredicateTable(CORPUS_CONTRACTS, CORPUS_CELLS)
	return built
}
const linesOf = (): readonly string[] => documentOf().split('\n')

/** Every `| ` line under one heading, header row and separator included. */
const linesUnder = (
	source: readonly string[],
	heading: string,
): readonly string[] => {
	const start = source.indexOf(heading)
	if (start === -1) throw new Error(`the document carries no ${heading}`)
	const rows: string[] = []
	for (const line of source.slice(start + 1)) {
		if (line.startsWith('## ')) break
		if (line.startsWith('| ')) rows.push(line)
	}
	return rows
}

/** The rows of the table under one heading, separator and header dropped. */
const rowsUnder = (heading: string): readonly string[] =>
	linesUnder(linesOf(), heading).slice(2)

/** The header row under one heading, as cells. */
const headerUnder = (heading: string): readonly string[] =>
	cellsOf(linesUnder(linesOf(), heading)[0] ?? '')

const cellsOf = (row: string): readonly string[] =>
	row
		.slice(2, -2)
		.split(' | ')
		.map((text) => text.replace(/\\\|/g, '|'))

const contractNamed = (contractId: string): EvalContract => {
	const found = CORPUS_CONTRACTS.find(
		(candidate) => candidate.contractId === contractId,
	)
	if (found === undefined) throw new Error(`corpus declares no ${contractId}`)
	return found
}

/** The corpus with one cell replaced, so a negative names its own diagnosis. */
const cellsWith = (
	replace: (cells: readonly CoverageCell[]) => readonly CoverageCell[],
): readonly CoverageCell[] => replace(CORPUS_CELLS)

describe('the document as bytes', () => {
	it('213. ends with exactly one newline and carries no trailing whitespace', () => {
		expect(documentOf().endsWith('\n')).toBe(true)
		expect(documentOf().endsWith('\n\n')).toBe(false)
		expect(linesOf().filter((line) => /\s$/.test(line))).toStrictEqual([])
	})

	it('214. is entirely ASCII, so no locale or editor can move a byte', () => {
		const outside = [...documentOf()].filter((character) => {
			const point = character.codePointAt(0) ?? 0
			return character !== '\n' && (point < 0x20 || point > 0x7e)
		})
		expect(outside).toStrictEqual([])
	})

	it('215. carries no two adjacent blank lines', () => {
		for (const [index, line] of linesOf().entries()) {
			if (index === 0) continue
			expect(`${index}: ${line === '' && linesOf()[index - 1] === ''}`).toBe(
				`${index}: false`,
			)
		}
	})

	it('216. carries the four expected headings, in order', () => {
		expect(linesOf().filter((line) => line.startsWith('## '))).toStrictEqual([
			'## The fourteen predicates',
			'## Declaration-state coverage',
			'## Coverage gaps',
			'## The full matrix',
		])
	})
})

describe('what each section renders', () => {
	it('217. the predicate table carries the fourteen identifiers the vocabulary pins', () => {
		const rows = rowsUnder('## The fourteen predicates')
		expect(rows).toHaveLength(7)
		expect(rows.map(cellsOf)).toStrictEqual([
			[
				'`success-indicator-separation`',
				'`success-indicator-separation-relevance`',
				'`success-indicator-separation-satisfaction`',
			],
			['`whole-body`', '`whole-body-relevance`', '`whole-body-satisfaction`'],
			[
				'`malformed-input`',
				'`malformed-input-relevance`',
				'`malformed-input-satisfaction`',
			],
			['`per-record`', '`per-record-relevance`', '`per-record-satisfaction`'],
			[
				'`sibling-cross-check`',
				'`sibling-cross-check-relevance`',
				'`sibling-cross-check-satisfaction`',
			],
			[
				'`omission-and-completeness`',
				'`omission-and-completeness-relevance`',
				'`omission-and-completeness-satisfaction`',
			],
			[
				'`state-change-read-back`',
				'`state-change-read-back-relevance`',
				'`state-change-read-back-satisfaction`',
			],
		])
	})

	it('218. the coverage table names the occupying contract in every one of its cells', () => {
		const rows = rowsUnder('## Declaration-state coverage')
		expect(rows).toHaveLength(7)
		for (const [index, rule] of DISCIPLINE_RULES.entries()) {
			const cells = cellsOf(rows[index] ?? '')
			expect(cells).toHaveLength(5)
			expect(cells[0]).toBe(`\`${rule}\``)
			for (const [column, state] of DECLARATION_STATES.entries()) {
				const occupant = CORPUS_CELLS.find(
					(cell) => cell.rule === rule && cell.state === state,
				)
				expect(cells[column + 1]).toBe(`\`${occupant?.contractId}\``)
			}
		}
	})

	it('219. the matrix carries one row per contract per rule', () => {
		expect(rowsUnder('## The full matrix')).toHaveLength(
			CORPUS_CONTRACTS.length * DISCIPLINE_RULES.length,
		)
	})

	it('220. the gaps section carries one row per record the corpus produces', () => {
		const recorded = CORPUS_CONTRACTS.reduce(
			(total, contract) => total + evaluateCoverage(contract).length,
			0,
		)
		expect(rowsUnder('## Coverage gaps')).toHaveLength(recorded)
	})
})

describe('the builder as a function', () => {
	it('221. building twice returns identical strings', () => {
		expect(coveragePredicateTable(CORPUS_CONTRACTS, CORPUS_CELLS)).toBe(
			documentOf(),
		)
	})

	it('222. permuting the corpus permutes the matrix and the gap rows, and nothing else', () => {
		const permuted = coveragePredicateTable(
			[...CORPUS_CONTRACTS].reverse(),
			CORPUS_CELLS,
		)
		expect(permuted).not.toBe(documentOf())
		// The two tables ordered by DISCIPLINE_RULES and DECLARATION_STATES alone.
		const permutedLines = permuted.split('\n')
		for (const heading of [
			'## The fourteen predicates',
			'## Declaration-state coverage',
		]) {
			expect(linesUnder(permutedLines, heading)).toStrictEqual(
				linesUnder(linesOf(), heading),
			)
		}
		// The two ordered by `contracts` move together.
		for (const heading of ['## Coverage gaps', '## The full matrix']) {
			const before = linesUnder(linesOf(), heading)
			const after = linesUnder(permutedLines, heading)
			expect(after).not.toStrictEqual(before)
			expect([...after].sort()).toStrictEqual([...before].sort())
		}
	})
})

describe('the four diagnoses', () => {
	it('223. a cell naming a contract the corpus does not carry throws, naming both', () => {
		expect(() =>
			coveragePredicateTable(
				CORPUS_CONTRACTS,
				cellsWith((cells) =>
					cells.map((cell) =>
						cell.rule === 'per-record' && cell.state === 'absent'
							? { ...cell, contractId: 'not-in-the-corpus' }
							: cell,
					),
				),
			),
		).toThrow(
			'coveragePredicateTable: cell per-record/absent names contract not-in-the-corpus, which the corpus does not carry',
		)
	})

	it('224. a missing cell throws, naming the rule and the state', () => {
		expect(() =>
			coveragePredicateTable(
				CORPUS_CONTRACTS,
				cellsWith((cells) =>
					cells.filter(
						(cell) =>
							!(cell.rule === 'whole-body' && cell.state === 'unwitnessed'),
					),
				),
			),
		).toThrow(
			'coveragePredicateTable: no corpus contract occupies cell whole-body/unwitnessed',
		)
	})

	it('225. a duplicated cell throws, naming both occupants', () => {
		expect(() =>
			coveragePredicateTable(
				CORPUS_CONTRACTS,
				cellsWith((cells) => [
					...cells,
					{
						rule: 'whole-body',
						state: 'unwitnessed',
						contractId: 'no-type-violating-step',
					},
				]),
			),
		).toThrow(
			'coveragePredicateTable: the corpus occupies cell whole-body/unwitnessed more than once (per-key-split-oracles, no-type-violating-step)',
		)
	})

	it('226. a cell whose contract produces the wrong verdict pair throws, naming both pairs', () => {
		expect(() =>
			coveragePredicateTable(
				CORPUS_CONTRACTS,
				cellsWith((cells) =>
					cells.map((cell) =>
						cell.rule === 'success-indicator-separation' &&
						cell.state === 'witnessed'
							? { ...cell, contractId: 'absent-success-indicator' }
							: cell,
					),
				),
			),
		).toThrow(
			'coveragePredicateTable: absent-success-indicator places success-indicator-separation at relevant=true/satisfied=false, but cell witnessed asserts relevant=true/satisfied=true',
		)
	})

	it('227. two corpus contracts sharing an identifier throws before anything resolves one', () => {
		expect(() =>
			coveragePredicateTable(
				[...CORPUS_CONTRACTS, contractNamed('empty-channel-roles')],
				CORPUS_CELLS,
			),
		).toThrow(
			'coveragePredicateTable: two corpus contracts share the identifier empty-channel-roles',
		)
	})
})

describe('what the renderer escapes and what it must never carry', () => {
	it('228. the schema forbids a pipe in a contract identifier, so a reason is the escape s only live input', () => {
		// `contractId` is an `Identifier`, whose pattern excludes `|`, so no
		// parseable contract can put one in the two identifier columns. Fixture
		// 229 is the one that exercises the escape against a value the system
		// can actually produce.
		const parsed = EvalContract.safeParse({
			...contractNamed('empty-channel-roles'),
			contractId: 'empty|channel|roles',
		})
		expect(parsed.success).toBe(false)
		expect(
			parsed.error?.issues.some((issue) => issue.path.includes('contractId')),
		).toBe(true)
		// The reason column's own input is admissible, which is why the escape
		// stays.
		expect(DescriptorPointer.safeParse('/items|rows').success).toBe(true)
	})

	it('229. a satisfaction reason carrying a pipe is escaped, and the cell reads back unescaped', () => {
		const source = contractNamed('no-collection-quantifier')
		const [create, list] = source.permittedInterfaces[0]?.operations ?? []
		if (create === undefined || list === undefined) {
			throw new Error('corpus contract lost an operation')
		}
		// The collection pointer reaches the reason verbatim, and rule 4's cell
		// for this contract is `unwitnessed` either way, so the swap renders a
		// piped reason without moving a cell.
		const piped: EvalContract = {
			...source,
			permittedInterfaces: [
				{
					logicalId: 'thing-api',
					kind: 'api',
					operations: [
						create,
						{
							...list,
							responseDescriptor: {
								...list.responseDescriptor,
								collectionLocations: [
									{
										pointer: '/items|rows',
										expectedCardinality: { mode: 'exact', count: 3 },
										referenceSet: null,
									},
								],
							},
						},
					],
				},
			],
		}
		const reason =
			'no check quantifies over collection /items|rows of operation list-things'
		const rendered = coveragePredicateTable(
			CORPUS_CONTRACTS.map((contract) =>
				contract.contractId === source.contractId ? piped : contract,
			),
			CORPUS_CELLS,
		)
		expect(rendered).toContain(reason.replace(/\|/g, '\\|'))
		expect(rendered).not.toContain(reason)
		const row = rendered
			.split('\n')
			.find((line) => line.includes('/items\\|rows'))
		const cells = cellsOf(row ?? '')
		expect(cells).toHaveLength(7)
		// Un-escaping is reversible, which is what makes the escape lossless
		// rather than merely present.
		expect(cells[6]).toBe(reason)
	})

	it('230. the document carries nothing from the historical worked example', () => {
		for (const marker of [
			'P-001',
			'F-003',
			'siblingGroups.parameters non-empty',
		]) {
			expect(documentOf()).not.toContain(marker)
		}
	})

	it('231. every gap row names the predicates the record carries, not a literal', () => {
		const expected = CORPUS_CONTRACTS.flatMap((contract) =>
			evaluateCoverage(contract).map((record) => [
				`\`${record.relevancePredicate}\``,
				`\`${record.satisfactionPredicate}\``,
			]),
		)
		expect(
			rowsUnder('## Coverage gaps').map((row) => {
				const cells = cellsOf(row)
				return [cells[2], cells[3]]
			}),
		).toStrictEqual(expected)
	})
})

describe('every rendered column, against the functions that produced it', () => {
	// Fixtures 217 through 220 count rows and 231 pins two columns. Twelve of
	// the fourteen data columns in the two large tables were unasserted, so a
	// wrong document passed the whole gate after one regeneration.
	const verdictFor = (contract: EvalContract, rule: DisciplineRule) => {
		const index = DISCIPLINE_RULES.indexOf(rule)
		const relevance = evaluateRelevance(contract)[index]
		const satisfaction = evaluateSatisfaction(contract)[index]
		if (relevance === undefined || satisfaction === undefined) {
			throw new Error(`no verdict for ${rule}`)
		}
		return { relevance, satisfaction }
	}

	it('232. every gap row carries the record severity and the two verdict reasons', () => {
		const expected = CORPUS_CONTRACTS.flatMap((contract) =>
			evaluateCoverage(contract).map((record) => {
				const rule = record.rule as DisciplineRule
				const { relevance, satisfaction } = verdictFor(contract, rule)
				return [
					`\`${contract.contractId}\``,
					`\`${rule}\``,
					record.severity,
					relevance.reason,
					satisfaction.reason,
				]
			}),
		)
		expect(
			rowsUnder('## Coverage gaps').map((row) => {
				const cells = cellsOf(row)
				return [cells[0], cells[1], cells[4], cells[5], cells[6]]
			}),
		).toStrictEqual(expected)
	})

	it('233. every matrix row carries the two verdicts, the gap flag, and both reasons', () => {
		const expected = CORPUS_CONTRACTS.flatMap((contract) =>
			DISCIPLINE_RULES.map((rule) => {
				const { relevance, satisfaction } = verdictFor(contract, rule)
				const yesNo = (value: boolean) => (value ? 'yes' : 'no')
				return [
					`\`${contract.contractId}\``,
					`\`${rule}\``,
					yesNo(relevance.relevant),
					yesNo(satisfaction.satisfied),
					yesNo(relevance.relevant && !satisfaction.satisfied),
					relevance.reason,
					satisfaction.reason,
				]
			}),
		)
		expect(rowsUnder('## The full matrix').map(cellsOf)).toStrictEqual(expected)
	})

	it('234. the four column headers and the fixed prose read as published', () => {
		expect(headerUnder('## The fourteen predicates')).toStrictEqual([
			'Rule',
			'Relevance predicate',
			'Satisfaction predicate',
		])
		expect(headerUnder('## Declaration-state coverage')).toStrictEqual([
			'Rule',
			'Absent',
			'Explicitly empty',
			'Witnessed',
			'Unwitnessed',
		])
		expect(headerUnder('## Coverage gaps')).toStrictEqual([
			'Contract',
			'Rule',
			'Relevance predicate',
			'Satisfaction predicate',
			'Severity',
			'Why relevance fired',
			'Why satisfaction failed',
		])
		expect(headerUnder('## The full matrix')).toStrictEqual([
			'Contract',
			'Rule',
			'Relevant',
			'Satisfied',
			'Gap',
			'Relevance reason',
			'Satisfaction reason',
		])
		expect(linesOf()[0]).toBe('# AD-31 coverage predicates')
		expect(documentOf()).toContain(
			'Each cell names the corpus contract that occupies it.',
		)
		expect(documentOf()).toContain(
			'relevance predicate answering `false` forces its satisfaction twin to answer `true`.',
		)
	})
})

describe('the two diagnoses a verdict pair cannot reach', () => {
	it('235. an unwitnessed cell filled by its own absent occupant throws, since the two share a verdict pair', () => {
		// Rule 2's absent occupant decides on `NO_OPERATION_WITNESS`. Pointing
		// its unwitnessed cell at the same contract passes checks 1 through 4,
		// because the pair is `relevant=true/satisfied=false` either way.
		expect(() =>
			coveragePredicateTable(
				CORPUS_CONTRACTS,
				CORPUS_CELLS.map((cell) =>
					cell.rule === 'whole-body' && cell.state === 'unwitnessed'
						? { ...cell, contractId: 'no-operation-inventory' }
						: cell,
				),
			),
		).toThrow(
			'coveragePredicateTable: no-operation-inventory and no-operation-inventory both decide whole-body on',
		)
	})

	it('236. a contract occupying no cell throws rather than renting seven matrix rows', () => {
		const spare: EvalContract = {
			...contractNamed('empty-channel-roles'),
			contractId: 'occupies-nothing',
		}
		expect(() =>
			coveragePredicateTable([...CORPUS_CONTRACTS, spare], CORPUS_CELLS),
		).toThrow(
			'coveragePredicateTable: occupies-nothing occupies no cell, so nothing states what it is in the corpus for',
		)
	})
})
