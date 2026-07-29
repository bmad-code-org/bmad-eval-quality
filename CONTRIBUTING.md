# Contributing to eval-quality

Thanks for your interest in contributing! `eval-quality` is a provider-agnostic agent-evaluation library, distributed as a single npm package with per-module subpath exports.

## Getting Started

### Prerequisites

- Node.js (version specified in `.nvmrc`)
- npm

### Initial Setup

```bash
git clone https://github.com/muratkeremozcan/eval-quality.git
cd eval-quality
nvm use
npm install

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

## Release Process

Releases are cut via the "Publish Package" GitHub Actions workflow (`workflow_dispatch`): it bumps the version, builds, publishes to npm, tags the release, and opens a PR with the version bump back to `main`.

## Community & Support

- **Issues**: report bugs and request features via GitHub Issues.
- **Security**: see [SECURITY.md](SECURITY.md) - do not open a public issue for vulnerabilities.

Thank you for contributing to eval-quality!
