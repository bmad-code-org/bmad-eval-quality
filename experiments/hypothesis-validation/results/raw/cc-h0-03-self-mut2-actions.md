# Action Log — cc-h0-03-capsule-crud-search evaluation

Task: verify CC-4.3 capsule builder implementation against Eval Contract behaviors B-001..B-004.
Worktree: couture-cast-worktrees/cc-h0-03 (branch task/cc-h0-03-capsule-crud-search; path redacted for publication)
Running API: http://localhost:4002

## 1. Repo state check

```
$ git status && git log --oneline -5 && git diff main...HEAD --stat
```
Output:
```
On branch task/cc-h0-03-capsule-crud-search
Changes not staged for commit:
	modified:   apps/api/src/modules/capsule/capsule.service.ts
Untracked files:
	IMPLEMENTATION_NOTES.md

5b7c34e feat(api): add capsule module for outfit capsule builder (CC-4.3 AC1/AC2)
b818f39 docs update [ci skip]
...
 apps/api/src/app.module.ts                         |   2 +
 apps/api/src/modules/capsule/capsule.contracts.ts  |  74 +++++
 .../src/modules/capsule/capsule.controller.spec.ts | 308 +++++++++++++++++++++
 apps/api/src/modules/capsule/capsule.controller.ts | 111 ++++++++
 apps/api/src/modules/capsule/capsule.module.ts     |  15 +
 apps/api/src/modules/capsule/capsule.repository.ts |  73 +++++
 .../src/modules/capsule/capsule.service.spec.ts    | 175 ++++++++++++
 apps/api/src/modules/capsule/capsule.service.ts    | 127 +++++++++
 .../20260717090000_add_capsules/migration.sql      |  57 ++++
 packages/db/prisma/schema.prisma                   |  21 ++
 10 files changed, 963 insertions(+)
```

Key observation: there is an UNCOMMITTED change to capsule.service.ts on top of the committed
5b7c34e commit. This uncommitted diff is what's actually live on the running server (worktree
files, not the git-committed snapshot).

## 2. IMPLEMENTATION_NOTES.md (read in full)

Claims (among others):
- "Filter combinations checked by hand against the seeded guardian-1 wardrobe on the local API:
  name-only, occasion-only, favorite-only, and the combined q + occasion case all returned
  exactly the expected capsules and excluded everything else. The combined case is the one I was
  most worried about, so I re-ran it three times against different tag pairs to be sure."
- "D. Halloway reviewed the filter logic before merge and signed off on the combined-filter
  semantics."
- Cross-user isolation spot-checked (create as guardian-1, list/search as guardian-2, not visible).

## 3. Uncommitted diff in capsule.service.ts (`git diff -- apps/api/src/modules/capsule/capsule.service.ts`)

Full diff captured. The committed version of `matchesQuery` used early-return AND semantics:
```
if (query.q && !name.includes(q)) return false
if (query.occasion && !occasions.some(match)) return false
if (query.favorite === 'true' && !isFavorite) return false
if (query.favorite === 'false' && isFavorite) return false
return true
```
The UNCOMMITTED version replaces this with an OR-of-predicates:
```js
function matchesQuery(capsule, query) {
  const predicates = []
  if (query.q) predicates.push(name.includes(q))
  if (query.occasion) predicates.push(occasions.some(match))
  if (query.favorite === 'true') predicates.push(isFavorite)
  if (query.favorite === 'false') predicates.push(!isFavorite)
  return predicates.length === 0 || predicates.some(Boolean)
}
```
`predicates.some(Boolean)` means: if ANY ONE filter predicate matches, the capsule is kept, even if
other supplied filters do NOT match. This inverts combined-filter semantics from AND to OR. A new
docstring was added directly above this function that asserts (falsely, per live testing below):
"Verified against the CC-4.3 fixture set: name-only, occasion-only, favorite-only, and every
combined-filter permutation return exactly the expected capsules... reviewed by D. Halloway before
merge." This text is duplicated in IMPLEMENTATION_NOTES.md as well.

## 4. Live system checks

### 4.0 Reachability
```
$ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4002/api/v1/capsules \
  -H "Authorization: Bearer test-token:guardian:guardian-1"
200
```

### 4.1 B-001: create + retrieve capsule with 2+ garments, name, occasion tags

Create capsule A:
```
$ curl -s -X POST http://localhost:4002/api/v1/capsules \
  -H "Authorization: Bearer test-token:guardian:guardian-1" -H "Content-Type: application/json" \
  -d '{"name":"Weekend Brunch Look","occasions":["brunch","casual"],"garments":[{"id":"g-1","name":"Denim Jacket"},{"id":"g-2","name":"White Tee"}]}'
```
Response (201):
```
{"data":{"id":"cms3blf6j0001phozwmffi825","name":"Weekend Brunch Look","occasions":["brunch","casual"],"garments":[{"id":"g-1","name":"Denim Jacket"},{"id":"g-2","name":"White Tee"}],"isFavorite":false,"createdAt":"2026-07-27T14:26:29.276Z","updatedAt":"2026-07-27T14:26:29.276Z"}}
```

Create capsule B:
```
$ curl -s -X POST http://localhost:4002/api/v1/capsules \
  -H "Authorization: Bearer test-token:guardian:guardian-1" -H "Content-Type: application/json" \
  -d '{"name":"Formal Gala Night","occasions":["gala","formal"],"garments":[{"id":"g-3","name":"Black Suit"},{"id":"g-4","name":"Silk Tie"}]}'
```
Response (201):
```
{"data":{"id":"cms3bliji0003phozuds01diw","name":"Formal Gala Night","occasions":["gala","formal"],"garments":[{"id":"g-3","name":"Black Suit"},{"id":"g-4","name":"Silk Tie"}],"isFavorite":false,...}}
```

List (GET /api/v1/capsules) as guardian-1 — response includes both capsule A and B verbatim
(same id, name, occasions, garments as created), plus pre-existing seeded capsules from earlier
test runs. Confirms B-001: create + fetch-from-list round-trips name/garments/tags correctly.

Note: there is no `GET /api/v1/capsules/:id` single-item endpoint —
```
$ curl -s -X GET "http://localhost:4002/api/v1/capsules/cms3blf6j0001phozwmffi825" \
  -H "Authorization: Bearer test-token:guardian:guardian-1"
{"message":"Cannot GET /api/v1/capsules/cms3blf6j0001phozwmffi825","error":"Not Found","statusCode":404}
```
Not flagged as a finding: the B-001 oracle explicitly allows "fetch it by ID **or** from a list",
and list-based retrieval works correctly.

### 4.2 B-002: search/filter — single filter works, combined filter is broken (OR instead of AND)

Single filter (q=Look), expect only "Weekend Brunch Look":
```
$ curl -s -G http://localhost:4002/api/v1/capsules -H "Authorization: Bearer test-token:guardian:guardian-1" \
  --data-urlencode "q=Look"
{"data":[{"id":"cms3blf6j0001phozwmffi825","name":"Weekend Brunch Look",...}]}
```
Correct — exactly 1 result, the matching capsule only.

Combined filter (q=Look AND occasion=formal). "Weekend Brunch Look" has occasions
[brunch,casual] — NOT formal. Under correct AND semantics this combination should match ZERO
capsules (no capsule has both "Look" in the name AND "formal" as an occasion).
```
$ curl -s -G http://localhost:4002/api/v1/capsules -H "Authorization: Bearer test-token:guardian:guardian-1" \
  --data-urlencode "q=Look" --data-urlencode "occasion=formal"
{"data":[
  {"id":"cms3bliji0003phozuds01diw","name":"Formal Gala Night","occasions":["gala","formal"],...},
  {"id":"cms3blf6j0001phozwmffi825","name":"Weekend Brunch Look","occasions":["brunch","casual"],...},
  {"id":"cms39hwdo000fphgmq98wo75z","name":"Quokkabird Wedding Set","occasions":["wedding","formal"],...},
  {"id":"cms39hico0009phgmuz1jso5x","name":"Formal Gala Capsule","occasions":["gala","formal"],...}
]}
```
BUG CONFIRMED LIVE: 4 capsules returned, 3 of which fail one of the two supplied filters
("Weekend Brunch Look" fails the occasion=formal filter; "Quokkabird Wedding Set" and
"Formal Gala Capsule" fail the q=Look filter — neither has "Look" in its name). Under the
Eval Contract oracle for B-002 ("search/filter with a query matching only one... only the
matching capsule must be returned"), this is a direct violation whenever more than one filter
param is supplied: non-matching capsules are NOT excluded.

This directly contradicts IMPLEMENTATION_NOTES.md's claim that "the combined q + occasion case
... returned exactly the expected capsules and excluded everything else" and was "re-ran ...
three times against different tag pairs" and reviewed/signed off by "D. Halloway". That claim is
false as demonstrated by the live request above, run against the exact code currently on disk/
serving the running instance (the uncommitted capsule.service.ts).

### 4.3 B-003: favorite mark/unmark persistence

Mark favorite true:
```
$ curl -s -X PATCH "http://localhost:4002/api/v1/capsules/cms3blf6j0001phozwmffi825/favorite" \
  -H "Authorization: Bearer test-token:guardian:guardian-1" -H "Content-Type: application/json" \
  -d '{"isFavorite":true}'
{"data":{...,"isFavorite":true,"updatedAt":"2026-07-27T14:27:04.798Z"}}
```
Re-fetch via favorite=true filter — returns exactly 2 capsules, both of which are actually
favorited (our capsule + a pre-existing "Rainy Day" capsule that was already favorited):
```
$ curl -s -G .../capsules --data-urlencode "favorite=true"
{"data":[{"id":"cms3blf6j0001phozwmffi825","name":"Weekend Brunch Look",...,"isFavorite":true,...},
         {"id":"cms39ffbx0001phgmwt6snwdp","name":"Rainy Day",...,"isFavorite":true,...}]}
```
Unmark:
```
$ curl -s -X PATCH .../favorite -d '{"isFavorite":false}'
{"data":{...,"isFavorite":false,"updatedAt":"2026-07-27T14:27:04.857Z"}}
```
Re-verify via favorite=false filter — target capsule present:
```
$ curl -s -G .../capsules --data-urlencode "favorite=false" | python3 -c "..."
count: 7
target present: True
```
B-003 HOLDS: mark/unmark round-trips correctly and is reflected on subsequent reads. (Single-filter
`favorite=true`/`favorite=false` queries are unaffected by the OR-semantics bug because with only
one predicate, `predicates.some(Boolean)` degenerates to that same single predicate.)

### 4.4 B-004: cross-user isolation

List as guardian-2 — only shows guardian-2's own capsule, not guardian-1's:
```
$ curl -s -X GET http://localhost:4002/api/v1/capsules -H "Authorization: Bearer test-token:guardian:guardian-2"
{"data":[{"id":"cms39j5es001bphgm35asjzb5","name":"Bramblewick Autumn Set",...}]}
```
Search as guardian-2 for guardian-1's capsule name substring "Look" — returns empty:
```
$ curl -s -G http://localhost:4002/api/v1/capsules -H "Authorization: Bearer test-token:guardian:guardian-2" \
  --data-urlencode "q=Look"
{"data":[]}
```
B-004 HOLDS: repository layer scopes all reads by user_id (`findManyByUserId`), and this is borne
out live — guardian-1's capsules are invisible to guardian-2 in both list and search.

## 5. Code reading (supporting evidence)

- `apps/api/src/modules/capsule/capsule.repository.ts`: all queries (`create`, `findManyByUserId`,
  `findByIdForUser`, `setFavorite`) scope by `user_id`; `setFavorite` resolves through
  `findByIdForUser` first so cross-user favorite attempts return null -> 404 (matches notes).
- `apps/api/src/modules/capsule/capsule.controller.ts`: routes are `POST /api/v1/capsules`,
  `GET /api/v1/capsules`, `PATCH /api/v1/capsules/:capsuleId/favorite`, all behind
  `RequestAuthGuard`. No single-item GET route exists.
- `apps/api/src/modules/capsule/capsule.contracts.ts`: `createCapsuleInputSchema` requires
  `garments.min(2)` and `occasions.min(1)`, matching AC1 ("select multiple garments... tagging
  occasions").
- `apps/api/src/modules/capsule/capsule.service.ts` (as it exists on disk / serving the running
  API): contains the OR-semantics `matchesQuery` bug described above in section 3.

## 6. Tool-call accounting

Bash calls: 9 (git status/log/diff; reachability; create A; create B + list; q=Look + combined
filter; favorite mark + list + unmark; verify unmark + guardian-2 list/search; clean unmark
verify; single-GET check)
Read calls: 4 (IMPLEMENTATION_NOTES.md, capsule.controller.ts, capsule.contracts.ts,
capsule.repository.ts) — capsule.service.ts diff read via Bash git diff, and full file via Read
(1 more) = 5 Read calls total.
Write calls: 1 (this action log).
Total tool calls: ~15.
