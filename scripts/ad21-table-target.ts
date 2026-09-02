// Where AD-21's decision table lives, spelled once. The writer and the drift
// check both import it, so they cannot address different files while the
// canary's `generate then check` step still reports a fixed point.

export const AD21_TABLE_NAME = 'ad21-verdict-decision.generated.md'

export const AD21_TABLE_DIRECTORY = new URL('../docs/', import.meta.url)

export const AD21_TABLE_TARGET = new URL(AD21_TABLE_NAME, AD21_TABLE_DIRECTORY)

/** Repository-relative, for anything a human reads. */
export const AD21_TABLE_PATH = `docs/${AD21_TABLE_NAME}`

// The Starlight page frontmatter the published file carries. It belongs to the
// documentation site that renders `docs/`, so it is prepended here and the pure
// builder in `core/score/ladder-table.ts` emits only the tables. The writer
// and the drift check prepend this same constant, so they still agree byte for
// byte.
export const AD21_TABLE_FRONTMATTER = `${[
	'---',
	'title: "AD-21 Verdict Decision"',
	'description: "AD-21 verdict decision tables generated from the production and contract-scoring ladders."',
	'---',
].join('\n')}\n\n`
