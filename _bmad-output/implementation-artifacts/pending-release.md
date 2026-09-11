# Pending release, blocked on a permission

A release is ready and was not cut, because the dispatch was denied by the Claude Code auto-mode
classifier in the session that would have run it. Nothing was published and nothing is half done.

## The command

```bash
gh workflow run publish.yml --ref main -f bump=minor
```

From `main` at `85758ce`. The bump is `minor`. The workflow does the rest: it bumps `package.json`
and the lockfile, writes the manifest version into `VERSION`, moves `[Unreleased]` in `CHANGELOG.md`
into a dated section, commits to `main` with `[skip ci]`, publishes to npm with provenance, tags, and
creates the GitHub Release.

`npm run release:minor` is the same command and was also declined, because it is the same
`gh workflow run` behind a different name and running it would work around the denial's intent.

## What it carries

- Story 12.1, merged as `4f4836f` in [#128](https://github.com/bmad-code-org/bmad-eval-quality/pull/128):
  `PROBE_SCHEMA_VERSION`, `EVAL_CONTRACT_SCHEMA_VERSION`, `compareDominance` and its vocabulary on the
  barrel, plus `check:version`.
- Story 12.3, merged as `85758ce` in [#129](https://github.com/bmad-code-org/bmad-eval-quality/pull/129):
  the eight remaining schema-version constants.

Every change in both is additive or a correction, which is why the bump is minor.

## Why it matters that this one runs

TEA's Story 2.6 replaces a five-entry `SCHEMA_VERSIONS` table with reads of these exports and cannot
start until they are published. A TEA session hand-corrected its `sealedRunRecord` entry from 3 to 6
on 10 September because it was emitting records no stage could read, and that correction stays a
literal until this release lands.

## After it runs

Confirm the published version directly against the registry rather than trusting the workflow's
report, because registry lag makes a successful publish look like a failure:

```bash
npm view eval-quality version
```

## The permission

Either run the command directly, or add a Bash permission rule for the release dispatch so an
unattended session can take the last step. The run reached a merged, green, reviewed `main` and then
could not publish it, which is the gap worth closing.
