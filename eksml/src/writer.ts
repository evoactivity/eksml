import { escapeText, escapeAttribute, escapeUTF8 } from 'entities';
import type { TNode } from '#src/parser.ts';
import type { LossyValue } from '#src/converters/lossy.ts';
import type { LosslessEntry } from '#src/converters/lossless.ts';
import { fromLossy } from '#src/converters/fromLossy.ts';
import { fromLossless } from '#src/converters/fromLossless.ts';
import { HTML_VOID_ELEMENTS } from '#src/utilities/htmlConstants.ts';
// @generated:char-codes:begin
const BANG = 33; // !
const QUESTION = 63; // ?
// @generated:char-codes:end

/**
 * Characters forbidden in XML tag names and attribute names.
 * Covers structural delimiters (`<`, `>`, `=`), quote characters, and
 * whitespace that would break well-formedness if interpolated unchecked.
 */
const INVALID_NAME_CHARS = /[<>=\s"']/;

function validateTagName(tag: string): void {
  if (tag.length === 0) {
    throw new Error('Invalid tag name: tag name must not be empty');
  }
  // Allow leading `?` (PI) or `!` (DOCTYPE), validate the rest
  const name =
    tag.charCodeAt(0) === QUESTION || tag.charCodeAt(0) === BANG
      ? tag.substring(1)
      : tag;
  if (name.length === 0) return; // bare `?` or `!` is degenerate but harmless
  if (INVALID_NAME_CHARS.test(name)) {
    throw new Error(`Invalid tag name: "${tag}" contains forbidden characters`);
  }
}

function validateAttributeNames(attributes: Record<string, unknown>): void {
  const keys = Object.keys(attributes);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    if (key.length === 0 || INVALID_NAME_CHARS.test(key)) {
      throw new Error(
        `Invalid attribute name: "${key}" contains forbidden characters`,
      );
    }
  }
}

/**
 * Recursion depth at which the circular-reference WeakSet guard kicks in.
 * Below this depth, no WeakSet overhead is incurred — the natural call-stack
 * limit provides a safety net. Typical XML documents have depth < 10.
 */
const CIRCULAR_CHECK_DEPTH = 16;

/** Options for write. */
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

/** Input types accepted by `write()`. */
export type WriterInput =
  | TNode
  | (TNode | string)[]
  | LossyValue
  | LossyValue[]
  | LosslessEntry[];

/**
 * Serialize a parsed DOM, lossy object, or lossless entry array back to XML.
 *
 * Input format is auto-detected:
 * - `TNode` or `(TNode | string)[]` — DOM tree, serialized directly
 * - `LossyValue` or `LossyValue[]` — converted to DOM via `fromLossy()` first
 * - `LosslessEntry[]` — converted to DOM via `fromLossless()` first
 *
 * @param input - The node(s), lossy object(s), or lossless entries to serialize
 * @param options - Formatting options
 * @returns XML string
 */
export function write(
  input: TNode | (TNode | string)[],
  options?: WriterOptions,
): string;
export function write(
  input: LossyValue | LossyValue[],
  options?: WriterOptions,
): string;
export function write(input: LosslessEntry[], options?: WriterOptions): string;
export function write(input: WriterInput, options?: WriterOptions): string;
export function write(input: WriterInput, options?: WriterOptions): string {
  if (!input) return '';

  const dom = toDom(input);

  // Fast path: no options — skip all option parsing, closure creation,
  // identity function allocation, and voidSet construction.
  if (!options || (!options.pretty && !options.entities && !options.html)) {
    return compactWrite(dom);
  }

  return fullWriter(dom, options);
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
  let out = '';
  let seen: WeakSet<TNode> | null = null;

  function writeChildren(nodes: (TNode | string)[], depth: number): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      if (typeof node === 'string') {
        out += node;
      } else {
        writeNode(node, depth);
      }
    }
  }

  function writeNode(node: TNode, depth: number): void {
    if (depth >= CIRCULAR_CHECK_DEPTH) {
      if (seen === null) seen = new WeakSet<TNode>();
      if (seen.has(node)) {
        throw new Error('Circular reference detected in TNode tree');
      }
      seen.add(node);
    }
    const tag = node.tagName;
    validateTagName(tag);
    const attributes = node.attributes;
    const firstChar = tag.charCodeAt(0);
    // Skip attribute name validation for declarations (!DOCTYPE etc.)
    // where keys are quoted identifiers, not XML attribute names
    if (attributes !== null && firstChar !== BANG) {
      validateAttributeNames(attributes);
    }
    if (attributes === null) {
      // No attributes — combine open tag into one concat
      if (firstChar === QUESTION) {
        out += '<' + tag + '?>';
        return;
      }
      if (firstChar === BANG) {
        out += '<' + tag + '>';
        return;
      }
      out += '<' + tag + '>';
    } else {
      out += '<' + tag;
      const isDeclaration = firstChar === BANG;
      const keys = Object.keys(attributes);
      for (let j = 0; j < keys.length; j++) {
        const attributeName = keys[j]!;
        const attributeValue = attributes[attributeName];
        if (attributeValue === null) {
          if (isDeclaration && !SIMPLE_KEYWORD.test(attributeName)) {
            out += ' "' + attributeName + '"';
          } else {
            out += ' ' + attributeName;
          }
        } else if (attributeValue.indexOf('"') === -1) {
          out += ' ' + attributeName + '="' + attributeValue + '"';
        } else if (attributeValue.indexOf("'") === -1) {
          out += ' ' + attributeName + "='" + attributeValue + "'";
        } else {
          // Value contains both quote types — escape single quotes
          out +=
            ' ' +
            attributeName +
            "='" +
            attributeValue.replace(/'/g, '&apos;') +
            "'";
        }
      }
      if (firstChar === QUESTION) {
        out += '?>';
        return;
      }
      if (firstChar === BANG) {
        out += '>';
        return;
      }
      out += '>';
    }
    writeChildren(node.children, depth + 1);
    out += '</' + tag + '>';
  }

  writeChildren(Array.isArray(input) ? input : [input], 0);
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
    ? ''
    : typeof options.pretty === 'string'
      ? options.pretty
      : '  ';

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
    input.startsWith('<!--') ? input : encodeRawText(input);
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
    let out = '';
    let seen: WeakSet<TNode> | null = null;

    function writeChildren(nodes: (TNode | string)[], depth: number): void {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]!;
        if (typeof node === 'string') {
          out += encodeTextContent(node);
        } else {
          writeNode(node, depth);
        }
      }
    }

    function writeNode(node: TNode, depth: number): void {
      if (depth >= CIRCULAR_CHECK_DEPTH) {
        if (seen === null) seen = new WeakSet<TNode>();
        if (seen.has(node)) {
          throw new Error('Circular reference detected in TNode tree');
        }
        seen.add(node);
      }
      const tag = node.tagName;
      validateTagName(tag);
      const attributes = node.attributes;
      const firstChar = tag.charCodeAt(0);
      // Skip attribute name validation for declarations (!DOCTYPE etc.)
      // where keys are quoted identifiers, not XML attribute names
      if (attributes !== null && firstChar !== BANG) {
        validateAttributeNames(attributes);
      }
      if (attributes === null) {
        if (firstChar === QUESTION) {
          out += '<' + tag + '?>';
          return;
        }
        // Declaration tags (e.g. !DOCTYPE) — void in all modes
        if (firstChar === BANG) {
          out += '<' + tag + '>';
          return;
        }
        // HTML void elements self-close without a closing tag
        if (voidSet !== null && voidSet.has(tag)) {
          out += '<' + tag + '>';
          return;
        }
        out += '<' + tag + '>';
      } else {
        out += '<' + tag;
        const isDeclaration = firstChar === BANG;
        const keys = Object.keys(attributes);
        for (let j = 0; j < keys.length; j++) {
          const attributeName = keys[j]!;
          const attributeValue = attributes[attributeName];
          if (attributeValue === null) {
            if (isDeclaration && !SIMPLE_KEYWORD.test(attributeName)) {
              out += ' "' + attributeName + '"';
            } else {
              out += ' ' + attributeName;
            }
          } else {
            const encoded = encodeAttributeValue(attributeValue);
            if (encoded.indexOf('"') === -1) {
              out += ' ' + attributeName + '="' + encoded + '"';
              /* v8 ignore start — unreachable: escapeAttribute encodes " to &quot; */
            } else if (encoded.indexOf("'") === -1) {
              out += ' ' + attributeName + "='" + encoded + "'";
            } else {
              // Value contains both quote types — escape single quotes
              out +=
                ' ' +
                attributeName +
                "='" +
                encoded.replace(/'/g, '&apos;') +
                "'";
            }
            /* v8 ignore stop */
          }
        }
        if (firstChar === QUESTION) {
          out += '?>';
          return;
        }
        // Declaration tags (e.g. !DOCTYPE) — void in all modes
        if (firstChar === BANG) {
          out += '>';
          return;
        }
        // HTML void elements self-close without a closing tag
        if (voidSet !== null && voidSet.has(tag)) {
          out += '>';
          return;
        }
        out += '>';
      }
      writeChildren(node.children, depth + 1);
      out += '</' + tag + '>';
    }

    writeChildren(Array.isArray(input) ? input : [input], 0);
    return out;
  }

  // Pretty path
  let out = '';
  let seen: WeakSet<TNode> | null = null;

  function hasTextChildren(nodes: (TNode | string)[]): boolean {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      // Comments are structural (like elements) — they don't force inline mode
      if (typeof node === 'string' && !node.startsWith('<!--')) return true;
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
          out += ' ' + key;
        }
      } else {
        const encoded = encodeAttributeValue(attributeValue);
        if (encoded.indexOf('"') === -1) {
          out += ' ' + key + '="' + encoded + '"';
        } else if (encoded.indexOf("'") === -1) {
          out += ' ' + key + "='" + encoded + "'";
        } else {
          // Value contains both quote types — escape single quotes
          out += ' ' + key + "='" + encoded.replace(/'/g, '&apos;') + "'";
        }
      }
    }
  }

  function prettyWriteNode(node: TNode, depth: number): void {
    if (!node) return;
    if (depth >= CIRCULAR_CHECK_DEPTH) {
      if (seen === null) seen = new WeakSet<TNode>();
      if (seen.has(node)) {
        throw new Error('Circular reference detected in TNode tree');
      }
      seen.add(node);
    }
    const tag = node.tagName;
    validateTagName(tag);
    const padding = indent.repeat(depth);
    const firstChar = tag.charCodeAt(0);
    // Skip attribute name validation for declarations (!DOCTYPE etc.)
    // where keys are quoted identifiers, not XML attribute names
    if (node.attributes !== null && firstChar !== BANG) {
      validateAttributeNames(node.attributes);
    }

    // Processing instruction
    if (firstChar === QUESTION) {
      out += padding + '<' + tag;
      prettyWriteAttributes(node);
      out += '?>';
      return;
    }

    // Declaration tags (e.g. !DOCTYPE) — void in all modes
    if (firstChar === BANG) {
      out += padding + '<' + tag;
      prettyWriteAttributes(node, true);
      out += '>';
      return;
    }

    const children = node.children;
    const childrenLength = children.length;

    // HTML void elements — self-close without closing tag
    if (voidSet !== null && voidSet.has(tag)) {
      out += padding + '<' + tag;
      prettyWriteAttributes(node);
      out += '>';
      return;
    }

    // Empty element — self-close
    if (childrenLength === 0) {
      out += padding + '<' + tag;
      prettyWriteAttributes(node);
      out += '/>';
      return;
    }

    // Classify children
    const hasText = hasTextChildren(children);
    let hasElements = false;
    if (hasText) {
      for (let i = 0; i < childrenLength; i++) {
        if (typeof children[i] !== 'string') {
          hasElements = true;
          break;
        }
      }
    }

    // Text-only (no element children) — trim each text child, join with
    // a single space, and write inline on one line.
    if (hasText && !hasElements) {
      out += padding + '<' + tag;
      prettyWriteAttributes(node);
      out += '>';
      let first = true;
      for (let i = 0; i < childrenLength; i++) {
        const text = (children[i] as string).trim();
        if (text.length === 0) continue;
        if (!first) out += ' ';
        first = false;
        out += encodeTextContent(text);
      }
      out += '</' + tag + '>';
      return;
    }

    // Mixed content — trim text nodes, drop empty, place each non-empty
    // text and each element child on its own indented line.
    if (hasText) {
      const childPadding = indent.repeat(depth + 1);
      out += padding + '<' + tag;
      prettyWriteAttributes(node);
      out += '>';
      for (let i = 0; i < childrenLength; i++) {
        const child = children[i]!;
        if (typeof child === 'string') {
          // Comments pass through without trimming
          if (child.startsWith('<!--')) {
            out += '\n' + childPadding + encodeTextContent(child);
          } else {
            const trimmed = child.trim();
            if (trimmed.length > 0) {
              out += '\n' + childPadding + encodeTextContent(trimmed);
            }
          }
        } else {
          out += '\n';
          prettyWriteNode(child, depth + 1);
        }
      }
      out += '\n' + padding + '</' + tag + '>';
      return;
    }

    // Element-only children (and comments) — indent each child
    out += padding + '<' + tag;
    prettyWriteAttributes(node);
    out += '>';
    for (let i = 0; i < childrenLength; i++) {
      const child = children[i]!;
      if (typeof child === 'string') {
        // Comments get their own indented line
        out += '\n' + indent.repeat(depth + 1) + encodeTextContent(child);
      } else {
        out += '\n';
        prettyWriteNode(child, depth + 1);
      }
    }
    out += '\n' + padding + '</' + tag + '>';
  }

  const nodes = Array.isArray(input) ? input : [input];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (i > 0) out += '\n';
    if (typeof node === 'string') {
      out += encodeTextContent(node);
    } else {
      prettyWriteNode(node, 0);
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Input format detection and conversion
// ---------------------------------------------------------------------------

/**
 * Detect the input format and convert to a `(TNode | string)[]` DOM array
 * suitable for the writer functions.
 *
 * Detection heuristics:
 * 1. A single TNode (has `tagName` string property) → pass through
 * 2. An array whose first non-string element has `tagName` → already DOM
 * 3. An array whose first non-string element has `$text`, `$comment`, `$attr`,
 *    or a single key mapping to an array → lossless format
 * 4. Anything else (including `null`, bare strings, objects without `tagName`) → lossy
 */
function toDom(
  input:
    | TNode
    | (TNode | string)[]
    | LossyValue
    | LossyValue[]
    | LosslessEntry[],
): TNode | (TNode | string)[] {
  /* v8 ignore next — unreachable: write() checks !input before calling toDom() */
  if (input === null || input === undefined) return [];

  // Single TNode — pass through
  if (!Array.isArray(input) && typeof input === 'object' && isTNode(input)) {
    return input as TNode;
  }

  // Non-object, non-array: bare string (lossy top-level string)
  if (!Array.isArray(input) && typeof input !== 'object') {
    return fromLossy(input as LossyValue);
  }

  // Non-array object without tagName → lossy object
  if (!Array.isArray(input)) {
    return fromLossy(input as LossyValue);
  }

  // Array — need to distinguish DOM, lossless, and lossy
  const array = input as unknown[];
  if (array.length === 0) return [];

  // Find the first non-string element to inspect
  let sample: unknown = undefined;
  for (let i = 0; i < array.length; i++) {
    if (typeof array[i] !== 'string') {
      sample = array[i];
      break;
    }
  }

  // All strings → could be DOM (text-only top level) — pass through
  if (sample === undefined) return array as string[];

  // TNode in the array → DOM format
  if (typeof sample === 'object' && sample !== null && isTNode(sample)) {
    return array as (TNode | string)[];
  }

  // Lossless entry: has $text, $comment, $attr, or single key → array value
  if (
    typeof sample === 'object' &&
    sample !== null &&
    isLosslessEntry(sample)
  ) {
    return fromLossless(array as LosslessEntry[]);
  }

  // Everything else → lossy
  return fromLossy(array as LossyValue[]);
}

/** Check if a value looks like a TNode (has tagName string + children array). */
function isTNode(value: unknown): value is TNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as TNode).tagName === 'string' &&
    Array.isArray((value as TNode).children)
  );
}

/** Check if a value looks like a LosslessEntry. */
function isLosslessEntry(value: unknown): value is LosslessEntry {
  if (typeof value !== 'object' || value === null) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  // Known lossless marker keys
  if ('$text' in value || '$comment' in value || '$attr' in value) return true;
  // Single key mapping to an array → element entry
  if (
    keys.length === 1 &&
    Array.isArray((value as Record<string, unknown>)[keys[0]!])
  ) {
    return true;
  }
  return false;
}
