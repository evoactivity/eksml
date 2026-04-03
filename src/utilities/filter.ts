import type { TNode } from "../parser.ts";

/**
 * Filter nodes like Array.filter - returns nodes where the filter function returns true
 * @param children - Array of nodes to filter
 * @param predicate - Filter function
 * @param depth - Current depth in the tree (internal use)
 * @param path - Current path in the tree (internal use)
 * @returns Filtered array of nodes
 */
export function filter(
  children: (TNode | string)[],
  predicate: (node: TNode, index: number, depth: number, path: string) => boolean,
  depth: number = 0,
  path: string = "",
): TNode[] {
  let out: TNode[] = [];

  children.forEach(function (child, i) {
    if (typeof child === "object" && predicate(child, i, depth, path)) {
      out.push(child);
    }
    if (typeof child === "object" && child.children) {
      const filteredChildren = filter(
        child.children,
        predicate,
        depth + 1,
        (path ? path + "." : "") + i + "." + child.tagName,
      );
      out = out.concat(filteredChildren);
    }
  });
  return out;
}
