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

import { parse, type TNode, type ParseOptions } from '#src/parser.ts';

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
    if (typeof child === 'string') {
      children.push(convertString(child));
    } else {
      children.push(convertNode(child));
    }
  }

  return { [node.tagName]: children };
}

function convertString(text: string): LosslessEntry {
  // Comments from parse() come as "<!-- ... -->"
  if (text.startsWith('<!--') && text.endsWith('-->')) {
    return { $comment: text.substring(4, text.length - 3) };
  }
  return { $text: text };
}

/**
 * Parse an XML/HTML string or convert a pre-parsed DOM tree into an
 * order-preserving JSON-friendly structure.
 *
 * @param input - An XML/HTML string, or a pre-parsed `(TNode | string)[]` DOM array
 * @param options - Parsing options (only used when `input` is a string)
 * @returns Array of top-level JSON entries
 */
export function lossless(
  input: string,
  options?: LosslessOptions,
): LosslessEntry[];
export function lossless(input: (TNode | string)[]): LosslessEntry[];
export function lossless(
  input: string | (TNode | string)[],
  options?: LosslessOptions,
): LosslessEntry[] {
  const dom = typeof input === 'string' ? parse(input, { ...options }) : input;
  const result: LosslessEntry[] = [];
  for (let i = 0; i < dom.length; i++) {
    const node = dom[i]!;
    if (typeof node === 'string') {
      result.push(convertString(node));
    } else {
      result.push(convertNode(node));
    }
  }
  return result;
}
