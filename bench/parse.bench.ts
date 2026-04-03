/**
 * DOM/tree-parsing benchmarks: eksml vs fast-xml-parser, xml2js, @xmldom/xmldom, htmlparser2, txml
 *
 * sax and saxes are SAX (event-based) parsers — they don't produce a tree,
 * so they are benchmarked in stream.bench.ts instead.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bench, describe } from "vitest";

// --- eksml ---
import { parse } from "../src/parser.js";

// --- competitors ---
import { XMLParser } from "fast-xml-parser";
import { parseStringPromise } from "xml2js";
import { DOMParser } from "@xmldom/xmldom";
import { parseDocument } from "htmlparser2";
// @ts-expect-error — txml's package.json exports don't include types
import { parse as txmlParse } from "txml";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "../test/fixtures", name), "utf-8");

const small = `<?xml version="1.0"?><root><item id="1">hello</item><item id="2">world</item></root>`;
const rssFeed = fixture("rss-feed.xml");
const soapEnvelope = fixture("soap-envelope.xml");
const atomFeed = fixture("atom-feed.xml");
const xhtmlPage = fixture("xhtml-page.xml");
const pomXml = fixture("pom.xml");
const xmltvEpg = fixture("xmltv-epg.xml");

// Pre-instantiate reusable parser instances
const fxp = new XMLParser();
const domParser = new DOMParser();

// ---------------------------------------------------------------------------
// Small document — ~100 bytes
// ---------------------------------------------------------------------------
describe("small XML (~100 B)", () => {
  bench("eksml", () => {
    parse(small);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(small);
  });

  bench("xml2js", async () => {
    await parseStringPromise(small);
  });

  bench("@xmldom/xmldom", () => {
    domParser.parseFromString(small, "text/xml");
  });

  bench("htmlparser2", () => {
    parseDocument(small);
  });

  bench("txml", () => {
    txmlParse(small);
  });
});

// ---------------------------------------------------------------------------
// RSS feed — ~3-4 KB
// ---------------------------------------------------------------------------
describe("RSS feed (~3 KB)", () => {
  bench("eksml", () => {
    parse(rssFeed);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(rssFeed);
  });

  bench("xml2js", async () => {
    await parseStringPromise(rssFeed);
  });

  bench("@xmldom/xmldom", () => {
    domParser.parseFromString(rssFeed, "text/xml");
  });

  bench("htmlparser2", () => {
    parseDocument(rssFeed);
  });

  bench("txml", () => {
    txmlParse(rssFeed);
  });
});

// ---------------------------------------------------------------------------
// SOAP envelope — ~2-3 KB
// ---------------------------------------------------------------------------
describe("SOAP envelope (~2 KB)", () => {
  bench("eksml", () => {
    parse(soapEnvelope);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(soapEnvelope);
  });

  bench("xml2js", async () => {
    await parseStringPromise(soapEnvelope);
  });

  bench("@xmldom/xmldom", () => {
    domParser.parseFromString(soapEnvelope, "text/xml");
  });

  bench("htmlparser2", () => {
    parseDocument(soapEnvelope);
  });

  bench("txml", () => {
    txmlParse(soapEnvelope);
  });
});

// ---------------------------------------------------------------------------
// Atom feed — ~3-4 KB
// ---------------------------------------------------------------------------
describe("Atom feed (~3 KB)", () => {
  bench("eksml", () => {
    parse(atomFeed);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(atomFeed);
  });

  bench("xml2js", async () => {
    await parseStringPromise(atomFeed);
  });

  bench("@xmldom/xmldom", () => {
    domParser.parseFromString(atomFeed, "text/xml");
  });

  bench("htmlparser2", () => {
    parseDocument(atomFeed);
  });

  bench("txml", () => {
    txmlParse(atomFeed);
  });
});

// ---------------------------------------------------------------------------
// XHTML page — ~5-8 KB
// ---------------------------------------------------------------------------
describe("XHTML page (~6 KB)", () => {
  bench("eksml", () => {
    parse(xhtmlPage);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(xhtmlPage);
  });

  bench("xml2js", async () => {
    await parseStringPromise(xhtmlPage);
  });

  bench("@xmldom/xmldom", () => {
    domParser.parseFromString(xhtmlPage, "text/xml");
  });

  bench("htmlparser2", () => {
    parseDocument(xhtmlPage);
  });

  bench("txml", () => {
    txmlParse(xhtmlPage);
  });
});

// ---------------------------------------------------------------------------
// Maven POM — ~5-6 KB
// ---------------------------------------------------------------------------
describe("Maven POM (~5 KB)", () => {
  bench("eksml", () => {
    parse(pomXml);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(pomXml);
  });

  bench("xml2js", async () => {
    await parseStringPromise(pomXml);
  });

  bench("@xmldom/xmldom", () => {
    domParser.parseFromString(pomXml, "text/xml");
  });

  bench("htmlparser2", () => {
    parseDocument(pomXml);
  });

  bench("txml", () => {
    txmlParse(pomXml);
  });
});

// ---------------------------------------------------------------------------
// XMLTV EPG — ~8-10 KB
// ---------------------------------------------------------------------------
describe("XMLTV EPG (~9 KB)", () => {
  bench("eksml", () => {
    parse(xmltvEpg);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(xmltvEpg);
  });

  bench("xml2js", async () => {
    await parseStringPromise(xmltvEpg);
  });

  bench("@xmldom/xmldom", () => {
    domParser.parseFromString(xmltvEpg, "text/xml");
  });

  bench("htmlparser2", () => {
    parseDocument(xmltvEpg);
  });

  bench("txml", () => {
    txmlParse(xmltvEpg);
  });
});
