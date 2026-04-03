/**
 * Raw tokenization / SAX streaming benchmarks — no tree building.
 *
 * Measures pure tokenization throughput by registering no-op callbacks.
 * This isolates the parser's scanning and event-dispatch cost from any
 * downstream work (tree construction, string copying, etc.).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bench, describe } from "vitest";

// --- eksml ---
import { transformStream } from "../src/transformStream.js";
import { fastStream } from "../src/fastStream.js";

// --- competitors ---
import { Parser as Htmlparser2 } from "htmlparser2";
import sax from "sax";
import { SaxesParser } from "saxes";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "../test/fixtures", name), "utf-8");

const rssFeed = fixture("rss-feed.xml");
const xmltvEpg = fixture("xmltv-epg.xml");
const pomXml = fixture("pom.xml");

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

// No-op function used as callback
const noop = () => {};

// ---------------------------------------------------------------------------
// eksml transformStream — async, emits TNode trees
// ---------------------------------------------------------------------------
async function eksmlTransformStream(xml: string, chunkSize: number): Promise<void> {
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
// eksml fastStream — no-op callbacks
// ---------------------------------------------------------------------------
function eksmlFastStream(xml: string, chunkSize: number): void {
  const chunks = chunkString(xml, chunkSize);
  const parser = fastStream({
    onopentag: noop,
    onclosetag: noop,
    ontext: noop,
    oncdata: noop,
    oncomment: noop,
    onprocessinginstruction: noop,
  });
  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.close();
}

// ---------------------------------------------------------------------------
// sax — no-op callbacks
// ---------------------------------------------------------------------------
function saxStream(xml: string, chunkSize: number): void {
  const chunks = chunkString(xml, chunkSize);
  const parser = sax.parser(true);
  parser.onopentag = noop;
  parser.onclosetag = noop;
  parser.ontext = noop;
  parser.oncdata = noop;
  parser.oncomment = noop;
  parser.onprocessinginstruction = noop;
  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.close();
}

// ---------------------------------------------------------------------------
// saxes — no-op callbacks
// ---------------------------------------------------------------------------
function saxesStream(xml: string, chunkSize: number): void {
  const chunks = chunkString(xml, chunkSize);
  const parser = new SaxesParser();
  parser.on("opentag", noop);
  parser.on("closetag", noop);
  parser.on("text", noop);
  parser.on("cdata", noop);
  parser.on("comment", noop);
  parser.on("processinginstruction", noop);
  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.close();
}

// ---------------------------------------------------------------------------
// htmlparser2 — no-op callbacks
// ---------------------------------------------------------------------------
function htmlparser2Stream(xml: string, chunkSize: number): void {
  const chunks = chunkString(xml, chunkSize);
  const parser = new Htmlparser2(
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
  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.end();
}

// ---------------------------------------------------------------------------
// RSS feed — 256 B chunks
// ---------------------------------------------------------------------------
describe("tokenize: RSS feed (256 B chunks)", () => {
  const size = 256;

  bench("eksml (transformStream)", async () => {
    await eksmlTransformStream(rssFeed, size);
  });

  bench("eksml (fastStream)", () => {
    eksmlFastStream(rssFeed, size);
  });

  bench("sax", () => {
    saxStream(rssFeed, size);
  });

  bench("saxes", () => {
    saxesStream(rssFeed, size);
  });

  bench("htmlparser2", () => {
    htmlparser2Stream(rssFeed, size);
  });
});

// ---------------------------------------------------------------------------
// XMLTV EPG — 256 B chunks
// ---------------------------------------------------------------------------
describe("tokenize: XMLTV EPG (256 B chunks)", () => {
  const size = 256;

  bench("eksml (transformStream)", async () => {
    await eksmlTransformStream(xmltvEpg, size);
  });

  bench("eksml (fastStream)", () => {
    eksmlFastStream(xmltvEpg, size);
  });

  bench("sax", () => {
    saxStream(xmltvEpg, size);
  });

  bench("saxes", () => {
    saxesStream(xmltvEpg, size);
  });

  bench("htmlparser2", () => {
    htmlparser2Stream(xmltvEpg, size);
  });
});

// ---------------------------------------------------------------------------
// Maven POM — 256 B chunks
// ---------------------------------------------------------------------------
describe("tokenize: Maven POM (256 B chunks)", () => {
  const size = 256;

  bench("eksml (transformStream)", async () => {
    await eksmlTransformStream(pomXml, size);
  });

  bench("eksml (fastStream)", () => {
    eksmlFastStream(pomXml, size);
  });

  bench("sax", () => {
    saxStream(pomXml, size);
  });

  bench("saxes", () => {
    saxesStream(pomXml, size);
  });

  bench("htmlparser2", () => {
    htmlparser2Stream(pomXml, size);
  });
});

// ---------------------------------------------------------------------------
// XMLTV EPG — 64 B chunks (stress test)
// ---------------------------------------------------------------------------
describe("tokenize: XMLTV EPG (64 B chunks — stress)", () => {
  const size = 64;

  bench("eksml (transformStream)", async () => {
    await eksmlTransformStream(xmltvEpg, size);
  });

  bench("eksml (fastStream)", () => {
    eksmlFastStream(xmltvEpg, size);
  });

  bench("sax", () => {
    saxStream(xmltvEpg, size);
  });

  bench("saxes", () => {
    saxesStream(xmltvEpg, size);
  });

  bench("htmlparser2", () => {
    htmlparser2Stream(xmltvEpg, size);
  });
});
