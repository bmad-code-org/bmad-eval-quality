// The two-observation record AD-40's `missed` state becomes reachable through,
// plus the one operation inventory both new score modules resolve against.
//
// One probe seeding a 500 on a malformed title, two observations of
// `POST /notes`, and one finding. The interesting part is that the two
// observations differ only in what came back: obs-1 is the system correctly
// rejecting, obs-2 is the seeded defect firing. A scorer that reads only what
// was sent cannot tell them apart, which is the failure the discriminating
// condition exists to close.

import type { DefectSignature } from '../../../src/core/schemas/defect-signature.ts'
import type {
	Operation,
	PermittedInterface,
} from '../../../src/core/schemas/interface.ts'
import type { Probe } from '../../../src/core/schemas/probe.ts'
import type {
	Observation,
	SealedRunRecord,
} from '../../../src/core/schemas/sealed-run-record.ts'
import type { SignedProbe } from '../../../src/core/score/witness.ts'

export const digestOf = (ordinal: number): string =>
	`sha256:${ordinal.toString(16).padStart(64, '0')}`

export const evidenceReference = {
	storage: 'public' as const,
	path: 'evidence/probe-witness.jsonl',
	privateRef: null,
	digest: digestOf(1),
}

const emptyChannel = { requiredKeys: [], permittedKeys: [], types: {} }

export const createNote: Operation = {
	operationId: 'create-note',
	method: 'POST',
	// A parameterless template on purpose: the erasure rule is exercised by
	// `readNote` below, and a signature that binds without erasure would hide a
	// broken comparison here.
	pathTemplate: '/notes',
	stateChangeMarker: true,
	requestShape: {
		path: emptyChannel,
		query: emptyChannel,
		header: emptyChannel,
		body: {
			requiredKeys: ['title'],
			permittedKeys: [],
			types: { title: 'string' },
		},
	},
	responseDescriptor: {
		requiredKeys: ['ok'],
		permittedKeys: ['note', 'error', 'items', 'message'],
		types: {
			ok: 'boolean',
			note: 'object',
			error: 'object',
			items: 'array',
			message: 'string',
		},
		successIndicator: null,
		channelRoles: null,
		collectionLocations: null,
	},
	volatilePointers: [],
	sensitivityWitness: null,
}

/** the same operation under a differently named path parameter. */
export const readNote: Operation = {
	...createNote,
	operationId: 'read-note',
	method: 'GET',
	pathTemplate: '/notes/{noteId}',
	stateChangeMarker: false,
	requestShape: {
		...createNote.requestShape,
		path: {
			requiredKeys: ['noteId'],
			permittedKeys: [],
			types: { noteId: 'string' },
		},
		body: emptyChannel,
	},
}

export const notesInterface: PermittedInterface = {
	logicalId: 'notes-api',
	kind: 'api',
	operations: [createNote, readNote],
}

export const INTERFACES: readonly PermittedInterface[] = [notesInterface]

/** the seeded defect: a 500 where a malformed title should have been rejected. */
export const seededSignature: DefectSignature = {
	interfaceKind: 'api',
	method: 'POST',
	pathTemplate: '/notes',
	observableChannel: 'response-status',
	condition: {
		selector: {
			inputBinding: {
				path: null,
				query: null,
				header: null,
				body: { title: { matcher: 'type-violating' } },
			},
		},
		predicate: {
			op: 'equality',
			operands: [
				{ pointer: '/interactions/observed/response-status' },
				{ literal: 500 },
			],
		},
	},
}

export const qualifiedProbe: SignedProbe = {
	schemaVersion: 2,
	parentDigest: null,
	revisionCount: 0,
	probeId: 'PX-001',
	probeClass: 'defect',
	expectedClean: false,
	behaviorId: 'B-001',
	systemId: 'notes-api',
	implementationDigest: digestOf(2),
	artifactDigest: digestOf(3),
	commitDigest: digestOf(4),
	rationale: 'A controlled mutation seeding a 500 on a malformed title.',
	qualification: {
		route: 'controlled-mutation',
		mutationSource: 'hand-authored mutation of the create handler',
		mutationOperator: 'guard-deletion',
		targetArtifact: evidenceReference,
		expectedObservableFailure: 'a 500 instead of a 400 on a non-string title',
		baselinePassEvidence: evidenceReference,
		mutatedFailEvidence: evidenceReference,
		rollbackVerified: true,
	},
	defects: [
		{
			defectId: 'D-001',
			behaviorId: 'B-001',
			summary: 'A non-string title reaches the store and faults the handler.',
			severity: 'critical',
			oracleEvidence: [evidenceReference],
			source: 'controlled-mutation',
			manifestationWitness: null,
		},
	],
	defectSignature: seededSignature,
}

/** the canary: an `expectedClean: false` probe carrying no signature at all. */
export const canary: Probe = {
	...qualifiedProbe,
	probeId: 'PX-002',
	probeClass: 'canary',
	rationale: 'A canary: non-detection indicts the fixture.',
	qualification: {
		route: 'canary',
		indicts: 'fixture',
		nonDetectionEvidence: evidenceReference,
	},
	defects: [],
	defectSignature: null,
}

export const observation = (
	overrides: Partial<Observation> & Pick<Observation, 'observationId'>,
): Observation => ({
	sequence: 1,
	operationId: 'create-note',
	provenance: 'evaluator-chosen',
	callInputs: { path: null, query: null, header: null, body: null },
	responseBody: null,
	responseHeaders: null,
	responseStatus: null,
	stdout: null,
	stderr: null,
	exitCode: null,
	...overrides,
})

/** obs-1: the system correctly rejecting. Same input, different response. */
export const correctRejection = observation({
	observationId: 'obs-1',
	sequence: 1,
	callInputs: { path: null, query: null, header: null, body: { title: 42 } },
	responseBody: { ok: false, message: 'title must be a string' },
	responseStatus: 400,
})

/** obs-2: the seeded defect firing. */
export const defectFired = observation({
	observationId: 'obs-2',
	sequence: 2,
	callInputs: { path: null, query: null, header: null, body: { title: 42 } },
	responseBody: { ok: false, message: 'internal error' },
	responseStatus: 500,
})

export const defectFinding = (
	observationIds: readonly string[],
	overrides: Partial<{
		findingId: string
		probeId: string
		quote: string
	}> = {},
): SealedRunRecord['findings'][number] => ({
	findingType: 'defect',
	findingId: overrides.findingId ?? 'F-001',
	oracleId: 'O-001',
	probeId: overrides.probeId ?? qualifiedProbe.probeId,
	behaviorId: 'B-001',
	severity: 'critical',
	summary: 'A non-string title produced a 500.',
	confidence: 0.9,
	observationIds: [...observationIds],
	evidenceArtifacts: [],
	quotedEvidence: [
		{ quote: overrides.quote ?? '500', channel: 'response-status' },
	],
})

/** the record the match reads: observations plus findings, nothing else. */
export const recordOf = (
	observations: readonly Observation[],
	findings: readonly SealedRunRecord['findings'][number][] = [],
): Pick<SealedRunRecord, 'observations' | 'findings'> => ({
	observations: [...observations],
	findings: [...findings],
})
