# Adopting the three documentation gates: `doc-counts`, `doc-claims`, `doc-invocations`

Handover for TEA Stories 4.1, 4.2 and 4.3. This is written for someone adopting `eval-quality-gates` in a repository that is not `eval-quality` itself, who has not read the package's own source. It assumes you have already installed `eval-quality` and know the shape of `eval-quality.config.json`: a JSON object keyed by gate name, where configuring a gate is what opts into it, and a gate you invoke with no section for it refuses by name rather than falling back to anything.

All three gates run through the one published binary:

```bash
eval-quality-gates doc-counts   [--config <path>]
eval-quality-gates doc-claims   [--config <path>]
eval-quality-gates doc-invocations [--config <path>]
```

Exit `0` is a pass, exit `1` is a real disagreement, exit `64` is a usage or configuration error — the thing you fix by editing the configuration file, not the pages.

## The one setting all three gates share: `module-value`

Most of what these three gates hold a page against is not a literal you can type into JSON. "How many rules does the package ship" is a number your own code already knows; writing that number a second time into `eval-quality.config.json` would create exactly the kind of setting this format refuses to have — a value a hand keeps in step with the code beside it.

So wherever one of these gates needs a value it cannot spell, the setting is a **module value**: a path to one of your own modules, the export to read off it, and what to take from it.

```json
{ "module": "src/rules/index.ts", "export": "RULES", "take": "length" }
```

- `module` is relative to the configuration file, the same as every other path in it.
- `export` is the name of the export. A default export is named `"default"`.
- `path` (optional) is a list of property names to walk from the export before taking anything — useful when one exported table backs several sources, e.g. reading `CONFORMANCE_OUTCOME_COUNTS.corpus` as `{ "module": "...", "export": "CONFORMANCE_OUTCOME_COUNTS", "path": ["corpus"] }`.
- `take` says what to do with the value once you have it: `"value"` (the export itself — the default), `"length"` (its `.length`), or `"keys"` (the number of its own enumerable keys).

**The trap:** `take` defaults to `"value"`, and a list export read with the default `take` refuses:

```
eval-quality-gates: src/rules.ts's RULES is an array and take is "value", so a count was expected; a list takes "length" and a table takes "keys"
```

If the thing you are naming is a list, you almost always want `"take": "length"`. If it is a table, `"take": "keys"`.

**The other trap:** the module name has to be exactly right — a typo does not silently answer zero, it refuses naming what it found instead:

```
eval-quality-gates: src/rules.ts exports no "NOPE"; it exports RULES
```

**What this costs you, and why it is not hidden:** reading a module value means *importing* that module, which runs its top level and everything it transitively imports, in the gate's own process, with that process's own permissions and environment. This is the same trust a lint plugin or a test setup file already has in your repository. Point a source at a module whose import-time side effects you are happy to run on every gate invocation — most consumers write a small dedicated file (`doc-count-sources.ts`, `doc-claim-sources.ts` — the names `eval-quality` uses for its own, see below) with no side effects beyond computing the values.

## `doc-counts`: hold a hand-written number against the thing it counts

### The section shape

```json
{
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
  }
}
```

`sources` names where each number comes from, by a name you invent. Four kinds:

- `module` — a `module-value`, described above.
- `json` — walks a JSON file (`file`, optional `path`, `take`). Use this for a value already sitting in a manifest, e.g. `package.json`'s own `bin` object.
- `files` — counts the files matching a scanned-path list (the same `{ path, recursive, extensions, optional }` shape `package-boundary` and `field-ownership` already take).
- `matches` — counts occurrences of a pattern across a scanned-path list, or (with `"distinct": true`) the number of distinct values its first capture group takes.

`entries` names which sentence carries the number: a file, a claim (for the failure message), a pattern with one capture group per number, and which sources fill those groups in order. `rendering` is `"word"` (the default — rendered from a closed table covering zero to ninety-nine, case-matched to what the page wrote) or `"digits"`.

Set `wrap: true` on an entry whose sentence may wrap across a line break in the source markdown — a literal space in the pattern then also matches a line wrap, and never a blank line, so the capture cannot reach into the paragraph above it.

### What it refuses

- A pattern matching **zero** sentences, or **more than one**, is a dead entry: `no sentence matches the pattern for <claim>` / `<N> sentences match the pattern for <claim> (lines ...)`. Either the sentence moved or the entry has to.
- A declared source that no entry uses refuses at load: `is declared and no entry uses it; a source nothing reads is a count nobody holds`.
- A `matches` source with `distinct: true` and a pattern carrying no capture group refuses at load, before any file is read.
- A pattern using a stateful flag (`g` or `y`) refuses at load — those flags carry a match position between calls, which this format cannot give a consumer safely:

  ```
  entries.0.pattern.flags: admits only i, m, s, u and v. A g or a y carries a match position between calls, so a pattern holding either would match every second thing it should have matched
  ```

- A pattern carrying a backreference (`\1`, `\k<name>`) refuses at load — the same rule the boundary/field-ownership gates already apply to a consumer pattern, because a backreference turns a linear scan into an exponential one:

  ```
  sources.rules.pattern.match: carries a backreference, which is the construct that turns a linear scan into an exponential one; write the pattern without one
  ```

- A count outside the word table's range (0–99) fails and tells you to write it as digits instead.

### A clean pass looks like

```
doc-counts: 48 numeral(s) across 12 file(s) held against their source, plus 8 count(s) written as digits, 0 disagreement(s)
```

## `doc-claims`: hold a prose claim against the thing it describes

`doc-claims` is eight independent classes, each its own optional block. **A section declaring none of them refuses** — the alternative is a pass over nothing:

```
(the section itself): declares no class of claim, so the gate would report a pass over nothing; add at least one of citations, symbols, lists, codes, fences, vocabulary, dated or transcriptions
```

`pages` and `sources` are shared by every class that needs them (citations, symbols and codes read `sources`; the rest do not, and `sources` may be left out if you adopt only those). `sources` is the same scanned-path list as `doc-counts`'s `files` source.

### The section shape, all eight classes

```json
{
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
          "reason": "a deployment is outside this repository, so no artifact here records one"
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

What each class does and adopting it alone:

1. **`citations`** — every `path.ts:42` a page cites has to resolve, be in range, and sit within `window` lines (default 4) of a backticked symbol the cited file declares. A citation whose sentence names no such symbol is a dead entry unless registered under `citations.unanchored` with a reason.
2. **`symbols`** — every backticked identifier matching an identifier shape (camelCase, PascalCase, SCREAMING_SNAKE, or a lone capitalized word — override with `shape`) has to be *declared*, not merely mentioned, somewhere in `sources`. A name that is right to mention and wrong to require (a Node global, an environment variable, an HTTP method) goes in `symbols.foreign` with a reason.
3. **`lists`** — a sentence that spells out a set in prose is held against the set a module of yours actually exports. `tokenShape` says which backticked tokens in the captured stretch count as members: either a pattern (for a set whose members share a shape) or a module value naming the whole vocabulary (for one that does not).
4. **`codes`** — every code a page says is "raised" (the trigger is the verb, not the token's shape) has to exist in one of the named registries.
5. **`fences`** — a worked JSON example block, found by the sentence that introduces it, has to parse against the named schema (a Zod schema, found by module value).
6. **`vocabulary`** — the class rather than an enumerated list: *every* sentence saying a member of `tokens` is accepted or refused, anywhere on any page including one written tomorrow, is held against `accepted`/`refused`. The trigger is the nearest governing verb (`verbs.accepts` / `verbs.refuses`, both overridable); a verb ending in `-ed` reads as past tense unless a present `is`/`are` precedes it or you name your own participles under `verbs.participles`.
7. **`dated`** — the one class that *registers* rather than decides. A sentence whose truth depends on when it was written (`"not yet true"`, `"as of today"`, a version pin) is matched by `triggers` and has to be registered under `claims`, each with `settles`: either `"read"` (nothing in the tree can decide it, and `reason` says why) or a module value naming a predicate to run.
8. **`transcriptions`** — a page that reprints bytes your own code emits (an exit-code table, a rendered error) is held byte-for-byte against the module value naming those bytes.

### What it refuses, beyond the eight per-class refusals above

- **A class that examined zero sentences refuses**, the same "pass over nothing" rule as the section itself: an empty `citations`/`symbols`/`codes`/`vocabulary` result on the whole page set is a configuration error, not a silent pass. (`lists`, `fences`, `dated` and `transcriptions` are enumerated arrays with `min(1)`, so this shape does not apply to them the same way — an empty array is refused at load instead.)
- **A `pages` root that encloses the configuration directory is refused** — naming `.` or an ancestor is refused outright, canonicalized so a symlink cannot walk around the check.
- **A `pages` root that reaches no markdown at all is refused** (per root, not only when every root is empty — one mistyped entry among several does not silently drop its share of coverage).
- **`node_modules` and dotted directories are never walked**, even if named explicitly under `pages`.

### A clean pass looks like

```
doc-claims: 21 citations resolve (16 anchored on a symbol, 5 held by review), 449 backticked identifiers are declared, 13 transcribed lists match their source, 20 time-sensitive claims registered (13 settled by a predicate, 7 by review), 21 named codes exist, 11 worked JSON blocks parse against their schema, 30 vocabulary mentions agree with the two sets, 5 transcriptions match their source byte for byte, 0 disagreement(s)
```

## `doc-invocations`: run every fenced command against your real binary

### The section shape

```json
{
  "doc-invocations": {
    "pages": ["README.md", "docs"],
    "binary": {
      "entry": "dist/cli.js",
      "spellings": ["npx your-tool", "your-tool"],
      "installedPrefix": "node_modules/your-tool/"
    },
    "sampleInput": "examples/report.json"
  }
}
```

- `binary.entry` is your **built** entry point. This is a precondition, and the gate refuses rather than skips when it is absent (see below).
- `binary.spellings` is every literal way your documentation writes the command. List every form your pages actually use — `npx your-tool`, the bare name, any `node dist/...` form your contributor docs use. Each is matched at the start of a fenced line with whitespace or end-of-line after it, so a page transcribing your own stderr output is never mistaken for an invocation.
- `sampleInput` stands in for a file only the reader has (`<path>`, a metavariable). A run that needed one is judged only for a crash or a usage error, never for its exit code.

### How it decides whether an invocation's exit code is the page's own claim

A run is **faithful** when every input it named resolved to real bytes: a file the repository ships, a file the same page told the reader to create earlier (`cat > path <<'EOF'`, `echo ... > path`, `mkdir -p`), or an artifact an earlier command on the page wrote. Faithful runs replay in a temporary sandbox per page, in document order, so the check never writes into your repository.

A faithful run has to exit `0` — unless the page declares otherwise, in an HTML comment on the line before the fence:

```
<!-- expect-exit: 4 -->
```

A page that declares its exit may also transcribe the diagnostic beside it, in a `text` fence separated from the command by blank lines only. That block is compared to stderr line for line; `...` inside a line elides a run of characters, and a line that is exactly `...` matches any one line. The block may claim fewer lines than the run wrote, never more.

### What it refuses — the two traps that cost the most time

**An absent build refuses rather than skips.** This gate used to print a line and exit `0` when the entry point was not there — a pass over nothing that looked like a real result in CI. It now refuses:

```
eval-quality-gates: dist/cli.js does not exist; the "doc-invocations" section names it under binary.entry, so build it before the gate runs
```

If you run this gate before your own build step, this is the refusal you will see. Build first.

**A spelling that matches nothing scans every page, extracts zero commands, and — without this guard — would report a clean pass.** A typo in `binary.spellings` (`your-tol` instead of `your-tool`) reads every page and finds nothing to run, which is indistinguishable from "every documented command is correct" unless the gate says so itself:

```
eval-quality-gates: no fenced command in 1 page(s) matched any spelling the "doc-invocations" section declares (mytoolx); a gate that extracted nothing reports a pass over nothing
```

If you add this gate and it passes suspiciously fast on your first run, check the scanned count in the output before trusting it.

Other refusals: a `pages` root that encloses the configuration directory (same canonicalized check as `doc-claims`); a `pages` root reaching no markdown at all.

### A clean pass looks like

```
doc-invocations: 32 invocation(s) scanned across 18 page(s), 11 run faithfully over real inputs, 2 with their output compared, 0 failure(s)
```

Read the scanned count. Zero scanned with zero failures is the vacuous pass above, not a real result.

## What `eval-quality` learned moving its own derivations into module files

`eval-quality` names its own `doc-counts` and `doc-claims` numbers through two small files, `scripts/doc-count-sources.ts` and `scripts/doc-claim-sources.ts` — plain modules with no dependency on the gate machinery itself, computing values and exporting them. Worth copying the shape rather than the content:

- **A guard that throws at module load, not at gate-run time, catches a drift the gate itself cannot see.** Both files run a handful of consistency checks at their own top level — e.g. that a generated corpus manifest agrees with the fixture array that built it — and `throw` rather than returning a wrong number. A `module-value` read that throws on import is reported by the gate as a refusal naming the module, so a silent wrong answer never reaches the page comparison.
- **A list read with the default `take` is the first mistake every consumer makes once.** Write `"take": "length"` explicitly for anything that is a list; the schema does not infer it from the value's runtime shape, because the module has not run yet when the configuration is validated.
- **When generalizing a class from a closed vocabulary you control into a parameter a consumer controls, run the old and new logic side by side over the same tree and diff the counts before trusting the new one.** The `vocabulary` class here was generalized from a hard-coded interface-kind check, and the generalization silently dropped one multi-word verb from the default list; nothing failed, because the class still classified *something* — it just classified two fewer sentences than before. A parity comparison of report-line counts is what caught it, not a test. If you are moving an existing hand-rolled doc check onto these gates, keep the old script around long enough to diff against.
- **A `matches` source is the least-exercised of the four kinds** — most real repositories reach for `module` and `json`. If you use `matches` with `distinct: true`, write a fixture with more than one occurrence per name before trusting the count; the distinct-count path has less real-world mileage than the others.
