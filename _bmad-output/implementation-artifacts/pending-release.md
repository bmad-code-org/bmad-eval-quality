# Pending release, blocked on a permission

A release is ready and was not cut, because the dispatch was denied by the Claude Code auto-mode
classifier in the session that would have run it. **Nothing has been published.** This note may be
read hours after it was written, so it describes what to run rather than a fixed snapshot.

## The command

```bash
gh workflow run publish.yml --ref main -f bump=minor
```

The bump is `minor`: every change waiting is additive or a correction.

`npm run release:minor` is the same command and was also declined, because it is the same
`gh workflow run` behind a different name and running it would work around the denial's intent.

## What it publishes

Whatever is on `main` when it runs. The workflow bumps `package.json` and the lockfile, writes the
manifest version into `VERSION`, moves `[Unreleased]` in `CHANGELOG.md` into a dated section, commits
to `main` with `[skip ci]`, publishes to npm with provenance, tags, and creates the GitHub Release.

`main` was at `a37a9dc` when this note was last revised, on 10 September. It has probably moved since,
and the command stays correct because it publishes the head rather than a commit named here.

The stories merged since the last published version, `3.0.0`:

- **12.1**, the schema-version constants, `compareDominance` and its vocabulary on the barrel, and
  `check:version`.
- **12.3**, the eight remaining schema-version constants, held against the parser.
- **13.1, pull request 1 of 3**, the lockfile-age and licence gates published to consumers, with the
  configuration format and the `dist/gates/` build target. This one also closed a package-substitution
  hole in both gates.

Read `CHANGELOG.md`'s `[Unreleased]` section for the authoritative list; it moves with every merge and
this list does not.

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
