import type { TNode } from "./parser.ts";

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

  const indent = !options?.pretty
    ? ""
    : typeof options.pretty === "string"
      ? options.pretty
      : "  ";

  // Non-pretty fast path — original compact logic
  if (!indent) {
    let out = "";

    function writeChildren(nodes: (TNode | string)[]): void {
      if (nodes) {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i]!;
          if (typeof node === "string") {
            out += node.trim();
          } else if (node) {
            writeNode(node);
          }
        }
      }
    }

    function writeNode(N: TNode): void {
      if (!N) return;
      out += "<" + N.tagName;
      writeAttrs(N);
      if (N.tagName[0] === "?") {
        out += "?>";
        return;
      }
      out += ">";
      writeChildren(N.children);
      out += "</" + N.tagName + ">";
    }

    function writeAttrs(N: TNode): void {
      for (const i in N.attributes) {
        const attrValue = N.attributes[i];
        if (attrValue === null) {
          out += " " + i;
        } else if (attrValue.indexOf('"') === -1) {
          out += " " + i + '="' + attrValue.trim() + '"';
        } else {
          out += " " + i + "='" + attrValue.trim() + "'";
        }
      }
    }

    writeChildren(Array.isArray(O) ? O : [O]);
    return out;
  }

  // Pretty path
  let out = "";
  const newline = "\n";

  function hasTextChildren(nodes: (TNode | string)[]): boolean {
    for (let i = 0; i < nodes.length; i++) {
      if (typeof nodes[i] === "string") return true;
    }
    return false;
  }

  function prettyWriteAttrs(N: TNode): void {
    for (const key in N.attributes) {
      const val = N.attributes[key];
      if (val === null) {
        out += " " + key;
      } else if (val.indexOf('"') === -1) {
        out += " " + key + '="' + val + '"';
      } else {
        out += " " + key + "='" + val + "'";
      }
    }
  }

  function prettyWriteNode(N: TNode, depth: number): void {
    if (!N) return;
    const pad = indent.repeat(depth);

    // Processing instruction
    if (N.tagName[0] === "?") {
      out += pad + "<" + N.tagName;
      prettyWriteAttrs(N);
      out += "?>";
      return;
    }

    const children = N.children;
    const len = children.length;

    // Empty element — self-close
    if (len === 0) {
      out += pad + "<" + N.tagName;
      prettyWriteAttrs(N);
      out += "/>";
      return;
    }

    // Text-only or mixed content (has any string children) — keep inline
    if (hasTextChildren(children)) {
      out += pad + "<" + N.tagName;
      prettyWriteAttrs(N);
      out += ">";
      for (let i = 0; i < len; i++) {
        const child = children[i]!;
        if (typeof child === "string") {
          out += child.trim();
        } else {
          // Inline nested element within mixed content
          inlineWriteNode(child);
        }
      }
      out += "</" + N.tagName + ">";
      return;
    }

    // Element-only children — indent each child
    out += pad + "<" + N.tagName;
    prettyWriteAttrs(N);
    out += ">";
    for (let i = 0; i < len; i++) {
      const child = children[i]!;
      if (typeof child === "string") {
        out += child.trim();
      } else {
        out += newline;
        prettyWriteNode(child, depth + 1);
      }
    }
    out += newline + pad + "</" + N.tagName + ">";
  }

  /** Write a node inline (no indentation), used inside mixed content. */
  function inlineWriteNode(N: TNode): void {
    if (!N) return;
    out += "<" + N.tagName;
    prettyWriteAttrs(N);
    if (N.tagName[0] === "?") {
      out += "?>";
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
        out += child.trim();
      } else {
        inlineWriteNode(child);
      }
    }
    out += "</" + N.tagName + ">";
  }

  const nodes = Array.isArray(O) ? O : [O];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (i > 0) out += newline;
    if (typeof node === "string") {
      const trimmed = node.trim();
      if (trimmed) out += trimmed;
    } else {
      prettyWriteNode(node, 0);
    }
  }

  return out;
}
