// One reject fixture per constraint the schema itself enforces. Each is the
// `everything populated` accept fixture mutated to violate exactly one
// constraint, and each names the Zod issue path and code it must produce —
// never a bare "did not parse", because a gate that cannot be shown to fail is
// a gate that fails open.

export type RejectCase = {
	readonly id: string
	/** what the mutation violates, in the schema's own terms. */
	readonly constraint: string
	/** mutates a clone; typed loosely because a reject fixture is by construction not of the parsed type. */
	readonly mutate: (contract: any) => void
	readonly issuePath: readonly (string | number)[]
	readonly issueCode: string
	/** set where one mutation legitimately produces more than one issue. */
	readonly issueCount?: number
}

const firstInterface = (contract: any) => contract.permittedInterfaces[0]
const createThing = (contract: any) =>
	firstInterface(contract).operations.find(
		(operation: any) => operation.operationId === 'create-thing',
	)
const listThings = (contract: any) =>
	firstInterface(contract).operations.find(
		(operation: any) => operation.operationId === 'list-things',
	)

export const REJECT_CASES: readonly RejectCase[] = [
	{
		id: 'schema-version-below-one',
		constraint: 'schemaVersion is an integer of at least 1 (AD-11)',
		mutate: (contract) => {
			contract.schemaVersion = 0
		},
		issuePath: ['schemaVersion'],
		issueCode: 'too_small',
	},
	{
		id: 'schema-version-not-an-integer',
		constraint: 'schemaVersion is an integer, never a decimal',
		mutate: (contract) => {
			contract.schemaVersion = 1.5
		},
		issuePath: ['schemaVersion'],
		issueCode: 'invalid_type',
	},
	{
		id: 'contract-id-outside-the-charset',
		constraint: 'every identifier is a kebab slug from the shared charset',
		mutate: (contract) => {
			contract.contractId = 'Exports_API'
		},
		issuePath: ['contractId'],
		issueCode: 'invalid_format',
	},
	{
		id: 'parent-digest-malformed',
		constraint:
			'a digest is "sha256:" plus 64 lowercase hex characters (AD-27)',
		mutate: (contract) => {
			contract.parentDigest = 'sha256:ABC'
		},
		issuePath: ['parentDigest'],
		issueCode: 'invalid_format',
	},
	{
		id: 'behaviors-empty',
		constraint: 'a contract declares at least one behaviour',
		mutate: (contract) => {
			contract.behaviors = []
		},
		issuePath: ['behaviors'],
		issueCode: 'too_small',
	},
	{
		id: 'behavior-id-underpadded',
		constraint: 'an identifier prefix carries three or more digits',
		mutate: (contract) => {
			contract.behaviors[0].id = 'B-1'
		},
		issuePath: ['behaviors', 0, 'id'],
		issueCode: 'invalid_format',
	},
	{
		id: 'severity-outside-the-closed-set',
		constraint: 'severity is low, material, or critical',
		mutate: (contract) => {
			contract.behaviors[0].severity = 'blocker'
		},
		issuePath: ['behaviors', 0, 'severity'],
		issueCode: 'invalid_value',
	},
	{
		id: 'requirement-link-untyped',
		constraint: 'linkage is an opaque string paired with its scheme',
		mutate: (contract) => {
			contract.behaviors[0].requirementLinks = ['REQ-1']
		},
		issuePath: ['behaviors', 0, 'requirementLinks', 0],
		issueCode: 'invalid_type',
	},
	{
		id: 'interface-kind-outside-the-four',
		constraint: 'an interface kind is api, web, cli, or mcp',
		mutate: (contract) => {
			firstInterface(contract).kind = 'grpc'
		},
		issuePath: ['permittedInterfaces', 0, 'kind'],
		issueCode: 'invalid_value',
	},
	{
		id: 'method-lowercased',
		constraint: 'HTTP method is the uppercase closed seven (AD-19)',
		mutate: (contract) => {
			createThing(contract).method = 'post'
		},
		issuePath: ['permittedInterfaces', 0, 'operations', 0, 'method'],
		issueCode: 'invalid_value',
	},
	{
		id: 'path-template-colon-spelling',
		constraint: 'a path template spells parameters as {name}, never :name',
		mutate: (contract) => {
			listThings(contract).pathTemplate = '/things/:id'
		},
		issuePath: ['permittedInterfaces', 0, 'operations', 1, 'pathTemplate'],
		issueCode: 'invalid_format',
	},
	{
		id: 'request-channel-missing',
		constraint: 'a request shape declares all four transport channels',
		mutate: (contract) => {
			delete createThing(contract).requestShape.header
		},
		issuePath: [
			'permittedInterfaces',
			0,
			'operations',
			0,
			'requestShape',
			'header',
		],
		issueCode: 'invalid_type',
	},
	{
		id: 'descriptor-type-outside-the-json-type-names',
		constraint: 'a declared key type is a JSON type name or null',
		mutate: (contract) => {
			createThing(contract).responseDescriptor.types.id = 'uuid'
		},
		issuePath: [
			'permittedInterfaces',
			0,
			'operations',
			0,
			'responseDescriptor',
			'types',
			'id',
		],
		issueCode: 'invalid_value',
	},
	{
		id: 'channel-role-key-not-a-pointer',
		constraint: 'every channel-role key is a descriptor-relative pointer',
		mutate: (contract) => {
			createThing(contract).responseDescriptor.channelRoles = { ok: 'payload' }
		},
		issuePath: [
			'permittedInterfaces',
			0,
			'operations',
			0,
			'responseDescriptor',
			'channelRoles',
			'ok',
		],
		issueCode: 'invalid_key',
	},
	{
		id: 'channel-role-outside-the-four',
		constraint:
			'a channel role is success-indicator, diagnostic, payload, or collection',
		mutate: (contract) => {
			createThing(contract).responseDescriptor.channelRoles['/ok'] = 'header'
		},
		issuePath: [
			'permittedInterfaces',
			0,
			'operations',
			0,
			'responseDescriptor',
			'channelRoles',
			'/ok',
		],
		issueCode: 'invalid_value',
	},
	{
		id: 'success-indicator-in-the-wrong-spelling',
		constraint: 'a nominated success indicator is descriptor-relative',
		mutate: (contract) => {
			createThing(contract).responseDescriptor.successIndicator = '@/ok'
		},
		issuePath: [
			'permittedInterfaces',
			0,
			'operations',
			0,
			'responseDescriptor',
			'successIndicator',
		],
		issueCode: 'invalid_format',
	},
	{
		id: 'expected-cardinality-mode-outside-the-three',
		constraint: 'expected cardinality is exact, at-most, or page-bounded',
		mutate: (contract) => {
			listThings(
				contract,
			).responseDescriptor.collectionLocations[0].expectedCardinality = {
				mode: 'paged',
				max: 20,
			}
		},
		issuePath: [
			'permittedInterfaces',
			0,
			'operations',
			1,
			'responseDescriptor',
			'collectionLocations',
			0,
			'expectedCardinality',
			'mode',
		],
		issueCode: 'invalid_union',
	},
	{
		id: 'expected-cardinality-bound-negative',
		constraint: 'a cardinality bound is a non-negative safe integer (AD-36)',
		mutate: (contract) => {
			listThings(
				contract,
			).responseDescriptor.collectionLocations[0].expectedCardinality = {
				mode: 'exact',
				count: -1,
			}
		},
		issuePath: [
			'permittedInterfaces',
			0,
			'operations',
			1,
			'responseDescriptor',
			'collectionLocations',
			0,
			'expectedCardinality',
			'count',
		],
		issueCode: 'too_small',
	},
	{
		id: 'reference-set-without-keys',
		constraint: 'a reference set names at least one comparison key',
		mutate: (contract) => {
			contract.referenceSets['expected-things'].keys = []
		},
		issuePath: ['referenceSets', 'expected-things', 'keys'],
		issueCode: 'too_small',
	},
	{
		id: 'reference-set-member-not-an-object',
		constraint: 'reference-set members are objects, not scalars (AD-19)',
		mutate: (contract) => {
			contract.referenceSets['expected-things'].members = ['t-1']
		},
		issuePath: ['referenceSets', 'expected-things', 'members', 0],
		issueCode: 'invalid_type',
	},
	{
		id: 'sibling-group-of-one',
		constraint: 'a sibling group carries at least two members',
		mutate: (contract) => {
			contract.siblingGroups.operations = [['create-thing']]
		},
		issuePath: ['siblingGroups', 'operations', 0],
		issueCode: 'too_small',
	},
	{
		id: 'binding-channel-empty-map',
		constraint: 'an unbound binding channel is null, never {}',
		mutate: (contract) => {
			contract.interactionPlan[0].inputBinding.query = {}
		},
		issuePath: ['interactionPlan', 0, 'inputBinding', 'query'],
		issueCode: 'custom',
	},
	{
		id: 'binding-value-untagged',
		constraint: 'a binding value is tagged as a literal or a matcher (AD-39)',
		mutate: (contract) => {
			contract.interactionPlan[0].inputBinding.body.name = 'type-violating'
		},
		issuePath: ['interactionPlan', 0, 'inputBinding', 'body', 'name'],
		issueCode: 'invalid_union',
	},
	{
		id: 'matcher-outside-the-two',
		constraint: 'the closed matcher set is any and type-violating',
		mutate: (contract) => {
			contract.interactionPlan[0].inputBinding.body.name = { matcher: 'random' }
		},
		issuePath: ['interactionPlan', 0, 'inputBinding', 'body', 'name'],
		issueCode: 'invalid_union',
	},
	{
		id: 'operator-arity-under',
		constraint: 'covers-by-key takes exactly two operands',
		mutate: (contract) => {
			contract.oracles[0].check.operands = [{ referenceSet: 'expected-things' }]
		},
		issuePath: ['oracles', 0, 'check', 'operands'],
		issueCode: 'too_small',
	},
	{
		id: 'operator-arity-over',
		constraint: 'covers-by-key takes exactly two operands',
		mutate: (contract) => {
			contract.oracles[0].check.operands.push({
				referenceSet: 'expected-things',
			})
		},
		issuePath: ['oracles', 0, 'check', 'operands'],
		issueCode: 'too_big',
	},
	{
		id: 'operator-outside-the-vocabulary',
		constraint: 'the operator set is closed at sixteen forms',
		mutate: (contract) => {
			contract.oracles[0].check.op = 'approximately'
		},
		issuePath: ['oracles', 0, 'check', 'op'],
		issueCode: 'invalid_union',
	},
	{
		id: 'relation-outside-the-vocabulary',
		constraint: "a direction's relation is drawn from the same sixteen",
		mutate: (contract) => {
			contract.oracles[0].direction.relation = 'matches'
		},
		issuePath: ['oracles', 0, 'direction', 'relation'],
		issueCode: 'invalid_value',
	},
	{
		id: 'polarity-outside-the-two',
		constraint: 'polarity is expects-hold or expects-violation',
		mutate: (contract) => {
			contract.oracles[0].polarity = 'unknown'
		},
		issuePath: ['oracles', 0, 'polarity'],
		issueCode: 'invalid_value',
	},
	{
		id: 'evidence-target-in-the-bound-element-spelling',
		constraint: 'evidence targets are interaction-rooted only',
		mutate: (contract) => {
			contract.oracles[0].direction.evidenceTargets = ['@/id']
		},
		issuePath: ['oracles', 0, 'direction', 'evidenceTargets', 0],
		issueCode: 'invalid_format',
	},
	{
		id: 'rubric-criterion-id-underpadded',
		constraint: 'RC- identifiers carry three or more digits',
		mutate: (contract) => {
			contract.rubrics[0].criteria[0].id = 'RC-1'
		},
		issuePath: ['rubrics', 0, 'criteria', 0, 'id'],
		issueCode: 'invalid_format',
	},
	{
		id: 'rubric-max-length-zero',
		constraint: 'a declared length bound is at least 1; unbounded is null',
		mutate: (contract) => {
			contract.rubrics[0].maxLength = 0
		},
		issuePath: ['rubrics', 0, 'maxLength'],
		issueCode: 'too_small',
	},
	{
		id: 'rubric-evidence-in-the-descriptor-spelling',
		constraint: 'rubric criterion evidence is interaction-rooted',
		mutate: (contract) => {
			contract.rubrics[0].criteria[0].evidence = '/items'
		},
		issuePath: ['rubrics', 0, 'criteria', 0, 'evidence'],
		issueCode: 'invalid_format',
	},
	{
		id: 'waiver-expiry-with-an-offset',
		constraint: 'dates are RFC 3339 in UTC, never a numeric offset',
		mutate: (contract) => {
			contract.waivers[0].expiresAt = '2027-01-01T00:00:00+02:00'
		},
		issuePath: ['waivers', 0, 'expiresAt'],
		issueCode: 'invalid_format',
	},
	{
		id: 'waiver-part-omitted-rather-than-nulled',
		constraint: 'an absent value is explicit null, never an omitted key',
		mutate: (contract) => {
			delete contract.waivers[0].approval
		},
		issuePath: ['waivers', 0, 'approval'],
		issueCode: 'invalid_type',
	},
	{
		id: 'forbidden-input-outside-the-seven',
		constraint:
			'the forbidden-input vocabulary is closed at the prior art seven',
		mutate: (contract) => {
			contract.forbiddenInputs = ['original-spec', 'internal-wiki']
		},
		issuePath: ['forbiddenInputs', 1],
		issueCode: 'invalid_value',
	},
	{
		id: 'money-as-a-number',
		constraint: 'money travels as a string in a declared format (AD-36)',
		mutate: (contract) => {
			contract.budgets.maxCostUsd = 1.5
		},
		issuePath: ['budgets', 'maxCostUsd'],
		issueCode: 'invalid_type',
	},
	{
		id: 'money-negative',
		constraint:
			'a cost ceiling is unsigned; a negative ceiling is not a ceiling',
		mutate: (contract) => {
			contract.budgets.maxCostUsd = '-1.00'
		},
		issuePath: ['budgets', 'maxCostUsd'],
		issueCode: 'invalid_format',
	},
	{
		id: 'money-with-an-exponent',
		constraint: 'the decimal-string format admits no exponent',
		mutate: (contract) => {
			contract.budgets.maxCostUsd = '1e3'
		},
		issuePath: ['budgets', 'maxCostUsd'],
		issueCode: 'invalid_format',
	},
	{
		id: 'probe-step-bound-negative',
		constraint: 'the declared probe-step bound is a non-negative integer',
		mutate: (contract) => {
			contract.probeStepBound = -1
		},
		issuePath: ['probeStepBound'],
		issueCode: 'too_small',
	},
	{
		id: 'scoped-resource-reference-empty',
		constraint: 'a scoped resource names something',
		mutate: (contract) => {
			contract.scopedResources[0].reference = ''
		},
		issuePath: ['scopedResources', 0, 'reference'],
		issueCode: 'too_small',
	},
	{
		id: 'unrecognized-contract-key',
		constraint: 'every control object is strict (Consistency Conventions)',
		mutate: (contract) => {
			contract.strictMode = true
		},
		issuePath: [],
		issueCode: 'unrecognized_keys',
	},
	{
		id: 'unrecognized-oracle-key',
		constraint: 'an oracle carries no author-attested discipline rule label',
		mutate: (contract) => {
			contract.oracles[0].rule = 'per-record'
		},
		issuePath: ['oracles', 0],
		issueCode: 'unrecognized_keys',
	},
	{
		id: 'omitted-nullable-key',
		constraint: 'a nullable key is required and explicitly null',
		mutate: (contract) => {
			delete contract.sourceSpecDigest
		},
		issuePath: ['sourceSpecDigest'],
		issueCode: 'invalid_type',
	},
]
