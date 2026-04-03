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
export interface LosslessOptions {
  /**
   * Array of tag names that are self-closing (void elements).
   * Defaults to `[]` in XML mode, HTML void elements in HTML mode.
   */
  selfClosingTags?: string[];
  /**
   * Array of tag names whose content is raw text.
   * Defaults to `[]` in XML mode, `["script", "style"]` in HTML mode.
   */
  rawContentTags?: string[];
  /** Enable HTML parsing mode. */
  html?: boolean;
  /** Keep XML comments in the output as `{ $comment: "..." }` entries. */
  keepComments?: boolean;
  /** Trim whitespace from text nodes and discard whitespace-only text nodes. */
  trimWhitespace?: boolean;
  /**
   * Strict mode: throw on malformed XML instead of recovering silently.
   */
  strict?: boolean;
}

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
  const parseOpts: ParseOptions = {};
  if (options) {
    if (options.selfClosingTags !== undefined)
      parseOpts.selfClosingTags = options.selfClosingTags;
    if (options.rawContentTags !== undefined)
      parseOpts.rawContentTags = options.rawContentTags;
    if (options.html !== undefined) parseOpts.html = options.html;
    if (options.keepComments !== undefined)
      parseOpts.keepComments = options.keepComments;
    if (options.trimWhitespace !== undefined)
      parseOpts.trimWhitespace = options.trimWhitespace;
    if (options.strict !== undefined) parseOpts.strict = options.strict;
  }

  const dom = parse(xml, parseOpts);
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
