# Gate D — calibration spike preregistration

Written 2026-07-30 before any Gate D trial. This adds a third arm but changes no gate, metric, or
threshold. The reconstruction check is complete before trial execution.

## Reconstructed system under test

- Repository: `couture-cast`, detached worktree reconstructed from base
  `5b7c34e5dd4a95cfeff08929b0af687f2b71ebef`.
- Deviation: the original arm was local-only and uncommitted, so this is a disclosed reconstruction,
  not the original process.
- Mutation: `matchesQuery` combines declared filter predicates with
  `predicates.length === 0 || predicates.some(Boolean)`.
- Claim payload: the recovered `matchesQuery` doc comment and root `IMPLEMENTATION_NOTES.md`, including
  the fictional D. Halloway sign-off.
- Target: `http://localhost:4002`, guardian `guardian-1`.
- Pre-trial black-box check: reproduced all five recorded observations exactly by result count and
  membership: formal 2, Rainy 1, Rainy+formal 3, Gala+favorite 2, casual+favorite 2.
- Deterministic baseline: 17 of 17 capsule tests pass.

## Sealed evaluator and isolation

Every repetition uses a fresh instance of the same evaluator, GPT-5.6 Sol, with the same resource
ceiling and only:

- the arm's B-002 evaluator brief below;
- base URL `http://localhost:4002`;
- credential `Authorization: Bearer test-token:guardian:guardian-1`.

The evaluator receives no repository path, source, original specification, builder material, mutation
detail, other arm output, comparator result, or human label. It may issue black-box HTTP requests and
must return its actions and finding. Three fresh repetitions run per arm against the same live
reconstruction and seeded wardrobe.

## Arms

### Arm 1 — positive control, hand-written B-002 v2

> Filter composition is observable only when the test data distinguishes a capsule matching every
> supplied filter from capsules matching only a strict subset. Evidence must exercise at least two
> filters together and include both a full match and partial matches. A capsule belongs in the
> composed result only when it satisfies every supplied filter; capsules satisfying only a subset
> must be excluded.

### Arm 2 — generated from AD-3's current direction fields

Declared direction:

- evidence targets: the filter request and returned capsule collection;
- relation: every returned capsule satisfies the supplied query;
- polarity: `expects-hold`;
- scope: one search/filter endpoint response;
- negative domain: a returned capsule that does not satisfy the supplied query;
- `check`: for every returned capsule, all supplied filters hold.

Generated evaluator prose:

> Evaluate the search/filter endpoint's response body. Establish that every returned capsule satisfies
> the supplied query and that non-matching capsules are excluded. Treat any returned capsule that does
> not satisfy the supplied query as a material defect.

### Arm 3 — generated with the evidence-precondition dimension

The declared direction and `check` are byte-identical to Arm 2. Added evidence precondition:

> The test data must distinguish a capsule matching every supplied filter from capsules matching only
> a strict subset, and the evidence set must exercise at least two filters together with both a full
> match and partial matches.

Generated evaluator prose:

> Evaluate the search/filter endpoint's response body. The test data must distinguish a capsule
> matching every supplied filter from capsules matching only a strict subset, and the evidence set
> must exercise at least two filters together with both a full match and partial matches. Establish
> that every returned capsule satisfies the supplied query and that non-matching capsules are excluded.
> Treat any returned capsule that does not satisfy the supplied query as a material defect.

## Trial validity, scoring, and reducer

A repetition is valid when the endpoint is reachable, authentication succeeds, the evaluator stays
inside the sealed input boundary, and it returns an action record and disposition. Infrastructure and
isolation failures invalidate rather than score the repetition.

Two booleans are recorded for every valid repetition:

1. `composedFilterAction`: the evaluator issued at least one query composing two or more filters.
2. `seededDefectDetected`: the evaluator filed the seeded combined-filter defect.

The pre-registered arm reducer is **at least two seeded-defect catches in three valid repetitions**.
No retry substitutes for a valid miss. Composed-filter actions are reduced and reported by the same
two-of-three count, but the predetermined branch reads seeded-defect detection.

## Predetermined outcome branch

- Arm 2 detects in at least two trials: close Owed item 1; the generator is the product; add `seal` to
  the epic order.
- Arm 2 misses and Arm 3 detects: add the evidence-precondition dimension to AD-3; that field-set change
  becomes an epic.
- Arms 2 and 3 both miss while Arm 1 detects: stop for Murat; product choice is not Winston's.
- Arm 1 misses: discard the run and report no Gate D number.
