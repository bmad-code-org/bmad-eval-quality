// Prints the digest a `dated.claims[].asOf.hash` entry holds: the
// normalized-content sha256 `check-doc-claims.ts` recomputes on every
// doc-claims run. Run it after reading a `read` claim's subject, and paste the
// result into `asOf.hash` to pin the claim, or to refresh the pin once the
// subject has genuinely been re-read.
//
// Usage:
//   node scripts/hash-doc-claim-subject.ts <path-to-subject>
//
// Run by `node` directly: Node's type stripping erases types only, so no
// TypeScript enum, namespace, parameter property, or non-type re-export may
// appear in this file or anything it imports, or the script fails at load.
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { hashOfSubject } from './check-doc-claims.ts'

const subject = process.argv[2]
if (subject === undefined) {
	console.error(
		'hash-doc-claim-subject: usage: node scripts/hash-doc-claim-subject.ts <path>',
	)
	process.exitCode = 64
} else {
	const body = await readFile(subject, 'utf8').catch((error: unknown) => {
		console.error(
			`hash-doc-claim-subject: cannot read ${subject}: ${(error as Error).message}`,
		)
		process.exitCode = 64
		return null
	})
	if (body !== null) console.log(hashOfSubject(body))
}
