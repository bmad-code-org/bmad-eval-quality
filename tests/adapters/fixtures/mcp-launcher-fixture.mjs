#!/usr/bin/env node
// A launcher that starts the real server as a grandchild and relays nothing
// itself, which is the shape `npx -y <package>` has: the process the
// authorization names is not the process that speaks the protocol.
//
// It writes the grandchild's pid to the path given as its first argument, so a
// test can ask whether teardown reached past the direct child.
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const server = fileURLToPath(
	new URL('./mcp-probe-fixture.mjs', import.meta.url),
)
const [pidFile, ...serverFlags] = process.argv.slice(2)

const child = spawn(process.execPath, [server, ...serverFlags], {
	stdio: 'inherit',
})

writeFileSync(pidFile, String(child.pid))

child.on('close', (code) => process.exit(code ?? 0))
