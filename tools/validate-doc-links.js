import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DOCS_ROOT = path.resolve(__dirname, '../docs')

const LINK_REGEX =
	/\[([^\]]*)\]\(((?:\.{1,2}\/|\/)[^)]+|[\w][^)\s]*\.md(?:[?#][^)]*)?)\)/g
const STATIC_ASSET_EXTENSIONS = [
	'.zip',
	'.txt',
	'.pdf',
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.svg',
	'.webp',
	'.ico',
]
const HEADING_PATTERN = /^#{1,6}\s+(.+)$/gm

function getMarkdownFiles(dir) {
	const files = []

	function walk(currentDir) {
		const entries = fs.readdirSync(currentDir, { withFileTypes: true })

		for (const entry of entries) {
			const fullPath = path.join(currentDir, entry.name)

			if (entry.name.startsWith('_')) {
				continue
			}

			if (entry.isDirectory()) {
				walk(fullPath)
			} else if (
				entry.isFile() &&
				(entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))
			) {
				files.push(fullPath)
			}
		}
	}

	walk(dir)
	return files
}

function stripCodeBlocks(content) {
	return content.replaceAll(/```[\s\S]*?```/g, '')
}

function headingToAnchor(heading) {
	return heading
		.toLowerCase()
		.replaceAll(/[\u{1F300}-\u{1F9FF}]/gu, '')
		.replaceAll(/[^\w\s-]/g, '')
		.replaceAll(/\s+/g, '-')
		.replaceAll(/-+/g, '-')
		.replaceAll(/^-+|-+$/g, '')
}

function extractAnchors(content) {
	const anchors = new Set()

	HEADING_PATTERN.lastIndex = 0
	for (
		let match = HEADING_PATTERN.exec(content);
		match !== null;
		match = HEADING_PATTERN.exec(content)
	) {
		const headingText = match[1]
			.trim()
			.replaceAll(/`[^`]+`/g, '')
			.replaceAll(/\*\*([^*]+)\*\*/g, '$1')
			.replaceAll(/\*([^*]+)\*/g, '$1')
			.replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1')
			.trim()
		anchors.add(headingToAnchor(headingText))
	}

	return anchors
}

function resolveLink(siteRelativePath, sourceFile) {
	let checkPath = siteRelativePath.split('#')[0].split('?')[0]

	if (
		checkPath.startsWith('./') ||
		checkPath.startsWith('../') ||
		(!checkPath.startsWith('/') && checkPath.endsWith('.md'))
	) {
		const sourceDir = path.dirname(sourceFile)
		const resolved = path.resolve(sourceDir, checkPath)
		if (!resolved.startsWith(DOCS_ROOT + path.sep) && resolved !== DOCS_ROOT)
			return null
		if (fs.existsSync(resolved) && fs.statSync(resolved).isFile())
			return resolved
		if (fs.existsSync(`${resolved}.md`)) return `${resolved}.md`
		if (fs.existsSync(`${resolved}.mdx`)) return `${resolved}.mdx`
		if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
			const indexFile = path.join(resolved, 'index.md')
			const indexMdxFile = path.join(resolved, 'index.mdx')
			if (fs.existsSync(indexFile)) return indexFile
			if (fs.existsSync(indexMdxFile)) return indexMdxFile
		}
		return null
	}

	if (checkPath.startsWith('/docs/')) {
		checkPath = checkPath.slice(5)
	}

	if (checkPath.endsWith('/')) {
		const baseName = checkPath.slice(0, -1)
		const asMd = path.join(DOCS_ROOT, `${baseName}.md`)
		const asMdx = path.join(DOCS_ROOT, `${baseName}.mdx`)
		const asIndex = path.join(DOCS_ROOT, checkPath, 'index.md')
		const asIndexMdx = path.join(DOCS_ROOT, checkPath, 'index.mdx')

		if (fs.existsSync(asMd)) return asMd
		if (fs.existsSync(asMdx)) return asMdx
		if (fs.existsSync(asIndex)) return asIndex
		if (fs.existsSync(asIndexMdx)) return asIndexMdx
		return null
	}

	const direct = path.join(DOCS_ROOT, checkPath)
	if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct

	const withMd = `${direct}.md`
	if (fs.existsSync(withMd)) return withMd

	const withMdx = `${direct}.mdx`
	if (fs.existsSync(withMdx)) return withMdx

	if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) {
		const indexFile = path.join(direct, 'index.md')
		const indexMdxFile = path.join(direct, 'index.mdx')
		if (fs.existsSync(indexFile)) return indexFile
		if (fs.existsSync(indexMdxFile)) return indexMdxFile
	}

	return null
}

function processFile(filePath) {
	const content = fs.readFileSync(filePath, 'utf-8')
	const strippedContent = stripCodeBlocks(content)
	const issues = []

	LINK_REGEX.lastIndex = 0

	for (
		let match = LINK_REGEX.exec(strippedContent);
		match !== null;
		match = LINK_REGEX.exec(strippedContent)
	) {
		const linkText = match[1]
		const href = match[2]

		const hashIndex = href.indexOf('#')
		const linkPath = hashIndex === -1 ? href : href.slice(0, hashIndex)
		const anchor = hashIndex === -1 ? null : href.slice(hashIndex + 1)

		const linkLower = linkPath.toLowerCase()
		if (STATIC_ASSET_EXTENSIONS.some((ext) => linkLower.endsWith(ext))) {
			continue
		}

		const targetFile = resolveLink(linkPath, filePath)

		if (!targetFile) {
			issues.push({
				type: 'broken-link',
				linkText,
				href,
				linkPath,
				status: 'manual-check',
			})
			continue
		}

		if (anchor) {
			const targetContent = fs.readFileSync(targetFile, 'utf-8')
			const anchors = extractAnchors(targetContent)
			let normalizedAnchor
			try {
				normalizedAnchor = headingToAnchor(decodeURIComponent(anchor))
			} catch {
				normalizedAnchor = headingToAnchor(anchor)
			}

			if (!anchors.has(anchor) && !anchors.has(normalizedAnchor)) {
				issues.push({
					type: 'broken-anchor',
					linkText,
					href,
					anchor,
					status: 'manual-check',
					message: `Anchor "#${anchor}" not found`,
				})
			}
		}
	}

	return { content, issues }
}

console.log(`\nValidating docs in: ${DOCS_ROOT}`)

const files = getMarkdownFiles(DOCS_ROOT)
console.log(`Found ${files.length} markdown files\n`)

let totalIssues = 0
for (const filePath of files) {
	const relativePath = path.relative(DOCS_ROOT, filePath)
	const { issues } = processFile(filePath)

	if (issues.length > 0) {
		totalIssues += issues.length
		console.log(`\n${relativePath}`)
		for (const issue of issues) {
			console.log(`  [ISSUE] ${issue.href} (${issue.type})`)
		}
	}
}

console.log(`\nScan complete. Total issues found: ${totalIssues}\n`)
if (totalIssues > 0) {
	process.exit(1)
}
