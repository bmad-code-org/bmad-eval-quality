# Toy system under test — Notes API

This is the spec. **It is a forbidden input** (`original-spec`) and never reaches the evaluator; it
exists so the spike has something real to write a contract about, and so the seeded defect is
independently known.

## Interfaces

`GET /notes/{id}` — returns one note.

```json
{ "ok": true, "note": { "id": "n-1", "title": "…", "body": "…", "tags": ["…"], "updatedAt": "…" } }
```

On a missing note: HTTP 404, `{ "ok": false, "error": "not-found" }`.

`PATCH /notes/{id}` — updates `title`, `body`, or `tags`. Returns the note as it now stands, in the
same envelope as `GET`.

`GET /notes` — returns all notes: `{ "ok": true, "notes": [ …note… ] }`.

## Behaviour worth contracting

1. **B-001 (critical).** A `PATCH` that reports success must actually persist. A later `GET` must
   return the new value.
2. **B-002 (material).** `ok` is the success indicator and must agree with the HTTP status. A body
   carrying `"ok": true` with status 500, or `"ok": true` alongside an `error`, is a defect.
3. **B-003 (material).** Every note in `GET /notes` carries all five fields. Not just the first.
4. **B-004 (low).** A malformed `PATCH` body is rejected with 400 and `ok: false`, not silently
   ignored with a 200.

## The seeded defect — D-001, critical, against B-001

`PATCH /notes/{id}` validates the input, builds the updated note, returns it with `"ok": true` and
HTTP 200 — and never writes it. The response is indistinguishable from a correct one. Only a
subsequent independent `GET` reveals the old value.

This is a natural defect class rather than an invented one: the write's own response is generated from
the in-memory object it declined to persist. Chosen deliberately, because it is the shape that
requires an independent read-back and therefore tests whether the architecture can express such an
oracle at all.
