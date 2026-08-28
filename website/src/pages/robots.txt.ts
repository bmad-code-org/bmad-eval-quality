import type { APIRoute } from 'astro'
import { getSiteUrl } from '../lib/site-url.mjs'

export const GET: APIRoute = () => {
	const siteUrl = getSiteUrl()
	const robotsTxt = `
User-agent: *
Allow: /

# LLM Crawler Access
User-agent: GPTBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Google-Extended
Allow: /

# AI Context Files
Sitemap: ${siteUrl}/sitemap-index.xml
# LLM Full Documentation: ${siteUrl}/llms-full.txt
# LLM Index: ${siteUrl}/llms.txt
`.trim()

	return new Response(robotsTxt, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	})
}
