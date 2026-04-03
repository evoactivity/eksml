/**
 * tojs — lossless XML-to-JS object converter using parse() (DOM-based).
 *
 * Converts an XML string into a plain JS object tree using the "flat children
 * array" format: each element becomes `{ $name, $attrs, $children }`. Text
 * nodes are plain strings inside `$children`. This preserves exact element
 * ordering, mixed content, and all attributes losslessly.
 *
 * @example
 * ```ts
 * import { tojs } from "eksml";
 *
 * const obj = tojs('<root attr="1"><item>hello</item></root>');
 * // [{ $name: "root", $attrs: { attr: "1" }, $children: [
 * //   { $name: "item", $attrs: {}, $children: ["hello"] }
 * // ]}]
 * ```
 */

import { parse, type TNode, type ParseOptions } from "./txml.ts";

/**
 * A lossless JS representation of an XML element node.
 */
export interface JsNode {
  /** Element tag name */
  $name: string;
  /** Element attributes */
  $attrs: Record<string, string | null>;
  /** Ordered child nodes — JsNode for elements, string for text/CDATA */
  $children: (JsNode | string)[];
}

/**
 * Options for tojs. Extends ParseOptions but omits options that don't apply.
 */
export interface ToJsOptions {
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
  /** Keep XML comments in the output as string children. */
  keepComments?: boolean;
  /** Keep whitespace-only text nodes. */
  keepWhitespace?: boolean;
}

function convertNode(node: TNode): JsNode {
  const children: (JsNode | string)[] = [];
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    if (typeof child === "string") {
      children.push(child);
    } else {
      children.push(convertNode(child));
    }
  }
  return {
    $name: node.tagName,
    $attrs: node.attributes,
    $children: children,
  };
}

/**
 * Parse an XML/HTML string into lossless JS objects.
 *
 * Each element is `{ $name, $attrs, $children }`. Text nodes are plain strings.
 * Comments (when `keepComments` is true) appear as strings (e.g. `"<!-- ... -->"`)
 * inside `$children`.
 *
 * Processing instructions (`<?xml ... ?>`) are represented as elements with
 * `$name` starting with `"?"` (matching the underlying parser behavior).
 *
 * @param xml - The XML/HTML string to convert
 * @param options - Parsing options
 * @returns Array of top-level JsNode elements and text strings
 */
export function tojs(
  xml: string,
  options?: ToJsOptions,
): (JsNode | string)[] {
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
  const result: (JsNode | string)[] = [];
  for (let i = 0; i < dom.length; i++) {
    const node = dom[i]!;
    if (typeof node === "string") {
      result.push(node);
    } else {
      result.push(convertNode(node));
    }
  }
  return result;
}
