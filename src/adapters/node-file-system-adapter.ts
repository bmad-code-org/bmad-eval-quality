/** the file-system port over `node:fs/promises`. */
import { readFile, writeFile } from 'node:fs/promises'
import type { FileSystemPort } from '../ports/file-system-port.ts'
import { fileReadParsers, fileWriteParsers } from '../ports/file-system-port.ts'
import { runPortMethod } from './port-boundary.ts'

/** Both return `unknown` so the response parse stays falsifiable; see `port-boundary.ts`. */
export type FileSystemMechanism = {
	readonly readFile: (path: string, signal: AbortSignal) => Promise<unknown>
	readonly writeFile: (
		path: string,
		bytes: Uint8Array,
		signal: AbortSignal,
	) => Promise<unknown>
}

const nodeFileSystem: FileSystemMechanism = {
	readFile: (path, signal) => readFile(path, { signal }),
	// `fs.writeFile` resolves to `undefined`, so the mechanism returns the byte
	// count itself. Take it from the request and `FileWriteResponse.byteLength`
	// is assembled from a value the adapter already holds, so the parse could
	// never reject for `writeFile`.
	writeFile: async (path, bytes, signal) => {
		await writeFile(path, bytes, { signal })
		return bytes.length
	},
}

export function createNodeFileSystemAdapter(
	mechanism: FileSystemMechanism = nodeFileSystem,
): FileSystemPort {
	return {
		readFile: (request, signal) =>
			runPortMethod({
				request,
				requestParser: fileReadParsers.request,
				responseParser: fileReadParsers.response,
				requestPath: 'FileReadRequest',
				responsePath: 'FileReadResponse',
				signal,
				mechanism: (parsed, innerSignal) =>
					mechanism.readFile(parsed.path, innerSignal),
				assemble: (raw, parsed) => ({ path: parsed.path, bytes: raw }),
			}),
		writeFile: (request, signal) =>
			runPortMethod({
				request,
				requestParser: fileWriteParsers.request,
				responseParser: fileWriteParsers.response,
				requestPath: 'FileWriteRequest',
				responsePath: 'FileWriteResponse',
				signal,
				mechanism: (parsed, innerSignal) =>
					mechanism.writeFile(parsed.path, parsed.bytes, innerSignal),
				assemble: (raw, parsed) => ({ path: parsed.path, byteLength: raw }),
			}),
	}
}
