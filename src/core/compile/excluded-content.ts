/**
 * AD-18's exclusion, read against the contract rather than against a directory.
 *
 * AD-18 excludes credentials, tokens, real names, email addresses, account
 * identifiers, and transaction content from every artifact this package produces
 * or publishes, and says so binds "published examples and test fixtures as
 * strictly as real runs". The only mechanism enforcing it was a test that greps
 * `corpus/dev`, which reaches the corpus this repository ships and no contract an
 * adopter authors. A token written into a contract therefore compiled clean and
 * travelled onward: `seal` copies permitted interfaces onto the sealed brief, so
 * the value reaches the one artifact AD-16 hands to an evaluator, and `emit`
 * copies quoted evidence onto the evidence artifact.
 *
 * The whole contract is scanned, not a chosen subtree. Choosing one would have to
 * be right about where an author pastes a secret, and the answer is wherever the
 * field they were filling in happened to be: a witness input value, a fixture
 * reset payload, an oracle's expected operand, a behaviour description. The
 * scan's cost is one walk of an already-parsed object.
 *
 * Unconditional rather than strict-gated, unlike `undeclared-mandatory-input`
 * next to it. That code is strict-only because AD-4 leaves a contract two
 * legitimate readings of how completely it declares its inputs. AD-18 has one
 * reading and no lenient mode: a credential that reaches a published artifact is
 * unrecoverable, which is the harm the decision names.
 */
import { scanExcludedContent } from '../excluded-content.ts'
import { StructuralFailure } from '../failure-codes.ts'
import type { EvalContract } from '../schemas/eval-contract.ts'

/**
 * `excluded-content-in-declaration`: the contract carries a value-shaped secret.
 *
 * The first hit is reported and the rest are dropped. A contract carrying one
 * has to be re-authored before it compiles at all, so enumerating the others
 * would print more of the secret material into a failure message that gets
 * pasted into a terminal, an issue, and a log. The message names the category
 * and the path and quotes nothing.
 */
export function checkExcludedContent(contract: EvalContract): void {
	const hit = scanExcludedContent(contract, 'EvalContract')[0]
	if (hit === undefined) return
	throw new StructuralFailure(
		'excluded-content-in-declaration',
		hit.path,
		`carries a value shaped like ${hit.category}, which AD-18 excludes from every artifact this package produces; store a digest or an AD-8 opaque reference instead. The matched text is not quoted here, since a failure message travels further than the contract does`,
	)
}
