/// <reference path="./schema/shape.ts" />
// The reference directive crosses model/ -> model/schema/, which the graph
// grants, so the gate reads it and passes it. The edge is what the rule binds.
import type { Shape } from './schema/shape.ts'

export function normalise(shape: Shape): Shape {
	return { id: shape.id.trim(), weight: Math.abs(shape.weight) }
}
