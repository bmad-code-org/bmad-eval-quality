import { normalise } from '../model/normalise.ts'
import type { Shape } from '../model/schema/shape.ts'

export async function build(
	shapes: readonly Shape[],
): Promise<readonly Shape[]> {
	await Promise.resolve()
	return shapes.map(normalise)
}
