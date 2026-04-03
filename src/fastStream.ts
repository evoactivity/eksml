/**
 * fastStream — a high-performance, synchronous, event-based streaming XML parser.
 *
 * Unlike `transformStream` (which uses the async Web Streams API and emits full
 * TNode subtrees), `fastStream` is a pure SAX-style parser designed to compete
 * on raw speed with sax, saxes, and htmlparser2.
 *
 * Architecture: single-pass state machine with batch scanning. Each character is
 * consumed exactly once. Within a chunk, hot-path states (text, tag names,
 * attribute names/values, close tags) scan ahead with indexOf / charCodeAt loops
 * to extract tokens via a single substring() rather than per-character +=.
 *
 * Usage:
 *   const parser = fastStream({
 *     onopentag(name, attrs) { ... },
 *     ontext(text) { ... },
 *     onclosetag(name) { ... },
 *   });
 *   parser.write(chunk1);
 *   parser.write(chunk2);
 *   parser.close();
 */

// ---------------------------------------------------------------------------
// Character codes
// ---------------------------------------------------------------------------
const GT = 62; // >
const SLASH = 47; // /
const BANG = 33; // !
const DASH = 45; // -
const QUESTION = 63; // ?
const SQUOTE = 39; // '
const DQUOTE = 34; // "
const EQ = 61; // =
const LBRACKET = 91; // [
const RBRACKET = 93; // ]
const TAB = 9;
const LF = 10;
const CR = 13;
const SPACE = 32;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Attributes record emitted with opentag events. */
export type Attributes = Record<string, string | null>;

/** Event handlers for the streaming parser. All callbacks are optional. */
export interface FastStreamHandlers {
  /** Fired when an opening tag and its attributes have been fully parsed. */
  onopentag?: (tagName: string, attributes: Attributes) => void;
  /** Fired when a closing tag is encountered. */
  onclosetag?: (tagName: string) => void;
  /** Fired for text content between tags (trimmed; not fired for whitespace-only text). */
  ontext?: (text: string) => void;
  /** Fired for CDATA sections. */
  oncdata?: (data: string) => void;
  /** Fired for comments (the full `<!-- ... -->` string). */
  oncomment?: (comment: string) => void;
  /** Fired for processing instructions (`<?xml ... ?>`). */
  onprocessinginstruction?: (name: string, body: string) => void;
}

/** Options for the streaming parser. */
export interface FastStreamOptions extends FastStreamHandlers {
  /** Tag names that are self-closing (void). Default `[]`. */
  selfClosingTags?: string[];
  /** Tag names whose content is raw text. Default `[]`. */
  rawContentTags?: string[];
}

/** The parser instance returned by `fastStream()`. */
export interface FastStreamParser {
  /** Feed a chunk of XML to the parser. */
  write(chunk: string): void;
  /** Signal end-of-input and flush any remaining buffered data. */
  close(): void;
}

// ---------------------------------------------------------------------------
// Parser states
// ---------------------------------------------------------------------------
const enum State {
  TEXT,
  TAG_OPEN,
  OPEN_TAG_NAME,
  OPEN_TAG_BODY,
  ATTR_NAME,
  ATTR_AFTER_NAME,
  ATTR_AFTER_EQ,
  ATTR_VALUE_DQ,
  ATTR_VALUE_SQ,
  ATTR_VALUE_UQ,
  CLOSE_TAG,
  SELF_CLOSING,
  COMMENT_1,
  COMMENT,
  COMMENT_END1,
  COMMENT_END2,
  CDATA_1,
  CDATA_2,
  CDATA_3,
  CDATA_4,
  CDATA_5,
  CDATA_6,
  CDATA,
  CDATA_END1,
  CDATA_END2,
  PI,
  PI_END,
  DOCTYPE,
  DOCTYPE_BRACKET,
  BANG_START,
  RAW_TEXT,
  RAW_END_1,
  RAW_END_2,
  RAW_END_3,
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function fastStream(options: FastStreamOptions = {}): FastStreamParser {
  const {
    onopentag,
    onclosetag,
    ontext,
    oncdata,
    oncomment,
    onprocessinginstruction,
    selfClosingTags = [],
    rawContentTags = [],
  } = options;

  const voidSet: Set<string> | null =
    selfClosingTags.length > 0 ? new Set(selfClosingTags) : null;
  const rawSet: Set<string> | null =
    rawContentTags.length > 0 ? new Set(rawContentTags) : null;

  let state: State = State.TEXT;
  let text = "";
  let tagName = "";
  let attrName = "";
  let attrValue = "";
  let attrs: Attributes = {};
  let special = "";
  let rawTag = "";
  let rawText = "";
  let rawMatchIdx = 0;

  // --- Emit helpers ---

  function emitText(): void {
    if (text.length === 0) return;
    if (ontext) {
      let s = 0;
      let e = text.length - 1;
      while (s <= e) {
        const cc = text.charCodeAt(s);
        if (cc !== SPACE && cc !== TAB && cc !== LF && cc !== CR) break;
        s++;
      }
      while (e >= s) {
        const cc = text.charCodeAt(e);
        if (cc !== SPACE && cc !== TAB && cc !== LF && cc !== CR) break;
        e--;
      }
      if (s <= e) {
        ontext(s === 0 && e === text.length - 1 ? text : text.substring(s, e + 1));
      }
    }
    text = "";
  }

  function trimCloseTag(raw: string): string {
    let s = 0;
    let e = raw.length - 1;
    while (s <= e) {
      const cc = raw.charCodeAt(s);
      if (cc !== SPACE && cc !== TAB && cc !== LF && cc !== CR) break;
      s++;
    }
    while (e >= s) {
      const cc = raw.charCodeAt(e);
      if (cc !== SPACE && cc !== TAB && cc !== LF && cc !== CR) break;
      e--;
    }
    return s === 0 && e === raw.length - 1 ? raw : raw.substring(s, e + 1);
  }

  /** After we finish parsing an open tag's `>`, handle void/raw transitions. */
  function finishOpenTag(): void {
    if (onopentag) onopentag(tagName, attrs);
    if (voidSet !== null && voidSet.has(tagName)) {
      if (onclosetag) onclosetag(tagName);
    } else if (rawSet !== null && rawSet.has(tagName)) {
      rawTag = tagName;
      rawText = "";
      rawMatchIdx = 0;
      state = State.RAW_TEXT;
    }
  }

  // --- Inline scan helpers ---
  // These scan ahead within a chunk and return the end index.
  // If the token isn't complete in this chunk, they return -1.

  /**
   * Returns true if `cc` is a tag-name-ending character:
   * `>`, `/`, `=`, or whitespace.
   */
  function isNameEnd(cc: number): boolean {
    return cc === GT || cc === SLASH || cc === EQ ||
           cc === SPACE || cc === TAB || cc === LF || cc === CR;
  }

  function processChunk(chunk: string): void {
    const len = chunk.length;
    let i = 0;

    while (i < len) {
      switch (state) {
        // ==================================================================
        // TEXT
        // ==================================================================
        case State.TEXT: {
          const ltIdx = chunk.indexOf("<", i);
          if (ltIdx === -1) {
            text += (i === 0 ? chunk : chunk.substring(i));
            i = len;
          } else {
            if (ltIdx > i) text += chunk.substring(i, ltIdx);
            emitText();
            state = State.TAG_OPEN;
            i = ltIdx + 1;
          }
          continue;
        }

        // ==================================================================
        // TAG_OPEN
        // ==================================================================
        case State.TAG_OPEN: {
          const cc = chunk.charCodeAt(i);
          if (cc === SLASH) {
            state = State.CLOSE_TAG;
            tagName = "";
            i++;
          } else if (cc === BANG) {
            state = State.BANG_START;
            special = "";
            i++;
          } else if (cc === QUESTION) {
            state = State.PI;
            special = "";
            i++;
          } else {
            state = State.OPEN_TAG_NAME;
            tagName = "";
            attrs = {};
          }
          continue;
        }

        // ==================================================================
        // OPEN_TAG_NAME — batch scan for end of name
        // ==================================================================
        case State.OPEN_TAG_NAME: {
          // Scan ahead for end of tag name
          let j = i;
          while (j < len) {
            const cc = chunk.charCodeAt(j);
            if (isNameEnd(cc)) break;
            j++;
          }
          // Accumulate what we scanned
          if (j > i) tagName += chunk.substring(i, j);
          if (j >= len) {
            // Tag name continues in next chunk
            i = len;
            continue;
          }
          // We hit a terminator
          const cc = chunk.charCodeAt(j);
          if (cc === GT) {
            state = State.TEXT;
            i = j + 1;
            finishOpenTag();
          } else if (cc === SLASH) {
            state = State.SELF_CLOSING;
            i = j + 1;
          } else {
            // whitespace — enter body
            state = State.OPEN_TAG_BODY;
            i = j + 1;
          }
          continue;
        }

        // ==================================================================
        // OPEN_TAG_BODY
        // ==================================================================
        case State.OPEN_TAG_BODY: {
          const cc = chunk.charCodeAt(i);
          if (cc === GT) {
            state = State.TEXT;
            i++;
            finishOpenTag();
          } else if (cc === SLASH) {
            state = State.SELF_CLOSING;
            i++;
          } else if (cc === SPACE || cc === TAB || cc === LF || cc === CR) {
            i++;
          } else {
            state = State.ATTR_NAME;
            attrName = "";
            // don't advance — first char of attr name
          }
          continue;
        }

        // ==================================================================
        // ATTR_NAME — batch scan for end of attr name
        // ==================================================================
        case State.ATTR_NAME: {
          let j = i;
          while (j < len) {
            const cc = chunk.charCodeAt(j);
            if (cc === EQ || cc === GT || cc === SLASH ||
                cc === SPACE || cc === TAB || cc === LF || cc === CR) break;
            j++;
          }
          if (j > i) attrName += chunk.substring(i, j);
          if (j >= len) { i = len; continue; }

          const cc = chunk.charCodeAt(j);
          if (cc === EQ) {
            state = State.ATTR_AFTER_EQ;
            i = j + 1;
          } else if (cc === GT) {
            attrs[attrName] = null;
            state = State.TEXT;
            i = j + 1;
            finishOpenTag();
          } else if (cc === SLASH) {
            attrs[attrName] = null;
            state = State.SELF_CLOSING;
            i = j + 1;
          } else {
            // whitespace
            state = State.ATTR_AFTER_NAME;
            i = j + 1;
          }
          continue;
        }

        // ==================================================================
        // ATTR_AFTER_NAME
        // ==================================================================
        case State.ATTR_AFTER_NAME: {
          const cc = chunk.charCodeAt(i);
          if (cc === EQ) {
            state = State.ATTR_AFTER_EQ;
            i++;
          } else if (cc === SPACE || cc === TAB || cc === LF || cc === CR) {
            i++;
          } else if (cc === GT) {
            attrs[attrName] = null;
            state = State.TEXT;
            i++;
            finishOpenTag();
          } else if (cc === SLASH) {
            attrs[attrName] = null;
            state = State.SELF_CLOSING;
            i++;
          } else {
            // New attribute — boolean (no value)
            attrs[attrName] = null;
            state = State.ATTR_NAME;
            attrName = "";
          }
          continue;
        }

        // ==================================================================
        // ATTR_AFTER_EQ
        // ==================================================================
        case State.ATTR_AFTER_EQ: {
          const cc = chunk.charCodeAt(i);
          if (cc === DQUOTE) {
            state = State.ATTR_VALUE_DQ;
            attrValue = "";
            i++;
          } else if (cc === SQUOTE) {
            state = State.ATTR_VALUE_SQ;
            attrValue = "";
            i++;
          } else if (cc === SPACE || cc === TAB || cc === LF || cc === CR) {
            i++;
          } else if (cc === GT) {
            attrs[attrName] = "";
            state = State.TEXT;
            i++;
            finishOpenTag();
          } else {
            state = State.ATTR_VALUE_UQ;
            attrValue = "";
            // don't advance — first char of value
          }
          continue;
        }

        // ==================================================================
        // ATTR_VALUE_DQ — batch scan for closing "
        // ==================================================================
        case State.ATTR_VALUE_DQ: {
          const qIdx = chunk.indexOf('"', i);
          if (qIdx === -1) {
            attrValue += (i === 0 ? chunk : chunk.substring(i));
            i = len;
          } else {
            if (qIdx > i) attrValue += chunk.substring(i, qIdx);
            attrs[attrName] = attrValue;
            state = State.OPEN_TAG_BODY;
            i = qIdx + 1;
          }
          continue;
        }

        // ==================================================================
        // ATTR_VALUE_SQ — batch scan for closing '
        // ==================================================================
        case State.ATTR_VALUE_SQ: {
          const qIdx = chunk.indexOf("'", i);
          if (qIdx === -1) {
            attrValue += (i === 0 ? chunk : chunk.substring(i));
            i = len;
          } else {
            if (qIdx > i) attrValue += chunk.substring(i, qIdx);
            attrs[attrName] = attrValue;
            state = State.OPEN_TAG_BODY;
            i = qIdx + 1;
          }
          continue;
        }

        // ==================================================================
        // ATTR_VALUE_UQ — batch scan for end of unquoted value
        // ==================================================================
        case State.ATTR_VALUE_UQ: {
          let j = i;
          while (j < len) {
            const cc = chunk.charCodeAt(j);
            if (cc === SPACE || cc === TAB || cc === LF || cc === CR ||
                cc === GT || cc === SLASH) break;
            j++;
          }
          if (j > i) attrValue += chunk.substring(i, j);
          if (j >= len) { i = len; continue; }

          const cc = chunk.charCodeAt(j);
          attrs[attrName] = attrValue;
          if (cc === GT) {
            state = State.TEXT;
            i = j + 1;
            finishOpenTag();
          } else if (cc === SLASH) {
            state = State.SELF_CLOSING;
            i = j + 1;
          } else {
            state = State.OPEN_TAG_BODY;
            i = j + 1;
          }
          continue;
        }

        // ==================================================================
        // CLOSE_TAG — batch scan for >
        // ==================================================================
        case State.CLOSE_TAG: {
          const gtIdx = chunk.indexOf(">", i);
          if (gtIdx === -1) {
            tagName += (i === 0 ? chunk : chunk.substring(i));
            i = len;
          } else {
            if (gtIdx > i) tagName += chunk.substring(i, gtIdx);
            if (onclosetag) onclosetag(trimCloseTag(tagName));
            state = State.TEXT;
            i = gtIdx + 1;
          }
          continue;
        }

        // ==================================================================
        // SELF_CLOSING
        // ==================================================================
        case State.SELF_CLOSING: {
          const cc = chunk.charCodeAt(i);
          if (cc === GT) {
            state = State.TEXT;
            i++;
            if (onopentag) onopentag(tagName, attrs);
            if (onclosetag) onclosetag(tagName);
          } else {
            state = State.OPEN_TAG_BODY;
          }
          continue;
        }

        // ==================================================================
        // BANG_START
        // ==================================================================
        case State.BANG_START: {
          const cc = chunk.charCodeAt(i);
          if (cc === DASH) {
            state = State.COMMENT_1;
            special = "<!-";
            i++;
          } else if (cc === LBRACKET) {
            state = State.CDATA_1;
            i++;
          } else {
            state = State.DOCTYPE;
            i++;
          }
          continue;
        }

        // ==================================================================
        // COMMENT_1
        // ==================================================================
        case State.COMMENT_1: {
          const cc = chunk.charCodeAt(i);
          if (cc === DASH) {
            state = State.COMMENT;
            special = "<!--";
            i++;
          } else {
            state = State.DOCTYPE;
            i++;
          }
          continue;
        }

        // ==================================================================
        // COMMENT — batch scan for -->
        // ==================================================================
        case State.COMMENT: {
          // Batch: scan for '-' which might start '-->'
          const dIdx = chunk.indexOf("-", i);
          if (dIdx === -1) {
            special += (i === 0 ? chunk : chunk.substring(i));
            i = len;
          } else {
            if (dIdx > i) special += chunk.substring(i, dIdx);
            special += "-";
            state = State.COMMENT_END1;
            i = dIdx + 1;
          }
          continue;
        }

        // ==================================================================
        // COMMENT_END1
        // ==================================================================
        case State.COMMENT_END1: {
          const cc = chunk.charCodeAt(i);
          if (cc === DASH) {
            state = State.COMMENT_END2;
            special += "-";
            i++;
          } else {
            state = State.COMMENT;
            special += chunk[i];
            i++;
          }
          continue;
        }

        // ==================================================================
        // COMMENT_END2
        // ==================================================================
        case State.COMMENT_END2: {
          const cc = chunk.charCodeAt(i);
          if (cc === GT) {
            special += ">";
            if (oncomment) oncomment(special);
            special = "";
            state = State.TEXT;
            i++;
          } else if (cc === DASH) {
            special += "-";
            i++;
          } else {
            state = State.COMMENT;
            special += chunk[i];
            i++;
          }
          continue;
        }

        // ==================================================================
        // CDATA handshake states
        // ==================================================================
        case State.CDATA_1: { // expecting C
          if (chunk.charCodeAt(i) === 67) { state = State.CDATA_2; i++; }
          else { state = State.DOCTYPE; i++; }
          continue;
        }
        case State.CDATA_2: { // expecting D
          if (chunk.charCodeAt(i) === 68) { state = State.CDATA_3; i++; }
          else { state = State.DOCTYPE; i++; }
          continue;
        }
        case State.CDATA_3: { // expecting A
          if (chunk.charCodeAt(i) === 65) { state = State.CDATA_4; i++; }
          else { state = State.DOCTYPE; i++; }
          continue;
        }
        case State.CDATA_4: { // expecting T
          if (chunk.charCodeAt(i) === 84) { state = State.CDATA_5; i++; }
          else { state = State.DOCTYPE; i++; }
          continue;
        }
        case State.CDATA_5: { // expecting A
          if (chunk.charCodeAt(i) === 65) { state = State.CDATA_6; i++; }
          else { state = State.DOCTYPE; i++; }
          continue;
        }
        case State.CDATA_6: { // expecting [
          if (chunk.charCodeAt(i) === LBRACKET) { state = State.CDATA; special = ""; i++; }
          else { state = State.DOCTYPE; i++; }
          continue;
        }

        // ==================================================================
        // CDATA — batch scan for ]
        // ==================================================================
        case State.CDATA: {
          const bIdx = chunk.indexOf("]", i);
          if (bIdx === -1) {
            special += (i === 0 ? chunk : chunk.substring(i));
            i = len;
          } else {
            if (bIdx > i) special += chunk.substring(i, bIdx);
            state = State.CDATA_END1;
            i = bIdx + 1;
          }
          continue;
        }

        // ==================================================================
        // CDATA_END1
        // ==================================================================
        case State.CDATA_END1: {
          const cc = chunk.charCodeAt(i);
          if (cc === RBRACKET) {
            state = State.CDATA_END2;
            i++;
          } else {
            special += "]" + chunk[i];
            state = State.CDATA;
            i++;
          }
          continue;
        }

        // ==================================================================
        // CDATA_END2
        // ==================================================================
        case State.CDATA_END2: {
          const cc = chunk.charCodeAt(i);
          if (cc === GT) {
            if (oncdata) oncdata(special);
            special = "";
            state = State.TEXT;
            i++;
          } else if (cc === RBRACKET) {
            special += "]";
            i++;
          } else {
            special += "]]" + chunk[i];
            state = State.CDATA;
            i++;
          }
          continue;
        }

        // ==================================================================
        // PI — batch scan for ?
        // ==================================================================
        case State.PI: {
          const qIdx = chunk.indexOf("?", i);
          if (qIdx === -1) {
            special += (i === 0 ? chunk : chunk.substring(i));
            i = len;
          } else {
            if (qIdx > i) special += chunk.substring(i, qIdx);
            state = State.PI_END;
            i = qIdx + 1;
          }
          continue;
        }

        // ==================================================================
        // PI_END
        // ==================================================================
        case State.PI_END: {
          const cc = chunk.charCodeAt(i);
          if (cc === GT) {
            if (onprocessinginstruction) {
              const inner = special;
              let spaceIdx = -1;
              for (let j = 0; j < inner.length; j++) {
                const c = inner.charCodeAt(j);
                if (c === SPACE || c === TAB || c === LF || c === CR) {
                  spaceIdx = j;
                  break;
                }
              }
              if (spaceIdx === -1) {
                onprocessinginstruction(inner, "");
              } else {
                const piName = inner.substring(0, spaceIdx);
                let bs = spaceIdx + 1;
                while (bs < inner.length) {
                  const bc = inner.charCodeAt(bs);
                  if (bc !== SPACE && bc !== TAB && bc !== LF && bc !== CR) break;
                  bs++;
                }
                let be = inner.length - 1;
                while (be >= bs) {
                  const bc = inner.charCodeAt(be);
                  if (bc !== SPACE && bc !== TAB && bc !== LF && bc !== CR) break;
                  be--;
                }
                onprocessinginstruction(
                  piName,
                  bs <= be ? inner.substring(bs, be + 1) : "",
                );
              }
            }
            special = "";
            state = State.TEXT;
            i++;
          } else {
            special += "?";
            state = State.PI;
            // don't advance — re-check this char for '?' again
          }
          continue;
        }

        // ==================================================================
        // DOCTYPE
        // ==================================================================
        case State.DOCTYPE: {
          const cc = chunk.charCodeAt(i);
          if (cc === GT) {
            state = State.TEXT;
            i++;
          } else if (cc === LBRACKET) {
            state = State.DOCTYPE_BRACKET;
            i++;
          } else {
            i++;
          }
          continue;
        }

        // ==================================================================
        // DOCTYPE_BRACKET
        // ==================================================================
        case State.DOCTYPE_BRACKET: {
          const cc = chunk.charCodeAt(i);
          if (cc === RBRACKET) {
            state = State.DOCTYPE;
            i++;
          } else {
            i++;
          }
          continue;
        }

        // ==================================================================
        // RAW_TEXT — batch scan for <
        // ==================================================================
        case State.RAW_TEXT: {
          const ltIdx = chunk.indexOf("<", i);
          if (ltIdx === -1) {
            rawText += (i === 0 ? chunk : chunk.substring(i));
            i = len;
          } else {
            if (ltIdx > i) rawText += chunk.substring(i, ltIdx);
            state = State.RAW_END_1;
            i = ltIdx + 1;
          }
          continue;
        }

        // ==================================================================
        // RAW_END_1
        // ==================================================================
        case State.RAW_END_1: {
          const cc = chunk.charCodeAt(i);
          if (cc === SLASH) {
            state = State.RAW_END_2;
            rawMatchIdx = 0;
            i++;
          } else {
            rawText += "<";
            state = State.RAW_TEXT;
            // don't advance — re-process this char in RAW_TEXT
          }
          continue;
        }

        // ==================================================================
        // RAW_END_2 — matching close tag name
        // ==================================================================
        case State.RAW_END_2: {
          if (rawMatchIdx < rawTag.length) {
            if (chunk[i] === rawTag[rawMatchIdx]) {
              rawMatchIdx++;
              i++;
            } else {
              rawText += "</" + rawTag.substring(0, rawMatchIdx);
              state = State.RAW_TEXT;
              // don't advance — re-process this char
            }
          } else {
            const cc = chunk.charCodeAt(i);
            if (cc === GT) {
              if (ontext && rawText.length > 0) ontext(rawText);
              if (onclosetag) onclosetag(rawTag);
              rawText = "";
              rawTag = "";
              state = State.TEXT;
              i++;
            } else if (cc === SPACE || cc === TAB || cc === LF || cc === CR) {
              state = State.RAW_END_3;
              i++;
            } else {
              rawText += "</" + rawTag;
              state = State.RAW_TEXT;
              // don't advance
            }
          }
          continue;
        }

        // ==================================================================
        // RAW_END_3
        // ==================================================================
        case State.RAW_END_3: {
          const cc = chunk.charCodeAt(i);
          if (cc === GT) {
            if (ontext && rawText.length > 0) ontext(rawText);
            if (onclosetag) onclosetag(rawTag);
            rawText = "";
            rawTag = "";
            state = State.TEXT;
            i++;
          } else if (cc === SPACE || cc === TAB || cc === LF || cc === CR) {
            i++;
          } else {
            rawText += "</" + rawTag;
            state = State.RAW_TEXT;
            // don't advance
          }
          continue;
        }

        default:
          i++;
          continue;
      }
    }
  }

  return {
    write(chunk: string): void {
      if (chunk.length === 0) return;
      processChunk(chunk);
    },

    close(): void {
      if (state === State.TEXT) {
        emitText();
      } else if (state === State.RAW_TEXT || state === State.RAW_END_1 ||
                 state === State.RAW_END_2 || state === State.RAW_END_3) {
        if (state === State.RAW_END_1) {
          rawText += "<";
        } else if (state === State.RAW_END_2) {
          rawText += "</" + rawTag.substring(0, rawMatchIdx);
        }
        if (ontext && rawText.length > 0) ontext(rawText);
        if (onclosetag) onclosetag(rawTag);
        rawText = "";
        rawTag = "";
        state = State.TEXT;
      }
      text = "";
      tagName = "";
      attrName = "";
      attrValue = "";
      special = "";
      state = State.TEXT;
    },
  };
}
