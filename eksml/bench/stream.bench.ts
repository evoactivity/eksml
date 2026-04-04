/**
 * Streaming / SAX parsing benchmarks.
 *
 * Compares eksml's parsers against event-driven SAX parsers (sax, saxes,
 * htmlparser2.Parser) and fast-xml-parser (synchronous, for reference).
 *
 * To keep the comparison fair, every parser builds the same DOM subtree
 * structure: { tagName, attributes, children }. This ensures all parsers
 * do equivalent work (tokenize + build tree), not just fire empty callbacks.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bench, describe } from 'vitest';

// --- eksml ---
import { transformStream } from '#src/transformStream.ts';
import { fastStream } from '#src/fastStream.ts';

// --- competitors ---
import { XMLParser } from 'fast-xml-parser';
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

// ---------------------------------------------------------------------------
// eksml — natively emits TNode trees via TransformStream
// ---------------------------------------------------------------------------
async function eksmlStream(xml: string, chunkSize: number): Promise<void> {
  const chunks = chunkString(xml, chunkSize);
  const stream = transformStream();
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

// ---------------------------------------------------------------------------
// sax — build DOM tree from SAX events
// ---------------------------------------------------------------------------
function saxStream(xml: string, chunkSize: number): Node[] {
  const chunks = chunkString(xml, chunkSize);
  const parser = sax.parser(true); // strict mode

  const roots: (Node | string)[] = [];
  const stack: Node[] = [];

  parser.onopentag = (node) => {
    const el: Node = {
      tagName: node.name,
      attributes: node.attributes as Record<string, string>,
      children: [],
    };
    if (stack.length > 0) {
      stack[stack.length - 1]!.children.push(el);
    } else {
      roots.push(el);
    }
    stack.push(el);
  };

  parser.ontext = (text) => {
    if (stack.length > 0) {
      stack[stack.length - 1]!.children.push(text);
    } else {
      roots.push(text);
    }
  };

  parser.oncdata = (cdata) => {
    if (stack.length > 0) {
      stack[stack.length - 1]!.children.push(cdata);
    } else {
      roots.push(cdata);
    }
  };

  parser.onclosetag = () => {
    stack.pop();
  };

  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.close();

  return roots.filter((r): r is Node => typeof r !== 'string');
}

// ---------------------------------------------------------------------------
// saxes — build DOM tree from SAX events
// ---------------------------------------------------------------------------
function saxesStream(xml: string, chunkSize: number): Node[] {
  const chunks = chunkString(xml, chunkSize);
  const parser = new SaxesParser();

  const roots: (Node | string)[] = [];
  const stack: Node[] = [];

  parser.on('opentag', (node) => {
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(node.attributes)) {
      if (typeof v === 'string') {
        attrs[k] = v;
      } else if (v && typeof v === 'object' && 'value' in v) {
        attrs[k] = (v as { value: string }).value;
      }
    }
    const el: Node = {
      tagName: node.name,
      attributes: attrs,
      children: [],
    };
    if (stack.length > 0) {
      stack[stack.length - 1]!.children.push(el);
    } else {
      roots.push(el);
    }
    stack.push(el);
  });

  parser.on('text', (text) => {
    if (stack.length > 0) {
      stack[stack.length - 1]!.children.push(text);
    } else {
      roots.push(text);
    }
  });

  parser.on('cdata', (cdata) => {
    if (stack.length > 0) {
      stack[stack.length - 1]!.children.push(cdata);
    } else {
      roots.push(cdata);
    }
  });

  parser.on('closetag', () => {
    stack.pop();
  });

  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.close();

  return roots.filter((r): r is Node => typeof r !== 'string');
}

// ---------------------------------------------------------------------------
// htmlparser2 — build DOM tree from SAX events
// ---------------------------------------------------------------------------
function htmlparser2Stream(xml: string, chunkSize: number): Node[] {
  const chunks = chunkString(xml, chunkSize);

  const roots: (Node | string)[] = [];
  const stack: Node[] = [];

  const parser = new Htmlparser2(
    {
      onopentag(name, attrs) {
        const el: Node = {
          tagName: name,
          attributes: attrs,
          children: [],
        };
        if (stack.length > 0) {
          stack[stack.length - 1]!.children.push(el);
        } else {
          roots.push(el);
        }
        stack.push(el);
      },
      ontext(text) {
        if (stack.length > 0) {
          stack[stack.length - 1]!.children.push(text);
        } else {
          roots.push(text);
        }
      },
      onclosetag() {
        stack.pop();
      },
    },
    { xmlMode: true },
  );

  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.end();

  return roots.filter((r): r is Node => typeof r !== 'string');
}

// ---------------------------------------------------------------------------
// eksml fastStream — synchronous SAX, build DOM tree from events
// ---------------------------------------------------------------------------
function eksmlFastStream(xml: string, chunkSize: number): Node[] {
  const chunks = chunkString(xml, chunkSize);

  const roots: (Node | string)[] = [];
  const stack: Node[] = [];

  const parser = fastStream({
    onopentag(tagName, attributes) {
      const el: Node = {
        tagName,
        attributes: attributes as Record<string, string>,
        children: [],
      };
      if (stack.length > 0) {
        stack[stack.length - 1]!.children.push(el);
      } else {
        roots.push(el);
      }
      stack.push(el);
    },
    ontext(text) {
      if (stack.length > 0) {
        stack[stack.length - 1]!.children.push(text);
      } else {
        roots.push(text);
      }
    },
    oncdata(cdata) {
      if (stack.length > 0) {
        stack[stack.length - 1]!.children.push(cdata);
      } else {
        roots.push(cdata);
      }
    },
    onclosetag() {
      stack.pop();
    },
  });

  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.close();

  return roots.filter((r): r is Node => typeof r !== 'string');
}

// ---------------------------------------------------------------------------
// fast-xml-parser — sync, builds its own tree (included for reference)
// ---------------------------------------------------------------------------
const fxp = new XMLParser({
  ignoreAttributes: false,
  preserveOrder: true,
});
function fxpSync(xml: string): void {
  fxp.parse(xml);
}

// ---------------------------------------------------------------------------
// RSS feed — chunked streaming
// ---------------------------------------------------------------------------
describe('stream: RSS feed (256 B chunks)', () => {
  const size = 256;

  bench('eksml (transformStream)', async () => {
    await eksmlStream(rssFeed, size);
  });

  bench('eksml (fastStream)', () => {
    eksmlFastStream(rssFeed, size);
  });

  bench('sax', () => {
    saxStream(rssFeed, size);
  });

  bench('saxes', () => {
    saxesStream(rssFeed, size);
  });

  bench('htmlparser2', () => {
    htmlparser2Stream(rssFeed, size);
  });

  bench('fast-xml-parser (sync, no streaming)', () => {
    fxpSync(rssFeed);
  });
});

// ---------------------------------------------------------------------------
// XMLTV EPG — chunked streaming
// ---------------------------------------------------------------------------
describe('stream: XMLTV EPG (256 B chunks)', () => {
  const size = 256;

  bench('eksml (transformStream)', async () => {
    await eksmlStream(xmltvEpg, size);
  });

  bench('eksml (fastStream)', () => {
    eksmlFastStream(xmltvEpg, size);
  });

  bench('sax', () => {
    saxStream(xmltvEpg, size);
  });

  bench('saxes', () => {
    saxesStream(xmltvEpg, size);
  });

  bench('htmlparser2', () => {
    htmlparser2Stream(xmltvEpg, size);
  });

  bench('fast-xml-parser (sync, no streaming)', () => {
    fxpSync(xmltvEpg);
  });
});

// ---------------------------------------------------------------------------
// Maven POM — chunked streaming
// ---------------------------------------------------------------------------
describe('stream: Maven POM (256 B chunks)', () => {
  const size = 256;

  bench('eksml (transformStream)', async () => {
    await eksmlStream(pomXml, size);
  });

  bench('eksml (fastStream)', () => {
    eksmlFastStream(pomXml, size);
  });

  bench('sax', () => {
    saxStream(pomXml, size);
  });

  bench('saxes', () => {
    saxesStream(pomXml, size);
  });

  bench('htmlparser2', () => {
    htmlparser2Stream(pomXml, size);
  });

  bench('fast-xml-parser (sync, no streaming)', () => {
    fxpSync(pomXml);
  });
});

// ---------------------------------------------------------------------------
// Small chunk stress test — 64 B chunks on XMLTV EPG
// ---------------------------------------------------------------------------
describe('stream: XMLTV EPG (64 B chunks — stress)', () => {
  const size = 64;

  bench('eksml (transformStream)', async () => {
    await eksmlStream(xmltvEpg, size);
  });

  bench('eksml (fastStream)', () => {
    eksmlFastStream(xmltvEpg, size);
  });

  bench('sax', () => {
    saxStream(xmltvEpg, size);
  });

  bench('saxes', () => {
    saxesStream(xmltvEpg, size);
  });

  bench('htmlparser2', () => {
    htmlparser2Stream(xmltvEpg, size);
  });

  bench('fast-xml-parser (sync, no streaming)', () => {
    fxpSync(xmltvEpg);
  });
});
