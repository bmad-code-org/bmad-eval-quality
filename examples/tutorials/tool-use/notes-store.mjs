// What the tutorial's tool server answers, as a pure function of its store.
//
// The server process and the chain builder both read this module, so the
// committed observations and the ones a reader produces by running the server
// come from one definition. Two copies of this logic would let the committed
// bytes drift from what the server really says, and the page would then teach
// from a run nobody can reproduce.
//
// Nothing here reads a clock or a random source. The `filedAt` field the
// contract permits is never emitted, because a timestamp would make every run
// answer differently and no committed observation could match one.
//
// The store is a plain object rather than process memory for a reason worth
// knowing before you write a tool server of your own. `createMcpAdapter` opens
// one session per port invocation, so the server is launched, handshaken,
// called once, and torn down for every tool call. A server holding its notes in
// a variable would forget them between calls, and a read-back would then find
// nothing whatever the write did, which is the one answer this tutorial must
// not fake. `tool-server.mjs` keeps the object in a file named by its own
// environment, the way a real server keeps a database.

/** The notes the server holds before any call, which is what the contract's reference set expects a search to name. */
export const seedNotes = () => ({
	'n-1': 'alpha notes',
	'n-2': 'beta notes',
})

/** A stable identifier derived from one title, so the same title always names the same note. */
const slug = (value) =>
	String(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '') || 'empty'

/** The two searches the contract's own witness legs send, answered without reading the store so a later creation cannot change them. */
const FIXED_SEARCHES = {
	alpha: 'n-1',
	beta: 'n-2',
}

const searchNotes = (notes, args) => {
	const query = args.query
	if (typeof query !== 'string') {
		// A tool asked for an argument of the wrong type refuses the call.
		// The contract's malformed-search step is what reads this answer.
		return {
			isError: true,
			structuredResult: { ok: false, matches: [], totalCount: 0 },
		}
	}
	const fixed = FIXED_SEARCHES[query]
	if (fixed !== undefined) {
		return {
			isError: false,
			structuredResult: {
				ok: true,
				matches: [{ noteId: fixed }],
				totalCount: 1,
			},
		}
	}
	const title = notes[query]
	if (title === undefined) {
		return {
			isError: false,
			structuredResult: { ok: true, matches: [], totalCount: 0 },
		}
	}
	return {
		isError: false,
		structuredResult: {
			ok: true,
			matches: [{ noteId: query }],
			totalCount: 1,
			topMatch: { title },
		},
	}
}

const createNote = (notes, args, seedDefect) => {
	const title = args.title
	if (typeof title !== 'string') {
		return { isError: true, structuredResult: { ok: false } }
	}
	const noteId = `note-${slug(title)}`
	// The seeded defect. The call is validated, the identifier is minted, and the
	// answer is the one a correct server would give. What changes is that the
	// title never reaches the store, so the note is filed under a placeholder and
	// only an independent read of that identifier can tell the difference.
	notes[noteId] = seedDefect ? '(untitled)' : title
	return { isError: false, structuredResult: { ok: true, noteId } }
}

/**
 * One tool call against the notes object, which it may mutate in place.
 * `seedDefect` is the mutation the twin run needs, and it is a single branch so
 * a reader can see exactly what was changed.
 */
export function callTool(notes, toolName, args, seedDefect = false) {
	if (toolName === 'search_notes') return searchNotes(notes, args)
	if (toolName === 'create_note') return createNote(notes, args, seedDefect)
	return {
		isError: true,
		structuredResult: { ok: false, reason: `unknown tool ${toolName}` },
	}
}

/**
 * The contract's own interaction plan, as the calls a harness makes to satisfy
 * it. The read-back step takes the identifier the creation answered with, which
 * is what the contract declares as a captured binding, so its arguments are a
 * function of an earlier answer rather than a literal.
 */
export const PLAN_STEPS = [
	{
		stepId: 'search',
		operationId: 'search-notes',
		toolName: 'search_notes',
		argumentsFor: () => ({ query: 'alpha' }),
	},
	{
		stepId: 'create',
		operationId: 'create-note',
		toolName: 'create_note',
		argumentsFor: () => ({ title: 'a new note' }),
	},
	{
		stepId: 'malformed-search',
		operationId: 'search-notes',
		toolName: 'search_notes',
		// The contract binds this step with the type-violating matcher, and the
		// declared type of `query` is string, so a number is what violates it.
		argumentsFor: () => ({ query: 42 }),
	},
	{
		stepId: 'malformed-create',
		operationId: 'create-note',
		toolName: 'create_note',
		argumentsFor: () => ({ title: 42 }),
	},
	{
		stepId: 'read-back',
		operationId: 'search-notes',
		toolName: 'search_notes',
		argumentsFor: (answers) => ({ query: answers.create.noteId }),
	},
]
