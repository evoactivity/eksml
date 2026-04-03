/**
 * Benchmarks comparing eksml object converters (lossless, lossy) against
 * fast-xml-parser and xml2js which produce similar JS object output.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bench, describe } from "vitest";

// --- eksml ---
import { lossless } from "../src/converters/lossless.ts";
import { lossy } from "../src/converters/lossy.ts";

// --- competitors ---
import { XMLParser } from "fast-xml-parser";
import { parseStringPromise } from "xml2js";
// @ts-expect-error — txml's package.json exports don't include types
import {
  parse as txmlParse,
  simplify as txmlSimplify,
  simplifyLostLess as txmlSimplifyLossless,
} from "txml";

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
describe("convert: small XML (~100 B)", () => {
  bench("lossless", () => {
    lossless(small);
  });

  bench("lossy", () => {
    lossy(small);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(small);
  });

  bench("xml2js", async () => {
    await parseStringPromise(small);
  });

  bench("txml (simplify)", () => {
    txmlSimplify(txmlParse(small));
  });

  bench("txml (simplifyLossless)", () => {
    txmlSimplifyLossless(txmlParse(small));
  });
});

// ---------------------------------------------------------------------------
// RSS feed — ~3 KB
// ---------------------------------------------------------------------------
describe("convert: RSS feed (~3 KB)", () => {
  bench("lossless", () => {
    lossless(rssFeed);
  });

  bench("lossy", () => {
    lossy(rssFeed);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(rssFeed);
  });

  bench("xml2js", async () => {
    await parseStringPromise(rssFeed);
  });

  bench("txml (simplify)", () => {
    txmlSimplify(txmlParse(rssFeed));
  });

  bench("txml (simplifyLossless)", () => {
    txmlSimplifyLossless(txmlParse(rssFeed));
  });
});

// ---------------------------------------------------------------------------
// SOAP envelope — ~3 KB
// ---------------------------------------------------------------------------
describe("convert: SOAP envelope (~3 KB)", () => {
  bench("lossless", () => {
    lossless(soapEnvelope);
  });

  bench("lossy", () => {
    lossy(soapEnvelope);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(soapEnvelope);
  });

  bench("xml2js", async () => {
    await parseStringPromise(soapEnvelope);
  });

  bench("txml (simplify)", () => {
    txmlSimplify(txmlParse(soapEnvelope));
  });

  bench("txml (simplifyLossless)", () => {
    txmlSimplifyLossless(txmlParse(soapEnvelope));
  });
});

// ---------------------------------------------------------------------------
// Atom feed — ~6 KB
// ---------------------------------------------------------------------------
describe("convert: Atom feed (~6 KB)", () => {
  bench("lossless", () => {
    lossless(atomFeed);
  });

  bench("lossy", () => {
    lossy(atomFeed);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(atomFeed);
  });

  bench("xml2js", async () => {
    await parseStringPromise(atomFeed);
  });

  bench("txml (simplify)", () => {
    txmlSimplify(txmlParse(atomFeed));
  });

  bench("txml (simplifyLossless)", () => {
    txmlSimplifyLossless(txmlParse(atomFeed));
  });
});

// ---------------------------------------------------------------------------
// Maven POM — ~8 KB
// ---------------------------------------------------------------------------
describe("convert: Maven POM (~8 KB)", () => {
  bench("lossless", () => {
    lossless(pomXml);
  });

  bench("lossy", () => {
    lossy(pomXml);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(pomXml);
  });

  bench("xml2js", async () => {
    await parseStringPromise(pomXml);
  });

  bench("txml (simplify)", () => {
    txmlSimplify(txmlParse(pomXml));
  });

  bench("txml (simplifyLossless)", () => {
    txmlSimplifyLossless(txmlParse(pomXml));
  });
});

// ---------------------------------------------------------------------------
// XMLTV EPG — ~30 KB
// ---------------------------------------------------------------------------
describe("convert: XMLTV EPG (~30 KB)", () => {
  bench("lossless", () => {
    lossless(xmltvEpg);
  });

  bench("lossy", () => {
    lossy(xmltvEpg);
  });

  bench("fast-xml-parser", () => {
    fxp.parse(xmltvEpg);
  });

  bench("xml2js", async () => {
    await parseStringPromise(xmltvEpg);
  });

  bench("txml (simplify)", () => {
    txmlSimplify(txmlParse(xmltvEpg));
  });

  bench("txml (simplifyLossless)", () => {
    txmlSimplifyLossless(txmlParse(xmltvEpg));
  });
});
