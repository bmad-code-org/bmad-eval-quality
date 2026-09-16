#!/usr/bin/env node
// A tiny MCP tool server over the stdio transport, for the tool-use tutorial.
//
// It speaks newline-delimited JSON-RPC on stdin and stdout, which is what
// `createMcpAdapter` launches and talks to. It publishes two tools, one that
// searches notes and one that creates them, and it answers with a structured
// result because that is the shape the `mcp` interface kind describes.
//
// Launch flag:
//   --seed-defect   create_note answers success and files the note without its
//                   title, which is the mutation the twin run plants
//
// The handshake is stateful on purpose. A `tools/call` arriving before
// `initialize` is refused, so a client that skipped the handshake fails here
// rather than appearing to work.
//
// The notes live in the JSON file named by NOTES_STORE, and the mapping that
// authorizes this server is what supplies that variable. The adapter opens one
// session per tool call, so a server keeping its notes in memory would forget
// every write before the read-back that is supposed to find it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { callTool, seedNotes } from './notes-store.mjs'

const seedDefect = process.argv.slice(2).includes('--seed-defect')
const storePath = process.env.NOTES_STORE
if (storePath === undefined) {
	process.stderr.write('tool-server: NOTES_STORE names no file\n')
	process.exit(64)
}

const readNotes = () =>
	existsSync(storePath)
		? JSON.parse(readFileSync(storePath, 'utf8'))
		: seedNotes()

let initialized = false

const send = (message) => {
	process.stdout.write(`${JSON.stringify(message)}\n`)
}

const answerToolCall = (id, params) => {
	if (!initialized) {
		send({
			jsonrpc: '2.0',
			id,
			error: { code: -32002, message: 'server not initialized', data: null },
		})
		return
	}
	const notes = readNotes()
	const { isError, structuredResult } = callTool(
		notes,
		params?.name,
		params?.arguments ?? {},
		seedDefect,
	)
	writeFileSync(storePath, `${JSON.stringify(notes, null, 2)}\n`)
	// `content` is the prose channel an MCP result may carry and this kind does
	// not describe, so it stays empty and every claim rides the structured
	// result beside it.
	send({
		jsonrpc: '2.0',
		id,
		result: { content: [], structuredContent: structuredResult, isError },
	})
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
	if (message.method === 'initialize') {
		initialized = true
		send({
			jsonrpc: '2.0',
			id: message.id,
			result: {
				protocolVersion: '2025-06-18',
				capabilities: { tools: {} },
				serverInfo: { name: 'tutorial-notes', version: '1' },
			},
		})
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
