// Where AD-31's predicate table lives, spelled once. The writer and the drift
// check both import it, so they cannot address different files while the
// canary's `generate then check` step still reports a fixed point.

export const AD31_TABLE_NAME = 'ad31-coverage-predicates.generated.md'

export const AD31_TABLE_DIRECTORY = new URL('../docs/', import.meta.url)

export const AD31_TABLE_TARGET = new URL(AD31_TABLE_NAME, AD31_TABLE_DIRECTORY)

/** Repository-relative, for anything a human reads. */
export const AD31_TABLE_PATH = `docs/${AD31_TABLE_NAME}`

// The Starlight page frontmatter the published file carries. It belongs to the
// documentation site that renders `docs/`, so it is prepended here and the pure
// builder in `core/coverage/table.ts` emits only the table. The writer and the
// drift check prepend this same constant, so they still agree byte for byte.
export const AD31_TABLE_FRONTMATTER = `${[
	'---',
	'title: "AD-31 Coverage Predicates"',
	'description: "AD-31 coverage predicate table generated from hand-authored contracts."',
	'---',
].join('\n')}\n\n`
