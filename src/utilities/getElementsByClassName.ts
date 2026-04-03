import type { TNode } from "../parser.ts";
import { parse } from "../parser.ts";

/**
 * Find elements by class name
 * @param S - XML string to search
 * @param classname - Class name to find
 * @returns Found nodes
 */
export function getElementsByClassName(
  S: string,
  classname: string,
): (TNode | string)[] {
  const out = parse(S, {
    attrName: "class",
    attrValue: "[a-zA-Z0-9- ]*" + classname + "[a-zA-Z0-9- ]*",
  });
  return out;
}
