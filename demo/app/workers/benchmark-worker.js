/**
 * Benchmark web worker — runs XML parser benchmarks off the main thread.
 *
 * Protocol:
 *   Main → Worker:  { type: 'run', xml: string, parserId: string, durationMs: number }
 *   Worker → Main:  { type: 'result', parserId: string, iterations: number, elapsed: number }
 *   Worker → Main:  { type: 'error', parserId: string, message: string }
 *
 * NOTE: This file is intentionally plain JS (not .ts) because Vite's
 * `import.meta.url` worker bundling does NOT run the Embroider/Babel TS
 * pipeline, so TypeScript syntax causes parse errors at build time.
 */

import { parseXml } from '@rgrove/parse-xml';
import { parse } from '@eksml/xml/parser';
import { createSaxParser } from '@eksml/xml/sax';
import { XMLParser } from 'fast-xml-parser';
import { parseDocument, Parser as HtmlParser } from 'htmlparser2';
import sax from 'sax';
import { SaxesParser } from 'saxes';
import { parse as tparse } from 'txml';
import { parseString } from 'xml2js';

// ---------------------------------------------------------------------------
// xml2js sync wrapper
// ---------------------------------------------------------------------------

/**
 * xml2js — uses the callback form of parseString which fires synchronously
 * when given a string (no I/O involved).
 * @param {string} xml
 * @returns {unknown}
 */
function xml2jsParse(xml) {
  let result;

  parseString(xml, (err, obj) => {
    if (err) throw err;

    result = obj;
  });

  return result;
}

// No-op function used as a callback sink for SAX benchmarks.
// Declared once to avoid allocation in the hot loop.
const noop = () => {};

const fxpInstance = new XMLParser({ ignoreAttributes: false });

/** @type {Record<string, (xml: string) => unknown>} */
const PARSERS = {
  // -----------------------------------------------------------------------
  // Tree parsers — parse entire XML into a tree structure and return it.
  // -----------------------------------------------------------------------
  eksml: (xml) => parse(xml),
  'fast-xml-parser': (xml) => fxpInstance.parse(xml),
  txml: (xml) => tparse(xml),
  '@rgrove/parse-xml': (xml) => parseXml(xml),
  htmlparser2: (xml) => parseDocument(xml, { xmlMode: true }),
  xml2js: (xml) => xml2jsParse(xml),

  // -----------------------------------------------------------------------
  // Stream (SAX) parsers — tokenise + fire callbacks, no tree produced.
  // Each parser gets the same set of no-op handlers registered so the
  // callback dispatch overhead is included fairly for all.
  // -----------------------------------------------------------------------

  'eksml-stream': (xml) => {
    const p = createSaxParser();

    p.on('openTag', noop);
    p.on('closeTag', noop);
    p.on('text', noop);
    p.on('cdata', noop);
    p.on('comment', noop);
    p.on('processingInstruction', noop);
    p.on('doctype', noop);

    p.write(xml);
    p.close();
  },

  'htmlparser2-sax': (xml) => {
    const p = new HtmlParser(
      {
        onopentag: noop,
        onclosetag: noop,
        ontext: noop,
        oncomment: noop,
        oncdatastart: noop,
        oncdataend: noop,
        onprocessinginstruction: noop,
      },
      { xmlMode: true },
    );

    p.write(xml);
    p.end();
  },

  sax: (xml) => {
    const p = sax.parser(true);

    p.onopentag = noop;
    p.onclosetag = noop;
    p.ontext = noop;
    p.oncdata = noop;
    p.oncomment = noop;
    p.onprocessinginstruction = noop;
    p.write(xml).close();
  },

  saxes: (xml) => {
    const p = new SaxesParser();

    p.on('opentag', noop);
    p.on('closetag', noop);
    p.on('text', noop);
    p.on('cdata', noop);
    p.on('comment', noop);
    p.on('pi', noop);
    p.write(xml).close();
  },
};

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = (event) => {
  const { xml, parserId, durationMs } = event.data;

  const fn = PARSERS[parserId];

  if (!fn) {
    self.postMessage({
      type: 'error',
      parserId,
      message: `Unknown parser: ${parserId}`,
    });

    return;
  }

  try {
    // Warm-up: single parse to JIT-compile / catch errors
    fn(xml);

    // Timed loop
    let iterations = 0;
    const deadline = performance.now() + durationMs;

    while (performance.now() < deadline) {
      fn(xml);
      iterations++;
    }

    const elapsed = performance.now() - (deadline - durationMs);

    self.postMessage({ type: 'result', parserId, iterations, elapsed });
  } catch (err) {
    self.postMessage({
      type: 'error',
      parserId,
      message: err.message,
    });
  }
};
