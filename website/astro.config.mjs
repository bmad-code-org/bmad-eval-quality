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
				// Inter 400/600, Space Grotesk 700 and JetBrains Mono 400 used to arrive
				// through @fontsource packages, which ship the faces under OFL-1.1 and so
				// fail AD-25's allowlist. Google Fonts serves the same four faces without
				// adding a dependency. custom.css still names the families.
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
						href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=JetBrains+Mono:wght@400&family=Space+Grotesk:wght@700&display=swap',
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
			sidebar: [
				{
					label: 'Welcome',
					slug: 'index',
				},
				{
					label: 'Tutorials',
					collapsed: false,
					items: [{ autogenerate: { directory: 'tutorials' } }],
				},
				{
					label: 'How-To Guides',
					collapsed: true,
					items: [{ autogenerate: { directory: 'how-to' } }],
				},
				{
					label: 'Explanation',
					collapsed: true,
					items: [{ autogenerate: { directory: 'explanation' } }],
				},
				{
					label: 'Reference',
					collapsed: true,
					items: [{ autogenerate: { directory: 'reference' } }],
				},
			],
			credits: false,
			pagination: false,
			disable404Route: true,
			components: {
				Header: './src/components/Header.astro',
				MobileMenuFooter: './src/components/MobileMenuFooter.astro',
			},
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
		}),
	],
})
