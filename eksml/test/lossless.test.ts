import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { lossless, type LosslessEntry } from "#src/converters/lossless.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures", name), "utf-8");

const rssFeed = fixture("rss-feed.xml");
const soapEnvelope = fixture("soap-envelope.xml");
const pomXml = fixture("pom.xml");

// ---- helpers ----

/** Get the children array from an element entry. */
function children(entry: LosslessEntry): LosslessEntry[] {
  const keys = Object.keys(entry);
  const key = keys.find(
    (k) => k !== "$attr" && k !== "$text" && k !== "$comment",
  );
  return key ? (entry as any)[key] : [];
}

/** Get the tag name from an element entry. */
function tagName(entry: LosslessEntry): string | undefined {
  const keys = Object.keys(entry);
  return keys.find((k) => k !== "$attr" && k !== "$text" && k !== "$comment");
}

/** Get attributes from an element entry (looks for $attr in children). */
function attrs(
  entry: LosslessEntry,
): Record<string, string | null> | undefined {
  const kids = children(entry);
  const attrEntry = kids.find(
    (k) => Object.keys(k).length === 1 && "$attr" in k,
  );
  return attrEntry ? (attrEntry as any).$attr : undefined;
}

/** Find all entries with a given tag name, recursively. */
function findDeep(entries: LosslessEntry[], name: string): LosslessEntry[] {
  const result: LosslessEntry[] = [];
  for (const entry of entries) {
    if (tagName(entry) === name) result.push(entry);
    const kids = children(entry);
    if (kids.length > 0) result.push(...findDeep(kids, name));
  }
  return result;
}

// =================================================================
// User's exact example
// =================================================================
describe("user example", () => {
  it("matches the exact expected output", () => {
    const result = lossless('<root attr="1"><item>hell<b>o</b></item></root>');
    expect(result).toMatchSnapshot();
  });
});

// =================================================================
// Basic parsing
// =================================================================
describe("basic parsing", () => {
  it("returns empty array for empty string", () => {
    expect(lossless("")).toMatchSnapshot();
  });

  it("parses a simple element", () => {
    expect(lossless("<test></test>")).toMatchSnapshot();
  });

  it("parses element with text child", () => {
    expect(lossless("<test>hello</test>")).toMatchSnapshot();
  });

  it("parses element with attributes", () => {
    expect(lossless('<test a="1" b="2"></test>')).toMatchSnapshot();
  });

  it("puts attributes first, then children", () => {
    expect(
      lossless('<root id="r"><child>text</child></root>'),
    ).toMatchSnapshot();
  });

  it("omits $attr entry when element has no attributes", () => {
    expect(lossless("<root><child>text</child></root>")).toMatchSnapshot();
  });

  it("parses nested elements", () => {
    expect(lossless("<a><b><c>deep</c></b></a>")).toMatchSnapshot();
  });

  it("parses multiple children", () => {
    expect(lossless("<root><a>1</a><b>2</b><c>3</c></root>")).toMatchSnapshot();
  });

  it("parses self-closing elements", () => {
    expect(lossless("<root><empty/></root>")).toMatchSnapshot();
  });

  it("parses mixed content preserving order", () => {
    expect(lossless("<p>Hello <b>world</b>!</p>")).toMatchSnapshot();
  });

  it("parses text-only input", () => {
    expect(lossless("just text")).toMatchSnapshot();
  });
});

// =================================================================
// Attributes
// =================================================================
describe("attributes", () => {
  it("parses boolean attributes as null", () => {
    expect(lossless("<input disabled checked/>")).toMatchSnapshot();
  });

  it("parses empty string attributes", () => {
    expect(lossless('<input value=""/>')).toMatchSnapshot();
  });

  it("preserves attribute order", () => {
    expect(lossless('<el z="3" a="1" m="2"/>')).toMatchSnapshot();
  });

  it("handles namespace attributes", () => {
    expect(
      lossless(
        '<root xmlns:ns="http://example.com"><ns:elem ns:attr="val"/></root>',
      ),
    ).toMatchSnapshot();
  });
});

// =================================================================
// CDATA
// =================================================================
describe("CDATA", () => {
  it("represents CDATA as $text", () => {
    expect(
      lossless("<root><![CDATA[hello <world>]]></root>"),
    ).toMatchSnapshot();
  });

  it("handles standalone CDATA", () => {
    expect(lossless("<![CDATA[data]]>")).toMatchSnapshot();
  });
});

// =================================================================
// Comments
// =================================================================
describe("comments", () => {
  it("strips comments by default", () => {
    expect(lossless("<root><!-- comment --><child/></root>")).toMatchSnapshot();
  });

  it("preserves comments with keepComments", () => {
    expect(
      lossless("<root><!-- hello --><child/></root>", {
        keepComments: true,
      }),
    ).toMatchSnapshot();
  });

  it("preserves multiple comments", () => {
    expect(
      lossless("<root><!-- first -->text<!-- second --></root>", {
        keepComments: true,
      }),
    ).toMatchSnapshot();
  });
});

// =================================================================
// Processing instructions
// =================================================================
describe("processing instructions", () => {
  it("represents PI as element with ?-prefixed name", () => {
    const result = lossless('<?xml version="1.0" encoding="UTF-8"?><root/>');
    expect(result).toMatchSnapshot();
  });
});

// =================================================================
// HTML mode
// =================================================================
describe("HTML mode", () => {
  it("handles void elements", () => {
    expect(lossless("<div><br><hr></div>", { html: true })).toMatchSnapshot();
  });

  it("handles raw content tags", () => {
    expect(
      lossless("<div><script>var x = 1 < 2;</script></div>", {
        html: true,
      }),
    ).toMatchSnapshot();
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
    expect(lossless(open + "deep" + close)).toMatchSnapshot();
  });
});

// =================================================================
// Unicode
// =================================================================
describe("unicode", () => {
  it("preserves unicode in text and attributes", () => {
    expect(
      lossless('<msg lang="多语言">Hello 世界 🌍</msg>'),
    ).toMatchSnapshot();
  });
});

// =================================================================
// Fixtures
// =================================================================
describe("fixtures", () => {
  it("parses RSS feed", () => {
    expect(lossless(rssFeed)).toMatchSnapshot();
  });

  it("RSS feed preserves CDATA in description as $text", () => {
    const result = lossless(rssFeed);
    const descriptions = findDeep(result, "description");
    const first = descriptions[1]!; // first item's description (index 0 is channel description)
    const text = children(first).find((e) => "$text" in e) as any;
    expect(text).toBeDefined();
    expect(text.$text).toContain("<p>");
  });

  it("parses SOAP envelope with deep namespace nesting", () => {
    expect(lossless(soapEnvelope)).toMatchSnapshot();
  });

  it("parses Maven POM", () => {
    expect(lossless(pomXml)).toMatchSnapshot();
  });

  it("preserves comments in POM with keepComments", () => {
    expect(lossless(pomXml, { keepComments: true })).toMatchSnapshot();
  });
});

// =================================================================
// JSON serialization round-trip
// =================================================================
describe("JSON serialization", () => {
  it("result is fully JSON-serializable", () => {
    const result = lossless(
      '<root attr="1"><item id="a">hello</item><item id="b"><![CDATA[world]]></item></root>',
    );
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(result);
  });

  it("complex fixture round-trips through JSON", () => {
    const result = lossless(soapEnvelope);
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(result);
  });
});
