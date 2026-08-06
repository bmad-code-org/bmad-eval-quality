# /// script
# requires-python = ">=3.10"
# dependencies = ["pytest>=8.0"]
# ///
"""Tests for lint_spine.py. Run: uv run --with pytest pytest scripts/tests/test_lint_spine.py

The spine under test: a clean spine lints empty; the linter catches exactly the
mechanical defects a prompt is unreliable at — literal placeholders, AD-n id breakage,
AD-n blocks missing required fields, and unpinned Stack versions.
"""
import importlib.util
import json
import re
import sys
from pathlib import Path

import pytest

_SPEC = importlib.util.spec_from_file_location(
    "lint_spine", Path(__file__).resolve().parent.parent / "lint_spine.py"
)
lint_spine = importlib.util.module_from_spec(_SPEC)
sys.modules["lint_spine"] = lint_spine
_SPEC.loader.exec_module(lint_spine)


CLEAN = """---
name: 'Demo'
---

## Invariants & Rules

### AD-1 — single write path

- **Binds:** all
- **Prevents:** divergent mutation
- **Rule:** state changes only through the command bus

### AD-2 — layered deps `[ADOPTED]`

- **Binds:** all
- **Prevents:** import cycles
- **Rule:** ui -> app -> domain, never backward

```mermaid
flowchart LR
  A --> B{decision}
```

## Stack

| Name | Version |
| --- | --- |
| fastapi | 0.115 |
| pydantic | 2.9 |
"""


def cats(result):
    return sorted(f["category"] for f in result["findings"])


def test_clean_spine_passes():
    result = lint_spine.lint(CLEAN)
    assert result["ok"] is True
    assert result["total_findings"] == 0


def test_mermaid_braces_not_flagged():
    # the {decision} node lives in a fenced block and must not read as a template token
    result = lint_spine.lint(CLEAN)
    assert "placeholder" not in cats(result)


def test_placeholder_markers_caught():
    text = CLEAN.replace("the command bus", "TBD")
    result = lint_spine.lint(text)
    assert "placeholder" in cats(result)


def test_similar_to_caught():
    text = CLEAN.replace("import cycles", "similar to AD-1")
    result = lint_spine.lint(text)
    assert any("cross-reference" in f["detail"] for f in result["findings"])


def test_unfilled_template_token_caught():
    text = CLEAN.replace("single write path", "{decision}")
    result = lint_spine.lint(text)
    assert any(f["category"] == "placeholder" for f in result["findings"])


def test_duplicate_ad_id_caught():
    text = CLEAN.replace("### AD-2 — layered deps `[ADOPTED]`", "### AD-1 — layered deps")
    result = lint_spine.lint(text)
    assert "ad_id" in cats(result)


def test_non_monotonic_ad_id_caught():
    text = CLEAN.replace("### AD-2 — layered deps `[ADOPTED]`", "### AD-5 — layered deps").replace(
        "### AD-1 — single write path", "### AD-9 — single write path"
    )
    result = lint_spine.lint(text)
    assert any("non-monotonic" in f["detail"] for f in result["findings"])


def test_missing_field_caught():
    text = CLEAN.replace("- **Rule:** state changes only through the command bus\n", "")
    result = lint_spine.lint(text)
    assert any(f["category"] == "ad_fields" and "rule" in f["detail"] for f in result["findings"])


def test_unpinned_dep_caught():
    text = CLEAN.replace("| fastapi | 0.115 |", "| fastapi |  |")
    result = lint_spine.lint(text)
    assert "version_pin" in cats(result)


def test_placeholder_version_caught():
    text = CLEAN.replace("| fastapi | 0.115 |", "| fastapi | {pin} |")
    result = lint_spine.lint(text)
    assert any(f["category"] == "version_pin" and "fastapi" in f["detail"] for f in result["findings"])


def test_no_stack_section_ok():
    text = CLEAN.split("## Stack")[0]
    result = lint_spine.lint(text)
    assert "version_pin" not in cats(result)


def test_stack_skeleton_row_not_version_pinned():
    # a leftover {token} name is the placeholder pass's job, not a double-reported version_pin
    text = CLEAN.replace("| fastapi | 0.115 |", "| {language / framework} | {pinned version} |")
    result = lint_spine.lint(text)
    assert "version_pin" not in cats(result)


def test_stack_html_comment_not_parsed_as_row():
    text = CLEAN.replace("## Stack\n", "## Stack\n\n<!-- SEED — verified current 2026-06 -->\n")
    result = lint_spine.lint(text)
    assert "version_pin" not in cats(result)


def test_template_token_is_low_severity():
    # a bare {token} can be legitimate brace prose; it is flagged, but low (not high) so the
    # mechanical pass stays near-zero false-positive
    text = CLEAN.replace("single write path", "{decision}")
    result = lint_spine.lint(text)
    toks = [f for f in result["findings"] if f["category"] == "placeholder" and "template token" in f["detail"]]
    assert toks and all(f["severity"] == "low" for f in toks)


def test_no_frontmatter_body_still_scanned():
    text = "## Invariants\n\n### AD-1 — x\n\n- **Binds:** all\n- **Prevents:** drift\n- **Rule:** TBD\n"
    result = lint_spine.lint(text)
    assert "placeholder" in cats(result)  # TBD caught even with no frontmatter


def test_frontmatter_value_with_dashes_not_truncated():
    # a value containing '---' must not be read as the closing fence (line-exact close)
    text = ("---\nname: 'x'\nscope: 'phase 1 --- phase 2'\n---\n\n"
            "## Stack\n\n| Name | Version |\n| --- | --- |\n| fastapi |  |\n")
    result = lint_spine.lint(text)
    assert any(f["category"] == "version_pin" for f in result["findings"])  # read past the inline ---


def test_ad_heading_in_fence_not_counted():
    text = (
        "---\nname: 'x'\n---\n\n"
        "### AD-1 — real\n\n- **Binds:** all\n- **Prevents:** drift\n- **Rule:** do x\n\n"
        "## Docs\n\n```text\n### AD-2 — illustrative only, no fields\n```\n"
    )
    result = lint_spine.lint(text)
    assert result["ok"] is True  # the fenced AD-2 is not a live AD → no ad_fields/ad_id finding


def test_stack_table_flags_only_the_unpinned_row():
    text = ("---\nname: 'x'\n---\n\n## Stack\n\n| Name | Version |\n| --- | --- |\n"
            "| fastapi | 0.115 |\n| redis |  |\n")
    result = lint_spine.lint(text)
    pins = [f for f in result["findings"] if f["category"] == "version_pin"]
    assert len(pins) == 1 and "redis" in pins[0]["detail"]


def test_stack_table_all_pinned_ok():
    text = ("---\nname: 'x'\n---\n\n## Stack\n\n| Name | Version |\n| --- | --- |\n"
            "| fastapi | 0.115 |\n")
    result = lint_spine.lint(text)
    assert "version_pin" not in cats(result)


def test_fenced_stack_rows_not_parsed():
    # an illustrative fenced table under ## Stack must not be read as live rows (fences are
    # blanked first, like every other pass) — a blank-version row inside a fence is not a finding
    text = ("---\nname: 'x'\n---\n\n## Stack\n\n| Name | Version |\n| --- | --- |\n"
            "| fastapi | 0.115 |\n\n```text\n| example |  |\n```\n")
    result = lint_spine.lint(text)
    assert "version_pin" not in cats(result)


def test_fenced_stack_heading_not_live():
    # a `## Stack` heading shown inside a code fence is not the live Stack section
    text = ("---\nname: 'x'\n---\n\n## Docs\n\n```md\n## Stack\n\n| foo |  |\n```\n")
    result = lint_spine.lint(text)
    assert "version_pin" not in cats(result)


def test_renamed_stack_heading_still_scanned():
    # the heading match is word-boundary, so a varied `## Stack` heading still counts
    text = ("---\nname: 'x'\n---\n\n## Stack & Versions\n\n| Name | Version |\n| --- | --- |\n"
            "| redis |  |\n")
    result = lint_spine.lint(text)
    pins = [f for f in result["findings"] if f["category"] == "version_pin"]
    assert len(pins) == 1 and "redis" in pins[0]["detail"]


def test_reordered_columns_pair_name_to_version():
    # Version-then-Name header: the unpinned row must still be flagged by its real name
    text = ("---\nname: 'x'\n---\n\n## Stack\n\n| Version | Name |\n| --- | --- |\n"
            "| 0.115 | fastapi |\n|  | redis |\n")
    result = lint_spine.lint(text)
    pins = [f for f in result["findings"] if f["category"] == "version_pin"]
    assert len(pins) == 1 and "redis" in pins[0]["detail"]


def test_placeholder_line_number_is_absolute():
    # a TBD after a multi-line fence reports its real file line (fence blanked, not collapsed)
    text = (
        "---\nname: 'x'\n---\n\n"
        "## A\n\n"
        "```text\nf1\nf2\nf3\n```\n\n"
        "TBD here\n"
    )
    result = lint_spine.lint(text)
    ph = next(f for f in result["findings"] if "TBD" in f["detail"])
    n = int(re.search(r"line (\d+)", ph["location"]).group(1))
    assert n == 13


def test_missing_spine_file_reports_error(tmp_path, capsys):
    rc = lint_spine.main(["--workspace", str(tmp_path)])
    out = json.loads(capsys.readouterr().out)
    assert rc == 0 and out["ok"] is False and "not found" in out["error"]


def test_frontmatter_unfilled_token_caught():
    # an unfilled {scope}/{paradigm}/{date} in frontmatter is part of the contract and must lint
    text = "---\nname: 'x'\nscope: '{what this spine governs}'\n---\n\n## Invariants\n"
    result = lint_spine.lint(text)
    fm = [f for f in result["findings"] if f["category"] == "placeholder" and "frontmatter" in f["detail"]]
    assert fm and any("template token" in f["detail"] for f in fm)


def test_frontmatter_tbd_caught():
    text = "---\nname: 'x'\nstatus: TBD\n---\n\n## Invariants\n"
    result = lint_spine.lint(text)
    assert any(f["category"] == "placeholder" and "frontmatter" in f["detail"] and "TBD" in f["detail"]
               for f in result["findings"])


# --- cross-reference integrity passes ------------------------------------------------------
# Each of the three is proven both ways: it fires on the defect class that motivated it, and it
# stays quiet on the conforming spelling. A rule that only proves the clean case is a rule that
# might be checking nothing.

REGISTRY = """---
name: 'Demo'
---

## Invariants & Rules

### AD-1 — coded registry

- **Binds:** compiler
- **Prevents:** two compilers inventing incompatible vocabularies
- **Rule:** every compile-time failure has a stable code here.

  | Code | Fires when | Cited by |
  | --- | --- | --- |
  | `unsupported-interface-kind` | a declared interface kind is `web` | AD-2 |
  | `malformed-operator-expression` | wrong arity | AD-2 |

### AD-2 — interfaces

- **Binds:** compiler
- **Prevents:** implementer invention over unsupported kinds
- **Rule:** v0 supports `api` and fails compilation under `unsupported-interface-kind` for `web`.

### AD-3 — declarations

- **Binds:** contract schema
- **Prevents:** a rule reading a field that does not exist
- **Rule:** the contract declares a `pathTemplate` and an operation inventory.

### AD-4 — reader

- **Binds:** scorer
- **Prevents:** a repair resting on a declaration that does not exist
- **Rule:** the path template is declared per operation under AD-3, so resolution is mechanical.
"""


def test_registry_spine_is_clean_under_all_three_passes(tmp_path):
    result = lint_spine.lint(REGISTRY, registry_ad=1, roots=[tmp_path])
    assert result["ok"] is True, result["findings"]


def test_uncoded_compile_prohibition_caught():
    text = REGISTRY.replace(
        "fails compilation under `unsupported-interface-kind` for `web`",
        "fails compilation honestly for `web`",
    )
    result = lint_spine.lint(text, registry_ad=1)
    assert any(f["category"] == "code_citation" and "AD-2" in f["detail"] for f in result["findings"])


def test_registry_ad_exempt_from_its_own_code_rule():
    # the registry reasons about the requirement in prose; that is not an uncoded prohibition
    text = REGISTRY.replace(
        "- **Rule:** every compile-time failure has a stable code here.",
        "- **Rule:** an AD that commands a compile-time check without a code here fails compilation.",
    )
    result = lint_spine.lint(text, registry_ad=1)
    assert not [f for f in result["findings"] if f["category"] == "code_citation"]


def test_code_rule_skipped_without_registry_ad():
    text = REGISTRY.replace(
        "fails compilation under `unsupported-interface-kind` for `web`",
        "fails compilation honestly for `web`",
    )
    result = lint_spine.lint(text)  # no registry_ad → pass is off, not silently passing
    assert not [f for f in result["findings"] if f["category"] == "code_citation"]


def test_compile_time_vocabulary_prose_not_flagged():
    # "a compile-time failure is a structural error" reasons about the vocabulary and commands
    # nothing, so it needs no code — the trigger is the consequence shape, not the words
    text = REGISTRY.replace(
        "- **Rule:** the contract declares a `pathTemplate` and an operation inventory.",
        "- **Rule:** a compile-time failure is a structural error that emits no artifact.",
    )
    result = lint_spine.lint(text, registry_ad=1)
    assert not [f for f in result["findings"] if f["category"] == "code_citation"]


def test_declaration_citation_caught_for_plain_prose_field():
    # AD-4 claims AD-3 declares a "state-change marker"; AD-3 enumerates no such thing
    text = REGISTRY.replace(
        "the path template is declared per operation under AD-3",
        "the state-change marker is declared per operation under AD-3",
    )
    result = lint_spine.lint(text, registry_ad=1)
    hits = [f for f in result["findings"] if f["category"] == "declaration_citation"]
    assert hits and "AD-3" in hits[0]["detail"]


def test_declaration_citation_caught_for_backticked_field():
    text = REGISTRY.replace(
        "- **Rule:** the path template is declared per operation under AD-3, so resolution is mechanical.",
        "- **Rule:** AD-3 declares `stateChangeMarker`, which rule 7 reads.",
    )
    result = lint_spine.lint(text, registry_ad=1)
    assert any(
        f["category"] == "declaration_citation" and "stateChangeMarker" in f["detail"]
        for f in result["findings"]
    )


def test_declaration_citation_ignores_non_declaration_citation():
    # "per AD-3" citing a rule rather than a declaration is out of scope by design
    text = REGISTRY.replace(
        "- **Rule:** the path template is declared per operation under AD-3, so resolution is mechanical.",
        "- **Rule:** `deepEquality` is structural over canonical JSON per AD-3, never serialization-based.",
    )
    result = lint_spine.lint(text, registry_ad=1)
    assert not [f for f in result["findings"] if f["category"] == "declaration_citation"]


def test_declaration_citation_ignores_distant_term_in_one_long_sentence():
    # a marked-up term 300 characters from the citation is not a claim about that term
    filler = "and the compiler reads it in order, " * 8
    text = REGISTRY.replace(
        "- **Rule:** the path template is declared per operation under AD-3, so resolution is mechanical.",
        f"- **Rule:** a `farAwayField` is named here, {filler}and the path template is declared "
        "per operation under AD-3.",
    )
    result = lint_spine.lint(text, registry_ad=1)
    assert not [
        f for f in result["findings"]
        if f["category"] == "declaration_citation" and "farAwayField" in f["detail"]
    ]


def test_unresolved_artifact_path_caught(tmp_path):
    text = REGISTRY.replace(
        "- **Rule:** the contract declares a `pathTemplate` and an operation inventory.",
        "- **Rule:** the boundary is calibrated against `corpus-notes/scripted-arm.json`.",
    )
    (tmp_path / "corpus-notes").mkdir()
    result = lint_spine.lint(text, registry_ad=1, roots=[tmp_path])
    assert any(
        f["category"] == "artifact_path" and "scripted-arm.json" in f["detail"]
        for f in result["findings"]
    )


def test_resolved_artifact_path_not_flagged(tmp_path):
    text = REGISTRY.replace(
        "- **Rule:** the contract declares a `pathTemplate` and an operation inventory.",
        "- **Rule:** the boundary is calibrated against `corpus-notes/scripted-arm.json`.",
    )
    (tmp_path / "corpus-notes").mkdir()
    (tmp_path / "corpus-notes" / "scripted-arm.json").write_text("{}")
    result = lint_spine.lint(text, registry_ad=1, roots=[tmp_path])
    assert not [f for f in result["findings"] if f["category"] == "artifact_path"]


def test_designed_module_path_not_treated_as_artifact(tmp_path):
    # `core/compile` names a module the epics will build; it is not a citation to a file on disk
    text = REGISTRY.replace(
        "- **Rule:** the contract declares a `pathTemplate` and an operation inventory.",
        "- **Rule:** compilation lives in `core/compile` and emission in `core/emit`.",
    )
    result = lint_spine.lint(text, registry_ad=1, roots=[tmp_path])
    assert not [f for f in result["findings"] if f["category"] == "artifact_path"]


def test_artifact_path_pass_skipped_without_roots():
    text = REGISTRY.replace(
        "- **Rule:** the contract declares a `pathTemplate` and an operation inventory.",
        "- **Rule:** calibrated against `corpus-notes/scripted-arm.json`.",
    )
    result = lint_spine.lint(text, registry_ad=1)
    assert not [f for f in result["findings"] if f["category"] == "artifact_path"]


def test_path_template_in_backticks_is_not_a_placeholder():
    # `{name}` inside inline code is a declared syntax literal, not an unfilled template slot
    text = CLEAN.replace(
        "- **Rule:** state changes only through the command bus",
        "- **Rule:** a path template spells parameters as `{name}` and nothing else",
    )
    result = lint_spine.lint(text)
    assert result["ok"] is True, result["findings"]


def test_bare_brace_token_outside_backticks_still_flagged():
    text = CLEAN.replace("state changes only through the command bus", "{fill me in}")
    result = lint_spine.lint(text)
    assert any("template token" in f["detail"] for f in result["findings"])


def test_fail_on_high_exits_nonzero(tmp_path, capsys):
    (tmp_path / lint_spine.SPINE).write_text(CLEAN.replace("the command bus", "TBD"))
    rc = lint_spine.main(["--workspace", str(tmp_path), "--fail-on", "high"])
    capsys.readouterr()
    assert rc == 1


def test_fail_on_never_is_the_default(tmp_path, capsys):
    (tmp_path / lint_spine.SPINE).write_text(CLEAN.replace("the command bus", "TBD"))
    rc = lint_spine.main(["--workspace", str(tmp_path)])
    capsys.readouterr()
    assert rc == 0


def test_unreadable_spine_returns_error_not_crash(tmp_path, capsys):
    # a spine that exists but can't be UTF-8 decoded must yield error JSON + exit 0, not a traceback
    (tmp_path / lint_spine.SPINE).write_bytes(b"\xff\xfe bad bytes not utf-8")
    rc = lint_spine.main(["--workspace", str(tmp_path)])
    out = json.loads(capsys.readouterr().out)
    assert rc == 0 and out["ok"] is False and "could not read" in out["error"]


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-q"]))
