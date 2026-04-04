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
import { parse } from 'eksml/parser';
import { XMLParser } from 'fast-xml-parser';
import { parseDocument } from 'htmlparser2';
import sax from 'sax';
import { SaxesParser } from 'saxes';
import { parse as tparse } from 'txml';
import { parseString } from 'xml2js';

// ---------------------------------------------------------------------------
// Tree-producing DOM parsers
// ---------------------------------------------------------------------------

const fxpInstance = new XMLParser({ ignoreAttributes: false });

// ---------------------------------------------------------------------------
// SAX tree-builders — build a { tagName, attributes, children } tree from
// SAX events so all parsers do equivalent work (tokenise + build tree).
// Patterns taken from eksml/bench/stream.bench.ts.
// ---------------------------------------------------------------------------

/**
 * sax — build tree via SAX events (strict mode).
 * @param {string} xml
 * @returns {unknown}
 */
function saxParse(xml) {
  const parser = sax.parser(true);

  const roots = [];
  const stack = [];

  parser.onopentag = (node) => {
    const el = {
      tagName: node.name,
      attributes: node.attributes,
      children: [],
    };

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(el);
    } else {
      roots.push(el);
    }

    stack.push(el);
  };

  parser.ontext = (text) => {
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(text);
    } else {
      roots.push(text);
    }
  };

  parser.oncdata = (cdata) => {
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(cdata);
    } else {
      roots.push(cdata);
    }
  };

  parser.onclosetag = () => {
    stack.pop();
  };

  parser.write(xml).close();

  return roots;
}

/**
 * saxes — build tree via SAX events.
 * @param {string} xml
 * @returns {unknown}
 */
function saxesParse(xml) {
  const parser = new SaxesParser();

  const roots = [];
  const stack = [];

  parser.on('opentag', (node) => {
    const attrs = {};

    for (const [k, v] of Object.entries(node.attributes)) {
      if (typeof v === 'string') {
        attrs[k] = v;
      } else if (v && typeof v === 'object' && 'value' in v) {
        attrs[k] = v.value;
      }
    }

    const el = { tagName: node.name, attributes: attrs, children: [] };

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(el);
    } else {
      roots.push(el);
    }

    stack.push(el);
  });

  parser.on('text', (text) => {
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(text);
    } else {
      roots.push(text);
    }
  });

  parser.on('cdata', (cdata) => {
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(cdata);
    } else {
      roots.push(cdata);
    }
  });

  parser.on('closetag', () => {
    stack.pop();
  });

  parser.write(xml).close();

  return roots;
}

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

// ---------------------------------------------------------------------------
// Parser registry
// ---------------------------------------------------------------------------

/** @type {Record<string, (xml: string) => unknown>} */
const PARSERS = {
  eksml: (xml) => parse(xml),
  'fast-xml-parser': (xml) => fxpInstance.parse(xml),
  txml: (xml) => tparse(xml),
  '@rgrove/parse-xml': (xml) => parseXml(xml),
  htmlparser2: (xml) => parseDocument(xml, { xmlMode: true }),
  xml2js: (xml) => xml2jsParse(xml),
  sax: (xml) => saxParse(xml),
  saxes: (xml) => saxesParse(xml),
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
