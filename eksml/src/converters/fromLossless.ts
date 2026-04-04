/**
 * fromLossless — convert a lossless JSON structure back to a TNode DOM tree.
 *
 * This is the inverse of `lossless()`. Because the lossless format preserves
 * element order, mixed content, attributes, and comments, the round-trip is
 * exact: `fromLossless(lossless(dom))` produces a tree identical to `dom`.
 *
 * Entry types:
 * - `{ tagName: LosslessEntry[] }` → TNode element
 * - `{ $text: "..." }` → string child
 * - `{ $attr: { ... } }` → attributes on the enclosing element (first child)
 * - `{ $comment: "..." }` → comment string child (`"<!-- ... -->"`)
 *
 * @example
 * ```ts
 * import { fromLossless } from "eksml/from-lossless";
 * import { lossless } from "eksml/lossless";
 * import { write } from "eksml/writer";
 *
 * const entries = lossless('<root attr="1"><item>hello</item></root>');
 * const dom = fromLossless(entries);
 * const xml = write(dom); // '<root attr="1"><item>hello</item></root>'
 * ```
 */

import type { TNode } from '#src/parser.ts';
import type { LosslessEntry } from '#src/converters/lossless.ts';

/**
 * Convert a lossless JSON entry array back to a `(TNode | string)[]` DOM tree.
 *
 * @param entries - The lossless entry array (as returned by `lossless()`).
 * @returns A DOM array suitable for `write()` or further processing.
 */
export function fromLossless(entries: LosslessEntry[]): (TNode | string)[] {
  const result: (TNode | string)[] = [];
  for (let i = 0; i < entries.length; i++) {
    result.push(convertEntry(entries[i]!));
  }
  return result;
}

function convertEntry(entry: LosslessEntry): TNode | string {
  // $text → plain string
  if ('$text' in entry) {
    return (entry as { $text: string }).$text;
  }

  // $comment → reconstruct comment string as the parser emits it
  if ('$comment' in entry) {
    return '<!--' + (entry as { $comment: string }).$comment + '-->';
  }

  // $attr should not appear at top level — it's consumed by the element
  // handler below. If we encounter it here, skip it (defensive).
  if ('$attr' in entry) {
    return '';
  }

  // Element: single key is the tag name, value is children array
  const keys = Object.keys(entry);
  const tagName = keys[0]!;
  const entryChildren = (entry as { [tagName: string]: LosslessEntry[] })[
    tagName
  ]!;

  let attributes: Record<string, string | null> | null = null;
  const children: (TNode | string)[] = [];

  for (let i = 0; i < entryChildren.length; i++) {
    const child = entryChildren[i]!;
    if ('$attr' in child) {
      attributes = (child as { $attr: Record<string, string | null> }).$attr;
    } else {
      children.push(convertEntry(child));
    }
  }

  return { tagName, attributes, children };
}
