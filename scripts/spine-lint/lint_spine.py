#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# ///
"""lint-spine — the mechanical half of spine decision-integrity, done deterministically.

LLMs miscount IDs and miss literal placeholders; a grep does not. This linter owns the
checks a script does better than a prompt, and leaves the semantic half (is each Rule
actually enforceable? does the boundary make sense?) to the rubric walker.

It reads ARCHITECTURE-SPINE.md from a workspace and reports, as compact JSON on stdout:

  - placeholder    literal TBD / TODO / "similar to AD-n" / unfilled {template-token}
  - ad_id          duplicate or non-monotonic AD-n identifiers
  - ad_fields      an AD-n block missing Binds / Prevents / Rule
  - version_pin    a ## Stack table row with no version
  - code_citation  an AD commands a compile-time prohibition without citing a registry code
  - declaration_citation  an AD cites a field it says another AD declares, and that AD does not
  - artifact_path  an AD cites a repository artifact path that does not resolve on disk

The last three are opt-in via --registry-ad / --workspace-root because they read one AD as a
code registry and the filesystem as ground truth; a spine without a registry AD skips them
rather than reporting a document-wide failure.

Fenced code blocks are blanked (replaced with equal-count blank lines) before scanning, so
mermaid and source trees don't trip false positives AND reported line numbers still line up
with the real file. Reported lines are absolute file lines (frontmatter offset added). Exit
code is always 0 — findings travel in the JSON; the caller (Reviewer Gate / rubric walker)
decides what to do with them.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

SPINE = "ARCHITECTURE-SPINE.md"

AD_HEADING = re.compile(r"^#{2,4}\s*AD-(\d+)\b(.*)$", re.MULTILINE)
HEADING = re.compile(r"^#{1,6}\s", re.MULTILINE)
FENCE = re.compile(r"```.*?```", re.DOTALL)
INLINE_CODE = re.compile(r"`[^`\n]+`")
PLACEHOLDER_WORD = re.compile(r"\b(TBD|TODO|FIXME|XXX)\b")
SIMILAR_TO = re.compile(r"similar to AD-\d+", re.IGNORECASE)
TEMPLATE_TOKEN = re.compile(r"\{[a-z_][a-z0-9_ /.-]*\}")

# --- cross-reference integrity ------------------------------------------------------------
# A sentence asserting that something fails at compile time must name the registry code it
# fails under. Three rounds of review on the eval-quality spine found twelve sites stating a
# prohibition in prose with no code, which leaves the check enforceable by one implementer and
# invisible to another.
# The trigger is the *consequence* shape, not any mention of compilation: a sentence saying
# what fails needs a code, while a sentence reasoning about the vocabulary ("a compile-time
# failure is a structural error") does not and must not be flagged.
COMPILE_TRIGGER = re.compile(
    r"fail(?:s|ing|ed)?\s+compilation"
    r"|blocks?\s+compilation"
    r"|(?:is|are|stays?|remains?|becomes?)\s+a\s+compile-time\s+failure"
    r"|(?:reject(?:s|ed|ing)?|prohibit(?:s|ed|ing)?|refus(?:es|ed|ing)?)\s+at\s+compile\s+time",
    re.IGNORECASE,
)
BACKTICKED = re.compile(r"`([^`\n]+)`")
BOLDED = re.compile(r"\*\*([^*\n]+)\*\*")
SENTENCE_SPLIT = re.compile(r"(?<=[.:;!?])\s+(?=[A-Z`*\"(])|(?<=[.!?]\*\*)\s+(?=[A-Z`\"(])")

# The claim this rule polices is one shape and only one: "<subject> is/are declared ... under
# AD-N", plus a marked-up term inside a sentence saying AD-N requires or declares something.
# "per AD-27", "under AD-26's rule", "the way AD-18 forbids" are citations for a different
# purpose and stay out of scope — widening the shape turned every operator name in a
# cross-reference into a false positive, and reading whole sentences as candidate field names
# produced a hundred findings that were all prose.
DECLARES_AD = re.compile(
    r"AD-(\d+)\s+(?:now\s+|already\s+)?(?:requires|declares|enumerates)"
    r"|declared\s+(?:[a-z-]+\s+){0,4}(?:under|per|by|in)\s+AD-(\d+)",
    re.IGNORECASE,
)
# The subject of a declaration claim: everything from the start of its clause up to the verb.
DECLARED_SUBJECT = re.compile(
    r"(?:^|[.;:,]\s|\*\*\s|\band\b\s|\bthat\b\s|\bbecause\b\s)([^.;:,]{3,90}?)"
    r"\s+(?:is|are)\s+declared\s+(?:[a-z-]+\s+){0,4}(?:under|per|by|in)\s+AD-(\d+)",
    re.IGNORECASE,
)
# A field identifier as this document spells one: a single backticked lowerCamelCase or
# hyphenated word. Multi-word phrases, paths, and expressions are excluded because they are
# prose or code samples rather than declared field names.
FIELD_IDENT = re.compile(r"^[a-z][a-zA-Z0-9]*(?:-[a-z][a-zA-Z0-9]*)*$")
SUBJECT_STOPWORDS = frozenset(
    "a an and the its their this that these those each every both either per of for in on to "
    "with under over as is are be been being no not only also".split()
)
SUBJECT_WORD = re.compile(r"[A-Za-z][A-Za-z-]{4,}")
# "the declarations AD-19 requires — interface kind, operation inventory, channel roles, …".
# The enumerated items are the claim, and they carry no markup, so neither the marked-up pass
# nor the declared-subject pass can see them. This is the spelling that carried a citation to a
# channel-roles declaration AD-19 never enumerated through four review rounds.
DECLARED_ENUMERATION = re.compile(
    r"AD-(\d+)\s+(?:now\s+|already\s+)?(?:requires|declares|enumerates)\s*[—–]\s*([^.—–]{10,600})",
    re.IGNORECASE,
)

# A backticked token is treated as a repository path only when it is unambiguously one: it has
# a file extension, or its first segment is a directory that exists at the resolution roots.
# That keeps the designed-but-unbuilt module tree (`core/compile`, `corpus/dev`) out of scope
# while a cited artifact file stays checkable.
PATHISH = re.compile(r"^[A-Za-z_][A-Za-z0-9_.-]*(?:/[A-Za-z0-9_.{}*-]+)+/?$")
PATH_EXT = re.compile(r"\.[A-Za-z0-9]{1,6}$")


def split_frontmatter(text: str) -> tuple[str, str, int]:
    """Return (frontmatter, body, body_line_offset).

    Frontmatter is the content between the first two lines that are *exactly* `---`
    (line-exact, like memlog.split — a `---` inside a value or a body thematic break never
    truncates it). body_line_offset is the number of file lines before the body begins, so a
    body-relative line number plus the offset gives the absolute file line. Absent frontmatter
    → ('', text, 0)."""
    lines = text.split("\n")
    if lines and lines[0] == "---":
        for i in range(1, len(lines)):
            if lines[i] == "---":
                fm = "\n".join(lines[1:i])
                body = "\n".join(lines[i + 1:])
                return fm, body, i + 1
    return "", text, 0


def blank_fences(text: str) -> str:
    """Replace each fenced block with the same number of newlines, so scanning skips fenced
    content while every line number outside the fence stays put."""
    return FENCE.sub(lambda m: "\n" * m.group(0).count("\n"), text)


def blank_inline_code(text: str) -> str:
    """Blank inline `code` spans with equal-length spaces, preserving every line number.

    A brace token inside backticks is a spelled-out syntax literal, not an unfilled template
    slot — `{name}` is how a path template declares a parameter. Scanning template tokens over
    the blanked text is what keeps that from reading as a placeholder."""
    return INLINE_CODE.sub(lambda m: " " * len(m.group(0)), text)


def line_of(text: str, idx: int) -> int:
    return text.count("\n", 0, idx) + 1


def find_placeholders(body: str, offset: int) -> list[dict]:
    findings: list[dict] = []
    scan = blank_fences(body)
    # (regex, label, severity) — TBD/TODO and dangling cross-refs are unambiguous; a bare
    # {template-token} can be legitimate brace prose, so it is flagged low ("possible") to keep
    # the mechanical pass near-zero false-positive rather than train reviewers to ignore it.
    no_code = blank_inline_code(scan)
    for rx, label, severity, target in (
        (PLACEHOLDER_WORD, "placeholder marker", "high", scan),
        (SIMILAR_TO, "unresolved cross-reference", "high", scan),
        (TEMPLATE_TOKEN, "possible unfilled template token (verify)", "low", no_code),
    ):
        for m in rx.finditer(target):
            findings.append({
                "category": "placeholder",
                "severity": severity,
                "detail": f"{label}: {m.group(0)!r}",
                "location": f"{SPINE} (line {offset + line_of(target, m.start())})",
            })
    return findings


def find_frontmatter_placeholders(frontmatter: str) -> list[dict]:
    """Catch unfilled tokens left in frontmatter (e.g. paradigm/scope/date) — part of the
    spine contract, but outside the body that find_placeholders scans."""
    findings: list[dict] = []
    for rx, label, severity in (
        (PLACEHOLDER_WORD, "placeholder marker", "high"),
        (TEMPLATE_TOKEN, "possible unfilled template token (verify)", "low"),
    ):
        for m in rx.finditer(frontmatter):
            findings.append({
                "category": "placeholder",
                "severity": severity,
                "detail": f"frontmatter {label}: {m.group(0)!r}",
                "location": f"{SPINE} frontmatter (line {1 + line_of(frontmatter, m.start())})",
            })
    return findings


def find_ad_issues(body: str, offset: int) -> list[dict]:
    findings: list[dict] = []
    scan = blank_fences(body)  # AD headings shown inside a code fence are not live ADs
    matches = list(AD_HEADING.finditer(scan))
    seen: dict[int, int] = {}
    prev: int | None = None
    for m in matches:
        num = int(m.group(1))
        file_line = offset + line_of(scan, m.start())
        loc = f"{SPINE} AD-{num} (line {file_line})"
        if num in seen:
            findings.append({
                "category": "ad_id",
                "severity": "high",
                "detail": f"AD-{num} id reused (also at line {seen[num]})",
                "location": loc,
            })
        else:
            seen[num] = file_line
        if prev is not None and num <= prev:
            findings.append({
                "category": "ad_id",
                "severity": "high",
                "detail": f"AD-{num} is non-monotonic (follows AD-{prev}); ids must ascend and never renumber",
                "location": loc,
            })
        prev = num if prev is None else max(prev, num)

        # block text = from this heading to the next heading of any level
        start = m.end()
        nxt = HEADING.search(scan, start)
        block = scan[start:nxt.start()] if nxt else scan[start:]
        low = block.lower()
        missing = [f for f in ("binds", "prevents", "rule") if f not in low]
        if missing:
            findings.append({
                "category": "ad_fields",
                "severity": "high",
                "detail": f"AD-{num} missing required field(s): {', '.join(missing)}",
                "location": loc,
            })
    return findings


def find_unpinned_stack(body: str, offset: int) -> list[dict]:
    """Flag a `## Stack` table row that names something but leaves its version blank or a
    placeholder. Pinning lives in the body table now, not frontmatter. A row whose name is
    still a `{token}` skeleton is left to the placeholder pass, not double-reported here.

    Fences are blanked first (like find_placeholders / find_ad_issues), so a pipe-row or
    heading inside a code block is never read as live Stack content. The heading match is
    `## Stack` with a word boundary, so a renamed heading (`## Stack & Versions`) still
    counts. Name and Version columns are located from the header row, so a reordered table
    pairs name to version correctly; both default to the canonical positions (0, 1)."""
    findings: list[dict] = []
    in_stack = False
    header_seen = False
    name_idx, ver_idx = 0, 1
    scan = blank_fences(body)
    for i, raw in enumerate(scan.splitlines()):
        if HEADING.match(raw):
            in_stack = re.match(r"^##\s+Stack\b", raw) is not None
            header_seen = False
            name_idx, ver_idx = 0, 1
            continue
        if not in_stack or not raw.lstrip().startswith("|"):
            continue
        if set(raw.strip()) <= set("|-: "):
            continue  # separator row
        cells = _table_cells(raw)
        if not header_seen:
            header_seen = True
            for j, c in enumerate(cells):
                if c.lower() == "name":
                    name_idx = j
                elif c.lower() == "version":
                    ver_idx = j
            continue
        name = cells[name_idx] if len(cells) > name_idx else ""
        version = cells[ver_idx] if len(cells) > ver_idx else ""
        if not name or TEMPLATE_TOKEN.search(name):
            continue
        if not version or TEMPLATE_TOKEN.search(version):
            findings.append({
                "category": "version_pin",
                "severity": "medium",
                "detail": f"Stack entry {name!r} has no version",
                "location": f"{SPINE} (line {offset + i + 1})",
            })
    return findings


def ad_blocks(body: str, offset: int) -> dict[int, tuple[str, int]]:
    """Map AD number -> (block text, absolute start line). Fences blanked, same as every pass."""
    scan = blank_fences(body)
    matches = list(AD_HEADING.finditer(scan))
    blocks: dict[int, tuple[str, int]] = {}
    for i, m in enumerate(matches):
        start = m.end()
        nxt = HEADING.search(scan, start)
        end = nxt.start() if nxt else len(scan)
        num = int(m.group(1))
        if num not in blocks:  # a reused id is find_ad_issues' finding; keep the first block
            blocks[num] = (scan[start:end], offset + line_of(scan, m.start()))
    return blocks


def registry_codes(block: str) -> set[str]:
    """The set of stable codes a registry AD defines, read from the first column of its table."""
    codes: set[str] = set()
    for raw in block.splitlines():
        if not raw.lstrip().startswith("|"):
            continue
        if set(raw.strip()) <= set("|-: "):
            continue
        cells = _table_cells(raw)
        if not cells:
            continue
        m = BACKTICKED.fullmatch(cells[0])
        if m:
            codes.add(m.group(1))
    return codes


def sentences(block: str) -> list[str]:
    """Split a block into sentences, line by line. Lines come first because this document puts
    each bullet and paragraph on its own line, and a bullet label ends in a colon inside bold
    markup, which no sentence rule splits on — merging them made one AD read as one sentence."""
    out: list[str] = []
    for line in block.splitlines():
        out += [s for s in SENTENCE_SPLIT.split(line) if s.strip()]
    return out


def find_uncoded_prohibitions(body: str, offset: int, registry_ad: int) -> list[dict]:
    """Rule 1 — every compile-time prohibition cites a literal code from the registry AD.

    The registry AD is exempt from its own rule: its prose reasons *about* the requirement
    ("an AD commanding a compile-time check without adding a code here is a defect"), and its
    table rows describe firing conditions rather than commanding them."""
    blocks = ad_blocks(body, offset)
    if registry_ad not in blocks:
        return []
    codes = registry_codes(blocks[registry_ad][0])
    if not codes:
        return []
    findings: list[dict] = []
    for num, (block, line) in sorted(blocks.items()):
        if num == registry_ad:
            continue
        for sent in sentences(block):
            if not COMPILE_TRIGGER.search(sent):
                continue
            if any(t in codes for t in BACKTICKED.findall(sent)):
                continue
            findings.append({
                "category": "code_citation",
                "severity": "high",
                "detail": (
                    f"AD-{num} states a compile-time prohibition citing no AD-{registry_ad} code: "
                    f"{_excerpt(sent)!r}"
                ),
                "location": f"{SPINE} AD-{num} (line {line})",
            })
    return findings


def find_dangling_declaration_citations(body: str, offset: int, registry_ad: int) -> list[dict]:
    """Rule 2 — a field an AD says another AD declares must appear in that AD.

    Scope is only a sentence that claims another AD *declares* something, and the terms checked
    are the ones near that claim. This is the class where AD-40 rested a repair on "method and
    path template are declared per operation under AD-19" while AD-19's list contained neither,
    and where AD-20's rule 7 fired "from declarations AD-19 requires" against no field."""
    blocks = ad_blocks(body, offset)
    codes = registry_codes(blocks[registry_ad][0]) if registry_ad in blocks else set()
    findings: list[dict] = []
    for num, (block, line) in sorted(blocks.items()):
        for sent in sentences(block):
            cited = {int(g) for m in DECLARES_AD.finditer(sent) for g in m.groups() if g}
            cited.discard(num)
            cited &= blocks.keys()
            if not cited:
                continue
            for tok, targets in _declared_terms(sent, codes, cited):
                unresolved = [c for c in targets if not _mentions(blocks[c][0], tok)]
                if unresolved and len(unresolved) == len(targets):
                    findings.append({
                        "category": "declaration_citation",
                        "severity": "high",
                        "detail": (
                            f"AD-{num} names {tok!r} as declared by "
                            + ", ".join(f"AD-{c}" for c in unresolved)
                            + f", which enumerate no such term: {_excerpt(sent)!r}"
                        ),
                        "location": f"{SPINE} AD-{num} (line {line})",
                    })
    return findings


def _declared_terms(sent: str, codes: set[str], cited: set[int]) -> list[tuple[str, list[int]]]:
    """Candidate declared-field names, each paired with the ADs claimed to declare it.

    Two sources, both deliberately narrow: a marked-up field identifier anywhere in a
    declaration-claim sentence, and the content words of the subject of an "X is declared under
    AD-N" clause — the second is what catches a field named in plain prose, which is how the
    claim that AD-19 declared a method and a path template was written."""
    terms: dict[str, list[int]] = {}
    citation_at = [(m.start(), {int(g) for g in m.groups() if g}) for m in DECLARES_AD.finditer(sent)]
    for m in list(BACKTICKED.finditer(sent)) + list(BOLDED.finditer(sent)):
        tok = m.group(1).strip()
        if tok in codes or not FIELD_IDENT.match(tok):
            continue
        # Only a citation near the term is a claim about the term. One rule sentence in this
        # document runs four hundred words and cites six ADs; pairing every marked-up word in
        # it to every one of them is not a finding, it is the sentence being long.
        near = sorted({
            ad
            for pos, ads in citation_at
            if abs(pos - m.start()) <= 120
            for ad in ads
            if ad in cited
        })
        if near:
            terms.setdefault(tok, near)
    for m in DECLARED_SUBJECT.finditer(sent):
        _collect(terms, m.group(1), int(m.group(2)), codes)
    for m in DECLARED_ENUMERATION.finditer(sent):
        target = int(m.group(1))
        # Each comma-delimited item is one claimed declaration; check the items, not the list.
        for item in re.split(r",|\band\b", m.group(2)):
            _collect(terms, item, target, codes)
    return list(terms.items())


def _mentions(block: str, term: str) -> bool:
    """Whether an AD mentions a term, tolerating the plural. One AD writes "each collection
    location" where its reader writes "collection locations", and that is agreement, not a
    dangling citation — the rule is about a term being absent, not about it being inflected."""
    low = block.lower()
    t = term.lower()
    variants = {t, t.rstrip("s"), t + "s"}
    if t.endswith("ies"):
        variants.add(t[:-3] + "y")
    return any(v and v in low for v in variants)


def _collect(terms: dict[str, list[int]], phrase: str, target: int, codes: set[str]) -> None:
    for w in SUBJECT_WORD.findall(re.sub(r"`[^`\n]+`|\*\*|_", " ", phrase)):
        lw = w.lower()
        if lw not in SUBJECT_STOPWORDS and lw not in codes:
            terms[lw] = sorted(set(terms.get(lw, []) + [target]))


def find_unresolved_artifact_paths(body: str, offset: int, roots: list[Path]) -> list[dict]:
    """Rule 3 — a cited repository artifact path resolves on disk.

    Three ADs carried citations to calibration evidence that did not exist through revisions
    that had each passed their own review, because nothing but a reader's memory connected a
    path in prose to a file in the tree. A token counts as a path only when it has a file
    extension or its first segment exists at a resolution root, which leaves the designed
    module tree (`core/compile`) unchecked and every named artifact checked."""
    if not roots:
        return []
    scan = blank_fences(body)
    findings: list[dict] = []
    seen: set[str] = set()
    for m in BACKTICKED.finditer(scan):
        tok = m.group(1).strip()
        if tok in seen or not PATHISH.match(tok):
            continue
        first = tok.split("/", 1)[0]
        checkable = bool(PATH_EXT.search(tok.rstrip("/"))) or any(
            (r / first).is_dir() for r in roots
        )
        if not checkable:
            continue
        seen.add(tok)
        if any((r / tok).exists() for r in roots):
            continue
        findings.append({
            "category": "artifact_path",
            "severity": "high",
            "detail": f"cited artifact path does not resolve at any known root: {tok!r}",
            "location": f"{SPINE} (line {offset + line_of(scan, m.start())})",
        })
    return findings


def _excerpt(sent: str, width: int = 140) -> str:
    s = " ".join(sent.split())
    return s if len(s) <= width else s[: width - 1] + "…"


def _table_cells(row: str) -> list[str]:
    """Split a markdown table row into trimmed cells, dropping the leading/trailing pipe."""
    s = row.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def lint(text: str, registry_ad: int | None = None, roots: list[Path] | None = None) -> dict:
    frontmatter, body, offset = split_frontmatter(text)
    findings: list[dict] = []
    findings += find_frontmatter_placeholders(frontmatter)
    findings += find_placeholders(body, offset)
    findings += find_ad_issues(body, offset)
    findings += find_unpinned_stack(body, offset)
    if registry_ad is not None:
        findings += find_uncoded_prohibitions(body, offset, registry_ad)
        findings += find_dangling_declaration_citations(body, offset, registry_ad)
    findings += find_unresolved_artifact_paths(body, offset, roots or [])
    counts: dict[str, int] = {}
    for f in findings:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1
    return {
        "ok": len(findings) == 0,
        "spine": SPINE,
        "total_findings": len(findings),
        "by_severity": counts,
        "findings": findings,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Lint an architecture spine for mechanical integrity.")
    ap.add_argument("--workspace", required=True, help="run folder containing ARCHITECTURE-SPINE.md")
    ap.add_argument("-o", "--output", help="write JSON here instead of stdout")
    ap.add_argument(
        "--registry-ad", type=int,
        help="AD number whose table is the compile-time failure-code registry; enables the "
             "code-citation and declaration-citation passes",
    )
    ap.add_argument(
        "--workspace-root", action="append", default=None,
        help="repeatable root a cited artifact path may resolve against; the workspace folder "
             "is always a root. Enables the artifact-path pass",
    )
    ap.add_argument(
        "--fail-on", choices=["never", "high", "any"], default="never",
        help="exit non-zero when findings of this severity exist (default never, the historical "
             "always-zero contract)",
    )
    args = ap.parse_args(argv)

    spine_path = Path(args.workspace) / SPINE
    roots = [Path(args.workspace)] + [Path(r) for r in (args.workspace_root or [])]
    if not spine_path.exists():
        result = {"ok": False, "error": f"{spine_path} not found", "findings": [], "total_findings": 0}
    else:
        try:
            text = spine_path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as e:
            # honor the "exit code is always 0" contract: a read/decode failure travels in JSON
            result = {"ok": False, "error": f"could not read {spine_path}: {e}", "findings": [], "total_findings": 0}
        else:
            result = lint(text, registry_ad=args.registry_ad, roots=roots)

    out = json.dumps(result, indent=2)
    if args.output:
        Path(args.output).write_text(out + "\n", encoding="utf-8")
    else:
        print(out)

    if args.fail_on == "never":
        return 0
    if args.fail_on == "any":
        return 0 if result.get("ok") else 1
    return 1 if result.get("by_severity", {}).get("high") or result.get("error") else 0


if __name__ == "__main__":
    sys.exit(main())
