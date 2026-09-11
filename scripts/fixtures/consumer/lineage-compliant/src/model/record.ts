/** The shape. Both owned fields are declared here and nowhere else. */
export type Sealed = {
	readonly id: string
	readonly ownerId: string
	readonly sealedAt: string
}
