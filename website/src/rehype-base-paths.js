import { visit } from 'unist-util-visit'

export default function rehypeBasePaths(options = {}) {
	const base = options.base || '/'
	const normalizedBase =
		base === '/' ? '/' : base.endsWith('/') ? base : `${base}/`

	function prependBase(node, attr) {
		const value = node.properties?.[attr]
		if (
			typeof value !== 'string' ||
			!value.startsWith('/') ||
			value.startsWith('//')
		) {
			return
		}
		if (normalizedBase !== '/' && !value.startsWith(normalizedBase)) {
			node.properties[attr] = normalizedBase + value.slice(1)
		}
	}

	return (tree) => {
		if (normalizedBase !== '/') {
			visit(tree, 'raw', (node) => {
				node.value = node.value.replace(
					/(?<attr>\b(?:src|href))="(?<path>\/(?!\/)[^"]*)"/g,
					(match, attr, pathValue) => {
						if (pathValue.startsWith(normalizedBase)) return match
						return `${attr}="${normalizedBase}${pathValue.slice(1)}"`
					},
				)
			})
		}

		visit(tree, 'element', (node) => {
			const tag = node.tagName

			if (['img', 'iframe', 'video', 'source', 'audio'].includes(tag)) {
				prependBase(node, 'src')
			}

			if (tag === 'link') {
				prependBase(node, 'href')
			}

			if (tag === 'a' && node.properties?.href) {
				const href = node.properties.href

				if (
					typeof href !== 'string' ||
					!href.startsWith('/') ||
					href.startsWith('//')
				) {
					return
				}

				if (normalizedBase !== '/' && href.startsWith(normalizedBase)) {
					return
				}

				const firstDelimiter = Math.min(
					href.indexOf('?') === -1 ? Infinity : href.indexOf('?'),
					href.indexOf('#') === -1 ? Infinity : href.indexOf('#'),
				)
				const pathPortion =
					firstDelimiter === Infinity ? href : href.substring(0, firstDelimiter)

				if (pathPortion.endsWith('.md')) {
					return
				}

				node.properties.href = normalizedBase + href.slice(1)
			}
		})
	}
}
