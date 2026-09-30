#!/usr/bin/env node
// The one real MCP server `mcp-adapter.test.ts` spawns. It speaks the stdio
// transport: newline-delimited JSON-RPC on stdin and stdout, logging on stderr.
// One script covers every scenario the adapter has to prove, selected by the
// tool the call names, so the suite runs a real handshake per case rather than
// mocking `child_process`.
//
// It is stateful about the handshake on purpose: `tools/call` before
// `initialize` is refused with the SDK-standard "server not initialized"
// error. Without that the adapter could skip the handshake entirely and every
// test here would still pass.
//
// Launch flags:
//   --exit-at-launch      exit before answering anything (session never opens)
//   --garbage             write a line on stdout that is not a JSON-RPC message
//   --refuse-initialize   answer initialize with a JSON-RPC error
//   --empty-initialize    answer initialize with neither a result nor an error
//   --crash-on-initialize exit with code 3 on receiving initialize, unanswered
//   --exit-after-initialize answer initialize, then exit with code 3 before
//                         any tools/call arrives
//   --linger              outlive stdin for 60 seconds, then exit on its own
//   --ready-file <path>   create path when a tools/call arrives, so a test
//                         knows the session is past every write before it
//
// Tools:
//   search_notes    structured result, no error; its matches follow the query
//   create_note     structured result, no error; its noteId follows the title
//   env_tool        the environment and working directory the server was given
//   failing_tool    a result carrying isError: true
//   rpc_error_tool  a JSON-RPC error answering tools/call
//   oversize_tool   a structured result of args.bytes 'x' characters
//   noisy_tool      args.bytes on its own stderr, and never an answer
//   hanging_tool    never answers
//   silent_tool     a result with no structuredContent at all
//   crash_tool      exits with code 3 mid-call without answering
//   signal_tool     ends itself with SIGTERM mid-call without answering
//   farewell_tool   answers with a complete frame, then exits with code 3
//   garbage_tool    writes a line that is no JSON-RPC message, then exits with code 3
//   log_line_tool   writes args.line on stdout as it is, then exits with code 3
//   relayed_tool    the way a launcher relays: a grandchild holding the same
//                   stdout writes a complete answer 300ms later, and this
//                   process exits with code 3 as soon as it has started
//   chatty_tool     a server-to-client notification and request, then an answer
//   unframed_tool   a complete frame with no trailing newline, then exits
//   split_tool      one frame written in two chunks that split a character
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const flags = process.argv.slice(2)

if (flags.includes('--exit-at-launch')) process.exit(1)

const send = (message) => {
	process.stdout.write(`${JSON.stringify(message)}\n`)
}

if (flags.includes('--garbage')) {
	process.stdout.write('this line is not a JSON-RPC message\n')
}

// A server behind a launcher receives the client's stdin through the
// launcher's inherited pipe, so closing that pipe would end it on its own and
// a teardown test could not tell a process-group kill from an stdin close. The
// timer exits rather than repeating: a test whose teardown assertion fails is
// exactly the run that leaked a server, so the leak has to be bounded here.
if (flags.includes('--linger')) setTimeout(() => process.exit(0), 60000)

let initialized = false

/** A stable identifier derived from one argument: the same input names the same note every time. */
const slug = (value) =>
	String(value ?? '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '') || 'empty'

/** Writes one frame in two chunks whose boundary falls inside a multi-byte character. */
const writeSplit = (message) => {
	const frame = Buffer.from(`${JSON.stringify(message)}\n`, 'utf8')
	const marker = frame.indexOf(Buffer.from('é', 'utf8'))
	const at = marker === -1 ? Math.floor(frame.length / 2) : marker + 1
	process.stdout.write(frame.subarray(0, at))
	setTimeout(() => process.stdout.write(frame.subarray(at)), 10)
}

const answerToolCall = (id, params) => {
	const name = params?.name
	const args = params?.arguments ?? {}
	const result = (structuredContent, isError = false) => {
		send({
			jsonrpc: '2.0',
			id,
			result: { content: [], structuredContent, isError },
		})
	}
	if (!initialized) {
		send({
			jsonrpc: '2.0',
			id,
			error: { code: -32002, message: 'server not initialized', data: null },
		})
		return
	}
	switch (name) {
		case 'search_notes':
			// The matches follow the query, so AD-10's input-sensitivity
			// differential has a real difference to read, and they follow it by a
			// pure function so two legs sending the same query describe the same
			// fixture state for the state-reset differential.
			result({
				ok: true,
				matches: [{ noteId: `n-${slug(args.query)}` }],
				totalCount: 1,
				echo: args.query ?? null,
			})
			return
		case 'create_note':
			result({
				ok: true,
				noteId: `note-${slug(args.title)}`,
				title: args.title ?? null,
			})
			return
		case 'env_tool':
			result({ ok: true, env: { ...process.env }, cwd: process.cwd() })
			return
		case 'failing_tool':
			result({ ok: false, reason: 'the tool refused the call' }, true)
			return
		case 'rpc_error_tool':
			send({
				jsonrpc: '2.0',
				id,
				error: { code: -32602, message: 'no such argument', data: null },
			})
			return
		case 'oversize_tool':
			result({ ok: true, blob: 'x'.repeat(Number(args.bytes ?? 100000)) })
			return
		case 'noisy_tool':
			// No answer follows the burst. Node does not order delivery across two
			// pipes, so a server that answered here could win the race and leave
			// the stderr cap untested.
			process.stderr.write('n'.repeat(Number(args.bytes ?? 100000)))
			return
		case 'hanging_tool':
			return
		case 'silent_tool':
			send({ jsonrpc: '2.0', id, result: { content: [] } })
			return
		case 'crash_tool':
			process.exit(3)
			return
		case 'signal_tool':
			process.kill(process.pid, 'SIGTERM')
			return
		case 'farewell_tool':
			process.stdout.write(
				`${JSON.stringify({
					jsonrpc: '2.0',
					id,
					result: {
						content: [],
						structuredContent: { ok: true, farewell: true },
					},
				})}\n`,
				() => process.exit(3),
			)
			return
		case 'garbage_tool':
			process.stdout.write('this line is not a JSON-RPC message\n', () =>
				process.exit(3),
			)
			return
		case 'log_line_tool':
			process.stdout.write(`${String(args.line)}\n`, () => process.exit(3))
			return
		case 'relayed_tool': {
			const answer = JSON.stringify({
				jsonrpc: '2.0',
				id,
				result: {
					content: [],
					structuredContent: { ok: true, relayed: true },
				},
			})
			const relay = spawn(
				process.execPath,
				[
					'-e',
					'setTimeout(() => process.stdout.write(process.argv[1] + "\\n"), 300)',
					answer,
				],
				{ stdio: ['ignore', 'inherit', 'inherit'] },
			)
			relay.once('spawn', () => process.exit(3))
			return
		}
		case 'chatty_tool':
			// Both carry `jsonrpc: '2.0'`, so both are legal JSON-RPC that is no
			// answer to the client's request.
			send({
				jsonrpc: '2.0',
				method: 'notifications/message',
				params: { level: 'info', data: 'working' },
			})
			send({ jsonrpc: '2.0', id: 99, method: 'ping' })
			result({ ok: true, chatty: true })
			return
		case 'unframed_tool':
			process.stdout.write(
				JSON.stringify({
					jsonrpc: '2.0',
					id,
					result: {
						content: [],
						structuredContent: { ok: true, framed: false },
					},
				}),
			)
			process.stdout.end(() => process.exit(0))
			return
		case 'split_tool':
			writeSplit({
				jsonrpc: '2.0',
				id,
				result: {
					content: [],
					structuredContent: { ok: true, label: 'café-日本-🎯' },
				},
			})
			return
		default:
			send({
				jsonrpc: '2.0',
				id,
				error: { code: -32602, message: `unknown tool ${name}`, data: null },
			})
	}
}

createInterface({ input: process.stdin }).on('line', (line) => {
	if (line.trim() === '') return
	let message
	try {
		message = JSON.parse(line)
	} catch {
		return
	}
	// A notification carries no id and wants no answer.
	if (message.id === undefined) return
	const readyAt = flags.indexOf('--ready-file')
	if (readyAt !== -1 && message.method === 'tools/call') {
		writeFileSync(flags[readyAt + 1], '')
	}
	if (message.method === 'initialize') {
		if (flags.includes('--crash-on-initialize')) process.exit(3)
		if (flags.includes('--empty-initialize')) {
			send({ jsonrpc: '2.0', id: message.id })
			return
		}
		if (flags.includes('--refuse-initialize')) {
			send({
				jsonrpc: '2.0',
				id: message.id,
				error: {
					code: -32602,
					message: 'unsupported protocol version',
					data: null,
				},
			})
			return
		}
		initialized = true
		const answer = {
			jsonrpc: '2.0',
			id: message.id,
			result: {
				protocolVersion: '2025-06-18',
				capabilities: { tools: {} },
				serverInfo: { name: 'probe-notes', version: '0' },
			},
		}
		if (flags.includes('--exit-after-initialize')) {
			process.stdout.write(`${JSON.stringify(answer)}\n`, () => process.exit(3))
			return
		}
		send(answer)
		return
	}
	if (message.method === 'tools/call') {
		answerToolCall(message.id, message.params)
		return
	}
	send({
		jsonrpc: '2.0',
		id: message.id,
		error: {
			code: -32601,
			message: `unknown method ${message.method}`,
			data: null,
		},
	})
})
