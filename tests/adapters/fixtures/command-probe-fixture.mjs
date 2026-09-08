#!/usr/bin/env node
// The one real executable `command-line-adapter.test.ts` and
// `command-probe-subject.ts` spawn. A single script covers every scenario the
// adapter has to prove, selected by flag, so the test suite spawns one real
// process per case rather than mocking `child_process`.
//
// Flags:
//   --sleep-ms <n>       sleep before doing anything else (timeout cases)
//   --big-output <n>     write n bytes of 'x' to stdout (output-cap cases)
//   --exit-code <n>      exit with code n after the rest runs
//   --write-artifact <path> <text>   write text to path (artifact cases)
// Anything else is echoed back verbatim in the JSON payload below, which is
// how `argument-passed-literally` proves a shell metacharacter never reaches
// a shell: the fixture never invokes one, so whatever it receives in argv is
// exactly what the adapter sent.
import { readFileSync, writeFileSync } from 'node:fs'

const argv = process.argv.slice(2)
let exitCode = 0
const rest = []

for (let index = 0; index < argv.length; index++) {
	const flag = argv[index]
	if (flag === '--sleep-ms') {
		const ms = Number(argv[++index])
		const until = Date.now() + ms
		while (Date.now() < until) {
			/* busy-wait: this fixture has no dependency to await on */
		}
	} else if (flag === '--big-output') {
		const bytes = Number(argv[++index])
		process.stdout.write('x'.repeat(bytes))
	} else if (flag === '--exit-code') {
		exitCode = Number(argv[++index])
	} else if (flag === '--write-artifact') {
		// One token: buildArgv JSON-encodes an array-valued option rather than
		// splitting it into two argv elements, so the fixture reads it the same
		// way.
		const [path, text] = JSON.parse(argv[++index])
		writeFileSync(path, text)
	} else {
		rest.push(flag)
	}
}

let stdin = ''
try {
	stdin = readFileSync(0, 'utf8')
} catch {
	stdin = ''
}

process.stdout.write(
	JSON.stringify({
		argv: rest,
		env: { PROBE_TEST_VAR: process.env.PROBE_TEST_VAR ?? null },
		stdin,
		cwd: process.cwd(),
	}),
)
process.stderr.write(`stderr-marker:${rest.join(',')}`)
process.exitCode = exitCode
