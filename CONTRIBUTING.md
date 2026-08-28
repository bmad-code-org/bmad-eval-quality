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

A release is two steps with a human merge in between. The version is decided on a laptop and lands
on `main` through an ordinary PR; the publish workflow then publishes whatever version `main`
declares. Nothing in CI bumps a version or pushes to a branch, because the `protect-main` ruleset
makes that impossible: a PR opened with `GITHUB_TOKEN` never triggers `pr-gate.yml`, so the
required `gate` check never posts and the PR never merges.

### 1. Cut the release PR

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

Write changelog entries under `[Unreleased]` in the PR that makes the change, so the release PR
only moves them. If `[Unreleased]` is empty at release time the stamp is a no-op and the GitHub
Release falls back to generated notes.

Review the PR, wait for `gate`, merge it. Every merge here is a squash, so the release commit on
`main` is the squash commit, and that is what gets tagged.

### 2. Publish from main

```bash
npm run release:publish             # gh workflow run publish.yml --ref main
```

or Actions > Publish Package > Run workflow, branch `main`. The workflow takes no inputs. It:

1. fails at the AD-18 guard unless the repository variable `PUBLICATION_UNBLOCKED` is `true`;
2. checks out `main`, pins npm, audits lockfile age, runs `npm ci`;
3. reads the version from `package.json` and resolves what already happened: refuses if tag
   `vX.Y.Z` exists at a different commit, or if npm already has `X.Y.Z` published from a different
   commit (`gitHead` on the registry manifest);
4. runs `npm run validate` and `npm run build`;
5. `npm publish --access public --provenance --tag latest` through the npm Trusted Publisher
   (OIDC, no token), skipped when npm already has the version;
6. polls the registry for up to two minutes until the version resolves;
7. tags `github.sha` as `vX.Y.Z` (no `-f`), skipped when the tag already points there;
8. creates the GitHub Release with the `[X.Y.Z]` section of `CHANGELOG.md` as the body, falling
   back to `[Unreleased]`, then to generated notes; skipped when the Release exists.

Re-running the workflow after a partial failure is the recovery path. The registry can accept a
tarball and then fail the provenance upload, or the tag push can fail after the publish succeeded;
each step above checks its own prior success, so a re-run finishes the release instead of dying on
"tag already exists" or "cannot publish over existing version". Runs are serialized
(`concurrency: publish`, no cancellation).

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
   workflow filename `publish.yml`, no environment.
6. Run the publish workflow from `main`. It finds the version on npm with a matching `gitHead`,
   skips the publish, and does the tag and Release.

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
