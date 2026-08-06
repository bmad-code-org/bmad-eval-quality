# Gate C system under test — asynchronous export job API

Chosen because it is unlike the notes toy on every axis the schema has to survive: the result of
the write is not in the write's response, the collection is cursor-paginated rather than returned
whole, the collection is soft-delete filtered, and the causal chain is three phases deep rather
than two. Two of the gate's three suggested shapes are present at once (cursor pagination with a
soft-delete filter, and 202-then-poll), which is deliberate — the ambiguities worth finding are
the ones at the seams between features, not inside one.

## Operations

`POST /exports` — submit an export job. Body carries `datasetId` and `filters`. Responds `202`
with `{ jobId, state: "queued", statusPath }`. Accepts an `Idempotency-Key` header; a repeat with
the same key returns the same `jobId`.

`GET /exports/{jobId}` — poll one job. Responds `200` with `{ jobId, state, submittedFilters,
rowCount, completedAt }` where `state` is one of `queued`, `running`, `succeeded`, `failed`, and
`rowCount` is present only once `state` is `succeeded`. A failed job carries `failureReason`.
Unknown `jobId` responds `404` with `{ error }`.

`GET /exports/{jobId}/rows?cursor=&limit=` — page the finished result. Responds `200` with
`{ rows, nextCursor }`. `rows` carries at most `limit` elements, default 20, and **excludes rows
whose `retractedAt` is set**, which is the soft-delete filter. Each row carries
`id`, `datasetId`, `capturedAt`, `payload`. `nextCursor` is absent on the last page. Unknown
`jobId` responds `404`.

## Seeded world

Dataset `ds-7` holds 100 rows matching the declared filters, of which 3 are retracted, so a
correct export reports `rowCount: 97` and the reference set `expected-export-rows` holds those 97
identifiers. Page size is 20, so the first page is a strict subset of the reference set and no
bijection between them exists — which is the case AD-20 rule 6 could not express before
revision 7.
