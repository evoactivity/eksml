/**
 * @author: Tobias Nickel
 * @created: 06.04.2015
 * I needed a small xmlparser that can be used in a worker.
 */

/**
 * A parsed XML node
 */
export interface TNode {
  tagName: string;
  /**
   * Element attributes. Values can be:
   * - string: attribute with a value (e.g., `<div id="test">` -> `{id: "test"}`)
   * - null: attribute without a value (e.g., `<input disabled>` -> `{disabled: null}`)
   * - empty string: attribute with empty value (e.g., `<input value="">` -> `{value: ""}`)
   */
  attributes: Record<string, string | null>;
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
  /** If true, the returned object will have a pos property indicating where parsing stopped */
  setPos?: boolean;
  /** Keep XML comments in the output */
  keepComments?: boolean;
  /** Keep whitespace text nodes */
  keepWhitespace?: boolean;
  /** Automatically simplify the output */
  simplify?: boolean;
  /** Parse a single node instead of a list of nodes */
  parseNode?: boolean;
  /** Attribute name to search for (used with attrValue) */
  attrName?: string;
  /** Attribute value to search for (regex pattern) */
  attrValue?: string;
  /** Filter function to apply to nodes */
  filter?: (
    node: TNode,
    index: number,
    depth: number,
    path: string,
  ) => boolean;
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
NAME_END[9] = 1;   // \t
NAME_END[10] = 1;  // \n
NAME_END[13] = 1;  // \r
NAME_END[32] = 1;  // space
NAME_END[47] = 1;  // /
NAME_END[61] = 1;  // =
NAME_END[62] = 1;  // >

/**
 * Standard HTML void elements that are self-closing and never have children.
 * Used as the default for `selfClosingTags` when `html: true`.
 */
export const HTML_VOID_ELEMENTS = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
];

/**
 * HTML elements whose content is raw text (not parsed as markup).
 * Used as the default for `rawContentTags` when `html: true`.
 */
export const HTML_RAW_CONTENT_TAGS = ["script", "style"];

/**
 * Parse XML/HTML into a DOM Object with minimal validation and fault tolerance
 * @param S - The XML string to parse
 * @param options - Parsing options
 * @returns Array of parsed nodes and text content
 */
export function parse(
  S: string,
  options?: ParseOptions,
): (TNode | string)[] | TNodeWithPos | Record<string, any> | string {
  const opts = options || {};

  let pos = opts.pos || 0;
  const keepComments = !!opts.keepComments;
  const keepWhitespace = !!opts.keepWhitespace;
  const htmlMode = !!opts.html;

  const selfClosingArr: string[] =
    opts.selfClosingTags ?? (htmlMode ? HTML_VOID_ELEMENTS : []);
  const rawContentArr: string[] =
    opts.rawContentTags ?? (htmlMode ? HTML_RAW_CONTENT_TAGS : []);

  // Convert to Sets for O(1) lookup when non-empty
  const selfClosingSet: Set<string> | null =
    selfClosingArr.length > 0 ? new Set(selfClosingArr) : null;
  const rawContentSet: Set<string> | null =
    rawContentArr.length > 0 ? new Set(rawContentArr) : null;

  function parseChildren(tagName: string): (TNode | string)[] {
    const children: (TNode | string)[] = [];
    while (S[pos]) {
      if (S.charCodeAt(pos) === openBracketCC) {
        if (S.charCodeAt(pos + 1) === slashCC) {
          const closeStart = pos + 2;
          pos = S.indexOf(">", pos);

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

          return children;
        } else if (S.charCodeAt(pos + 1) === exclamationCC) {
          if (S.charCodeAt(pos + 2) === 45 /* - */) {
            // comment: use indexOf("-->") for fast scanning
            const startCommentPos = pos;
            pos = S.indexOf("-->", pos + 3);
            if (pos === -1) {
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
              children.push(S.substring(pos + 9));
              pos = S.length;
            } else {
              children.push(S.substring(pos + 9, cdataEndIndex));
              pos = cdataEndIndex + 3;
            }
            continue;
          } else {
            // doctype support
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
              }
              pos++;
            }
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
        const text = parseText();
        if (keepWhitespace) {
          if (text.length > 0) {
            children.push(text);
          }
        } else {
          const trimmed = text.trim();
          if (trimmed.length > 0) {
            children.push(trimmed);
          }
        }
        pos++;
      }
    }
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
    while (cc < 128 ? NAME_END[cc] === 0 : cc === cc /* not NaN = not past end */) {
      cc = S.charCodeAt(++pos);
    }
    return S.substring(start, pos);
  }

  function parseNode(): TNode {
    pos++;
    const tagName = parseName();
    const attributes: Record<string, string | null> = {};
    let children: (TNode | string)[] = [];

    // parsing attributes
    while (S.charCodeAt(pos) !== closeBracketCC && S[pos]) {
      let c = S.charCodeAt(pos);
      if ((c > 64 && c < 91) || (c > 96 && c < 123)) {
        const name = parseName();
        // search beginning of the string
        let code = S.charCodeAt(pos);
        while (
          code &&
          code !== singleQuoteCC &&
          code !== doubleQuoteCC &&
          !((code > 64 && code < 91) || (code > 96 && code < 123)) &&
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
        } else {
          value = null;
          pos--;
        }
        attributes[name] = value;
      }
      pos++;
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

  if (opts.simplify) {
    const arrOut = Array.isArray(out) ? out : [out];
    return simplify(arrOut);
  }

  if (opts.setPos && typeof out === "object" && !Array.isArray(out)) {
    (out as TNodeWithPos).pos = pos;
  }

  return out;
}

/**
 * Transform the DOM object to a simpler format like PHP's SimpleXML.
 * Note: The order of elements is not preserved, and the original XML cannot be reproduced.
 * @param children - Array of nodes to simplify
 * @returns Simplified object structure
 */
export function simplify(
  children: (TNode | string)[],
): Record<string, any> | string {
  const out: Record<string, any> = {};

  if (!children.length) {
    return "";
  }

  if (children.length === 1 && typeof children[0] === "string") {
    return children[0];
  }

  // map each object
  children.forEach(function (child) {
    if (typeof child !== "object") {
      return;
    }
    if (!out[child.tagName]) out[child.tagName] = [];
    const kids = simplify(child.children);
    out[child.tagName].push(kids);
    if (
      Object.keys(child.attributes).length &&
      typeof kids === "object" &&
      !Array.isArray(kids)
    ) {
      kids._attributes = child.attributes;
    }
  });

  for (const i in out) {
    if (out[i].length === 1) {
      out[i] = out[i][0];
    }
  }

  return out;
}

/**
 * Similar to simplify, but preserves more information
 * @param children - Array of nodes to simplify
 * @param parentAttributes - Parent node attributes
 * @returns Simplified object structure with less data loss
 */
export function simplifyLostLess(
  children: (TNode | string)[],
  parentAttributes: Record<string, string | null> = {},
): Record<string, any> | string | { _attributes: Record<string, string | null>; value: string } {
  const out: Record<string, any> = {};

  if (!children.length) {
    return out;
  }

  if (children.length === 1 && typeof children[0] === "string") {
    return Object.keys(parentAttributes).length
      ? { _attributes: parentAttributes, value: children[0] }
      : children[0];
  }

  // map each object
  children.forEach(function (child) {
    if (typeof child !== "object") {
      return;
    }
    if (!out[child.tagName]) out[child.tagName] = [];
    const kids = simplifyLostLess(child.children || [], child.attributes);
    out[child.tagName].push(kids);
    if (
      Object.keys(child.attributes).length &&
      typeof kids === "object" &&
      !Array.isArray(kids)
    ) {
      (kids as Record<string, any>)._attributes = child.attributes;
    }
  });

  return out;
}

/**
 * Filter nodes like Array.filter - returns nodes where the filter function returns true
 * @param children - Array of nodes to filter
 * @param f - Filter function
 * @param dept - Current depth in the tree (internal use)
 * @param path - Current path in the tree (internal use)
 * @returns Filtered array of nodes
 */
export function filter(
  children: (TNode | string)[],
  f: (node: TNode, index: number, depth: number, path: string) => boolean,
  dept: number = 0,
  path: string = "",
): TNode[] {
  let out: TNode[] = [];

  children.forEach(function (child, i) {
    if (typeof child === "object" && f(child, i, dept, path)) {
      out.push(child);
    }
    if (typeof child === "object" && child.children) {
      const kids = filter(
        child.children,
        f,
        dept + 1,
        (path ? path + "." : "") + i + "." + child.tagName,
      );
      out = out.concat(kids);
    }
  });
  return out;
}

/**
 * Stringify a parsed object back to XML.
 * Useful for removing whitespace or recreating XML with modified data.
 * @param O - The node(s) to stringify
 * @returns XML string
 */
export function stringify(O: TNode | (TNode | string)[]): string {
  if (!O) return "";

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
    if (N.tagName[0] === "?") {
      out += "?>";
      return;
    }
    out += ">";
    writeChildren(N.children);
    out += "</" + N.tagName + ">";
  }
  writeChildren(Array.isArray(O) ? O : [O]);

  return out;
}

/**
 * Read the text content of a node, useful for mixed content.
 * Example: "this text has some <b>big</b> text and a <a href=''>link</a>"
 * @param tDom - The node(s) to extract text from
 * @returns Concatenated text content
 */
export function toContentString(
  tDom: TNode | (TNode | string)[] | string,
): string {
  if (Array.isArray(tDom)) {
    let out = "";
    tDom.forEach(function (e) {
      out += " " + toContentString(e);
      out = out.trim();
    });
    return out;
  } else if (typeof tDom === "object" && tDom !== null) {
    return toContentString(tDom.children);
  } else {
    return " " + tDom;
  }
}

/**
 * Find an element by ID attribute
 * @param S - XML string to search
 * @param id - ID value to find
 * @param simplified - Whether to return simplified output
 * @returns Found node(s)
 */
export function getElementById(
  S: string,
  id: string,
  simplified?: boolean,
): TNode | Record<string, any> | string | undefined {
  const out = parse(S, { attrValue: id }) as (TNode | string)[];
  return simplified ? simplify(out) : out[0];
}

/**
 * Find elements by class name
 * @param S - XML string to search
 * @param classname - Class name to find
 * @param simplified - Whether to return simplified output
 * @returns Found nodes
 */
export function getElementsByClassName(
  S: string,
  classname: string,
  simplified?: boolean,
): (TNode | string)[] | Record<string, any> | string {
  const out = parse(S, {
    attrName: "class",
    attrValue: "[a-zA-Z0-9- ]*" + classname + "[a-zA-Z0-9- ]*",
  }) as (TNode | string)[];
  return simplified ? simplify(out) : out;
}

/**
 * Type guard to check if a node is a text node (string).
 * Useful for filtering and type narrowing when working with mixed node arrays.
 *
 * @param node - The node to check
 * @returns True if the node is a string (text node)
 * @example
 * const parsed = parse('<div>Hello <span>World</span></div>');
 * parsed[0].children.forEach(child => {
 *   if (isTextNode(child)) {
 *     console.log('Text:', child);
 *   }
 * });
 */
export function isTextNode(node: TNode | string): node is string {
  return typeof node === "string";
}

/**
 * Type guard to check if a node is an element node (TNode object).
 * Useful for filtering and type narrowing when working with mixed node arrays.
 *
 * @param node - The node to check
 * @returns True if the node is a TNode (element node)
 * @example
 * const parsed = parse('<div>Hello <span>World</span></div>');
 * parsed[0].children.forEach(child => {
 *   if (isElementNode(child)) {
 *     console.log('Element:', child.tagName);
 *   }
 * });
 */
export function isElementNode(node: TNode | string): node is TNode {
  return typeof node === "object" && node !== null && "tagName" in node;
}
