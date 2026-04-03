/**
 * fromLossy — convert a lossy JS object back to a TNode DOM tree.
 *
 * This is the inverse of `lossy()`. Because the lossy format does not preserve
 * sibling order between different tag names, the reconstruction is best-effort:
 * elements appear in JS object key insertion order, and arrays expand in
 * sequence. Mixed content (`$$` arrays) preserves interleaving exactly.
 *
 * Lossy format rules (reversed):
 * - `null` → empty element (no attributes, no children)
 * - `string` → text-only element (one string child)
 * - `$`-prefixed keys → attributes (prefix stripped)
 * - `$$` array → mixed content (strings become text, objects become elements)
 * - Non-`$` keys → element children (arrays expand to repeated siblings)
 * - Top-level single-key object → single root element
 * - Top-level array → multiple root elements
 *
 * @example
 * ```ts
 * import { fromLossy } from "eksml/from-lossy";
 * import { lossy } from "eksml/lossy";
 * import { writer } from "eksml/writer";
 *
 * const obj = lossy('<root><item>hello</item><item>world</item></root>');
 * const dom = fromLossy(obj);
 * const xml = writer(dom);
 * ```
 */

import type { TNode } from "#src/parser.ts";
import type {
  LossyValue,
  LossyObject,
  LossyMixedEntry,
} from "#src/converters/lossy.ts";
// @generated:char-codes:begin
const DOLLAR = 36; // $
// @generated:char-codes:end

/**
 * Convert a lossy JS object back to a `(TNode | string)[]` DOM tree.
 *
 * Accepts the same shapes that `lossy()` returns:
 * - A single `LossyValue` (e.g. `{ root: { ... } }`)
 * - An array of `LossyValue` (multiple roots)
 *
 * @param input - A lossy value or array of lossy values.
 * @returns A DOM array suitable for `writer()` or further processing.
 */
export function fromLossy(input: LossyValue | LossyValue[]): (TNode | string)[] {
  // Array of top-level values
  if (Array.isArray(input)) {
    const result: (TNode | string)[] = [];
    for (let i = 0; i < input.length; i++) {
      const item = input[i]!;
      if (typeof item === "string") {
        result.push(item);
      } else if (item === null) {
        // Top-level null — unusual, skip
        continue;
      } else {
        // Each object in the array is { tagName: value }
        convertTopLevelObject(item, result);
      }
    }
    return result;
  }

  // Single value
  if (input === null || typeof input === "string") {
    // Bare null or string at top level — can't form a TNode without a tag name
    return typeof input === "string" ? [input] : [];
  }

  // Single-root object: { rootTag: value }
  const result: (TNode | string)[] = [];
  convertTopLevelObject(input, result);
  return result;
}

/**
 * Convert a top-level `{ tagName: value }` object into TNode(s) and push
 * them onto the result array.
 */
function convertTopLevelObject(
  object: LossyObject,
  result: (TNode | string)[],
): void {
  const keys = Object.keys(object);
  for (let i = 0; i < keys.length; i++) {
    const tagName = keys[i]!;
    result.push(convertElement(tagName, object[tagName]!));
  }
}

/**
 * Convert a tag name + lossy value into a TNode.
 */
function convertElement(
  tagName: string,
  value: LossyValue | LossyValue[] | LossyMixedEntry[],
): TNode {
  // null → empty element
  if (value === null) {
    return { tagName, attributes: null, children: [] };
  }

  // string → text-only element
  if (typeof value === "string") {
    return { tagName, attributes: null, children: [value] };
  }

  // Array → this is a repeated-sibling array at the parent level,
  // but convertElement is called per-value, so arrays here shouldn't
  // normally occur. Defensive: treat as first element.
  if (Array.isArray(value)) {
    // This case is handled by the caller expanding arrays.
    // If somehow called directly, use first item.
    return convertElement(tagName, value[0] ?? null);
  }

  // LossyObject → extract attributes ($-prefixed), check for $$ mixed content,
  // then process element-only children
  const objectValue = value as LossyObject;
  const objectKeys = Object.keys(objectValue);

  let attributes: Record<string, string | null> | null = null;
  const children: (TNode | string)[] = [];
  let hasMixed = false;

  for (let i = 0; i < objectKeys.length; i++) {
    const key = objectKeys[i]!;

    if (key === "$$") {
      // Mixed content array
      hasMixed = true;
      const mixedArray = objectValue.$$ as LossyMixedEntry[];
      for (let j = 0; j < mixedArray.length; j++) {
        const mixedEntry = mixedArray[j]!;
        if (typeof mixedEntry === "string") {
          children.push(mixedEntry);
        } else {
          // { tagName: value } — single-key object
          const entryKeys = Object.keys(mixedEntry);
          const entryTagName = entryKeys[0]!;
          children.push(
            convertElement(entryTagName, (mixedEntry as LossyObject)[entryTagName]!),
          );
        }
      }
    } else if (key.charCodeAt(0) === DOLLAR) {
      // Attribute — strip the $ prefix
      if (attributes === null) {
        attributes = Object.create(null) as Record<string, string | null>;
      }
      const attributeName = key.substring(1);
      const attributeValue = objectValue[key];
      attributes[attributeName] =
        attributeValue === null ? null : String(attributeValue);
    } else {
      // Element child(ren)
      const childValue = objectValue[key]!;
      if (Array.isArray(childValue)) {
        // Repeated siblings
        for (let j = 0; j < childValue.length; j++) {
          children.push(convertElement(key, childValue[j]!));
        }
      } else {
        children.push(convertElement(key, childValue as LossyValue));
      }
    }
  }

  return { tagName, attributes, children };
}
