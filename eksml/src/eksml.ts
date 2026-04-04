/**
 * Eksml — unified class-based API for XML/HTML parsing, serialization,
 * streaming, and SAX event processing.
 *
 * Constructor options set defaults for all operations. The `output` option
 * determines what `.parse()` returns:
 *
 * - `"dom"` (default) — array of `TNode | string` (full DOM tree)
 * - `"lossy"` — compact JS object (loses sibling order between different tag names)
 * - `"lossless"` — order-preserving `LosslessEntry[]`
 *
 * @example
 * ```ts
 * // DOM mode (default)
 * const eksml = new Eksml({ entities: true });
 * const tree = eksml.parse('<root>hello</root>');
 *
 * // Lossy mode
 * const eksmlLossy = new Eksml({ output: "lossy" });
 * const obj = eksmlLossy.parse('<root><item>1</item></root>');
 *
 * // Lossless mode
 * const eksmlLossless = new Eksml({ output: "lossless" });
 * const entries = eksmlLossless.parse('<root><item>1</item></root>');
 *
 * // Write, stream, sax work the same regardless of output mode
 * const xml = eksml.write(tree);
 * const readable = eksml.stream(response.body);
 * const sax = eksml.sax();
 * sax.on('opentag', (name, attrs) => console.log(name, attrs));
 * sax.write(chunk);
 * sax.close();
 * sax.off('opentag', handler);
 * ```
 */

import type { TNode, ParseOptions } from '#src/parser.ts';
import type { WriterOptions, WriterInput } from '#src/writer.ts';
import type { FastStreamHandlers, Attributes } from '#src/fastStream.ts';
import type { LossyValue } from '#src/converters/lossy.ts';
import type { LosslessEntry } from '#src/converters/lossless.ts';
import { parse } from '#src/parser.ts';
import { writer } from '#src/writer.ts';
import { fastStream } from '#src/fastStream.ts';
import { transformStream } from '#src/transformStream.ts';
import type { TransformStreamOptions } from '#src/transformStream.ts';
import { lossy } from '#src/converters/lossy.ts';
import { lossless } from '#src/converters/lossless.ts';

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

/** EventEmitter-style SAX parser returned by `Eksml.sax()`. */
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
// Output mode
// ---------------------------------------------------------------------------

/** Output format for `Eksml.parse()`. */
export type OutputMode = 'dom' | 'lossy' | 'lossless';

/** Maps an output mode to its parse return type. */
export type OutputType<M extends OutputMode> = M extends 'dom'
  ? (TNode | string)[]
  : M extends 'lossy'
    ? LossyValue | LossyValue[]
    : M extends 'lossless'
      ? LosslessEntry[]
      : never;

// ---------------------------------------------------------------------------
// Eksml options
// ---------------------------------------------------------------------------

/** Options for the Eksml constructor. */
export interface EksmlOptions extends ParseOptions {
  /**
   * Output format for `.parse()`.
   *
   * - `"dom"` (default) — full DOM tree as `(TNode | string)[]`
   * - `"lossy"` — compact JS object via the lossy converter
   * - `"lossless"` — order-preserving `LosslessEntry[]`
   */
  output?: OutputMode;
}

// ---------------------------------------------------------------------------
// Eksml class
// ---------------------------------------------------------------------------

export class Eksml<M extends OutputMode = 'dom'> {
  private readonly defaults: ParseOptions;
  private readonly outputMode: M;

  constructor(options?: EksmlOptions & { output?: M }) {
    const { output, ...parseOptions } = options ?? ({} as EksmlOptions);
    this.outputMode = (output ?? 'dom') as M;
    this.defaults = parseOptions;
  }

  // -------------------------------------------------------------------------
  // parse
  // -------------------------------------------------------------------------

  /**
   * Parse an XML/HTML string.
   *
   * The return type depends on the `output` mode set in the constructor:
   * - `"dom"` → `(TNode | string)[]`
   * - `"lossy"` → `LossyValue | LossyValue[]`
   * - `"lossless"` → `LosslessEntry[]`
   *
   * @param xml - The XML/HTML string to parse.
   * @param overrides - Per-call parse option overrides.
   * @returns Parsed output in the configured format.
   */
  parse(xml: string, overrides?: ParseOptions): OutputType<M> {
    const merged = this.mergeParseOptions(overrides);
    const dom = parse(xml, merged);
    switch (this.outputMode) {
      case 'lossy':
        return lossy(dom) as OutputType<M>;
      case 'lossless':
        return lossless(dom) as OutputType<M>;
      default:
        return dom as OutputType<M>;
    }
  }

  // -------------------------------------------------------------------------
  // write — serialize to XML/HTML
  // -------------------------------------------------------------------------

  /**
   * Serialize a parsed tree back to an XML/HTML string.
   *
   * Accepts DOM nodes, lossy objects, or lossless entries. Lossy and lossless
   * inputs are automatically converted to DOM before serialization.
   *
   * @param input - A TNode, TNode/string array, lossy value(s), or lossless entries.
   * @param options - Writer-specific options (pretty-print, entities, html mode).
   * @returns The serialized XML/HTML string.
   */
  write(input: WriterInput, options?: WriterOptions): string {
    return writer(input, options);
  }

  // -------------------------------------------------------------------------
  // stream — Web Streams tree-building parser
  // -------------------------------------------------------------------------

  /**
   * Create a `ReadableStream` of parsed nodes from a `ReadableStream<string>`.
   *
   * Pipes the input through an internal `TransformStream` powered by the SAX
   * engine, emitting complete `TNode` subtrees as each top-level element closes.
   *
   * Use the `select` option to emit specific elements as they close at any
   * depth, without waiting for the entire document root to finish.
   *
   * Note: stream always emits DOM nodes (`TNode | string`) regardless of
   * the constructor's `output` mode.
   *
   * @param input - A ReadableStream of string chunks (e.g. from `fetch`).
   * @param overrides - Per-call stream options (html, keepComments, select, etc.).
   * @returns A ReadableStream emitting parsed TNode and string values.
   */
  stream(
    input: ReadableStream<string>,
    overrides?: TransformStreamOptions,
  ): ReadableStream<TNode | string> {
    const merged: TransformStreamOptions = overrides
      ? { ...this.streamDefaults(), ...overrides }
      : this.streamDefaults();
    const transform = transformStream(undefined, merged);
    return input.pipeThrough(transform);
  }

  // -------------------------------------------------------------------------
  // sax — EventEmitter-style SAX parser
  // -------------------------------------------------------------------------

  /**
   * Create an EventEmitter-style SAX parser.
   *
   * Uses `fastStream` internally, but wraps it with `.on()` / `.off()` methods
   * so handlers can be added and removed dynamically.
   *
   * @param overrides - Per-call option overrides (html, selfClosingTags, rawContentTags, etc.).
   * @returns A SaxParser with `.on()`, `.off()`, `.write()`, `.close()`.
   */
  sax(overrides?: ParseOptions): SaxParser {
    const merged = this.mergeParseOptions(overrides);

    // Resolve HTML-mode defaults (same logic as parse() and transformStream)
    const isHtml = merged.html === true;
    const selfClosingTags =
      merged.selfClosingTags ?? (isHtml ? HTML_VOID_ELEMENTS : []);
    const rawContentTags =
      merged.rawContentTags ?? (isHtml ? HTML_RAW_CONTENT_TAGS : []);

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
    const handlers: FastStreamHandlers = {
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

    const parser = fastStream({
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

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private mergeParseOptions(overrides?: Partial<ParseOptions>): ParseOptions {
    if (!overrides) return this.defaults;
    return { ...this.defaults, ...overrides };
  }

  /** Extract the subset of constructor defaults relevant to transformStream. */
  private streamDefaults(): TransformStreamOptions {
    return {
      html: this.defaults.html,
      selfClosingTags: this.defaults.selfClosingTags,
      rawContentTags: this.defaults.rawContentTags,
      keepComments: this.defaults.keepComments,
    };
  }
}
