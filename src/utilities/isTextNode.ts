import type { TNode } from "#src/parser.ts";

/**
 * Type guard to check if a node is a text node (string).
 * Useful for filtering and type narrowing when working with mixed node arrays.
 *
 * @param node - The node to check
 * @returns True if the node is a string (text node)
 * @example
 * const parsed = parse('<div>Hello <span>World</span></div>');
 * parsed[0].children.forEach(child => {
 *   if (isTextNode(child)) {
 *     console.log('Text:', child);
 *   }
 * });
 */
export function isTextNode(node: TNode | string): node is string {
  return typeof node === "string";
}
