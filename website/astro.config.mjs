// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import rehypeMarkdownLinks from './src/rehype-markdown-links.js';
import rehypeBasePaths from './src/rehype-base-paths.js';
import { getSiteUrl } from './src/lib/site-url.mjs';

const siteUrl = getSiteUrl();
const urlParts = new URL(siteUrl);
const basePath = urlParts.pathname === '/' ? '/' : urlParts.pathname.endsWith('/') ? urlParts.pathname : urlParts.pathname + '/';

export default defineConfig({
  site: `${urlParts.origin}${basePath}`,
  base: basePath,
  outDir: '../build/site',

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
      tagline: 'Compile disciplined Behavioral Evaluation Contracts and score their ability to catch known defects.',
      defaultLocale: 'root',
      favicon: '/favicon.ico',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/bmad-code-org/bmad-eval-quality' },
      ],
      lastUpdated: true,
      head: [
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
});
