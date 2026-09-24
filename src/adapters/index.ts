/**
 * The reference adapters, published at the `./adapters` subpath. AD-28 calls
 * them conveniences and never a required path, so they sit behind their own
 * subpath and the root barrel keeps the `root -> adapters` edge the matrix
 * does not grant.
 */
export type {
	CommandMechanism,
	CommandRunRequest,
	CommandRunResult,
} from './command-line-adapter.ts'
export {
	createCommandLineAdapter,
	nodeCommandMechanism,
} from './command-line-adapter.ts'
// Validation for a mapping read from disk, one per adapter that takes a target
// policy: `createCommandLineAdapter` and `createMcpAdapter` take theirs typed
// and never parse it. The Zod schemas stay unexported; these two functions are
// the runtime surface.
export { parseCommandTargetPolicy } from './command-target-policy.ts'
export type { CorpusMechanism } from './local-corpus-adapter.ts'
export { createLocalCorpusAdapter } from './local-corpus-adapter.ts'
export type {
	McpCallToolRequest,
	McpCallToolResult,
	McpMechanism,
} from './mcp-adapter.ts'
export { createMcpAdapter, nodeStdioMcpMechanism } from './mcp-adapter.ts'
export { parseMcpTargetPolicy } from './mcp-target-policy.ts'
export type { FileSystemMechanism } from './node-file-system-adapter.ts'
export { createNodeFileSystemAdapter } from './node-file-system-adapter.ts'
export type { ClockMechanism } from './system-clock-adapter.ts'
export { createSystemClockAdapter } from './system-clock-adapter.ts'
