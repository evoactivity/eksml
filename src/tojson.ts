/**
 * tojson — XML-to-JSON converter producing an order-preserving format.
 *
 * Each element becomes a single-key object `{ tagName: children[] }`.
 * Text nodes become `{ "#text": "..." }`.
 * Attributes become `{ ":@": { ... } }` as the first entry in the children array.
 * Comments (when kept) become `{ "#comment": "..." }`.
 *
 * The format preserves element order, mixed content, and attributes losslessly,
 * and is fully JSON-serializable.
 *
 * @example
 * ```ts
 * import { tojson } from "eksml";
 *
 * const result = tojson('<root attr="1"><item>hell<b>o</b></item></root>');
 * // [
 * //   { "root": [
 * //     { ":@": { "attr": "1" } },
 * //     { "item": [
 * //       { "#text": "hell" },
 * //       { "b": [{ "#text": "o" }] }
 * //     ]}
 * //   ]}
 * // ]
 * ```
 */

import { parse, type TNode, type ParseOptions } from "./txml.ts";

/** A single entry in the JSON output array. */
export type JsonEntry =
  | { [tagName: string]: JsonEntry[] }
  | { "#text": string }
  | { ":@": Record<string, string | null> }
  | { "#comment": string };

/** Options for tojson. */
export interface ToJsonOptions {
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
  /** Keep XML comments in the output as `{ "#comment": "..." }` entries. */
  keepComments?: boolean;
  /** Keep whitespace-only text nodes. */
  keepWhitespace?: boolean;
}

function convertNode(node: TNode): JsonEntry {
  const children: JsonEntry[] = [];

  // Attributes go first as { ":@": { ... } }
  const keys = Object.keys(node.attributes);
  if (keys.length > 0) {
    children.push({ ":@": node.attributes });
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

function convertString(s: string): JsonEntry {
  // Comments from parse() come as "<!-- ... -->"
  if (s.startsWith("<!--") && s.endsWith("-->")) {
    return { "#comment": s.substring(4, s.length - 3) };
  }
  return { "#text": s };
}

/**
 * Parse an XML/HTML string into an order-preserving JSON-friendly structure.
 *
 * @param xml - The XML/HTML string to convert
 * @param options - Parsing options
 * @returns Array of top-level JSON entries
 */
export function tojson(xml: string, options?: ToJsonOptions): JsonEntry[] {
  const parseOpts: ParseOptions = {};
  if (options) {
    if (options.selfClosingTags !== undefined)
      parseOpts.selfClosingTags = options.selfClosingTags;
    if (options.rawContentTags !== undefined)
      parseOpts.rawContentTags = options.rawContentTags;
    if (options.html !== undefined) parseOpts.html = options.html;
    if (options.keepComments !== undefined)
      parseOpts.keepComments = options.keepComments;
    if (options.keepWhitespace !== undefined)
      parseOpts.keepWhitespace = options.keepWhitespace;
  }

  const dom = parse(xml, parseOpts) as (TNode | string)[];
  const result: JsonEntry[] = [];
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
