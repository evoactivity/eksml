import type { TNode } from '#src/parser.ts';
import { parse } from '#src/parser.ts';

/**
 * Filter nodes like Array.filter - returns nodes where the filter function returns true
 * @param input - XML string or array of nodes to filter
 * @param predicate - Filter function
 * @param depth - Current depth in the tree (internal use)
 * @param path - Current path in the tree (internal use)
 * @returns Filtered array of nodes
 */
export function filter(
  input: string | (TNode | string)[],
  predicate: (
    node: TNode,
    index: number,
    depth: number,
    path: string,
  ) => boolean,
  depth: number = 0,
  path: string = '',
): TNode[] {
  const out: TNode[] = [];
  filterInto(
    out,
    typeof input === 'string' ? parse(input) : input,
    predicate,
    depth,
    path,
  );
  return out;
}

function filterInto(
  out: TNode[],
  children: (TNode | string)[],
  predicate: (
    node: TNode,
    index: number,
    depth: number,
    path: string,
  ) => boolean,
  depth: number,
  path: string,
): void {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (typeof child === 'object') {
      if (predicate(child, i, depth, path)) {
        out.push(child);
      }
      if (child.children) {
        filterInto(
          out,
          child.children,
          predicate,
          depth + 1,
          (path ? path + '.' : '') + i + '.' + child.tagName,
        );
      }
    }
  }
}
