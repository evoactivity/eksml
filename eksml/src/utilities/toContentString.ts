import type { TNode } from "#src/parser.ts";

/**
 * Read the text content of a node, useful for mixed content.
 * Example: "this text has some <b>big</b> text and a <a href=''>link</a>"
 * @param domContent - The node(s) to extract text from
 * @returns Concatenated text content
 */
export function toContentString(
  domContent: TNode | (TNode | string)[] | string,
): string {
  if (Array.isArray(domContent)) {
    let out = "";
    domContent.forEach(function (child) {
      out += " " + toContentString(child);
      out = out.trim();
    });
    return out;
  } else if (typeof domContent === "object" && domContent !== null) {
    return toContentString(domContent.children);
  } else {
    return " " + domContent;
  }
}
