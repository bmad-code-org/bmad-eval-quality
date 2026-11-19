/**
 * `displayToken` for `cli/`, which may not import `core/`. Kept off the
 * application barrel: it is how this package's own messages quote a value,
 * and no part of the published surface.
 */
export { displayToken } from '../core/display-token.ts'
