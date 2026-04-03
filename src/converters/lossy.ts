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
  /**
   * Decode XML/HTML entities in text content and attribute values.
   * Uses HTML entity set when `html: true`, XML entity set otherwise.
   * Defaults to `false`.
   */
  entities?: boolean;
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
 *
 * Single-pass algorithm: starts optimistically building an element-only object,
 * and upgrades to mixed-content ($$ array) if text nodes are encountered
 * alongside element nodes (or attributes exist with text).
 */
function convertNode(node: TNode): LossyValue {
  const children = node.children;
  const len = children ? children.length : 0;
  const attrs = node.attributes;
  const hasAttrs = attrs !== null;

  // --- Empty element ---
  if (len === 0 && !hasAttrs) {
    return null;
  }

  // --- Text-only element, no attributes ---
  if (len === 1 && typeof children[0] === "string" && !hasAttrs) {
    return children[0];
  }

  // --- Build object with attributes ---
  // Use null-prototype object to prevent __proto__ / constructor pollution
  const obj: LossyObject = Object.create(null);

  if (hasAttrs) {
    for (const key in attrs) {
      obj["$" + key] = attrs[key]!;
    }
  }

  if (len === 0) {
    // Empty element with attributes only
    return obj;
  }

  // --- Single-pass: build element-only object, upgrade to mixed if needed ---
  // Track whether we've seen elements and/or text so far.
  // When text appears alongside elements (or attrs), switch to $$ mode,
  // retroactively converting already-processed children.
  let hasElements = false;
  let hasText = false;
  let mixed: LossyMixedEntry[] | null = null;

  for (let i = 0; i < len; i++) {
    const child = children[i]!;
    if (typeof child === "string") {
      hasText = true;
      if (mixed !== null) {
        // Already in mixed mode
        mixed.push(child);
      } else if (hasElements || hasAttrs) {
        // Upgrade to mixed mode — retroactively convert prior children.
        // Remove element keys that were speculatively added to obj.
        for (const k in obj) {
          if (k.charCodeAt(0) !== 36) delete obj[k]; // keep $-prefixed attrs
        }
        mixed = [];
        for (let j = 0; j < i; j++) {
          const prev = children[j]!;
          if (typeof prev === "string") {
            mixed.push(prev);
          } else {
            mixed.push({ [prev.tagName]: convertNode(prev) });
          }
        }
        mixed.push(child);
      }
      // If !hasElements && !hasAttrs, we're still in potential text-only mode
    } else {
      if (!hasElements && hasText && !hasAttrs) {
        // First element after text-only so far — upgrade to mixed mode
        hasElements = true;
        mixed = [];
        for (let j = 0; j < i; j++) {
          mixed.push(children[j] as string);
        }
        mixed.push({ [child.tagName]: convertNode(child) });
        continue;
      }
      hasElements = true;
      const tag = child.tagName;
      const val = convertNode(child);
      if (mixed !== null) {
        mixed.push({ [tag]: val });
      } else {
        if (!(tag in obj)) {
          obj[tag] = val;
        } else if (!Array.isArray(obj[tag])) {
          obj[tag] = [obj[tag] as LossyValue, val];
        } else {
          (obj[tag] as LossyValue[]).push(val);
        }
      }
    }
  }

  // If we switched to mixed mode, attach and return
  if (mixed !== null) {
    obj.$$ = mixed;
    return obj;
  }

  // If we had elements, obj is already populated — return it
  if (hasElements) {
    return obj;
  }

  // --- Text-only, no attributes, multiple text nodes (edge case) ---
  let text = "";
  for (let i = 0; i < len; i++) {
    text += children[i] as string;
  }
  return text;
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
    if (options.entities !== undefined) parseOpts.entities = options.entities;
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
