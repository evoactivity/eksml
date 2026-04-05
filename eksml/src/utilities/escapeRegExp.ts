// RegExp.escape is not yet in the ES2023 lib typings
declare global {
  interface RegExpConstructor {
    escape?: (s: string) => string;
  }
}

/**
 * Escapes special regex characters in a string so it can be safely
 * interpolated into a `new RegExp(...)` pattern.
 *
 * Uses the native `RegExp.escape` when available (Node ≥ 24, Chrome ≥ 136,
 * Firefox ≥ 134, Safari ≥ 18.2), otherwise falls back to a manual replacement.
 * @internal
 */
export const escapeRegExp: (s: string) => string =
  typeof RegExp.escape === 'function'
    ? RegExp.escape
    : (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
