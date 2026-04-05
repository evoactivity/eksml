import type { TNode } from '#src/parser.ts';
import { parse } from '#src/parser.ts';
import { escapeRegExp } from '#src/utilities/escapeRegExp.ts';
import { filter } from '#src/utilities/filter.ts';

/**
 * Find elements by class name
 * @param input - XML string or parsed DOM to search
 * @param className - Class name to find
 * @returns Found nodes
 */
export function getElementsByClassName(
  input: string | (TNode | string)[],
  className: string,
): TNode[] {
  const dom = typeof input === 'string' ? parse(input) : input;
  const re = new RegExp('(?:^|\\s)' + escapeRegExp(className) + '(?:\\s|$)');
  return filter(dom, (node) => {
    const cls = node.attributes?.class;
    return cls != null && re.test(cls);
  });
}
