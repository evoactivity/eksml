/**
 * Streaming / SAX parsing benchmarks.
 *
 * Compares eksml's parsers against event-driven SAX parsers (sax, saxes,
 * htmlparser2.Parser).
 *
 * To keep the comparison fair, every parser builds the same DOM subtree
 * structure: { tagName, attributes, children }. This ensures all parsers
 * do equivalent work (tokenize + build tree), not just fire empty callbacks.
 *
 * Parser reuse policy: every SAX parser here supports being reused across
 * documents (verified by parsing the same document twice and comparing event
 * streams), so each is constructed once at module scope and reused every
 * iteration. This measures steady-state parse throughput rather than
 * constructor cost, and gives the JIT stable callback targets. The one
 * exception is XmlParseStream: web streams are single-use, so it is
 * constructed per iteration by necessity. Chunk arrays are precomputed for
 * the same reason: the benchmark should time parsing, not string slicing.
 *
 * All tree builders share one `roots`/`stack` pair, reset before each run;
 * iterations are sequential so there is no interleaving.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bench, describe } from 'vitest';

// --- eksml ---
// SAX is measured through the public createSaxParser API (the same surface
// users get from '@eksml/xml/sax'), not the internal engine — competitors
// are benchmarked through their public APIs too.
import { XmlParseStream } from '#src/xmlParseStream.ts';
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
// 158 tiny <item id="N"> elements, one attribute each. Attribute-dense worst
// case, complements the attribute-light real fixtures above.
const attrHeavy = fixture('attr-heavy-synthetic.xml');

// ---------------------------------------------------------------------------
// Shared tree node type (equivalent to eksml's TNode)
// ---------------------------------------------------------------------------
interface Node {
  tagName: string;
  attributes: Record<string, string>;
  children: (Node | string)[];
}

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

// Shared tree-builder state, reset before each run.
let roots: (Node | string)[] = [];
let stack: Node[] = [];
function resetTree(): void {
  roots = [];
  stack = [];
}

function pushElement(el: Node): void {
  if (stack.length > 0) {
    stack[stack.length - 1]!.children.push(el);
  } else {
    roots.push(el);
  }
  stack.push(el);
}

function pushChild(child: string): void {
  if (stack.length > 0) {
    stack[stack.length - 1]!.children.push(child);
  } else {
    roots.push(child);
  }
}

// ---------------------------------------------------------------------------
// eksml — natively emits TNode trees via TransformStream
// (constructed per iteration: web streams are single-use)
// ---------------------------------------------------------------------------
async function eksmlStream(chunks: string[]): Promise<void> {
  const stream = new XmlParseStream();
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();

  const drain = (async () => {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  })();

  for (const chunk of chunks) {
    await writer.write(chunk);
  }
  await writer.close();
  await drain;
}

// Comment and processing-instruction listeners are registered for every
// parser as no-ops (the trees built here do not include them) so this suite
// exposes the same full event surface as tokenize.bench.ts. Some parsers
// change behaviour based on which listeners exist — @tuananh/sax-parser's
// event collector slows measurably once comment/cdata/PI listeners are
// registered — so a smaller surface here would make the suites
// incomparable. The no-ops declare parameters for the same reason.
const noop = (_a?: unknown, _b?: unknown) => {};

// ---------------------------------------------------------------------------
// sax — persistent parser (close() re-initializes in place)
// ---------------------------------------------------------------------------
const saxParser = sax.parser(true); // strict mode

saxParser.oncomment = noop;
saxParser.onprocessinginstruction = noop;

saxParser.onopentag = (node) => {
  pushElement({
    tagName: node.name,
    attributes: node.attributes as Record<string, string>,
    children: [],
  });
};
saxParser.ontext = (text) => {
  pushChild(text);
};
saxParser.oncdata = (cdata) => {
  pushChild(cdata);
};
saxParser.onclosetag = () => {
  stack.pop();
};

function saxStream(chunks: string[]): void {
  resetTree();
  for (const chunk of chunks) {
    saxParser.write(chunk);
  }
  saxParser.close();
}

// ---------------------------------------------------------------------------
// saxes — persistent parser (close() resets)
// ---------------------------------------------------------------------------
const saxesParser = new SaxesParser();

saxesParser.on('opentag', (node) => {
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(node.attributes)) {
    if (typeof v === 'string') {
      attrs[k] = v;
    } else if (v && typeof v === 'object' && 'value' in v) {
      attrs[k] = (v as { value: string }).value;
    }
  }
  pushElement({ tagName: node.name, attributes: attrs, children: [] });
});
saxesParser.on('text', (text) => {
  pushChild(text);
});
saxesParser.on('cdata', (cdata) => {
  pushChild(cdata);
});
saxesParser.on('comment', noop);
saxesParser.on('processinginstruction', noop);
saxesParser.on('closetag', () => {
  stack.pop();
});

function saxesStream(chunks: string[]): void {
  resetTree();
  for (const chunk of chunks) {
    saxesParser.write(chunk);
  }
  saxesParser.close();
}

// ---------------------------------------------------------------------------
// htmlparser2 — persistent parser (reset() after end())
// ---------------------------------------------------------------------------
const htmlparser2Parser = new Htmlparser2(
  {
    onopentag(name, attrs) {
      pushElement({ tagName: name, attributes: attrs, children: [] });
    },
    ontext(text) {
      pushChild(text);
    },
    onclosetag() {
      stack.pop();
    },
    oncomment: noop,
    onprocessinginstruction: noop,
  },
  { xmlMode: true },
);

function htmlparser2Stream(chunks: string[]): void {
  resetTree();
  for (const chunk of chunks) {
    htmlparser2Parser.write(chunk);
  }
  htmlparser2Parser.end();
  htmlparser2Parser.reset();
}

// ---------------------------------------------------------------------------
// @tuananh/sax-parser — persistent parser (end() resets)
// ---------------------------------------------------------------------------
const tuananhParser = new SaxParser();

tuananhParser.on(
  'startElement',
  (name: string, attrs: Record<string, string>) => {
    pushElement({ tagName: name, attributes: attrs, children: [] });
  },
);
tuananhParser.on('text', (text: string) => {
  pushChild(text);
});
tuananhParser.on('cdata', (cdata: string) => {
  pushChild(cdata);
});
// Parameter declared so arity probing cannot skip materializing the name
tuananhParser.on('comment', noop);
tuananhParser.on('processingInstruction', noop);
tuananhParser.on('endElement', (_name: string) => {
  stack.pop();
});

function tuananhStream(chunks: string[]): void {
  resetTree();
  for (const chunk of chunks) {
    tuananhParser.write(chunk);
  }
  tuananhParser.end();
}

// ---------------------------------------------------------------------------
// easysax — persistent parser (end() resets)
// ---------------------------------------------------------------------------
const easysaxParser = new EasySax();

// getAttr() returns an attributes object, or `true` when the element has
// none; normalize to an empty object so every node has a consistent shape.
easysaxParser.on('startNode', (name: string, getAttr: () => unknown) => {
  const attrs = getAttr();
  pushElement({
    tagName: name,
    attributes:
      attrs && typeof attrs === 'object'
        ? (attrs as Record<string, string>)
        : {},
    children: [],
  });
});
easysaxParser.on('textNode', (text: string) => {
  pushChild(text);
});
easysaxParser.on('cdata', (cdata: string) => {
  pushChild(cdata);
});
easysaxParser.on('comment', noop);
easysaxParser.on('question', noop);
easysaxParser.on('endNode', () => {
  stack.pop();
});

function easysaxStream(chunks: string[]): void {
  resetTree();
  for (const chunk of chunks) {
    easysaxParser.write(chunk);
  }
  easysaxParser.end();
}

// ---------------------------------------------------------------------------
// eksml createSaxParser — persistent parser (close() resets)
// ---------------------------------------------------------------------------
const eksmlSaxParser = createSaxParser();
eksmlSaxParser.on('openTag', (tagName, attributes) => {
  pushElement({
    tagName,
    attributes: attributes as Record<string, string>,
    children: [],
  });
});
eksmlSaxParser.on('text', (text) => {
  pushChild(text);
});
eksmlSaxParser.on('cdata', (cdata) => {
  pushChild(cdata);
});
eksmlSaxParser.on('comment', noop);
eksmlSaxParser.on('processingInstruction', noop);
eksmlSaxParser.on('closeTag', () => {
  stack.pop();
});

function eksmlSaxEngine(chunks: string[]): void {
  resetTree();
  for (const chunk of chunks) {
    eksmlSaxParser.write(chunk);
  }
  eksmlSaxParser.close();
}

// ---------------------------------------------------------------------------
// RSS feed — chunked streaming
// ---------------------------------------------------------------------------
describe('stream: RSS feed (256 B chunks)', () => {
  bench('eksml (XmlParseStream)', async () => {
    await eksmlStream(rssChunks256);
  });

  bench('eksml (SAX)', () => {
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
// XMLTV EPG — chunked streaming
// ---------------------------------------------------------------------------
describe('stream: XMLTV EPG (256 B chunks)', () => {
  bench('eksml (XmlParseStream)', async () => {
    await eksmlStream(xmltvChunks256);
  });

  bench('eksml (SAX)', () => {
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
// Maven POM — chunked streaming
// ---------------------------------------------------------------------------
describe('stream: Maven POM (256 B chunks)', () => {
  bench('eksml (XmlParseStream)', async () => {
    await eksmlStream(pomChunks256);
  });

  bench('eksml (SAX)', () => {
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
// Small chunk stress test — 64 B chunks on XMLTV EPG
// ---------------------------------------------------------------------------
describe('stream: XMLTV EPG (64 B chunks — stress)', () => {
  bench('eksml (XmlParseStream)', async () => {
    await eksmlStream(xmltvChunks64);
  });

  bench('eksml (SAX)', () => {
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
// Attr-heavy synthetic (sax-parser bench mirror) — chunked streaming
// ---------------------------------------------------------------------------
describe('stream: attr-heavy synthetic (256 B chunks)', () => {
  bench('eksml (XmlParseStream)', async () => {
    await eksmlStream(attrHeavyChunks256);
  });

  bench('eksml (SAX)', () => {
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
