// Everything the corpus generator and the corpus drift check must agree on:
// where `corpus/dev/` lives, what kinds of file it holds, and the bytes
// themselves. Both import this module, so neither can address a file the other
// does not, and the check compares committed bytes against the same builder
// that wrote them.
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports.
import { compile } from '../src/application/compile.ts'
import { seal } from '../src/application/seal.ts'
import { serializeArtifact } from '../src/application/serialize.ts'
import { digestBytes } from '../src/core/canonical/digest.ts'
import { StructuralFailure } from '../src/core/failure-codes.ts'
import type { EvalContract } from '../src/core/schemas/eval-contract.ts'

/**
 * One entry's kind. Closed, because `index.json` is packaging and has no
 * schema.
 *
 * `'index'` names `index.json` and is never an entry's value: an entry carries
 * the digest of its own bytes and a manifest cannot hold its own, so the
 * manifest is the one corpus file the manifest does not list. The member stays
 * so that the vocabulary names every file in the corpus, which is what lets a
 * reader of `index.json` classify the file they are holding.
 */
export type DevCorpusKind =
	| 'contract'
	| 'sealed-evaluator-brief'
	| 'readme'
	| 'index'

export type DevCorpusEntry = {
	readonly path: string
	readonly kind: DevCorpusKind
	readonly digest: string
	/**
	 * Present on the three contracts that fail compilation by design. They
	 * ship as authored input, and the code is what makes them a corpus rather
	 * than a defect in the generator.
	 */
	readonly structuralFailure?: string
}

/**
 * Everything `package.json`'s `files` ships under `corpus/`, which is the whole
 * directory and not just `corpus/dev/`. The drift check walks this for orphans
 * and the AD-18 sweep reads it, so a file planted anywhere under `corpus/` is
 * screened before it ships.
 */
export const CORPUS_PACKAGE_ROOT = new URL('../corpus/', import.meta.url)
export const CORPUS_ROOT = new URL('dev/', CORPUS_PACKAGE_ROOT)
export const CORPUS_CONTRACTS_DIR = new URL('contracts/', CORPUS_ROOT)
export const CORPUS_EXAMPLE_DIR = new URL('compile-seal-example/', CORPUS_ROOT)
export const CORPUS_INDEX = new URL('index.json', CORPUS_ROOT)
export const CORPUS_README = new URL('README.md', CORPUS_ROOT)

/** Repository-relative, for `index.json` entries and violation messages. */
export const CORPUS_LABEL = 'corpus/dev'

/** Repository-relative name of what the tarball ships, for the same messages. */
export const CORPUS_PACKAGE_LABEL = 'corpus'

/**
 * The example's seed, named here because three of the nineteen do not compile
 * and picking one at generation time would be a silent choice. This is the
 * corpus contract whose declarations satisfy every discipline rule.
 */
export const EXAMPLE_SEED_ID = 'satisfied-declarations'

const INDEX_PATH = `${CORPUS_LABEL}/index.json`
const README_PATH = `${CORPUS_LABEL}/README.md`

const digestOf = (text: string): string =>
	digestBytes(new TextEncoder().encode(text))

/**
 * The corpus publishes hand-authored roots, so AD-29's origin values are the
 * only ones any of them may carry. Checked here because `compile` returns its
 * input unchanged (`STAGE_SIGNATURES.compile` is `carries-through`), so nothing
 * between the fixture literal and the byte on disk would notice a revised
 * contract wandering into the corpus.
 *
 * AD-29's origin values are the lineage pair alone. This check also required
 * `schemaVersion === 1` until epic 7, and attributed that to AD-29, which says
 * nothing about `schemaVersion`: its rule is about the parent digest and the
 * revision count, and `core/lineage/chain.ts` likewise reads a root as
 * `revisionCount === 0` with a null `parentDigest`. The conjunct dated from
 * when every schema was still at version 1, and it conflated lineage origin
 * with schema shape, so the corpus kept stamping 1 while `EvalContract` moved
 * to 3. No version assertion replaces it: `schemaVersion` is `z.int().min(1)`
 * with no literal, and `eval-contract.ts`'s own description records that no
 * reader in this version declares an expected version constant to compare a
 * stamp against.
 */
function assertLineageRoot(contract: EvalContract): void {
	if (contract.parentDigest === null && contract.revisionCount === 0) return
	throw new Error(
		`contract "${contract.contractId}" is not a lineage root: the corpus ` +
			'publishes authored origin artifacts, which AD-29 gives ' +
			'`parentDigest` null and `revisionCount` 0, and this one carries ' +
			`${JSON.stringify(contract.parentDigest)} and ${contract.revisionCount}`,
	)
}

const README = `# Development corpus

Nineteen contracts and one compiled-and-sealed pair, published so an adopter can read real input to
this package without cloning the repository. Everything here is generated by
\`npm run generate:dev-corpus\` and checked byte for byte by \`npm run check:corpus\`.

## What is here

- \`contracts/<contractId>.json\`: nineteen contracts, one per AD-20 discipline rule in each
  declaration state. Sixteen are published only after this package's own compile stage accepts
  them, so every one of those is a contract the compiler admits. Three fail compilation by design;
  those ship as authored input, and \`index.json\` records the failure code each one raises.
- \`compile-seal-example/contract.json\` and \`compile-seal-example/brief.json\`: one contract and
  the brief this package's compile-then-seal boundary produces from it.
- \`index.json\`: every file above, its kind, and the AD-27 digest of the exact bytes on disk.

## These contracts are visible and diagnostic

AD-38 calls a development corpus visible and diagnostic. Nothing here is a holdout: every contract
is published, readable, and meant to be read while writing your own. A holdout set that measures a
contract's strength is a separate thing this package does not ship.

## What is absent, and why

**The qualified-probe dimensions are absent.** AD-38 asks for at least one qualified probe per
probe class and per \`expectedClean\` state. The probe schema now carries both halves qualification
needs: AD-9's per-route qualification record and AD-40's machine-readable defect signature, with a
corpus gate that admits a probe only when the two agree with its class. The trial reducer and the
score stage that reads it are both shipped, so an admitted probe can be scored end to end today;
what is still missing is this directory's own gate widening to require at least one such probe. The
dimension arrives with the change that adds that gate.

**Three of the four artifacts in AD-38's end-to-end example are absent here.** The example there is
a sealed brief, a conforming sealed run record, an isolation manifest, and an evaluator
configuration. The last three are produced by the shipped \`ingest\`/\`score\`/\`emit\` stages, and the
full chain is regenerated through them at \`spike-worked-example/\`, outside this package. This
directory still ships only the compile-and-seal pair, scoped to what a corpus of contracts needs,
under a name that does not claim AD-38's term.
`

/**
 * The corpus, as repo-relative path to text. Deterministic and sorted: no
 * timestamp, no random identifier, and no input outside the contracts handed
 * in, so two runs over one input produce two identical trees.
 */
export function buildDevCorpus(
	contracts: readonly EvalContract[],
): Map<string, string> {
	const files = new Map<string, string>()
	const entries: DevCorpusEntry[] = []

	const sorted = [...contracts].sort((a, b) =>
		a.contractId < b.contractId ? -1 : a.contractId > b.contractId ? 1 : 0,
	)

	for (const authored of sorted) {
		assertLineageRoot(authored)
		const path = `${CORPUS_LABEL}/contracts/${authored.contractId}.json`
		// Compiled before it is serialized, so the corpus proves the compiler:
		// every contract published as valid is one the shipped `compile`
		// accepted, and a contract it would reject cannot be published as one it
		// admits. `compile` is `carries-through` for lineage and returns its
		// input unchanged, so it normalizes nothing; the authored
		// `schemaVersion`, `parentDigest`, and `revisionCount` reach disk as
		// written, and `assertLineageRoot` is what holds the lineage pair to
		// AD-29's origin values.
		let text: string
		let structuralFailure: string | undefined
		try {
			text = serializeArtifact(compile(authored), 'EvalContract')
		} catch (error) {
			if (!(error instanceof StructuralFailure)) throw error
			text = serializeArtifact(authored, 'EvalContract')
			structuralFailure = error.code
		}
		files.set(path, text)
		entries.push(
			structuralFailure === undefined
				? { path, kind: 'contract', digest: digestOf(text) }
				: {
						path,
						kind: 'contract',
						digest: digestOf(text),
						structuralFailure,
					},
		)
	}

	const seed = sorted.find(
		(contract) => contract.contractId === EXAMPLE_SEED_ID,
	)
	if (seed === undefined) {
		throw new Error(
			`the corpus has no contract named "${EXAMPLE_SEED_ID}", so the example has no seed`,
		)
	}
	const exampleContract = serializeArtifact(compile(seed), 'EvalContract')
	const exampleBrief = serializeArtifact(seal(seed), 'SealedEvaluatorBrief')
	const contractPath = `${CORPUS_LABEL}/compile-seal-example/contract.json`
	const briefPath = `${CORPUS_LABEL}/compile-seal-example/brief.json`
	files.set(contractPath, exampleContract)
	files.set(briefPath, exampleBrief)
	entries.push({
		path: contractPath,
		kind: 'contract',
		digest: digestOf(exampleContract),
	})
	entries.push({
		path: briefPath,
		kind: 'sealed-evaluator-brief',
		digest: digestOf(exampleBrief),
	})

	files.set(README_PATH, README)
	entries.push({
		path: README_PATH,
		kind: 'readme',
		digest: digestOf(README),
	})

	entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
	// `index.json` is not an entry in itself: an entry carries the digest of
	// its own bytes, and a manifest cannot hold its own. It is still a file the
	// builder emits, so the drift check compares its bytes like any other and
	// never reports it as an orphan; the `'index'` kind names it for a reader
	// of the manifest and never appears as an entry's value.
	files.set(INDEX_PATH, serializeArtifact({ entries }, INDEX_PATH))
	return files
}
