#!/usr/bin/env python3
"""Independent derivation of the canonicalization golden vectors.

This script is documentation and a verification tool, not package code (AD-1
does not bind it). It implements RFC 8785 (JCS) canonicalization independently
of `src/core/` — including the two rules implementers get wrong, ECMAScript
Number::toString rendering and UTF-16 code-unit key sorting — so every
`expectedCanonicalText`, `expectedCanonicalHex`, and `expectedDigest` value in
the fixture files is derived from a second implementation, never from the
TypeScript code under test. Plain `json.dumps(sort_keys=True)` is NOT
JCS-conformant (Python sorts by code point and renders 1e-07 style exponents),
which is why both rules are implemented by hand below.

`--check` also verifies every negative and byte-reject vector is rejected by
this second implementation, so the rejection contract is not certified solely
by the TypeScript code under test. (The fault *code* mapping is TypeScript's to
prove; this script proves the input is rejected at all.)

Why trusting repr() is sound: since CPython 3.1, repr() of a float returns the
shortest decimal string that round-trips to the same binary64 value (David
Gay / Grisu-style, documented in the CPython 3.1 release notes), and ECMA-262
Number::toString(x, 10) specifies exactly the same shortest-round-trip digits
(ECMA-262 §6.1.6.1.20, the k/s/n decomposition). Two shortest-round-trip
representations of the same binary64 value carry identical digits by
definition — only the exponent/point formatting differs, which es_number()
reformats per ECMA-262. `--check` additionally re-verifies every frozen vector,
so a divergence would surface as a mismatch, not stay hidden.

Usage:
    python3 derive_vectors.py --check   # verify frozen fixtures match this derivation
    python3 derive_vectors.py --fill    # rewrite expected fields (authoring time only)

Regenerating expected values from `src/core` output is forbidden: that would
turn the golden vectors into snapshot tests that only prove the implementation
agrees with itself.
"""

import argparse
import hashlib
import json
import math
import sys
from decimal import Decimal
from pathlib import Path

FIXTURES = Path(__file__).parent

# Frozen protocol tags (must match src/core/canonical/digest.ts and the README).
COMPOSITE_PROTOCOL_TAG = 'eval-quality/composite/v1'
DIRECTORY_PROTOCOL_TAG = 'eval-quality/directory/v1'

SAFE_INTEGER_MAX = 2**53 - 1


def es_number(value):
    """ECMA-262 Number::toString(x, 10) over shortest round-trip digits.

    Python's repr() already yields the shortest round-trip decimal digits for a
    binary64 value (the same digits ECMAScript produces); only the formatting
    differs (Python: 1e-07 and a 1e16 exponent threshold; ECMAScript: 1e-7 and
    thresholds at 1e21 / 1e-6). This reformats those digits per ECMA-262.
    """
    if isinstance(value, bool):
        raise TypeError('booleans are not numbers')
    if isinstance(value, int):
        if abs(value) > SAFE_INTEGER_MAX:
            raise ValueError(f'integer outside the safe range: {value}')
        return str(value)
    if not math.isfinite(value):
        raise ValueError(f'non-finite number: {value}')
    if value == 0.0:
        return '0'  # covers -0.0: JCS renders negative zero as 0
    if value == int(value) and abs(value) > SAFE_INTEGER_MAX:
        raise ValueError(f'unsafe integer-valued binary64: {value}')
    sign = '-' if value < 0 else ''
    tup = Decimal(repr(abs(value))).as_tuple()
    digits = ''.join(map(str, tup.digits))
    stripped = digits.rstrip('0') or '0'
    exponent = tup.exponent + (len(digits) - len(stripped))
    s, k = stripped, len(stripped)
    n = exponent + k  # value = 0.s * 10^n in ECMA-262 terms
    if k <= n <= 21:
        rendered = s + '0' * (n - k)
    elif 0 < n <= 21:
        rendered = s[:n] + '.' + s[n:]
    elif -6 < n <= 0:
        rendered = '0.' + '0' * (-n) + s
    else:
        e = n - 1
        mantissa = s if k == 1 else s[0] + '.' + s[1:]
        rendered = f'{mantissa}e{"+" if e >= 0 else "-"}{abs(e)}'
    return sign + rendered


def es_string(value):
    """JSON.stringify string escaping: identical to json.dumps without ASCII folding."""
    if any(0xD800 <= ord(ch) <= 0xDFFF for ch in value):
        raise ValueError('lone surrogate in string')
    return json.dumps(value, ensure_ascii=False)


def utf16_key(text):
    """Sort key reproducing UTF-16 code-unit order (what plain < does in JS)."""
    return text.encode('utf-16-be', 'surrogatepass')


def jcs(value):
    if value is None:
        return 'null'
    if value is True:
        return 'true'
    if value is False:
        return 'false'
    if isinstance(value, str):
        return es_string(value)
    if isinstance(value, (int, float)):
        return es_number(value)
    if isinstance(value, list):
        return '[' + ','.join(jcs(item) for item in value) + ']'
    if isinstance(value, dict):
        pairs = (
            es_string(key) + ':' + jcs(value[key])
            for key in sorted(value.keys(), key=utf16_key)
        )
        return '{' + ','.join(pairs) + '}'
    raise TypeError(f'{type(value)} is not a hashed-artifact value')


def digest_of_bytes(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def derive_from_value(value):
    canonical = jcs(value)
    encoded = canonical.encode('utf-8')
    return {
        'expectedCanonicalText': canonical,
        'expectedCanonicalHex': encoded.hex(),
        'expectedDigest': digest_of_bytes(encoded),
    }


def load(name):
    return json.loads((FIXTURES / name).read_text(encoding='utf-8'))


def save(name, data):
    # ensure_ascii keeps fixtures pure ASCII on disk: a literal precomposed
    # character (e.g. U+FB33) would silently change under any NFC-normalizing
    # tool, corrupting the frozen contract.
    text = json.dumps(data, indent='\t', ensure_ascii=True) + '\n'
    (FIXTURES / name).write_text(text, encoding='utf-8')


class Rejected(Exception):
    pass


def _walk_strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from _walk_strings(item)
    elif isinstance(value, dict):
        for key, item in value.items():
            yield key
            yield from _walk_strings(item)


def python_rejects(raw_text):
    """Independent rejection check over a raw JSON document.

    Mirrors the value-domain rules with Python's own machinery: duplicate keys
    via object_pairs_hook, unsafe integers on the digits, non-finite and
    integer-valued-unsafe floats, lone surrogates after unescaping, and
    malformed syntax. Returns True when this implementation rejects the input.
    """

    def pairs_hook(pairs):
        keys = [key for key, _ in pairs]
        if len(keys) != len(set(keys)):
            raise Rejected('duplicate object key')
        return dict(pairs)

    def check_int(literal):
        value = int(literal)
        if abs(value) > SAFE_INTEGER_MAX:
            raise Rejected(f'unsafe integer literal: {literal}')
        return value

    def check_float(literal):
        value = float(literal)
        if not math.isfinite(value):
            raise Rejected(f'non-finite literal: {literal}')
        if value == int(value) and abs(value) > SAFE_INTEGER_MAX:
            raise Rejected(f'unsafe integer-valued literal: {literal}')
        return value

    try:
        document = json.loads(
            raw_text,
            object_pairs_hook=pairs_hook,
            parse_int=check_int,
            parse_float=check_float,
            parse_constant=lambda name: (_ for _ in ()).throw(Rejected(name)),
        )
    except (Rejected, ValueError):
        return True
    for text in _walk_strings(document):
        if any(0xD800 <= ord(ch) <= 0xDFFF for ch in text):
            return True
    return False


def python_rejects_bytes(data):
    """Byte-level counterpart: fatal UTF-8 decode, then the text-level check."""
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        return True
    return python_rejects(text)


def derive_all():
    """Yield (file, vector, derived-expected-fields) triples for every golden vector."""
    for vector in load('positive-vectors.json'):
        yield 'positive-vectors.json', vector, derive_from_value(json.loads(vector['rawText']))
    byte_vectors = load('byte-vectors.json')
    for vector in byte_vectors['digest']:
        yield (
            'byte-vectors.json',
            vector,
            {'expectedDigest': digest_of_bytes(bytes.fromhex(vector['inputHex']))},
        )
    composite_vectors = load('composite-vectors.json')
    for vector in composite_vectors['composite']:
        tagged = {'protocol': COMPOSITE_PROTOCOL_TAG, **vector['fields']}
        yield 'composite-vectors.json', vector, derive_from_value(tagged)
    for vector in composite_vectors['directory']:
        tagged = {'protocol': DIRECTORY_PROTOCOL_TAG, 'members': vector['members']}
        yield 'composite-vectors.json', vector, derive_from_value(tagged)


def check():
    failures = 0
    for file_name, vector, derived in derive_all():
        for field, expected in derived.items():
            frozen = vector.get(field)
            if frozen != expected:
                failures += 1
                print(f'MISMATCH {file_name} :: {vector["name"]} :: {field}')
                print(f'  frozen:  {frozen!r}')
                print(f'  derived: {expected!r}')
    for vector in load('negative-vectors.json'):
        if not python_rejects(vector['rawText']):
            failures += 1
            print(f'NOT REJECTED negative-vectors.json :: {vector["name"]}')
    for vector in load('byte-vectors.json')['reject']:
        if not python_rejects_bytes(bytes.fromhex(vector['inputHex'])):
            failures += 1
            print(f'NOT REJECTED byte-vectors.json :: {vector["name"]}')
    if failures:
        print(f'{failures} mismatch(es)')
        return 1
    print(
        'all frozen expected values match the independent derivation; '
        'all negative and byte-reject vectors are rejected independently'
    )
    return 0


def fill():
    files = {
        'positive-vectors.json': load('positive-vectors.json'),
        'byte-vectors.json': load('byte-vectors.json'),
        'composite-vectors.json': load('composite-vectors.json'),
    }

    def rederive(file_name, vectors, derive):
        for vector in vectors:
            vector.update(derive(vector))

    rederive(
        'positive-vectors.json',
        files['positive-vectors.json'],
        lambda v: derive_from_value(json.loads(v['rawText'])),
    )
    rederive(
        'byte-vectors.json',
        files['byte-vectors.json']['digest'],
        lambda v: {'expectedDigest': digest_of_bytes(bytes.fromhex(v['inputHex']))},
    )
    rederive(
        'composite-vectors.json',
        files['composite-vectors.json']['composite'],
        lambda v: derive_from_value({'protocol': COMPOSITE_PROTOCOL_TAG, **v['fields']}),
    )
    rederive(
        'composite-vectors.json',
        files['composite-vectors.json']['directory'],
        lambda v: derive_from_value({'protocol': DIRECTORY_PROTOCOL_TAG, 'members': v['members']}),
    )
    for name, data in files.items():
        save(name, data)
    print('expected fields rewritten from the independent derivation')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--fill', action='store_true')
    args = parser.parse_args()
    if args.fill:
        fill()
        return 0
    return check()


if __name__ == '__main__':
    sys.exit(main())
