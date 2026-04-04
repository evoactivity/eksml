import type { TNode } from '#src/parser.ts';
import { saxEngine } from '#src/saxEngine.ts';
import type { Attributes } from '#src/saxEngine.ts';
import {
  HTML_VOID_ELEMENTS,
  HTML_RAW_CONTENT_TAGS,
} from '#src/utilities/htmlConstants.ts';
import { convertItemToLossy } from '#src/converters/lossy.ts';
import type { LossyValue } from '#src/converters/lossy.ts';
import { convertItemToLossless } from '#src/converters/lossless.ts';
import type { LosslessEntry } from '#src/converters/lossless.ts';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Options for `XmlParseStream`.
 *
 * Only the fields that the transform layer actually consumes are exposed here.
 * This keeps the API honest — options like `trimWhitespace`, `entities`, and
 * `strict` belong to the synchronous `parse()` function, not the streaming
 * tree-builder.
 */
export interface XmlParseStreamOptions {
  /**
   * Starting byte offset — skip this many leading characters from the input.
   * When a string is passed, its `.length` is used as the offset.
   */
  offset?: number | string;
  /** Enable HTML parsing mode (sets default selfClosingTags/rawContentTags). */
  html?: boolean;
  /**
   * Tag names that are self-closing (void elements).
   * Defaults to standard HTML void elements when `html` is `true`, else `[]`.
   */
  selfClosingTags?: string[];
  /**
   * Tag names whose content is raw text (not parsed as XML/HTML).
   * Defaults to `["script", "style"]` when `html` is `true`, else `[]`.
   */
  rawContentTags?: string[];
  /** Keep XML comments in the output. Defaults to `false`. */
  keepComments?: boolean;
  /**
   * Emit only elements matching these tag names instead of waiting for the
   * entire top-level tree to close.
   *
   * When set, each matching element is emitted as a standalone `TNode` subtree
   * the moment its close tag is encountered, regardless of nesting depth.
   * Non-matching ancestor elements are **not** built or emitted — the stream
   * only produces the selected subtrees.
   *
   * Accepts a single tag name or an array of tag names.
   *
   * @example
   * ```ts
   * // Given: <root><item>1</item><item>2</item></root>
   * // Without select: emits one big <root> TNode after </root>
   * // With select: "item": emits two <item> TNodes as each closes
   * const stream = new XmlParseStream({ select: 'item' });
   * ```
   */
  select?: string | string[];
  /**
   * Output format for emitted chunks.
   *
   * - `'dom'` (default) — emit raw `TNode | string` values.
   * - `'lossy'` — convert each item to the compact lossy format (`LossyValue`).
   * - `'lossless'` — convert each item to the order-preserving lossless format
   *   (`LosslessEntry`).
   */
  output?: 'dom' | 'lossy' | 'lossless';
}

// Re-export converter output types so consumers can import them from the
// same entry point when using `output: 'lossy'` or `output: 'lossless'`.
export type { LossyValue, LosslessEntry };
// @generated:char-codes:begin
const EQ = 61; // =
const SQUOTE = 39; // '
const DQUOTE = 34; // "
const TAB = 9; // \t
const LF = 10; // \n
const CR = 13; // \r
const SPACE = 32; // (space)
// @generated:char-codes:end

/**
 * Convert a SAX `Attributes` object into the format used by `parse()`:
 * - Returns `null` when there are no attributes.
 * - Returns an `Object.create(null)` prototype-free record otherwise.
 */
function toNodeAttributes(
  attributes: Attributes,
): Record<string, string | null> | null {
  const keys = Object.keys(attributes);
  if (keys.length === 0) return null;
  const out: Record<string, string | null> = Object.create(null);
  for (let i = 0; i < keys.length; i++) {
    out[keys[i]!] = attributes[keys[i]!]!;
  }
  return out;
}

/**
 * Parse a processing instruction body string into an attributes record.
 * e.g. `version="1.0" encoding="UTF-8"` -> `{ version: "1.0", encoding: "UTF-8" }`
 *
 * This replicates the attribute-parsing behavior of `parse()` so that PIs
 * emitted by `XmlParseStream` match the `{ tagName: "?xml", attributes: {...} }`
 * format that consumers expect.
 *
 * Returns `null` when the body contains no attributes, matching `parse()`.
 * Uses `Object.create(null)` for prototype-free attribute records.
 */
function parsePIAttributes(body: string): Record<string, string | null> | null {
  let attributes: Record<string, string | null> | null = null;
  const bodyLength = body.length;
  let i = 0;

  while (i < bodyLength) {
    // Skip whitespace
    let charCode = body.charCodeAt(i);
    if (
      charCode === SPACE ||
      charCode === TAB ||
      charCode === LF ||
      charCode === CR
    ) {
      i++;
      continue;
    }

    // Read attribute name
    const nameStart = i;
    while (i < bodyLength) {
      charCode = body.charCodeAt(i);
      if (
        charCode === EQ ||
        charCode === SPACE ||
        charCode === TAB ||
        charCode === LF ||
        charCode === CR
      )
        break;
      i++;
    }
    if (i === nameStart) {
      i++;
      continue;
    }
    const name = body.substring(nameStart, i);

    // Allocate attributes object lazily on first attribute
    if (attributes === null) attributes = Object.create(null);

    // Skip whitespace
    while (i < bodyLength) {
      charCode = body.charCodeAt(i);
      if (
        charCode !== SPACE &&
        charCode !== TAB &&
        charCode !== LF &&
        charCode !== CR
      )
        break;
      i++;
    }

    // Check for =
    if (i < bodyLength && body.charCodeAt(i) === EQ) {
      i++; // skip =
      // Skip whitespace
      while (i < bodyLength) {
        charCode = body.charCodeAt(i);
        if (
          charCode !== SPACE &&
          charCode !== TAB &&
          charCode !== LF &&
          charCode !== CR
        )
          break;
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
            attributes![name] = body.substring(valueStartIndex);
            i = bodyLength;
          } else {
            attributes![name] = body.substring(valueStartIndex, end);
            i = end + 1;
          }
        } else {
          // Unquoted value — read until whitespace
          const valueStartIndex = i;
          while (i < bodyLength) {
            charCode = body.charCodeAt(i);
            if (
              charCode === SPACE ||
              charCode === TAB ||
              charCode === LF ||
              charCode === CR
            )
              break;
            i++;
          }
          attributes![name] = body.substring(valueStartIndex, i);
        }
      } else {
        attributes![name] = null;
      }
    } else {
      // Boolean attribute (no value)
      attributes![name] = null;
    }
  }

  return attributes;
}

/**
 * A Web Streams `TransformStream` that incrementally parses XML chunks into
 * `TNode` subtrees (or lossy/lossless objects). Works in browsers, Node.js
 * 18+, Deno, and Bun.
 *
 * Follows the platform stream class convention (like `TextDecoderStream`,
 * `DecompressionStream`, etc.) — instantiate with `new` and use with
 * `.pipeThrough()`.
 *
 * Internally powered by the SAX engine with a tree-construction layer
 * that assembles `TNode` subtrees and emits them as they complete.
 *
 * By default, nodes are emitted when a top-level element closes (depth 0).
 * Use the `select` option to emit specific elements as they close at any depth,
 * without waiting for the entire document root to finish.
 *
 * Use the `output` option to choose the emitted format:
 * - `'dom'` (default) — raw `TNode | string`
 * - `'lossy'` — compact lossy objects (`LossyValue`)
 * - `'lossless'` — order-preserving objects (`LosslessEntry`)
 *
 * @example
 * ```ts
 * import { XmlParseStream } from 'eksml/stream';
 *
 * const response = await fetch('/feed.xml');
 * const reader = response.body
 *   .pipeThrough(new TextDecoderStream())
 *   .pipeThrough(new XmlParseStream())
 *   .getReader();
 *
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) break;
 *   console.log(value); // TNode or string
 * }
 * ```
 */
export class XmlParseStream<TOutput = TNode | string> extends TransformStream<
  string,
  TOutput
> {
  /** Default DOM output (`TNode | string`). */
  constructor(options?: XmlParseStreamOptions & { output?: 'dom' });
  /** Lossy output — each item is converted to `LossyValue`. */
  constructor(options: XmlParseStreamOptions & { output: 'lossy' });
  /** Lossless output — each item is converted to `LosslessEntry`. */
  constructor(options: XmlParseStreamOptions & { output: 'lossless' });
  constructor(options?: XmlParseStreamOptions) {
    const resolvedOptions = options ?? {};
    let skipBytes: number =
      typeof resolvedOptions.offset === 'string'
        ? resolvedOptions.offset.length
        : resolvedOptions.offset || 0;

    // Resolve HTML-mode defaults (same logic as parse())
    const isHtml = resolvedOptions.html === true;
    const selfClosingTags =
      resolvedOptions.selfClosingTags ?? (isHtml ? HTML_VOID_ELEMENTS : []);
    const rawContentTags =
      resolvedOptions.rawContentTags ?? (isHtml ? HTML_RAW_CONTENT_TAGS : []);
    const keepComments = resolvedOptions.keepComments === true;

    // Resolve select into a Set for O(1) lookup (null = emit at depth 0)
    const selectSet: Set<string> | null =
      resolvedOptions.select == null
        ? null
        : typeof resolvedOptions.select === 'string'
          ? new Set([resolvedOptions.select])
          : resolvedOptions.select.length > 0
            ? new Set(resolvedOptions.select)
            : null;

    // Resolve the output converter — identity for 'dom', otherwise a mapping fn.
    const outputMode = resolvedOptions.output ?? 'dom';
    const convert: (item: TNode | string) => TOutput =
      outputMode === 'lossy'
        ? (convertItemToLossy as (item: TNode | string) => TOutput)
        : outputMode === 'lossless'
          ? (convertItemToLossless as (item: TNode | string) => TOutput)
          : (((item: TNode | string) => item) as (
              item: TNode | string,
            ) => TOutput);

    // --- Tree-construction state ---
    let streamController: TransformStreamDefaultController<TOutput> | null =
      null;

    // When `select` is null (default mode): stack holds all open TNodes.
    // Emission happens when stack.length returns to 0.
    //
    // When `select` is set: `depth` tracks total nesting depth (for all
    // elements, including non-selected ancestors). `stack` only holds nodes
    // within a selected subtree. `selectDepth` records the depth at which the
    // outermost selected element was opened (-1 = not inside a selection).
    const stack: TNode[] = [];
    let depth = 0;
    let selectDepth = -1;

    // -----------------------------------------------------------------------
    // Default mode helpers (no select — original behavior)
    // -----------------------------------------------------------------------

    function currentParent(): TNode | null {
      return stack.length > 0 ? stack[stack.length - 1]! : null;
    }

    function emitOrAttach(item: TNode | string): void {
      const parent = currentParent();
      if (parent) {
        parent.children.push(item);
      } else if (streamController) {
        streamController.enqueue(convert(item));
      }
    }

    // -----------------------------------------------------------------------
    // Select-mode helpers
    // -----------------------------------------------------------------------

    /** Whether we are currently inside a selected subtree. */
    function insideSelection(): boolean {
      return selectDepth >= 0;
    }

    /** The TNode at the top of the stack, or null. */
    function selectParent(): TNode | null {
      return stack.length > 0 ? stack[stack.length - 1]! : null;
    }

    // -----------------------------------------------------------------------
    // SAX handler: default mode (no select)
    // -----------------------------------------------------------------------

    function defaultOnopentag(tagName: string, attributes: Attributes): void {
      const node: TNode = {
        tagName,
        attributes: toNodeAttributes(attributes),
        children: [],
      };
      const parent = currentParent();
      if (parent) {
        parent.children.push(node);
      }
      stack.push(node);
    }

    function defaultOnclosetag(_tagName: string): void {
      const node = stack.pop();
      if (!node) return;
      if (stack.length === 0 && streamController) {
        streamController.enqueue(convert(node));
      }
    }

    function defaultOntext(text: string): void {
      const parent = currentParent();
      if (parent) {
        parent.children.push(text);
      }
    }

    function defaultOncdata(data: string): void {
      const parent = currentParent();
      if (parent) {
        parent.children.push(data);
      }
    }

    function defaultOncomment(comment: string): void {
      if (!keepComments) return;
      const parent = currentParent();
      if (parent) {
        parent.children.push(comment);
      } else if (streamController) {
        streamController.enqueue(convert(comment));
      }
    }

    function defaultOnprocessinginstruction(name: string, body: string): void {
      const node: TNode = {
        tagName: '?' + name,
        attributes: parsePIAttributes(body),
        children: [],
      };
      emitOrAttach(node);
    }

    function defaultOndoctype(tagName: string, attributes: Attributes): void {
      const node: TNode = {
        tagName,
        attributes: toNodeAttributes(attributes),
        children: [],
      };
      emitOrAttach(node);
    }

    // -----------------------------------------------------------------------
    // SAX handler: select mode
    // -----------------------------------------------------------------------

    function selectOnopentag(tagName: string, attributes: Attributes): void {
      depth++;
      if (insideSelection()) {
        // Inside a selected subtree — build the TNode and attach to parent.
        const node: TNode = {
          tagName,
          attributes: toNodeAttributes(attributes),
          children: [],
        };
        const parent = selectParent();
        if (parent) {
          parent.children.push(node);
        }
        stack.push(node);
      } else if (selectSet!.has(tagName)) {
        // This element matches the selector — start a new selected subtree.
        selectDepth = depth;
        const node: TNode = {
          tagName,
          attributes: toNodeAttributes(attributes),
          children: [],
        };
        stack.push(node);
      }
      // Otherwise: non-selected ancestor — no allocation, just depth tracking.
    }

    function selectOnclosetag(_tagName: string): void {
      if (insideSelection()) {
        if (depth === selectDepth) {
          // The selected element itself is closing — emit it.
          const node = stack.pop();
          if (node && streamController) {
            streamController.enqueue(convert(node));
          }
          selectDepth = -1;
        } else {
          // A descendant of the selected element is closing — already
          // attached to its parent via onopentag, just pop from stack.
          stack.pop();
        }
      }
      depth--;
    }

    function selectOntext(text: string): void {
      if (!insideSelection()) return;
      const parent = selectParent();
      if (parent) {
        parent.children.push(text);
      }
    }

    function selectOncdata(data: string): void {
      if (!insideSelection()) return;
      const parent = selectParent();
      if (parent) {
        parent.children.push(data);
      }
    }

    function selectOncomment(comment: string): void {
      if (!keepComments) return;
      if (!insideSelection()) return;
      const parent = selectParent();
      if (parent) {
        parent.children.push(comment);
      }
    }

    function selectOnprocessinginstruction(name: string, body: string): void {
      if (!insideSelection()) return;
      const node: TNode = {
        tagName: '?' + name,
        attributes: parsePIAttributes(body),
        children: [],
      };
      const parent = selectParent();
      if (parent) {
        parent.children.push(node);
      }
    }

    function selectOndoctype(tagName: string, attributes: Attributes): void {
      if (!insideSelection()) return;
      const node: TNode = {
        tagName,
        attributes: toNodeAttributes(attributes),
        children: [],
      };
      const parent = selectParent();
      if (parent) {
        parent.children.push(node);
      }
    }

    // -----------------------------------------------------------------------
    // Wire up the appropriate handler set
    // -----------------------------------------------------------------------

    const parser = saxEngine({
      selfClosingTags,
      rawContentTags,
      onopentag: selectSet ? selectOnopentag : defaultOnopentag,
      onclosetag: selectSet ? selectOnclosetag : defaultOnclosetag,
      ontext: selectSet ? selectOntext : defaultOntext,
      oncdata: selectSet ? selectOncdata : defaultOncdata,
      oncomment: selectSet ? selectOncomment : defaultOncomment,
      onprocessinginstruction: selectSet
        ? selectOnprocessinginstruction
        : defaultOnprocessinginstruction,
      ondoctype: selectSet ? selectOndoctype : defaultOndoctype,
    });

    super({
      transform(
        chunk: string,
        controller: TransformStreamDefaultController<TOutput>,
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

      flush(controller: TransformStreamDefaultController<TOutput>): void {
        streamController = controller;
        parser.close();
      },
    });
  }
}
