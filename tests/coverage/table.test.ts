// AD-31's emitted document, one numbered fixture per assertion in Story 5.3
// AC 10. Drives the pure builder with in-memory corpora, the way
// `tests/architecture/ad28-registry.test.ts` drives `scripts/ad28-registry.ts`.
// Reads no file: AD-30 forbids test filesystem I/O outside a temp directory.

import { describe, expect, it } from 'vitest'
import { evaluateCoverage } from '../../src/core/coverage/coverage.ts'
import { DISCIPLINE_RULES } from '../../src/core/coverage/rules.ts'
import {
	type CoverageCell,
	coveragePredicateTable,
	DECLARATION_STATES,
} from '../../src/core/coverage/table.ts'
import type { EvalContract } from '../../src/core/schemas/eval-contract.ts'
import { CORPUS_CELLS, CORPUS_CONTRACTS } from './fixtures/corpus.ts'

const document = coveragePredicateTable(CORPUS_CONTRACTS, CORPUS_CELLS)
const lines = document.split('\n')

/** The rows of the table under one heading, separator and header dropped. */
const rowsUnder = (heading: string): readonly string[] => {
	const start = lines.indexOf(heading)
	if (start === -1) throw new Error(`the document carries no ${heading}`)
	const rows: string[] = []
	for (const line of lines.slice(start + 1)) {
		if (line.startsWith('## ')) break
		if (line.startsWith('| ')) rows.push(line)
	}
	// The header row and the `| --- |` separator are not data.
	return rows.slice(2)
}

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
		expect(document.endsWith('\n')).toBe(true)
		expect(document.endsWith('\n\n')).toBe(false)
		expect(lines.filter((line) => /\s$/.test(line))).toStrictEqual([])
	})

	it('214. is entirely ASCII, so no locale or editor can move a byte', () => {
		const outside = [...document].filter((character) => {
			const point = character.codePointAt(0) ?? 0
			return character !== '\n' && (point < 0x20 || point > 0x7e)
		})
		expect(outside).toStrictEqual([])
	})

	it('215. carries no two adjacent blank lines', () => {
		for (const [index, line] of lines.entries()) {
			if (index === 0) continue
			expect(`${index}: ${line === '' && lines[index - 1] === ''}`).toBe(
				`${index}: false`,
			)
		}
	})

	it('216. carries the four expected headings, in order', () => {
		expect(lines.filter((line) => line.startsWith('## '))).toStrictEqual([
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
			document,
		)
	})

	it('222. permuting the corpus permutes the matrix and the gap rows, and nothing else', () => {
		const permuted = coveragePredicateTable(
			[...CORPUS_CONTRACTS].reverse(),
			CORPUS_CELLS,
		)
		expect(permuted).not.toBe(document)
		// The two tables ordered by DISCIPLINE_RULES and DECLARATION_STATES alone.
		const permutedLines = permuted.split('\n')
		const rowsIn = (source: readonly string[], heading: string) => {
			const start = source.indexOf(heading)
			const rows: string[] = []
			for (const line of source.slice(start + 1)) {
				if (line.startsWith('## ')) break
				if (line.startsWith('| ')) rows.push(line)
			}
			return rows
		}
		for (const heading of [
			'## The fourteen predicates',
			'## Declaration-state coverage',
		]) {
			expect(rowsIn(permutedLines, heading)).toStrictEqual(
				rowsIn(lines, heading),
			)
		}
		// The two ordered by `contracts` move together.
		for (const heading of ['## Coverage gaps', '## The full matrix']) {
			const before = rowsIn(lines, heading)
			const after = rowsIn(permutedLines, heading)
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
	it('228. a contract identifier carrying a pipe is escaped, and the row keeps its columns', () => {
		const renamed: EvalContract = {
			...contractNamed('empty-channel-roles'),
			contractId: 'empty|channel|roles',
		}
		const rendered = coveragePredicateTable(
			CORPUS_CONTRACTS.map((contract) =>
				contract.contractId === 'empty-channel-roles' ? renamed : contract,
			),
			CORPUS_CELLS.map((cell) =>
				cell.contractId === 'empty-channel-roles'
					? { ...cell, contractId: 'empty|channel|roles' }
					: cell,
			),
		)
		expect(rendered).toContain('`empty\\|channel\\|roles`')
		const row = rendered
			.split('\n')
			.find((line) => line.includes('empty\\|channel\\|roles'))
		expect(cellsOf(row ?? '')).toHaveLength(5)
	})

	it('229. a satisfaction reason carrying a pipe is escaped the same way', () => {
		const source = contractNamed('no-collection-quantifier')
		const [create, list] = source.permittedInterfaces[0]?.operations ?? []
		if (create === undefined || list === undefined) {
			throw new Error('corpus contract lost an operation')
		}
		// The collection pointer reaches the reason verbatim, and rule 4's cell
		// stays `unwitnessed`, so the swap pipes a reason without moving a cell.
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
		const rendered = coveragePredicateTable(
			CORPUS_CONTRACTS.map((contract) =>
				contract.contractId === source.contractId ? piped : contract,
			),
			CORPUS_CELLS,
		)
		expect(rendered).toContain(
			'no check quantifies over collection /items\\|rows of operation list-things',
		)
		expect(rendered).not.toContain(
			'no check quantifies over collection /items|rows of operation list-things',
		)
		const row = rendered
			.split('\n')
			.find((line) => line.includes('/items\\|rows'))
		expect(cellsOf(row ?? '')).toHaveLength(7)
	})

	it('230. the document carries nothing from the historical worked example', () => {
		for (const marker of [
			'P-001',
			'F-003',
			'siblingGroups.parameters non-empty',
		]) {
			expect(document).not.toContain(marker)
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
