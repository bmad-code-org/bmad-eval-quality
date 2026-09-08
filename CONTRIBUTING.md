# Contributing to eval-quality

Thanks for your interest in contributing! `eval-quality` is a provider-agnostic agent-evaluation library, distributed as a single npm package with per-module subpath exports.

## Getting Started

### Prerequisites

- Node.js (version specified in `.nvmrc`)
- npm

### Initial Setup

```bash
git clone https://github.com/bmad-code-org/bmad-eval-quality.git
cd eval-quality
nvm use
npm install
npm run hooks:install   # install the pre-commit hooks

# Verify the setup
npm run validate
```

### Quick Development Commands

```bash
npm run validate    # typecheck + lint + test
npm run build       # emit to dist/
npm run lint:fix    # auto-fix with Biome
npm run format      # format with Biome
npm run test        # run vitest once
npm run test:watch  # vitest in watch mode
```

## Architecture Constraints

- **Provider-agnostic core.** The runner and judge talk to model providers through thin adapters. Nothing in the core grader pipeline should hard-depend on a single vendor's SDK; provider SDKs are optional peer dependencies behind an adapter interface.
- **Evidence, not benchmarks.** A grader's job is to produce evidence that feeds a ship / don't-ship decision, with a numeric score and a pass/fail, not a leaderboard number.
- **Deterministic-first.** Prefer deterministic assertions (tool calls, params, sequence, grounding checks) over LLM-judge calls; the judge is the expensive, last-resort layer.
- **Non-determinism is measured, not hidden.** Use `trials` + pass@k to measure flakiness; do not use retries to paper over it.

## Adding a Module

Each module follows the same shape:

```
src/<module>.ts        # implementation + exported types
tests/<module>.test.ts # vitest unit tests
docs/<module>.md       # usage docs with real examples
```

1. **Implement** in `src/<module>.ts`. Export explicit types; keep side effects out of module scope.
2. **Add a subpath export** in `package.json`:

   ```json
   "./<module>": {
     "types": "./dist/<module>.d.ts",
     "default": "./dist/<module>.js"
   }
   ```

3. **Re-export from the barrel** in `src/index.ts`.
4. **Add tests** in `tests/<module>.test.ts`.
5. **Document** it in `docs/<module>.md` and add a row to the README module table.

## Code Standards

- **Strict typing**: explicit return types, no `any` in `src`.
- **Functional style**: pure functions, minimal shared state.
- **No new runtime dependencies** without discussion first. Provider SDKs are peer dependencies, not direct dependencies.

## Submitting Changes

1. **Keep PRs focused**: one module or fix per PR.
2. **Tests required**: add or update coverage for any behavior change.
3. **Docs required**: update the relevant `docs/*.md` and the README table for any public API change.
4. **CI must pass**: `pr-checks.yml` (lint / typecheck / build / test) and `gitleaks-check.yml` must be green.
5. **No breaking changes** to existing exports unless discussed and documented.

### Commit Message Format

```
type: brief description

Detailed explanation if needed
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

### Code Review Process

All PRs require at least one maintainer review before merge. CI must be green.

## Releasing

`npm run release:patch` (or `release:minor`, `release:major`) picks the bump and dispatches
`publish.yml` from `main`, which bumps the version, stamps the changelog, commits, tags, and
publishes in one run. The workflow pushes the release commit to `main` with the job's own
`GITHUB_TOKEN`; [Why the release push needs nothing
special](#why-the-release-push-needs-nothing-special) explains why that is enough.

The two-step path below (bump on a laptop, merge the PR, publish with `bump=none`) takes the release
commit through an ordinary pull request instead, and is the fallback when the direct push is refused.

### One-step: bump and publish together

From any checkout:

```bash
npm run release:patch      # or release:minor, release:major
```

This dispatches `publish.yml` on `main` with the matching `bump` input. The run:

1. fails at the AD-18 guard unless the repository variable `PUBLICATION_UNBLOCKED` is `true`;
2. checks out `main`, runs `npm test`, then `node scripts/release-prepare.mjs <bump>
   --on-main`: bumps `package.json` and `package-lock.json` (`npm version --no-git-tag-version`),
   stamps `VERSION` in `src/index.ts`, moves `[Unreleased]` in `CHANGELOG.md` into a dated
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

Getting here cost three failed releases. `main` used to carry a `protect-main` ruleset whose
`code_coverage` rule refused every direct push with

```
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - Code coverage checks require merging via API or UI.
```

A `GITHUB_TOKEN` cannot be named in a ruleset bypass list, so the fix attempted at the time was to
push as a GitHub App instead. That made it worse: `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY` are
repository secrets in the other repository and were never created here, so the run died earlier, at
the token step, with `The 'client-id' (or deprecated 'app-id') input must be set to a non-empty
string`. The ruleset was deleted instead, which is what made the two repositories the same.

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

Read the whole rule list rather than the one rule you changed: run 34245836441 failed because
`required_status_checks` was audited and removed while `code_coverage`, present since the ruleset was
created on 2026-08-25, went unread.

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

Review the PR, wait for `gate`, merge it. Every merge here is a squash, so the release commit on
`main` is the squash commit, and that is what gets tagged.

#### 2. Publish from main

```bash
npm run release:publish             # gh workflow run publish.yml --ref main -f bump=none
```

or Actions > Publish Package > Run workflow, branch `main`, `bump: none`. With `bump=none` the run
skips straight to publishing the version `main` already declares: pins npm, audits lockfile age,
runs `npm ci` and `npm test` and `npm run build`, then publishes, tags, and creates the
Release exactly as described in the one-step path above, steps 3 and 4.

The release run tests and does not `validate`: every commit on `main` cleared `gate` on its pull
request, so the build, the lint and the consistency checks have already run against that tree. Run
`npm run validate` on a laptop before pushing, not on the way out.

### First publish

The npm Trusted Publisher form lives under an existing package's settings
(npmjs.com > Packages > `eval-quality` > Settings > Trusted Publisher), and as of the
[current docs](https://docs.npmjs.com/trusted-publishers) there is no way to register one for a
package the registry has never seen. Check that page first; if npm has added first-publish support
since, configure the publisher and skip the token below. Otherwise the first version goes up once
by hand:

1. Pick the first version deliberately. `package.json` sits at `0.0.0`, so `release:prepare -- patch`
   produces `0.0.1` and `minor` produces `0.1.0`. Cut and merge that PR as in step 1.
2. On npmjs.com, create a granular access token: packages and scopes "Read and write", the
   shortest expiry offered, IP allowlist if practical, bypass 2FA off. It has to cover all
   packages, since an unpublished package cannot be selected.
3. From a clean checkout of `main` at the merged release commit (`git rev-parse HEAD` must equal
   what `gh pr view --json mergeCommit` reports; publishing from the release branch would record
   a `gitHead` that is not on `main` and the workflow would refuse it):

   ```bash
   npm ci && npm run validate && npm run build
   EVAL_QUALITY_PUBLISH_AUTHORIZED=true NODE_AUTH_TOKEN=<token> npm publish --access public --tag latest
   ```

   No `--provenance`: attestations need a CI identity. Every later release gets one.
4. Revoke the token.
5. Configure the Trusted Publisher: organization `bmad-code-org`, repository `bmad-eval-quality`,
   workflow filename `publish.yml`, no environment. npm defaults a Trusted Publisher created on or
   after 2026-09-03 to staged publishing only; `publish.yml` runs `npm publish --provenance`
   directly, so also grant this configuration the direct-publish permission, or npm rejects that
   publish on the registry side with the workflow otherwise correct.
6. Run the publish workflow from `main` with `bump: none`. It finds the version on npm with a
   matching `gitHead`, skips the publish, and does the tag and Release.

### Tag protection

Tags `v*` should be immutable once pushed, like the "Release tags" ruleset on bmad-tea. Create it
once with:

```bash
gh api --method POST repos/bmad-code-org/bmad-eval-quality/rulesets --input - <<'JSON'
{
  "name": "Release tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/tags/v*"], "exclude": [] } },
  "rules": [{ "type": "deletion" }, { "type": "non_fast_forward" }, { "type": "update" }],
  "bypass_actors": []
}
JSON
```

Creation stays allowed, which is all the workflow needs. A tag at the wrong commit is fixed by
bumping the version and releasing again, never by moving the tag.

## Community & Support

- **Issues**: report bugs and request features via GitHub Issues.
- **Security**: see [SECURITY.md](SECURITY.md) - do not open a public issue for vulnerabilities.

Thank you for contributing to eval-quality!
