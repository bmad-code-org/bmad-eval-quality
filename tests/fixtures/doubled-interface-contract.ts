/**
 * A contract copied onto a second interface that declares every one of its
 * operations again under the same ids. Steps, oracles and behaviors are copied
 * with a suffix, so the copy is a complete second evaluation of the same
 * operations through `<interface>-v2`.
 *
 * It lets a case hold the oracles of one interface and drop the other's: a site
 * of the first interface then has steps for its own operation ids on the other
 * interface and no oracle of its own, which only a lookup by the pair can tell
 * from a satisfied site.
 */
import { EvalContract } from '../../src/core/schemas/eval-contract.ts'

type Plain = Record<string, unknown>

const SUFFIX = '-v2'

/** Rewrites the identifiers of the copy inside any JSON value. */
const renamed = (value: unknown, stepIds: readonly string[]): unknown => {
	let text = JSON.stringify(value)
	for (const stepId of stepIds) {
		text = text.replaceAll(
			`/interactions/${stepId}/`,
			`/interactions/${stepId}${SUFFIX}/`,
		)
		text = text.replaceAll(
			`"after":"${stepId}"`,
			`"after":"${stepId}${SUFFIX}"`,
		)
	}
	return JSON.parse(text)
}

/** A witness and its legs are named across the whole contract, so the copy renames them. */
const renamedWitness = (witness: unknown): unknown => {
	if (witness === null || witness === undefined) return null
	const source = witness as { witnessId: string; legs: { legId: string }[] }
	let text = JSON.stringify(witness)
	for (const { legId } of source.legs) {
		text = text.replaceAll(`"${legId}"`, `"${legId}${SUFFIX}"`)
		text = text.replaceAll(
			`/interactions/${legId}/`,
			`/interactions/${legId}${SUFFIX}/`,
		)
	}
	text = text.replaceAll(
		`"${source.witnessId}"`,
		`"${source.witnessId}${SUFFIX}"`,
	)
	return JSON.parse(text)
}

const oracleIdOf = (id: string): string => `O-1${id.slice(2)}`

export type DoubledContract = {
	/** every oracle of the original interface and of its copy. */
	readonly both: EvalContract
	/** only the copy's oracles: the original interface's sites have steps and no oracle. */
	readonly copyOraclesOnly: EvalContract
	/** only the original's oracles, a control that leaves the copy's sites unsatisfied. */
	readonly originalOraclesOnly: EvalContract
	readonly originalInterface: string
	readonly copyInterface: string
}

export const doubleInterface = (source: Plain): DoubledContract => {
	const base = structuredClone(source) as Plain
	const interfaces = base.permittedInterfaces as Plain[]
	const [original] = interfaces
	if (original === undefined)
		throw new Error('the source declares no interface')
	const originalInterface = original.logicalId as string
	const copyInterface = `${originalInterface}${SUFFIX}`
	const steps = base.interactionPlan as Plain[]
	const stepIds = steps.map((step) => step.stepId as string)
	const oracles = base.oracles as Plain[]

	const copiedInterface = {
		...structuredClone(original),
		logicalId: copyInterface,
		// Two interfaces may not expose one method and path template, so the copy
		// serves its operations under a prefix.
		operations: (original.operations as Plain[]).map((operation) => ({
			...structuredClone(operation),
			...(typeof operation.pathTemplate === 'string'
				? { pathTemplate: `/v2${operation.pathTemplate}` }
				: {}),
			sensitivityWitness: renamedWitness(operation.sensitivityWitness),
		})),
	}
	const copiedSteps = steps.map((step) => ({
		...(renamed(step, stepIds) as Plain),
		stepId: `${step.stepId as string}${SUFFIX}`,
		interfaceId: copyInterface,
	}))
	const copiedOracles = oracles.map((oracle) => ({
		...(renamed(oracle, stepIds) as Plain),
		id: oracleIdOf(oracle.id as string),
	}))
	const behaviors = (base.behaviors as Plain[]).map((behavior) => ({
		...behavior,
		oracles: [
			...(behavior.oracles as string[]),
			...(behavior.oracles as string[]).map(oracleIdOf),
		],
	}))
	const withOracles = (kept: Plain[]): EvalContract =>
		EvalContract.parse({
			...base,
			behaviors: behaviors.map((behavior) => ({
				...behavior,
				oracles: (behavior.oracles as string[]).filter((id) =>
					kept.some((oracle) => oracle.id === id),
				),
			})),
			oracles: kept,
			permittedInterfaces: [...interfaces, copiedInterface],
			interactionPlan: [...steps, ...copiedSteps],
		})
	return {
		both: withOracles([...oracles, ...copiedOracles]),
		copyOraclesOnly: withOracles(copiedOracles),
		originalOraclesOnly: withOracles(oracles),
		originalInterface,
		copyInterface,
	}
}
