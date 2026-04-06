/**
 * A stepping XML parser that yields at each interesting point in the parse,
 * designed for the visualisation demo.
 *
 * This is a direct copy of the real parser's parseChildren loop (parser.ts)
 * with snap() calls inserted at each interesting point. Features not needed
 * for visualisation (strict mode, decode, trimWhitespace, selfClosingTags,
 * rawContentTags, keepComments, filter) are stripped.
 *
 * When the real parser changes, this file should be updated to match by
 * re-copying and re-adding the snap() calls.
 */

export type Phase =
  | 'idle'
  | 'scanning'
  | 'open-tag-start'
  | 'reading-tag-name'
  | 'reading-attr-name'
  | 'reading-attr-value'
  | 'open-tag-end'
  | 'self-close'
  | 'close-tag'
  | 'reading-text'
  | 'reading-comment'
  | 'reading-cdata'
  | 'reading-doctype'
  | 'error'
  | 'done';

export interface StackEntry {
  tagName: string;
  attributes: Record<string, string | null>;
  elementCount: number;
  textCount: number;
}

export interface Step {
  /** Current character position in the source string */
  pos: number;
  /** Range of characters highlighted for this step [start, end) */
  highlight: [number, number];
  /** What phase the parser is in */
  phase: Phase;
  /** Human-readable description of what's happening */
  description: string;
  /** Current tag name being built (if any) */
  currentTagName: string;
  /** Current attribute name being built (if any) */
  currentAttrName: string;
  /** Current attribute value being built (if any) */
  currentAttrValue: string;
  /** The element stack (ancestors of current position) */
  stack: StackEntry[];
  /** Accumulated attributes on the current open tag */
  currentAttributes: Record<string, string | null>;
  /** Number of top-level nodes emitted so far */
  nodesEmitted: number;
}

// Character codes — copied from parser.ts
const LT = 60; // <
const GT = 62; // >
const SLASH = 47; // /
const BANG = 33; // !
const QUESTION = 63; // ?
const LBRACKET = 91; // [
const RBRACKET = 93; // ]
const SQUOTE = 39; // '
const DQUOTE = 34; // "
const DASH = 45; // -
const UNDERSCORE = 95; // _
const COLON = 58; // :

// Pre-computed lookup table — copied from parser.ts
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
 * Generate all visualisation steps for the given XML string.
 * Returns an array of Step snapshots that the UI can play through.
 *
 * The main loop below is copied from parser.ts parseChildren() with:
 * - snap() calls inserted at interesting points
 * - Stack/frame tracking replaced with StackEntry[] + nodesEmitted counter
 * - Stripped: strict mode, decode, trimWhitespace, selfClosingTags,
 *   rawContentTags, keepComments, filter, stripIgnorableWhitespace
 */
export function generateSteps(S: string): Step[] {
  const steps: Step[] = [];
  const stack: StackEntry[] = [];
  let nodesEmitted = 0;
  let pos = 0;

  // --- snap: capture a step snapshot ---
  function snap(
    phase: Phase,
    description: string,
    highlight: [number, number],
    extra?: {
      currentTagName?: string;
      currentAttrName?: string;
      currentAttrValue?: string;
      currentAttributes?: Record<string, string | null>;
    },
  ): void {
    steps.push({
      pos,
      highlight,
      phase,
      description,
      currentTagName: extra?.currentTagName ?? '',
      currentAttrName: extra?.currentAttrName ?? '',
      currentAttrValue: extra?.currentAttrValue ?? '',
      stack: stack.map((s) => ({
        tagName: s.tagName,
        attributes: { ...s.attributes },
        elementCount: s.elementCount,
        textCount: s.textCount,
      })),
      currentAttributes: extra?.currentAttributes
        ? { ...extra.currentAttributes }
        : {},
      nodesEmitted,
    });
  }

  // --- parseName: copied from parser.ts ---
  function parseName(): string {
    const start = pos;
    let charCode = S.charCodeAt(pos);

    while (
      charCode < 128
        ? NAME_END[charCode] === 0
        : charCode === charCode /* not NaN = not past end */
    ) {
      charCode = S.charCodeAt(++pos);
    }

    return S.substring(start, pos);
  }

  // --- parseString: copied verbatim from parser.ts ---
  // On unterminated quote, pos is left as -1 (caller must check).
  function parseString(): string {
    const quoteCharCode = S.charCodeAt(pos);
    const startPosition = pos + 1;

    pos = S.indexOf(quoteCharCode === SQUOTE ? "'" : '"', startPosition);

    return S.substring(startPosition, pos);
  }

  // --- parseText: copied from parser.ts ---
  function parseText(): string {
    const start = pos;

    pos = S.indexOf('<', pos) - 1;
    if (pos === -2) pos = S.length;

    return S.substring(start, pos + 1);
  }

  // Helper to truncate strings for display
  function truncate(s: string, max: number): string {
    return s.length > max ? s.substring(0, max) + '...' : s;
  }

  snap('idle', 'Ready to parse', [0, 0]);

  // ========================================================
  // Main loop — copied from parser.ts parseChildren('')
  // with snap() calls inserted and stack/frame logic replaced
  // ========================================================
  while (S[pos]) {
    if (S.charCodeAt(pos) === LT) {
      if (S.charCodeAt(pos + 1) === SLASH) {
        // ---- Close tag ---- (parser.ts line ~224)
        const closeStart = pos + 2;
        const startPos = pos;

        pos = S.indexOf('>', pos);

        if (pos === -1) {
          pos = S.length;

          const tagName = S.substring(closeStart).trimEnd();

          snap(
            'close-tag',
            `Closing </${tagName}> (unclosed)`,
            [startPos, pos],
            {
              currentTagName: tagName,
            },
          );

          // Unwind entire stack (mirrors parser.ts line ~234-247)
          while (stack.length > 0) {
            stack.pop();
            nodesEmitted++;
          }

          snap('error', `Error: unclosed close tag — reached end of input`, [
            startPos,
            pos,
          ]);

          return steps;
        }

        const closeTag = S.substring(closeStart, pos).trimEnd();

        // Real parser always throws on mismatch (parser.ts line ~251-254)
        // even in non-strict mode. Show this as an error step.
        const expectedTag = stack[stack.length - 1]?.tagName ?? '';

        if (closeTag !== expectedTag && stack.length > 0) {
          snap(
            'error',
            `Error: </${closeTag}> mismatches <${expectedTag}>`,
            [startPos, pos + 1],
            { currentTagName: closeTag },
          );

          return steps;
        }

        // snap before advancing past >
        snap('close-tag', `Closing </${closeTag}>`, [startPos, pos + 1], {
          currentTagName: closeTag,
        });

        // Pop the stack (mirrors parser.ts line ~267)
        if (stack.length > 0) {
          stack.pop();
        }

        const newTop = stack[stack.length - 1];

        if (newTop !== undefined) {
          newTop.elementCount++;
        } else {
          nodesEmitted++;
        }

        if (pos + 1) pos += 1; // skip > (mirrors parser.ts line 257)
        continue;
      } else if (S.charCodeAt(pos + 1) === BANG) {
        if (S.charCodeAt(pos + 2) === DASH) {
          // ---- Comment ---- (parser.ts line ~283)
          const startCommentPos = pos;

          pos = S.indexOf('-->', pos + 3);

          if (pos === -1) {
            pos = S.length;
            snap('reading-comment', 'Unclosed comment', [startCommentPos, pos]);
          } else {
            pos += 2; // point to the '>'
            snap(
              'reading-comment',
              `Comment: ${truncate(S.substring(startCommentPos + 4, pos - 2).trim(), 40)}`,
              [startCommentPos, pos + 1],
            );
          }

          // Comments are not TNodes — real parser only adds to children
          // when keepComments is true, but we show them in the visualisation
          const commentParent = stack[stack.length - 1];

          if (commentParent !== undefined) {
            commentParent.textCount++;
          }

          pos++; // mirrors parser.ts line 400
          continue;
        } else if (
          S.charCodeAt(pos + 2) === LBRACKET &&
          S.charCodeAt(pos + 8) === LBRACKET &&
          S.substring(pos + 3, pos + 8).toLowerCase() === 'cdata'
        ) {
          // ---- CDATA ---- (parser.ts line ~300)
          const cdataStart = pos;
          const cdataEndIndex = S.indexOf(']]>', pos);

          if (cdataEndIndex === -1) {
            snap('reading-cdata', 'Unclosed CDATA section', [
              cdataStart,
              S.length,
            ]);
            // children.push(S.substring(pos + 9));
            pos = S.length;
          } else {
            // children.push(S.substring(pos + 9, cdataEndIndex));
            pos = cdataEndIndex + 3;
            snap('reading-cdata', 'CDATA section', [cdataStart, pos]);
          }

          const cdataParent = stack[stack.length - 1];

          if (cdataParent !== undefined) {
            cdataParent.textCount++;
          }

          continue; // mirrors parser.ts line 314 (continue skips line 400 pos++)
        } else {
          // ---- Declaration (<!DOCTYPE ...>, <!ENTITY ...>) ----
          // (parser.ts line ~316)
          const declStart = pos;

          pos += 2; // skip '<!'

          const keywordStart = pos - 1; // include the '!'

          // Read declaration keyword
          while (pos < S.length) {
            const cc = S.charCodeAt(pos);

            if (cc <= 32 || cc === GT || cc === LBRACKET) break;
            pos++;
          }

          const declTagName = S.substring(keywordStart, pos);

          // [SNAP] Declaration keyword
          snap(
            'reading-doctype',
            `Declaration keyword: <${declTagName}>`,
            [declStart, pos],
            { currentTagName: declTagName },
          );

          // Parse space-separated tokens as null-valued attributes
          let declAttributes: Record<string, string | null> | null = null;

          while (pos < S.length) {
            const cc = S.charCodeAt(pos);

            if (cc === GT || cc === LBRACKET) break;

            // Skip whitespace
            if (cc <= 32) {
              pos++;
              continue;
            }

            // Quoted token — capture including quotes as the key
            if (cc === SQUOTE || cc === DQUOTE) {
              const tokenStart = pos;
              const closePos = S.indexOf(cc === SQUOTE ? "'" : '"', pos + 1);

              if (closePos === -1) {
                pos = S.length;

                break;
              }

              const token = S.substring(pos + 1, closePos);

              if (declAttributes === null)
                declAttributes = Object.create(null) as Record<
                  string,
                  string | null
                >;
              declAttributes[token] = null;
              pos = closePos + 1;

              // [SNAP] Quoted declaration token
              snap(
                'reading-doctype',
                `Declaration value: "${truncate(token, 40)}"`,
                [tokenStart, pos],
                {
                  currentTagName: declTagName,
                  currentAttributes: declAttributes ?? {},
                },
              );
              continue;
            }

            // Unquoted token
            const tokenStart = pos;

            while (pos < S.length) {
              const tc = S.charCodeAt(pos);

              if (tc <= 32 || tc === GT || tc === LBRACKET) break;
              pos++;
            }

            const token = S.substring(tokenStart, pos);

            if (declAttributes === null)
              declAttributes = Object.create(null) as Record<
                string,
                string | null
              >;
            declAttributes[token] = null;

            // [SNAP] Unquoted declaration token
            snap(
              'reading-doctype',
              `Declaration token: ${truncate(token, 40)}`,
              [tokenStart, pos],
              {
                currentTagName: declTagName,
                currentAttributes: declAttributes ?? {},
              },
            );
          }

          // Skip internal DTD subset ([...]) if present
          // (parser.ts line ~365)
          if (pos < S.length && S.charCodeAt(pos) === LBRACKET) {
            const subsetStart = pos;

            pos++; // skip '['

            let insideBracketSection = true;

            while (insideBracketSection && pos < S.length) {
              if (S.charCodeAt(pos) === RBRACKET) {
                insideBracketSection = false;
              } else {
                // Skip quoted strings inside internal DTD subset
                const quoteCharCode = S.charCodeAt(pos);

                if (quoteCharCode === SQUOTE || quoteCharCode === DQUOTE) {
                  pos = S.indexOf(
                    quoteCharCode === SQUOTE ? "'" : '"',
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

            // Skip any whitespace between ] and >
            while (pos < S.length && S.charCodeAt(pos) <= 32) pos++;

            // [SNAP] DTD internal subset
            snap('reading-doctype', 'Internal DTD subset', [subsetStart, pos], {
              currentTagName: declTagName,
              currentAttributes: declAttributes ?? {},
            });
          }

          // children.push({ tagName: declTagName, attributes: declAttributes, children: [] });
          const declParent = stack[stack.length - 1];

          if (declParent !== undefined) {
            declParent.elementCount++;
          } else {
            nodesEmitted++;
          }
        }

        pos++; // mirrors parser.ts line 400
        continue;
      }

      // ---- Open tag (including processing instructions <?xml ...?>) ----
      // (parser.ts line ~403)
      const tagStart = pos;

      snap('open-tag-start', 'Found < — beginning of tag', [pos, pos + 1]);

      pos++; // skip <

      const tagName = parseName();

      snap('reading-tag-name', `Tag name: <${tagName}`, [tagStart + 1, pos], {
        currentTagName: tagName,
      });

      let attributes: Record<string, string | null> | null = null;

      // ---- Attribute loop ---- (parser.ts line ~409)
      // Copied verbatim: while (S.charCodeAt(pos) !== GT && S[pos])
      while (S.charCodeAt(pos) !== GT && S[pos]) {
        const charCode = S.charCodeAt(pos);

        if (
          (charCode > 64 && charCode < 91) ||
          (charCode > 96 && charCode < 123) ||
          charCode === UNDERSCORE ||
          charCode === COLON ||
          charCode > 127
        ) {
          const attrNameStart = pos;
          const name = parseName();

          // [SNAP] Attribute name
          snap(
            'reading-attr-name',
            `Attribute name: ${name}`,
            [attrNameStart, pos],
            {
              currentTagName: tagName,
              currentAttrName: name,
              currentAttributes: attributes ?? {},
            },
          );

          // search beginning of the string (parser.ts line ~419)
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
            const valueStart = pos;

            value = parseString();

            if (pos === -1) {
              // Unterminated attribute string — emit node with what we have
              // and unwind entire stack (mirrors parser.ts line ~439-455)
              if (attributes === null)
                attributes = Object.create(null) as Record<
                  string,
                  string | null
                >;
              attributes[name] = value;

              // The real parser emits the partial node, unwinds stack, returns
              const unwindParent = stack[stack.length - 1];

              if (unwindParent !== undefined) {
                unwindParent.elementCount++;
              } else {
                nodesEmitted++;
              }

              while (stack.length > 0) {
                stack.pop();
                nodesEmitted++;
              }

              snap(
                'error',
                `Error: unterminated attribute string for "${name}"`,
                [valueStart, S.length],
                {
                  currentTagName: tagName,
                  currentAttrName: name,
                  currentAttributes: attributes ?? {},
                },
              );

              return steps;
            }

            // [SNAP] Attribute value
            snap(
              'reading-attr-value',
              `Attribute value: ${name}="${truncate(value, 30)}"`,
              [valueStart, pos + 1],
              {
                currentTagName: tagName,
                currentAttrName: name,
                currentAttrValue: value,
                currentAttributes: attributes ?? {},
              },
            );
          } else {
            value = null;
            pos--; // (parser.ts line 460)
          }

          if (attributes === null)
            attributes = Object.create(null) as Record<string, string | null>;
          attributes[name] = value;
        }

        pos++; // unconditional (parser.ts line 465)
      }

      // After the attribute loop, pos is at '>' (or past end)
      // (parser.ts line ~471)

      // Determine if this node has children or is self-closing
      if (
        S.charCodeAt(pos - 1) !== SLASH &&
        S.charCodeAt(pos - 1) !== QUESTION &&
        tagName.charCodeAt(0) !== BANG
      ) {
        // Node has children — push frame and descend
        // (parser.ts line ~497: selfClosingSet check omitted for visualiser)
        snap(
          'open-tag-end',
          `Opened <${tagName}> — descending into children`,
          [tagStart, pos + 1],
          { currentTagName: tagName, currentAttributes: attributes ?? {} },
        );

        pos++; // skip > (parser.ts line 499)
        stack.push({
          tagName,
          attributes: attributes ?? {},
          elementCount: 0,
          textCount: 0,
        });
      } else {
        // Explicit self-closing (/>) or processing instruction (?>) or declaration
        // (parser.ts line ~513)
        const isPI = tagName.charCodeAt(0) === QUESTION;
        const label = isPI
          ? `Processing instruction: <${tagName}?>`
          : `Self-closing tag <${tagName} />`;

        snap('self-close', label, [tagStart, pos + 1], {
          currentTagName: tagName,
          currentAttributes: attributes ?? {},
        });

        pos++; // skip > (parser.ts line 515)

        const parent = stack[stack.length - 1];

        if (parent !== undefined) {
          parent.elementCount++;
        } else {
          nodesEmitted++;
        }
      }
    } else {
      // ---- Text content ---- (parser.ts line ~523)
      const textStart = pos;
      const text = parseText();

      if (text.length > 0) {
        const trimmed = text.trim();
        const label =
          trimmed.length > 0
            ? `Text: "${truncate(trimmed, 50)}"`
            : 'Whitespace text node';

        snap(trimmed.length > 0 ? 'reading-text' : 'scanning', label, [
          textStart,
          pos + 1,
        ]);

        // Count as child — real parser pushes all non-empty text
        const textParent = stack[stack.length - 1];

        if (textParent !== undefined) {
          textParent.textCount++;
        }

        // Top-level text counts toward output too
        if (stack.length === 0 && text.length > 0) {
          nodesEmitted++;
        }
      }

      pos++; // advance to '<' (parser.ts line 536)
    }
  }

  // Unwind any remaining stack frames — unclosed tags
  // (mirrors parser.ts line ~544-556)
  while (stack.length > 0) {
    stack.pop();
    nodesEmitted++;
  }

  snap(
    'done',
    `Done — ${nodesEmitted} top-level node${nodesEmitted === 1 ? '' : 's'} parsed`,
    [S.length, S.length],
  );

  return steps;
}
