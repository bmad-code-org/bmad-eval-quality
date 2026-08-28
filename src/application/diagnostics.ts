/**
 * The caller-supplied diagnostic sink and the shape it receives. A plain
 * callback: it returns nothing the core reads, so there is nothing to validate
 * and nothing to await, which is why the logging convention keeps it out of
 * `ports/`.
 *
 * Only stages carrying a run identifier emit. `compile` and `seal` take no run
 * identifier, so a line either of them wrote would carry no run id and no
 * stage, and they emit nothing.
 */

/** One diagnostic. `stage` is the emitting stage, never the command. */
export type Diagnostic = {
	readonly runId: string
	readonly stage: 'preflight'
	readonly message: string
}

export type DiagnosticSink = (diagnostic: Diagnostic) => void

/**
 * Emits when a sink is present. A throwing sink is the caller's defect and
 * propagates: discarding it would make a broken sink look like a quiet run.
 */
export function emit(
	sink: DiagnosticSink | undefined,
	diagnostic: Diagnostic,
): void {
	if (sink !== undefined) sink(diagnostic)
}
