import type { TNode } from "../parser.ts";

/**
 * Read the text content of a node, useful for mixed content.
 * Example: "this text has some <b>big</b> text and a <a href=''>link</a>"
 * @param tDom - The node(s) to extract text from
 * @returns Concatenated text content
 */
export function toContentString(
  tDom: TNode | (TNode | string)[] | string,
): string {
  if (Array.isArray(tDom)) {
    let out = "";
    tDom.forEach(function (e) {
      out += " " + toContentString(e);
      out = out.trim();
    });
    return out;
  } else if (typeof tDom === "object" && tDom !== null) {
    return toContentString(tDom.children);
  } else {
    return " " + tDom;
  }
}
