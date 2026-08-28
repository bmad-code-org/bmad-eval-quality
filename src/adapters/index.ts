/**
 * The reference adapters, published at the `./adapters` subpath. AD-28 calls
 * them conveniences and never a required path, so they sit behind their own
 * subpath and the root barrel keeps the `root -> adapters` edge the matrix
 * does not grant.
 */
export type { CorpusMechanism } from './local-corpus-adapter.ts'
export { createLocalCorpusAdapter } from './local-corpus-adapter.ts'
export type { FileSystemMechanism } from './node-file-system-adapter.ts'
export { createNodeFileSystemAdapter } from './node-file-system-adapter.ts'
export type { ClockMechanism } from './system-clock-adapter.ts'
export { createSystemClockAdapter } from './system-clock-adapter.ts'
