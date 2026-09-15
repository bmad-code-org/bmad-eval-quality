// `readReport` was renamed to `parseReport` here. The old name survives in this
// comment, which is what a check reading mentions rather than declarations would
// still find.
export const parseReport = (text: string): unknown => JSON.parse(text)

/** The report kinds this fixture tool reads, and the two it accepts. */
export const REPORT_KINDS = ['json', 'yaml', 'toml'] as const
export const ACCEPTED_KINDS = ['json', 'yaml'] as const
export const REFUSED_KINDS = ['toml'] as const
