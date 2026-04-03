/**
 * lossless — XML-to-JSON converter producing an order-preserving format.
 *
 * Each element becomes a single-key object `{ tagName: children[] }`.
 * Text nodes become `{ $text: "..." }`.
 * Attributes become `{ $attr: { ... } }` as the first entry in the children array.
 * Comments (when kept) become `{ $comment: "..." }`.
 *
 * All marker keys are valid JS identifiers so you can use dot notation:
 * `entry.$attr.id`, `entry.$text`, `entry.$comment`.
 *
 * The format preserves element order, mixed content, and attributes losslessly,
 * and is fully JSON-serializable.
 *
 * @example
 * ```ts
 * import { lossless } from "eksml";
 *
 * const result = lossless('<root attr="1"><item>hell<b>o</b></item></root>');
 * // [
 * //   { "root": [
 * //     { $attr: { "attr": "1" } },
 * //     { "item": [
 * //       { $text: "hell" },
 * //       { "b": [{ $text: "o" }] }
 * //     ]}
 * //   ]}
 * // ]
 * ```
 */

import { parse, type TNode, type ParseOptions } from "../parser.ts";

/** A single entry in the JSON output array. */
export type LosslessEntry =
  | { [tagName: string]: LosslessEntry[] }
  | { $text: string }
  | { $attr: Record<string, string | null> }
  | { $comment: string };

/** Options for lossless. */
export interface LosslessOptions extends ParseOptions {}

function convertNode(node: TNode): LosslessEntry {
  const children: LosslessEntry[] = [];

  // Attributes go first as { $attr: { ... } }
  if (node.attributes !== null) {
    children.push({ $attr: node.attributes });
  }

  // Then child nodes
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    if (typeof child === "string") {
      children.push(convertString(child));
    } else {
      children.push(convertNode(child));
    }
  }

  return { [node.tagName]: children };
}

function convertString(s: string): LosslessEntry {
  // Comments from parse() come as "<!-- ... -->"
  if (s.startsWith("<!--") && s.endsWith("-->")) {
    return { $comment: s.substring(4, s.length - 3) };
  }
  return { $text: s };
}

/**
 * Parse an XML/HTML string into an order-preserving JSON-friendly structure.
 *
 * @param xml - The XML/HTML string to convert
 * @param options - Parsing options
 * @returns Array of top-level JSON entries
 */
export function lossless(
  xml: string,
  options?: LosslessOptions,
): LosslessEntry[] {
  const dom = parse(xml, { ...options });
  const result: LosslessEntry[] = [];
  for (let i = 0; i < dom.length; i++) {
    const node = dom[i]!;
    if (typeof node === "string") {
      result.push(convertString(node));
    } else {
      result.push(convertNode(node));
    }
  }
  return result;
}
