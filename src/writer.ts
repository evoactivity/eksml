import { escapeText, escapeAttribute, escapeUTF8 } from "entities";
import type { TNode } from "#src/parser.ts";
import { HTML_VOID_ELEMENTS } from "#src/utilities/htmlConstants.ts";
// @generated:char-codes:begin
const BANG = 33; // !
const QUESTION = 63; // ?
// @generated:char-codes:end

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
 * @param input - The node(s) to serialize
 * @param options - Formatting options
 * @returns XML string
 */
export function writer(
  input: TNode | (TNode | string)[],
  options?: WriterOptions,
): string {
  if (!input) return "";

  // Fast path: no options — skip all option parsing, closure creation,
  // identity function allocation, and voidSet construction.
  if (!options || (!options.pretty && !options.entities && !options.html)) {
    return compactWrite(input);
  }

  return fullWriter(input, options);
}

// ---------------------------------------------------------------------------
// Fast path — compact output, no entities, no HTML mode
// ---------------------------------------------------------------------------

/**
 * Test whether a string is a simple keyword that can appear unquoted in a
 * DOCTYPE declaration (e.g. `html`, `PUBLIC`, `SYSTEM`).
 * Anything else (URIs, public identifiers) must be double-quoted.
 */
const SIMPLE_KEYWORD = /^[A-Za-z][A-Za-z0-9_-]*$/;

function compactWrite(input: TNode | (TNode | string)[]): string {
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

  function writeNode(node: TNode): void {
    const tag = node.tagName;
    const attributes = node.attributes;
    const firstChar = tag.charCodeAt(0);
    if (attributes === null) {
      // No attributes — combine open tag into one concat
      if (firstChar === QUESTION) {
        out += "<" + tag + "?>";
        return;
      }
      if (firstChar === BANG) {
        out += "<" + tag + ">";
        return;
      }
      out += "<" + tag + ">";
    } else {
      out += "<" + tag;
      const isDeclaration = firstChar === BANG;
      const keys = Object.keys(attributes);
      for (let j = 0; j < keys.length; j++) {
        const attributeName = keys[j]!;
        const attributeValue = attributes[attributeName];
        if (attributeValue === null) {
          if (isDeclaration && !SIMPLE_KEYWORD.test(attributeName)) {
            out += ' "' + attributeName + '"';
          } else {
            out += " " + attributeName;
          }
        } else if (attributeValue.indexOf('"') === -1) {
          out += " " + attributeName + '="' + attributeValue + '"';
        } else {
          out += " " + attributeName + "='" + attributeValue + "'";
        }
      }
      if (firstChar === QUESTION) {
        out += "?>";
        return;
      }
      if (firstChar === BANG) {
        out += ">";
        return;
      }
      out += ">";
    }
    writeChildren(node.children);
    out += "</" + tag + ">";
  }

  writeChildren(Array.isArray(input) ? input : [input]);
  return out;
}

// ---------------------------------------------------------------------------
// Full-featured path — entities, HTML mode, and/or pretty printing
// ---------------------------------------------------------------------------

function fullWriter(
  input: TNode | (TNode | string)[],
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
  const encodeRawText: (input: string) => string = encodeEntities
    ? htmlMode
      ? escapeUTF8
      : escapeText
    : (input) => input;
  /** Encode text content, but pass comments through verbatim. */
  const encodeTextContent = (input: string): string =>
    input.startsWith("<!--") ? input : encodeRawText(input);
  const encodeAttributeValue: (input: string) => string = encodeEntities
    ? htmlMode
      ? escapeUTF8
      : escapeAttribute
    : (input) => input;

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
          out += encodeTextContent(node);
        } else {
          writeNode(node);
        }
      }
    }

    function writeNode(node: TNode): void {
      const tag = node.tagName;
      const attributes = node.attributes;
      const firstChar = tag.charCodeAt(0);
      if (attributes === null) {
        if (firstChar === QUESTION) {
          out += "<" + tag + "?>";
          return;
        }
        // Declaration tags (e.g. !DOCTYPE) — void in all modes
        if (firstChar === BANG) {
          out += "<" + tag + ">";
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
        const isDeclaration = firstChar === BANG;
        const keys = Object.keys(attributes);
        for (let j = 0; j < keys.length; j++) {
          const attributeName = keys[j]!;
          const attributeValue = attributes[attributeName];
          if (attributeValue === null) {
            if (isDeclaration && !SIMPLE_KEYWORD.test(attributeName)) {
              out += ' "' + attributeName + '"';
            } else {
              out += " " + attributeName;
            }
          } else {
            const encoded = encodeAttributeValue(attributeValue);
            if (encoded.indexOf('"') === -1) {
              out += " " + attributeName + '="' + encoded + '"';
            } else {
              out += " " + attributeName + "='" + encoded + "'";
            }
          }
        }
        if (firstChar === QUESTION) {
          out += "?>";
          return;
        }
        // Declaration tags (e.g. !DOCTYPE) — void in all modes
        if (firstChar === BANG) {
          out += ">";
          return;
        }
        // HTML void elements self-close without a closing tag
        if (voidSet !== null && voidSet.has(tag)) {
          out += ">";
          return;
        }
        out += ">";
      }
      writeChildren(node.children);
      out += "</" + tag + ">";
    }

    writeChildren(Array.isArray(input) ? input : [input]);
    return out;
  }

  // Pretty path
  let out = "";

  function hasTextChildren(nodes: (TNode | string)[]): boolean {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      // Comments are structural (like elements) — they don't force inline mode
      if (typeof node === "string" && !node.startsWith("<!--")) return true;
    }
    return false;
  }

  function prettyWriteAttributes(node: TNode, isDeclaration = false): void {
    if (node.attributes === null) return;
    const keys = Object.keys(node.attributes);
    for (let j = 0; j < keys.length; j++) {
      const key = keys[j]!;
      const attributeValue = node.attributes[key];
      if (attributeValue === null) {
        if (isDeclaration && !SIMPLE_KEYWORD.test(key)) {
          out += ' "' + key + '"';
        } else {
          out += " " + key;
        }
      } else {
        const encoded = encodeAttributeValue(attributeValue);
        if (encoded.indexOf('"') === -1) {
          out += " " + key + '="' + encoded + '"';
        } else {
          out += " " + key + "='" + encoded + "'";
        }
      }
    }
  }

  function prettyWriteNode(
    node: TNode,
    depth: number,
    skipPadding?: boolean,
  ): void {
    if (!node) return;
    const padding = indent.repeat(depth);
    const tag = node.tagName;
    const firstChar = tag.charCodeAt(0);

    // Processing instruction
    if (firstChar === QUESTION) {
      out += (skipPadding ? "" : padding) + "<" + tag;
      prettyWriteAttributes(node);
      out += "?>";
      return;
    }

    // Declaration tags (e.g. !DOCTYPE) — void in all modes
    if (firstChar === BANG) {
      out += (skipPadding ? "" : padding) + "<" + tag;
      prettyWriteAttributes(node, true);
      out += ">";
      return;
    }

    const children = node.children;
    const childrenLength = children.length;

    // HTML void elements — self-close without closing tag
    if (voidSet !== null && voidSet.has(tag)) {
      out += (skipPadding ? "" : padding) + "<" + tag;
      prettyWriteAttributes(node);
      out += ">";
      return;
    }

    // Empty element — self-close
    if (childrenLength === 0) {
      out += (skipPadding ? "" : padding) + "<" + tag;
      prettyWriteAttributes(node);
      out += "/>";
      return;
    }

    // Classify children: text-only keeps everything inline; mixed content
    // writes text verbatim and pretty-prints element children.
    const hasText = hasTextChildren(children);
    let hasElements = false;
    if (hasText) {
      for (let i = 0; i < childrenLength; i++) {
        if (typeof children[i] !== "string") {
          hasElements = true;
          break;
        }
      }
    }

    // Text-only (no element children) — keep fully inline
    if (hasText && !hasElements) {
      out += (skipPadding ? "" : padding) + "<" + tag;
      prettyWriteAttributes(node);
      out += ">";
      for (let i = 0; i < childrenLength; i++) {
        out += encodeTextContent(children[i] as string);
      }
      out += "</" + tag + ">";
      return;
    }

    // Mixed content — text verbatim, elements pretty-printed.
    // Text nodes carry their own whitespace (preserved by the parser),
    // so when a text node precedes an element, it already provides the
    // positioning and the element skips its own padding prefix.
    // When an element has no preceding text (first child or after another
    // element), a synthetic newline is added and normal padding is used.
    if (hasText) {
      out += (skipPadding ? "" : padding) + "<" + tag;
      prettyWriteAttributes(node);
      out += ">";
      for (let i = 0; i < childrenLength; i++) {
        const child = children[i]!;
        if (typeof child === "string") {
          out += encodeTextContent(child);
        } else {
          const previousChild = i > 0 ? children[i - 1] : undefined;
          const precededByText =
            typeof previousChild === "string" &&
            !previousChild.startsWith("<!--");
          if (precededByText) {
            // Text before this element provides positioning.
            // If text contains a newline, the element is block-positioned
            // (e.g. "\n  <book>"); pretty-print without leading padding.
            // Otherwise the element is inline (e.g. "Click <a>..."); write
            // it fully inline to preserve tight mixed content.
            if ((previousChild as string).indexOf("\n") !== -1) {
              prettyWriteNode(child, depth + 1, true);
            } else {
              inlineWriteNode(child);
            }
          } else {
            // No preceding text — add newline and use normal padding
            out += "\n";
            prettyWriteNode(child, depth + 1);
          }
        }
      }
      // If the last child is an element, add newline + padding before </tag>
      if (typeof children[childrenLength - 1] !== "string") {
        out += "\n" + padding;
      }
      out += "</" + tag + ">";
      return;
    }

    // Element-only children (and comments) — indent each child
    out += (skipPadding ? "" : padding) + "<" + tag;
    prettyWriteAttributes(node);
    out += ">";
    for (let i = 0; i < childrenLength; i++) {
      const child = children[i]!;
      if (typeof child === "string") {
        // Comments get their own indented line
        out += "\n" + indent.repeat(depth + 1) + encodeTextContent(child);
      } else {
        out += "\n";
        prettyWriteNode(child, depth + 1);
      }
    }
    out += "\n" + padding + "</" + tag + ">";
  }

  /** Write a node inline (no indentation), used inside mixed content. */
  function inlineWriteNode(node: TNode): void {
    if (!node) return;
    const tag = node.tagName;
    const firstChar = tag.charCodeAt(0);
    out += "<" + tag;
    const isDeclaration = firstChar === BANG;
    prettyWriteAttributes(node, isDeclaration);
    if (firstChar === QUESTION) {
      out += "?>";
      return;
    }
    // Declaration tags (e.g. !DOCTYPE) — void in all modes
    if (isDeclaration) {
      out += ">";
      return;
    }
    // HTML void elements self-close without closing tag
    if (voidSet !== null && voidSet.has(tag)) {
      out += ">";
      return;
    }
    if (node.children.length === 0) {
      out += "/>";
      return;
    }
    out += ">";
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!;
      if (typeof child === "string") {
        out += encodeTextContent(child);
      } else {
        inlineWriteNode(child);
      }
    }
    out += "</" + tag + ">";
  }

  const nodes = Array.isArray(input) ? input : [input];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (i > 0) out += "\n";
    if (typeof node === "string") {
      out += encodeTextContent(node);
    } else {
      prettyWriteNode(node, 0);
    }
  }

  return out;
}
