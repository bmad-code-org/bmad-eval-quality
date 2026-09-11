/**
 * Folds a list of readings into one total. The rounding rule is stated in
 * README.md, which the published package carries.
 */
export const reduce = (readings: readonly number[]): number =>
	readings.reduce((total, each) => total + each, 0)
