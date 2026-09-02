// Where AD-33's decision table lives, spelled once. The writer and the drift
// check both import it, so they cannot address different files while the
// canary's `generate then check` step still reports a fixed point.

export const AD33_TABLE_NAME = 'ad33-outcome-decision.generated.md'

export const AD33_TABLE_DIRECTORY = new URL('../docs/', import.meta.url)

export const AD33_TABLE_TARGET = new URL(AD33_TABLE_NAME, AD33_TABLE_DIRECTORY)

/** Repository-relative, for anything a human reads. */
export const AD33_TABLE_PATH = `docs/${AD33_TABLE_NAME}`

// The Starlight page frontmatter the published file carries. It belongs to the
// documentation site that renders `docs/`, so it is prepended here and the pure
// builder in `core/score/outcome-table.ts` emits only the tables. The writer
// and the drift check prepend this same constant, so they still agree byte for
// byte.
export const AD33_TABLE_FRONTMATTER = `${[
	'---',
	'title: "AD-33 Outcome Decision"',
	'description: "AD-33 outcome decision tables generated from the implemented decision procedure."',
	'---',
].join('\n')}\n\n`
