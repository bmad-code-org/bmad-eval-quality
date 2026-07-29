# Action Log — cc-h0-03-independent-mut2-contract-v2

Base URL: `http://localhost:4002`
Resource: `/api/v1/capsules`

---

## A-001
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/capsules" -H "Authorization: Bearer <USER_A_TOKEN>"
```
**Response (200):**
```
{"data":[... 12 pre-existing capsules for User A, ids including cms3bwgpu000zphoz6q1aba28, cms3bvter000tphozh3g3aiqj, cms3brec70009phozaddfbt46, cms3breb70007phoz4ejlhrcv, cms3bliji0003phozuds01diw, cms3blf6j0001phozwmffi825, cms39j7y7001dphgm8bier2av, cms39hwdo000fphgmq98wo75z, cms39hqke000bphgme2an0yox, cms39hico0009phgmuz1jso5x, cms39he0x0007phgm621kh8jx, cms39ffbx0001phgmwt6snwdp ...]}
```
**Behavior/Oracle:** Baseline discovery, not tied to a single behavior.
**Interpretation:** User A has substantial residue data from earlier sessions. Noted garment IDs used across capsules (e.g. g-1, g-2, g-3, g-4) for reuse in new capsule creation.

---

## A-002
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/garments" -H "Authorization: Bearer <USER_A_TOKEN>"
```
**Response (404):**
```
{"message":"Cannot GET /api/v1/garments","error":"Not Found","statusCode":404}
```
**Behavior/Oracle:** Discovery only.
**Interpretation:** No dedicated garments catalog endpoint under this base path. Will reuse garment IDs already observed embedded in existing capsules.

---

## A-003
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/wardrobe" -H "Authorization: Bearer <USER_A_TOKEN>"
```
**Response (404):**
```
{"message":"Cannot GET /api/v1/wardrobe","error":"Not Found","statusCode":404}
```
**Behavior/Oracle:** Discovery only.
**Interpretation:** No wardrobe endpoint either. Confirms garments are only reachable as embedded objects inside existing capsules.

---

## A-004
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/capsules" -H "Authorization: Bearer <USER_B_TOKEN>"
```
**Response (200):**
```
{"data":[{"id":"cms39j5es001bphgm35asjzb5","name":"Bramblewick Autumn Set","occasions":["autumn","office"],"garments":[{"id":"bg1","name":"Tweed Blazer"},{"id":"bg2","name":"Wool Scarf"}],"isFavorite":false,"createdAt":"2026-07-27T13:28:44.069Z","updatedAt":"2026-07-27T13:28:44.069Z"}]}
```
**Behavior/Oracle:** B-004 baseline (pre-condition capture for later isolation check).
**Interpretation:** User B baseline has exactly 1 pre-existing capsule, distinct garment IDs (bg1, bg2) from User A's. Good isolation baseline for later comparison.

---

## A-005
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "http://localhost:4002/api/v1/capsules" -H "Authorization: Bearer <USER_A_TOKEN>" -H "Content-Type: application/json" -d '{"name":"CC-H0-03 Eval Capsule Main","occasions":["cc-h0-03-main-occ"],"garmentIds":["g-1","g-2"]}'
```
**Response (400):**
```
{"message":"Required; Unrecognized key(s) in object: 'garmentIds'","error":"Bad Request","statusCode":400}
```
**Behavior/Oracle:** B-001 schema discovery.
**Interpretation:** `garmentIds` is not the correct field name.

---

## A-006
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "http://localhost:4002/api/v1/capsules" -H "Authorization: Bearer <USER_A_TOKEN>" -H "Content-Type: application/json" -d '{"name":"CC-H0-03 Eval Capsule Main","occasions":["cc-h0-03-main-occ"],"garments":["g-1","g-2"]}'
```
**Response (400):**
```
{"message":"Expected object, received string; Expected object, received string","error":"Bad Request","statusCode":400}
```
**Behavior/Oracle:** B-001 schema discovery.
**Interpretation:** `garments` expects an array of objects, not strings.

---

## A-007
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "http://localhost:4002/api/v1/capsules" -H "Authorization: Bearer <USER_A_TOKEN>" -H "Content-Type: application/json" -d '{"name":"CC-H0-03 Eval Capsule Main","occasions":["cc-h0-03-main-occ"],"garments":[{"id":"g-1","name":"Denim Jacket"},{"id":"g-2","name":"White Tee"}]}'
```
**Response (201):**
```
{"data":{"id":"cms3dkbzo001tphozynshfxdw","name":"CC-H0-03 Eval Capsule Main","occasions":["cc-h0-03-main-occ"],"garments":[{"id":"g-1","name":"Denim Jacket"},{"id":"g-2","name":"White Tee"}],"isFavorite":false,"createdAt":"2026-07-27T15:21:37.716Z","updatedAt":"2026-07-27T15:21:37.716Z"}}
```
**Behavior/Oracle:** B-001 — create a capsule from 2+ existing garments with name + occasion tag.
**Interpretation:** Capsule "CC-H0-03 Eval Capsule Main" (id `cms3dkbzo001tphozynshfxdw`) created successfully with 2 garments (g-1, g-2), correct name, and correct occasion tag echoed back in response.

---

## A-008
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/capsules/cms3dkbzo001tphozynshfxdw" -H "Authorization: Bearer <USER_A_TOKEN>"
```
**Response (404):**
```
{"message":"Cannot GET /api/v1/capsules/cms3dkbzo001tphozynshfxdw","error":"Not Found","statusCode":404}
```
**Behavior/Oracle:** B-001 — retrieve by ID.
**Interpretation:** No single-resource GET-by-ID route exists for capsules. Retrieval must happen via the list endpoint (oracle allows "fetch it by ID or from a list").

---

## A-009
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/capsules" -H "Authorization: Bearer <USER_A_TOKEN>"
```
**Response (200):**
```
{"data":[{"id":"cms3dkbzo001tphozynshfxdw","name":"CC-H0-03 Eval Capsule Main","occasions":["cc-h0-03-main-occ"],"garments":[{"id":"g-1","name":"Denim Jacket"},{"id":"g-2","name":"White Tee"}],"isFavorite":false,...}, ... 12 other pre-existing capsules ...]}
```
**Behavior/Oracle:** B-001 — retrieve from list.
**Interpretation:** New capsule appears in list with identical name, occasions, and garments as submitted. B-001 oracle satisfied.

---

## A-010
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/capsules?occasion=cc-h0-03-main-occ" -H "Authorization: Bearer <USER_A_TOKEN>"
```
**Response (200):**
```
{"data":[{"id":"cms3dkbzo001tphozynshfxdw","name":"CC-H0-03 Eval Capsule Main","occasions":["cc-h0-03-main-occ"],"garments":[{"id":"g-1","name":"Denim Jacket"},{"id":"g-2","name":"White Tee"}],"isFavorite":false,...}]}
```
**Behavior/Oracle:** B-002 discovery — single-filter (`occasion`) behavior before a second capsule with the same occasion exists.
**Interpretation:** Filter by occasion alone correctly returns only the one capsule with that occasion tag at this point in time.

---

## A-011
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "http://localhost:4002/api/v1/capsules" -H "Authorization: Bearer <USER_A_TOKEN>" -H "Content-Type: application/json" -d '{"name":"CC-H0-03 Eval Capsule Second","occasions":["cc-h0-03-main-occ"],"garments":[{"id":"g-3","name":"Black Suit"},{"id":"g-4","name":"Silk Tie"}]}'
```
**Response (201):**
```
{"data":{"id":"cms3dkoi0001xphoziogv7k8d","name":"CC-H0-03 Eval Capsule Second","occasions":["cc-h0-03-main-occ"],"garments":[{"id":"g-3","name":"Black Suit"},{"id":"g-4","name":"Silk Tie"}],"isFavorite":false,"createdAt":"2026-07-27T15:21:53.928Z","updatedAt":"2026-07-27T15:21:53.928Z"}}
```
**Behavior/Oracle:** Test-data setup for B-002. Creates a capsule ("Second") sharing occasion `cc-h0-03-main-occ` with "Main" but with a different name and different garments — a deliberate "partial match" fixture for composed-filter testing.
**Interpretation:** Second capsule (id `cms3dkoi0001xphoziogv7k8d`) created as designed.

---

## A-012
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/capsules?occasion=cc-h0-03-main-occ&name=Main" -H "Authorization: Bearer <USER_A_TOKEN>"
```
**Response (400):**
```
{"message":"Unrecognized key(s) in object: 'name'","error":"Bad Request","statusCode":400}
```
**Behavior/Oracle:** B-002 discovery — `name` is not a recognized query parameter.
**Interpretation:** Must use a different parameter for name/text search.

---

## A-013
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/capsules?occasion=cc-h0-03-main-occ&q=Main" -H "Authorization: Bearer <USER_A_TOKEN>"
```
**Response (200):**
```
{"data":[{"id":"cms3dkoi0001xphoziogv7k8d","name":"CC-H0-03 Eval Capsule Second","occasions":["cc-h0-03-main-occ"],"garments":[{"id":"g-3","name":"Black Suit"},{"id":"g-4","name":"Silk Tie"}],"isFavorite":false,...},{"id":"cms3dkbzo001tphozynshfxdw","name":"CC-H0-03 Eval Capsule Main","occasions":["cc-h0-03-main-occ"],"garments":[{"id":"g-1","name":"Denim Jacket"},{"id":"g-2","name":"White Tee"}],"isFavorite":false,...}]}
```
**Behavior/Oracle:** B-002 — composed filter (`occasion` + `q`) must return only capsules that satisfy BOTH filters.
**Interpretation:** DEFECT. "CC-H0-03 Eval Capsule Second" does not contain "Main" in its name, so it satisfies only the `occasion` filter (a strict subset), not the `q=Main` filter. Per oracle, it must be excluded from the composed result, but it is returned alongside the fully-matching "Main" capsule. This is confirmed against isolated single-filter baselines in A-014 and A-015 below.

---

## A-014
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/capsules?q=Main" -H "Authorization: Bearer <USER_A_TOKEN>"
```
**Response (200):**
```
{"data":[{"id":"cms3dkbzo001tphozynshfxdw","name":"CC-H0-03 Eval Capsule Main","occasions":["cc-h0-03-main-occ"],"garments":[{"id":"g-1","name":"Denim Jacket"},{"id":"g-2","name":"White Tee"}],"isFavorite":false,...}]}
```
**Behavior/Oracle:** B-002 — isolated `q` filter baseline.
**Interpretation:** `q=Main` alone correctly returns only the "Main" capsule and correctly excludes "Second". This proves the `q` filter itself works standalone — the defect in A-013 is specifically in how `occasion` + `q` are composed together.

---

## A-015
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/capsules?occasion=cc-h0-03-main-occ" -H "Authorization: Bearer <USER_A_TOKEN>"
```
**Response (200):**
```
{"data":[{"id":"cms3dkoi0001xphoziogv7k8d","name":"CC-H0-03 Eval Capsule Second",...},{"id":"cms3dkbzo001tphozynshfxdw","name":"CC-H0-03 Eval Capsule Main",...}]}
```
**Behavior/Oracle:** B-002 — isolated `occasion` filter baseline (now that both capsules share the occasion).
**Interpretation:** Correctly returns both capsules that share the occasion. Combined with A-013 and A-014, this proves the composed filter (`occasion`+`q`) is NOT an AND/intersection — it behaves as if only one of the two filters (whichever matches more broadly) is being applied, leaking a capsule that fails the `q` filter into the composed result. This is a direct, reproducible confirmation of the B-002 defect.

---

## A-016
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH "http://localhost:4002/api/v1/capsules/cms3dkbzo001tphozynshfxdw" -H "Authorization: Bearer <USER_A_TOKEN>" -H "Content-Type: application/json" -d '{"isFavorite":true}'
```
**Response (404):**
```
{"message":"Cannot PATCH /api/v1/capsules/cms3dkbzo001tphozynshfxdw","error":"Not Found","statusCode":404}
```
**Behavior/Oracle:** B-003 discovery.
**Interpretation:** No generic PATCH-by-ID route.

---

## A-017
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PUT "http://localhost:4002/api/v1/capsules/cms3dkbzo001tphozynshfxdw" -H "Authorization: Bearer <USER_A_TOKEN>" -H "Content-Type: application/json" -d '{"isFavorite":true}'
```
**Response (404):**
```
{"message":"Cannot PUT /api/v1/capsules/cms3dkbzo001tphozynshfxdw","error":"Not Found","statusCode":404}
```
**Behavior/Oracle:** B-003 discovery.
**Interpretation:** No generic PUT-by-ID route either.

---

## A-018
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "http://localhost:4002/api/v1/capsules/cms3dkbzo001tphozynshfxdw/favorite" -H "Authorization: Bearer <USER_A_TOKEN>" -H "Content-Type: application/json" -d '{"isFavorite":true}'
```
**Response (404):**
```
{"message":"Cannot POST /api/v1/capsules/cms3dkbzo001tphozynshfxdw/favorite","error":"Not Found","statusCode":404}
```
**Behavior/Oracle:** B-003 discovery.
**Interpretation:** Subresource exists conceptually but not via POST.

---

## A-019
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH "http://localhost:4002/api/v1/capsules/cms3dkbzo001tphozynshfxdw/favorite" -H "Authorization: Bearer <USER_A_TOKEN>" -H "Content-Type: application/json" -d '{"isFavorite":true}'
```
**Response (200):**
```
{"data":{"id":"cms3dkbzo001tphozynshfxdw","name":"CC-H0-03 Eval Capsule Main","occasions":["cc-h0-03-main-occ"],"garments":[{"id":"g-1","name":"Denim Jacket"},{"id":"g-2","name":"White Tee"}],"isFavorite":true,"createdAt":"2026-07-27T15:21:37.716Z","updatedAt":"2026-07-27T15:22:33.616Z"}}
```
**Behavior/Oracle:** B-003 — mark capsule favorite.
**Interpretation:** Correct route found: `PATCH /api/v1/capsules/:id/favorite`. Response shows `isFavorite:true` and updated `updatedAt`.

---

## A-020
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/capsules?favorite=true" -H "Authorization: Bearer <USER_A_TOKEN>"
```
**Response (200):**
```
{"data":[{"id":"cms3dkbzo001tphozynshfxdw","name":"CC-H0-03 Eval Capsule Main",...,"isFavorite":true,...},{"id":"cms3breb70007phoz4ejlhrcv","name":"Zzq Alpha Marker",...,"isFavorite":true,...},{"id":"cms39ffbx0001phgmwt6snwdp","name":"Rainy Day",...,"isFavorite":true,...}]}
```
**Behavior/Oracle:** B-003 — re-fetch via favorites filter after marking favorite.
**Interpretation:** Capsule "Main" now appears in the favorites-filtered list with `isFavorite:true`. Confirms persistence via the read path used by search/list.

---

## A-021
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH "http://localhost:4002/api/v1/capsules/cms3dkbzo001tphozynshfxdw/favorite" -H "Authorization: Bearer <USER_A_TOKEN>" -H "Content-Type: application/json" -d '{"isFavorite":false}'
```
**Response (200):**
```
{"data":{"id":"cms3dkbzo001tphozynshfxdw","name":"CC-H0-03 Eval Capsule Main","occasions":["cc-h0-03-main-occ"],"garments":[{"id":"g-1","name":"Denim Jacket"},{"id":"g-2","name":"White Tee"}],"isFavorite":false,"createdAt":"2026-07-27T15:21:37.716Z","updatedAt":"2026-07-27T15:22:40.834Z"}}
```
**Behavior/Oracle:** B-003 — unmark favorite.
**Interpretation:** `isFavorite` flips back to false in the response.

---

## A-022
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/capsules?favorite=true" -H "Authorization: Bearer <USER_A_TOKEN>"
```
**Response (200):**
```
{"data":[{"id":"cms3breb70007phoz4ejlhrcv","name":"Zzq Alpha Marker",...,"isFavorite":true,...},{"id":"cms39ffbx0001phgmwt6snwdp","name":"Rainy Day",...,"isFavorite":true,...}]}
```
**Behavior/Oracle:** B-003 — re-fetch via favorites filter after unmarking.
**Interpretation:** "Main" capsule no longer appears in the favorites-filtered list. B-003 oracle fully satisfied (mark→true persists and reads true; unmark→false persists and reads false).

---

## A-023
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/capsules" -H "Authorization: Bearer <USER_B_TOKEN>"
```
**Response (200):**
```
{"data":[{"id":"cms39j5es001bphgm35asjzb5","name":"Bramblewick Autumn Set","occasions":["autumn","office"],"garments":[{"id":"bg1","name":"Tweed Blazer"},{"id":"bg2","name":"Wool Scarf"}],"isFavorite":false,...}]}
```
**Behavior/Oracle:** B-004 — capsule list must not leak User A's capsules to User B.
**Interpretation:** User B's list is unchanged from baseline (A-004) and does NOT contain "CC-H0-03 Eval Capsule Main" or "...Second" created by User A. No leak in list endpoint.

---

## A-024
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/capsules?q=Main" -H "Authorization: Bearer <USER_B_TOKEN>"
```
**Response (200):**
```
{"data":[]}
```
**Behavior/Oracle:** B-004 — search must not leak User A's capsule to User B.
**Interpretation:** Empty result. User A's "CC-H0-03 Eval Capsule Main" is not returned to User B even though the same `q=Main` filter returned it for User A (A-014). No leak in search.

---

## A-025
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X GET "http://localhost:4002/api/v1/capsules?occasion=cc-h0-03-main-occ" -H "Authorization: Bearer <USER_B_TOKEN>"
```
**Response (200):**
```
{"data":[]}
```
**Behavior/Oracle:** B-004 — occasion-filtered search must not leak User A's capsules to User B.
**Interpretation:** Empty result, confirming no leak via the `occasion` filter either, even though this same filter returned 2 capsules for User A (A-015).

---

## A-026
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH "http://localhost:4002/api/v1/capsules/cms3dkbzo001tphozynshfxdw/favorite" -H "Authorization: Bearer <USER_B_TOKEN>" -H "Content-Type: application/json" -d '{"isFavorite":true}'
```
**Response (404):**
```
{"message":"Capsule not found","error":"Not Found","statusCode":404}
```
**Behavior/Oracle:** Extension of B-004 — direct-ID mutation (IDOR) probe: User B attempts to favorite User A's capsule by its known ID.
**Interpretation:** Positive confirmation. The server scopes capsule lookups by owner even for direct ID access (not just list/search), returning "Capsule not found" rather than allowing the mutation or leaking existence. No IDOR found.

---

## A-027
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X DELETE "http://localhost:4002/api/v1/capsules/cms3dkbzo001tphozynshfxdw" -H "Authorization: Bearer <USER_A_TOKEN>"
```
**Response (404):**
```
{"message":"Cannot DELETE /api/v1/capsules/cms3dkbzo001tphozynshfxdw","error":"Not Found","statusCode":404}
```
**Behavior/Oracle:** Cleanup attempt for capsule "CC-H0-03 Eval Capsule Main" (id `cms3dkbzo001tphozynshfxdw`).
**Interpretation:** No DELETE route on this path.

---

## A-028
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X DELETE "http://localhost:4002/api/v1/capsules/cms3dkoi0001xphoziogv7k8d" -H "Authorization: Bearer <USER_A_TOKEN>"
```
**Response (404):**
```
{"message":"Cannot DELETE /api/v1/capsules/cms3dkoi0001xphoziogv7k8d","error":"Not Found","statusCode":404}
```
**Behavior/Oracle:** Cleanup attempt for capsule "CC-H0-03 Eval Capsule Second" (id `cms3dkoi0001xphoziogv7k8d`).
**Interpretation:** No DELETE route on this path.

---

## A-029
**Command:**
```
/usr/bin/curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X DELETE "http://localhost:4002/api/v1/capsules/cms3dkbzo001tphozynshfxdw/favorite" -H "Authorization: Bearer <USER_A_TOKEN>"
```
**Response (404):**
```
{"message":"Cannot DELETE /api/v1/capsules/cms3dkbzo001tphozynshfxdw/favorite","error":"Not Found","statusCode":404}
```
**Behavior/Oracle:** Cleanup attempt, alternate route probe.
**Interpretation:** No DELETE route found anywhere under `/api/v1/capsules`. No delete/archive capability is exposed by this API surface within the permitted interface. Cleanup of the two evaluation capsules (`cms3dkbzo001tphozynshfxdw`, `cms3dkoi0001xphoziogv7k8d`) could not be completed via the API. Both remain in User A's account, clearly named "CC-H0-03 Eval Capsule Main" / "...Second" for future identification/removal by the system owner. This is a tooling/interface limitation, not a security defect, and is reported transparently per contract's cleanup requirement.

---

# Summary of cleanup

Attempted DELETE on 3 route variants (A-027, A-028, A-029); all returned 404. No delete endpoint exists in this API surface. Evaluation capsules `cms3dkbzo001tphozynshfxdw` ("CC-H0-03 Eval Capsule Main") and `cms3dkoi0001xphoziogv7k8d` ("CC-H0-03 Eval Capsule Second") remain in User A's account, both toggled back to `isFavorite:false`. Cleanup NOT fully completed — flagged for orchestrator/operator follow-up.

Total Bash tool calls: 29. Total Write tool calls: 2 (this file + isolation draft). Combined: 31 of 40 budget.
