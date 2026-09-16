#!/usr/bin/env node
// A deterministic stand-in for a skill an agent loads and acts on.
//
// The skill's job is selection: given a case, name the items that apply to it.
// That decision is the thing the contract holds the skill responsible for, so
// the runner prints it as JSON on stdout and nothing else.
//
// --degenerate is the cheap answer. It names every item in the index, which
// contains everything the rules mandate for any case, so an evaluation that
// only checks for the mandated items is satisfied by it.

const INDEX = [
	"interaction-rules",
	"timing-rules",
	"quality-rules",
	"api-rules",
	"data-rules",
	"mobile-rules",
	"contract-rules"
]

const RULES = {
	frontend: ["interaction-rules","timing-rules","quality-rules"],
	backend: ["api-rules","data-rules"],
}

const optionValue = (name) => {
	const at = process.argv.indexOf(`--${name}`)
	return at === -1 ? null : (process.argv[at + 1] ?? null)
}

const skill = optionValue('skill')
if (skill !== 'checklist-selection') {
	process.stderr.write('skill-runner: --skill checklist-selection is required\n')
	process.exit(64)
}

const requested = optionValue('case')
const mandated = RULES[requested]
if (mandated === undefined) {
	process.stderr.write(
		`skill-runner: --case must be one of ${Object.keys(RULES).join(', ')}\n`,
	)
	process.exit(64)
}

const selected = process.argv.includes('--degenerate') ? INDEX : mandated
process.stdout.write(`${JSON.stringify({ selected })}\n`)
