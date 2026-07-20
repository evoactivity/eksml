/**
 * saxEngine — a high-performance, synchronous, event-based streaming XML parser.
 *
 * This is an internal module used by `createSaxParser` and `XmlParseStream`.
 * It is not part of the public API.
 *
 * Architecture: single-pass state machine with batch scanning. Each character is
 * consumed exactly once. Within a chunk, hot-path states (text, tag names,
 * attribute names/values, close tags) scan ahead with indexOf / charCodeAt loops
 * to extract tokens via a single substring() rather than per-character +=.
 */

import { setOwnProperty } from '#src/utilities/setOwnProperty.ts';

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

/** Event handlers for the SAX engine. All callbacks are optional. */
export interface SaxEngineHandlers {
  /** Fired when an opening tag and its attributes have been fully parsed. */
  onOpenTag?: (tagName: string, attributes: Attributes) => void;
  /** Fired when a closing tag is encountered. */
  onCloseTag?: (tagName: string) => void;
  /** Fired for text content between tags (trimmed; not fired for whitespace-only text). */
  onText?: (text: string) => void;
  /** Fired for CDATA sections. */
  onCdata?: (data: string) => void;
  /** Fired for comments (the full `<!-- ... -->` string). */
  onComment?: (comment: string) => void;
  /** Fired for processing instructions (`<?xml ... ?>`). */
  onProcessingInstruction?: (name: string, body: string) => void;
  /** Fired for DOCTYPE declarations (`<!DOCTYPE html>`, `<!DOCTYPE svg PUBLIC "..." "...">`). */
  onDoctype?: (tagName: string, attributes: Attributes) => void;
}

/** Options for the SAX engine. */
export interface SaxEngineOptions extends SaxEngineHandlers {
  /** Tag names that are self-closing (void). Default `[]`. */
  selfClosingTags?: string[];
  /** Tag names whose content is raw text. Default `[]`. */
  rawContentTags?: string[];
  /**
   * Maximum allowed size (in characters) for any internal buffer (text,
   * attribute values, comments, CDATA, raw text).  When a buffer exceeds
   * this limit a `RangeError` is thrown.  Default `undefined` (no limit).
   */
  maxBufferSize?: number;
}

/** The parser instance returned by `saxEngine()`. */
export interface SaxEngineParser {
  /** Feed a chunk of XML to the parser. */
  write(chunk: string): void;
  /** Signal end-of-input and flush any remaining buffered data. */
  close(): void;
  /**
   * Toggle text suppression. While suppressed, onText is not called and text
   * runs are neither trimmed nor extracted (no allocation). Intended for
   * consumers that know upcoming text will be discarded (e.g. XmlParseStream
   * outside a `select` subtree). Suppression state is read at text-emission
   * time, so toggling from within onOpenTag/onCloseTag takes effect for the
   * very next text run. When maxBufferSize is set, cross-chunk text is still
   * accumulated so the overflow guard keeps firing.
   */
  setTextSuppression(suppressed: boolean): void;
}

// ---------------------------------------------------------------------------
// Parser states
// ---------------------------------------------------------------------------
const State = {
  TEXT: 0,
  TAG_OPEN: 1,
  OPEN_TAG_NAME: 2,
  OPEN_TAG_BODY: 3,
  ATTR_NAME: 4,
  ATTR_AFTER_NAME: 5,
  ATTR_AFTER_EQ: 6,
  ATTR_VALUE_DQ: 7,
  ATTR_VALUE_SQ: 8,
  ATTR_VALUE_UQ: 9,
  CLOSE_TAG: 10,
  SELF_CLOSING: 11,
  COMMENT_1: 12,
  COMMENT: 13,
  COMMENT_END1: 14,
  COMMENT_END2: 15,
  CDATA_1: 16,
  CDATA_2: 17,
  CDATA_3: 18,
  CDATA_4: 19,
  CDATA_5: 20,
  CDATA_6: 21,
  CDATA: 22,
  CDATA_END1: 23,
  CDATA_END2: 24,
  PI: 25,
  PI_END: 26,
  DOCTYPE: 27,
  DOCTYPE_BRACKET: 28,
  BANG_START: 29,
  RAW_TEXT: 30,
  RAW_END_1: 31,
  RAW_END_2: 32,
  RAW_END_3: 33,
} as const;
type State = (typeof State)[keyof typeof State];

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function saxEngine(options: SaxEngineOptions = {}): SaxEngineParser {
  const {
    onOpenTag,
    onCloseTag,
    onText,
    onCdata,
    onComment,
    onProcessingInstruction,
    onDoctype,
    selfClosingTags = [],
    rawContentTags = [],
    maxBufferSize,
  } = options;

  const voidSet: Set<string> | null =
    selfClosingTags.length > 0 ? new Set(selfClosingTags) : null;
  // Handler elision: when nobody listens for comments, skip accumulating
  // comment text entirely (the state machine still tracks the --> terminator).
  // Accumulation is kept when maxBufferSize is set so oversized comments
  // still trigger the buffer-overflow guard in write().
  const accumulateComment =
    onComment !== undefined || maxBufferSize !== undefined;
  const rawSet: Set<string> | null =
    rawContentTags.length > 0 ? new Set(rawContentTags) : null;

  let state: State = State.TEXT;
  // See SaxEngineParser.setTextSuppression. Read at text-emission points
  // only (once per text run), so the cost to non-users is a single
  // well-predicted branch per run.
  let textSuppressed = false;
  let text = '';
  let tagName = '';
  let attributeName = '';
  let attributeValue = '';
  // Plain object so V8 shares hidden classes across attribute records and
  // the attribute store site stays monomorphic (null-prototype objects get a
  // unique dictionary-mode map each, which permanently blocks optimization
  // of this function). Pollution via dangerous attribute names is prevented
  // by setOwnProperty(), which stores `__proto__` as an own property.
  let attributes: Attributes = {};
  let special = '';
  let rawTag = '';
  let rawText = '';
  let rawCloseTagMatchIndex = 0;
  let rawCloseTagTrailing = '';

  // --- Attribute-name interning ---
  //
  // Attribute names repeat constantly (documents use a small vocabulary),
  // and every fresh attribute-name substring handed to a keyed property
  // store must be re-internalized by V8 before it can be used as a key.
  // This small direct-mapped cache returns the same string instance for
  // repeated names: repeat occurrences allocate nothing and the store
  // receives an already-internalized key. Collisions simply overwrite the
  // slot, so the table stays bounded and adapts to the current document.
  //
  // Scope is deliberate: interning is applied to attribute names only.
  // Tag names are just handler arguments (never property keys), and
  // benchmarks showed interning them is a significant net loss on
  // element-dense documents (RSS -22%, POM -24%), while attribute-name
  // interning gains 5-13% on attribute-heavy documents and is neutral on
  // attribute-light ones.
  const INTERN_SLOTS = 512; // power of two, so the mask below works
  const INTERN_MAX_LENGTH = 32; // don't cache pathological name lengths
  const internTable: (string | undefined)[] = new Array(INTERN_SLOTS);

  function intern(source: string, start: number, end: number): string {
    const length = end - start;
    if (length === 0) return '';
    if (length > INTERN_MAX_LENGTH) return source.substring(start, end);
    // Cheap fingerprint (length + first + last char) instead of a full hash:
    // the verify loop below catches collisions, so the hash only needs to
    // spread typical vocabularies across slots, not be collision-free.
    const hash =
      (length << 10) ^
      (source.charCodeAt(start) << 5) ^
      source.charCodeAt(end - 1);
    const slot = (hash ^ (hash >>> 16)) & (INTERN_SLOTS - 1);
    const cached = internTable[slot];
    if (cached !== undefined && cached.length === length) {
      let matches = true;
      for (let k = 0; k < length; k++) {
        if (cached.charCodeAt(k) !== source.charCodeAt(start + k)) {
          matches = false;
          break;
        }
      }
      if (matches) return cached;
    }
    const token = source.substring(start, end);
    internTable[slot] = token;
    return token;
  }

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
    if (onText && !textSuppressed) {
      const trimmed = trimWhitespace(text);
      if (trimmed.length > 0) onText(trimmed);
    }
    text = '';
  }

  /**
   * Parse the accumulated DOCTYPE body (everything between `<!` and `>`,
   * excluding internal DTD subsets) and emit an onDoctype event.
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
          setOwnProperty(attributes, body.substring(i + 1), null);
          break;
        }
        setOwnProperty(attributes, body.substring(i + 1, closeIndex), null);
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
      setOwnProperty(attributes, body.substring(tokenStart, i), null);
    }

    onDoctype!(tagName, attributes);
  }

  /** After we finish parsing an open tag's `>`, handle void/raw transitions. */
  function finishOpenTag(): void {
    if (onOpenTag) onOpenTag(tagName, attributes);
    if (voidSet !== null && voidSet.has(tagName)) {
      if (onCloseTag) onCloseTag(tagName);
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
    // Local aliases: register reads in the hot loop instead of context-slot
    // loads (processChunk is a fresh closure per parser, so V8 does not
    // specialize the shared optimized code to this context).
    const handleText = onText;
    const handleOpenTag = onOpenTag;
    const handleCloseTag = onCloseTag;
    let i = 0;

    while (i < chunkLength) {
      switch (state) {
        // ==================================================================
        // TEXT — straight-line fast path for the hot flow:
        // text -> '<' -> close tag | open tag (name, attrs) -> text ...
        // Falls back to the switch states only at chunk boundaries and for
        // rare constructs (comments, CDATA, PI, doctype, raw text).
        // Trimming is fused into the boundary scan so complete-in-chunk
        // tokens need exactly one substring and zero accumulator writes.
        // ==================================================================
        case State.TEXT: {
          fastPath: while (true) {
            // --- text run ---
            const lessThanIndex = chunk.indexOf('<', i);
            if (lessThanIndex === -1) {
              if (i < chunkLength) {
                text += i === 0 ? chunk : chunk.substring(i);
              }
              i = chunkLength;
              break fastPath;
            }
            if (text.length === 0) {
              if (
                handleText !== undefined &&
                lessThanIndex > i &&
                !textSuppressed
              ) {
                // Fused trim: compute trim bounds on the chunk itself, then
                // substring once. Whitespace-only runs allocate nothing.
                let s = i;
                const last = lessThanIndex - 1;
                let e = last;
                while (s <= e) {
                  const c = chunk.charCodeAt(s);
                  if (c !== SPACE && c !== TAB && c !== LF && c !== CR) break;
                  s++;
                }
                if (s <= e) {
                  while (e > s) {
                    const c = chunk.charCodeAt(e);
                    if (c !== SPACE && c !== TAB && c !== LF && c !== CR) break;
                    e--;
                  }
                  handleText(chunk.substring(s, e + 1));
                }
              }
            } else {
              text += chunk.substring(i, lessThanIndex);
              emitText();
            }
            i = lessThanIndex + 1;
            if (i >= chunkLength) {
              state = State.TAG_OPEN;
              break fastPath;
            }

            const firstCharCode = chunk.charCodeAt(i);
            if (firstCharCode === SLASH) {
              // --- close tag, complete-in-chunk (trim fused) ---
              i++;
              const gtIndex = chunk.indexOf('>', i);
              if (gtIndex === -1) {
                tagName = chunk.substring(i);
                state = State.CLOSE_TAG;
                i = chunkLength;
                break fastPath;
              }
              if (handleCloseTag !== undefined) {
                let s = i;
                let e = gtIndex - 1;
                while (s <= e) {
                  const c = chunk.charCodeAt(s);
                  if (c !== SPACE && c !== TAB && c !== LF && c !== CR) break;
                  s++;
                }
                while (e >= s) {
                  const c = chunk.charCodeAt(e);
                  if (c !== SPACE && c !== TAB && c !== LF && c !== CR) break;
                  e--;
                }
                handleCloseTag(s <= e ? chunk.substring(s, e + 1) : '');
              }
              i = gtIndex + 1;
              continue fastPath;
            }
            if (firstCharCode === BANG) {
              special = '';
              state = State.BANG_START;
              i++;
              break fastPath;
            }
            if (firstCharCode === QUESTION) {
              special = '';
              state = State.PI;
              i++;
              break fastPath;
            }

            // --- open tag: name scan ---
            let j = i;
            while (j < chunkLength) {
              const c = chunk.charCodeAt(j);
              if (
                c === GT ||
                c === SLASH ||
                c === EQ ||
                c === SPACE ||
                c === TAB ||
                c === LF ||
                c === CR
              )
                break;
              j++;
            }
            if (j >= chunkLength) {
              tagName = chunk.substring(i);
              attributes = {};
              state = State.OPEN_TAG_NAME;
              i = chunkLength;
              break fastPath;
            }
            const name = chunk.substring(i, j);
            const attrs: Attributes | null =
              handleOpenTag !== undefined ? ({} as Attributes) : null;
            let selfClosed = false;
            let c = chunk.charCodeAt(j);

            emitTag: {
              if (c === GT) {
                i = j + 1;
                break emitTag;
              }
              // '/' is left unconsumed so the body loop's slash branch
              // handles the self-closing check; other terminators (ws, '=')
              // are consumed, matching OPEN_TAG_NAME -> OPEN_TAG_BODY.
              i = c === SLASH ? j : j + 1;

              body: while (true) {
                if (i >= chunkLength) {
                  tagName = name;
                  attributes = attrs !== null ? attrs : ({} as Attributes);
                  state = State.OPEN_TAG_BODY;
                  break fastPath;
                }
                c = chunk.charCodeAt(i);
                if (c === SPACE || c === TAB || c === LF || c === CR) {
                  i++;
                  continue body;
                }
                if (c === GT) {
                  i++;
                  break emitTag;
                }
                if (c === SLASH) {
                  i++;
                  if (i >= chunkLength) {
                    tagName = name;
                    attributes = attrs !== null ? attrs : ({} as Attributes);
                    state = State.SELF_CLOSING;
                    break fastPath;
                  }
                  if (chunk.charCodeAt(i) === GT) {
                    i++;
                    selfClosed = true;
                    break emitTag;
                  }
                  // not '>': re-process this char as tag body
                  continue body;
                }

                // --- attribute name ---
                let k = i;
                while (k < chunkLength) {
                  const cc = chunk.charCodeAt(k);
                  if (
                    cc === EQ ||
                    cc === GT ||
                    cc === SLASH ||
                    cc === SPACE ||
                    cc === TAB ||
                    cc === LF ||
                    cc === CR
                  )
                    break;
                  k++;
                }
                if (k >= chunkLength) {
                  tagName = name;
                  attributes = attrs !== null ? attrs : ({} as Attributes);
                  attributeName = chunk.substring(i);
                  state = State.ATTR_NAME;
                  i = chunkLength;
                  break fastPath;
                }
                const attrName = intern(chunk, i, k);
                c = chunk.charCodeAt(k);
                i = k + 1;
                if (c !== EQ) {
                  if (c === GT) {
                    if (attrs !== null) setOwnProperty(attrs, attrName, null);
                    break emitTag;
                  }
                  if (c === SLASH) {
                    if (attrs !== null) setOwnProperty(attrs, attrName, null);
                    i = k; // body's slash branch re-handles it
                    continue body;
                  }
                  // whitespace after name — skip, then check for '='
                  while (i < chunkLength) {
                    const cc = chunk.charCodeAt(i);
                    if (cc !== SPACE && cc !== TAB && cc !== LF && cc !== CR)
                      break;
                    i++;
                  }
                  if (i >= chunkLength) {
                    tagName = name;
                    attributes = attrs !== null ? attrs : ({} as Attributes);
                    attributeName = attrName;
                    state = State.ATTR_AFTER_NAME;
                    break fastPath;
                  }
                  const cc = chunk.charCodeAt(i);
                  if (cc !== EQ) {
                    // boolean attribute; '>' ends tag, '/' or a new attr
                    // name is re-processed by the body loop
                    if (attrs !== null) setOwnProperty(attrs, attrName, null);
                    if (cc === GT) {
                      i++;
                      break emitTag;
                    }
                    continue body;
                  }
                  i++;
                }

                // --- after '=': skip whitespace, then the value ---
                while (i < chunkLength) {
                  const cc = chunk.charCodeAt(i);
                  if (cc !== SPACE && cc !== TAB && cc !== LF && cc !== CR)
                    break;
                  i++;
                }
                if (i >= chunkLength) {
                  tagName = name;
                  attributes = attrs !== null ? attrs : ({} as Attributes);
                  attributeName = attrName;
                  state = State.ATTR_AFTER_EQ;
                  break fastPath;
                }
                c = chunk.charCodeAt(i);
                if (c === DQUOTE || c === SQUOTE) {
                  const quoteIndex = chunk.indexOf(
                    c === DQUOTE ? '"' : "'",
                    i + 1,
                  );
                  if (quoteIndex === -1) {
                    tagName = name;
                    attributes = attrs !== null ? attrs : ({} as Attributes);
                    attributeName = attrName;
                    attributeValue = chunk.substring(i + 1);
                    state =
                      c === DQUOTE ? State.ATTR_VALUE_DQ : State.ATTR_VALUE_SQ;
                    i = chunkLength;
                    break fastPath;
                  }
                  const value = chunk.substring(i + 1, quoteIndex);
                  // Mirror the baseline's stale attributeValue so the
                  // maxBufferSize check in write() behaves identically.
                  if (maxBufferSize !== undefined) attributeValue = value;
                  if (attrs !== null) setOwnProperty(attrs, attrName, value);
                  i = quoteIndex + 1;
                  continue body;
                }
                if (c === GT) {
                  if (attrs !== null) setOwnProperty(attrs, attrName, '');
                  i++;
                  break emitTag;
                }
                // unquoted value
                let m = i;
                while (m < chunkLength) {
                  const cc = chunk.charCodeAt(m);
                  if (
                    cc === SPACE ||
                    cc === TAB ||
                    cc === LF ||
                    cc === CR ||
                    cc === GT ||
                    cc === SLASH
                  )
                    break;
                  m++;
                }
                if (m >= chunkLength) {
                  tagName = name;
                  attributes = attrs !== null ? attrs : ({} as Attributes);
                  attributeName = attrName;
                  attributeValue = chunk.substring(i);
                  state = State.ATTR_VALUE_UQ;
                  i = chunkLength;
                  break fastPath;
                }
                const value = chunk.substring(i, m);
                if (maxBufferSize !== undefined) attributeValue = value;
                if (attrs !== null) setOwnProperty(attrs, attrName, value);
                c = chunk.charCodeAt(m);
                if (c === GT) {
                  i = m + 1;
                  break emitTag;
                }
                // '/' left unconsumed for the body loop's slash branch
                i = c === SLASH ? m : m + 1;
                continue body;
              }
            }

            // --- emit open tag ---
            if (handleOpenTag !== undefined) handleOpenTag(name, attrs!);
            if (selfClosed) {
              if (handleCloseTag !== undefined) handleCloseTag(name);
              continue fastPath;
            }
            if (voidSet !== null && voidSet.has(name)) {
              if (handleCloseTag !== undefined) handleCloseTag(name);
            } else if (rawSet !== null && rawSet.has(name)) {
              rawTag = name;
              rawText = '';
              rawCloseTagMatchIndex = 0;
              state = State.RAW_TEXT;
              break fastPath;
            }
            continue fastPath;
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
          let j = i;
          while (j < chunkLength) {
            const charCode = chunk.charCodeAt(j);
            if (isNameEnd(charCode)) break;
            j++;
          }
          if (j > i) tagName += chunk.substring(i, j);
          if (j >= chunkLength) {
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
            setOwnProperty(attributes, attributeName, null);
            state = State.TEXT;
            i = j + 1;
            finishOpenTag();
          } else if (charCode === SLASH) {
            setOwnProperty(attributes, attributeName, null);
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
            setOwnProperty(attributes, attributeName, null);
            state = State.TEXT;
            i++;
            finishOpenTag();
          } else if (charCode === SLASH) {
            setOwnProperty(attributes, attributeName, null);
            state = State.SELF_CLOSING;
            i++;
          } else {
            // New attribute — boolean (no value)
            setOwnProperty(attributes, attributeName, null);
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
            setOwnProperty(attributes, attributeName, '');
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
            setOwnProperty(attributes, attributeName, attributeValue);
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
            setOwnProperty(attributes, attributeName, attributeValue);
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
          setOwnProperty(attributes, attributeName, attributeValue);
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
            if (onCloseTag) onCloseTag(trimWhitespace(tagName));
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
            if (onOpenTag) onOpenTag(tagName, attributes);
            if (onCloseTag) onCloseTag(tagName);
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
            if (accumulateComment)
              special += i === 0 ? chunk : chunk.substring(i);
            i = chunkLength;
          } else {
            if (accumulateComment) {
              if (dashIndex > i) special += chunk.substring(i, dashIndex);
              special += '-';
            }
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
            if (accumulateComment) special += '-';
            i++;
          } else {
            state = State.COMMENT;
            if (accumulateComment) special += chunk[i];
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
            if (onComment) onComment(special + '>');
            special = '';
            state = State.TEXT;
            i++;
          } else if (charCode === DASH) {
            if (accumulateComment) special += '-';
            i++;
          } else {
            state = State.COMMENT;
            if (accumulateComment) special += chunk[i];
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
            if (onCdata) onCdata(special);
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
            if (onProcessingInstruction) {
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
                onProcessingInstruction(inner, '');
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
                onProcessingInstruction(
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
            if (onDoctype) {
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
              if (onText && !textSuppressed && rawText.length > 0)
                onText(rawText);
              if (onCloseTag) onCloseTag(rawTag);
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
              rawCloseTagTrailing = chunk[i]!;
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
            if (onText && !textSuppressed && rawText.length > 0)
              onText(rawText);
            if (onCloseTag) onCloseTag(rawTag);
            rawText = '';
            rawTag = '';
            rawCloseTagTrailing = '';
            state = State.TEXT;
            i++;
          } else if (
            charCode === SPACE ||
            charCode === TAB ||
            charCode === LF ||
            charCode === CR
          ) {
            rawCloseTagTrailing += chunk[i];
            i++;
          } else {
            rawText += '</' + rawTag + rawCloseTagTrailing;
            rawCloseTagTrailing = '';
            state = State.RAW_TEXT;
            // don't advance
          }
          continue;
        }

        /* v8 ignore start — safety fallback for unhandled state values */
        default:
          i++;
          continue;
        /* v8 ignore stop */
      }
    }
  }

  return {
    setTextSuppression(suppressed: boolean): void {
      textSuppressed = suppressed;
    },

    write(chunk: string): void {
      if (chunk.length === 0) return;
      processChunk(chunk);
      if (
        maxBufferSize !== undefined &&
        (text.length > maxBufferSize ||
          attributeValue.length > maxBufferSize ||
          special.length > maxBufferSize ||
          rawText.length > maxBufferSize)
      ) {
        const buf =
          text.length > maxBufferSize
            ? 'text'
            : attributeValue.length > maxBufferSize
              ? 'attribute value'
              : special.length > maxBufferSize
                ? 'special'
                : 'raw text';
        throw new RangeError(
          `Buffer overflow: ${buf} buffer exceeded maxBufferSize (${maxBufferSize})`,
        );
      }
    },

    close(): void {
      if (state === State.TEXT) {
        emitText();
      } else if (state === State.RAW_END_3) {
        // Full tag name matched + trailing whitespace — treat as valid close
        if (onText && !textSuppressed && rawText.length > 0) onText(rawText);
        if (onCloseTag) onCloseTag(rawTag);
        rawText = '';
        rawTag = '';
        rawCloseTagTrailing = '';
        state = State.TEXT;
      } else if (
        state === State.RAW_TEXT ||
        state === State.RAW_END_1 ||
        state === State.RAW_END_2
      ) {
        if (state === State.RAW_END_1) {
          rawText += '<';
        } else if (state === State.RAW_END_2) {
          rawText += '</' + rawTag.substring(0, rawCloseTagMatchIndex);
        }
        if (onText && !textSuppressed && rawText.length > 0) onText(rawText);
        if (onCloseTag) onCloseTag(rawTag);
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
