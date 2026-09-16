# The system under test, and the defect seeded in it

A toy Notes API with three operations.

`PATCH /notes/{noteId}` takes a title, validates it, builds the updated note, and answers
`ok: true` with status 200.

`GET /notes/{noteId}` returns the stored note.

`GET /notes?title=` returns the notes whose title matches.

The seeded defect, D-001, is in the write. It validates the input and builds the updated note, and it
never stores it. The response carries the new title, so the write is indistinguishable from a correct
one by anything that reads only the write's own response. Only a later, independent read shows that the
stored title never moved.

The mutation is a guard deletion in the handler's store call, and it is reversible. Nothing in this
repository runs the API: the observations in `sealed-run-record.json` are the evidence a harness is
stipulated to have collected, and the chain exists so the four commands can be run over real bytes.
