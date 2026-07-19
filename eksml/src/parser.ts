import { decodeXML, decodeHTML } from 'entities';
import { escapeRegExp } from '#src/utilities/escapeRegExp.ts';
import { setOwnProperty } from '#src/utilities/setOwnProperty.ts';
import { filter } from '#src/utilities/filter.ts';
import {
  HTML_VOID_ELEMENTS,
  HTML_RAW_CONTENT_TAGS,
} from '#src/utilities/htmlConstants.ts';
// @generated:char-codes:begin
const LT = 60; // <
const GT = 62; // >
const SLASH = 47; // /
const BANG = 33; // !
const QUESTION = 63; // ?
const EQ = 61; // =
const LBRACKET = 91; // [
const RBRACKET = 93; // ]
const SQUOTE = 39; // '
const DQUOTE = 34; // "
const DASH = 45; // -
const UNDERSCORE = 95; // _
const COLON = 58; // :
// @generated:char-codes:end

/**
 * A parsed XML node
 */
export interface TNode {
  tagName: string;
  /**
   * Element attributes, or `null` if the element has no attributes.
   * Values can be:
   * - string: attribute with a value (e.g., `<div id="test">` -> `{id: "test"}`)
   * - null: attribute without a value (e.g., `<input disabled>` -> `{disabled: null}`)
   * - empty string: attribute with empty value (e.g., `<input value="">` -> `{value: ""}`)
   */
  attributes: Record<string, string | null> | null;
  children: (TNode | string)[];
}

/**
 * TNode with a pos property, returned when setPos option is true
 */
interface TNodeWithPos extends TNode {
  pos: number;
}

/**
 * Options for parsing XML
 */
export interface ParseOptions {
  /** Starting position in the string */
  pos?: number;
  /**
   * Array of tag names that are self-closing (void elements) and don't need closing tags.
   * In XML mode (default), this defaults to `[]` — self-closing is detected only by `/>` syntax.
   * In HTML mode (`html: true`), this defaults to the standard HTML void elements.
   * Can be overridden explicitly regardless of mode.
   */
  selfClosingTags?: string[];
  /**
   * Array of tag names whose content should be treated as raw text, not parsed as XML/HTML.
   * The parser will scan for the matching `</tagName>` close tag and emit everything between
   * as a single text child node.
   *
   * In XML mode (default), this defaults to `[]`.
   * In HTML mode (`html: true`), this defaults to `["script", "style"]`.
   * Can be overridden explicitly regardless of mode.
   */
  rawContentTags?: string[];
  /**
   * Enable HTML parsing mode. When `true`, sets sensible defaults for:
   * - `selfClosingTags`: standard HTML void elements (area, base, br, col, embed, hr, img, input, link, meta, param, source, track, wbr)
   * - `rawContentTags`: elements whose content is raw text (script, style)
   *
   * These defaults can be overridden by explicitly passing `selfClosingTags` or `rawContentTags`.
   */
  html?: boolean;
  /** Keep XML comments in the output */
  keepComments?: boolean;
  /** Trim whitespace from text nodes and discard whitespace-only text nodes */
  trimWhitespace?: boolean;
  /**
   * Strict mode: throw on malformed XML instead of recovering silently.
   * Catches unclosed comments, CDATA sections, processing instructions,
   * close tags, open tags that reach end-of-input without closing, and
   * text content outside of any tag (e.g. before or after the root element).
   */
  strict?: boolean;
  /**
   * Decode XML/HTML entities in text content and attribute values.
   * When enabled, named entities (`&amp;`, `&lt;`, etc.), decimal character
   * references (`&#228;`), and hex character references (`&#xe4;`) are decoded.
   *
   * In HTML mode (`html: true`), the full set of HTML named entities is
   * supported (e.g. `&nbsp;`, `&copy;`, `&mdash;`). In XML mode, only the
   * five standard XML entities plus numeric references are decoded.
   *
   * CDATA sections are never decoded regardless of this setting.
   *
   * Defaults to `false` — entities are preserved as-is in the output.
   */
  entities?: boolean;
  /** Attribute name to search for (used with attrValue) */
  attrName?: string;
  /** Attribute value to search for (regex pattern) */
  attrValue?: string;
  /** Filter function to apply to nodes */
  filter?: (node: TNode, index: number, depth: number, path: string) => boolean;
}

/** Internal options extending ParseOptions — not part of the public API. */
interface InternalParseOptions extends ParseOptions {
  /** If true, the returned object will have a pos property indicating where parsing stopped */
  setPos?: boolean;
  /** Parse a single node instead of a list of nodes */
  parseNode?: boolean;
}

// Pre-computed lookup table: 1 for characters that terminate a name token.
// All name-ending chars are <= 62, so the scan first checks charCode > 62
// (letters and non-ASCII) and only consults the table for low codes.
// Name-ending chars: \t(9) \n(10) \r(13) space(32) /(47) =(61) >(62)
const NAME_END = new Uint8Array(64);
NAME_END[9] = 1; // \t
NAME_END[10] = 1; // \n
NAME_END[13] = 1; // \r
NAME_END[32] = 1; // space
NAME_END[47] = 1; // /
NAME_END[61] = 1; // =
NAME_END[62] = 1; // >

// Child-kind flags, tracked incrementally as children are pushed so that
// "strip ignorable whitespace" needs no re-scan of the children array:
// 1 = has element child, 2 = has whitespace-only text, 4 = has non-ws text.
// Strip condition (element container with only ignorable whitespace) is
// (flags & 7) === 3.
// Bit 8 marks ws-only strings that were actually pushed into the array
// (CDATA, decoded text, promoted PI children) as opposed to deferred
// ws-only text runs, which are kept as index pairs and only materialized
// into substrings if the container turns out to keep them.
const HAS_ELEMENT = 1;
const HAS_WS_TEXT = 2;
const HAS_TEXT = 4;
const HAS_WS_IN_ARRAY = 8;
const KIND_MASK = HAS_ELEMENT | HAS_WS_TEXT | HAS_TEXT;
const STRIP_STATE = HAS_ELEMENT | HAS_WS_TEXT;

/** Same as trim()-whitespace test but over an arbitrary string (decoded text, promoted children). */
function isWsString(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 32 || (c >= 9 && c <= 13)) continue;
    if (c < 128) return false;
    return text.trim().length === 0;
  }
  return true;
}

/**
 * Remove all string children. Only called when (flags & 7) === 3 (element
 * container whose every string child is whitespace-only), so removing
 * all strings is exactly "strip ignorable whitespace". Mixed-content
 * elements are never compacted.
 * Mutates the array in-place for performance.
 */
function compactWhitespace(children: (TNode | string)[]): void {
  let writeIndex = 0;
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (typeof child === 'string') continue;
    children[writeIndex++] = child;
  }
  children.length = writeIndex;
}

// Module-level scratch buffers for the tree-building stack and deferred
// whitespace runs. parse() is synchronous and never re-entered (no user
// callbacks run mid-parse), so reusing these across calls is safe and
// saves ~9 array allocations per parse call. Object slots are cleared on
// parseChildren exit so no parsed tree is retained between calls.
const frameTagNames: string[] = [];
const frameAttributes: (Record<string, string | null> | null)[] = [];
const frameChildren: (TNode | string)[][] = [];
const frameFlags: number[] = [];
const frameNameStarts: number[] = [];
const framePendingBases: number[] = [];
const pendStart: number[] = [];
const pendEnd: number[] = [];
const pendAt: number[] = [];

const EMPTY_CHILDREN: (TNode | string)[] = [];

/** Clear object references held by the scratch stack (keeps capacity). */
function clearScratch(): void {
  for (let i = 0; i < frameChildren.length; i++) {
    frameTagNames[i] = '';
    frameAttributes[i] = null;
    frameChildren[i] = EMPTY_CHILDREN;
  }
}

let pendingCount = 0;

/**
 * Insert the deferred ws-only substrings [base..pendingCount) into
 * `children` at their recorded positions (nondecreasing), allocating the
 * substrings only now. Single backward in-place merge pass.
 */
function materializePending(
  source: string,
  children: (TNode | string)[],
  base: number,
): void {
  const insertCount = pendingCount - base;
  const oldLength = children.length;
  children.length = oldLength + insertCount;
  let read = oldLength - 1;
  let write = oldLength + insertCount - 1;
  for (let p = pendingCount - 1; p >= base; p--) {
    const at = pendAt[p]!;
    while (read >= at) children[write--] = children[read--]!;
    children[write--] = source.substring(pendStart[p]!, pendEnd[p]!);
  }
  pendingCount = base;
}

/** Build an error with line/column info (module-level, closure-free). */
function positionedError(
  source: string,
  message: string,
  atPos: number,
): Error {
  const before = source.substring(0, atPos);
  const lines = before.split('\n');
  const line = lines.length;
  const column = lines[lines.length - 1]!.length + 1;
  return new Error(`${message} at line ${line}, column ${column}`);
}

/**
 * True when source[start..end) is whitespace-only per String#trim
 * semantics (module-level variant of the parse-scope isWsRange).
 */
function isWsRangeIn(source: string, start: number, end: number): boolean {
  for (let i = start; i < end; i++) {
    const c = source.charCodeAt(i);
    if (c === 32 || (c >= 9 && c <= 13)) continue;
    if (c < 128) return false;
    return source.substring(start, end).trim().length === 0;
  }
  return true;
}

/**
 * Specialized root parser for the default option configuration:
 * strict=false, keepComments=false, trimWhitespace=false, decode=null,
 * selfClosingSet=null, rawContentSet=null. Logic mirrors parseChildren
 * with every option check constant-folded away. Module-level with a local
 * `pos`, so a default-options parse() call allocates no closures and the
 * hot loop reads locals instead of context slots.
 */
function parseRootFast(src: string): (TNode | string)[] {
  const srcEnd = src.length;
  let pos = 0;
  let depth = 0;
  let currentTagName = '';
  // Offset in src where the current open tag's name begins, so close tags
  // are verified by comparing two flat-source ranges (no allocation).
  let currentNameStart = 0;
  let children: (TNode | string)[] = [];
  let flags = 0;
  pendingCount = 0;
  let pendingBase = 0;

  while (pos < srcEnd) {
    if (src.charCodeAt(pos) === LT) {
      const nextCharCode = src.charCodeAt(pos + 1);
      if (nextCharCode === SLASH) {
        // ---- Close tag ----
        const closeStart = pos + 2;

        // Fast path: exact `</name>` — check '>' right after the name,
        // then compare the name range against the open tag's name range.
        const nameLen = currentTagName.length;
        let matched = false;
        if (src.charCodeAt(closeStart + nameLen) === GT) {
          let k = 0;
          while (
            k < nameLen &&
            src.charCodeAt(closeStart + k) ===
              src.charCodeAt(currentNameStart + k)
          )
            k++;
          if (k === nameLen) {
            pos = closeStart + nameLen; // at the '>'
            matched = true;
          }
        }

        if (!matched) {
          // Slow path: trailing whitespace, genuine mismatch, or EOF.
          pos = src.indexOf('>', pos);

          if (pos === -1) {
            pos = srcEnd;
            if ((flags & KIND_MASK) === STRIP_STATE) {
              pendingCount = pendingBase;
              if (flags & HAS_WS_IN_ARRAY) compactWhitespace(children);
            } else if (pendingCount > pendingBase) {
              materializePending(src, children, pendingBase);
            }
            // Unwind: if we are inside a stacked frame, pop back
            while (depth > 0) {
              depth--;
              const node: TNode = {
                tagName: currentTagName,
                attributes: frameAttributes[depth]!,
                children,
              };
              currentTagName = frameTagNames[depth]!;
              children = frameChildren[depth]!;
              flags = frameFlags[depth]! | HAS_ELEMENT;
              pendingBase = framePendingBases[depth]!;
              children[children.length] = node;
              if ((flags & KIND_MASK) === STRIP_STATE) {
                pendingCount = pendingBase;
                if (flags & HAS_WS_IN_ARRAY) compactWhitespace(children);
              } else if (pendingCount > pendingBase) {
                materializePending(src, children, pendingBase);
              }
            }
            return children;
          }

          const closeTag = src.substring(closeStart, pos).trimEnd();
          if (closeTag !== currentTagName) {
            throw positionedError(
              src,
              `Unexpected close tag </${closeTag}> (expected </${currentTagName}>)`,
              pos,
            );
          }
        }

        pos += 1;

        // Finalize this children array: drop deferred ignorable ws (never
        // allocated) when this is a pure element container, otherwise
        // materialize the deferred runs into real substrings.
        if ((flags & KIND_MASK) === STRIP_STATE) {
          pendingCount = pendingBase;
          if (flags & HAS_WS_IN_ARRAY) compactWhitespace(children);
        } else if (pendingCount > pendingBase) {
          materializePending(src, children, pendingBase);
        }

        if (depth === 0) {
          // We've closed the root tag — return
          return children;
        }

        // Pop frame: finalize node and add to parent's children
        depth--;
        const node: TNode = {
          tagName: currentTagName,
          attributes: frameAttributes[depth]!,
          children,
        };
        currentTagName = frameTagNames[depth]!;
        currentNameStart = frameNameStarts[depth]!;
        children = frameChildren[depth]!;
        flags = frameFlags[depth]! | HAS_ELEMENT;
        pendingBase = framePendingBases[depth]!;
        children[children.length] = node;
        // Handle processing instruction children promotion
        if (node.tagName.charCodeAt(0) === QUESTION) {
          const promoted = node.children;
          for (let i = 0; i < promoted.length; i++) {
            const promotedChild = promoted[i]!;
            if (typeof promotedChild === 'string') {
              if ((flags & HAS_TEXT) === 0) {
                if (isWsString(promotedChild)) {
                  flags |= HAS_WS_TEXT | HAS_WS_IN_ARRAY;
                } else {
                  if (pendingCount > pendingBase)
                    materializePending(src, children, pendingBase);
                  flags |= HAS_TEXT;
                }
              }
              children.push(promotedChild);
            } else {
              flags |= HAS_ELEMENT;
              children.push(promotedChild);
            }
          }
          node.children = [];
        }
        continue;
      } else if (nextCharCode === BANG) {
        if (src.charCodeAt(pos + 2) === DASH) {
          // comment: skipped entirely (keepComments is off on this path)
          pos = src.indexOf('-->', pos + 3);
          pos = pos === -1 ? srcEnd : pos + 2; // point to the '>'
        } else if (
          src.charCodeAt(pos + 2) === LBRACKET &&
          src.charCodeAt(pos + 8) === LBRACKET &&
          src.substring(pos + 3, pos + 8).toLowerCase() === 'cdata'
        ) {
          const cdataEndIndex = src.indexOf(']]>', pos);
          const cdataEnd = cdataEndIndex === -1 ? srcEnd : cdataEndIndex;
          if ((flags & HAS_TEXT) === 0) {
            if (isWsRangeIn(src, pos + 9, cdataEnd)) {
              flags |= HAS_WS_TEXT | HAS_WS_IN_ARRAY;
            } else {
              if (pendingCount > pendingBase)
                materializePending(src, children, pendingBase);
              flags |= HAS_TEXT;
            }
          }
          children.push(src.substring(pos + 9, cdataEnd));
          pos = cdataEndIndex === -1 ? srcEnd : cdataEndIndex + 3;
          continue;
        } else {
          // doctype / other <!...> declarations: parse as TNode
          pos += 2; // skip '<!'
          const keywordStart = pos - 1; // include the '!'
          while (pos < srcEnd) {
            const cc = src.charCodeAt(pos);
            if (cc <= 32 || cc === GT || cc === LBRACKET) break;
            pos++;
          }
          const declTagName = src.substring(keywordStart, pos);

          // Parse space-separated tokens as null-valued attributes
          let declAttributes: Record<string, string | null> | null = null;
          while (pos < srcEnd) {
            const cc = src.charCodeAt(pos);
            if (cc === GT || cc === LBRACKET) break;
            if (cc <= 32) {
              pos++;
              continue;
            }
            // Quoted token — capture including quotes as the key
            if (cc === SQUOTE || cc === DQUOTE) {
              const closePos = src.indexOf(cc === SQUOTE ? "'" : '"', pos + 1);
              if (closePos === -1) {
                pos = srcEnd;
                break;
              }
              const token = src.substring(pos + 1, closePos);
              if (declAttributes === null) declAttributes = {};
              setOwnProperty(declAttributes!, token, null);
              pos = closePos + 1;
              continue;
            }
            // Unquoted token
            const tokenStart = pos;
            while (pos < srcEnd) {
              const tc = src.charCodeAt(pos);
              if (tc <= 32 || tc === GT || tc === LBRACKET) break;
              pos++;
            }
            const token = src.substring(tokenStart, pos);
            if (declAttributes === null) declAttributes = {};
            setOwnProperty(declAttributes!, token, null);
          }

          // Skip internal DTD subset ([...]) if present
          if (pos < srcEnd && src.charCodeAt(pos) === LBRACKET) {
            pos++; // skip '['
            let insideBracketSection = true;
            while (insideBracketSection && pos < srcEnd) {
              if (src.charCodeAt(pos) === RBRACKET) {
                insideBracketSection = false;
              } else {
                const quoteCharCode = src.charCodeAt(pos);
                if (quoteCharCode === SQUOTE || quoteCharCode === DQUOTE) {
                  pos = src.indexOf(
                    quoteCharCode === SQUOTE ? "'" : '"',
                    pos + 1,
                  );
                  if (pos === -1) {
                    pos = srcEnd;
                    break;
                  }
                }
              }
              pos++;
            }
            while (pos < srcEnd && src.charCodeAt(pos) <= 32) pos++;
          }

          children.push({
            tagName: declTagName,
            attributes: declAttributes,
            children: [],
          } as TNode);
          flags |= HAS_ELEMENT;
        }
        pos++;
        continue;
      }
      // ---- Open tag ----
      pos++;
      const tagFirstCharCode = nextCharCode;
      const tagNameStart = pos;
      // Inline name scan (see parseName for the charCode > 62 trick)
      let tagCode = src.charCodeAt(pos);
      while (tagCode > 62 || NAME_END[tagCode] === 0) {
        tagCode = src.charCodeAt(++pos);
      }
      const tagName = src.substring(tagNameStart, pos);
      let attributes: Record<string, string | null> | null = null;

      // parsing attributes — attrCode mirrors src.charCodeAt(pos); the
      // NaN self-check replaces the bounds test (charCodeAt is NaN only
      // past end of string). Ported from expA.
      let attrCode = tagCode;
      while (attrCode !== GT && attrCode === attrCode) {
        if (
          (attrCode > 96 && attrCode < 123) ||
          (attrCode > 64 && attrCode < 91) ||
          attrCode === UNDERSCORE ||
          attrCode === COLON ||
          attrCode > 127
        ) {
          // Inline attribute-name scan
          const nameStart = pos;
          let code = attrCode;
          while (code > 62 || NAME_END[code] === 0) {
            code = src.charCodeAt(++pos);
          }
          const name = src.substring(nameStart, pos);
          // Fast path (from expA): `="value"` / `='value'` directly after
          // the name — one indexOf for the closing quote + one substring.
          if (code === EQ) {
            const quote = src.charCodeAt(pos + 1);
            if (quote === DQUOTE || quote === SQUOTE) {
              const valueStart = pos + 2;
              pos = src.indexOf(quote === DQUOTE ? '"' : "'", valueStart);
              if (pos === -1) {
                // Unterminated attribute string — emit node with what we
                // have; materialize deferred ws at every level (no
                // stripping happens on this path).
                if (pendingCount > pendingBase)
                  materializePending(src, children, pendingBase);
                const node: TNode = { tagName, attributes, children: [] };
                children[children.length] = node;
                while (depth > 0) {
                  depth--;
                  const parent: TNode = {
                    tagName: currentTagName,
                    attributes: frameAttributes[depth]!,
                    children,
                  };
                  currentTagName = frameTagNames[depth]!;
                  children = frameChildren[depth]!;
                  pendingBase = framePendingBases[depth]!;
                  if (pendingCount > pendingBase)
                    materializePending(src, children, pendingBase);
                  children.push(parent);
                }
                return children;
              }
              const value = src.substring(valueStart, pos);
              if (attributes === null) attributes = {};
              setOwnProperty(attributes!, name, value);
              pos++;
              attrCode = src.charCodeAt(pos);
              continue;
            }
          }
          while (
            code &&
            code !== SQUOTE &&
            code !== DQUOTE &&
            !(
              (code > 64 && code < 91) ||
              (code > 96 && code < 123) ||
              code === UNDERSCORE ||
              code === COLON ||
              code > 127
            ) &&
            code !== GT
          ) {
            pos++;
            code = src.charCodeAt(pos);
          }
          let value: string | null;
          if (code === SQUOTE || code === DQUOTE) {
            // Inline parseString
            const stringStart = pos + 1;
            pos = src.indexOf(code === SQUOTE ? "'" : '"', stringStart);
            if (pos === -1) {
              // Unterminated attribute string — emit node with what we
              // have. No whitespace stripping happens on this path, so
              // deferred ws runs are materialized at every level.
              if (pendingCount > pendingBase)
                materializePending(src, children, pendingBase);
              const node: TNode = { tagName, attributes, children: [] };
              children[children.length] = node;
              // Unwind remaining stack frames
              while (depth > 0) {
                depth--;
                const parent: TNode = {
                  tagName: currentTagName,
                  attributes: frameAttributes[depth]!,
                  children,
                };
                currentTagName = frameTagNames[depth]!;
                children = frameChildren[depth]!;
                pendingBase = framePendingBases[depth]!;
                if (pendingCount > pendingBase)
                  materializePending(src, children, pendingBase);
                children.push(parent);
              }
              return children;
            }
            value = src.substring(stringStart, pos);
          } else {
            value = null;
            pos--;
          }
          if (attributes === null) attributes = {};
          setOwnProperty(attributes!, name, value);
        }
        pos++;
        attrCode = src.charCodeAt(pos);
      }

      // Determine if this node has children or is self-closing
      if (
        src.charCodeAt(pos - 1) !== SLASH &&
        src.charCodeAt(pos - 1) !== QUESTION &&
        tagFirstCharCode !== BANG
      ) {
        // Node has children — push frame and descend (no raw-content or
        // self-closing tag lists on this path)
        pos++;
        frameTagNames[depth] = currentTagName;
        frameAttributes[depth] = attributes;
        frameChildren[depth] = children;
        frameFlags[depth] = flags;
        frameNameStarts[depth] = currentNameStart;
        framePendingBases[depth] = pendingBase;
        depth++;
        currentTagName = tagName;
        currentNameStart = tagNameStart;
        children = [];
        flags = 0;
        pendingBase = pendingCount;
      } else {
        // Explicit self-closing (/>) or processing instruction (?>) or declaration
        pos++;
        const node: TNode = { tagName, attributes, children: [] };
        children[children.length] = node;
        flags |= HAS_ELEMENT;
        // PI promotion is a no-op here: node.children is always empty
      }
    } else {
      // ---- Text: fused scan + classification ----
      const textStart = pos;
      let textEnd: number;
      let wsOnly = true;
      let needExact = false;
      let j = pos;
      for (;;) {
        if (j >= srcEnd) {
          textEnd = srcEnd;
          pos = srcEnd + 1; // matches original post-increment past EOF
          break;
        }
        const c = src.charCodeAt(j);
        if (c === LT) {
          textEnd = j;
          pos = j;
          break;
        }
        if (c === 32 || (c >= 9 && c <= 13)) {
          j++;
          continue;
        }
        // Non-ws (or possibly Unicode ws if >= 128): classification
        // settled (or needs the exact fallback); finish with indexOf
        if (c >= 128) needExact = true;
        wsOnly = false;
        const idx = src.indexOf('<', j + 1);
        if (idx === -1) {
          textEnd = srcEnd;
          pos = srcEnd + 1;
        } else {
          textEnd = idx;
          pos = idx;
        }
        break;
      }
      if (needExact) {
        wsOnly = src.substring(textStart, textEnd).trim().length === 0;
      }
      if ((flags & HAS_TEXT) !== 0) {
        // Mixed content already established — push directly
        children[children.length] = src.substring(textStart, textEnd);
      } else if (wsOnly) {
        // Defer: record the range, allocate only if the container
        // turns out to keep its whitespace
        pendStart[pendingCount] = textStart;
        pendEnd[pendingCount] = textEnd;
        pendAt[pendingCount] = children.length;
        pendingCount++;
        flags |= HAS_WS_TEXT;
      } else {
        if (pendingCount > pendingBase)
          materializePending(src, children, pendingBase);
        children[children.length] = src.substring(textStart, textEnd);
        flags |= HAS_TEXT;
      }
    }
  }
  if ((flags & KIND_MASK) === STRIP_STATE) {
    pendingCount = pendingBase;
    if (flags & HAS_WS_IN_ARRAY) compactWhitespace(children);
  } else if (pendingCount > pendingBase) {
    materializePending(src, children, pendingBase);
  }
  // Unwind any remaining stack frames (unclosed tags in non-strict mode)
  while (depth > 0) {
    depth--;
    const node: TNode = {
      tagName: currentTagName,
      attributes: frameAttributes[depth]!,
      children,
    };
    currentTagName = frameTagNames[depth]!;
    children = frameChildren[depth]!;
    flags = frameFlags[depth]! | HAS_ELEMENT;
    pendingBase = framePendingBases[depth]!;
    children[children.length] = node;
    if ((flags & KIND_MASK) === STRIP_STATE) {
      pendingCount = pendingBase;
      if (flags & HAS_WS_IN_ARRAY) compactWhitespace(children);
    } else if (pendingCount > pendingBase) {
      materializePending(src, children, pendingBase);
    }
  }
  return children;
}

/**
 * Parse XML/HTML into a DOM Object with minimal validation and fault tolerance
 * @param S - The XML string to parse
 * @param options - Parsing options
 * @returns Array of parsed nodes and text content
 */
export function parse(
  S: string,
  options?: ParseOptions | InternalParseOptions,
): (TNode | string)[] {
  if (options === undefined) {
    // Thin dispatch: the default-options case runs the specialized
    // module-level parser — no per-call closures, no option resolution.
    try {
      return parseRootFast(S);
    } finally {
      // Drop tree/tagName references held by the module-level scratch
      // stack so no parsed data outlives this call.
      clearScratch();
    }
  }

  const resolvedOptions = (options || {}) as InternalParseOptions;

  let pos = resolvedOptions.pos || 0;
  let srcLength = S.length;
  const keepComments = !!resolvedOptions.keepComments;
  const trimWhitespace = !!resolvedOptions.trimWhitespace;
  const strict = !!resolvedOptions.strict;
  const htmlMode = !!resolvedOptions.html;
  const decode =
    resolvedOptions.entities === true
      ? htmlMode
        ? decodeHTML
        : decodeXML
      : null;

  const selfClosingTagList: string[] =
    resolvedOptions.selfClosingTags ?? (htmlMode ? HTML_VOID_ELEMENTS : []);
  const rawContentTagList: string[] =
    resolvedOptions.rawContentTags ?? (htmlMode ? HTML_RAW_CONTENT_TAGS : []);

  // Convert to Sets for O(1) lookup when non-empty
  const selfClosingSet: Set<string> | null =
    selfClosingTagList.length > 0 ? new Set(selfClosingTagList) : null;
  const rawContentSet: Set<string> | null =
    rawContentTagList.length > 0 ? new Set(rawContentTagList) : null;

  /** Build an error with line/column info for strict mode. */
  function strictError(message: string, atPos?: number): Error {
    const p = atPos !== undefined ? atPos : pos;
    const before = S.substring(0, p);
    const lines = before.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1]!.length + 1;
    return new Error(`${message} at line ${line}, column ${column}`);
  }

  /**
   * True when S[start..end) is whitespace-only per String#trim semantics.
   * ASCII fast path with charCodeAt on the flat source string; falls back
   * to trim() only when a non-ASCII char is seen before any ASCII non-ws
   * (Unicode whitespace like \u00a0 / \u3000 is trimmed by trim()).
   */
  function isWsRange(start: number, end: number): boolean {
    for (let i = start; i < end; i++) {
      const c = S.charCodeAt(i);
      if (c === 32 || (c >= 9 && c <= 13)) continue;
      if (c < 128) return false;
      return S.substring(start, end).trim().length === 0;
    }
    return true;
  }

  function parseChildren(
    rootTagName: string,
    rootNameStart: number,
  ): (TNode | string)[] {
    // Iterative tree-building using an explicit stack to avoid
    // stack overflow on deeply nested XML (the old recursive
    // parseNode → parseChildren → parseNode chain blew up at ~2000 levels).
    // The stack is kept as module-level parallel arrays instead of
    // per-frame objects to avoid heap allocations per element with
    // children (see scratch buffer comment at module scope).
    let depth = 0;
    let currentTagName = rootTagName;
    // Offset in S where the current open tag's name begins, so close tags
    // can be verified by comparing two flat-S ranges (no string reads on
    // possibly-sliced tagName strings, no allocation).
    let currentNameStart = rootNameStart;
    let children: (TNode | string)[] = [];
    let flags = 0;
    pendingCount = 0;
    let pendingBase = 0;
    // Local aliases: register reads in the hot loop instead of context-slot
    // loads (same technique as the SAX engine's processChunk).
    const src = S;
    const srcEnd = srcLength;

    while (pos < srcEnd) {
      if (src.charCodeAt(pos) === LT) {
        const nextCharCode = src.charCodeAt(pos + 1);
        if (nextCharCode === SLASH) {
          // ---- Close tag ----
          const closeStart = pos + 2;

          // Fast path: exact `</name>` — check '>' right after the name,
          // then compare the name range against the open tag's name range
          // (both reads on the flat source string; no allocation, and no
          // indexOf scan). False GT positives (e.g. `</nam>>` vs "name")
          // fail the char compare and fall through to the slow path.
          const nameLen = currentTagName.length;
          let matched = false;
          if (src.charCodeAt(closeStart + nameLen) === GT) {
            let k = 0;
            while (
              k < nameLen &&
              src.charCodeAt(closeStart + k) ===
                src.charCodeAt(currentNameStart + k)
            )
              k++;
            if (k === nameLen) {
              pos = closeStart + nameLen; // at the '>'
              matched = true;
            }
          }

          if (!matched) {
            // Slow path: trailing whitespace in the close tag, a genuine
            // mismatch (exact error preserved), or EOF without '>'.
            pos = src.indexOf('>', pos);

            if (pos === -1) {
              if (strict)
                throw strictError('Unclosed close tag', closeStart - 2);
              pos = src.length;
              if ((flags & KIND_MASK) === STRIP_STATE) {
                pendingCount = pendingBase;
                if (flags & HAS_WS_IN_ARRAY) compactWhitespace(children);
              } else if (pendingCount > pendingBase) {
                materializePending(S, children, pendingBase);
              }
              // Unwind: if we are inside a stacked frame, pop back
              while (depth > 0) {
                depth--;
                const node: TNode = {
                  tagName: currentTagName,
                  attributes: frameAttributes[depth]!,
                  children,
                };
                // Restore from stack
                currentTagName = frameTagNames[depth]!;
                children = frameChildren[depth]!;
                flags = frameFlags[depth]! | HAS_ELEMENT;
                pendingBase = framePendingBases[depth]!;
                children[children.length] = node;
                if ((flags & KIND_MASK) === STRIP_STATE) {
                  pendingCount = pendingBase;
                  if (flags & HAS_WS_IN_ARRAY) compactWhitespace(children);
                } else if (pendingCount > pendingBase) {
                  materializePending(S, children, pendingBase);
                }
              }
              return children;
            }

            const closeTag = src.substring(closeStart, pos).trimEnd();
            if (closeTag !== currentTagName) {
              throw strictError(
                `Unexpected close tag </${closeTag}> (expected </${currentTagName}>)`,
              );
            }
          }

          pos += 1;

          // Finalize this children array: drop deferred ignorable ws (never
          // allocated) when this is a pure element container, otherwise
          // materialize the deferred runs into real substrings.
          if ((flags & KIND_MASK) === STRIP_STATE) {
            pendingCount = pendingBase;
            if (flags & HAS_WS_IN_ARRAY) compactWhitespace(children);
          } else if (pendingCount > pendingBase) {
            materializePending(S, children, pendingBase);
          }

          if (depth === 0) {
            // We've closed the root tag — return
            return children;
          }

          // Pop frame: finalize node and add to parent's children
          depth--;
          const node: TNode = {
            tagName: currentTagName,
            attributes: frameAttributes[depth]!,
            children,
          };
          currentTagName = frameTagNames[depth]!;
          currentNameStart = frameNameStarts[depth]!;
          children = frameChildren[depth]!;
          flags = frameFlags[depth]! | HAS_ELEMENT;
          pendingBase = framePendingBases[depth]!;
          children[children.length] = node;
          // Handle processing instruction children promotion
          if (node.tagName.charCodeAt(0) === QUESTION) {
            const promoted = node.children;
            for (let i = 0; i < promoted.length; i++) {
              const promotedChild = promoted[i]!;
              if (typeof promotedChild === 'string') {
                if ((flags & HAS_TEXT) === 0) {
                  if (isWsString(promotedChild)) {
                    flags |= HAS_WS_TEXT | HAS_WS_IN_ARRAY;
                  } else {
                    if (pendingCount > pendingBase)
                      materializePending(S, children, pendingBase);
                    flags |= HAS_TEXT;
                  }
                }
                children.push(promotedChild);
              } else {
                flags |= HAS_ELEMENT;
                children.push(promotedChild);
              }
            }
            node.children = [];
          }
          continue;
        } else if (nextCharCode === BANG) {
          if (src.charCodeAt(pos + 2) === DASH) {
            // comment: use indexOf("-->") for fast scanning
            const startCommentPos = pos;
            pos = src.indexOf('-->', pos + 3);
            if (pos === -1) {
              if (strict)
                throw strictError('Unclosed comment', startCommentPos);
              pos = src.length;
              if (keepComments) {
                // Comment strings start with '<' — always non-whitespace text
                if (pendingCount > pendingBase)
                  materializePending(S, children, pendingBase);
                children.push(src.substring(startCommentPos));
                flags |= HAS_TEXT;
              }
            } else {
              pos += 2; // point to the '>'
              if (keepComments) {
                if (pendingCount > pendingBase)
                  materializePending(S, children, pendingBase);
                children.push(src.substring(startCommentPos, pos + 1));
                flags |= HAS_TEXT;
              }
            }
          } else if (
            src.charCodeAt(pos + 2) === LBRACKET &&
            src.charCodeAt(pos + 8) === LBRACKET &&
            src.substring(pos + 3, pos + 8).toLowerCase() === 'cdata'
          ) {
            const cdataEndIndex = src.indexOf(']]>', pos);
            const cdataEnd = cdataEndIndex === -1 ? srcEnd : cdataEndIndex;
            if (cdataEndIndex === -1 && strict)
              throw strictError('Unclosed CDATA section');
            if ((flags & HAS_TEXT) === 0) {
              if (isWsRange(pos + 9, cdataEnd)) {
                flags |= HAS_WS_TEXT | HAS_WS_IN_ARRAY;
              } else {
                if (pendingCount > pendingBase)
                  materializePending(S, children, pendingBase);
                flags |= HAS_TEXT;
              }
            }
            children.push(src.substring(pos + 9, cdataEnd));
            pos = cdataEndIndex === -1 ? src.length : cdataEndIndex + 3;
            continue;
          } else {
            // doctype / other <!...> declarations: parse as TNode
            // Read the declaration keyword (e.g. "!DOCTYPE")
            pos += 2; // skip '<!'
            const keywordStart = pos - 1; // include the '!'
            while (pos < src.length) {
              const cc = src.charCodeAt(pos);
              if (cc <= 32 || cc === GT || cc === LBRACKET) break;
              pos++;
            }
            const declTagName = src.substring(keywordStart, pos);

            // Parse space-separated tokens as null-valued attributes
            let declAttributes: Record<string, string | null> | null = null;
            while (pos < src.length) {
              const cc = src.charCodeAt(pos);
              if (cc === GT || cc === LBRACKET) break;
              // Skip whitespace
              if (cc <= 32) {
                pos++;
                continue;
              }
              // Quoted token — capture including quotes as the key
              if (cc === SQUOTE || cc === DQUOTE) {
                const closePos = src.indexOf(
                  cc === SQUOTE ? "'" : '"',
                  pos + 1,
                );
                if (closePos === -1) {
                  if (strict) throw strictError('Unclosed declaration');
                  pos = src.length;
                  break;
                }
                const token = src.substring(pos + 1, closePos);
                if (declAttributes === null) declAttributes = {};
                setOwnProperty(declAttributes!, token, null);
                pos = closePos + 1;
                continue;
              }
              // Unquoted token
              const tokenStart = pos;
              while (pos < src.length) {
                const tc = src.charCodeAt(pos);
                if (tc <= 32 || tc === GT || tc === LBRACKET) break;
                pos++;
              }
              const token = src.substring(tokenStart, pos);
              if (declAttributes === null) declAttributes = {};
              setOwnProperty(declAttributes!, token, null);
            }

            // Skip internal DTD subset ([...]) if present
            if (pos < src.length && src.charCodeAt(pos) === LBRACKET) {
              pos++; // skip '['
              let insideBracketSection = true;
              while (insideBracketSection && pos < src.length) {
                if (src.charCodeAt(pos) === RBRACKET) {
                  insideBracketSection = false;
                } else {
                  // Skip quoted strings inside internal DTD subset
                  const quoteCharCode = src.charCodeAt(pos);
                  if (quoteCharCode === SQUOTE || quoteCharCode === DQUOTE) {
                    pos = src.indexOf(
                      quoteCharCode === SQUOTE ? "'" : '"',
                      pos + 1,
                    );
                    if (pos === -1) {
                      pos = src.length;
                      break;
                    }
                  }
                }
                pos++;
              }
              // Skip any whitespace between ] and >
              while (pos < src.length && src.charCodeAt(pos) <= 32) pos++;
            }

            if (strict && (pos >= src.length || src.charCodeAt(pos) !== GT))
              throw strictError('Unclosed declaration');

            children.push({
              tagName: declTagName,
              attributes: declAttributes,
              children: [],
            } as TNode);
            flags |= HAS_ELEMENT;
          }
          pos++;
          continue;
        }
        // ---- Open tag (inline parseNode logic) ----
        pos++;
        // First char of the name read from the flat source string (the
        // extracted tagName may be a SlicedString with slower charCodeAt)
        const tagFirstCharCode = nextCharCode;
        const tagNameStart = pos;
        const tagName = parseName();
        let attributes: Record<string, string | null> | null = null;

        // parsing attributes
        while (pos < srcEnd && src.charCodeAt(pos) !== GT) {
          let charCode = src.charCodeAt(pos);
          if (
            (charCode > 64 && charCode < 91) ||
            (charCode > 96 && charCode < 123) ||
            charCode === UNDERSCORE ||
            charCode === COLON ||
            charCode > 127
          ) {
            const name = parseName();
            let code = src.charCodeAt(pos);
            while (
              code &&
              code !== SQUOTE &&
              code !== DQUOTE &&
              !(
                (code > 64 && code < 91) ||
                (code > 96 && code < 123) ||
                code === UNDERSCORE ||
                code === COLON ||
                code > 127
              ) &&
              code !== GT
            ) {
              pos++;
              code = src.charCodeAt(pos);
            }
            let value: string | null;
            if (code === SQUOTE || code === DQUOTE) {
              value = parseString();
              if (pos === -1) {
                // Unterminated attribute string — emit node with what we
                // have. No whitespace stripping happens on this path, so
                // deferred ws runs are materialized at every level.
                if (pendingCount > pendingBase)
                  materializePending(S, children, pendingBase);
                const node: TNode = { tagName, attributes, children: [] };
                children[children.length] = node;
                // Unwind remaining stack frames
                while (depth > 0) {
                  depth--;
                  const parent: TNode = {
                    tagName: currentTagName,
                    attributes: frameAttributes[depth]!,
                    children,
                  };
                  currentTagName = frameTagNames[depth]!;
                  children = frameChildren[depth]!;
                  pendingBase = framePendingBases[depth]!;
                  if (pendingCount > pendingBase)
                    materializePending(S, children, pendingBase);
                  children.push(parent);
                }
                return children;
              }
              // decode of a string without '&' is identity, skip the call
              if (decode !== null && value.indexOf('&') !== -1)
                value = decode(value);
            } else {
              value = null;
              pos--;
            }
            if (attributes === null) attributes = {};
            setOwnProperty(attributes!, name, value);
          }
          pos++;
        }
        if (strict && pos >= srcEnd) {
          throw strictError(`Unclosed tag <${tagName}>`);
        }

        // Determine if this node has children or is self-closing
        if (
          src.charCodeAt(pos - 1) !== SLASH &&
          src.charCodeAt(pos - 1) !== QUESTION &&
          tagFirstCharCode !== BANG
        ) {
          if (rawContentSet !== null && rawContentSet.has(tagName)) {
            // Raw content tag
            const closeTagStr = '</' + tagName + '>';
            const start = pos + 1;
            pos = src.indexOf(closeTagStr, start);
            let rawChildren: (TNode | string)[];
            if (pos === -1) {
              if (strict) throw strictError(`Unclosed tag <${tagName}>`);
              rawChildren = [src.substring(start)];
              pos = src.length;
            } else {
              rawChildren = [src.substring(start, pos)];
              pos += closeTagStr.length;
            }
            const node: TNode = { tagName, attributes, children: rawChildren };
            children[children.length] = node;
            flags |= HAS_ELEMENT;
            if (tagFirstCharCode === QUESTION) {
              const promoted = node.children;
              for (let i = 0; i < promoted.length; i++) {
                const promotedChild = promoted[i]!;
                if (typeof promotedChild === 'string') {
                  if ((flags & HAS_TEXT) === 0) {
                    if (isWsString(promotedChild)) {
                      flags |= HAS_WS_TEXT | HAS_WS_IN_ARRAY;
                    } else {
                      if (pendingCount > pendingBase)
                        materializePending(S, children, pendingBase);
                      flags |= HAS_TEXT;
                    }
                  }
                  children.push(promotedChild);
                } else {
                  flags |= HAS_ELEMENT;
                  children.push(promotedChild);
                }
              }
              node.children = [];
            }
          } else if (selfClosingSet === null || !selfClosingSet.has(tagName)) {
            // Node has children — push frame and descend
            pos++;
            frameTagNames[depth] = currentTagName;
            frameAttributes[depth] = attributes;
            frameChildren[depth] = children;
            frameFlags[depth] = flags;
            frameNameStarts[depth] = currentNameStart;
            framePendingBases[depth] = pendingBase;
            depth++;
            currentTagName = tagName;
            currentNameStart = tagNameStart;
            children = [];
            flags = 0;
            pendingBase = pendingCount;
          } else {
            // Self-closing tag (from selfClosingTags list)
            pos++;
            const node: TNode = { tagName, attributes, children: [] };
            children[children.length] = node;
            flags |= HAS_ELEMENT;
            // PI promotion is a no-op here: node.children is always empty
          }
        } else {
          // Explicit self-closing (/>) or processing instruction (?>) or declaration
          pos++;
          const node: TNode = { tagName, attributes, children: [] };
          children[children.length] = node;
          flags |= HAS_ELEMENT;
          // PI promotion is a no-op here: node.children is always empty
        }
      } else {
        // ---- Text (inline parseText) ----
        const textStart = pos;
        if (decode === null && !trimWhitespace) {
          // Fused scan + classification: walk the (typically short)
          // leading whitespace in JS; the first non-ws char both settles
          // the classification and hands the rest of the scan to the
          // SIMD indexOf. Ws-only runs never call indexOf and are
          // deferred as index pairs (substring allocated only if kept).
          let textEnd: number;
          let wsOnly = true;
          let needExact = false;
          let j = pos;
          for (;;) {
            if (j >= srcEnd) {
              textEnd = srcEnd;
              pos = srcEnd + 1; // matches original post-increment past EOF
              break;
            }
            const c = src.charCodeAt(j);
            if (c === LT) {
              textEnd = j;
              pos = j;
              break;
            }
            if (c === 32 || (c >= 9 && c <= 13)) {
              j++;
              continue;
            }
            // Non-ws (or possibly Unicode ws if >= 128): classification
            // settled (or needs the exact fallback); finish with indexOf
            if (c >= 128) needExact = true;
            wsOnly = false;
            const idx = src.indexOf('<', j + 1);
            if (idx === -1) {
              textEnd = srcEnd;
              pos = srcEnd + 1;
            } else {
              textEnd = idx;
              pos = idx;
            }
            break;
          }
          if (needExact) {
            // A non-ASCII char was seen before any ASCII non-ws: defer to
            // trim() for exact Unicode-whitespace semantics
            wsOnly = src.substring(textStart, textEnd).trim().length === 0;
          }
          if (strict && depth === 0 && currentTagName === '' && !wsOnly) {
            throw strictError('Text content outside of a tag', textStart);
          }
          if ((flags & HAS_TEXT) !== 0) {
            // Mixed content already established — push directly
            children[children.length] = src.substring(textStart, textEnd);
          } else if (wsOnly) {
            // Defer: record the range, allocate only if the container
            // turns out to keep its whitespace
            pendStart[pendingCount] = textStart;
            pendEnd[pendingCount] = textEnd;
            pendAt[pendingCount] = children.length;
            pendingCount++;
            flags |= HAS_WS_TEXT;
          } else {
            if (pendingCount > pendingBase)
              materializePending(S, children, pendingBase);
            children[children.length] = src.substring(textStart, textEnd);
            flags |= HAS_TEXT;
          }
          continue;
        }
        let textEnd = src.indexOf('<', pos);
        if (textEnd === -1) {
          textEnd = srcEnd;
          pos = srcEnd + 1; // matches the original post-increment past EOF
        } else {
          pos = textEnd;
        }
        if (decode === null) {
          // No decoding, trimWhitespace mode (the non-trim case took the
          // fused path above).
          if (strict && depth === 0 && currentTagName === '') {
            if (!isWsRange(textStart, textEnd)) {
              throw strictError('Text content outside of a tag', textStart);
            }
          }
          // Fused trim: compute bounds on the source, substring once;
          // ws-only runs allocate nothing. Falls back to substring+trim
          // when a non-ASCII char sits at a boundary (Unicode whitespace).
          let trimStart = textStart;
          let trimLast = textEnd - 1;
          let exact = true;
          while (trimStart <= trimLast) {
            const c = src.charCodeAt(trimStart);
            if (c === 32 || (c >= 9 && c <= 13)) {
              trimStart++;
              continue;
            }
            if (c >= 128) exact = false;
            break;
          }
          if (exact && trimStart <= trimLast) {
            while (trimLast > trimStart) {
              const c = src.charCodeAt(trimLast);
              if (c === 32 || (c >= 9 && c <= 13)) {
                trimLast--;
                continue;
              }
              if (c >= 128) exact = false;
              break;
            }
          }
          if (!exact) {
            const trimmed = src.substring(textStart, textEnd).trim();
            if (trimmed.length > 0) {
              children.push(trimmed);
              flags |= HAS_TEXT;
            }
          } else if (trimStart <= trimLast) {
            children.push(src.substring(trimStart, trimLast + 1));
            flags |= HAS_TEXT;
          }
        } else {
          // Entity decoding active: classification must look at the
          // decoded string, so no deferral on this path. decode of a
          // string without '&' is identity, so gate on indexOf.
          let text = src.substring(textStart, textEnd);
          if (text.indexOf('&') !== -1) text = decode(text);
          if (
            strict &&
            depth === 0 &&
            currentTagName === '' &&
            text.trim().length > 0
          ) {
            throw strictError('Text content outside of a tag', textStart);
          }
          if (trimWhitespace) {
            const trimmed = text.trim();
            if (trimmed.length > 0) {
              children.push(trimmed);
              flags |= HAS_TEXT;
            }
          } else if (text.length > 0) {
            if ((flags & HAS_TEXT) === 0) {
              flags |= isWsString(text)
                ? HAS_WS_TEXT | HAS_WS_IN_ARRAY
                : HAS_TEXT;
            }
            children[children.length] = text;
          }
        }
      }
    }
    // If we exit the loop for a named tag, input ended without a close tag
    if (strict && currentTagName !== '') {
      throw strictError(`Unclosed tag <${currentTagName}>`);
    }
    if ((flags & KIND_MASK) === STRIP_STATE) {
      pendingCount = pendingBase;
      if (flags & HAS_WS_IN_ARRAY) compactWhitespace(children);
    } else if (pendingCount > pendingBase) {
      materializePending(S, children, pendingBase);
    }
    // Unwind any remaining stack frames (unclosed tags in non-strict mode)
    while (depth > 0) {
      depth--;
      const node: TNode = {
        tagName: currentTagName,
        attributes: frameAttributes[depth]!,
        children,
      };
      currentTagName = frameTagNames[depth]!;
      children = frameChildren[depth]!;
      flags = frameFlags[depth]! | HAS_ELEMENT;
      pendingBase = framePendingBases[depth]!;
      children[children.length] = node;
      if ((flags & KIND_MASK) === STRIP_STATE) {
        pendingCount = pendingBase;
        if (flags & HAS_WS_IN_ARRAY) compactWhitespace(children);
      } else if (pendingCount > pendingBase) {
        materializePending(S, children, pendingBase);
      }
    }
    return children;
  }

  function parseName(): string {
    const start = pos;
    // charCode > 62 covers letters and all non-ASCII in one compare; the
    // table is only consulted for low codes (digits, '-', '.', ':', and
    // the enders). Past-end charCodeAt yields NaN: NaN > 62 is false and
    // NAME_END[NaN] is undefined !== 0, which terminates the loop.
    let charCode = S.charCodeAt(pos);
    while (charCode > 62 || NAME_END[charCode] === 0) {
      charCode = S.charCodeAt(++pos);
    }
    return S.substring(start, pos);
  }

  function parseNode(): TNode {
    pos++;
    const tagNameStart = pos;
    const tagName = parseName();
    // Defer attributes allocation until first attribute is found
    let attributes: Record<string, string | null> | null = null;
    let children: (TNode | string)[] = [];

    // parsing attributes
    while (S.charCodeAt(pos) !== GT && S[pos]) {
      let charCode = S.charCodeAt(pos);
      // Valid XML attribute name start: A-Z, a-z, _, :, or non-ASCII
      if (
        (charCode > 64 && charCode < 91) ||
        (charCode > 96 && charCode < 123) ||
        charCode === UNDERSCORE ||
        charCode === COLON ||
        charCode > 127
      ) {
        const name = parseName();
        // search beginning of the string
        let code = S.charCodeAt(pos);
        while (
          code &&
          code !== SQUOTE &&
          code !== DQUOTE &&
          !(
            (code > 64 && code < 91) ||
            (code > 96 && code < 123) ||
            code === UNDERSCORE ||
            code === COLON ||
            code > 127
          ) &&
          code !== GT
        ) {
          pos++;
          code = S.charCodeAt(pos);
        }
        let value: string | null;
        if (code === SQUOTE || code === DQUOTE) {
          value = parseString();
          if (pos === -1) {
            return { tagName, attributes, children };
          }
          // decode of a string without '&' is identity, skip the call
          if (decode !== null && value.indexOf('&') !== -1)
            value = decode(value);
        } else {
          value = null;
          pos--;
        }
        // Allocate attributes object lazily on first attribute
        if (attributes === null) attributes = {};
        setOwnProperty(attributes!, name, value);
      }
      pos++;
    }
    if (strict && !S[pos]) {
      throw strictError(`Unclosed tag <${tagName}>`);
    }
    // Self-closing: explicit />, processing instruction ?>, or declaration <!...>
    if (
      S.charCodeAt(pos - 1) !== SLASH &&
      S.charCodeAt(pos - 1) !== QUESTION &&
      tagName.charCodeAt(0) !== BANG
    ) {
      if (rawContentSet !== null && rawContentSet.has(tagName)) {
        // Raw content tag: scan for the matching close tag and emit content as raw text
        const closeTag = '</' + tagName + '>';
        const start = pos + 1;
        pos = S.indexOf(closeTag, start);
        if (pos === -1) {
          if (strict) throw strictError(`Unclosed tag <${tagName}>`);
          // Unclosed raw content tag: consume the rest of the string
          children = [S.substring(start)];
          pos = S.length;
        } else {
          children = [S.substring(start, pos)];
          pos += closeTag.length;
        }
      } else if (selfClosingSet === null || !selfClosingSet.has(tagName)) {
        pos++;
        children = parseChildren(tagName, tagNameStart);
      } else {
        pos++;
      }
    } else {
      pos++;
    }
    return { tagName, attributes, children };
  }

  function parseString(): string {
    const quoteCharCode = S.charCodeAt(pos);
    const startPosition = pos + 1;
    pos = S.indexOf(quoteCharCode === SQUOTE ? "'" : '"', startPosition);
    return S.substring(startPosition, pos);
  }

  function findElements(): number {
    /* v8 ignore next — defensive: caller always defaults attrName to 'id' */
    if (!resolvedOptions.attrName || !resolvedOptions.attrValue) return -1;
    const matchResult = new RegExp(
      '\\s' +
        escapeRegExp(resolvedOptions.attrName) +
        '\\s*=[\'"]' +
        escapeRegExp(resolvedOptions.attrValue) +
        '[\'"]',
    ).exec(S);
    if (matchResult) {
      return matchResult.index;
    } else {
      return -1;
    }
  }

  let out: (TNode | string)[] | TNode;

  try {
    if (resolvedOptions.attrValue !== undefined) {
      resolvedOptions.attrName = resolvedOptions.attrName || 'id';
      const results: (TNode | string)[] = [];

      while ((pos = findElements()) !== -1) {
        pos = S.lastIndexOf('<', pos);
        if (pos !== -1) {
          results.push(parseNode());
        }
        S = S.slice(pos);
        srcLength = S.length;
        pos = 0;
      }
      out = results;
    } else if (resolvedOptions.parseNode) {
      out = parseNode();
    } else {
      out = parseChildren('', 0);
      // In strict mode, reject non-whitespace text after the root element
      if (strict && pos < S.length) {
        const trailing = S.substring(pos);
        if (trailing.trim().length > 0) {
          throw strictError('Text content outside of a tag');
        }
      }
    }
  } finally {
    // Drop tree/tagName references held by the module-level scratch stack
    // so no parsed data outlives this call.
    clearScratch();
  }

  if (resolvedOptions.filter && Array.isArray(out)) {
    out = filter(out, resolvedOptions.filter);
  }

  if (
    resolvedOptions.setPos &&
    typeof out === 'object' &&
    !Array.isArray(out)
  ) {
    (out as TNodeWithPos).pos = pos;
  }

  return out as (TNode | string)[];
}
