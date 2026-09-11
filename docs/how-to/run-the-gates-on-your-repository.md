---
title: "Run the Gates on Your Repository"
description: "The package ships a second binary that holds your own lockfiles to a publication-age window and a licence allowlist you declare in one configuration file."
sidebar:
  order: 7
---

# Run the gates on your repository

The package publishes two binaries.
`eval-quality` compiles and scores behavioral contracts.
`eval-quality-gates` runs checks against your own repository, and this page is about that one.

Every gate reads its rules out of one JSON file you write.
This package's own trees, names, and policies stay in this package; your run sees the values you declared and nothing else.

The gates binary carries two gates.

## The configuration file

`eval-quality.config.json` at your repository root, or any path you give to `--config`.
The top level is an object keyed by gate name.

The file carries only the gates you have adopted.
Configuring a gate is what opts into it, so you read and write the section you adopted and leave the rest alone.
A gate you invoke with no section for it refuses by name and says which section to write.
There is no fallback to this package's own values.

Every path a section names is relative to the configuration file, so a configuration file is self-contained wherever you keep it.

A file configuring both gates parses against the published schema:

```json
{
  "lockfile-age": {
    "lockfiles": ["package-lock.json", "site/package-lock.json"],
    "windowDays": 7
  },
  "licences": {
    "lockfiles": ["package-lock.json", "site/package-lock.json"],
    "allowlist": ["MIT", "Apache-2.0", "ISC", "BSD-3-Clause"],
    "policies": {
      "site/package-lock.json": {
        "label": "site policy: allowlist + MPL-2.0",
        "reason": "the site is private, ships as static HTML, and redistributes none of the covered files",
        "also": ["MPL-2.0"]
      }
    }
  }
}
```

## Running one

```text
eval-quality-gates <gate> [--config <path>]
```

`--help` prints the gate list and the flags.
Exit `0` means the gate passed, exit `1` means it found what it exists to find, and exit `64` means the invocation or the configuration was wrong.

## The lockfile-age gate

It audits every entry in every lockfile you name against that entry's real publication timestamp on the npm registry.

`windowDays` is how old an entry has to be, in days.
It is a duration, so nothing you write goes stale as time passes.
Leave it out and the gate holds entries to seven days.

An entry published inside the window fails.
An entry whose publish metadata could not be fetched fails, because metadata that could not be read has answered nothing.
An entry that does not resolve to the npm registry fails, because a lockfile edit can relabel an entry's metadata while the tarball is pulled from somewhere else entirely.

A registry install-delay setting filters resolution and leaves a young entry that already sits in a committed lockfile alone.
This gate re-checks the committed lockfile, which is where that gap lives.

## The licences gate

It reads each lockfile directly, so it needs no install and it sees the optional platform binaries that this machine never installed.

`allowlist` is the set of licence identifiers every entry is held against.
It is required and the gate carries none of its own: an absent allowlist would either fail every entry or permit every entry, and this gate does neither.
The charset refuses `@` and `/`, so a package-and-version pin cannot be written into it.

A licence expression is evaluated.
`OR` passes when any operand is allowed, `AND` passes only when every operand is, parentheses group, and anything else has to sit in the allowlist exactly.
That last rule is what makes `Apache-2.0 WITH LLVM-exception` fail against an allowlist carrying `Apache-2.0`: the exception is part of the licence, and the allowlist names no exception.

`policies` is keyed by lockfile path, and each entry gives a label, a reason, and the identifiers that one lockfile allows on top of the allowlist.
The additions extend the allowlist, so one list and one delta is all there is to keep in step.

`tolerances` is for the exception that is not an allowlist entry: a family of packages named by prefix, the licence text tolerated inside them, and the reason it is sound.
A tolerance may carry a marker naming a file and the text that has to be in it.
The exception holds only while that marker holds, so the condition that made it sound is read on every run and the gate fails again the day that condition goes.

When a violation is found the gate prints the shortest chain of require-names from your root package to the offending entry, so the report names which dependency brought it in.

## Related pages

- [CLI Reference](/reference/cli-commands/)
- [What Ships](/explanation/what-ships/)
