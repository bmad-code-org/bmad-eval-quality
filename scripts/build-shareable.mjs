#!/usr/bin/env node
/**
 * Renders the planning artifacts to self-contained, print-ready HTML for sharing
 * outside the repo. Regenerate rather than hand-edit: the previous exports were
 * authored by hand and went stale the moment the product direction changed.
 *
 * Every in-repo link a rendered page carries resolves inside the export, so a
 * recipient without repository access can follow the evidence, contribution,
 * security, and licence links instead of hitting a GitHub 404. Whatever cannot be
 * rendered (a directory, say) is marked in the page and reported on stdout.
 *
 * Usage: npm run build:shareable, checked by npm run check:shareable
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, posix } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { marked } from 'marked'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(repoRoot, '_bmad-output', 'shareable')
const css = readFileSync(
	join(repoRoot, 'scripts', 'shareable-template.css'),
	'utf8',
)

const OWNER = 'Murat Ozcan'
export const REPO_URL = 'https://github.com/bmad-code-org/bmad-eval-quality'
const BLOB_BASE = `${REPO_URL}/blob/main`

/**
 * The companion set: the documents that carry the argument, and the only ones
 * the top navigation lists. Everything in APPENDIX is reachable from a link in
 * one of these rather than from the nav bar.
 */
const DOCS = [
	{
		out: 'eval-quality-readme.html',
		nav: 'Overview',
		source: 'README.md',
		title: 'eval-quality',
		lede: 'Write agent evals that know how to expose failures, then check whether those evals can actually catch known bugs.',
		status: 'building',
	},
	{
		out: 'eval-quality-product-brief.html',
		nav: 'Product brief',
		source:
			'_bmad-output/planning-artifacts/briefs/brief-eval-quality-2026-07-17/brief.md',
		lede: 'Why contract-authoring discipline is the product, and what the two experiment rounds measured.',
	},
	{
		out: 'eval-quality-prd.html',
		nav: 'PRD',
		source:
			'_bmad-output/planning-artifacts/prds/prd-eval-quality-2026-07-17/prd.md',
		title: 'Product Requirements: eval-quality',
		lede: 'Current requirements VFR-1 through VFR-8, with the original engine proposal retained for traceability.',
	},
	{
		out: 'eval-quality-architecture-spine.html',
		nav: 'Architecture',
		source:
			'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ARCHITECTURE-SPINE.md',
		title: 'Architecture Spine: eval-quality',
		lede: 'Forty invariants that keep independently built units from diverging — and two sections recording what four review rounds proved cannot be settled in prose.',
	},
	{
		out: 'eval-quality-adr-001.html',
		nav: 'ADR-001',
		source:
			'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-22/ADR-001-evaluator-isolation-boundary.md',
		title:
			'ADR-001: An isolated black-box evaluator is the source of advantage',
		lede: 'The superseded isolation-as-differentiator decision, kept so the chain resolves and the discarded alternative stays discarded.',
	},
	{
		out: 'eval-quality-adr-002.html',
		nav: 'ADR-002',
		source:
			'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-22/ADR-002-contract-authoring-discipline.md',
		title: 'ADR-002: Contract-and-oracle authoring discipline is the product',
		lede: 'The recorded decision, its consequences, and the build order.',
	},
	{
		out: 'eval-quality-adr-003.html',
		nav: 'ADR-003',
		source:
			'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ADR-003-measurement-mechanics.md',
		title: 'ADR-003: Contract strength is a vector and a dominance rule',
		lede: 'The measurement mechanics ADR-002 deferred: oracles, dominance, verdicts, corpus rotation, and schemas.',
	},
	{
		out: 'eval-quality-adr-004.html',
		nav: 'ADR-004',
		source:
			'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ADR-004-execution-boundary.md',
		title: 'ADR-004: eval-quality executes nothing',
		lede: 'Why no engine supplies the runner, and where the execution boundary actually falls.',
	},
	{
		out: 'eval-quality-adr-005.html',
		nav: 'ADR-005',
		source:
			'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ADR-005-review-round-corrections.md',
		title: "ADR-005: The evaluator's findings measure detection",
		lede: 'What four independent external reviews changed, and why the spine stopped freezing what it could not yet decide.',
	},
	{
		out: 'eval-quality-adr-006.html',
		nav: 'ADR-006',
		source:
			'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ADR-006-interaction-plan.md',
		title:
			'ADR-006: An oracle addresses observations through a declared interaction plan',
		lede: 'Why the first hand-written contract did not compile, and how to fix it without reintroducing the scripted arm.',
	},
	{
		out: 'eval-quality-adr-007.html',
		nav: 'ADR-007',
		source:
			'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ADR-007-compile-score-split.md',
		title:
			'ADR-007: Compile is a build substrate; score is owed a reference implementation',
		lede: 'Why the catch rate was 1.00 by construction, and why half the architecture stops claiming to be finished. Amended by ADR-008.',
	},
	{
		out: 'eval-quality-adr-008.html',
		nav: 'ADR-008',
		source:
			'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ADR-008-compile-half-owed-to-calibration.md',
		title:
			'ADR-008: The compile half is owed a calibration re-run; no half is epic-ready',
		lede: 'Three reviewers falsified the one sentence the previous split rested on, and the other half stops claiming to be finished too.',
	},
	{
		out: 'eval-quality-adr-009.html',
		nav: 'ADR-009',
		source:
			'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-29/ADR-009-adversarial-gate-corrections.md',
		title:
			"ADR-009: The adversarial gate's determinacy corrections, and the read-back brief joins the owed set",
		lede: 'Seventeen ways two conforming implementations disagreed, one of which scored a perfect catch rate off evidence the system was correct.',
	},
]

/**
 * The appendix set: every remaining in-repo document the companion pages link to.
 * They are rendered so a recipient without access to the private repository can
 * still follow the evidence, contribution, security, and licence links instead of
 * landing on a GitHub 404. They stay out of the top navigation because they are
 * reference material, not part of the reading order.
 */
const APPENDIX = [
	{
		out: 'eval-quality-contributing.html',
		nav: 'Contributing',
		source: 'CONTRIBUTING.md',
		title: 'Contributing to eval-quality',
		lede: 'Repository setup, the quality gates a change has to clear, and how contributions are reviewed.',
	},
	{
		out: 'eval-quality-code-of-conduct.html',
		nav: 'Code of Conduct',
		source: 'CODE_OF_CONDUCT.md',
		title: 'Code of Conduct',
		lede: 'The conduct expected of maintainers, contributors, and users of this project.',
	},
	{
		out: 'eval-quality-security.html',
		nav: 'Security',
		source: 'SECURITY.md',
		title: 'Security Policy',
		lede: 'How to report a vulnerability privately, and what response to expect.',
	},
	{
		out: 'eval-quality-license.html',
		nav: 'Licence',
		source: 'LICENSE',
		title: 'Apache License 2.0',
		lede: 'The full licence text this package is distributed under.',
		plain: true,
	},
	{
		out: 'eval-quality-experiment-decision.html',
		nav: 'Round 1 verdict',
		source: 'experiments/hypothesis-validation/DECISION.md',
		title: 'Experiment decisions: the round 1 verdict',
		lede: 'The binary H0 verdict, gate by gate, and the evaluator-pack decision it left untouched.',
	},
	{
		out: 'eval-quality-experiment-phase-2.html',
		nav: 'Round 2 results',
		source: 'experiments/hypothesis-validation/PHASE2-RESULTS.md',
		title: 'Phase 2 block 1: contract-authoring discipline',
		lede: 'What the second round measured once authoring discipline became the treatment.',
	},
	{
		out: 'eval-quality-experiment-summary.html',
		nav: 'Metric summary',
		source: 'experiments/hypothesis-validation/results/summary.md',
		title: 'H0 results summary',
		lede: 'Quotas, exclusions, deviations, and every preregistered metric from the reduced-scope pass.',
	},
	{
		out: 'eval-quality-experiment-protocol.html',
		nav: 'Protocol',
		source: 'experiments/hypothesis-validation/HYPOTHESIS_VALIDATION_PLAN.md',
		title: 'Hypothesis Validation Plan',
		lede: 'The preregistered protocol both experiment rounds ran under, closed and superseded by ADR-002.',
	},
]

/** Every page the export writes; link rewriting resolves against this set. */
const PAGES = [...DOCS, ...APPENDIX]

const escapeHtml = (value) =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')

/** Strips inline markdown so headings read cleanly in the table of contents. */
const stripInline = (value) =>
	value
		.replace(/`([^`]*)`/g, '$1')
		.replace(/\*\*([^*]*)\*\*/g, '$1')
		.replace(/\*([^*]*)\*/g, '$1')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.trim()

/** Anchors are prefixed when a heading starts with a digit, matching the earlier exports. */
const slugify = (value) => {
	const slug = stripInline(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
	return /^\d/.test(slug) ? `section-${slug}` : slug
}

const parseFrontmatter = (raw) => {
	const match = raw.match(/^---\n([\s\S]*?)\n---\n/)
	if (!match) return { data: {}, body: raw }
	const data = {}
	for (const line of match[1].split('\n')) {
		const pair = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
		if (pair) data[pair[1]] = pair[2].replace(/^["']|["']$/g, '').trim()
	}
	return { data, body: raw.slice(match[0].length) }
}

const renderNav = (activeOut) =>
	DOCS.map((doc) => {
		const active = doc.out === activeOut ? ' active' : ''
		return `<a class="nav-link${active}" href="${doc.out}">${escapeHtml(doc.nav)}</a>`
	}).join('')

const renderTocLinks = (headings) =>
	headings
		.map(
			(h) =>
				`<a class="toc-link depth-${h.depth}" href="#${h.id}">${escapeHtml(h.text)}</a>`,
		)
		.join('')

/**
 * A shared HTML file cannot follow repo-relative markdown paths. Links between the
 * exported documents become sibling .html links; anything the export does not render
 * falls back to an absolute repository URL, which only resolves for a recipient who
 * has access to the repository. Those fallbacks are reported by the caller and marked
 * in the page, so a private-repo 404 is never presented as an ordinary link.
 */
const rewriteLink = (href, sourceDir) => {
	if (/^(https?:|mailto:|#)/.test(href)) return { href, repoOnly: false }
	const [path, hash = ''] = href.split('#')
	if (!path) return { href, repoOnly: false }
	const repoPath = posix.normalize(posix.join(sourceDir, path))
	const suffix = hash ? `#${hash}` : ''
	const sibling = PAGES.find((doc) => doc.source === repoPath)
	if (sibling) return { href: `${sibling.out}${suffix}`, repoOnly: false }
	return { href: `${BLOB_BASE}/${repoPath}${suffix}`, repoOnly: true, repoPath }
}

const buildRenderer = (headings, sourceDir, repoOnlyLinks) => {
	const renderer = new marked.Renderer()
	renderer.heading = ({ tokens, depth }) => {
		const text = marked.parseInline(tokens.map((t) => t.raw).join(''))
		const plain = stripInline(tokens.map((t) => t.raw).join(''))
		// The document title is the h1; only h2/h3 are worth a table-of-contents entry.
		if (depth === 1) return `<h1>${text}</h1>\n`
		const id = slugify(plain)
		// h4 carries the VFR requirements in the PRD, so it earns a table-of-contents entry.
		if (depth <= 4) headings.push({ depth, id, text: plain })
		const anchor = `<a class="heading-anchor" href="#${id}" aria-label="Link to ${escapeHtml(plain)}">#</a>`
		return `<h${depth} id="${id}">${text}${anchor}</h${depth}>\n`
	}
	renderer.link = (token) => {
		const { href, repoOnly, repoPath } = rewriteLink(token.href, sourceDir)
		if (repoOnly) repoOnlyLinks.push(repoPath)
		// The tooltip is the only warning a reader gets before a 404, so it is set
		// here rather than left to the author of the source markdown.
		const title = repoOnly
			? ' title="Requires access to the eval-quality repository"'
			: token.title
				? ` title="${escapeHtml(token.title)}"`
				: ''
		const cls = repoOnly ? ' class="repo-link"' : ''
		return `<a href="${escapeHtml(href)}"${cls}${title}>${renderer.parser.parseInline(token.tokens)}</a>`
	}
	renderer.table = (token) => {
		const html = marked.Renderer.prototype.table.call(renderer, token)
		return `<div class="table-wrap">${html}</div>`
	}
	return renderer
}

const buildPage = (doc, repoOnlyLinks = []) => {
	const raw = readFileSync(join(repoRoot, doc.source), 'utf8')
	const { data, body } = parseFrontmatter(raw)
	const title = doc.title ?? data.title ?? basename(doc.source)
	const status = doc.status ?? data.status
	const updated = data.updated ?? data.date ?? data.created

	// The h1 is dropped from the body because the hero already carries the title.
	const withoutH1 = body.replace(/^#\s+.*\n+/, '')
	const headings = []
	const sourceDir = posix.dirname(doc.source)
	// LICENSE is fixed-width plain text, not markdown: rendering it through marked
	// would reflow the Apache boilerplate into paragraphs and change what the licence
	// looks like. It is emitted verbatim and earns no table of contents.
	const content = doc.plain
		? `<pre class="plain-text"><code>${escapeHtml(raw)}</code></pre>`
		: marked.parse(withoutH1, {
				renderer: buildRenderer(headings, sourceDir, repoOnlyLinks),
			})
	const toc = renderTocLinks(headings)
	const sidebar = toc
		? `<aside class="sidebar" aria-label="Table of contents">
      <p class="toc-title">On this page</p>
      ${toc}
    </aside>
    `
		: ''
	const mobileToc = toc
		? `<details class="mobile-toc">
        <summary>On this page</summary>
        <div class="mobile-toc-links">${toc}</div>
      </details>
      `
		: ''

	const pills = [
		status ? `<span class="pill status">${escapeHtml(status)}</span>` : '',
		updated ? `<span class="pill">Updated ${escapeHtml(updated)}</span>` : '',
		`<span class="pill">Owner: ${OWNER}</span>`,
	]
		.filter(Boolean)
		.join('\n          ')

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(doc.lede)}">
  <link rel="icon" href="data:,">
  <title>${escapeHtml(title)}</title>
  <style>
${css}
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="${DOCS[0].out}"><span class="brand-mark">eval</span>-quality</a>
      <nav class="nav" aria-label="Companion documents">${renderNav(doc.out)}</nav>
    </div>
  </header>
  <div class="layout${toc ? '' : ' no-toc'}">
    ${sidebar}<main class="paper">
      <header class="hero">
        <div class="eyebrow">eval-quality · ${escapeHtml(doc.nav)}</div>
        <h1>${escapeHtml(title)}</h1>
        <p class="lede">${escapeHtml(doc.lede)}</p>
        <div class="metadata">
          ${pills}
        </div>
      </header>
      ${mobileToc}<article class="content">${content}</article>
      <footer class="footer">Generated from ${escapeHtml(basename(doc.source))} by scripts/build-shareable.mjs. Self-contained and print-ready. Do not hand-edit; regenerate instead.</footer>
    </main>
  </div>
</body>
</html>
`
}

/** Absolute path to the directory the export is written to. */
export const SHAREABLE_DIR = outDir

/**
 * Renders every page in memory. `build:shareable` writes the result and
 * `check:shareable` compares it against what is committed, so the writer and the
 * checker can never disagree about what the export is supposed to contain.
 */
export const renderAll = () => {
	const repoOnly = []
	const pages = new Map(PAGES.map((doc) => [doc.out, buildPage(doc, repoOnly)]))
	return { pages, repoOnlyLinks: [...new Set(repoOnly)].sort() }
}

const invokedDirectly =
	process.argv[1] !== undefined &&
	pathToFileURL(process.argv[1]).href === import.meta.url

if (invokedDirectly) {
	const { pages, repoOnlyLinks } = renderAll()
	mkdirSync(outDir, { recursive: true })
	for (const [out, html] of pages) {
		writeFileSync(join(outDir, out), html, 'utf8')
		console.log(`build-shareable: _bmad-output/shareable/${out}`)
	}
	for (const path of repoOnlyLinks) {
		console.log(
			`build-shareable: still needs repository access (marked in the page): ${path}`,
		)
	}
	console.log(`build-shareable: ${pages.size} file(s) written`)
}
