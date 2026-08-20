---
title: 'Condense and rebuild the README'
type: 'chore'
created: '2026-07-29'
status: 'done'
route: 'one-shot'
---

# Condense and rebuild the README

## Intent

**Problem:** The README repeated experiment methodology and architectural rationale already preserved in deeper artifacts, obscuring the product’s front-door explanation.

**Approach:** Preserve the essential evidence, scoring controls, audience test, and BMad boundary in compact form. Link to the brief, PRD, ADR, and experiment record, then rebuild and inspect the shareable HTML.

## Suggested Review Order

**README structure**

- Start with the explicit audience test and its three scannable conditions.
  [`README.md:56`](../../README.md#L56)

- Review the compact scoring controls retained from the removed methodology sections.
  [`README.md:85`](../../README.md#L85)

- Confirm the BMad boundary and concise evaluator-isolation statement.
  [`README.md:116`](../../README.md#L116)

- Check the shortened evidence claim, limitations, verdicts, and deep links.
  [`README.md:130`](../../README.md#L130)

**Shareable output**

- Verify generated repository links use the BMad organization.
  [`build-shareable.mjs:23`](../../scripts/build-shareable.mjs#L23)

- Confirm self-contained pages avoid a missing-favicon browser error.
  [`build-shareable.mjs:179`](../../scripts/build-shareable.mjs#L179)

- Inspect the rebuilt audience and evidence sections in the generated artifact.
  [`eval-quality-readme.html:568`](../shareable/eval-quality-readme.html#L568)

**Repository migration**

- Check npm metadata now targets the canonical repository.
  [`package.json:36`](../../package.json#L36)

- Confirm contributor setup clones from the BMad organization.
  [`CONTRIBUTING.md:15`](../../CONTRIBUTING.md#L15)

- Both follow-up hardening items are now done; see the record below.
  [`build-shareable.mjs:1`](../../scripts/build-shareable.mjs#L1)

## Follow-up hardening, closed 2026-08-20

Two items were deferred when this spec shipped and are now complete.

**Shareable links resolve without repository access.** The export used to render four companion
documents and rewrite every other in-repo link to a `blob/main` URL, which is a 404 for anyone
without access to the private repository. `scripts/build-shareable.mjs` now renders a second
appendix set alongside the companions: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`,
`LICENSE`, and the four experiment records the README cites as evidence. Appendix pages stay out
of the top navigation because they are reference material rather than part of the reading order.
`LICENSE` is emitted verbatim inside a `pre` block: running fixed-width licence text through the
markdown renderer would reflow the Apache boilerplate into paragraphs. Pages with no headings drop
the empty table-of-contents column through a `no-toc` layout class.

One link cannot be rendered: the README points at the `reviews/` directory, and a directory has no
page. Rendering its twenty-three triage documents was rejected as roughly 600 KB of internal
review material with no audience outside the repository. Instead, any link the export cannot
resolve is marked in the page with a `repo-link` class and a "Requires access to the eval-quality
repository" tooltip, and both the builder and the checker print it, so the set stays visible rather
than growing silently. The README's `reviews/` link was also wrapped in backticks, so it rendered
as literal markdown source rather than as a link; that is fixed.

**The export is now checked.** `scripts/check-shareable.mjs` (`npm run check:shareable`, wired into
`npm run validate` and into CI) asserts three things: every page the builder produces is committed
byte for byte, nothing else lives in the directory, and every eval-quality repository URL in the
export is the canonical one. The canonical URL is derived from `package.json` rather than restated,
so a future migration cannot leave the builder behind. The legacy-URL rule matches on the
repository name rather than on a list of past owners, so it survives that migration too. Following
the convention the other gates in this repository set, a `canary-shareable` CI job proves the check
blocks on a stale page and on a legacy URL, for the stated reason, and that regeneration is a fixed
point.
