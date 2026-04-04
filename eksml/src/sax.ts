/**
 * createSaxParser — EventEmitter-style SAX parser built on the internal SAX engine.
 *
 * Provides dynamic `.on()` / `.off()` handler management on top of the core
 * SAX tokenizer.
 *
 * @example
 * ```ts
 * import { createSaxParser } from 'eksml/sax';
 *
 * const parser = createSaxParser({ html: true });
 *
 * parser.on('opentag', (tagName, attrs) => console.log(tagName, attrs));
 * parser.on('text', (text) => console.log(text));
 *
 * parser.write('<div><br><p>Hello</p></div>');
 * parser.close();
 * ```
 */

import type { SaxEngineHandlers, Attributes } from '#src/saxEngine.ts';
import type { ParseOptions } from '#src/parser.ts';
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
  opentag: (tagName: string, attributes: Attributes) => void;
  closetag: (tagName: string) => void;
  text: (text: string) => void;
  cdata: (data: string) => void;
  comment: (comment: string) => void;
  processinginstruction: (name: string, body: string) => void;
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

  // Listener sets — one Set per event type
  const listeners: {
    [E in SaxEventName]: Set<SaxEventMap[E]>;
  } = {
    opentag: new Set(),
    closetag: new Set(),
    text: new Set(),
    cdata: new Set(),
    comment: new Set(),
    processinginstruction: new Set(),
    doctype: new Set(),
  };

  // Bridge handlers: call all registered listeners for each event
  const handlers: SaxEngineHandlers = {
    onopentag(tagName: string, attributes: Attributes) {
      for (const handler of listeners.opentag) handler(tagName, attributes);
    },
    onclosetag(tagName: string) {
      for (const handler of listeners.closetag) handler(tagName);
    },
    ontext(text: string) {
      for (const handler of listeners.text) handler(text);
    },
    oncdata(data: string) {
      for (const handler of listeners.cdata) handler(data);
    },
    oncomment(comment: string) {
      for (const handler of listeners.comment) handler(comment);
    },
    onprocessinginstruction(name: string, body: string) {
      for (const handler of listeners.processinginstruction)
        handler(name, body);
    },
    ondoctype(tagName: string, attributes: Attributes) {
      for (const handler of listeners.doctype) handler(tagName, attributes);
    },
  };

  const parser = saxEngine({
    ...handlers,
    selfClosingTags,
    rawContentTags,
  });

  return {
    on<E extends SaxEventName>(event: E, handler: SaxEventMap[E]): void {
      listeners[event].add(handler);
    },
    off<E extends SaxEventName>(event: E, handler: SaxEventMap[E]): void {
      listeners[event].delete(handler);
    },
    write(chunk: string): void {
      parser.write(chunk);
    },
    close(): void {
      parser.close();
    },
  };
}
