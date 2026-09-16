# The system under test, and the defect seeded in it

`release-notes-agent.mjs` reads a changelog whose every line is `<type>: <description>`, writes a
notes file, and exits.

`summarize` parses the changelog and writes `{ summary, entries, source }`. A line carrying no
recognised type is a parse failure: the agent says which line on standard error and exits 1, and it
writes no notes file.

`show` reads a notes file back and prints it as JSON on standard output.

The seeded defect, D-001, is in `summarize`. It swallows the parse failure, writes a notes file whose
`entries` is empty, and exits 0. Two symptoms follow from one edit, and they land on different
channels. The empty file is what the manifestation witness reads. The zero exit is what the defect
signature reads, because a scoring-side signature may not address a file the command wrote.

The `--defective` flag selects the mutated handler. In a real twin run you edit the handler, run both
arms, and put it back, which is what the probe's `rollbackVerified` records. Nothing in this
repository runs the agent during a check: the observations committed beside it are the evidence a
harness is stipulated to have collected, and the chain exists so the four commands can be run over
real bytes.
