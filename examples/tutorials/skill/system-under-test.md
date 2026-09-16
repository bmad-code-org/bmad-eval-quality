# The skill under evaluation, and the strategy that games it

The skill is a selection rule set. Given a case, it names the items that apply to it.

For the frontend case the rules mandate interaction-rules, timing-rules, quality-rules, and they exclude
mobile-rules and contract-rules.

`skill-runner.mjs` applies those rules. Run it with `--case frontend` and it names the three
mandated items. Run it with `--degenerate` and it names every item in its index instead.

The degenerate reply is the point of this lab. It is not a bug in the runner and it is not a
defect an agent would be embarrassed by: it is the cheapest reply that satisfies a question
phrased as "did you include everything you had to include". A contract that asks only that is
satisfied by a run that thought about nothing.

Nothing in this repository runs an agent. The observations in the two sealed run records are the
replies this runner prints, recorded as a harness would have recorded them, so the four commands
can be run over real bytes.
