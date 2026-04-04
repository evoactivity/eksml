import type { TNode } from '#src/parser.ts';
import { parse } from '#src/parser.ts';
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
  if (typeof input === 'string') {
    return parse(input, {
      attrName: 'class',
      attrValue: '[a-zA-Z0-9- ]*' + className + '[a-zA-Z0-9- ]*',
    }) as TNode[];
  }
  const re = new RegExp('(?:^|\\s)' + className + '(?:\\s|$)');
  return filter(input, (node) => {
    const cls = node.attributes?.class;
    return cls != null && re.test(cls);
  });
}
