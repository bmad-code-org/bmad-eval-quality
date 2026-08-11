# Cross-language canonicalization vectors

These fixtures are the published contract for any implementation of the
eval-quality digest computation, in any language (AD-27, AD-36). A conformant
implementation must reproduce every expected canonical byte sequence and digest
here byte-for-byte. The data is language-neutral JSON; the Vitest suite in
`tests/canonical/vectors.test.ts` enumerates every vector programmatically, but
the fixtures are designed to be consumed without it.

## The two rules implementers get wrong

1. **Numbers** serialize per ECMAScript `Number.prototype.toString`: shortest
   round-trip decimal digits, `-0` rendering as `0`, exponent form exactly where
   ECMAScript produces it (`1e-7`, not `1e-07`; the threshold sits below `1e-6`,
   so `0.000001` stays plain).
2. **Object keys** sort by UTF-16 code unit — never by code point, never
   locale- or normalization-aware. The `key-sort-code-unit-not-code-point`
   vector pins this: the surrogate-pair key `😀` (U+1F600, UTF-16 `D83D DE00`)
   sorts **before** the BMP key `דּ` (U+FB33) because `D83D < FB33`, even though
   `1F600 > FB33` by code point.

## Dead branch: the ≥ 1e21 exponent rendering

ECMAScript renders numbers ≥ 1e21 in exponent form (`1e+21`). That branch is
unreachable for conformant artifacts: every binary64 value ≥ 2^53 is
integer-valued, so the AD-36 safe-integer rule rejects the entire magnitude
range ≥ 2^53 whatever its spelling. Only the small-magnitude exponent branch
(|n| < 1e-6 down to `5e-324`) is reachable. Do not spend time round-tripping a
branch no conformant artifact can exercise.

## Value domain (AD-36)

Hashed artifacts admit only finite IEEE 754 binary64 numbers, with
integer-valued numbers restricted to |n| ≤ 2^53 − 1 **regardless of spelling**
(`9007199254740993`, `9007199254740993.0`, `9.007199254740993e15`, and `1e21`
are all rejected). Larger integers and values needing exact decimal semantics
are carried as strings (declared formats arrive with the schema stories). Lone
surrogates and duplicate object keys (compared after unescaping) are rejected
lexically, before any schema validation: `JSON.parse`-style parsing silently
keeps the last duplicate key and silently rounds `9007199254740993`. Byte input
must be decoded as UTF-8 **fatally**: a non-fatal decode substitutes U+FFFD for
a producer's WTF-8-encoded lone surrogate and digests the corrupted text
cleanly. A leading UTF-8 BOM is content, not framing, and fails JSON syntax.

Fault codes: the four value-domain violations throw
`non-canonicalizable-value`; input that does not parse at all (malformed JSON
syntax, bytes that fail fatal UTF-8 decoding) throws `schema-parse-failure`.

## Digest forms

Every digest is the literal string `sha256:` followed by exactly 64 lowercase
hex characters, over the RFC 8785 canonical UTF-8 bytes.

- **Composite** digests hash a domain-separated tagged object — never a
  concatenation: `{"protocol":"eval-quality/composite/v1", ...named fields}`.
  A field named `protocol` is rejected rather than silently overriding the tag.
- **Directory** digests hash
  `{"protocol":"eval-quality/directory/v1","members":{<path>:<sha256: digest>}}`.
  "Ordered by path" means JCS key order, i.e. UTF-16 **code-unit** order — which
  disagrees with the UTF-8 byte order `git` and `sort` produce for
  supplementary-plane paths; the `directory-code-unit-path-order` vector pins
  the discriminating case (the `😀` path sorts before the `דּ` path).

## Fixture schema

- `positive-vectors.json` — array of vectors. `rawText` is the input document
  as a raw JSON text (escaped into a JSON string field). Each entry in
  `rawTextPermutations` must canonicalize to the identical bytes and digest,
  proving key-order invariance. `expectedCanonicalText` is human-readable;
  `expectedCanonicalHex` is the lowercase hex of the canonical UTF-8 bytes and
  is the field tests compare against (string comparison happens before UTF-8
  encoding and would hide encoding bugs); `expectedDigest` is the digest of
  those bytes.
- `negative-vectors.json` — `rawText` documents that must be rejected, with the
  `expectedFault` code. Raw text is carried as an escaped JSON string because a
  document with duplicate keys cannot itself round-trip through a JSON parser.
- `byte-vectors.json` — byte-level inputs carried as lowercase hex (`inputHex`),
  because a JSON string field cannot hold invalid UTF-8. `reject` entries must
  fail with `expectedFault`; `digest` entries are `digestBytes` goldens over the
  raw bytes.
- `composite-vectors.json` — `composite` entries carry the named `fields` of a
  composite digest; `directory` entries carry `members` as path → digest.
  Expected values are over the full tagged object shown above.

## Expected values are independently derived, then frozen

Every `expectedCanonicalText`, `expectedCanonicalHex`, and `expectedDigest` was
produced by `derive_vectors.py` — a second-language (Python) implementation of
the two JCS rules — and spot-checked by hand with `shasum -a 256`.
**Regenerating expected values from the `src/core` implementation is
forbidden**: a fixture whose expected output was produced by the code under
test is a snapshot test proving the implementation agrees with itself, which is
zero evidence against the cross-implementation divergence these vectors exist
to prevent. To verify the frozen values:

```sh
python3 tests/fixtures/derive_vectors.py --check
```
