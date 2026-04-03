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
// @generated:char-codes:begin
const DOLLAR = 36; // $
// @generated:char-codes:end

/** Options for lossy. */
export interface LossyOptions extends ParseOptions {}

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
  const childrenLength = children ? children.length : 0;
  const attributes = node.attributes;
  const hasAttributes = attributes !== null;

  // --- Empty element ---
  if (childrenLength === 0 && !hasAttributes) {
    return null;
  }

  // --- Text-only element, no attributes ---
  if (childrenLength === 1 && typeof children[0] === "string" && !hasAttributes) {
    return children[0];
  }

  // --- Build object with attributes ---
  // Use null-prototype object to prevent __proto__ / constructor pollution
  const elementObject: LossyObject = Object.create(null);

  if (hasAttributes) {
    for (const key in attributes) {
      elementObject["$" + key] = attributes[key]!;
    }
  }

  if (childrenLength === 0) {
    // Empty element with attributes only
    return elementObject;
  }

  // --- Single-pass: build element-only object, upgrade to mixed if needed ---
  // Track whether we've seen elements and/or text so far.
  // When text appears alongside elements (or attrs), switch to $$ mode,
  // retroactively converting already-processed children.
  let hasElements = false;
  let hasText = false;
  let mixed: LossyMixedEntry[] | null = null;

  for (let i = 0; i < childrenLength; i++) {
    const child = children[i]!;
    if (typeof child === "string") {
      hasText = true;
      if (mixed !== null) {
        // Already in mixed mode
        mixed.push(child);
      } else if (hasElements || hasAttributes) {
        // Upgrade to mixed mode — retroactively convert prior children.
        // Remove element keys that were speculatively added to elementObject.
        for (const propertyKey in elementObject) {
          if (propertyKey.charCodeAt(0) !== DOLLAR) delete elementObject[propertyKey]; // keep $-prefixed attrs
        }
        mixed = [];
        for (let j = 0; j < i; j++) {
          const previousChild = children[j]!;
          if (typeof previousChild === "string") {
            mixed.push(previousChild);
          } else {
            mixed.push({ [previousChild.tagName]: convertNode(previousChild) });
          }
        }
        mixed.push(child);
      }
      // If !hasElements && !hasAttributes, we're still in potential text-only mode
    } else {
      if (!hasElements && hasText && !hasAttributes) {
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
      const convertedValue = convertNode(child);
      if (mixed !== null) {
        mixed.push({ [tag]: convertedValue });
      } else {
        if (!(tag in elementObject)) {
          elementObject[tag] = convertedValue;
        } else if (!Array.isArray(elementObject[tag])) {
          elementObject[tag] = [elementObject[tag] as LossyValue, convertedValue];
        } else {
          (elementObject[tag] as LossyValue[]).push(convertedValue);
        }
      }
    }
  }

  // If we switched to mixed mode, attach and return
  if (mixed !== null) {
    elementObject.$$ = mixed;
    return elementObject;
  }

  // If we had elements, elementObject is already populated — return it
  if (hasElements) {
    return elementObject;
  }

  // --- Text-only, no attributes, multiple text nodes (edge case) ---
  let text = "";
  for (let i = 0; i < childrenLength; i++) {
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
  const dom = parse(xml, { ...options });

  // Filter out whitespace-only top-level text and processing instructions
  // (e.g. <?xml version="1.0"?>) which are metadata, not content.
  const nodes: (TNode | string)[] = [];
  for (let i = 0; i < dom.length; i++) {
    const node = dom[i]!;
    if (typeof node === "string") {
      // Keep non-whitespace text at top level
      if (node.trim().length > 0) {
        nodes.push(node);
      }
    } else if (node.tagName[0] === "?") {
      // Skip processing instructions (<?xml?>, <?xsl?>, etc.)
      continue;
    } else {
      nodes.push(node);
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
