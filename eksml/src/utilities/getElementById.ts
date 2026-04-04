import type { TNode } from "#src/parser.ts";
import { parse } from "#src/parser.ts";
import { filter } from "#src/utilities/filter.ts";

/**
 * Find an element by ID attribute
 * @param input - XML string or parsed DOM to search
 * @param id - ID value to find
 * @returns Found node, or undefined if not found
 */
export function getElementById(
  input: string | (TNode | string)[],
  id: string,
): TNode | undefined {
  if (typeof input === "string") {
    const out = parse(input, { attrValue: id });
    return out[0] as TNode | undefined;
  }
  const matches = filter(input, (node) => node.attributes?.id === id);
  return matches[0];
}
