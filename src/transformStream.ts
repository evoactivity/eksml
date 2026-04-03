import type { TNode, ParseOptions } from "./parser.js";
import { fastStream } from "./fastStream.js";
import type { Attributes } from "./fastStream.js";
import {
  HTML_VOID_ELEMENTS,
  HTML_RAW_CONTENT_TAGS,
} from "./utilities/htmlConstants.js";
import {
  SPACE, TAB, LF, CR, EQ, DQUOTE, SQUOTE,
} from "./utilities/charCodes.js";

/**
 * Parse a processing instruction body string into an attributes record.
 * e.g. `version="1.0" encoding="UTF-8"` -> `{ version: "1.0", encoding: "UTF-8" }`
 *
 * This replicates the attribute-parsing behavior of `parse()` so that PIs
 * emitted by `transformStream` match the `{ tagName: "?xml", attributes: {...} }`
 * format that consumers expect.
 */
function parsePIAttributes(body: string): Record<string, string | null> {
  const attributes: Record<string, string | null> = {};
  const bodyLength = body.length;
  let i = 0;

  while (i < bodyLength) {
    // Skip whitespace
    let charCode = body.charCodeAt(i);
    if (charCode === SPACE || charCode === TAB || charCode === LF || charCode === CR) {
      i++;
      continue;
    }

    // Read attribute name
    const nameStart = i;
    while (i < bodyLength) {
      charCode = body.charCodeAt(i);
      if (charCode === EQ || charCode === SPACE || charCode === TAB || charCode === LF || charCode === CR) break;
      i++;
    }
    if (i === nameStart) { i++; continue; }
    const name = body.substring(nameStart, i);

    // Skip whitespace
    while (i < bodyLength) {
      charCode = body.charCodeAt(i);
      if (charCode !== SPACE && charCode !== TAB && charCode !== LF && charCode !== CR) break;
      i++;
    }

    // Check for =
    if (i < bodyLength && body.charCodeAt(i) === EQ) {
      i++; // skip =
      // Skip whitespace
      while (i < bodyLength) {
        charCode = body.charCodeAt(i);
        if (charCode !== SPACE && charCode !== TAB && charCode !== LF && charCode !== CR) break;
        i++;
      }
      // Read value
      if (i < bodyLength) {
        const quoteCharCode = body.charCodeAt(i);
        if (quoteCharCode === DQUOTE || quoteCharCode === SQUOTE) {
          const quoteCharacter = body[i]!;
          i++; // skip opening quote
          const valueStartIndex = i;
          const end = body.indexOf(quoteCharacter, i);
          if (end === -1) {
            attributes[name] = body.substring(valueStartIndex);
            i = bodyLength;
          } else {
            attributes[name] = body.substring(valueStartIndex, end);
            i = end + 1;
          }
        } else {
          // Unquoted value — read until whitespace
          const valueStartIndex = i;
          while (i < bodyLength) {
            charCode = body.charCodeAt(i);
            if (charCode === SPACE || charCode === TAB || charCode === LF || charCode === CR) break;
            i++;
          }
          attributes[name] = body.substring(valueStartIndex, i);
        }
      } else {
        attributes[name] = null;
      }
    } else {
      // Boolean attribute (no value)
      attributes[name] = null;
    }
  }

  return attributes;
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
  const resolvedOptions: ParseOptions = parseOptions ? { ...parseOptions } : {};
  let skipBytes: number =
    typeof offset === "string" ? offset.length : offset || 0;

  // Resolve HTML-mode defaults (same logic as parse())
  const isHtml = resolvedOptions.html === true;
  const selfClosingTags =
    resolvedOptions.selfClosingTags ?? (isHtml ? HTML_VOID_ELEMENTS : []);
  const rawContentTags =
    resolvedOptions.rawContentTags ?? (isHtml ? HTML_RAW_CONTENT_TAGS : []);
  const keepComments = resolvedOptions.keepComments === true;

  // --- Tree-construction state ---
  // Stack of open nodes. When depth (stack.length) returns to 0, emit the node.
  const stack: TNode[] = [];
  let streamController: TransformStreamDefaultController<TNode | string> | null =
    null;

  function currentParent(): TNode | null {
    return stack.length > 0 ? stack[stack.length - 1]! : null;
  }

  function emitOrAttach(item: TNode | string): void {
    const parent = currentParent();
    if (parent) {
      parent.children.push(item);
    } else if (streamController) {
      streamController.enqueue(item);
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
      if (stack.length === 0 && streamController) {
        streamController.enqueue(node);
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
      } else if (streamController) {
        // Top-level comment — emit directly
        streamController.enqueue(comment);
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
      controller: TransformStreamDefaultController<TNode | string>,
    ): void {
      streamController = controller;
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
      controller: TransformStreamDefaultController<TNode | string>,
    ): void {
      streamController = controller;
      parser.close();
    },
  });
}
