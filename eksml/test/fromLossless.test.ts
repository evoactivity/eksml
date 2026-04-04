import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { lossless } from "#src/converters/lossless.ts";
import { fromLossless } from "#src/converters/fromLossless.ts";
import { parse } from "#src/parser.ts";
import { writer } from "#src/writer.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures", name), "utf-8");

const rssFeed = fixture("rss-feed.xml");
const soapEnvelope = fixture("soap-envelope.xml");
const pomXml = fixture("pom.xml");

// =================================================================
// Basic round-trip: parse → lossless → fromLossless → compare to parse
// =================================================================
describe("basic round-trip", () => {
  it("simple element", () => {
    const xml = "<root>hello</root>";
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });

  it("element with attributes", () => {
    const xml = '<root attr="1" flag>text</root>';
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });

  it("nested elements", () => {
    const xml = "<a><b><c>deep</c></b></a>";
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });

  it("mixed content", () => {
    const xml = "<p>Hello <b>world</b>!</p>";
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });

  it("multiple children", () => {
    const xml = "<root><a>1</a><b>2</b><c>3</c></root>";
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });

  it("self-closing element", () => {
    const xml = "<root><empty/></root>";
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });

  it("empty string", () => {
    const dom = parse("");
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });
});

// =================================================================
// Attributes
// =================================================================
describe("attributes", () => {
  it("preserves boolean attributes as null", () => {
    const xml = "<input disabled checked/>";
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });

  it("preserves empty string attributes", () => {
    const xml = '<input value=""/>';
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });

  it("preserves attribute order", () => {
    const xml = '<el z="3" a="1" m="2"/>';
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });

  it("preserves namespace attributes", () => {
    const xml =
      '<root xmlns:ns="http://example.com"><ns:elem ns:attr="val"/></root>';
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });
});

// =================================================================
// Comments
// =================================================================
describe("comments", () => {
  it("round-trips comments when kept", () => {
    const xml = "<root><!-- hello --><child/></root>";
    const dom = parse(xml, { keepComments: true });
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });

  it("round-trips multiple comments", () => {
    const xml = "<root><!-- first -->text<!-- second --></root>";
    const dom = parse(xml, { keepComments: true });
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });
});

// =================================================================
// CDATA
// =================================================================
describe("CDATA", () => {
  it("round-trips CDATA as text", () => {
    const xml = "<root><![CDATA[hello <world>]]></root>";
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });
});

// =================================================================
// Processing instructions
// =================================================================
describe("processing instructions", () => {
  it("round-trips processing instructions", () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?><root/>';
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });
});

// =================================================================
// DOCTYPE
// =================================================================
describe("DOCTYPE", () => {
  it("round-trips simple DOCTYPE", () => {
    const xml = "<!DOCTYPE html><html></html>";
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });
});

// =================================================================
// Writer integration — fromLossless → writer produces same XML
// =================================================================
describe("writer integration", () => {
  it("simple element round-trips through writer", () => {
    const xml = '<root attr="1"><item>hello</item></root>';
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(writer(result)).toBe(writer(dom));
  });

  it("complex nested structure round-trips through writer", () => {
    const xml =
      '<root lang="en"><a href="/">link</a><b><c>deep</c></b></root>';
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(writer(result)).toBe(writer(dom));
  });

  it("mixed content round-trips through writer", () => {
    const xml = "<p>Hello <b>world</b> and <i>goodbye</i></p>";
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(writer(result)).toBe(writer(dom));
  });
});

// =================================================================
// Deep nesting
// =================================================================
describe("deep nesting", () => {
  it("handles deeply nested structures", () => {
    const depth = 20;
    const open = Array.from({ length: depth }, (_, i) => `<l${i}>`).join("");
    const close = Array.from(
      { length: depth },
      (_, i) => `</l${depth - 1 - i}>`,
    ).join("");
    const xml = open + "deep" + close;
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });
});

// =================================================================
// Fixtures — exact round-trip
// =================================================================
describe("fixtures", () => {
  it("RSS feed round-trips exactly", () => {
    const dom = parse(rssFeed);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });

  it("SOAP envelope round-trips exactly", () => {
    const dom = parse(soapEnvelope);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });

  it("POM round-trips exactly", () => {
    const dom = parse(pomXml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });

  it("POM with comments round-trips exactly", () => {
    const dom = parse(pomXml, { keepComments: true });
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });
});

// =================================================================
// JSON serialization — parse from JSON string
// =================================================================
describe("JSON deserialization", () => {
  it("fromLossless works on JSON.parse'd data", () => {
    const xml =
      '<root attr="1"><item id="a">hello</item><item id="b">world</item></root>';
    const dom = parse(xml);
    const entries = lossless(dom);
    const json = JSON.stringify(entries);
    const parsed = JSON.parse(json);
    const result = fromLossless(parsed);
    expect(result).toEqual(dom);
  });
});

// =================================================================
// Unicode
// =================================================================
describe("unicode", () => {
  it("preserves unicode in text and attributes", () => {
    const xml = '<msg lang="多语言">Hello 世界 🌍</msg>';
    const dom = parse(xml);
    const entries = lossless(dom);
    const result = fromLossless(entries);
    expect(result).toEqual(dom);
  });
});
