import path from 'node:path'
import { visit } from 'unist-util-visit'

export default function rehypeMarkdownLinks(options = {}) {
	const base = options.base || '/'
	const normalizedBase = base === '/' ? '' : base.replace(/\/$/, '')

	return (tree, file) => {
		const currentFilePath = file.path
		if (!currentFilePath) return

		const contentDir = options.contentDir || detectContentDir(currentFilePath)
		if (!contentDir) return

		visit(tree, 'element', (node) => {
			if (node.tagName !== 'a' || typeof node.properties?.href !== 'string') {
				return
			}

			const href = node.properties.href

			if (
				href.includes('://') ||
				href.startsWith('//') ||
				href.startsWith('mailto:') ||
				href.startsWith('tel:')
			) {
				return
			}

			const delimIdx = findFirstDelimiter(href)
			const linkPath = delimIdx === -1 ? href : href.substring(0, delimIdx)
			const suffix = delimIdx === -1 ? '' : href.substring(delimIdx)

			if (!linkPath.endsWith('.md')) return

			let targetPath
			if (linkPath.startsWith('/docs/')) {
				targetPath = path.join(contentDir, linkPath.slice(5))
			} else if (linkPath.startsWith('/')) {
				targetPath = path.join(contentDir, linkPath)
			} else {
				targetPath = path.resolve(path.dirname(currentFilePath), linkPath)
			}

			const relativeToContent = path.relative(contentDir, targetPath)
			if (relativeToContent.startsWith('..')) return

			let urlPath = relativeToContent.replace(/\.md$/, '')

			if (urlPath.endsWith('/index') || urlPath === 'index') {
				urlPath = urlPath.slice(0, -'index'.length)
			}

			const raw = `${normalizedBase}/${urlPath.replace(/\/?$/, '/')}${suffix}`
			node.properties.href = raw.replace(/\/\/+/g, '/')
		})
	}
}

export function findFirstDelimiter(str) {
	const q = str.indexOf('?')
	const h = str.indexOf('#')
	if (q === -1) return h
	if (h === -1) return q
	return Math.min(q, h)
}

export function detectContentDir(filePath) {
	const segments = filePath.split(path.sep)
	for (let i = segments.length - 1; i >= 2; i--) {
		if (
			segments[i - 2] === 'src' &&
			segments[i - 1] === 'content' &&
			segments[i] === 'docs'
		) {
			return segments.slice(0, i + 1).join(path.sep)
		}
	}
	for (let i = segments.length - 1; i >= 0; i--) {
		if (segments[i] === 'docs') {
			return segments.slice(0, i + 1).join(path.sep)
		}
	}
	return null
}
