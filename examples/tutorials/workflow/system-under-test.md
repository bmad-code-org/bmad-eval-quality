# The system under test, and the defect seeded in it

A toy thing service with three operations.

`POST /things` files a record and answers with the identifier it filed it under, `ok: true`, and the
name it was sent.

`GET /things/{id}` returns the record filed under that identifier.

`POST /things/reset` seeds the store with the name it is given and restores `t-1`.

The seeded defect, D-001, is in the write. It drops the name on the way to the store, and the store
files the record under its own placeholder `untitled`. The handler answers from the
request it was given, so the write reports the name that never reached the store. Only an independent
read at the identifier the write returned shows the placeholder.

The mutation is a field drop in the write handler, and it is reversible. Nothing in this repository
runs the service: the observations in `sealed-run-record.json` are the evidence a harness is
stipulated to have collected, and the chain exists so the commands can be run over real bytes.
