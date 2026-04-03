/**
 * @author: Tobias Nickel
 * @created: 06.04.2015
 * I needed a small xmlparser that can be used in a worker.
 */

import { decodeXML, decodeHTML } from "entities";
import { filter } from "./utilities/filter.ts";
import {
  HTML_VOID_ELEMENTS,
  HTML_RAW_CONTENT_TAGS,
} from "./utilities/htmlConstants.ts";

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
   * close tags, and open tags that reach end-of-input without closing.
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

const openBracket = "<";
const openBracketCC = 60; // <
const closeBracketCC = 62; // >
const slashCC = 47; // /
const exclamationCC = 33; // !
const singleQuoteCC = 39; // '
const doubleQuoteCC = 34; // "
const openCornerBracketCC = 91; // [
const closeCornerBracketCC = 93; // ]
const questionCC = 63; // ?

// Pre-computed lookup table: 1 for characters that terminate a name token
// Name-ending chars: \t(9) \n(10) \r(13) space(32) /(47) =(61) >(62)
const NAME_END = new Uint8Array(128);
NAME_END[9] = 1; // \t
NAME_END[10] = 1; // \n
NAME_END[13] = 1; // \r
NAME_END[32] = 1; // space
NAME_END[47] = 1; // /
NAME_END[61] = 1; // =
NAME_END[62] = 1; // >

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
  const opts = (options || {}) as InternalParseOptions;

  let pos = opts.pos || 0;
  const keepComments = !!opts.keepComments;
  const trimWhitespace = !!opts.trimWhitespace;
  const strict = !!opts.strict;
  const htmlMode = !!opts.html;
  const decode = opts.entities === true ? (htmlMode ? decodeHTML : decodeXML) : null;

  const selfClosingArr: string[] =
    opts.selfClosingTags ?? (htmlMode ? HTML_VOID_ELEMENTS : []);
  const rawContentArr: string[] =
    opts.rawContentTags ?? (htmlMode ? HTML_RAW_CONTENT_TAGS : []);

  // Convert to Sets for O(1) lookup when non-empty
  const selfClosingSet: Set<string> | null =
    selfClosingArr.length > 0 ? new Set(selfClosingArr) : null;
  const rawContentSet: Set<string> | null =
    rawContentArr.length > 0 ? new Set(rawContentArr) : null;

  /** Build an error with line/column info for strict mode. */
  function strictError(message: string): Error {
    const before = S.substring(0, pos);
    const lines = before.split("\n");
    const line = lines.length;
    const col = lines[lines.length - 1]!.length + 1;
    return new Error(`${message} at line ${line}, column ${col}`);
  }

  /**
   * Strip whitespace-only text nodes from a children array when it also
   * contains element nodes (i.e. "ignorable whitespace" per XML spec).
   * Mutates the array in-place for performance.
   */
  function stripIgnorableWhitespace(children: (TNode | string)[]): void {
    let hasElement = false;
    let hasWhitespaceOnlyText = false;
    for (let i = 0; i < children.length; i++) {
      const c = children[i]!;
      if (typeof c !== "string") {
        hasElement = true;
      } else if (c.trim().length === 0) {
        hasWhitespaceOnlyText = true;
      }
      if (hasElement && hasWhitespaceOnlyText) break;
    }
    if (hasElement && hasWhitespaceOnlyText) {
      // Compact in-place with a write pointer (avoids O(n) splice per removal)
      let w = 0;
      for (let i = 0; i < children.length; i++) {
        const c = children[i]!;
        if (typeof c === "string" && c.trim().length === 0) continue;
        children[w++] = c;
      }
      children.length = w;
    }
  }

  function parseChildren(tagName: string): (TNode | string)[] {
    const children: (TNode | string)[] = [];
    while (S[pos]) {
      if (S.charCodeAt(pos) === openBracketCC) {
        if (S.charCodeAt(pos + 1) === slashCC) {
          const closeStart = pos + 2;
          pos = S.indexOf(">", pos);

          if (pos === -1) {
            if (strict) throw strictError("Unclosed close tag");
            pos = S.length;
            stripIgnorableWhitespace(children);
            return children;
          }

          const closeTag = S.substring(closeStart, pos);
          if (closeTag.indexOf(tagName) === -1) {
            const parsedText = S.substring(0, pos).split("\n");
            throw new Error(
              "Unexpected close tag\nLine: " +
                (parsedText.length - 1) +
                "\nColumn: " +
                (parsedText[parsedText.length - 1]!.length + 1) +
                "\nChar: " +
                S[pos],
            );
          }

          if (pos + 1) pos += 1;

          stripIgnorableWhitespace(children);
          return children;
        } else if (S.charCodeAt(pos + 1) === exclamationCC) {
          if (S.charCodeAt(pos + 2) === 45 /* - */) {
            // comment: use indexOf("-->") for fast scanning
            const startCommentPos = pos;
            pos = S.indexOf("-->", pos + 3);
            if (pos === -1) {
              if (strict) throw strictError("Unclosed comment");
              pos = S.length;
              if (keepComments) {
                children.push(S.substring(startCommentPos));
              }
            } else {
              pos += 2; // point to the '>'
              if (keepComments) {
                children.push(S.substring(startCommentPos, pos + 1));
              }
            }
          } else if (
            S.charCodeAt(pos + 2) === openCornerBracketCC &&
            S.charCodeAt(pos + 8) === openCornerBracketCC &&
            S.substring(pos + 3, pos + 8).toLowerCase() === "cdata"
          ) {
            // cdata
            const cdataEndIndex = S.indexOf("]]>", pos);
            if (cdataEndIndex === -1) {
              if (strict) throw strictError("Unclosed CDATA section");
              children.push(S.substring(pos + 9));
              pos = S.length;
            } else {
              children.push(S.substring(pos + 9, cdataEndIndex));
              pos = cdataEndIndex + 3;
            }
            continue;
          } else {
            // doctype / other <!...> declarations: skip to matching '>'
            // For internal DTD subsets ([...]), skip quoted strings inside
            const startDoctype = pos + 1;
            pos += 2;
            let encapsuled = false;
            while (
              (S.charCodeAt(pos) !== closeBracketCC || encapsuled === true) &&
              S[pos]
            ) {
              if (S.charCodeAt(pos) === openCornerBracketCC) {
                encapsuled = true;
              } else if (
                encapsuled === true &&
                S.charCodeAt(pos) === closeCornerBracketCC
              ) {
                encapsuled = false;
              } else if (encapsuled === true) {
                // Skip quoted strings inside internal DTD subset
                const qc = S.charCodeAt(pos);
                if (qc === singleQuoteCC || qc === doubleQuoteCC) {
                  pos = S.indexOf(
                    qc === singleQuoteCC ? "'" : '"',
                    pos + 1,
                  );
                  if (pos === -1) {
                    pos = S.length;
                    break;
                  }
                }
              }
              pos++;
            }
            if (strict && !S[pos]) throw strictError("Unclosed declaration");
            children.push(S.substring(startDoctype, pos));
          }
          pos++;
          continue;
        }
        const node = parseNode();
        children.push(node);
        if (node.tagName.charCodeAt(0) === questionCC) {
          children.push(...node.children);
          node.children = [];
        }
      } else {
        let text = parseText();
        if (decode) text = decode(text);
        if (trimWhitespace) {
          const trimmed = text.trim();
          if (trimmed.length > 0) {
            children.push(trimmed);
          }
        } else {
          if (text.length > 0) {
            children.push(text);
          }
        }
        pos++;
      }
    }
    // If we exit the loop for a named tag, input ended without a close tag
    if (strict && tagName !== "") {
      throw strictError(`Unclosed tag <${tagName}>`);
    }
    stripIgnorableWhitespace(children);
    return children;
  }

  function parseText(): string {
    const start = pos;
    pos = S.indexOf(openBracket, pos) - 1;
    if (pos === -2) pos = S.length;
    return S.substring(start, pos + 1);
  }

  function parseName(): string {
    const start = pos;
    let cc = S.charCodeAt(pos);
    while (
      cc < 128 ? NAME_END[cc] === 0 : cc === cc /* not NaN = not past end */
    ) {
      cc = S.charCodeAt(++pos);
    }
    return S.substring(start, pos);
  }

  function parseNode(): TNode {
    pos++;
    const tagName = parseName();
    // Defer attributes allocation until first attribute is found
    let attributes: Record<string, string | null> | null = null;
    let children: (TNode | string)[] = [];

    // parsing attributes
    while (S.charCodeAt(pos) !== closeBracketCC && S[pos]) {
      let c = S.charCodeAt(pos);
      // Valid XML attribute name start: A-Z, a-z, _, :, or non-ASCII
      if (
        (c > 64 && c < 91) ||
        (c > 96 && c < 123) ||
        c === 95 ||
        c === 58 ||
        c > 127
      ) {
        const name = parseName();
        // search beginning of the string
        let code = S.charCodeAt(pos);
        while (
          code &&
          code !== singleQuoteCC &&
          code !== doubleQuoteCC &&
          !(
            (code > 64 && code < 91) ||
            (code > 96 && code < 123) ||
            code === 95 ||
            code === 58 ||
            code > 127
          ) &&
          code !== closeBracketCC
        ) {
          pos++;
          code = S.charCodeAt(pos);
        }
        let value: string | null;
        if (code === singleQuoteCC || code === doubleQuoteCC) {
          value = parseString();
          if (pos === -1) {
            return { tagName, attributes, children };
          }
          if (decode) value = decode(value);
        } else {
          value = null;
          pos--;
        }
        // Allocate attributes object lazily on first attribute
        if (attributes === null) attributes = Object.create(null);
        attributes![name] = value;
      }
      pos++;
    }
    if (strict && !S[pos]) {
      throw strictError(`Unclosed tag <${tagName}>`);
    }
    // optional parsing of children
    // Self-closing: explicit />, processing instruction ?>, or declaration <!...>
    if (
      S.charCodeAt(pos - 1) !== slashCC &&
      S.charCodeAt(pos - 1) !== questionCC &&
      tagName.charCodeAt(0) !== exclamationCC
    ) {
      if (rawContentSet !== null && rawContentSet.has(tagName)) {
        // Raw content tag: scan for the matching close tag and emit content as raw text
        const closeTag = "</" + tagName + ">";
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
        children = parseChildren(tagName);
      } else {
        pos++;
      }
    } else {
      pos++;
    }
    return { tagName, attributes, children };
  }

  function parseString(): string {
    const quoteCC = S.charCodeAt(pos);
    const startpos = pos + 1;
    pos = S.indexOf(quoteCC === singleQuoteCC ? "'" : '"', startpos);
    return S.substring(startpos, pos);
  }

  function findElements(): number {
    if (!opts.attrName || !opts.attrValue) return -1;
    const r = new RegExp(
      "\\s" + opts.attrName + "\\s*=['\"]" + opts.attrValue + "['\"]",
    ).exec(S);
    if (r) {
      return r.index;
    } else {
      return -1;
    }
  }

  let out: (TNode | string)[] | TNode;

  if (opts.attrValue !== undefined) {
    opts.attrName = opts.attrName || "id";
    const results: (TNode | string)[] = [];

    while ((pos = findElements()) !== -1) {
      pos = S.lastIndexOf("<", pos);
      if (pos !== -1) {
        results.push(parseNode());
      }
      S = S.substr(pos);
      pos = 0;
    }
    out = results;
  } else if (opts.parseNode) {
    out = parseNode();
  } else {
    out = parseChildren("");
  }

  if (opts.filter && Array.isArray(out)) {
    out = filter(out, opts.filter);
  }

  if (opts.setPos && typeof out === "object" && !Array.isArray(out)) {
    (out as TNodeWithPos).pos = pos;
  }

  return out as (TNode | string)[];
}

