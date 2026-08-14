// ADR-006 names the spike worked example's five `check` expressions as the
// grammar's only expressiveness evidence, so they are re-checked here against
// the settled schema. The artifact is deliberately stale and is NOT hand-edited
// into conformance: what it fails, and why, is the record.
//
// Source: _bmad-output/planning-artifacts/architecture/
//         architecture-eval-quality-2026-07-29/spike-worked-example/eval-contract.json

type WorkedExampleCheck = {
	readonly oracle: string
	/** copied verbatim from the artifact, so it is deliberately untyped. */
	readonly check: unknown
	readonly parses: boolean
	readonly finding: string
	/**
	 * For a failing check, the exact issues it must produce. A bare "did not
	 * parse" would stay green if the grammar broke somewhere else entirely, and
	 * the recorded finding would quietly stop being true.
	 */
	readonly issues?: readonly {
		readonly path: readonly (string | number)[]
		readonly code: string
	}[]
}

export const WORKED_EXAMPLE_CHECKS: readonly WorkedExampleCheck[] = [
	{
		oracle: 'O-001',
		check: {
			op: 'equality',
			operands: [
				{ pointer: '/interactions/read-back/response-body/note/title' },
				{ pointer: '/interactions/write/call-inputs/title' },
			],
		},
		parses: false,
		issues: [{ path: ['operands', 1], code: 'invalid_union' }],
		finding:
			"The second operand roots `call-inputs` directly on a key name. AD-26 names that as revision 3's defect: `call-inputs` had no declared structure to resolve against until AD-19 declared the four transport channels. The conforming spelling is /interactions/write/call-inputs/body/title.",
	},
	{
		oracle: 'O-002',
		check: {
			op: 'all',
			operands: [
				{
					op: 'equality',
					operands: [
						{ pointer: '/interactions/write/response-status' },
						{ literal: 200 },
					],
				},
				{
					op: 'equality',
					operands: [
						{ pointer: '/interactions/write/response-body/ok' },
						{ literal: true },
					],
				},
			],
		},
		parses: true,
		finding: 'Unchanged by the settled grammar.',
	},
	{
		oracle: 'O-003',
		check: {
			op: 'all',
			operands: [
				{
					op: 'absence',
					operands: [{ pointer: '/interactions/write/response-body/error' }],
				},
				{
					op: 'shape',
					operands: [
						{ pointer: '/interactions/write/response-body/note' },
						{
							literal: {
								requiredKeys: ['id', 'title', 'body', 'tags', 'updatedAt'],
							},
						},
					],
				},
			],
		},
		parses: false,
		issues: [
			{ path: ['operands', 1, 'operands'], code: 'too_big' },
			{ path: ['operands', 1, 'descriptor'], code: 'invalid_type' },
		],
		finding:
			'The `shape` operand carries its descriptor as a `{ literal }` operand. AD-4 calls the descriptor closed and "never an embedded JSON Schema", so it is now a typed named field and the second tuple position no longer exists.',
	},
	{
		oracle: 'O-004',
		check: {
			op: 'for-all',
			collection: { pointer: '/interactions/collection/response-body/notes' },
			predicate: {
				op: 'shape',
				operands: [
					{ pointer: '@/' },
					{
						literal: {
							requiredKeys: ['id', 'title', 'body', 'tags', 'updatedAt'],
						},
					},
				],
			},
		},
		parses: false,
		issues: [
			{ path: ['predicate', 'operands'], code: 'too_big' },
			{ path: ['predicate', 'descriptor'], code: 'invalid_type' },
		],
		finding:
			'The same `shape` spelling, one level down inside the quantifier. The quantifier itself and the bare `@/` bound-element pointer are both conforming.',
	},
	{
		oracle: 'O-005',
		check: {
			op: 'all',
			operands: [
				{
					op: 'equality',
					operands: [
						{ pointer: '/interactions/malformed-write/response-status' },
						{ literal: 400 },
					],
				},
				{
					op: 'equality',
					operands: [
						{ pointer: '/interactions/malformed-write/response-body/ok' },
						{ literal: false },
					],
				},
			],
		},
		parses: true,
		finding: 'Unchanged by the settled grammar.',
	},
]
