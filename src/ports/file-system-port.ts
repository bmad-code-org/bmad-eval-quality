/** the file-system port: two methods, each a byte-level read or write at a caller-owned path. */
import {
	FileReadRequest,
	FileReadResponse,
	FileWriteRequest,
	FileWriteResponse,
} from '../core/schemas/port-messages.ts'
import type { PortMethod } from './port.ts'

export type FileSystemPort = {
	readonly readFile: PortMethod<FileReadRequest, FileReadResponse>
	readonly writeFile: PortMethod<FileWriteRequest, FileWriteResponse>
}

/** the boundary parsers `application/` and the conformance suite validate with. */
export const fileReadParsers = {
	request: FileReadRequest,
	response: FileReadResponse,
} as const

export const fileWriteParsers = {
	request: FileWriteRequest,
	response: FileWriteResponse,
} as const
