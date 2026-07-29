# Action Log — cc-h0-03-capsule-crud-search

Base URL: `http://localhost:4002`
User A: `Authorization: Bearer test-token:guardian:guardian-1`
User B: `Authorization: Bearer test-token:guardian:guardian-2`

All requests below are the exact curl invocations made and the exact HTTP responses received (headers trimmed to status line + Content-Type for brevity where noted; bodies are verbatim).

---

## 0. API discovery (no garments-list endpoint exists)

**Request:**
```
GET /api/v1/garments
Authorization: Bearer test-token:guardian:guardian-1
```
**Response:**
```
HTTP/1.1 404 Not Found
{"message":"Cannot GET /api/v1/garments","error":"Not Found","statusCode":404}
```
Also tried `GET /api/v1`, `GET /api/v1/wardrobe`, `GET /api/v1/items`, `GET /api/v1/capsules/garments` — all returned the same Express-default `"Cannot GET/POST ..."` 404, confirming no garments-listing route exists under any of these guesses. Garment IDs were instead obtained from the `garments` arrays already embedded in existing capsules returned by `GET /api/v1/capsules` (see below), which satisfies the "pre-existing garments" precondition without needing a dedicated discovery endpoint.

**Request:**
```
GET /api/v1/capsules
Authorization: Bearer test-token:guardian:guardian-1
```
**Response (200, truncated to relevant entries):**
```json
{"data":[
 ...,
 {"id":"cms3blf6j0001phozwmffi825","name":"Weekend Brunch Look","occasions":["brunch","casual"],"garments":[{"id":"g-1","name":"Denim Jacket"},{"id":"g-2","name":"White Tee"}],"isFavorite":false,...},
 {"id":"cms3bliji0003phozuds01diw","name":"Formal Gala Night","occasions":["gala","formal"],"garments":[{"id":"g-3","name":"Black Suit"},{"id":"g-4","name":"Silk Tie"}],"isFavorite":false,...},
 ...
]}
```
This confirmed pre-existing garments `g-1`/`g-2` (Denim Jacket/White Tee) and `g-3`/`g-4` (Black Suit/Silk Tie) already belong to user A (guardian-1), and `bg1`/`bg2` (Tweed Blazer/Wool Scarf) already belong to user B (guardian-2, seen via `GET /api/v1/capsules` as user B, response body: `{"data":[{"id":"cms39j5es001bphgm35asjzb5","name":"Bramblewick Autumn Set","occasions":["autumn","office"],"garments":[{"id":"bg1","name":"Tweed Blazer"},{"id":"bg2","name":"Wool Scarf"}],"isFavorite":false,...}]}`). NOTE: the environment already contained numerous pre-existing capsules for both users from before this evaluation session began (not created by this run); only the two capsules explicitly created below were created by this evaluation.

Create-payload shape was discovered by iteration (400 errors are informative, not defects — they reflect the request being malformed, not the server misbehaving):
- `{"garmentIds":[...]}` → `400 {"message":"Required; Unrecognized key(s) in object: 'garmentIds'"}`
- `{"garments":["g-1","g-2"]}` → `400 {"message":"Expected object, received string; Expected object, received string"}`
- `{"garments":[{"id":"g-1"},{"id":"g-2"}]}` → `400 {"message":"Required; Required"}`
- `{"garments":[{"id":"g-1","name":"Denim Jacket"},{"id":"g-2","name":"White Tee"}]}` → `201 Created` (correct shape: array of `{id,name}` objects)

---

## B-001: Create capsule from 2+ garments with name + occasion tag, retrieve it

**Request:**
```
POST /api/v1/capsules
Authorization: Bearer test-token:guardian:guardian-1
Content-Type: application/json

{"name":"Eval Probe Capsule Alpha","occasions":["eval-probe-alpha"],"garments":[{"id":"g-1","name":"Denim Jacket"},{"id":"g-2","name":"White Tee"}]}
```
**Response:**
```
HTTP/1.1 201 Created
{"data":{"id":"cms3bvter000tphozh3g3aiqj","name":"Eval Probe Capsule Alpha","occasions":["eval-probe-alpha"],"garments":[{"id":"g-1","name":"Denim Jacket"},{"id":"g-2","name":"White Tee"}],"isFavorite":false,"createdAt":"2026-07-27T14:34:34.275Z","updatedAt":"2026-07-27T14:34:34.275Z"}}
```

**Retrieval attempt by ID (route does not exist):**
```
GET /api/v1/capsules/cms3bvter000tphozh3g3aiqj
Authorization: Bearer test-token:guardian:guardian-1
```
```
HTTP/1.1 404 Not Found
{"message":"Cannot GET /api/v1/capsules/cms3bvter000tphozh3g3aiqj","error":"Not Found","statusCode":404}
```
Sanity-checked this wasn't specific to the newly created capsule by retrying against a long-pre-existing capsule ID (`cms39ffbx0001phgmwt6snwdp`) — same `"Cannot GET ..."` 404. This is the generic Express unmatched-route 404 (identical wording to the `/api/v1/garments` 404 above), indicating there is simply no single-resource GET route registered under `/api/v1/capsules/:id`, not a per-record lookup failure. The oracle for B-001 permits retrieval "by ID or from a list," so this is recorded as an observation, not a finding against B-001.

**Retrieval via list (succeeds):**
```
GET /api/v1/capsules
Authorization: Bearer test-token:guardian:guardian-1
```
Filtered to the created record:
```json
{"id":"cms3bvter000tphozh3g3aiqj","name":"Eval Probe Capsule Alpha","occasions":["eval-probe-alpha"],"garments":[{"id":"g-1","name":"Denim Jacket"},{"id":"g-2","name":"White Tee"}],"isFavorite":false,"createdAt":"2026-07-27T14:34:34.275Z","updatedAt":"2026-07-27T14:34:34.275Z"}
```
Name, occasion tag, and both garments match exactly what was submitted. **B-001: HOLDS.**

---

## B-002: Search/filter matches only the intended capsule(s), by name and by tag

Second distinguishable capsule created for contrast:
```
POST /api/v1/capsules
Authorization: Bearer test-token:guardian:guardian-1
Content-Type: application/json

{"name":"Zzyzx Canyon Retreat","occasions":["canyon-hiking-tag"],"garments":[{"id":"g-3","name":"Black Suit"},{"id":"g-4","name":"Silk Tie"}]}
```
```
HTTP/1.1 201 Created
{"data":{"id":"cms3bwgpu000zphoz6q1aba28","name":"Zzyzx Canyon Retreat","occasions":["canyon-hiking-tag"],"garments":[{"id":"g-3","name":"Black Suit"},{"id":"g-4","name":"Silk Tie"}],"isFavorite":false,"createdAt":"2026-07-27T14:35:04.482Z","updatedAt":"2026-07-27T14:35:04.482Z"}}
```

Query-param discovery: `?search=` and `?query=` both rejected with `400 {"message":"Unrecognized key(s) in object: 'search'"}` / `'query'`. `?q=` is the valid name-search param; `?occasion=` is a separate valid tag-filter param (`?tag=` and `?occasions=` both rejected as unrecognized keys).

**Name search, matches only one:**
```
GET /api/v1/capsules?q=Zzyzx
Authorization: Bearer test-token:guardian:guardian-1
```
```
HTTP/1.1 200 OK
{"data":[{"id":"cms3bwgpu000zphoz6q1aba28","name":"Zzyzx Canyon Retreat", ...}]}
```
(Exactly 1 result, the intended capsule — despite a pre-existing, similarly-named "Zzq Alpha/Beta Marker" pair in the dataset, which did NOT match.)

```
GET /api/v1/capsules?q=Eval%20Probe
Authorization: Bearer test-token:guardian:guardian-1
```
```
HTTP/1.1 200 OK
{"data":[{"id":"cms3bvter000tphozh3g3aiqj","name":"Eval Probe Capsule Alpha", ...}]}
```
(Exactly 1 result, the other capsule — confirms no cross-leakage between the two similarly-timed test capsules.)

**Tag search via `q` does NOT match occasions (name-only search) — probed with pre-existing data:**
```
GET /api/v1/capsules?q=vacation      → 200 {"data":[]}
GET /api/v1/capsules?q=beach         → 200 {"data":[]}
```
Both "vacation" and "beach" are occasion tags on the pre-existing capsule "ZephyrCove Getaway" (`occasions:["beach","vacation"]`) but do not appear in its name, and `q=` returned empty for both — confirming `q` is a name-only search, not a name+tag full-text search.

**Tag filtering is available via the separate `occasion` param, and works correctly:**
```
GET /api/v1/capsules?occasion=vacation
Authorization: Bearer test-token:guardian:guardian-1
```
```
HTTP/1.1 200 OK
{"data":[{"id":"cms39hqke000bphgme2an0yox","name":"ZephyrCove Getaway","occasions":["beach","vacation"], ...}]}
```
```
GET /api/v1/capsules?occasion=canyon-hiking-tag
Authorization: Bearer test-token:guardian:guardian-1
```
```
HTTP/1.1 200 OK
{"data":[{"id":"cms3bwgpu000zphoz6q1aba28","name":"Zzyzx Canyon Retreat","occasions":["canyon-hiking-tag"], ...}]}
```
```
GET /api/v1/capsules?occasion=eval-probe-alpha
Authorization: Bearer test-token:guardian:guardian-1
```
```
HTTP/1.1 200 OK
{"data":[{"id":"cms3bvter000tphozh3g3aiqj","name":"Eval Probe Capsule Alpha","occasions":["eval-probe-alpha"], ...}]}
```
Each `occasion=` query returned exactly the one capsule carrying that tag and excluded all others (including the many other multi-tag capsules present in the dataset, e.g. the two "gala"/"formal"-tagged capsules did not appear for `occasion=canyon-hiking-tag` or `occasion=eval-probe-alpha`).

**Conclusion: B-002 HOLDS.** There are two independent, correctly-scoped filters — `q` (capsule name substring) and `occasion` (tag) — and both correctly include only matching capsules and exclude non-matching ones. (Observation, not a defect against the oracle: `q` does not also search occasion tags; a caller wanting tag search must use `occasion=` separately. Noted for completeness since the risk hypothesis worried about partial/leaky filtering — here the filters are narrow/correct rather than leaky.)

---

## B-003: Favorite toggle persists across reads

Endpoint discovery: `PATCH /api/v1/capsules/:id` (no sub-path) → `404 {"message":"Cannot PATCH /api/v1/capsules/cms3bvter000tphozh3g3aiqj"}` (route doesn't exist). `PATCH /api/v1/capsules/:id/favorite` is the correct route.

**Mark favorite:**
```
PATCH /api/v1/capsules/cms3bvter000tphozh3g3aiqj/favorite
Authorization: Bearer test-token:guardian:guardian-1
Content-Type: application/json

{"isFavorite":true}
```
```
HTTP/1.1 200 OK
{"data":{"id":"cms3bvter000tphozh3g3aiqj","name":"Eval Probe Capsule Alpha", ...,"isFavorite":true,"createdAt":"2026-07-27T14:34:34.275Z","updatedAt":"2026-07-27T14:36:20.378Z"}}
```

**Re-read via full list:**
```
GET /api/v1/capsules  (user A)
```
Filtered to record: `{"id": "cms3bvter000tphozh3g3aiqj", ..., "isFavorite": true, ...}` — confirmed persisted.

**Re-read via favorites filter:**
```
GET /api/v1/capsules?favorite=true
Authorization: Bearer test-token:guardian:guardian-1
```
```
HTTP/1.1 200 OK
{"data":[
 {"id":"cms3bvter000tphozh3g3aiqj","name":"Eval Probe Capsule Alpha",...,"isFavorite":true,...},
 {"id":"cms3breb70007phoz4ejlhrcv","name":"Zzq Alpha Marker",...,"isFavorite":true,...},
 {"id":"cms39ffbx0001phgmwt6snwdp","name":"Rainy Day",...,"isFavorite":true,...}
]}
```
All 3 returned records have `isFavorite:true`; no false positives.

**Unmark favorite:**
```
PATCH /api/v1/capsules/cms3bvter000tphozh3g3aiqj/favorite
Authorization: Bearer test-token:guardian:guardian-1
Content-Type: application/json

{"isFavorite":false}
```
```
HTTP/1.1 200 OK
{"data":{"id":"cms3bvter000tphozh3g3aiqj", ...,"isFavorite":false,"updatedAt":"2026-07-27T14:36:31.087Z"}}
```

**Re-read via favorites filter after unmark:**
```
GET /api/v1/capsules?favorite=true
Authorization: Bearer test-token:guardian:guardian-1
```
Result ids: `['cms3breb70007phoz4ejlhrcv', 'cms39ffbx0001phgmwt6snwdp']` — `cms3bvter000tphozh3g3aiqj` is absent, confirming the unmark persisted and is reflected in the favorites-filtered read path (same path used for the "mark" check), addressing the risk hypothesis that favorite state and the list/search read path might diverge.

**Conclusion: B-003 HOLDS** (mark → true persists and shows in favorites filter; unmark → false persists and disappears from favorites filter).

---

## B-004: Cross-user isolation (list, search, and direct mutation)

**User B's full list does not contain any of user A's capsules:**
```
GET /api/v1/capsules
Authorization: Bearer test-token:guardian:guardian-2
```
```
HTTP/1.1 200 OK
{"data":[{"id":"cms39j5es001bphgm35asjzb5","name":"Bramblewick Autumn Set","occasions":["autumn","office"],"garments":[{"id":"bg1","name":"Tweed Blazer"},{"id":"bg2","name":"Wool Scarf"}],"isFavorite":false,...}]}
```
Only user B's own pre-existing capsule appears; none of user A's ~11 capsules (including the two created in this session) appear.

**User B's search cannot find user A's capsules by name:**
```
GET /api/v1/capsules?q=Eval%20Probe   (as user B)  → 200 {"data":[]}
GET /api/v1/capsules?q=Zzyzx          (as user B)  → 200 {"data":[]}
```

**User B's search cannot find user A's capsules by tag:**
```
GET /api/v1/capsules?occasion=canyon-hiking-tag   (as user B)  → 200 {"data":[]}
```

**Direct IDOR probe — user B attempts to mutate user A's capsule by known ID:**
```
PATCH /api/v1/capsules/cms3bvter000tphozh3g3aiqj/favorite
Authorization: Bearer test-token:guardian:guardian-2
Content-Type: application/json

{"isFavorite":true}
```
```
HTTP/1.1 404 Not Found
{"message":"Capsule not found","error":"Not Found","statusCode":404}
```
This is a distinct, application-level "Capsule not found" message (not the generic Express `"Cannot PATCH ..."` route-not-found message seen elsewhere in this log), confirming the server performs an ownership check on this ID rather than merely lacking a route — i.e., cross-user access is actively rejected at the record level, not just absent from listings.

Subsequently re-verified user A still sees the capsule with `isFavorite:false` unaffected by user B's attempted PATCH (not separately re-quoted; consistent with the 404 above, no mutation occurred).

**Conclusion: B-004 HOLDS.** No leakage observed in list, name search, tag search, or direct-ID mutation attempt.

---

## Cleanup

Attempted to fulfill `testData.cleanup` ("Delete any capsule records created during evaluation") for the two capsules created in this session (`cms3bvter000tphozh3g3aiqj`, `cms3bwgpu000zphoz6q1aba28`). No delete endpoint could be found:
```
DELETE /api/v1/capsules/cms3bwgpu000zphoz6q1aba28            → 404 {"message":"Cannot DELETE /api/v1/capsules/cms3bwgpu000zphoz6q1aba28",...}
DELETE /api/v1/capsules/cms3bwgpu000zphoz6q1aba28/           → 404 {"message":"Cannot DELETE /api/v1/capsules/cms3bwgpu000zphoz6q1aba28/",...}
POST   /api/v1/capsules/cms3bwgpu000zphoz6q1aba28/delete     → 404 {"message":"Cannot POST /api/v1/capsules/cms3bwgpu000zphoz6q1aba28/delete",...}
```
All three are generic Express unmatched-route 404s, indicating no delete capability is exposed under `/api/v1/capsules` in any tried form. **Cleanup could not be completed via the permitted API interface.** The two evaluation-created capsules (`cms3bvter000tphozh3g3aiqj` "Eval Probe Capsule Alpha", `cms3bwgpu000zphoz6q1aba28` "Zzyzx Canyon Retreat", both under user A / guardian-1) remain in the system. This is disclosed here rather than silently left out; no destructive/out-of-scope action (e.g. direct DB access) was taken to force cleanup, since only the `api` interface is permitted.
