# After eval-quality: a bmad-tea skill that supplies the parts eval-quality refuses to ship

Status: an idea recorded so it is not lost. No work is scheduled here, and none of it belongs to
this repository.

## The idea

eval-quality is deliberately incomplete, and it says so on every page. It executes nothing: no agent,
no judge, and no system under test runs inside it. It ships no engine integration, so `agentevals`
and its peers are named in the spine's Deferred list rather than wrapped. It ships no reference
`EnvironmentProbePort` for `api`, because probing a live HTTP environment is the part only the caller
can write. Running the two arms, running the evaluator, and sealing what the evaluator produced into
a run record are all the caller's.

That boundary is the product's character and it should stay. What it means in practice is that an
adopter holding only eval-quality has a contract language, a compiler, a scorer and an evidence
format, and still has to build the harness that drives them.

The idea is a skill in `bmad-method-test-architecture-enterprise` (bmad-tea), named something like
`evaluate`, `eval`, or `evaluate-quality`, that supplies exactly those missing parts, so a user
reaches for one bmad-tea skill and gets their whole testing need handled across the five system
shapes eval-quality names:

- agent behavior
- skill behavior
- tool-use behavior
- workflow behavior
- end-to-end AI feature behavior

## Why it belongs in bmad-tea rather than here

Every part the skill would supply is a part eval-quality refuses on purpose. Adding an executor, a
judge driver, or a network adapter to this package would reverse AD-2, AD-35 and AD-15 and turn a
library that describes evaluations into one that performs them. bmad-tea is where an opinionated harness can
live without costing eval-quality the property that makes it auditable.

The dependency runs one way: the skill consumes the published `eval-quality` package through its
documented subpaths, and nothing the tarball ships learns about the skill.

## Preconditions

Epic 11 closes the fifth interface kind and, with Stories 11.10 through 11.12, the evidence for the
three shapes whose guides currently record something unproven. Until that lands, a skill built on top
would be building on a shape the library cannot yet demonstrate. So this is work for after
eval-quality is done, which is the sequencing the idea was raised with.

## What a story for it would have to settle

These are the questions, recorded so the eventual story starts from them rather than rediscovering
them.

- Which of the missing parts the skill supplies itself and which it asks the user for. An executor
  for a command-line agent is cheap; a judge driver commits to a model and a prompt, and a network
  adapter commits to an authorization policy the user has to own under AD-35.
- How the skill maps a user's system onto one of the five shapes, and what it does when a system is
  two of them at once.
- Where the authorized-target mapping lives, given that AD-35 keeps it outside the contract by
  design.
- Whether the skill seals its own run records, which makes it responsible for AD-16's isolation
  manifest and the seven forbidden inputs.
- What it does about the two things eval-quality still owes itself, the held-out probe corpus and the
  second experiment round, since a harness that hides those makes a weaker claim look like a
  stronger one.
