import type { TNode } from "../parser.ts";
import { parse } from "../parser.ts";

/**
 * Find an element by ID attribute
 * @param S - XML string to search
 * @param id - ID value to find
 * @returns Found node, or undefined if not found
 */
export function getElementById(S: string, id: string): TNode | undefined {
  const out = parse(S, { attrValue: id });
  return out[0] as TNode | undefined;
}
