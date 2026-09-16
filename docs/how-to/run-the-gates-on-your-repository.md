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

The gates binary carries eight gates.

The first half of this page is five short labs you run.
The second half is the reference for every setting each gate takes.
Work through a lab before you read the reference for its gate, because the settings read very differently once you have watched the gate fail.

## Before you start

The commands below are `node dist/gates/gates-cli.js`, which is the gates binary inside a clone:

```bash
git clone https://github.com/bmad-code-org/bmad-eval-quality.git
cd bmad-eval-quality
npm ci
npm run build
```

Installed from the registry, the same binary is on `PATH` as `eval-quality-gates`, and every command below works with that name in place of the `node dist/...` form.

Each lab builds a tiny repository under `/tmp` so your own checkout stays clean.
The labs are deliberately smaller than anything you would really gate, because the point is to feel the gate behave.

## The exit contract

Every gate answers with one of three codes, and a lab below produces each one.

```text
0   the gate passed
1   the gate found the thing it exists to find
64  the invocation or the configuration was wrong
```

The split matters when you wire a gate into CI.
`1` is a finding about your repository and belongs in the build log next to the diagnostic.
`64` says the gate never got as far as looking, so treating it as a finding would report a clean scan of nothing.

One more thing decides what you see.
A passing run prints its summary on standard output, and a failing run prints its diagnostic on standard error.

## Lab 1: one gate, one failure, one fix

`package-boundary` is the gate to meet first, because it needs nothing installed and nothing from the network.

It reads every file your package would publish and fails on a line matching a pattern you declared.
The case it exists for is a shipped file pointing at a path the installed package does not carry: a comment in published source that sends a reader to a test directory that npm never packed.

Build a package with exactly that problem.

```bash
rm -rf /tmp/eval-quality-gates-lab/package-boundary
```

```bash
mkdir -p /tmp/eval-quality-gates-lab/package-boundary/src
```

```bash
cat > /tmp/eval-quality-gates-lab/package-boundary/src/greet.js <<'EOF'
// The greeting the package exports.
// See tests/greet.test.js for the cases this covers.
export const greet = (name) => `hello, ${name}`
EOF
```

```bash
cat > /tmp/eval-quality-gates-lab/package-boundary/package.json <<'EOF'
{
  "name": "greeter",
  "version": "1.0.0",
  "description": "A greeting.",
  "files": ["src"]
}
EOF
```

`files` carries `src` alone, so an installer receives `src/greet.js` and never receives `tests/`.
The comment on the second line points somewhere the reader does not have.

Now declare the rule:

```bash
cat > /tmp/eval-quality-gates-lab/package-boundary/eval-quality.config.json <<'EOF'
{
  "package-boundary": {
    "paths": [{ "path": "src", "extensions": [".js"] }],
    "manifest": { "file": "package.json", "fields": ["description"] },
    "patterns": [
      {
        "name": "unpublished-path",
        "match": "\\btests/",
        "reason": "the published file list carries src only, so a reader of the installed package cannot open what the sentence points at"
      }
    ]
  }
}
EOF
```

Run it:

<!-- expect-exit: 1 -->

```bash
node dist/gates/gates-cli.js package-boundary --config /tmp/eval-quality-gates-lab/package-boundary/eval-quality.config.json
```

```text
...
package-boundary: 1 violation(s) across 2 scanned entr(ies):
  src/greet.js:1 [unpublished-path] The greeting the package exports. See tests/greet.test.js for the cases this covers.
    the published file list carries src only, so a reader of the installed package cannot open what the sentence points at
```

Exit `1`, and three things in that diagnostic are worth reading.

The reason you wrote is printed under the finding, so the person who hits this months from now reads your sentence rather than a rule name.

Both comment lines were joined into one logical line and reported at line 1, which is the start of the run. A reference that wraps across two lines is the ordinary shape, so the gate matches the run rather than each physical line.

The scan counted two entries: one file under `src`, and one manifest field.

Fix it by cutting the reference:

```bash
cat > /tmp/eval-quality-gates-lab/package-boundary/src/greet.js <<'EOF'
// The greeting the package exports.
export const greet = (name) => `hello, ${name}`
EOF
```

```bash
node dist/gates/gates-cli.js package-boundary --config /tmp/eval-quality-gates-lab/package-boundary/eval-quality.config.json
```

```text
package-boundary: 2 entr(ies) scanned, 0 violations (1 from src, 1 from package.json)
```

Exit `0`, and the count is in the passing line on purpose.
A gate that passed over nothing and a gate that passed over your whole tree print different numbers, so the green line still carries evidence.

That loop is every gate on this page: declare the rule, run it, read the finding, fix the thing, run it again.

## Lab 2: licences

`licences` reads each lockfile directly, so it needs no install and it sees the optional platform binaries this machine never installed.

```bash
rm -rf /tmp/eval-quality-gates-lab/licences
```

```bash
mkdir -p /tmp/eval-quality-gates-lab/licences
```

```bash
cat > /tmp/eval-quality-gates-lab/licences/package-lock.json <<'EOF'
{
  "name": "greeter",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "packages": {
    "": { "name": "greeter", "version": "1.0.0", "dependencies": { "pad-left": "1.3.0", "tiny-parse": "2.0.0" } },
    "node_modules/pad-left": {
      "version": "1.3.0",
      "resolved": "https://registry.npmjs.org/pad-left/-/pad-left-1.3.0.tgz",
      "license": "BSD-2-Clause"
    },
    "node_modules/tiny-parse": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/tiny-parse/-/tiny-parse-2.0.0.tgz",
      "license": "MIT"
    }
  }
}
EOF
```

```bash
cat > /tmp/eval-quality-gates-lab/licences/eval-quality.config.json <<'EOF'
{
  "licences": {
    "lockfiles": ["package-lock.json"],
    "allowlist": ["MIT", "Apache-2.0", "ISC"]
  }
}
EOF
```

<!-- expect-exit: 1 -->

```bash
node dist/gates/gates-cli.js licences --config /tmp/eval-quality-gates-lab/licences/eval-quality.config.json
```

```text
...
licences package-lock.json: 1 entrie(s) outside the allowlist:
  - pad-left@1.3.0: license="BSD-2-Clause"
    dependency path: greeter > pad-left
```

The dependency path is the shortest chain of require-names from your root package to the offending entry, so the report names which of your dependencies brought it in.

The honest fix here is to allow the licence, since `BSD-2-Clause` is one a permissive policy normally accepts and the decision belongs in the allowlist where a reviewer sees it in a diff:

```bash
cat > /tmp/eval-quality-gates-lab/licences/eval-quality.config.json <<'EOF'
{
  "licences": {
    "lockfiles": ["package-lock.json"],
    "allowlist": ["MIT", "Apache-2.0", "ISC", "BSD-2-Clause"]
  }
}
EOF
```

```bash
node dist/gates/gates-cli.js licences --config /tmp/eval-quality-gates-lab/licences/eval-quality.config.json
```

```text
licences package-lock.json: passed against the allowlist, 2 entrie(s), all allowlisted.
```

The other three settings on this gate exist for the cases the allowlist cannot reach, and the reference below covers each: `policies` for one lockfile that may carry more, `tolerances` for a family that is installed and never loaded, and `undeclared` for an entry whose manifest carries no licence field at all.

## Lab 3: lockfile-age, and the one lab with a network prerequisite

`lockfile-age` audits every lockfile entry against that entry's real publication timestamp on the npm registry.
It is the gate against a supply-chain attack that publishes a malicious version and waits for the next install to pick it up.

**The prerequisite.** An entry the `cache` file carries is used with no request. Every other entry is fetched from the npm registry, and a fetch that fails fails the gate rather than skipping the entry. So this lab is fully offline only because the cache below carries every entry in the lockfile.

```bash
rm -rf /tmp/eval-quality-gates-lab/lockfile-age
```

```bash
mkdir -p /tmp/eval-quality-gates-lab/lockfile-age
```

```bash
cat > /tmp/eval-quality-gates-lab/lockfile-age/package-lock.json <<'EOF'
{
  "name": "greeter",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "packages": {
    "": { "name": "greeter", "version": "1.0.0", "dependencies": { "settled-dep": "1.0.0", "fresh-dep": "2.0.0" } },
    "node_modules/settled-dep": {
      "version": "1.0.0",
      "resolved": "https://registry.npmjs.org/settled-dep/-/settled-dep-1.0.0.tgz",
      "license": "MIT"
    },
    "node_modules/fresh-dep": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/fresh-dep/-/fresh-dep-2.0.0.tgz",
      "license": "MIT"
    }
  }
}
EOF
```

```bash
cat > /tmp/eval-quality-gates-lab/lockfile-age/lockfile-age-cache.json <<'EOF'
{
  "settled-dep@1.0.0": "2020-03-02T00:00:00.000Z",
  "fresh-dep@2.0.0": "2099-01-15T00:00:00.000Z"
}
EOF
```

`fresh-dep` is dated in 2099 so this lab keeps failing whenever you run it.
A recent real date would read more naturally and would go stale, and a lab that quietly stops failing teaches the wrong thing.

```bash
cat > /tmp/eval-quality-gates-lab/lockfile-age/eval-quality.config.json <<'EOF'
{
  "lockfile-age": {
    "lockfiles": ["package-lock.json"],
    "cache": "lockfile-age-cache.json"
  }
}
EOF
```

<!-- expect-exit: 1 -->

```bash
node dist/gates/gates-cli.js lockfile-age --config /tmp/eval-quality-gates-lab/lockfile-age/eval-quality.config.json
```

```text
...
lockfile-age package-lock.json: 1 entrie(s) published inside the ...-day window (cutoff ...):
  - fresh-dep@2.0.0 published 2099-01-15T00:00:00.000Z (node_modules/fresh-dep)
```

The window and the cutoff are elided above because both move with the clock.
That is the gate's design rather than an accident: `windowDays` is a duration, so nothing you write goes stale as time passes.

Age the entry and it passes:

```bash
cat > /tmp/eval-quality-gates-lab/lockfile-age/lockfile-age-cache.json <<'EOF'
{
  "settled-dep@1.0.0": "2020-03-02T00:00:00.000Z",
  "fresh-dep@2.0.0": "2020-03-02T00:00:00.000Z"
}
EOF
```

```bash
node dist/gates/gates-cli.js lockfile-age --config /tmp/eval-quality-gates-lab/lockfile-age/eval-quality.config.json
```

The run prints the effective clock, then how many timestamps it read from the cache, then a passing line naming the cutoff it held every entry to.

Editing that cache to make a package look old is a real weakening of the gate, and it is meant to be.
The cache is a committed file, and a diff to it is where that decision is visible, exactly as a wider `windowDays` or a longer `allowlist` would be.

## Lab 4: dependency-direction

**The prerequisite, before you run anything.** This gate reads your source through the TypeScript scanner, and `typescript` is an optional peer dependency of this package. Run it inside this clone and it is already there. Run it in a repository that does not have it and the gate refuses at exit `64`, naming the missing dependency and itself. `field-ownership` in lab 5 is the only other gate that needs it, and the remaining six need nothing beyond this package.

Two layers, and one import going the wrong way.

```bash
rm -rf /tmp/eval-quality-gates-lab/dependency-direction
```

```bash
mkdir -p /tmp/eval-quality-gates-lab/dependency-direction/src/model
```

```bash
mkdir -p /tmp/eval-quality-gates-lab/dependency-direction/src/app
```

```bash
cat > /tmp/eval-quality-gates-lab/dependency-direction/src/app/config.ts <<'EOF'
export const currency = 'EUR'
EOF
```

```bash
cat > /tmp/eval-quality-gates-lab/dependency-direction/src/model/price.ts <<'EOF'
import { currency } from '../app/config.ts'

export const format = (amount: number) => `${amount} ${currency}`
EOF
```

```bash
cat > /tmp/eval-quality-gates-lab/dependency-direction/eval-quality.config.json <<'EOF'
{
  "dependency-direction": {
    "roots": [{ "path": "src", "extensions": [".ts"] }],
    "layers": [
      {
        "name": "model",
        "match": "prefix",
        "path": "src/model/",
        "imports": ["model"]
      },
      {
        "name": "app",
        "match": "prefix",
        "path": "src/app/",
        "imports": ["app", "model"]
      }
    ]
  }
}
EOF
```

<!-- expect-exit: 1 -->

```bash
node dist/gates/gates-cli.js dependency-direction --config /tmp/eval-quality-gates-lab/dependency-direction/eval-quality.config.json
```

Exit `1`. This gate splits its report across the two streams, so the count arrives on standard output and the violation itself on standard error:

```text
dependency-direction: 1 violation(s) across 2 scanned file(s):
  src/model/price.ts:1 "../app/config.ts": model may not import app
```

`model` names only itself under `imports`, and a layer it does not name is denied.
That is the whole rule: permission is what you wrote down, and there is no implicit edge anywhere.

The fix is the one the layering was asking for. Take the value as a parameter, so the dependency points the other way:

```bash
cat > /tmp/eval-quality-gates-lab/dependency-direction/src/model/price.ts <<'EOF'
export const format = (amount: number, currency: string) =>
	`${amount} ${currency}`
EOF
```

```bash
cat > /tmp/eval-quality-gates-lab/dependency-direction/src/app/config.ts <<'EOF'
import { format } from '../model/price.ts'

export const currency = 'EUR'
export const show = (amount: number) => format(amount, currency)
EOF
```

```bash
node dist/gates/gates-cli.js dependency-direction --config /tmp/eval-quality-gates-lab/dependency-direction/eval-quality.config.json
```

```text
dependency-direction: passed, 2 file(s) scanned across 1 root(s), 0 violations.
```

## Lab 5: field-ownership

Same prerequisite as lab 4: this gate needs `typescript`.

One field that carries a claim, one module allowed to set it, and one write from somewhere else.

```bash
rm -rf /tmp/eval-quality-gates-lab/field-ownership
```

```bash
mkdir -p /tmp/eval-quality-gates-lab/field-ownership/src/app
```

```bash
cat > /tmp/eval-quality-gates-lab/field-ownership/src/app/authorize.ts <<'EOF'
export const authorize = (request: { user: string }) => ({
	user: request.user,
	tenantId: 'acme',
})
EOF
```

```bash
cat > /tmp/eval-quality-gates-lab/field-ownership/src/app/report.ts <<'EOF'
export const anonymise = (row: { user: string }) => ({
	user: row.user,
	tenantId: 'unknown',
})
EOF
```

```bash
cat > /tmp/eval-quality-gates-lab/field-ownership/eval-quality.config.json <<'EOF'
{
  "field-ownership": {
    "paths": [{ "path": "src", "extensions": [".ts"] }],
    "fields": ["tenantId"],
    "declarations": [],
    "writers": ["src/app/authorize.ts"],
    "helpers": []
  }
}
EOF
```

<!-- expect-exit: 1 -->

```bash
node dist/gates/gates-cli.js field-ownership --config /tmp/eval-quality-gates-lab/field-ownership/eval-quality.config.json
```

```text
...
field-ownership: 1 violation(s) across 2 scanned file(s):
  src/app/report.ts:3 tenantId: only a declared path or a declared writer may set this field; this is a literal position
```

There is a tempting wrong fix here, and it is worth knowing before you reach for it.
Adding `anonymise` to `helpers` makes this worse rather than better: a listed helper is read as the same write one line further out, so naming it there reports the same violation at every call site instead of clearing it.

The fix is to move the write to the module that owns it:

```bash
cat > /tmp/eval-quality-gates-lab/field-ownership/src/app/authorize.ts <<'EOF'
export const authorize = (request: { user: string }) => ({
	user: request.user,
	tenantId: 'acme',
})

export const anonymise = (row: { user: string }) => ({
	user: row.user,
	tenantId: 'unknown',
})
EOF
```

```bash
cat > /tmp/eval-quality-gates-lab/field-ownership/src/app/report.ts <<'EOF'
import { anonymise } from './authorize.ts'

export const report = (rows: readonly { user: string }[]) => rows.map(anonymise)
EOF
```

```bash
node dist/gates/gates-cli.js field-ownership --config /tmp/eval-quality-gates-lab/field-ownership/eval-quality.config.json
```

```text
field-ownership: 2 file(s) scanned, 0 violations
```

## Seeing exit 64

The third code is the one you meet while adopting a gate rather than while running it.

A gate you invoke with no section for it refuses by name, because configuring a gate is what opts into it and there is no fallback to anyone else's values:

<!-- expect-exit: 64 -->

```bash
node dist/gates/gates-cli.js package-boundary --config /tmp/eval-quality-gates-lab/licences/eval-quality.config.json
```

A configuration file that does not exist refuses the same way, naming the path, the gate that wanted it, and the flag that would point somewhere else.

A section the gate cannot parse refuses with the JSON path of the offending setting and the reasoning behind the rule it broke:

```bash
cat > /tmp/eval-quality-gates-lab/malformed.json <<'EOF'
{
  "package-boundary": {
    "paths": [{ "path": "src", "extensions": [".js"] }],
    "manifest": { "file": "package.json", "fields": ["description"] },
    "patterns": [
      { "name": "anything", "match": "tests/", "flags": "g", "reason": "a pattern that carries a match position between calls" }
    ]
  }
}
EOF
```

<!-- expect-exit: 64 -->

```bash
node dist/gates/gates-cli.js package-boundary --config /tmp/eval-quality-gates-lab/malformed.json
```

That last one reports that `flags` admits only `i`, `m`, `s`, `u` and `v`, and says why a `g` or a `y` is refused: either one carries a match position between calls, so a pattern holding one would match every second thing it should have matched.

## Where to go next

The rest of this page is reference.
Read the section for a gate when you adopt it, and read `dependency-direction` and `package-boundary` in full before you adopt either, because both have rules about ordering that are easy to get wrong and quiet when you do.

## The configuration file

`eval-quality.config.json` at your repository root, or any path you give to `--config`.
The top level is an object keyed by gate name.

The file carries only the gates you have adopted.
Configuring a gate is what opts into it, so you read and write the section you adopted and leave the rest alone.
A gate you invoke with no section for it refuses by name and says which section to write.
There is no fallback to this package's own values.

Every path a section names is relative to the configuration file, so a configuration file is self-contained wherever you keep it.

A file configuring all eight gates parses against the published schema:

```json
{
  "lockfile-age": {
    "lockfiles": ["package-lock.json", "site/package-lock.json"],
    "windowDays": 7,
    "exclude": [
      {
        "name": "@acme/design-tokens",
        "reason": "pinned exactly and adopted on release day; the release is ours",
        "lockfiles": ["package-lock.json"]
      }
    ]
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
    ],
    "undeclared": [
      {
        "reason": "the 1.2.0 tarball's package.json carries no license field, so the lockfile records none",
        "lockfiles": ["site/package-lock.json"],
        "prefix": "zod-to-ts",
        "readAs": "MIT",
        "evidence": "the same tarball ships an MIT LICENSE file beside that package.json, and the repository carries the same file"
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
  },
  "doc-invocations": {
    "pages": ["README.md", "docs"],
    "binary": [
      {
        "entry": "dist/cli.js",
        "spellings": ["npx your-tool", "your-tool"],
        "installedPrefix": "node_modules/your-tool/"
      },
      {
        "entry": "dist/gates.js",
        "spellings": ["npx your-tool-gates", "your-tool-gates"],
        "installedPrefix": "node_modules/your-tool/"
      }
    ],
    "sampleInput": "examples/report.json"
  },
  "doc-counts": {
    "sources": {
      "rules": {
        "kind": "module",
        "from": { "module": "src/rules/index.ts", "export": "RULES", "take": "length" }
      },
      "examples": {
        "kind": "files",
        "paths": [{ "path": "examples", "recursive": false, "extensions": [".json"] }]
      }
    },
    "entries": [
      {
        "file": "README.md",
        "claim": "the rule count",
        "pattern": { "match": "ships ([a-z-]+) rules" },
        "counts": ["rules"]
      },
      {
        "file": "docs/examples.md",
        "claim": "the worked example count",
        "pattern": { "match": "([a-z-]+) worked examples" },
        "counts": ["examples"]
      }
    ]
  },
  "doc-claims": {
    "pages": ["README.md", "docs"],
    "sources": [{ "path": "src", "extensions": [".ts"] }],
    "citations": { "window": 4 },
    "symbols": {
      "foreign": [
        { "token": "AbortSignal", "reason": "the platform's own type, declared by node's lib" }
      ]
    },
    "lists": [
      {
        "file": "docs/rules.md",
        "claim": "the rule list",
        "pattern": { "match": "the rules are ([^.]*?)\\." },
        "tokenShape": { "module": "src/rules/index.ts", "export": "RULE_NAMES" },
        "expected": { "module": "src/rules/index.ts", "export": "RULE_NAMES" }
      }
    ],
    "codes": {
      "pattern": { "match": "raises `([a-z][a-z0-9]*(?:-[a-z0-9]+)+)`" },
      "registries": [{ "module": "src/errors.ts", "export": "ERROR_CODES" }]
    },
    "fences": [
      {
        "file": "docs/rules.md",
        "claim": "the worked rule object",
        "intro": { "match": "It parses as a `Rule`:" },
        "schema": { "module": "src/rules/schema.ts", "export": "Rule" }
      }
    ],
    "vocabulary": {
      "tokens": { "module": "src/formats.ts", "export": "FORMAT_KINDS" },
      "accepted": { "module": "src/formats.ts", "export": "SUPPORTED_FORMAT_KINDS" },
      "refused": { "module": "src/formats.ts", "export": "UNSUPPORTED_FORMAT_KINDS" }
    },
    "dated": {
      "triggers": [{ "match": "\\bnot yet\\b|\\btoday\\b", "flags": "i" }],
      "claims": [
        {
          "file": "README.md",
          "key": "no production deployment has run it yet",
          "settles": "read",
          "reason": "a deployment is outside this repository, so no artifact here records one",
          "asOf": {
            "hash": "89f8b8ea0ff30c6934b32a463d0dc18d210600518974117d7763eb48ac58b984"
          }
        }
      ]
    },
    "transcriptions": [
      {
        "file": "docs/cli.md",
        "claim": "the exit-code table",
        "text": { "module": "src/cli/render.ts", "export": "EXIT_CODE_TABLE" }
      }
    ]
  }
}
```

## Running one

```text
eval-quality-gates <gate> [--config <path>]
```

`--help` prints the gate list and the flags, and [the exit contract](#the-exit-contract) above is what each code means.

## The lockfile-age gate

It audits every entry in every lockfile you name against that entry's real publication timestamp on the npm registry.

`windowDays` is how old an entry has to be, in days.
It is a duration, so nothing you write goes stale as time passes.
Leave it out and the gate holds entries to seven days.

An entry published inside the window fails.
An entry whose publish metadata could not be fetched fails, because metadata that could not be read has answered nothing.
An entry that does not resolve to the npm registry fails, because a lockfile edit can relabel an entry's metadata while the tarball is pulled from somewhere else entirely.
That is the resolved-URL check: an entry's `resolved` has to be its own tarball on the npm registry, and both this gate and the licences gate apply it before anything else.

A registry install-delay setting filters resolution and leaves a young entry that already sits in a committed lockfile alone.
This gate re-checks the committed lockfile, which is where that gap lives.

`cache` names a JSON file mapping `name@version` to a publication timestamp, and it is what keeps a gate that runs on every build off the network.
Both of this audit's inputs make it sound with no staleness bound: a package's publication time is fixed the moment it is published, so a reading taken once is correct forever, and the predicate is monotone in time, so an entry that passes once passes on every later run.
An entry the cache carries is used with no request, an entry it does not is fetched, and a fetch that fails still fails the gate.

The gate only reads the file. Write it with a generator of your own and commit it, and a run you never make costs you nothing but requests.

The cache is trusted the way the rest of your configuration is trusted.
A back-dated entry in it makes a young package look old, exactly as a wider `windowDays` or a longer `allowlist` would weaken the gates beside it.
All of those are committed files, and a diff to any of them is the place that decision is visible.

`exclude` holds the packages exempt from the window, one row each.
It is the counterpart of npm's `min-release-age-exclude`, for a package you pin exactly and adopt on release day.
A row names three things: the package under `name`, the `lockfiles` it is exempt in, and the `reason`, which is printed beside the entry on every run.
`name` takes a package name, so a version literal such as `left-pad@1.3.0` is refused at exit `64`.
It is the name of the installed package, so for an `npm:` alias you write the aliased package and never the folder it installs into.
Every entry under that name is exempt, a nested duplicate at another version included, and each one is printed.
An excluded entry is neither aged nor fetched, and it is still held to the resolved-URL check: an exclusion says a package's young releases are accepted, and says nothing about which tarball the install fetches.
Every excluded entry is printed as excluded on every run, passing or failing, and the count line still carries every entry scanned.
A row is held in each lockfile it names: one whose name no entry carries in one of them is refused at exit `64`, naming that lockfile, because the package left it or the name is mistyped, and either way nothing there is holding the row.
A run that also found a violation exits `1` and prints the stale row as a diagnostic, so a caller branching on the exit code sees the finding first.
Two rows excluding one name in one lockfile are refused, since one exemption carries one reason.

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

`undeclared` is for an entry whose manifest carries no licence field, so the lockfile records none and no allowlist, policy or tolerance can reach it.
Each row names five things: the `lockfiles` it applies to, the package-name `prefix`, the one identifier the entry is read as under `readAs`, the `evidence` for that reading, and the `reason` the field is missing.
`readAs` is one SPDX identifier, held against the allowlist by the rule every declared identifier is held by, so a row cannot admit what the allowlist refuses, and a policy's additions still apply.
`prefix` is a plain string prefix with no boundary, as it is on a tolerance: `zod-to-ts` also reaches `zod-to-ts-plugin` the day one appears undeclared, so a whole name is the tightest prefix there is and the evidence you write should hold for the family it names.
A row reaches only an entry that declares nothing, which is an absent, null or empty `license` field; an entry under the same prefix that declares a licence is held to its declaration, and a field present in a shape the gate does not read, an array or an object with no `type`, fails as it always has.
An undeclared entry with no row fails, and the line says it declares no licence.
An entry admitted this way is printed as read by evidence, with its evidence and its reason, on every run that uses the row, passing or failing, under a line of its own apart from `tolerated:`.
A row is held in each lockfile it names: one that reaches no undeclared entry in one of them is refused at exit `64`, naming that lockfile, because the package now declares a licence there and the reading is no longer needed, or the prefix is mistyped.
A run that also found a violation exits `1` and prints the stale row as a diagnostic, so a caller branching on the exit code sees the finding first.
Two rows reading one prefix in one lockfile are refused, since one package is read as one licence.

When a violation is found the gate prints the shortest chain of require-names from your root package to the offending entry, so the report names which dependency brought it in.

## The dependency-direction gate

It reads every import, re-export, dynamic import and triple-slash reference directive in the trees you name, and holds each one against a layer graph you declare.

This gate needs one thing installed: `typescript`, which the package declares as an optional peer dependency.
Install it only if you run this gate or the field-ownership gate, which are the two that read your source.

The scanner both gates read lives at `typescript/unstable/ast`, a subpath TypeScript 7 ships and TypeScript 5 does not.
Invoke either gate without `typescript` installed at all and it refuses at exit `64`, naming the missing dependency and the gate that wanted it.
Invoke either gate with a TypeScript 5.x install and it refuses at exit `64` the same way, naming the installed version and that the scanner ships from TypeScript 7.
A TypeScript 7 install that is missing a syntax-kind member the scanner reads (a future release renaming or dropping one) refuses at exit `64` by that member's own name, rather than silently switching the rule it guards off.
So a repository that adopted the other six gates is never left wondering which of its gates is complaining, or why.

### Roots

`roots` is the list of trees to walk.
Each one is a directory and the file extensions to read inside it, so `src/**/*.cjs` is the root `{ "path": "src", "extensions": [".cjs"] }` and no glob language is involved.
A root inside another root is refused, because the inner tree would otherwise be read twice and every violation in it reported twice.
A root that holds no matching file fails the run at exit `64`: a scan of nothing reports zero violations for the wrong reason.

### Layers

`layers` is an **ordered** list and the first match wins.

Order is the whole of it.
Every file under `src/core/schemas/` also sits under `src/core/`, so the narrower prefix has to be listed first or those files are held to the wider layer's rules.
In this package's own configuration, swapping those two rows reports 80 violations where there are none today.
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
The dependency-direction gate is the only other one that needs it; the remaining six need nothing beyond this package, and a gate you have not configured is a gate you never invoke, so a repository that adopted only those six never installs it.

The scanner lives at `typescript/unstable/ast`, a subpath TypeScript 7 ships and TypeScript 5 does not, so install TypeScript 7 to run this gate.
Invoked with `typescript` absent, this gate refuses at exit `64` naming the missing dependency and itself.
Invoked against a TypeScript 5.x install, it refuses at exit `64` naming the installed version and that the scanner ships from TypeScript 7.
Invoked against a TypeScript 7 install missing a syntax-kind member the scanner reads, it refuses at exit `64` by that member's name, rather than switching the rule it guards off with the gate reporting green.

## The doc-invocations gate

It runs every fenced command in the pages you name against the binary you name, and compares the exit code with what the page claims.

`binary.entry` is the built entry point, and it is a precondition.
A gate that skipped when it was absent would exit `0` having executed nothing, so an absent entry is a refusal at exit `64` naming the path.

`binary.spellings` is how your pages write the command, as the literal text a reader types.
Each is matched at the start of a fenced line with whitespace or end of line after it, so a transcript of your own diagnostic output is left alone.
Write every spelling your pages use: `npx your-tool`, the bare name, and whatever `node dist/...` form your contributor documentation carries.

`binary` takes a list where a package publishes more than one.
Every spelling across every binary is matched against the same page, longest first, so a short name never claims a line that opens with a longer one, and each entry carries its own `installedPrefix` and its own precondition.
The per-page sandbox is shared, which is what lets one binary read a file an earlier command from the other one wrote.

`sampleInput` stands in for a file only the reader has, such as `<path>`.
A run that needed one is judged for usage errors and crashes and nothing more, because its exit code is not the page's own claim.

A run whose every input resolved to real bytes is the page's claim, so it has to exit `0`.
A page that deliberately shows a failure declares the code it expects in an HTML comment on the line before the fence:

```text
<!-- expect-exit: 4 -->
```

Declaring a code the run does not produce fails too: a documented rejection that stopped rejecting is as stale as a flag that stopped existing.

`usageExit` is the code your command line returns when a command or a flag does not exist, and an invocation that returns it fails whatever inputs it named.
Declaring that same code for a faithful invocation is what admits it, which is what a binary that spends the code on a configuration it would not read needs, and an undeclared usage exit still fails every time.

A page may transcribe the diagnostic beside a declared-exit fence, in a `text` fence separated from the command by blank lines only, and that block is compared to stderr line for line.
`...` inside a line elides a run of characters there, and a line that is exactly `...` matches any one line.
Stderr may run past the block, and the block may never run past stderr, so a page transcribing the first lines of a longer diagnostic is making a claim about those lines and no others.

The gate replays each page in its own temporary directory, in document order.
A `cat > path <<'EOF'` heredoc, an `echo ... > path` redirect and a `mkdir -p` all take effect there, so a page that writes a file and then reads it is checked against the file it wrote.
Every path is rebased under that directory first, so the gate writes nothing into your repository.

## The doc-counts gate

It computes every hand-written count in the pages you name from the thing it counts, renders it the way the page spells it, and compares.

A section has two halves.
`sources` names where each number comes from, and `entries` names which sentence carries it.

A source is one of four kinds.
`module` imports a module of yours and reads an export, which is what covers a number your own code derives.
`json` walks a JSON file, which is what covers a count the manifest already holds.
`files` counts the files under the paths you name.
`matches` counts occurrences of a pattern across the trees you name, or the distinct values of its first capture group.

An entry names a file, a pattern with one capture group per number, and whether the page spells it as a word or as digits.
Words are rendered from a closed table covering zero to ninety-nine, and the comparison follows the case the page used.
Set `wrap` when the sentence may wrap across lines: a literal space in the pattern then also matches a line break, and never a blank line, so a capture cannot reach into the paragraph above.

A pattern that matches nothing fails, and so does one that matches twice.
A rewritten sentence therefore cannot escape its own entry by drifting out from under the pattern, and a source no entry uses fails for the same reason.

## The doc-claims gate

It holds the prose claims in your pages against the tree those pages describe: the class of sentence that is neither a number nor a fenced command.

Eight classes, each its own block. A section declaring none of them is refused: the alternative is a pass over nothing.

`citations` resolves every source citation a page carries, the file-and-line-number form, checks the line is in range, and checks that a symbol the sentence names is declared within a few lines of it.
A citation whose sentence names no such symbol is registered under `unanchored` with the reason, and an entry matching no citation fails, so a fixed sentence leaves no stale exemption behind.

`symbols` holds every backticked identifier against the declarations in your source roots.
The test is declaration, which catches what a mention-based test would miss: a symbol deleted in a rename commonly survives in a comment, and a gate reading mentions would keep passing the page that names it.
A token your tree is right not to declare goes under `foreign` with its reason.

`lists` holds a sentence that spells out a set against the set a module of yours exports.
`tokenShape` says which backticked tokens inside the captured stretch are members, either as a pattern or as a module export naming the whole vocabulary.

`codes` holds every code a page says is raised against the registries you name.
The trigger is the verb: a kebab-case token on its own is as likely to be an example identifier as a claim about your tree.

`fences` parses a published JSON block against the schema the prose names.
The block is found by the sentence that introduces it, so the entry survives a paragraph moving, and a sentence matching nothing fails as a dead entry.

`vocabulary` holds every sentence saying a member of your vocabulary is accepted or refused against your two sets, including one written tomorrow on a page no entry covers.
A token is classified by the nearest governing verb, and a verb the sentence negates or puts in the past leaves it undecided.

`dated` is the one class that only registers a claim; deciding it is not this gate's job.
Whether a route still works months after it was last exercised is not written anywhere in your tree, so no check can settle it.
What a check can settle is that the sentence exists and is registered: a claim of that kind fails until somebody writes down who holds it and why, and a registered claim whose sentence was rewritten fails as a dead entry.
Each entry says how it is settled, by a predicate of yours or by `"read"` with the reason nothing mechanical reaches it.

A `"read"` claim may also carry `asOf`, which pins it to the content a human actually read.
`asOf.hash` is the sha256 of `asOf.subject`'s content, taken the moment the claim was confirmed true; `subject` defaults to the claim's own `file` and only needs setting when the judgment is about a different file.
`npm run hash:doc-claim-subject -- <path>` prints the digest to paste in; a failing entry's own message also names the exact command and shows the stored digest beside the one it computed.
On every run the gate recomputes the hash and fails the entry the moment it disagrees, so a `"read"` claim stops being a confirmation that ages silently and starts being one that is checked against the thing it was read from.

`asOf` only works for a subject inside your own tree.
It is a content hash, so the artifact has to be something this run can read; a fact about another repository, a live server, or anything else outside the tree it can never settle, and pinning the page that states such a fact only proves the page has not been edited, not that the fact still holds.
Leave `asOf` off a claim like that, and say why in `reason`.
When the judgment is really about a different file than the one carrying the sentence, and that file is in this tree, name it under `subject`: a table of ports a CLI awaits, say, is a fact about the source that wires them, not about the reference page transcribing it, and pinning the page instead would fire on every unrelated edit to that page and stay silent on every rewiring.
Two entries with the same `file` and `key` are allowed, so a claim resting on more than one source file gets one entry per file.

Subject content is read the way every other path this gate reads is read: a symbolic link is refused rather than followed, and any other read failure (missing, a directory, unreadable) is reported with its real cause rather than folded into one message.

The hash is taken over normalized content: each line's leading indentation is kept and everything after it has its trailing whitespace trimmed and its inner whitespace runs collapsed to one space, and a run of blank lines collapses to one, so a formatter rewrapping prose or trimming trailing whitespace does not read as drift.
Line endings are also normalized, so a checkout with different line endings hashes the same.
A fenced code block, opened with backticks or tildes and closed by a matching-or-longer run of the same character, is the one exception: it is hashed byte-exact, because indentation inside one is meaning a formatter is not free to move and a normalized hash would let a broken example pass unnoticed.
Leading indentation stays significant outside a fence too, for the same reason: it is what carries a nested list's depth and an indented code block's own content, and collapsing it would hide either changing.
What this normalization does not catch, because catching it needs real markdown parsing rather than a text pass, runs in both directions. A real content change that stays invisible: a list marker's character (`*`/`+`/`-`), a heading's style (setext vs ATX), or a hard line break's trailing two spaces can each change without changing the hash. A cosmetic-only change that still trips the pin: a table's delimiter-row padding (`|---|---|` vs `| --- | --- |`) and a prose line rewrapped to a different width both change the hash with nothing about what the page says having changed. If your formatter rewraps prose, its own `proseWrap: "preserve"` setting (or equivalent) avoids that source of churn; this gate has no setting of its own for it.

`asOf` is refused on a claim `settles` a predicate, since the predicate already re-runs on every check and a content pin beside it would be a second, uncoordinated staleness rule.

`transcriptions` holds a page that reprints bytes your code emits against the bytes themselves.

### These two gates import your modules

`doc-counts` and `doc-claims` read values out of modules your configuration names.
Reading a value means importing the module that exports it, and importing runs that module's top level and everything it transitively imports, in this gate's own process, with this process's own permissions and environment.
That is the same trust a lint plugin or a test setup file has, and it is what lets a count stay a computation in code you can test: the configuration only names it.
Point them at modules whose top level, and whose imports, you are happy to run on every build.

## Related pages

- [CLI Reference](/reference/cli-commands/)
- [What Ships](/explanation/what-ships/)
