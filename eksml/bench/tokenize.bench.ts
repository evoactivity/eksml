/**
 * Raw tokenization / SAX streaming benchmarks — no tree building.
 *
 * Measures pure tokenization throughput by registering no-op callbacks.
 * This isolates the parser's scanning and event-dispatch cost from any
 * downstream work (tree construction, string copying, etc.).
 *
 * Parser reuse policy: every parser here supports being reused across
 * documents (verified by parsing the same document twice and comparing event
 * streams), so each is constructed once at module scope and reused every
 * iteration. This measures steady-state parse throughput rather than
 * constructor cost, and gives the JIT stable callback targets. Chunk arrays
 * are precomputed for the same reason: the benchmark should time parsing,
 * not string slicing.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bench, describe } from 'vitest';

// --- eksml ---
// Measured through the public createSaxParser API (the same surface users
// get from '@eksml/xml/sax'), not the internal engine — competitors are
// benchmarked through their public APIs too.
import { createSaxParser } from '#src/sax.ts';

// --- competitors ---
import SaxParser from '@tuananh/sax-parser';
import EasySax from 'easysax';
import { Parser as Htmlparser2 } from 'htmlparser2';
import sax from 'sax';
import { SaxesParser } from 'saxes';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, '../test/fixtures', name), 'utf-8');

const rssFeed = fixture('rss-feed.xml');
const xmltvEpg = fixture('xmltv-epg.xml');
const pomXml = fixture('pom.xml');
// Mirrors the ~10 KB synthetic document from @tuananh/sax-parser's benchmark:
// 158 tiny <item id="N"> elements, one attribute each, ~8 bytes per SAX
// event. Attribute-dense worst case, complements the attribute-light real
// fixtures above.
const attrHeavy = fixture('attr-heavy-synthetic.xml');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function chunkString(str: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

// Precomputed chunk arrays for every (document, size) pair used below.
const rssChunks256 = chunkString(rssFeed, 256);
const xmltvChunks256 = chunkString(xmltvEpg, 256);
const pomChunks256 = chunkString(pomXml, 256);
const xmltvChunks64 = chunkString(xmltvEpg, 64);
const attrHeavyChunks256 = chunkString(attrHeavy, 256);

// No-op function used as callback
const noop = () => {};

// ---------------------------------------------------------------------------
// eksml createSaxParser — persistent parser, no-op callbacks (close() resets)
// ---------------------------------------------------------------------------
const eksmlParser = createSaxParser();
eksmlParser.on('openTag', noop);
eksmlParser.on('closeTag', noop);
eksmlParser.on('text', noop);
eksmlParser.on('cdata', noop);
eksmlParser.on('comment', noop);
eksmlParser.on('processingInstruction', noop);
function eksmlSaxEngine(chunks: string[]): void {
  for (const chunk of chunks) {
    eksmlParser.write(chunk);
  }
  eksmlParser.close();
}

// ---------------------------------------------------------------------------
// sax — persistent parser, no-op callbacks (close() re-initializes in place)
// ---------------------------------------------------------------------------
const saxParser = sax.parser(true);
saxParser.onopentag = noop;
saxParser.onclosetag = noop;
saxParser.ontext = noop;
saxParser.oncdata = noop;
saxParser.oncomment = noop;
saxParser.onprocessinginstruction = noop;
function saxStream(chunks: string[]): void {
  for (const chunk of chunks) {
    saxParser.write(chunk);
  }
  saxParser.close();
}

// ---------------------------------------------------------------------------
// saxes — persistent parser, no-op callbacks (close() resets)
// ---------------------------------------------------------------------------
const saxesParser = new SaxesParser();
saxesParser.on('opentag', noop);
saxesParser.on('closetag', noop);
saxesParser.on('text', noop);
saxesParser.on('cdata', noop);
saxesParser.on('comment', noop);
saxesParser.on('processinginstruction', noop);
function saxesStream(chunks: string[]): void {
  for (const chunk of chunks) {
    saxesParser.write(chunk);
  }
  saxesParser.close();
}

// ---------------------------------------------------------------------------
// htmlparser2 — persistent parser, no-op callbacks (reset() after end())
// ---------------------------------------------------------------------------
const htmlparser2Parser = new Htmlparser2(
  {
    onopentag: noop,
    onclosetag: noop,
    ontext: noop,
    oncdatastart: noop,
    oncdataend: noop,
    oncomment: noop,
    onprocessinginstruction: noop,
  },
  { xmlMode: true },
);
function htmlparser2Stream(chunks: string[]): void {
  for (const chunk of chunks) {
    htmlparser2Parser.write(chunk);
  }
  htmlparser2Parser.end();
  htmlparser2Parser.reset();
}

// ---------------------------------------------------------------------------
// @tuananh/sax-parser — persistent parser, no-op callbacks (end() resets)
// ---------------------------------------------------------------------------
const tuananhParser = new SaxParser();
tuananhParser.on('startElement', noop);
tuananhParser.on('endElement', noop);
tuananhParser.on('text', noop);
tuananhParser.on('cdata', noop);
tuananhParser.on('comment', noop);
tuananhParser.on('processingInstruction', noop);
function tuananhStream(chunks: string[]): void {
  for (const chunk of chunks) {
    tuananhParser.write(chunk);
  }
  tuananhParser.end();
}

// ---------------------------------------------------------------------------
// easysax — persistent parser, no-op callbacks (end() resets)
//
// easysax parses attributes lazily: startNode receives a getAttr() thunk and
// no attribute work happens unless it is called. Every other parser in this
// suite materializes attributes for the open-tag event unconditionally, so
// getAttr() is invoked to make easysax do the same work.
// ---------------------------------------------------------------------------
const easysaxParser = new EasySax();
easysaxParser.on('startNode', (_name: string, getAttr: () => unknown) => {
  getAttr();
});
easysaxParser.on('endNode', noop);
easysaxParser.on('textNode', noop);
easysaxParser.on('cdata', noop);
easysaxParser.on('comment', noop);
easysaxParser.on('question', noop);
function easysaxStream(chunks: string[]): void {
  for (const chunk of chunks) {
    easysaxParser.write(chunk);
  }
  easysaxParser.end();
}

// ---------------------------------------------------------------------------
// RSS feed — 256 B chunks
// ---------------------------------------------------------------------------
describe('tokenize: RSS feed (256 B chunks)', () => {
  bench('eksml', () => {
    eksmlSaxEngine(rssChunks256);
  });

  bench('sax', () => {
    saxStream(rssChunks256);
  });

  bench('saxes', () => {
    saxesStream(rssChunks256);
  });

  bench('htmlparser2', () => {
    htmlparser2Stream(rssChunks256);
  });

  bench('@tuananh/sax-parser', () => {
    tuananhStream(rssChunks256);
  });

  bench('easysax', () => {
    easysaxStream(rssChunks256);
  });
});

// ---------------------------------------------------------------------------
// XMLTV EPG — 256 B chunks
// ---------------------------------------------------------------------------
describe('tokenize: XMLTV EPG (256 B chunks)', () => {
  bench('eksml', () => {
    eksmlSaxEngine(xmltvChunks256);
  });

  bench('sax', () => {
    saxStream(xmltvChunks256);
  });

  bench('saxes', () => {
    saxesStream(xmltvChunks256);
  });

  bench('htmlparser2', () => {
    htmlparser2Stream(xmltvChunks256);
  });

  bench('@tuananh/sax-parser', () => {
    tuananhStream(xmltvChunks256);
  });

  bench('easysax', () => {
    easysaxStream(xmltvChunks256);
  });
});

// ---------------------------------------------------------------------------
// Maven POM — 256 B chunks
// ---------------------------------------------------------------------------
describe('tokenize: Maven POM (256 B chunks)', () => {
  bench('eksml', () => {
    eksmlSaxEngine(pomChunks256);
  });

  bench('sax', () => {
    saxStream(pomChunks256);
  });

  bench('saxes', () => {
    saxesStream(pomChunks256);
  });

  bench('htmlparser2', () => {
    htmlparser2Stream(pomChunks256);
  });

  bench('@tuananh/sax-parser', () => {
    tuananhStream(pomChunks256);
  });

  bench('easysax', () => {
    easysaxStream(pomChunks256);
  });
});

// ---------------------------------------------------------------------------
// XMLTV EPG — 64 B chunks (stress test)
// ---------------------------------------------------------------------------
describe('tokenize: XMLTV EPG (64 B chunks — stress)', () => {
  bench('eksml', () => {
    eksmlSaxEngine(xmltvChunks64);
  });

  bench('sax', () => {
    saxStream(xmltvChunks64);
  });

  bench('saxes', () => {
    saxesStream(xmltvChunks64);
  });

  bench('htmlparser2', () => {
    htmlparser2Stream(xmltvChunks64);
  });

  bench('@tuananh/sax-parser', () => {
    tuananhStream(xmltvChunks64);
  });

  bench('easysax', () => {
    easysaxStream(xmltvChunks64);
  });
});

// ---------------------------------------------------------------------------
// Attr-heavy synthetic (sax-parser bench mirror) — 256 B chunks
// ---------------------------------------------------------------------------
describe('tokenize: attr-heavy synthetic (256 B chunks)', () => {
  bench('eksml', () => {
    eksmlSaxEngine(attrHeavyChunks256);
  });

  bench('sax', () => {
    saxStream(attrHeavyChunks256);
  });

  bench('saxes', () => {
    saxesStream(attrHeavyChunks256);
  });

  bench('htmlparser2', () => {
    htmlparser2Stream(attrHeavyChunks256);
  });

  bench('@tuananh/sax-parser', () => {
    tuananhStream(attrHeavyChunks256);
  });

  bench('easysax', () => {
    easysaxStream(attrHeavyChunks256);
  });
});
