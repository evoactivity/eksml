/**
 * Benchmarks comparing tojs (DOM-based) vs tojsevents (SAX-based) XML-to-JS
 * object conversion, and against fast-xml-parser and xml2js which produce
 * similar JS object output.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bench, describe } from "vitest";

// --- eksml ---
import { tojs } from "../src/tojs.js";
import { tojsevents } from "../src/tojsevents.js";
import { tojson } from "../src/tojson.js";

// --- competitors ---
import { XMLParser } from "fast-xml-parser";
import { parseStringPromise } from "xml2js";

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
const pomXml = fixture("pom.xml");
const xmltvEpg = fixture("xmltv-epg.xml");

// Pre-instantiate reusable parser instances
const fxp = new XMLParser({ ignoreAttributes: false });

// ---------------------------------------------------------------------------
// Small document — ~100 bytes
// ---------------------------------------------------------------------------
describe("tojs: small XML (~100 B)", () => {
  bench("tojs (DOM)", () => {
    tojs(small);
  });

  bench("tojsevents (SAX)", () => {
    tojsevents(small);
  });

  bench("tojson (DOM)", () => {
    tojson(small);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(small);
  });

  bench("xml2js", async () => {
    await parseStringPromise(small);
  });
});

// ---------------------------------------------------------------------------
// RSS feed — ~3 KB
// ---------------------------------------------------------------------------
describe("tojs: RSS feed (~3 KB)", () => {
  bench("tojs (DOM)", () => {
    tojs(rssFeed);
  });

  bench("tojsevents (SAX)", () => {
    tojsevents(rssFeed);
  });

  bench("tojson (DOM)", () => {
    tojson(rssFeed);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(rssFeed);
  });

  bench("xml2js", async () => {
    await parseStringPromise(rssFeed);
  });
});

// ---------------------------------------------------------------------------
// SOAP envelope — ~3 KB
// ---------------------------------------------------------------------------
describe("tojs: SOAP envelope (~3 KB)", () => {
  bench("tojs (DOM)", () => {
    tojs(soapEnvelope);
  });

  bench("tojsevents (SAX)", () => {
    tojsevents(soapEnvelope);
  });

  bench("tojson (DOM)", () => {
    tojson(soapEnvelope);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(soapEnvelope);
  });

  bench("xml2js", async () => {
    await parseStringPromise(soapEnvelope);
  });
});

// ---------------------------------------------------------------------------
// Atom feed — ~6 KB
// ---------------------------------------------------------------------------
describe("tojs: Atom feed (~6 KB)", () => {
  bench("tojs (DOM)", () => {
    tojs(atomFeed);
  });

  bench("tojsevents (SAX)", () => {
    tojsevents(atomFeed);
  });

  bench("tojson (DOM)", () => {
    tojson(atomFeed);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(atomFeed);
  });

  bench("xml2js", async () => {
    await parseStringPromise(atomFeed);
  });
});

// ---------------------------------------------------------------------------
// Maven POM — ~8 KB
// ---------------------------------------------------------------------------
describe("tojs: Maven POM (~8 KB)", () => {
  bench("tojs (DOM)", () => {
    tojs(pomXml);
  });

  bench("tojsevents (SAX)", () => {
    tojsevents(pomXml);
  });

  bench("tojson (DOM)", () => {
    tojson(pomXml);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(pomXml);
  });

  bench("xml2js", async () => {
    await parseStringPromise(pomXml);
  });
});

// ---------------------------------------------------------------------------
// XMLTV EPG — ~30 KB
// ---------------------------------------------------------------------------
describe("tojs: XMLTV EPG (~30 KB)", () => {
  bench("tojs (DOM)", () => {
    tojs(xmltvEpg);
  });

  bench("tojsevents (SAX)", () => {
    tojsevents(xmltvEpg);
  });

  bench("tojson (DOM)", () => {
    tojson(xmltvEpg);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(xmltvEpg);
  });

  bench("xml2js", async () => {
    await parseStringPromise(xmltvEpg);
  });
});
