import type { TNode } from "../parser.ts";
import { parse } from "../parser.ts";

/**
 * Find elements by class name
 * @param xmlString - XML string to search
 * @param className - Class name to find
 * @returns Found nodes
 */
export function getElementsByClassName(
  xmlString: string,
  className: string,
): (TNode | string)[] {
  const out = parse(xmlString, {
    attrName: "class",
    attrValue: "[a-zA-Z0-9- ]*" + className + "[a-zA-Z0-9- ]*",
  });
  return out;
}
