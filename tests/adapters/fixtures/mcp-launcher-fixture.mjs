#!/usr/bin/env node
// A launcher that starts the real server as a grandchild and relays nothing
// itself, which is the shape `npx -y <package>` has: the process the
// authorization names is not the process that speaks the protocol.
//
// It writes the grandchild's pid to the path given as its first argument, so a
// test can ask whether teardown reached past the direct child. `--escape`
// starts the server in a session of its own (`setsid`), out of reach of a kill
// sent to the launcher's group, still holding the inherited stdout. The
// launcher's own pid goes to the same path with `.launcher` appended.
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const server = fileURLToPath(
	new URL('./mcp-probe-fixture.mjs', import.meta.url),
)
const [pidFile, ...flags] = process.argv.slice(2)
const escaped = flags.includes('--escape')
const serverFlags = flags.filter((flag) => flag !== '--escape')

const child = spawn(process.execPath, [server, ...serverFlags], {
	stdio: 'inherit',
	detached: escaped,
})

writeFileSync(`${pidFile}.launcher`, String(process.pid))
writeFileSync(pidFile, String(child.pid))

child.on('close', (code) => process.exit(code ?? 0))
