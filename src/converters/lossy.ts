/**
 * lossy — simplified lossy XML-to-JS object converter.
 *
 * Produces the most compact JS object representation possible. Element
 * ordering between different tag names is not preserved. The format rules are:
 *
 * - **Text-only element**: collapses to a plain string value.
 *   `<name>text</name>` → `{ "name": "text" }`
 *
 * - **Empty/void element**: collapses to `null`.
 *   `<br/>` → `{ "br": null }`
 *
 * - **Attributes**: prefixed with `$` on the element object.
 *   `<a href="/">link</a>` → `{ "a": { $href: "/", $$: ["link"] } }`
 *
 * - **Mixed content** (text + child elements): children go into an ordered
 *   `$$` array preserving exact interleaving of text and element objects.
 *   `<p>Hello <b>world</b></p>` → `{ "p": { $$: ["Hello ", { "b": "world" }] } }`
 *
 * - **Element-only children** (no text): keyed object with tag names.
 *   `<root><a>1</a><b>2</b></root>` → `{ "root": { "a": "1", "b": "2" } }`
 *
 * - **Repeated same-name siblings**: become an array.
 *   Two `<item>` → `"item": [val1, val2]`; one `<item>` → `"item": val1`
 *
 * All marker keys are valid JS identifiers so you can use dot notation:
 * `node.$href`, `node.$$`, etc.
 *
 * @example
 * ```ts
 * import { lossy } from "eksml";
 *
 * const result = lossy(`
 *   <thing>
 *     <second with="attributes">Text</second>
 *     <third>More text</third>
 *     <second another="attribute">Even more text
 *       <fourth>Nested text</fourth>
 *     </second>
 *   </thing>
 * `);
 * // {
 * //   "thing": {
 * //     "second": [
 * //       { $with: "attributes", $$: ["Text"] },
 * //       { $another: "attribute", $$: ["Even more text\n      ", { "fourth": "Nested text" }] }
 * //     ],
 * //     "third": "More text"
 * //   }
 * // }
 * ```
 */

import { parse, type TNode, type ParseOptions } from "../parser.ts";

/** Options for lossy. */
export interface LossyOptions {
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
  /** Keep XML comments in the output. Comments appear as strings in `$$` arrays. */
  keepComments?: boolean;
  /** Trim whitespace from text nodes and discard whitespace-only text nodes. */
  trimWhitespace?: boolean;
  /**
   * Strict mode: throw on malformed XML instead of recovering silently.
   */
  strict?: boolean;
}

/** The value of a converted element — null (empty), string, or an object with keys. */
export type LossyValue = null | string | LossyObject;

/** An element converted to a keyed object. */
export interface LossyObject {
  [key: string]: LossyValue | LossyValue[] | LossyMixedEntry[];
}

/** An entry in a `$$` mixed-content array. */
export type LossyMixedEntry = string | { [tagName: string]: LossyValue };

/**
 * Convert a single TNode into its simplified lossy value.
 */
function convertNode(node: TNode): LossyValue {
  const children = node.children;
  const len = children.length;

  // Check for attributes without allocating Object.keys()
  let hasAttrs = false;
  for (const _ in node.attributes) {
    hasAttrs = true;
    break;
  }

  // --- Empty element ---
  if (len === 0 && !hasAttrs) {
    return null;
  }

  // --- Text-only element, no attributes ---
  if (len === 1 && typeof children[0] === "string" && !hasAttrs) {
    return children[0];
  }

  // --- Has attributes or multiple/complex children: build an object ---
  // Use null-prototype object to prevent __proto__ / constructor pollution
  const obj: LossyObject = Object.create(null);

  // Attributes go first, prefixed with $
  if (hasAttrs) {
    for (const key in node.attributes) {
      obj["$" + key] = node.attributes[key]!;
    }
  }

  // Single-pass: detect content type and handle accordingly.
  // We check the first child to determine the path, then branch.
  // Most XML elements are either all-text, all-elements, or mixed.

  if (len === 0) {
    // Empty element with attributes only
    return obj;
  }

  // Check content type in a single scan
  let hasText = false;
  let hasElements = false;
  for (let i = 0; i < len; i++) {
    if (typeof children[i] === "string") {
      hasText = true;
    } else {
      hasElements = true;
    }
    if (hasText && hasElements) break;
  }

  // --- Mixed content or text-with-attributes → use $$ array ---
  if (hasText && (hasElements || hasAttrs)) {
    const mixed: LossyMixedEntry[] = [];
    for (let i = 0; i < len; i++) {
      const child = children[i]!;
      if (typeof child === "string") {
        mixed.push(child);
      } else {
        mixed.push({ [child.tagName]: convertNode(child) });
      }
    }
    obj.$$ = mixed;
    return obj;
  }

  // --- Text-only, no attributes, multiple text nodes (edge case) ---
  if (hasText) {
    let text = "";
    for (let i = 0; i < len; i++) {
      text += children[i] as string;
    }
    return text;
  }

  // --- Element-only children ---
  // Single pass: build keys, promote to array on second occurrence
  for (let i = 0; i < len; i++) {
    const child = children[i] as TNode;
    const tag = child.tagName;
    const val = convertNode(child);
    if (!(tag in obj)) {
      // First occurrence — store as single value
      obj[tag] = val;
    } else if (!Array.isArray(obj[tag])) {
      // Second occurrence — promote to array
      obj[tag] = [obj[tag] as LossyValue, val];
    } else {
      // Third+ occurrence — push to existing array
      (obj[tag] as LossyValue[]).push(val);
    }
  }

  return obj;
}

/**
 * Parse an XML/HTML string into the most simplified lossy JS object format.
 *
 * @param xml - The XML/HTML string to convert
 * @param options - Parsing options
 * @returns A LossyValue representing the document. For a single root element
 *          this is typically `{ rootTag: ... }`. For multiple top-level nodes
 *          an array is returned.
 */
export function lossy(
  xml: string,
  options?: LossyOptions,
): LossyValue | LossyValue[] {
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

  // Filter out whitespace-only top-level text and processing instructions
  // (e.g. <?xml version="1.0"?>) which are metadata, not content.
  const nodes: (TNode | string)[] = [];
  for (let i = 0; i < dom.length; i++) {
    const n = dom[i]!;
    if (typeof n === "string") {
      // Keep non-whitespace text at top level
      if (n.trim().length > 0) {
        nodes.push(n);
      }
    } else if (n.tagName[0] === "?") {
      // Skip processing instructions (<?xml?>, <?xsl?>, etc.)
      continue;
    } else {
      nodes.push(n);
    }
  }

  // Single root element — return as { rootTag: value }
  if (nodes.length === 1) {
    const node = nodes[0]!;
    if (typeof node === "string") {
      return node;
    }
    return { [node.tagName]: convertNode(node) } as LossyObject;
  }

  // Multiple top-level nodes — return array
  const result: LossyValue[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (typeof node === "string") {
      result.push(node);
    } else {
      result.push({ [node.tagName]: convertNode(node) } as LossyObject);
    }
  }
  return result;
}
