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
//   --write-artifact <value>  given twice, as path then text (artifact cases)
//   --spawn-grandchild <pidFile>  start a node process that lives 30s with
//                        its stdio ignored, write its pid to pidFile, and
//                        leave it running (process-group cases)
//   --spawn-grandchild-holding-stdout <pidFile>  the same, with the grandchild
//                        inheriting this process's stdout and stderr, so the
//                        pipes stay open after this process exits
//   --spawn-escaped-grandchild-holding-stdout <pidFile>  the same again, with
//                        the grandchild in a session of its own, out of reach
//                        of a kill sent to this process's group
// Anything else is echoed back verbatim in the JSON payload below, which is
// how `argument-passed-literally` proves a shell metacharacter never reaches
// a shell: the fixture never invokes one, so whatever it receives in argv is
// exactly what the adapter sent.
import { spawn } from 'node:child_process'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'

const argv = process.argv.slice(2)
let exitCode = 0
const rest = []
const artifactTokens = []

// What an agent runner, `npx`, or a shell wrapper does: start the process that
// does the work and carry on. Unreferenced, so this process can still exit on
// its own while the grandchild runs. The grandchild exits by itself after 30s,
// so one a failed test run never killed is still bounded. The pid file is
// written whole or not at all, so a kill landing mid-write leaves no empty file
// to read as pid 0.
function spawnGrandchild(pidFile, stdio, detached = false) {
	const grandchild = spawn(
		process.execPath,
		['-e', 'setTimeout(() => {}, 30000)'],
		{ stdio, detached },
	)
	grandchild.unref()
	writeFileSync(`${pidFile}.tmp`, String(grandchild.pid))
	renameSync(`${pidFile}.tmp`, pidFile)
}

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
	} else if (flag === '--spawn-grandchild') {
		spawnGrandchild(argv[++index], 'ignore')
	} else if (flag === '--spawn-grandchild-holding-stdout') {
		spawnGrandchild(argv[++index], ['ignore', 'inherit', 'inherit'])
	} else if (flag === '--spawn-escaped-grandchild-holding-stdout') {
		spawnGrandchild(argv[++index], ['ignore', 'inherit', 'inherit'], true)
	} else if (flag === '--exit-code') {
		exitCode = Number(argv[++index])
	} else if (flag === '--write-artifact') {
		// The repeatable spelling: buildArgv emits `--write-artifact` once per
		// array element, so the path and the text arrive as two occurrences of
		// the same flag and this collects them the way a real CLI parser would.
		artifactTokens.push(argv[++index])
	} else {
		rest.push(flag)
	}
}

if (artifactTokens.length > 0) {
	const [path, text] = artifactTokens
	writeFileSync(path, text)
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
