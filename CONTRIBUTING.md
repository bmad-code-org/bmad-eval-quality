# Contributing to eval-quality

`eval-quality` compiles Behavioral Evaluation Contracts and scores their ability to catch known defects.
It is one npm package with a small set of subpath exports, and it executes nothing: no agent, judge, or system under test runs inside it.

## Getting started

Node.js 22.20.0 or newer. `.nvmrc` pins the version CI uses.

```bash
git clone https://github.com/bmad-code-org/bmad-eval-quality.git
cd bmad-eval-quality
nvm use
npm install
npm run hooks:install   # pre-commit hooks
npm run validate        # the whole gate
```

```bash
npm run build       # emit to dist/
npm run test        # vitest once
npm run test:watch  # vitest in watch mode
npm run lint:fix    # Biome, with fixes
npm run docs:dev    # the documentation site, live
```

## What the gate checks

`npm run validate` is what CI runs on every pull request.
Beyond typecheck, lint, and tests with coverage, it holds a set of byte-exact drift checks: the published JSON Schemas against the Zod source, the development corpus, the three generated decision tables under `docs/`, the worked example chain, the shareable HTML export, and the barrel's `VERSION` against the manifest.
Every one has a `generate:*` or `build:*` twin; the README's Development section lists them.
A hand edit to a generated file fails the check, so regenerate.

Three more guards are structural.
`check:layers` keeps the dependency direction inside `src/`.
`check:lineage` keeps lineage fields written only by the modules that own them.
`check:boundary` keeps everything the tarball carries free of references to the planning system that produced it.

Every fenced CLI invocation in `README.md` and `docs/` is run against the built binary by `check:doc-invocations`, and its exit code is compared with what the page claims.
A page that demonstrates a failure declares the code it expects in an HTML comment on the line before the fence.
Exit `4` is every structural failure's code, so a page that also transcribes the diagnostic in a `text` fence directly under the command's fence, separated by blank lines only, has that block compared line for line against what the run wrote to stderr.

## Code standards

- Strict typing: explicit return types, no `any` in `src/`.
- Pure functions in `src/core/`. Every effect goes through a port; the CLI and the adapters are the only places that touch the filesystem or a process.
- No new runtime dependency without discussion first. `zod` is the only one today.
- Lean comments. A module's top-of-file comment carries the reasoning; the docs carry the consequence.

## Submitting changes

1. One change per pull request.
2. Tests for any behavior change. Coverage on `src/core/` stays at or above 90 percent, statements and branches.
3. Docs for any change to a command, a flag, an export, or a schema: `docs/` and the README.
4. A changelog entry under `[Unreleased]` in `CHANGELOG.md` for anything a consumer would notice.
5. `npm run validate` green locally, then the `gate` check green on the pull request.

Commit messages follow `type: brief description`, with `feat`, `fix`, `docs`, `refactor`, `test`, or `chore` as the type.
Merge by squash; the repository allows the other two, and the release tag lands on whatever commit reaches `main`.

## Releasing

`npm run release:patch` (or `release:minor`, `release:major`) picks the bump and dispatches
`publish.yml` from `main`, which bumps the version, stamps the changelog, commits, tags, and
publishes in one run. The workflow pushes the release commit to `main` with the job's own
`GITHUB_TOKEN`; [Why the release push needs nothing
special](#why-the-release-push-needs-nothing-special) explains why that is enough.

The two-step path below (bump on a laptop, merge the PR, publish with `bump=none`) takes the release
commit through an ordinary pull request, and is the fallback when the direct push is refused.

### One-step: bump and publish together

From any checkout:

```bash
npm run release:patch      # or release:minor, release:major
```

This dispatches `publish.yml` on `main` with the matching `bump` input. The run:

1. fails at the AD-18 guard unless the repository variable `PUBLICATION_UNBLOCKED` is `true`;
2. checks out `main`, then `node scripts/release-prepare.mjs <bump>
   --on-main`: bumps `package.json` and `package-lock.json` (`npm version --no-git-tag-version`),
   writes the manifest version into `VERSION` in `src/index.ts` (`scripts/generate-version.ts`),
   moves `[Unreleased]` in `CHANGELOG.md` into a dated
   `[X.Y.Z]` section (`scripts/stamp-changelog.mjs`), and commits `chore: release vX.Y.Z [skip ci]`
   straight onto `main`. `[skip ci]` keeps that push from starting `pr-checks.yml` and the other
   push-triggered workflows on a commit this run already validated and owns. The commit identity is
   `github-actions[bot]`;
3. resolves the release state from that commit (`git rev-parse HEAD`; `github.sha` is the pre-bump
   commit once a bump happened) and refuses if the tag or npm version already exists at a different
   commit;
4. builds, publishes to npm with `--provenance` through the Trusted Publisher (OIDC, no token),
   tags the release commit, and creates the GitHub Release from the `[X.Y.Z]` CHANGELOG section.

Write changelog entries under `[Unreleased]` in the PR that makes the change; the release run only
moves them. An empty `[Unreleased]` makes the stamp a no-op and the GitHub Release falls back to
generated notes.

Re-dispatching after a partial failure is the recovery path: publish is skipped once npm has the
version, the tag once it points at the release commit, the GitHub Release once it exists. Once the
bump commit is on `main`, dispatch again with `bump=none`; re-dispatching with the same `bump`
computes the next version from the one already there and cuts a second, unwanted bump. Runs are
serialized (`concurrency: publish`, no cancellation).

### Why the release push needs nothing special

`main` carries no ruleset and no branch protection, so the release commit pushes with the job's own
`GITHUB_TOKEN` and nothing has to be granted a bypass. This matches
`bmad-code-org/bmad-method-test-architecture-enterprise`, which releases the same way from an
equally unruled `main`. The only ruleset in this repository is `Release tags`, which carries
`deletion`, `non_fast_forward` and `update` on `refs/tags/v*`; the tag push does none of those three,
so it is unaffected.

`main` once carried a ruleset whose `code_coverage` rule refused every direct push, and a `GITHUB_TOKEN` cannot be named in a ruleset bypass list, so the ruleset was deleted.

Branch protection on `main` and the one-step release path are therefore mutually exclusive as things
stand. If `main` is ever protected again, either give the pushing actor a bypass or use the two-step
path below, which takes the release commit through a pull request and needs no bypass at all.

When a ruleset changes, read it before changing the release path:

```bash
gh api repos/bmad-code-org/bmad-eval-quality/rulesets                  # which rulesets exist
gh api repos/bmad-code-org/bmad-eval-quality/rulesets/<id>             # its rules and bypass list
gh api repos/bmad-code-org/bmad-eval-quality/rulesets/<id>/history     # who changed it, and when
gh api repos/bmad-code-org/bmad-eval-quality/rules/branches/main       # what actually applies to main
```

Read every rule in the list, since one overlooked rule is enough to refuse the push.

### Fallback: bump on a laptop, publish separately

Two steps with a human merge in between: the flow before the one-step path existed, and the one that
depends on no App and no bypass, because the release commit reaches `main` through an ordinary
merged pull request.

#### 1. Cut the release PR

From a clean checkout of `main` that matches `origin/main`:

```bash
npm run release:prepare -- patch    # or minor, major
```

The script bumps `package.json` and `package-lock.json` (`npm version --no-git-tag-version`), moves
the `[Unreleased]` notes in `CHANGELOG.md` into a dated `[X.Y.Z]` section
(`scripts/stamp-changelog.mjs`), commits `chore: release vX.Y.Z` on `release/vX.Y.Z`, pushes, and
opens the PR against `main`. It refuses on a dirty tree, off `main`, when local `main` differs from
`origin/main`, and when the tag, the branch, or the npm version already exists. Pass `--no-pr` to
push without opening the PR.

Review the PR, wait for `gate`, merge it by squash, so the release commit on `main` is the squash
commit that gets tagged.

#### 2. Publish from main

```bash
npm run release:publish             # gh workflow run publish.yml --ref main -f bump=none
```

or Actions > Publish Package > Run workflow, branch `main`, `bump: none`. With `bump=none` the run
skips straight to publishing the version `main` already declares: pins npm, audits lockfile age,
runs `npm ci` and `npm run build`, then publishes, tags, and creates the
Release exactly as described in the one-step path above, steps 3 and 4.

The release run has no test step. Every commit on `main` cleared `gate` on its pull request,
which runs `npm run validate` on two Node versions plus the canary jobs, so a release re-proving any
part of that buys nothing and gives it a second way to fail on something unrelated to releasing.
Tests belong on the pull request and on a laptop before the push.

### Tags

The `Release tags` ruleset makes every `v*` tag immutable once pushed. A tag at the wrong commit is fixed by bumping the version and releasing again.

## Community & Support

- **Issues**: report bugs and request features via GitHub Issues.
- **Security**: see [SECURITY.md](SECURITY.md). Do not open a public issue for vulnerabilities.
