/**
 * Escapes special regex characters in a string so it can be safely
 * interpolated into a `new RegExp(...)` pattern.
 * @internal
 */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
