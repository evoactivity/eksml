import type { TNode, ParseOptions } from "./txml.js";
import { fastStream } from "./fastStream.js";
import type { Attributes } from "./fastStream.js";
import { HTML_VOID_ELEMENTS, HTML_RAW_CONTENT_TAGS } from "./txml.js";

/**
 * Parse a processing instruction body string into an attributes record.
 * e.g. `version="1.0" encoding="UTF-8"` -> `{ version: "1.0", encoding: "UTF-8" }`
 *
 * This replicates the attribute-parsing behavior of `parse()` so that PIs
 * emitted by `transformStream` match the `{ tagName: "?xml", attributes: {...} }`
 * format that consumers expect.
 */
function parsePIAttributes(body: string): Record<string, string | null> {
  const attrs: Record<string, string | null> = {};
  const len = body.length;
  let i = 0;

  while (i < len) {
    // Skip whitespace
    let cc = body.charCodeAt(i);
    if (cc === 32 || cc === 9 || cc === 10 || cc === 13) {
      i++;
      continue;
    }

    // Read attribute name
    const nameStart = i;
    while (i < len) {
      cc = body.charCodeAt(i);
      if (cc === 61 || cc === 32 || cc === 9 || cc === 10 || cc === 13) break; // = or whitespace
      i++;
    }
    if (i === nameStart) { i++; continue; }
    const name = body.substring(nameStart, i);

    // Skip whitespace
    while (i < len) {
      cc = body.charCodeAt(i);
      if (cc !== 32 && cc !== 9 && cc !== 10 && cc !== 13) break;
      i++;
    }

    // Check for =
    if (i < len && body.charCodeAt(i) === 61) {
      i++; // skip =
      // Skip whitespace
      while (i < len) {
        cc = body.charCodeAt(i);
        if (cc !== 32 && cc !== 9 && cc !== 10 && cc !== 13) break;
        i++;
      }
      // Read value
      if (i < len) {
        const q = body.charCodeAt(i);
        if (q === 34 || q === 39) { // " or '
          const qChar = body[i]!;
          i++; // skip opening quote
          const valStart = i;
          const end = body.indexOf(qChar, i);
          if (end === -1) {
            attrs[name] = body.substring(valStart);
            i = len;
          } else {
            attrs[name] = body.substring(valStart, end);
            i = end + 1;
          }
        } else {
          // Unquoted value — read until whitespace
          const valStart = i;
          while (i < len) {
            cc = body.charCodeAt(i);
            if (cc === 32 || cc === 9 || cc === 10 || cc === 13) break;
            i++;
          }
          attrs[name] = body.substring(valStart, i);
        }
      } else {
        attrs[name] = null;
      }
    } else {
      // Boolean attribute (no value)
      attrs[name] = null;
    }
  }

  return attrs;
}

/**
 * Create a TransformStream that incrementally parses XML chunks.
 * Uses the Web Streams API, which is available in browsers, Node.js 18+, Deno, and Bun.
 *
 * Internally powered by `fastStream` (SAX parser) with a tree-construction layer
 * that assembles `TNode` subtrees and emits them when each top-level node completes.
 *
 * @param offset - Starting offset or string whose length is the offset
 * @param parseOptions - Options for the XML parser
 * @returns TransformStream that emits parsed XML nodes
 */
export function transformStream(
  offset?: number | string,
  parseOptions?: ParseOptions,
): TransformStream<string, TNode | string> {
  const opts: ParseOptions = parseOptions ? { ...parseOptions } : {};
  let skipBytes: number =
    typeof offset === "string" ? offset.length : offset || 0;

  // Resolve HTML-mode defaults (same logic as parse())
  const isHtml = opts.html === true;
  const selfClosingTags =
    opts.selfClosingTags ?? (isHtml ? HTML_VOID_ELEMENTS : []);
  const rawContentTags =
    opts.rawContentTags ?? (isHtml ? HTML_RAW_CONTENT_TAGS : []);
  const keepComments = opts.keepComments === true;

  // --- Tree-construction state ---
  // Stack of open nodes. When depth (stack.length) returns to 0, emit the node.
  const stack: TNode[] = [];
  let controller: TransformStreamDefaultController<TNode | string> | null =
    null;

  function currentParent(): TNode | null {
    return stack.length > 0 ? stack[stack.length - 1]! : null;
  }

  function emitOrAttach(item: TNode | string): void {
    const parent = currentParent();
    if (parent) {
      parent.children.push(item);
    } else if (controller) {
      controller.enqueue(item);
    }
  }

  const parser = fastStream({
    selfClosingTags,
    rawContentTags,

    onopentag(tagName: string, attributes: Attributes) {
      const node: TNode = {
        tagName,
        attributes: { ...attributes },
        children: [],
      };
      const parent = currentParent();
      if (parent) {
        parent.children.push(node);
      }
      // Push onto stack — unless it's a void/self-closing tag (fastStream
      // will immediately fire onclosetag for those, but we still need the
      // node on the stack for onclosetag to pop).
      stack.push(node);
    },

    onclosetag(_tagName: string) {
      const node = stack.pop();
      if (!node) return;
      // If stack is now empty, this was a top-level node — emit it
      if (stack.length === 0 && controller) {
        controller.enqueue(node);
      }
    },

    ontext(text: string) {
      // fastStream already trims text. Add as child of current node or ignore at top level.
      const parent = currentParent();
      if (parent) {
        parent.children.push(text);
      }
      // Top-level text between elements is discarded (matches parse() behavior
      // where transformStream only emits TNode | comment-string)
    },

    oncdata(data: string) {
      // CDATA content becomes text in the parent node (matches parse() behavior)
      const parent = currentParent();
      if (parent) {
        parent.children.push(data);
      }
    },

    oncomment(comment: string) {
      if (!keepComments) return;
      const parent = currentParent();
      if (parent) {
        // Inside a node — add comment as string child
        parent.children.push(comment);
      } else if (controller) {
        // Top-level comment — emit directly
        controller.enqueue(comment);
      }
    },

    onprocessinginstruction(name: string, body: string) {
      const node: TNode = {
        tagName: "?" + name,
        attributes: parsePIAttributes(body),
        children: [],
      };
      emitOrAttach(node);
    },
  });

  return new TransformStream<string, TNode | string>({
    transform(
      chunk: string,
      ctrl: TransformStreamDefaultController<TNode | string>,
    ): void {
      controller = ctrl;
      // Handle offset: skip leading bytes from the first chunk(s)
      if (skipBytes > 0) {
        if (chunk.length <= skipBytes) {
          skipBytes -= chunk.length;
          return;
        }
        chunk = chunk.substring(skipBytes);
        skipBytes = 0;
      }
      parser.write(chunk);
    },

    flush(
      ctrl: TransformStreamDefaultController<TNode | string>,
    ): void {
      controller = ctrl;
      parser.close();
    },
  });
}
