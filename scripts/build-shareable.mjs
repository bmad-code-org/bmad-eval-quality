#!/usr/bin/env node
/**
 * Renders the planning artifacts to self-contained, print-ready HTML for sharing
 * outside the repo. Regenerate rather than hand-edit: the previous exports were
 * authored by hand and went stale the moment the product direction changed.
 *
 * Usage: npm run build:shareable
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(repoRoot, '_bmad-output', 'shareable')
const css = readFileSync(
	join(repoRoot, 'scripts', 'shareable-template.css'),
	'utf8',
)

const OWNER = 'Murat Ozcan'
const BLOB_BASE = 'https://github.com/muratkeremozcan/eval-quality/blob/main'

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
		out: 'eval-quality-adr-002.html',
		nav: 'ADR-002',
		source:
			'_bmad-output/planning-artifacts/architecture/architecture-eval-quality-2026-07-22/ADR-002-contract-authoring-discipline.md',
		title: 'ADR-002: Contract-and-oracle authoring discipline is the product',
		lede: 'The recorded decision, its consequences, and the build order.',
	},
]

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
 * exported documents become sibling .html links; every other in-repo link becomes an
 * absolute URL, which resolves once the repository is published.
 */
const rewriteLink = (href, sourceDir) => {
	if (/^(https?:|mailto:|#)/.test(href)) return href
	const [path, hash = ''] = href.split('#')
	if (!path) return href
	const repoPath = posix.normalize(posix.join(sourceDir, path))
	const sibling = DOCS.find((doc) => doc.source === repoPath)
	if (sibling) return `${sibling.out}${hash ? `#${hash}` : ''}`
	return `${BLOB_BASE}/${repoPath}${hash ? `#${hash}` : ''}`
}

const buildRenderer = (headings, sourceDir) => {
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
		const href = rewriteLink(token.href, sourceDir)
		const title = token.title ? ` title="${escapeHtml(token.title)}"` : ''
		return `<a href="${escapeHtml(href)}"${title}>${renderer.parser.parseInline(token.tokens)}</a>`
	}
	renderer.table = (token) => {
		const html = marked.Renderer.prototype.table.call(renderer, token)
		return `<div class="table-wrap">${html}</div>`
	}
	return renderer
}

const buildPage = (doc) => {
	const raw = readFileSync(join(repoRoot, doc.source), 'utf8')
	const { data, body } = parseFrontmatter(raw)
	const title = doc.title ?? data.title ?? basename(doc.source)
	const status = doc.status ?? data.status
	const updated = data.updated ?? data.date ?? data.created

	// The h1 is dropped from the body because the hero already carries the title.
	const withoutH1 = body.replace(/^#\s+.*\n+/, '')
	const headings = []
	const sourceDir = posix.dirname(doc.source)
	const content = marked.parse(withoutH1, {
		renderer: buildRenderer(headings, sourceDir),
	})
	const toc = renderTocLinks(headings)

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
  <div class="layout">
    <aside class="sidebar" aria-label="Table of contents">
      <p class="toc-title">On this page</p>
      ${toc}
    </aside>
    <main class="paper">
      <header class="hero">
        <div class="eyebrow">eval-quality · ${escapeHtml(doc.nav)}</div>
        <h1>${escapeHtml(title)}</h1>
        <p class="lede">${escapeHtml(doc.lede)}</p>
        <div class="metadata">
          ${pills}
        </div>
      </header>
      <details class="mobile-toc">
        <summary>On this page</summary>
        <div class="mobile-toc-links">${toc}</div>
      </details>
      <article class="content">${content}</article>
      <footer class="footer">Generated from ${escapeHtml(basename(doc.source))} by scripts/build-shareable.mjs. Self-contained and print-ready. Do not hand-edit; regenerate instead.</footer>
    </main>
  </div>
</body>
</html>
`
}

mkdirSync(outDir, { recursive: true })
for (const doc of DOCS) {
	writeFileSync(join(outDir, doc.out), buildPage(doc), 'utf8')
	console.log(`build-shareable: _bmad-output/shareable/${doc.out}`)
}
console.log(`build-shareable: ${DOCS.length} file(s) written`)
