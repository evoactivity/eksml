import type { TNode } from "#src/parser.ts";

/**
 * Type guard to check if a node is an element node (TNode object).
 * Useful for filtering and type narrowing when working with mixed node arrays.
 *
 * @param node - The node to check
 * @returns True if the node is a TNode (element node)
 * @example
 * const parsed = parse('<div>Hello <span>World</span></div>');
 * parsed[0].children.forEach(child => {
 *   if (isElementNode(child)) {
 *     console.log('Element:', child.tagName);
 *   }
 * });
 */
export function isElementNode(node: TNode | string): node is TNode {
  return typeof node === "object" && node !== null && "tagName" in node;
}
