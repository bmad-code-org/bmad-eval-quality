# The tool server, and the defect seeded in it

`examples/tutorials/tool-use/tool-server.mjs` publishes two tools over MCP's stdio transport.

`search_notes` takes a query and answers with the notes that match, their count, and the top
match's title when the query names a note the server holds.

`create_note` takes a title, files a note under an identifier derived from it, and answers with
that identifier.

The seeded defect is in the creation. It validates the title, mints the identifier, and answers
`ok: true` with that identifier, exactly as a correct server does. What it files under the
identifier is a placeholder rather than the title it was sent. Nothing in the creation's own answer
shows this, and an independent search for the identifier it returned is what shows it.

The mutation is the `--seed-defect` launch flag, which selects one branch in
`notes-store.mjs`, and it is reversible by dropping the flag.
