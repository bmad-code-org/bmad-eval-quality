#!/usr/bin/env node
// A deterministic release-notes agent, small enough to read in one sitting and
// small enough to break on purpose.
//
// It reads a changelog whose every line is "<type>: <description>", writes a
// notes file, and exits. It reads no network, loads no model, and takes no
// credential, because the tutorial it belongs to teaches eval-quality's
// semantics rather than a model's quality.
//
// The --defective flag stands in for the edit a twin run makes by hand. In a
// real run you change the handler, run both arms, and put the handler back. Here
// the two arms are one flag apart so the difference is one command to see.
import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'

const argv = process.argv.slice(2)
const subcommand = argv[0]
const defective = argv.includes('--defective')

const option = (name) => {
	const at = argv.indexOf(`--${name}`)
	return at === -1 ? null : (argv[at + 1] ?? null)
}

const refuse = (message) => {
	process.stderr.write(`release-notes-agent: ${message}\n`)
	process.exit(64)
}

const ENTRY = /^(added|fixed|changed): (.+)$/

const write = (target, value) => {
	writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
}

if (subcommand === 'summarize') {
	const input = option('input')
	const out = option('out')
	if (input === null || out === null) refuse('summarize needs --input and --out')

	const lines = readFileSync(input, 'utf8')
		.split('\n')
		.filter((line) => line.trim() !== '')

	const entries = []
	let unparsed = null
	for (const [index, line] of lines.entries()) {
		const match = ENTRY.exec(line)
		if (match === null) {
			unparsed = index + 1
			break
		}
		entries.push({ type: match[1], description: match[2] })
	}

	if (unparsed !== null) {
		if (!defective) {
			process.stderr.write(
				`release-notes-agent: cannot parse line ${unparsed} of ${basename(input)}\n`,
			)
			process.exit(1)
		}
		// The seeded defect. The parse failure is swallowed, an empty notes file
		// is written, and the run reports success.
		write(out, { summary: '', entries: [], source: basename(input) })
		process.exit(0)
	}

	write(out, {
		summary: `${entries.length} change(s)`,
		entries,
		source: basename(input),
	})
	process.exit(0)
}

if (subcommand === 'show') {
	const notes = option('notes')
	if (notes === null) refuse('show needs --notes')
	process.stdout.write(`${readFileSync(notes, 'utf8').trim()}\n`)
	process.exit(0)
}

refuse('expected the subcommand "summarize" or "show"')
