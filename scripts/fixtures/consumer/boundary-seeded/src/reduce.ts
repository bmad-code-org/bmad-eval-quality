// Generated from /Users/ci/checkout/schemas/reading.json; do not edit by hand.
export const reduce = (readings: readonly number[]): number =>
	readings.reduce((total, each) => total + each, 0)
