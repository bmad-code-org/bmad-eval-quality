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

The gates binary carries five gates.

## The configuration file

`eval-quality.config.json` at your repository root, or any path you give to `--config`.
The top level is an object keyed by gate name.

The file carries only the gates you have adopted.
Configuring a gate is what opts into it, so you read and write the section you adopted and leave the rest alone.
A gate you invoke with no section for it refuses by name and says which section to write.
There is no fallback to this package's own values.

Every path a section names is relative to the configuration file, so a configuration file is self-contained wherever you keep it.

A file configuring all five gates parses against the published schema:

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
    },
    "tolerances": [
      {
        "reason": "the image binaries are optional, the site selects a passthrough image service, and they are never loaded",
        "lockfiles": ["site/package-lock.json"],
        "prefix": "@img/sharp-",
        "license": "LGPL-3.0-or-later",
        "marker": {
          "file": "site/astro.config.mjs",
          "contains": "passthroughImageService"
        }
      }
    ]
  },
  "dependency-direction": {
    "roots": [{ "path": "src", "extensions": [".ts"] }],
    "layers": [
      {
        "name": "schema",
        "match": "prefix",
        "path": "src/model/schema/",
        "imports": ["schema"],
        "externals": {
          "policy": "allow",
          "modules": ["zod"],
          "rule": "the schema layer may import zod and nothing else"
        }
      },
      {
        "name": "model",
        "match": "prefix",
        "path": "src/model/",
        "imports": ["model", "schema"],
        "externals": {
          "policy": "deny",
          "rule": "the model layer is pure and imports nothing outside src/"
        }
      },
      {
        "name": "app",
        "match": "prefix",
        "path": "src/app/",
        "imports": ["app", "model", "schema"]
      }
    ],
    "purity": {
      "layers": ["model", "schema"],
      "awaitRule": "no await in the model layer; the app layer is where I/O happens",
      "asyncFunctionRule": "no async function in the model layer",
      "newDateRule": "no clock read in the model layer: new Date() is impurity",
      "members": [
        {
          "member": "Date.now",
          "rule": "no clock read in the model layer: Date.now is impurity"
        }
      ]
    },
    "reportOnly": false
  },
  "package-boundary": {
    "paths": [
      { "path": "src", "extensions": [".ts"] },
      { "path": "data" }
    ],
    "manifest": {
      "file": "package.json",
      "fields": ["description", "keywords", "scripts"]
    },
    "patterns": [
      {
        "name": "unpublished-path",
        "match": "\\b(?:scripts|tests|tooling)/",
        "reason": "a directory the published file list does not carry, so a reader of the installed package cannot open what the sentence points at"
      },
      {
        "name": "build-machine-path",
        "match": "(?:/Users/|/home/|/root/)",
        "reason": "an absolute path from the machine that built the package"
      }
    ]
  },
  "field-ownership": {
    "paths": [{ "path": "src", "extensions": [".ts"] }],
    "fields": ["tenantId"],
    "declarations": ["src/model/schema/"],
    "writers": ["src/app/authorize.ts"],
    "helpers": ["withTenant"]
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

`tolerances` holds the scoped exceptions, and every entry names four things: the `lockfiles` it applies to, the package-name prefix that marks the family, the licence text tolerated inside it, and the reason the exception is sound.
All four are required, so a tolerance written without `lockfiles` is refused at exit `64`.
`optional` limits the exception to entries npm recorded as optional and defaults to true, so a family that is installed unconditionally needs `"optional": false` written in.
A tolerance may also carry a marker naming a file and the text that has to be in it.
The exception holds only while that marker holds, so the condition that made it sound is read on every run and the gate fails again the day that condition goes.

When a violation is found the gate prints the shortest chain of require-names from your root package to the offending entry, so the report names which dependency brought it in.

## The dependency-direction gate

It reads every import, re-export, dynamic import and triple-slash reference directive in the trees you name, and holds each one against a layer graph you declare.

This gate needs one thing installed: `typescript`, which the package declares as an optional peer dependency.
Install it only if you run this gate or the field-ownership gate, which are the two that read your source.
Invoke it without it and the gate refuses at exit `64`, naming the missing dependency and the gate that wanted it, so a repository that adopted the other three is never left wondering which of its gates is complaining.

### Roots

`roots` is the list of trees to walk.
Each one is a directory and the file extensions to read inside it, so `src/**/*.cjs` is the root `{ "path": "src", "extensions": [".cjs"] }` and no glob language is involved.
A root inside another root is refused, because the inner tree would otherwise be read twice and every violation in it reported twice.
A root that holds no matching file fails the run at exit `64`: a scan of nothing reports zero violations for the wrong reason.

### Layers

`layers` is an **ordered** list and the first match wins.

Order is the whole of it.
Every file under `src/core/schemas/` also sits under `src/core/`, so the narrower prefix has to be listed first or those files are held to the wider layer's rules.
In this package's own configuration, swapping those two rows reports 78 violations where there are none today.
That is why `layers` is a list and not an object keyed by layer name: a map carries no order, and normalising this into one, or sorting it, rewrites the graph it describes without changing a word of it.
A row that an earlier row already matches in full is refused outright, so making that mistake costs you a configuration error and never a silent re-layering.

Each layer names what it matches, how, and what it may import.

`match` is `"exact"` for a single file named by its whole path, or `"prefix"` for every file under a directory.
A prefix path ends with `/`, which keeps a layer at `src/core/` from claiming `src/core-experimental/x.ts`.

`imports` names every layer this one may reach, in full.
A layer that may import itself names itself: an implicit self-edge would be a permission nobody wrote down and nobody could find.
An unlisted layer is denied, so "nothing may import the CLI layer" is written by leaving it out of every list.

`label` is how the layer reads in a violation line, and defaults to its name.

### What a layer may reach outside your trees

`externals` is `unrestricted` by default.

`{ "policy": "deny", "rule": "..." }` refuses every external module and runtime builtin, and prints your sentence when one appears.
`{ "policy": "allow", "modules": [...], "rule": "..." }` admits exactly the specifiers you list, matched by exact string equality, so `"zod"` admits `zod` and refuses `zod/v4`.

`exemptions` opens one file to one module through one named binding.
The clause has to be that binding alone, optionally renamed with `as` and optionally type-only; a default or namespace binding beside it pulls in the rest of the module and is refused.
The exemption reaches a static import declaration and nothing else, so the same file reaching the same module through a re-export, a dynamic import, or a reference directive is refused and told so in the exemption's own words.

### Purity

`purity` names the layers that must stay pure and the sentence each ban prints.
`await`, an async function, and `new Date` are refused inside them, along with every `object.member` pair you list under `members`.
That table is where ambient globals go: `crypto` and `performance` need no import, so no import rule can see them.

### Triple-slash reference directives

A reference directive is a dependency written as a comment, and it is checked like any other.
`path=` is resolved against the containing file and held to the layer graph.
`types=` is held to the layer's external policy.
`lib=` and `no-default-lib` name a TypeScript library file, so neither is an edge in any graph.
TypeScript honours these only in a file's leading trivia, and so does this gate.

### CommonJS

`commonjs` is `"forbid"` by default, which refuses `require()` and `import x = require()` outright.
Set it to `"check"` for a tree with CommonJS files, and a literal `require()` specifier is read as an edge and held to the same layer rules.
A `require()` whose argument is not a string literal is a violation under `"check"`, because a specifier the gate could not read is a dependency it could not place.

### Reporting before failing

`reportOnly` is `false` by default.
Set it to `true` and the gate prints every violation and exits `0`.

It lives in the configuration file rather than on the command line on purpose.
Adopting this gate on an existing repository usually means learning the size of the fix first and committing to it second, and in the configuration file "we are still counting" is a line a reviewer sees in the diff and a one-line change turns off.
On the command line it would be an invocation detail that nobody reading the repository can find and nothing ever reminds you to remove.

A report-only run always prints its count, zero included, and still fails at exit `64` when a declared root yielded nothing.
A green report-only run therefore always carries a number.

### Three rules are the gate's own

Three things are not configurable, and each is mechanism rather than architecture.

The async detector is structural.
TypeScript emits the `async` keyword token for the text "async" unconditionally, because it is only a contextual keyword, so `const async = 5` reaches the same check that an async method does.
Separating them takes the shape of the tokens around it, and no table of banned words can express that.

The exemption's sole-binding check is a token-shape predicate.
Its parameters are yours: the file, the module, the binding name, and the sentence it prints.
What "the clause binds that one name and nothing else" means is the gate's.

The exemption reaches an import declaration only.
A re-export and a dynamic import of the same module carry no clause to hold to a binding list, so neither can be admitted by an exemption and both are refused.

### What this gate does not see

It reads the dependency each file declares, one file at a time.
A layer boundary respected file by file and crossed through a barrel, where a permitted layer re-exports a forbidden one and a third layer imports it from there, is a graph this gate reports as clean.
Under `commonjs: "check"` it reads a literal `require()` specifier and nothing else: a specifier built at runtime is reported as unreadable and never resolved.

## The package-boundary gate

It reads every file your package would publish and fails on a line matching a pattern you declared.

The point is the set it reads.
A published package is not your repository: an installer receives whatever your file list carries and nothing else, so a comment in shipped source that points at a test directory, a build script, or a document you did not publish is pointing at a file the reader does not have.
The gate holds the package as an installer receives it.

`paths` is that set.
Each entry names a directory to walk or a single file to read.
`recursive` defaults to true.
`extensions` narrows a directory to the files you name, and leaving it out reads every file whatever its name, which is what a tree of generated data needs.
`optional` says the path may contribute nothing.
By default an absent or empty path fails, so a generated tree nobody built cannot read as a clean scan.

What you leave out of `paths` is exempt.
That is the only exemption there is, and it is why the list is worth reading twice: a file you forgot is a file nobody holds.

`manifest` scans the fields a registry publishes verbatim.
Name the file and the fields.
A string is one entry, an array joins into one, and an object becomes one entry per key, so naming `scripts` covers every script by name.
A field you name that the manifest does not carry is refused, so a typo cannot read as a field with nothing in it.
A JSON value has no line of its own, so every one of these reports at line 1.

`patterns` is the rules, and the array is ordered.
The first pattern that matches a logical line is the one the line is reported under, and no line is reported twice.
So a pattern for a word that is a substring of a path you also forbid has to come second: put the specific spellings first, or the short word takes every one of those paths and the path pattern never fires.

A run of consecutive comment lines is joined and matched as one line, attributed to the first line of the run, because a comment wraps at some column and a reference split across two physical lines is the ordinary shape.
Both joins are tried, the one with spaces and the one with nothing, so a word wrapped at its hyphen is still matched.

### What is allowed in a pattern

`match` is regular-expression source, at most 200 characters, and there may be at most 64 patterns.
`flags` admits `i`, `m`, `s`, `u` and `v`.
A `g` or a `y` is refused: either one carries a match position between calls, so a pattern holding one would match every second line it should have matched.

A backreference is refused.
It is the construct that turns a scan of one line into an exponential one, and a boundary pattern has no use for one.

A logical line longer than 65536 characters is reported rather than matched, under the reserved name `line-exceeds-scan-bound`.
A line the gate declined to match is a line nobody held, so it is reported instead of skipped.
Joining puts that bound on the run and not on the file's own lines, so a long comment block and a single-line JSON document both reach it while every physical line stays short.

Those are the bounds, and here is what they do not cover.
JavaScript's regular expressions expose no step counter and no timeout, so nothing here can stop a pattern with nested quantifiers from taking far longer over one line than that line deserves.
The work is bounded, because the input is, and the pattern and the tree are both yours.

## The field-ownership gate

It fails on a write to a field you own from a module you did not declare, and on a declared module that writes none of the fields it is named for.

The rule generalises a narrow thing: some fields carry a claim rather than a convenience, and the value is only worth what the rule about who may set it is worth.
An identifier only a factory may assign.
A timestamp one repository layer owns.
A tenant marker written only where a request has been authorized.
A provenance field only the stage that mints an artifact may fill in.
The gate knows nothing about what any of them mean; it holds the rule that the set of writers is the set you declared.
A repository with no lineage or provenance concept at all is the ordinary case for it.

Four settings.
`fields` names the fields.
`declarations` is the path prefixes where naming a field is always allowed, whatever the writer list says: where the schema, the type, and the factory that defines the shape live.
A file under one of them is exempt entirely.
`writers` is the modules permitted to write them.
`helpers` is the identifiers that write the fields on a caller's behalf, so naming one outside the writer list is the same write one line further out.

Both directions are checked, because both go wrong.
A write outside the declared set is the obvious one.
A declared writer that writes none of its fields is the likelier regression: a rename empties the list and every other check keeps passing over a rule nothing enforces any more.
A writer you named with no file at all is reported the same way.

`paths` is the source the scan reads, the same shape the package-boundary gate uses.
A file outside it is neither held nor counted.

### What this gate does not reach

The scan is over names.
A write routed through a helper you have not listed is invisible to it, and so is a write performed by copying properties from an object built somewhere else, where no field name appears in the offending file at all.
The shipped fixtures carry that case: a second helper, one directory away in a declared path, moves both fields out of a module that names neither, and the gate is silent until the helper list gains the name.

That is the shape of the gate rather than a defect in it.
A vocabulary is what its author was thinking about, and the writes it will not reach are the ones nobody wrote a word for.
Read the helper list when you read the writer list.

### It needs the typescript package

This gate reads your source through the typescript package's own scanner, which is an optional peer dependency of this package.
Install `typescript` to run it.
The dependency-direction gate is the only other one that needs it; the remaining three need nothing beyond this package, and a gate you have not configured is a gate you never invoke, so a repository that adopted only those three never installs it.

Invoked without it, this gate refuses at exit `64` naming the missing dependency and itself.

## Related pages

- [CLI Reference](/reference/cli-commands/)
- [What Ships](/explanation/what-ships/)
