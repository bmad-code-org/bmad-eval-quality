/**
 * eval-quality Documentation Build Pipeline
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSiteUrl } from '../website/src/lib/site-url.mjs'

const PROJECT_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const BUILD_DIR = path.join(PROJECT_ROOT, 'build')
const REPO_URL = 'https://github.com/bmad-code-org/bmad-eval-quality'

const LLM_MAX_CHARS = 600_000
const LLM_WARN_CHARS = 500_000

async function main() {
	if (process.platform === 'win32') {
		console.error(
			'Error: The docs build pipeline does not support Windows directly.',
		)
		console.error('Please build on Linux, macOS, or WSL.')
		process.exit(1)
	}

	console.log('\n===========================================')
	console.log('  eval-quality Documentation Build Pipeline  ')
	console.log('===========================================\n')
	console.log(`Project root: ${PROJECT_ROOT}`)
	console.log(`Build directory: ${BUILD_DIR}\n`)

	checkDocLinks()
	cleanBuildDirectory()

	const docsDir = path.join(PROJECT_ROOT, 'docs')
	const artifactsDir = await generateArtifacts(docsDir)
	const siteDir = buildAstroSite()

	printBuildSummary(docsDir, artifactsDir, siteDir)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})

async function generateArtifacts(docsDir) {
	console.log('\n--- Generating LLM Files ---')
	const outputDir = path.join(BUILD_DIR, 'artifacts')
	fs.mkdirSync(outputDir, { recursive: true })

	generateLlmsTxt(outputDir)
	generateLlmsFullTxt(docsDir, outputDir)

	console.log('✓ Artifact generation complete')
	return outputDir
}

function buildAstroSite() {
	console.log('\n--- Building Astro + Starlight Site ---')
	const siteDir = path.join(BUILD_DIR, 'site')
	const artifactsDir = path.join(BUILD_DIR, 'artifacts')

	runAstroBuild()
	copyArtifactsToSite(artifactsDir, siteDir)

	console.log('✓ Astro build complete')
	return siteDir
}

function generateLlmsTxt(outputDir) {
	console.log('  → Generating llms.txt...')
	const siteUrl = getSiteUrl()
	const content = [
		'# eval-quality Documentation',
		'',
		'> Compile disciplined Behavioral Evaluation Contracts and score their ability to catch known defects.',
		'',
		`Documentation: ${siteUrl}`,
		`Repository: ${REPO_URL}`,
		`Full docs: ${siteUrl}/llms-full.txt`,
		'',
		'## Quick Start',
		'',
		`- **[Getting Started](${siteUrl}/tutorials/getting-started/)** - Tutorial: install and run eval-quality`,
		`- **[Authoring Contracts](${siteUrl}/how-to/author-behavioral-contracts/)** - How to author behavioral contracts`,
		'',
		'## Core Concepts',
		'',
		`- **[Behavioral Evaluation Contracts](${siteUrl}/explanation/behavioral-evaluation-contracts/)** - Behavioral contracts deep dive`,
		`- **[CLI Reference](${siteUrl}/reference/cli-commands/)** - Command line tool reference`,
		'',
		'---',
		'',
		'## Full Context',
		'',
		`- [Full Documentation (llms-full.txt)](${siteUrl}/llms-full.txt) - Complete docs for AI context`,
		'',
	].join('\n')

	fs.writeFileSync(path.join(outputDir, 'llms.txt'), content, 'utf-8')
	console.log(
		`    Generated llms.txt (${content.length.toLocaleString()} chars)`,
	)
}

function generateLlmsFullTxt(docsDir, outputDir) {
	console.log('  → Generating llms-full.txt...')
	const date = new Date().toISOString().split('T')[0]
	const files = getAllMarkdownFiles(docsDir).sort()

	const output = [
		'# eval-quality Documentation (Full)',
		'',
		'> Complete documentation for AI consumption',
		`> Generated: ${date}`,
		`> Repository: ${REPO_URL}`,
		'',
	]

	let fileCount = 0
	for (const mdPath of files) {
		if (path.basename(mdPath).startsWith('_')) continue

		const fullPath = path.join(docsDir, mdPath)
		try {
			const content = readMarkdownContent(fullPath)
			output.push(`<document path="${mdPath}">`, content, '</document>', '')
			fileCount++
		} catch (error) {
			console.error(`    Warning: Could not read ${mdPath}: ${error.message}`)
		}
	}

	const result = output.join('\n')
	validateLlmSize(result)

	fs.writeFileSync(path.join(outputDir, 'llms-full.txt'), result, 'utf-8')
	const tokenEstimate = Math.floor(result.length / 4).toLocaleString()
	console.log(
		`    Processed ${fileCount} files, ${result.length.toLocaleString()} chars (~${tokenEstimate} tokens)`,
	)
}

function getAllMarkdownFiles(dir, baseDir = dir) {
	const files = []
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			files.push(...getAllMarkdownFiles(fullPath, baseDir))
		} else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
			files.push(path.relative(baseDir, fullPath))
		}
	}
	return files
}

function readMarkdownContent(filePath) {
	let content = fs.readFileSync(filePath, 'utf-8')
	if (content.startsWith('---')) {
		const end = content.indexOf('---', 3)
		if (end !== -1) {
			content = content.slice(end + 3).trim()
		}
	}
	return content
}

function validateLlmSize(content) {
	const charCount = content.length
	if (charCount > LLM_MAX_CHARS) {
		console.error(
			`    ERROR: Exceeds ${LLM_MAX_CHARS.toLocaleString()} char limit`,
		)
		process.exit(1)
	} else if (charCount > LLM_WARN_CHARS) {
		console.warn(
			`    WARNING: Approaching ${LLM_WARN_CHARS.toLocaleString()} char limit`,
		)
	}
}

function runAstroBuild() {
	console.log('  → Running astro build...')
	execSync('npm --prefix website run build', {
		cwd: PROJECT_ROOT,
		stdio: 'inherit',
		env: { ...process.env },
	})
}

function copyArtifactsToSite(artifactsDir, siteDir) {
	console.log('  → Copying artifacts to site...')
	fs.copyFileSync(
		path.join(artifactsDir, 'llms.txt'),
		path.join(siteDir, 'llms.txt'),
	)
	fs.copyFileSync(
		path.join(artifactsDir, 'llms-full.txt'),
		path.join(siteDir, 'llms-full.txt'),
	)
}

function printBuildSummary(docsDir, artifactsDir, siteDir) {
	console.log('\n===========================================')
	console.log('  Build Complete!')
	console.log('===========================================\n')
	console.log(`Source docs:     ${docsDir}`)
	console.log(`Generated files: ${artifactsDir}`)
	console.log(`Deployable site: ${siteDir}\n`)
}

function cleanBuildDirectory() {
	console.log('Cleaning previous build directory...')
	if (fs.existsSync(BUILD_DIR)) {
		fs.rmSync(BUILD_DIR, { recursive: true })
	}
	fs.mkdirSync(BUILD_DIR, { recursive: true })
}

function checkDocLinks() {
	console.log('Checking documentation links...')
	try {
		execSync('node tools/validate-doc-links.js', {
			cwd: PROJECT_ROOT,
			stdio: 'inherit',
		})
	} catch {
		console.error('\nLink check failed - fix broken links before building\n')
		process.exit(1)
	}
}
