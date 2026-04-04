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

// @generated:char-codes:begin
const GT = 62; // >
const SLASH = 47; // /
const BANG = 33; // !
const QUESTION = 63; // ?
const EQ = 61; // =
const LBRACKET = 91; // [
const RBRACKET = 93; // ]
const SQUOTE = 39; // '
const DQUOTE = 34; // "
const TAB = 9; // \t
const LF = 10; // \n
const CR = 13; // \r
const SPACE = 32; // (space)
const DASH = 45; // -
const UPPER_C = 67; // C
const UPPER_D = 68; // D
const UPPER_A = 65; // A
const UPPER_T = 84; // T
// @generated:char-codes:end

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
  /** Fired for DOCTYPE declarations (`<!DOCTYPE html>`, `<!DOCTYPE svg PUBLIC "..." "...">`). */
  ondoctype?: (tagName: string, attributes: Attributes) => void;
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
    ondoctype,
    selfClosingTags = [],
    rawContentTags = [],
  } = options;

  const voidSet: Set<string> | null =
    selfClosingTags.length > 0 ? new Set(selfClosingTags) : null;
  const rawSet: Set<string> | null =
    rawContentTags.length > 0 ? new Set(rawContentTags) : null;

  let state: State = State.TEXT;
  let text = '';
  let tagName = '';
  let attributeName = '';
  let attributeValue = '';
  let attributes: Attributes = {};
  let special = '';
  let rawTag = '';
  let rawText = '';
  let rawCloseTagMatchIndex = 0;

  // --- Emit helpers ---

  function trimWhitespace(input: string): string {
    let startIndex = 0;
    let endIndex = input.length - 1;
    while (startIndex <= endIndex) {
      const charCode = input.charCodeAt(startIndex);
      if (
        charCode !== SPACE &&
        charCode !== TAB &&
        charCode !== LF &&
        charCode !== CR
      )
        break;
      startIndex++;
    }
    while (endIndex >= startIndex) {
      const charCode = input.charCodeAt(endIndex);
      if (
        charCode !== SPACE &&
        charCode !== TAB &&
        charCode !== LF &&
        charCode !== CR
      )
        break;
      endIndex--;
    }
    return startIndex === 0 && endIndex === input.length - 1
      ? input
      : input.substring(startIndex, endIndex + 1);
  }

  function emitText(): void {
    if (text.length === 0) return;
    if (ontext) {
      const trimmed = trimWhitespace(text);
      if (trimmed.length > 0) ontext(trimmed);
    }
    text = '';
  }

  /**
   * Parse the accumulated DOCTYPE body (everything between `<!` and `>`,
   * excluding internal DTD subsets) and emit an ondoctype event.
   *
   * The body string starts with the declaration keyword (e.g. "DOCTYPE html ...")
   * after the `!`. We prepend `!` to form the tagName (e.g. "!DOCTYPE"), then
   * parse the remaining space-separated tokens as null-valued attributes.
   * Quoted strings are unquoted and stored as attribute keys.
   */
  function emitDoctype(body: string): void {
    const bodyLength = body.length;
    let i = 0;

    // Read the declaration keyword (e.g. "DOCTYPE")
    while (i < bodyLength) {
      const charCode = body.charCodeAt(i);
      if (
        charCode === SPACE ||
        charCode === TAB ||
        charCode === LF ||
        charCode === CR
      )
        break;
      i++;
    }
    const tagName = '!' + body.substring(0, i);

    // Parse space-separated tokens as null-valued attributes
    const attributes: Attributes = {};
    while (i < bodyLength) {
      const charCode = body.charCodeAt(i);
      // Skip whitespace
      if (
        charCode === SPACE ||
        charCode === TAB ||
        charCode === LF ||
        charCode === CR
      ) {
        i++;
        continue;
      }
      // Quoted token — capture content without quotes as the key
      if (charCode === DQUOTE || charCode === SQUOTE) {
        const quoteChar = charCode === DQUOTE ? '"' : "'";
        const closeIndex = body.indexOf(quoteChar, i + 1);
        if (closeIndex === -1) {
          // Unclosed quote — take rest as token
          attributes[body.substring(i + 1)] = null;
          break;
        }
        attributes[body.substring(i + 1, closeIndex)] = null;
        i = closeIndex + 1;
        continue;
      }
      // Unquoted token — scan until whitespace
      const tokenStart = i;
      while (i < bodyLength) {
        const tokenCharCode = body.charCodeAt(i);
        if (
          tokenCharCode === SPACE ||
          tokenCharCode === TAB ||
          tokenCharCode === LF ||
          tokenCharCode === CR
        )
          break;
        i++;
      }
      attributes[body.substring(tokenStart, i)] = null;
    }

    ondoctype!(tagName, attributes);
  }

  /** After we finish parsing an open tag's `>`, handle void/raw transitions. */
  function finishOpenTag(): void {
    if (onopentag) onopentag(tagName, attributes);
    if (voidSet !== null && voidSet.has(tagName)) {
      if (onclosetag) onclosetag(tagName);
    } else if (rawSet !== null && rawSet.has(tagName)) {
      rawTag = tagName;
      rawText = '';
      rawCloseTagMatchIndex = 0;
      state = State.RAW_TEXT;
    }
  }

  // --- Inline scan helpers ---
  // These scan ahead within a chunk and return the end index.
  // If the token isn't complete in this chunk, they return -1.

  /**
   * Returns true if `charCode` is a tag-name-ending character:
   * `>`, `/`, `=`, or whitespace.
   */
  function isNameEnd(charCode: number): boolean {
    return (
      charCode === GT ||
      charCode === SLASH ||
      charCode === EQ ||
      charCode === SPACE ||
      charCode === TAB ||
      charCode === LF ||
      charCode === CR
    );
  }

  function processChunk(chunk: string): void {
    const chunkLength = chunk.length;
    let i = 0;

    while (i < chunkLength) {
      switch (state) {
        // ==================================================================
        // TEXT
        // ==================================================================
        case State.TEXT: {
          const lessThanIndex = chunk.indexOf('<', i);
          if (lessThanIndex === -1) {
            text += i === 0 ? chunk : chunk.substring(i);
            i = chunkLength;
          } else {
            if (lessThanIndex > i) text += chunk.substring(i, lessThanIndex);
            emitText();
            state = State.TAG_OPEN;
            i = lessThanIndex + 1;
          }
          continue;
        }

        // ==================================================================
        // TAG_OPEN
        // ==================================================================
        case State.TAG_OPEN: {
          const charCode = chunk.charCodeAt(i);
          if (charCode === SLASH) {
            state = State.CLOSE_TAG;
            tagName = '';
            i++;
          } else if (charCode === BANG) {
            state = State.BANG_START;
            special = '';
            i++;
          } else if (charCode === QUESTION) {
            state = State.PI;
            special = '';
            i++;
          } else {
            state = State.OPEN_TAG_NAME;
            tagName = '';
            attributes = {};
          }
          continue;
        }

        // ==================================================================
        // OPEN_TAG_NAME — batch scan for end of name
        // ==================================================================
        case State.OPEN_TAG_NAME: {
          // Scan ahead for end of tag name
          let j = i;
          while (j < chunkLength) {
            const charCode = chunk.charCodeAt(j);
            if (isNameEnd(charCode)) break;
            j++;
          }
          // Accumulate what we scanned
          if (j > i) tagName += chunk.substring(i, j);
          if (j >= chunkLength) {
            // Tag name continues in next chunk
            i = chunkLength;
            continue;
          }
          // We hit a terminator
          const charCode = chunk.charCodeAt(j);
          if (charCode === GT) {
            state = State.TEXT;
            i = j + 1;
            finishOpenTag();
          } else if (charCode === SLASH) {
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
          const charCode = chunk.charCodeAt(i);
          if (charCode === GT) {
            state = State.TEXT;
            i++;
            finishOpenTag();
          } else if (charCode === SLASH) {
            state = State.SELF_CLOSING;
            i++;
          } else if (
            charCode === SPACE ||
            charCode === TAB ||
            charCode === LF ||
            charCode === CR
          ) {
            i++;
          } else {
            state = State.ATTR_NAME;
            attributeName = '';
            // don't advance — first char of attr name
          }
          continue;
        }

        // ==================================================================
        // ATTR_NAME — batch scan for end of attr name
        // ==================================================================
        case State.ATTR_NAME: {
          let j = i;
          while (j < chunkLength) {
            const charCode = chunk.charCodeAt(j);
            if (
              charCode === EQ ||
              charCode === GT ||
              charCode === SLASH ||
              charCode === SPACE ||
              charCode === TAB ||
              charCode === LF ||
              charCode === CR
            )
              break;
            j++;
          }
          if (j > i) attributeName += chunk.substring(i, j);
          if (j >= chunkLength) {
            i = chunkLength;
            continue;
          }

          const charCode = chunk.charCodeAt(j);
          if (charCode === EQ) {
            state = State.ATTR_AFTER_EQ;
            i = j + 1;
          } else if (charCode === GT) {
            attributes[attributeName] = null;
            state = State.TEXT;
            i = j + 1;
            finishOpenTag();
          } else if (charCode === SLASH) {
            attributes[attributeName] = null;
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
          const charCode = chunk.charCodeAt(i);
          if (charCode === EQ) {
            state = State.ATTR_AFTER_EQ;
            i++;
          } else if (
            charCode === SPACE ||
            charCode === TAB ||
            charCode === LF ||
            charCode === CR
          ) {
            i++;
          } else if (charCode === GT) {
            attributes[attributeName] = null;
            state = State.TEXT;
            i++;
            finishOpenTag();
          } else if (charCode === SLASH) {
            attributes[attributeName] = null;
            state = State.SELF_CLOSING;
            i++;
          } else {
            // New attribute — boolean (no value)
            attributes[attributeName] = null;
            state = State.ATTR_NAME;
            attributeName = '';
          }
          continue;
        }

        // ==================================================================
        // ATTR_AFTER_EQ
        // ==================================================================
        case State.ATTR_AFTER_EQ: {
          const charCode = chunk.charCodeAt(i);
          if (charCode === DQUOTE) {
            state = State.ATTR_VALUE_DQ;
            attributeValue = '';
            i++;
          } else if (charCode === SQUOTE) {
            state = State.ATTR_VALUE_SQ;
            attributeValue = '';
            i++;
          } else if (
            charCode === SPACE ||
            charCode === TAB ||
            charCode === LF ||
            charCode === CR
          ) {
            i++;
          } else if (charCode === GT) {
            attributes[attributeName] = '';
            state = State.TEXT;
            i++;
            finishOpenTag();
          } else {
            state = State.ATTR_VALUE_UQ;
            attributeValue = '';
            // don't advance — first char of value
          }
          continue;
        }

        // ==================================================================
        // ATTR_VALUE_DQ — batch scan for closing "
        // ==================================================================
        case State.ATTR_VALUE_DQ: {
          const quoteIndex = chunk.indexOf('"', i);
          if (quoteIndex === -1) {
            attributeValue += i === 0 ? chunk : chunk.substring(i);
            i = chunkLength;
          } else {
            if (quoteIndex > i)
              attributeValue += chunk.substring(i, quoteIndex);
            attributes[attributeName] = attributeValue;
            state = State.OPEN_TAG_BODY;
            i = quoteIndex + 1;
          }
          continue;
        }

        // ==================================================================
        // ATTR_VALUE_SQ — batch scan for closing '
        // ==================================================================
        case State.ATTR_VALUE_SQ: {
          const quoteIndex = chunk.indexOf("'", i);
          if (quoteIndex === -1) {
            attributeValue += i === 0 ? chunk : chunk.substring(i);
            i = chunkLength;
          } else {
            if (quoteIndex > i)
              attributeValue += chunk.substring(i, quoteIndex);
            attributes[attributeName] = attributeValue;
            state = State.OPEN_TAG_BODY;
            i = quoteIndex + 1;
          }
          continue;
        }

        // ==================================================================
        // ATTR_VALUE_UQ — batch scan for end of unquoted value
        // ==================================================================
        case State.ATTR_VALUE_UQ: {
          let j = i;
          while (j < chunkLength) {
            const charCode = chunk.charCodeAt(j);
            if (
              charCode === SPACE ||
              charCode === TAB ||
              charCode === LF ||
              charCode === CR ||
              charCode === GT ||
              charCode === SLASH
            )
              break;
            j++;
          }
          if (j > i) attributeValue += chunk.substring(i, j);
          if (j >= chunkLength) {
            i = chunkLength;
            continue;
          }

          const charCode = chunk.charCodeAt(j);
          attributes[attributeName] = attributeValue;
          if (charCode === GT) {
            state = State.TEXT;
            i = j + 1;
            finishOpenTag();
          } else if (charCode === SLASH) {
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
          const greaterThanIndex = chunk.indexOf('>', i);
          if (greaterThanIndex === -1) {
            tagName += i === 0 ? chunk : chunk.substring(i);
            i = chunkLength;
          } else {
            if (greaterThanIndex > i)
              tagName += chunk.substring(i, greaterThanIndex);
            if (onclosetag) onclosetag(trimWhitespace(tagName));
            state = State.TEXT;
            i = greaterThanIndex + 1;
          }
          continue;
        }

        // ==================================================================
        // SELF_CLOSING
        // ==================================================================
        case State.SELF_CLOSING: {
          const charCode = chunk.charCodeAt(i);
          if (charCode === GT) {
            state = State.TEXT;
            i++;
            if (onopentag) onopentag(tagName, attributes);
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
          const charCode = chunk.charCodeAt(i);
          if (charCode === DASH) {
            state = State.COMMENT_1;
            special = '<!-';
            i++;
          } else if (charCode === LBRACKET) {
            state = State.CDATA_1;
            i++;
          } else {
            state = State.DOCTYPE;
            special = '';
            // don't advance — first char of declaration body
          }
          continue;
        }

        // ==================================================================
        // COMMENT_1
        // ==================================================================
        case State.COMMENT_1: {
          const charCode = chunk.charCodeAt(i);
          if (charCode === DASH) {
            state = State.COMMENT;
            special = '<!--';
            i++;
          } else {
            // Not a comment (malformed <!-X...>) — fall through to DOCTYPE.
            // We've consumed "<!-"; the body after "<!" is "-" plus remainder.
            special = '-';
            state = State.DOCTYPE;
            // don't advance — current char is part of the body
          }
          continue;
        }

        // ==================================================================
        // COMMENT — batch scan for -->
        // ==================================================================
        case State.COMMENT: {
          // Batch: scan for '-' which might start '-->'
          const dashIndex = chunk.indexOf('-', i);
          if (dashIndex === -1) {
            special += i === 0 ? chunk : chunk.substring(i);
            i = chunkLength;
          } else {
            if (dashIndex > i) special += chunk.substring(i, dashIndex);
            special += '-';
            state = State.COMMENT_END1;
            i = dashIndex + 1;
          }
          continue;
        }

        // ==================================================================
        // COMMENT_END1
        // ==================================================================
        case State.COMMENT_END1: {
          const charCode = chunk.charCodeAt(i);
          if (charCode === DASH) {
            state = State.COMMENT_END2;
            special += '-';
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
          const charCode = chunk.charCodeAt(i);
          if (charCode === GT) {
            special += '>';
            if (oncomment) oncomment(special);
            special = '';
            state = State.TEXT;
            i++;
          } else if (charCode === DASH) {
            special += '-';
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
        // These match the sequence <![CDATA[ char by char. On mismatch,
        // fall through to DOCTYPE with the consumed prefix in `special`.
        // ==================================================================
        case State.CDATA_1: {
          // expecting C after <![
          if (chunk.charCodeAt(i) === UPPER_C) {
            state = State.CDATA_2;
            i++;
          } else {
            special = '[';
            state = State.DOCTYPE;
          }
          continue;
        }
        case State.CDATA_2: {
          // expecting D
          if (chunk.charCodeAt(i) === UPPER_D) {
            state = State.CDATA_3;
            i++;
          } else {
            special = '[C';
            state = State.DOCTYPE;
          }
          continue;
        }
        case State.CDATA_3: {
          // expecting A
          if (chunk.charCodeAt(i) === UPPER_A) {
            state = State.CDATA_4;
            i++;
          } else {
            special = '[CD';
            state = State.DOCTYPE;
          }
          continue;
        }
        case State.CDATA_4: {
          // expecting T
          if (chunk.charCodeAt(i) === UPPER_T) {
            state = State.CDATA_5;
            i++;
          } else {
            special = '[CDA';
            state = State.DOCTYPE;
          }
          continue;
        }
        case State.CDATA_5: {
          // expecting A
          if (chunk.charCodeAt(i) === UPPER_A) {
            state = State.CDATA_6;
            i++;
          } else {
            special = '[CDAT';
            state = State.DOCTYPE;
          }
          continue;
        }
        case State.CDATA_6: {
          // expecting [
          if (chunk.charCodeAt(i) === LBRACKET) {
            state = State.CDATA;
            special = '';
            i++;
          } else {
            special = '[CDATA';
            state = State.DOCTYPE;
          }
          continue;
        }

        // ==================================================================
        // CDATA — batch scan for ]
        // ==================================================================
        case State.CDATA: {
          const bracketIndex = chunk.indexOf(']', i);
          if (bracketIndex === -1) {
            special += i === 0 ? chunk : chunk.substring(i);
            i = chunkLength;
          } else {
            if (bracketIndex > i) special += chunk.substring(i, bracketIndex);
            state = State.CDATA_END1;
            i = bracketIndex + 1;
          }
          continue;
        }

        // ==================================================================
        // CDATA_END1
        // ==================================================================
        case State.CDATA_END1: {
          const charCode = chunk.charCodeAt(i);
          if (charCode === RBRACKET) {
            state = State.CDATA_END2;
            i++;
          } else {
            special += ']' + chunk[i];
            state = State.CDATA;
            i++;
          }
          continue;
        }

        // ==================================================================
        // CDATA_END2
        // ==================================================================
        case State.CDATA_END2: {
          const charCode = chunk.charCodeAt(i);
          if (charCode === GT) {
            if (oncdata) oncdata(special);
            special = '';
            state = State.TEXT;
            i++;
          } else if (charCode === RBRACKET) {
            special += ']';
            i++;
          } else {
            special += ']]' + chunk[i];
            state = State.CDATA;
            i++;
          }
          continue;
        }

        // ==================================================================
        // PI — batch scan for ?
        // ==================================================================
        case State.PI: {
          const questionMarkIndex = chunk.indexOf('?', i);
          if (questionMarkIndex === -1) {
            special += i === 0 ? chunk : chunk.substring(i);
            i = chunkLength;
          } else {
            if (questionMarkIndex > i)
              special += chunk.substring(i, questionMarkIndex);
            state = State.PI_END;
            i = questionMarkIndex + 1;
          }
          continue;
        }

        // ==================================================================
        // PI_END
        // ==================================================================
        case State.PI_END: {
          const charCode = chunk.charCodeAt(i);
          if (charCode === GT) {
            if (onprocessinginstruction) {
              const inner = special;
              let whitespaceIndex = -1;
              for (let j = 0; j < inner.length; j++) {
                const innerCharCode = inner.charCodeAt(j);
                if (
                  innerCharCode === SPACE ||
                  innerCharCode === TAB ||
                  innerCharCode === LF ||
                  innerCharCode === CR
                ) {
                  whitespaceIndex = j;
                  break;
                }
              }
              if (whitespaceIndex === -1) {
                onprocessinginstruction(inner, '');
              } else {
                const instructionName = inner.substring(0, whitespaceIndex);
                let bodyStartIndex = whitespaceIndex + 1;
                while (bodyStartIndex < inner.length) {
                  const bodyCharCode = inner.charCodeAt(bodyStartIndex);
                  if (
                    bodyCharCode !== SPACE &&
                    bodyCharCode !== TAB &&
                    bodyCharCode !== LF &&
                    bodyCharCode !== CR
                  )
                    break;
                  bodyStartIndex++;
                }
                let bodyEndIndex = inner.length - 1;
                while (bodyEndIndex >= bodyStartIndex) {
                  const bodyCharCode = inner.charCodeAt(bodyEndIndex);
                  if (
                    bodyCharCode !== SPACE &&
                    bodyCharCode !== TAB &&
                    bodyCharCode !== LF &&
                    bodyCharCode !== CR
                  )
                    break;
                  bodyEndIndex--;
                }
                onprocessinginstruction(
                  instructionName,
                  bodyStartIndex <= bodyEndIndex
                    ? inner.substring(bodyStartIndex, bodyEndIndex + 1)
                    : '',
                );
              }
            }
            special = '';
            state = State.TEXT;
            i++;
          } else {
            special += '?';
            state = State.PI;
            // don't advance — re-check this char for '?' again
          }
          continue;
        }

        // ==================================================================
        // DOCTYPE — accumulate body, parse tokens on >
        // ==================================================================
        case State.DOCTYPE: {
          const charCode = chunk.charCodeAt(i);
          if (charCode === GT) {
            if (ondoctype) {
              emitDoctype(special);
            }
            special = '';
            state = State.TEXT;
            i++;
          } else if (charCode === LBRACKET) {
            state = State.DOCTYPE_BRACKET;
            i++;
          } else {
            // Batch scan: find the next > or [ to avoid per-char accumulation
            let j = i;
            while (j < chunkLength) {
              const scanCharCode = chunk.charCodeAt(j);
              if (scanCharCode === GT || scanCharCode === LBRACKET) break;
              j++;
            }
            special += chunk.substring(i, j);
            i = j;
            // If j < chunkLength, the next iteration will handle > or [
          }
          continue;
        }

        // ==================================================================
        // DOCTYPE_BRACKET
        // ==================================================================
        case State.DOCTYPE_BRACKET: {
          const charCode = chunk.charCodeAt(i);
          if (charCode === RBRACKET) {
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
          const lessThanIndex = chunk.indexOf('<', i);
          if (lessThanIndex === -1) {
            rawText += i === 0 ? chunk : chunk.substring(i);
            i = chunkLength;
          } else {
            if (lessThanIndex > i) rawText += chunk.substring(i, lessThanIndex);
            state = State.RAW_END_1;
            i = lessThanIndex + 1;
          }
          continue;
        }

        // ==================================================================
        // RAW_END_1
        // ==================================================================
        case State.RAW_END_1: {
          const charCode = chunk.charCodeAt(i);
          if (charCode === SLASH) {
            state = State.RAW_END_2;
            rawCloseTagMatchIndex = 0;
            i++;
          } else {
            rawText += '<';
            state = State.RAW_TEXT;
            // don't advance — re-process this char in RAW_TEXT
          }
          continue;
        }

        // ==================================================================
        // RAW_END_2 — matching close tag name
        // ==================================================================
        case State.RAW_END_2: {
          if (rawCloseTagMatchIndex < rawTag.length) {
            if (chunk[i] === rawTag[rawCloseTagMatchIndex]) {
              rawCloseTagMatchIndex++;
              i++;
            } else {
              rawText += '</' + rawTag.substring(0, rawCloseTagMatchIndex);
              state = State.RAW_TEXT;
              // don't advance — re-process this char
            }
          } else {
            const charCode = chunk.charCodeAt(i);
            if (charCode === GT) {
              if (ontext && rawText.length > 0) ontext(rawText);
              if (onclosetag) onclosetag(rawTag);
              rawText = '';
              rawTag = '';
              state = State.TEXT;
              i++;
            } else if (
              charCode === SPACE ||
              charCode === TAB ||
              charCode === LF ||
              charCode === CR
            ) {
              state = State.RAW_END_3;
              i++;
            } else {
              rawText += '</' + rawTag;
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
          const charCode = chunk.charCodeAt(i);
          if (charCode === GT) {
            if (ontext && rawText.length > 0) ontext(rawText);
            if (onclosetag) onclosetag(rawTag);
            rawText = '';
            rawTag = '';
            state = State.TEXT;
            i++;
          } else if (
            charCode === SPACE ||
            charCode === TAB ||
            charCode === LF ||
            charCode === CR
          ) {
            i++;
          } else {
            rawText += '</' + rawTag;
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
      } else if (
        state === State.RAW_TEXT ||
        state === State.RAW_END_1 ||
        state === State.RAW_END_2 ||
        state === State.RAW_END_3
      ) {
        if (state === State.RAW_END_1) {
          rawText += '<';
        } else if (state === State.RAW_END_2) {
          rawText += '</' + rawTag.substring(0, rawCloseTagMatchIndex);
        }
        if (ontext && rawText.length > 0) ontext(rawText);
        if (onclosetag) onclosetag(rawTag);
        rawText = '';
        rawTag = '';
        state = State.TEXT;
      }
      text = '';
      tagName = '';
      attributeName = '';
      attributeValue = '';
      special = '';
      state = State.TEXT;
    },
  };
}
