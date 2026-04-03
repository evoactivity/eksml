import type { TNode } from "../parser.ts";

/**
 * Filter nodes like Array.filter - returns nodes where the filter function returns true
 * @param children - Array of nodes to filter
 * @param f - Filter function
 * @param dept - Current depth in the tree (internal use)
 * @param path - Current path in the tree (internal use)
 * @returns Filtered array of nodes
 */
export function filter(
  children: (TNode | string)[],
  f: (node: TNode, index: number, depth: number, path: string) => boolean,
  dept: number = 0,
  path: string = "",
): TNode[] {
  let out: TNode[] = [];

  children.forEach(function (child, i) {
    if (typeof child === "object" && f(child, i, dept, path)) {
      out.push(child);
    }
    if (typeof child === "object" && child.children) {
      const kids = filter(
        child.children,
        f,
        dept + 1,
        (path ? path + "." : "") + i + "." + child.tagName,
      );
      out = out.concat(kids);
    }
  });
  return out;
}
