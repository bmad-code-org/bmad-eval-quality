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

- Review the two follow-up hardening items recorded for later.
  [`deferred-work.md:1`](deferred-work.md#L1)
