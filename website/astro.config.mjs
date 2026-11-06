// @ts-check

import sitemap from '@astrojs/sitemap'
import starlight from '@astrojs/starlight'
import { defineConfig, passthroughImageService } from 'astro/config'
import { getSiteUrl } from './src/lib/site-url.mjs'
import rehypeBasePaths from './src/rehype-base-paths.js'
import rehypeMarkdownLinks from './src/rehype-markdown-links.js'

const siteUrl = getSiteUrl()
const urlParts = new URL(siteUrl)
const basePath =
	urlParts.pathname === '/'
		? '/'
		: urlParts.pathname.endsWith('/')
			? urlParts.pathname
			: `${urlParts.pathname}/`

export default defineConfig({
	site: `${urlParts.origin}${basePath}`,
	base: basePath,
	outDir: '../build/site',

	// The default image service is sharp, whose @img/sharp-libvips-* binaries are
	// LGPL-3.0-or-later and fall outside AD-25's allowlist. No page uses
	// astro:assets, so the passthrough service costs nothing here.
	image: { service: passthroughImageService() },

	vite: {
		optimizeDeps: {
			force: true,
		},
		server: {
			watch: {
				usePolling: false,
			},
		},
	},

	markdown: {
		rehypePlugins: [
			[rehypeMarkdownLinks, { base: basePath }],
			[rehypeBasePaths, { base: basePath }],
		],
	},

	integrations: [
		sitemap({
			filter: (page) => !/\/404(\/|$)/.test(new URL(page).pathname),
		}),
		starlight({
			title: 'eval-quality',
			favicon: '/favicon.svg',
			tagline:
				'Compile disciplined Behavioral Evaluation Contracts and score their ability to catch known defects.',
			defaultLocale: 'root',
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/bmad-code-org/bmad-eval-quality',
				},
			],
			lastUpdated: true,
			head: [
				{
					tag: 'link',
					attrs: { rel: 'icon', href: `${basePath}favicon.ico`, sizes: 'any' },
				},
				{
					tag: 'link',
					attrs: {
						rel: 'apple-touch-icon',
						href: `${basePath}apple-touch-icon.png`,
					},
				},
				// Serve fonts without adding dependencies outside AD-25's licence allowlist.
				{
					tag: 'link',
					attrs: {
						rel: 'preconnect',
						href: 'https://fonts.googleapis.com',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'preconnect',
						href: 'https://fonts.gstatic.com',
						crossorigin: 'anonymous',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'stylesheet',
						href: 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap',
					},
				},
				{
					tag: 'meta',
					attrs: {
						name: 'ai-terms',
						content: `AI-optimized documentation: ${siteUrl}/llms-full.txt (plain text, complete reference). Index: ${siteUrl}/llms.txt`,
					},
				},
				{
					tag: 'meta',
					attrs: {
						name: 'llms-full',
						content: `${siteUrl}/llms-full.txt`,
					},
				},
				{
					tag: 'meta',
					attrs: {
						name: 'llms',
						content: `${siteUrl}/llms.txt`,
					},
				},
			],
			customCss: ['./src/styles/custom.css'],
			// A first-time reader walks this top to bottom: a short tutorial to get
			// their feet wet, then the ideas, then the long tutorial, then the
			// reference. Explanation sits ahead of the walkthrough because the
			// walkthrough is long and reads better once the twin run is understood.
			sidebar: [
				{
					label: 'Welcome',
					slug: 'index',
				},
				{
					label: 'Tutorial',
					collapsed: false,
					items: [{ autogenerate: { directory: 'tutorials' } }],
				},
				{
					label: 'Explanation',
					collapsed: false,
					items: [{ autogenerate: { directory: 'explanation' } }],
				},
				{
					label: 'Walkthrough',
					collapsed: false,
					items: [
						{
							label: 'The Full Walkthrough',
							slug: 'how-to/author-behavioral-contracts',
						},
						{
							label: 'Evaluate Agent Behavior',
							slug: 'how-to/evaluate-agent-behavior',
						},
						{
							label: 'Evaluate Skill Behavior',
							slug: 'how-to/evaluate-skill-behavior',
						},
						{
							label: 'Evaluate Workflow Behavior',
							slug: 'how-to/evaluate-workflow-behavior',
						},
						{
							label: 'End-to-End AI Feature Behavior',
							slug: 'how-to/evaluate-ai-feature-behavior',
						},
						{
							label: 'Evaluate Tool-Use Behavior',
							slug: 'how-to/evaluate-tool-use-behavior',
						},
					],
				},
				{
					label: 'Repository Governance',
					collapsed: false,
					items: [
						{
							label: 'Repository Governance Gates',
							slug: 'how-to/run-the-gates-on-your-repository',
						},
					],
				},
				{
					label: 'Reference',
					collapsed: false,
					items: [{ autogenerate: { directory: 'reference' } }],
				},
				{
					label: 'BMad Ecosystem',
					items: [
						{ label: 'BMad Method', link: 'https://docs.bmad-method.org/' },
						{
							label: 'Test Architect (TEA)',
							link: 'https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/',
						},
						{
							label: 'BMad Builder',
							link: 'https://bmad-builder-docs.bmad-method.org/',
						},
						{
							label: 'Creative Intelligence Suite',
							link: 'https://cis-docs.bmad-method.org/',
						},
						{
							label: 'Game Dev Studio',
							link: 'https://game-dev-studio-docs.bmad-method.org/',
						},
					],
				},
			],
			credits: false,
			pagination: false,
			disable404Route: true,
			components: {
				Header: './src/components/Header.astro',
				SiteTitle: './src/components/SiteTitle.astro',
				PageTitle: './src/components/PageTitle.astro',
				TwoColumnContent: './src/components/TwoColumnContent.astro',
				MobileMenuFooter: './src/components/MobileMenuFooter.astro',
			},
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
		}),
	],
})
