/**
 * Benchmarks comparing eksml writer (serializer) against competitor libraries'
 * builder/serializer implementations.
 *
 * Each benchmark pre-parses the XML into the library's native representation
 * so that only serialization time is measured.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bench, describe } from "vitest";

// --- eksml ---
import { parse } from "../src/parser.ts";
import { writer } from "../src/writer.ts";

// --- competitors ---
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import { Builder, parseStringPromise } from "xml2js";
// @ts-expect-error — txml's package.json exports don't include types
import { parse as txmlParse, stringify as txmlStringify } from "txml";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { parseDocument, DomUtils } from "htmlparser2";

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

// ---------------------------------------------------------------------------
// Pre-parse all fixtures into each library's native format
// (so benchmarks measure only serialization)
// ---------------------------------------------------------------------------

// eksml
const eksmlSmall = parse(small);
const eksmlRss = parse(rssFeed);
const eksmlSoap = parse(soapEnvelope);
const eksmlAtom = parse(atomFeed);
const eksmlPom = parse(pomXml);
const eksmlEpg = parse(xmltvEpg);

// fast-xml-parser
const fxpParser = new XMLParser({ ignoreAttributes: false });
const fxpBuilder = new XMLBuilder({ ignoreAttributes: false });
const fxpSmall = fxpParser.parse(small);
const fxpRss = fxpParser.parse(rssFeed);
const fxpSoap = fxpParser.parse(soapEnvelope);
const fxpAtom = fxpParser.parse(atomFeed);
const fxpPom = fxpParser.parse(pomXml);
const fxpEpg = fxpParser.parse(xmltvEpg);

// xml2js (async parse, sync build)
const xml2jsBuilder = new Builder({
  headless: true,
  renderOpts: { pretty: false, indent: "", newline: "" },
});
// Pre-parsed objects — filled in before benchmarks run
let xml2jsSmall: any;
let xml2jsRss: any;
let xml2jsSoap: any;
let xml2jsAtom: any;
let xml2jsPom: any;
let xml2jsEpg: any;

// Parse all xml2js fixtures at module load
await Promise.all([
  parseStringPromise(small).then((r) => (xml2jsSmall = r)),
  parseStringPromise(rssFeed).then((r) => (xml2jsRss = r)),
  parseStringPromise(soapEnvelope).then((r) => (xml2jsSoap = r)),
  parseStringPromise(atomFeed).then((r) => (xml2jsAtom = r)),
  parseStringPromise(pomXml).then((r) => (xml2jsPom = r)),
  parseStringPromise(xmltvEpg).then((r) => (xml2jsEpg = r)),
]);

// txml (crashes on RSS feed)
const txmlSmall = txmlParse(small);
const txmlSoap = txmlParse(soapEnvelope);
const txmlAtom = txmlParse(atomFeed);
const txmlPom = txmlParse(pomXml);
const txmlEpg = txmlParse(xmltvEpg);

// @xmldom/xmldom
const domParser = new DOMParser();
const xmlSerializer = new XMLSerializer();
const xmldomSmall = domParser.parseFromString(small, "text/xml");
const xmldomRss = domParser.parseFromString(rssFeed, "text/xml");
const xmldomSoap = domParser.parseFromString(soapEnvelope, "text/xml");
const xmldomAtom = domParser.parseFromString(atomFeed, "text/xml");
const xmldomPom = domParser.parseFromString(pomXml, "text/xml");
const xmldomEpg = domParser.parseFromString(xmltvEpg, "text/xml");

// htmlparser2
const hp2Opts = { xmlMode: true } as const;
const hp2Small = parseDocument(small, hp2Opts);
const hp2Rss = parseDocument(rssFeed, hp2Opts);
const hp2Soap = parseDocument(soapEnvelope, hp2Opts);
const hp2Atom = parseDocument(atomFeed, hp2Opts);
const hp2Pom = parseDocument(pomXml, hp2Opts);
const hp2Epg = parseDocument(xmltvEpg, hp2Opts);

// ---------------------------------------------------------------------------
// Small document — ~100 bytes
// ---------------------------------------------------------------------------
describe("write: small XML (~100 B)", () => {
  bench("eksml", () => {
    writer(eksmlSmall);
  });

  bench("fast-xml-parser", () => {
    fxpBuilder.build(fxpSmall);
  });

  bench("xml2js", () => {
    xml2jsBuilder.buildObject(xml2jsSmall);
  });

  bench("txml", () => {
    txmlStringify(txmlSmall);
  });

  bench("@xmldom/xmldom", () => {
    xmlSerializer.serializeToString(xmldomSmall);
  });

  bench("htmlparser2", () => {
    DomUtils.getOuterHTML(hp2Small, hp2Opts);
  });
});

// ---------------------------------------------------------------------------
// RSS feed — ~3 KB
// ---------------------------------------------------------------------------
describe("write: RSS feed (~3 KB)", () => {
  bench("eksml", () => {
    writer(eksmlRss);
  });

  bench("fast-xml-parser", () => {
    fxpBuilder.build(fxpRss);
  });

  bench("xml2js", () => {
    xml2jsBuilder.buildObject(xml2jsRss);
  });

  // txml crashes on RSS feed — omitted

  bench("@xmldom/xmldom", () => {
    xmlSerializer.serializeToString(xmldomRss);
  });

  bench("htmlparser2", () => {
    DomUtils.getOuterHTML(hp2Rss, hp2Opts);
  });
});

// ---------------------------------------------------------------------------
// SOAP envelope — ~3 KB
// ---------------------------------------------------------------------------
describe("write: SOAP envelope (~3 KB)", () => {
  bench("eksml", () => {
    writer(eksmlSoap);
  });

  bench("fast-xml-parser", () => {
    fxpBuilder.build(fxpSoap);
  });

  bench("xml2js", () => {
    xml2jsBuilder.buildObject(xml2jsSoap);
  });

  bench("txml", () => {
    txmlStringify(txmlSoap);
  });

  bench("@xmldom/xmldom", () => {
    xmlSerializer.serializeToString(xmldomSoap);
  });

  bench("htmlparser2", () => {
    DomUtils.getOuterHTML(hp2Soap, hp2Opts);
  });
});

// ---------------------------------------------------------------------------
// Atom feed — ~6 KB
// ---------------------------------------------------------------------------
describe("write: Atom feed (~6 KB)", () => {
  bench("eksml", () => {
    writer(eksmlAtom);
  });

  bench("fast-xml-parser", () => {
    fxpBuilder.build(fxpAtom);
  });

  bench("xml2js", () => {
    xml2jsBuilder.buildObject(xml2jsAtom);
  });

  bench("txml", () => {
    txmlStringify(txmlAtom);
  });

  bench("@xmldom/xmldom", () => {
    xmlSerializer.serializeToString(xmldomAtom);
  });

  bench("htmlparser2", () => {
    DomUtils.getOuterHTML(hp2Atom, hp2Opts);
  });
});

// ---------------------------------------------------------------------------
// Maven POM — ~8 KB
// ---------------------------------------------------------------------------
describe("write: Maven POM (~8 KB)", () => {
  bench("eksml", () => {
    writer(eksmlPom);
  });

  bench("fast-xml-parser", () => {
    fxpBuilder.build(fxpPom);
  });

  bench("xml2js", () => {
    xml2jsBuilder.buildObject(xml2jsPom);
  });

  bench("txml", () => {
    txmlStringify(txmlPom);
  });

  bench("@xmldom/xmldom", () => {
    xmlSerializer.serializeToString(xmldomPom);
  });

  bench("htmlparser2", () => {
    DomUtils.getOuterHTML(hp2Pom, hp2Opts);
  });
});

// ---------------------------------------------------------------------------
// XMLTV EPG — ~30 KB
// ---------------------------------------------------------------------------
describe("write: XMLTV EPG (~30 KB)", () => {
  bench("eksml", () => {
    writer(eksmlEpg);
  });

  bench("fast-xml-parser", () => {
    fxpBuilder.build(fxpEpg);
  });

  bench("xml2js", () => {
    xml2jsBuilder.buildObject(xml2jsEpg);
  });

  bench("txml", () => {
    txmlStringify(txmlEpg);
  });

  bench("@xmldom/xmldom", () => {
    xmlSerializer.serializeToString(xmldomEpg);
  });

  bench("htmlparser2", () => {
    DomUtils.getOuterHTML(hp2Epg, hp2Opts);
  });
});
