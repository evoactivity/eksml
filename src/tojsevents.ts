/**
 * tojsevents — lossless XML-to-JS object converter using fastStream (SAX-based).
 *
 * Produces the exact same `{ $name, $attrs, $children }` output as `tojs`, but
 * uses `fastStream` (SAX events) internally instead of building a TNode DOM
 * first. This can be faster for large documents because it avoids the
 * intermediate DOM allocation.
 *
 * @example
 * ```ts
 * import { tojsevents } from "eksml";
 *
 * const obj = tojsevents('<root attr="1"><item>hello</item></root>');
 * // [{ $name: "root", $attrs: { attr: "1" }, $children: [
 * //   { $name: "item", $attrs: {}, $children: ["hello"] }
 * // ]}]
 * ```
 */

import { fastStream } from "./fastStream.ts";
import { HTML_VOID_ELEMENTS, HTML_RAW_CONTENT_TAGS } from "./txml.ts";
import type { JsNode, ToJsOptions } from "./tojs.ts";

/**
 * Parse an XML/HTML string into lossless JS objects using SAX events.
 *
 * The output format is identical to `tojs()`. Each element is
 * `{ $name, $attrs, $children }`. Text nodes are plain strings.
 *
 * @param xml - The XML/HTML string to convert
 * @param options - Parsing options
 * @returns Array of top-level JsNode elements and text strings
 */
export function tojsevents(
  xml: string,
  options?: ToJsOptions,
): (JsNode | string)[] {
  const root: (JsNode | string)[] = [];
  const stack: JsNode[] = [];
  const keepComments = options?.keepComments ?? false;
  const htmlMode = options?.html ?? false;

  const parser = fastStream({
    selfClosingTags:
      options?.selfClosingTags ?? (htmlMode ? HTML_VOID_ELEMENTS : undefined),
    rawContentTags:
      options?.rawContentTags ?? (htmlMode ? HTML_RAW_CONTENT_TAGS : undefined),

    onopentag(name, attrs) {
      const node: JsNode = {
        $name: name,
        $attrs: attrs,
        $children: [],
      };
      if (stack.length > 0) {
        stack[stack.length - 1]!.$children.push(node);
      } else {
        root.push(node);
      }
      stack.push(node);
    },

    onclosetag() {
      stack.pop();
    },

    ontext(text) {
      if (stack.length > 0) {
        stack[stack.length - 1]!.$children.push(text);
      } else {
        root.push(text);
      }
    },

    oncdata(data) {
      if (stack.length > 0) {
        stack[stack.length - 1]!.$children.push(data);
      } else {
        root.push(data);
      }
    },

    oncomment(comment) {
      if (!keepComments) return;
      if (stack.length > 0) {
        stack[stack.length - 1]!.$children.push(comment);
      } else {
        root.push(comment);
      }
    },

    onprocessinginstruction(name, body) {
      // Match parse() behavior: PI becomes a node with tagName "?" + name
      // and parsed attributes from the body
      const node: JsNode = {
        $name: "?" + name,
        $attrs: parsePIAttributes(body),
        $children: [],
      };
      if (stack.length > 0) {
        stack[stack.length - 1]!.$children.push(node);
      } else {
        root.push(node);
      }
    },
  });

  parser.write(xml);
  parser.close();
  return root;
}

/**
 * Parse processing instruction body into attributes.
 * E.g., `version="1.0" encoding="UTF-8"` -> `{ version: "1.0", encoding: "UTF-8" }`
 */
function parsePIAttributes(body: string): Record<string, string | null> {
  const attrs: Record<string, string | null> = {};
  let i = 0;
  const len = body.length;

  while (i < len) {
    // skip whitespace
    while (i < len && (body.charCodeAt(i) <= 32)) i++;
    if (i >= len) break;

    // read name
    const nameStart = i;
    while (
      i < len &&
      body.charCodeAt(i) !== 61 /* = */ &&
      body.charCodeAt(i) > 32
    ) {
      i++;
    }
    const name = body.substring(nameStart, i);
    if (!name) break;

    // skip whitespace and =
    while (i < len && (body.charCodeAt(i) <= 32)) i++;
    if (i < len && body.charCodeAt(i) === 61 /* = */) {
      i++;
      while (i < len && (body.charCodeAt(i) <= 32)) i++;
      // read value
      const q = body.charCodeAt(i);
      if (q === 34 /* " */ || q === 39 /* ' */) {
        i++;
        const valStart = i;
        i = body.indexOf(q === 34 ? '"' : "'", i);
        if (i === -1) i = len;
        attrs[name] = body.substring(valStart, i);
        i++; // skip closing quote
      } else {
        // unquoted value
        const valStart = i;
        while (i < len && body.charCodeAt(i) > 32) i++;
        attrs[name] = body.substring(valStart, i);
      }
    } else {
      attrs[name] = null;
    }
  }
  return attrs;
}
