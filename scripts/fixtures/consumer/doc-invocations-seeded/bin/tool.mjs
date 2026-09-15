#!/usr/bin/env node
// A stand-in command line for the fixture pages: it refuses an unknown flag the
// way a real one does, checks a report, and refuses a report declaring no rule.
// Its diagnostics name no path, so the page can transcribe them and the compare
// is against the bytes rather than against a sandbox directory name.
import { readFile } from 'node:fs/promises'

const EXIT_USAGE = 64
const EXIT_RULE_MISSING = 4

const [command, target] = process.argv.slice(2)

if (command === 'check' || command === 'verify') {
	if (target === undefined) {
		console.error(`tool: usage: ${command} takes a path`)
		process.exitCode = EXIT_USAGE
	} else {
		const report = JSON.parse(await readFile(target, 'utf8'))
		if (report.rule === undefined) {
			console.error('tool: rule-missing: the report declares no rule')
			console.error('tool: run `tool check` first')
			process.exitCode = EXIT_RULE_MISSING
		} else {
			console.log(`tool: ${report.rule}: the report declares one rule`)
		}
	}
} else {
	console.error(`tool: usage: unknown command "${command}"`)
	process.exitCode = EXIT_USAGE
}
