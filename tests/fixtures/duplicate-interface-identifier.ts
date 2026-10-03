/**
 * Contracts whose `permittedInterfaces` repeat one `logicalId`, built from the
 * populated api contract by appending interfaces that differ from the first in
 * every other way a check could object to: a distinct transport identity per
 * operation and a distinct witness and leg identifier per witness. The only
 * defect each one carries is the repeated identifier, so what it reaches
 * before the check existed is what the identifier alone does.
 *
 * Before `duplicate-interface-identifier`, every contract here compiled and
 * then failed in `seal` as an anonymous `schema-parse-failure`: "duplicate
 * operation id within interface" for the one with an operation id on each
 * interface, "duplicate permittedInterfaces logicalId" for the others. The
 * stages that read a compiled contract without sealing it saw the two
 * interfaces' operations merged into one namespace.
 */
import { cleanPopulatedContract } from '../compile/helpers.ts'

export const FIRST_IDENTIFIER = 'thing-api'

type Plain = Record<string, any>

/** A copy of the first interface, restricted to `create-thing`, under another identity. */
const appended = (
	contract: Plain,
	options: {
		readonly logicalId: string
		readonly operationId: string
		readonly suffix: string
	},
): void => {
	const copy = structuredClone(contract.permittedInterfaces[0]) as Plain
	copy.logicalId = options.logicalId
	copy.operations = copy.operations.filter(
		(operation: Plain) => operation.operationId === 'create-thing',
	)
	for (const operation of copy.operations as Plain[]) {
		// A distinct transport identity, so `duplicate-operation-signature` has
		// nothing to say about the copy.
		operation.operationId = options.operationId
		operation.method = 'PUT'
		operation.pathTemplate = `/other-${options.suffix}`
		let witness = JSON.stringify(operation.sensitivityWitness)
		for (const leg of operation.sensitivityWitness.legs as Plain[]) {
			witness = witness.replaceAll(leg.legId, `${leg.legId}-${options.suffix}`)
		}
		witness = witness.replace(
			operation.sensitivityWitness.witnessId,
			`${operation.sensitivityWitness.witnessId}-${options.suffix}`,
		)
		operation.sensitivityWitness = JSON.parse(witness)
	}
	contract.permittedInterfaces.push(copy)
}

/** Two interfaces named `thing-api`, declaring `create-thing` and `create-thing-again`. */
export const repeatedIdentifierDistinctOperations = (): Plain => {
	const contract = cleanPopulatedContract() as Plain
	appended(contract, {
		logicalId: FIRST_IDENTIFIER,
		operationId: 'create-thing-again',
		suffix: 'b',
	})
	return contract
}

/** Two interfaces named `thing-api`, each declaring `create-thing`. */
export const repeatedIdentifierSharedOperation = (): Plain => {
	const contract = cleanPopulatedContract() as Plain
	appended(contract, {
		logicalId: FIRST_IDENTIFIER,
		operationId: 'create-thing',
		suffix: 'b',
	})
	return contract
}

/** `thing-api`, `other-api`, `thing-api`: the repeat sits at positions 0 and 2. */
export const repeatedIdentifierAroundAnother = (): Plain => {
	const contract = cleanPopulatedContract() as Plain
	appended(contract, {
		logicalId: 'other-api',
		operationId: 'create-other',
		suffix: 'b',
	})
	appended(contract, {
		logicalId: FIRST_IDENTIFIER,
		operationId: 'create-third',
		suffix: 'c',
	})
	return contract
}

/** Three interfaces with three identifiers. */
export const distinctIdentifiers = (): Plain => {
	const contract = cleanPopulatedContract() as Plain
	appended(contract, {
		logicalId: 'other-api',
		operationId: 'create-other',
		suffix: 'b',
	})
	appended(contract, {
		logicalId: 'third-api',
		operationId: 'create-third',
		suffix: 'c',
	})
	return contract
}
