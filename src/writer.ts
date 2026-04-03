import { escapeText, escapeAttribute, encodeHTML } from "entities";
import type { TNode } from "./parser.ts";
import { HTML_VOID_ELEMENTS } from "./utilities/htmlConstants.ts";

/** Options for writer. */
export interface WriterOptions {
  /**
   * Pretty-print with indentation. When enabled, each element is placed on
   * its own line with proper nesting indentation.
   *
   * - `true` uses two spaces as the indent.
   * - A string value is used as the indent directly (e.g. `"\t"`, `"    "`).
   *
   * Text-only elements are kept inline: `<name>Alice</name>`.
   * Mixed content (text interleaved with elements) is also kept inline to
   * avoid altering whitespace semantics.
   */
  pretty?: boolean | string;
  /**
   * Encode special characters in text content and attribute values as XML
   * entities. In XML mode (default), `&`, `<`, `>` are encoded in text and
   * `&`, `"`, `'` are encoded in attributes. In HTML mode (`html: true`),
   * the full HTML named entity set is used (e.g. `&copy;`, `&eacute;`).
   *
   * Defaults to `false` — text and attribute values are written verbatim.
   */
  entities?: boolean;
  /**
   * Enable HTML mode. When enabled:
   * - Void elements (`<br>`, `<img>`, `<hr>`, etc.) are self-closed without
   *   a closing tag (e.g. `<br>` instead of `<br></br>` or `<br/>`).
   * - When `entities` is also `true`, uses HTML named entities
   *   (e.g. `&copy;` instead of `&#xa9;`) for encoding.
   */
  html?: boolean;
}

/**
 * Serialize a parsed DOM back to XML.
 * Useful for removing whitespace or recreating XML with modified data.
 * @param O - The node(s) to serialize
 * @param options - Formatting options
 * @returns XML string
 */
export function writer(
  O: TNode | (TNode | string)[],
  options?: WriterOptions,
): string {
  if (!O) return "";

  // Fast path: no options — skip all option parsing, closure creation,
  // identity function allocation, and voidSet construction.
  if (!options || (!options.pretty && !options.entities && !options.html)) {
    return compactWrite(O);
  }

  return fullWriter(O, options);
}

// ---------------------------------------------------------------------------
// Fast path — compact output, no entities, no HTML mode
// ---------------------------------------------------------------------------

function compactWrite(O: TNode | (TNode | string)[]): string {
  let out = "";

  function writeChildren(nodes: (TNode | string)[]): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      if (typeof node === "string") {
        out += node;
      } else {
        writeNode(node);
      }
    }
  }

  function writeNode(N: TNode): void {
    const tag = N.tagName;
    const attrs = N.attributes;
    if (attrs === null) {
      // No attributes — combine open tag into one concat
      if (tag.charCodeAt(0) === 63 /* ? */) {
        out += "<" + tag + "?>";
        return;
      }
      out += "<" + tag + ">";
    } else {
      out += "<" + tag;
      const keys = Object.keys(attrs);
      for (let j = 0; j < keys.length; j++) {
        const k = keys[j]!;
        const v = attrs[k];
        if (v === null) {
          out += " " + k;
        } else if (v.indexOf('"') === -1) {
          out += " " + k + '="' + v + '"';
        } else {
          out += " " + k + "='" + v + "'";
        }
      }
      if (tag.charCodeAt(0) === 63 /* ? */) {
        out += "?>";
        return;
      }
      out += ">";
    }
    writeChildren(N.children);
    out += "</" + tag + ">";
  }

  writeChildren(Array.isArray(O) ? O : [O]);
  return out;
}

// ---------------------------------------------------------------------------
// Full-featured path — entities, HTML mode, and/or pretty printing
// ---------------------------------------------------------------------------

function fullWriter(
  O: TNode | (TNode | string)[],
  options: WriterOptions,
): string {
  const indent = !options.pretty
    ? ""
    : typeof options.pretty === "string"
      ? options.pretty
      : "  ";

  // Entity encoding functions — identity when disabled
  const encodeEntities = !!options.entities;
  const htmlMode = !!options.html;
  const encText: (s: string) => string = encodeEntities
    ? htmlMode
      ? encodeHTML
      : escapeText
    : (s) => s;
  const encAttr: (s: string) => string = encodeEntities
    ? htmlMode
      ? encodeHTML
      : escapeAttribute
    : (s) => s;

  // HTML void elements — self-close without </tag> in html mode
  const voidSet: Set<string> | null = htmlMode
    ? new Set(HTML_VOID_ELEMENTS)
    : null;

  // Compact path with entities/html support
  if (!indent) {
    let out = "";

    function writeChildren(nodes: (TNode | string)[]): void {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]!;
        if (typeof node === "string") {
          out += encText(node);
        } else {
          writeNode(node);
        }
      }
    }

    function writeNode(N: TNode): void {
      const tag = N.tagName;
      const attrs = N.attributes;
      if (attrs === null) {
        if (tag.charCodeAt(0) === 63 /* ? */) {
          out += "<" + tag + "?>";
          return;
        }
        // HTML void elements self-close without a closing tag
        if (voidSet !== null && voidSet.has(tag)) {
          out += "<" + tag + ">";
          return;
        }
        out += "<" + tag + ">";
      } else {
        out += "<" + tag;
        const keys = Object.keys(attrs);
        for (let j = 0; j < keys.length; j++) {
          const k = keys[j]!;
          const v = attrs[k];
          if (v === null) {
            out += " " + k;
          } else {
            const encoded = encAttr(v);
            if (encoded.indexOf('"') === -1) {
              out += " " + k + '="' + encoded + '"';
            } else {
              out += " " + k + "='" + encoded + "'";
            }
          }
        }
        if (tag.charCodeAt(0) === 63 /* ? */) {
          out += "?>";
          return;
        }
        // HTML void elements self-close without a closing tag
        if (voidSet !== null && voidSet.has(tag)) {
          out += ">";
          return;
        }
        out += ">";
      }
      writeChildren(N.children);
      out += "</" + tag + ">";
    }

    writeChildren(Array.isArray(O) ? O : [O]);
    return out;
  }

  // Pretty path
  let out = "";

  function hasTextChildren(nodes: (TNode | string)[]): boolean {
    for (let i = 0; i < nodes.length; i++) {
      if (typeof nodes[i] === "string") return true;
    }
    return false;
  }

  function prettyWriteAttrs(N: TNode): void {
    if (N.attributes === null) return;
    const keys = Object.keys(N.attributes);
    for (let j = 0; j < keys.length; j++) {
      const key = keys[j]!;
      const val = N.attributes[key];
      if (val === null) {
        out += " " + key;
      } else {
        const encoded = encAttr(val);
        if (encoded.indexOf('"') === -1) {
          out += " " + key + '="' + encoded + '"';
        } else {
          out += " " + key + "='" + encoded + "'";
        }
      }
    }
  }

  function prettyWriteNode(N: TNode, depth: number): void {
    if (!N) return;
    const pad = indent.repeat(depth);
    const tag = N.tagName;

    // Processing instruction
    if (tag.charCodeAt(0) === 63 /* ? */) {
      out += pad + "<" + tag;
      prettyWriteAttrs(N);
      out += "?>";
      return;
    }

    const children = N.children;
    const len = children.length;

    // HTML void elements — self-close without closing tag
    if (voidSet !== null && voidSet.has(tag)) {
      out += pad + "<" + tag;
      prettyWriteAttrs(N);
      out += ">";
      return;
    }

    // Empty element — self-close
    if (len === 0) {
      out += pad + "<" + tag;
      prettyWriteAttrs(N);
      out += "/>";
      return;
    }

    // Text-only or mixed content (has any string children) — keep inline
    if (hasTextChildren(children)) {
      out += pad + "<" + tag;
      prettyWriteAttrs(N);
      out += ">";
      for (let i = 0; i < len; i++) {
        const child = children[i]!;
        if (typeof child === "string") {
          out += encText(child);
        } else {
          // Inline nested element within mixed content
          inlineWriteNode(child);
        }
      }
      out += "</" + tag + ">";
      return;
    }

    // Element-only children — indent each child
    out += pad + "<" + tag;
    prettyWriteAttrs(N);
    out += ">";
    for (let i = 0; i < len; i++) {
      const child = children[i]!;
      if (typeof child === "string") {
        out += encText(child);
      } else {
        out += "\n";
        prettyWriteNode(child, depth + 1);
      }
    }
    out += "\n" + pad + "</" + tag + ">";
  }

  /** Write a node inline (no indentation), used inside mixed content. */
  function inlineWriteNode(N: TNode): void {
    if (!N) return;
    const tag = N.tagName;
    out += "<" + tag;
    prettyWriteAttrs(N);
    if (tag.charCodeAt(0) === 63 /* ? */) {
      out += "?>";
      return;
    }
    // HTML void elements self-close without closing tag
    if (voidSet !== null && voidSet.has(tag)) {
      out += ">";
      return;
    }
    if (N.children.length === 0) {
      out += "/>";
      return;
    }
    out += ">";
    for (let i = 0; i < N.children.length; i++) {
      const child = N.children[i]!;
      if (typeof child === "string") {
        out += encText(child);
      } else {
        inlineWriteNode(child);
      }
    }
    out += "</" + tag + ">";
  }

  const nodes = Array.isArray(O) ? O : [O];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (i > 0) out += "\n";
    if (typeof node === "string") {
      out += encText(node);
    } else {
      prettyWriteNode(node, 0);
    }
  }

  return out;
}
