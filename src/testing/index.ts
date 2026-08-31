/**
 * The `eval-quality/conformance` subpath: what an outside adapter author needs
 * to implement a port and check the implementation.
 *
 * The boundary vocabulary is published here because this subpath is where AD-37
 * puts the conformance definition an adapter author reads, and that author
 * cannot implement `CorpusPort` without the type. The root barrel does not
 * carry it.
 *
 * Type re-exports use `export type`; `biome.json` sets
 * `style.useExportType: "error"`.
 */

export type { RuntimeFaultCode } from '../core/schemas/faults.ts'
export { RUNTIME_FAULT_CODES, RuntimeFault } from '../core/schemas/faults.ts'
export type {
	ClockReadRequest,
	ClockReadResponse,
	CorpusResolveRequest,
	CorpusResolveResponse,
	FileReadRequest,
	FileReadResponse,
	FileWriteRequest,
	FileWriteResponse,
	ProbeObservation,
	ProbeObservedBody,
	ProbeRequest,
	ProbeRequestBody,
} from '../core/schemas/port-messages.ts'
export type {
	ProbeTargetAuthorization,
	ProbeTargetPolicy,
} from '../core/schemas/probe-policy.ts'
export type { ClockPort } from '../ports/clock-port.ts'
export { clockReadParsers } from '../ports/clock-port.ts'
export type { CorpusPort } from '../ports/corpus-port.ts'
export { corpusResolveParsers } from '../ports/corpus-port.ts'
export type { EnvironmentProbePort } from '../ports/environment-probe-port.ts'
export { probeParsers } from '../ports/environment-probe-port.ts'
export type { FileSystemPort } from '../ports/file-system-port.ts'
export {
	fileReadParsers,
	fileWriteParsers,
} from '../ports/file-system-port.ts'
export type {
	BuiltSubject,
	ConformanceOutcome,
	ConformancePort,
	ConformanceReport,
	PortSubject,
	ScenarioKind,
} from './conformance.ts'
export {
	CONFORMANCE_OUTCOME_COUNTS,
	formatConformanceReport,
	runClockPortConformance,
	runCorpusPortConformance,
	runFileSystemPortConformance,
} from './conformance.ts'
export type { ProbeSubject } from './probe-conformance.ts'
export { runEnvironmentProbePortConformance } from './probe-conformance.ts'
