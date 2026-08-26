/** AD-8's corpus-provider port: an opaque reference in, resolved bytes out. */
import {
	CorpusResolveRequest,
	CorpusResolveResponse,
} from '../core/schemas/port-messages.ts'
import type { PortMethod } from './port.ts'

export type CorpusPort = {
	readonly resolve: PortMethod<CorpusResolveRequest, CorpusResolveResponse>
}

/** the boundary parsers `application/` and the conformance suite validate with. */
export const corpusResolveParsers = {
	request: CorpusResolveRequest,
	response: CorpusResolveResponse,
} as const
