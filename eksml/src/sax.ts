/**
 * createSaxParser — EventEmitter-style SAX parser built on the internal SAX engine.
 *
 * Provides dynamic `.on()` / `.off()` handler management on top of the core
 * SAX tokenizer.
 *
 * @example
 * ```ts
 * import { createSaxParser } from '@eksml/xml/sax';
 *
 * const parser = createSaxParser({ html: true });
 *
 * parser.on('openTag', (tagName, attrs) => console.log(tagName, attrs));
 * parser.on('text', (text) => console.log(text));
 *
 * parser.write('<div><br><p>Hello</p></div>');
 * parser.close();
 * ```
 */

import type { SaxEngineHandlers, Attributes } from '#src/saxEngine.ts';
import { saxEngine } from '#src/saxEngine.ts';
import {
  HTML_VOID_ELEMENTS,
  HTML_RAW_CONTENT_TAGS,
} from '#src/utilities/htmlConstants.ts';

// ---------------------------------------------------------------------------
// SAX event types
// ---------------------------------------------------------------------------

/** Event name → handler signature map for the SAX parser. */
export interface SaxEventMap {
  openTag: (tagName: string, attributes: Attributes) => void;
  closeTag: (tagName: string) => void;
  text: (text: string) => void;
  cdata: (data: string) => void;
  comment: (comment: string) => void;
  processingInstruction: (name: string, body: string) => void;
  doctype: (tagName: string, attributes: Attributes) => void;
}

/** SAX event names. */
export type SaxEventName = keyof SaxEventMap;

/** EventEmitter-style SAX parser returned by `createSaxParser()`. */
export interface SaxParser {
  /** Register an event handler. */
  on<E extends SaxEventName>(event: E, handler: SaxEventMap[E]): void;
  /** Remove an event handler. */
  off<E extends SaxEventName>(event: E, handler: SaxEventMap[E]): void;
  /** Feed a chunk of XML to the parser. */
  write(chunk: string): void;
  /** Signal end-of-input and flush any remaining buffered data. */
  close(): void;
}

// ---------------------------------------------------------------------------
// SAX parser options
// ---------------------------------------------------------------------------

/** Options for `createSaxParser()`. */
export interface SaxParserOptions {
  /**
   * Enable HTML mode. Sets `selfClosingTags` and `rawContentTags` to their
   * HTML defaults unless explicitly provided.
   */
  html?: boolean;
  /** Tag names that are self-closing (void). Defaults to HTML voids when `html: true`. */
  selfClosingTags?: string[];
  /** Tag names whose content is raw text. Defaults to `['script', 'style']` when `html: true`. */
  rawContentTags?: string[];
}

// ---------------------------------------------------------------------------
// createSaxParser
// ---------------------------------------------------------------------------

/**
 * Create an EventEmitter-style SAX parser.
 *
 * Uses the internal SAX engine, but wraps it with `.on()` / `.off()` methods
 * so handlers can be added and removed dynamically.
 *
 * @param options - Parser options (html mode, selfClosingTags, rawContentTags).
 * @returns A SaxParser with `.on()`, `.off()`, `.write()`, `.close()`.
 */
export function createSaxParser(options?: SaxParserOptions): SaxParser {
  const opts = options ?? {};

  // Resolve HTML-mode defaults (same logic as parse() and XmlParseStream)
  const isHtml = opts.html === true;
  const selfClosingTags =
    opts.selfClosingTags ?? (isHtml ? HTML_VOID_ELEMENTS : []);
  const rawContentTags =
    opts.rawContentTags ?? (isHtml ? HTML_RAW_CONTENT_TAGS : []);

  // Listener slots — one per event type. The overwhelmingly common case is
  // exactly one listener per event, so each slot holds a `single` function
  // dispatched with a direct call (no Set, no per-event iterator allocation).
  // A Set is created lazily only when a second listener registers.
  interface Slot<F> {
    single: F | null;
    multi: Set<F> | null;
  }
  const makeSlot = <F>(): Slot<F> => ({ single: null, multi: null });

  const listeners: {
    [E in SaxEventName]: Slot<SaxEventMap[E]>;
  } = {
    openTag: makeSlot(),
    closeTag: makeSlot(),
    text: makeSlot(),
    cdata: makeSlot(),
    comment: makeSlot(),
    processingInstruction: makeSlot(),
    doctype: makeSlot(),
  };

  function addListener<F>(slot: Slot<F>, handler: F): void {
    if (slot.multi !== null) {
      slot.multi.add(handler);
      return;
    }
    if (slot.single === null) {
      slot.single = handler;
      return;
    }
    if (slot.single === handler) return; // Set-style dedupe
    slot.multi = new Set([slot.single, handler]);
    slot.single = null;
  }

  function removeListener<F>(slot: Slot<F>, handler: F): void {
    if (slot.multi !== null) {
      slot.multi.delete(handler);
      if (slot.multi.size === 1) {
        // Collapse back to the fast single-dispatch path
        for (const remaining of slot.multi) slot.single = remaining;
        slot.multi = null;
      }
      return;
    }
    if (slot.single === handler) slot.single = null;
  }

  // Bridge handlers: direct call for a single listener, Set loop otherwise
  const handlers: SaxEngineHandlers = {
    onOpenTag(tagName: string, attributes: Attributes) {
      const slot = listeners.openTag;
      if (slot.single !== null) {
        slot.single(tagName, attributes);
      } else if (slot.multi !== null) {
        for (const handler of slot.multi) handler(tagName, attributes);
      }
    },
    onCloseTag(tagName: string) {
      const slot = listeners.closeTag;
      if (slot.single !== null) {
        slot.single(tagName);
      } else if (slot.multi !== null) {
        for (const handler of slot.multi) handler(tagName);
      }
    },
    onText(text: string) {
      const slot = listeners.text;
      if (slot.single !== null) {
        slot.single(text);
      } else if (slot.multi !== null) {
        for (const handler of slot.multi) handler(text);
      }
    },
    onCdata(data: string) {
      const slot = listeners.cdata;
      if (slot.single !== null) {
        slot.single(data);
      } else if (slot.multi !== null) {
        for (const handler of slot.multi) handler(data);
      }
    },
    onComment(comment: string) {
      const slot = listeners.comment;
      if (slot.single !== null) {
        slot.single(comment);
      } else if (slot.multi !== null) {
        for (const handler of slot.multi) handler(comment);
      }
    },
    onProcessingInstruction(name: string, body: string) {
      const slot = listeners.processingInstruction;
      if (slot.single !== null) {
        slot.single(name, body);
      } else if (slot.multi !== null) {
        for (const handler of slot.multi) handler(name, body);
      }
    },
    onDoctype(tagName: string, attributes: Attributes) {
      const slot = listeners.doctype;
      if (slot.single !== null) {
        slot.single(tagName, attributes);
      } else if (slot.multi !== null) {
        for (const handler of slot.multi) handler(tagName, attributes);
      }
    },
  };

  const parser = saxEngine({
    ...handlers,
    selfClosingTags,
    rawContentTags,
  });

  return {
    on<E extends SaxEventName>(event: E, handler: SaxEventMap[E]): void {
      addListener(listeners[event], handler);
    },
    off<E extends SaxEventName>(event: E, handler: SaxEventMap[E]): void {
      removeListener(listeners[event], handler);
    },
    write(chunk: string): void {
      parser.write(chunk);
    },
    close(): void {
      parser.close();
    },
  };
}
