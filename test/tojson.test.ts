import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { tojson, type JsonEntry } from "../src/tojson.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures", name), "utf-8");

const rssFeed = fixture("rss-feed.xml");
const soapEnvelope = fixture("soap-envelope.xml");
const pomXml = fixture("pom.xml");

// ---- helpers ----

/** Get the children array from an element entry. */
function children(entry: JsonEntry): JsonEntry[] {
  const keys = Object.keys(entry);
  const key = keys.find((k) => k !== ":@" && k !== "#text" && k !== "#comment");
  return key ? (entry as any)[key] : [];
}

/** Get the tag name from an element entry. */
function tagName(entry: JsonEntry): string | undefined {
  const keys = Object.keys(entry);
  return keys.find((k) => k !== ":@" && k !== "#text" && k !== "#comment");
}

/** Get attributes from an element entry (looks for ":@" in children). */
function attrs(entry: JsonEntry): Record<string, string | null> | undefined {
  const kids = children(entry);
  const attrEntry = kids.find(
    (k) => Object.keys(k).length === 1 && ":@" in k,
  );
  return attrEntry ? (attrEntry as any)[":@"] : undefined;
}

/** Find all entries with a given tag name, recursively. */
function findDeep(entries: JsonEntry[], name: string): JsonEntry[] {
  const result: JsonEntry[] = [];
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
    const result = tojson(
      '<root attr="1"><item>hell<b>o</b></item></root>',
    );
    expect(result).toEqual([
      {
        root: [
          { ":@": { attr: "1" } },
          {
            item: [
              { "#text": "hell" },
              { b: [{ "#text": "o" }] },
            ],
          },
        ],
      },
    ]);
  });
});

// =================================================================
// Basic parsing
// =================================================================
describe("basic parsing", () => {
  it("returns empty array for empty string", () => {
    expect(tojson("")).toEqual([]);
  });

  it("parses a simple element", () => {
    expect(tojson("<test></test>")).toEqual([{ test: [] }]);
  });

  it("parses element with text child", () => {
    expect(tojson("<test>hello</test>")).toEqual([
      { test: [{ "#text": "hello" }] },
    ]);
  });

  it("parses element with attributes", () => {
    expect(tojson('<test a="1" b="2"></test>')).toEqual([
      { test: [{ ":@": { a: "1", b: "2" } }] },
    ]);
  });

  it("puts attributes first, then children", () => {
    const result = tojson('<root id="r"><child>text</child></root>');
    expect(result).toEqual([
      {
        root: [
          { ":@": { id: "r" } },
          { child: [{ "#text": "text" }] },
        ],
      },
    ]);
  });

  it("omits :@ entry when element has no attributes", () => {
    const result = tojson("<root><child>text</child></root>");
    const rootChildren = (result[0] as any).root;
    expect(rootChildren[0]).toEqual({ child: [{ "#text": "text" }] });
    expect(rootChildren.find((e: any) => ":@" in e)).toBeUndefined();
  });

  it("parses nested elements", () => {
    expect(
      tojson("<a><b><c>deep</c></b></a>"),
    ).toEqual([
      { a: [{ b: [{ c: [{ "#text": "deep" }] }] }] },
    ]);
  });

  it("parses multiple children", () => {
    expect(
      tojson("<root><a>1</a><b>2</b><c>3</c></root>"),
    ).toEqual([
      {
        root: [
          { a: [{ "#text": "1" }] },
          { b: [{ "#text": "2" }] },
          { c: [{ "#text": "3" }] },
        ],
      },
    ]);
  });

  it("parses self-closing elements", () => {
    expect(tojson("<root><empty/></root>")).toEqual([
      { root: [{ empty: [] }] },
    ]);
  });

  it("parses mixed content preserving order", () => {
    const result = tojson("<p>Hello <b>world</b>!</p>");
    expect(result).toEqual([
      {
        p: [
          { "#text": "Hello" },
          { b: [{ "#text": "world" }] },
          { "#text": "!" },
        ],
      },
    ]);
  });

  it("parses text-only input", () => {
    expect(tojson("just text")).toEqual([{ "#text": "just text" }]);
  });
});

// =================================================================
// Attributes
// =================================================================
describe("attributes", () => {
  it("parses boolean attributes as null", () => {
    const result = tojson("<input disabled checked/>");
    expect(attrs(result[0]!)).toEqual({ disabled: null, checked: null });
  });

  it("parses empty string attributes", () => {
    const result = tojson('<input value=""/>');
    expect(attrs(result[0]!)!.value).toBe("");
  });

  it("preserves attribute order", () => {
    const result = tojson('<el z="3" a="1" m="2"/>');
    const a = attrs(result[0]!);
    expect(Object.keys(a!)).toEqual(["z", "a", "m"]);
  });

  it("handles namespace attributes", () => {
    const result = tojson(
      '<root xmlns:ns="http://example.com"><ns:elem ns:attr="val"/></root>',
    );
    expect(attrs(result[0]!)!["xmlns:ns"]).toBe("http://example.com");
  });
});

// =================================================================
// CDATA
// =================================================================
describe("CDATA", () => {
  it("represents CDATA as #text", () => {
    expect(tojson("<root><![CDATA[hello <world>]]></root>")).toEqual([
      { root: [{ "#text": "hello <world>" }] },
    ]);
  });

  it("handles standalone CDATA", () => {
    expect(tojson("<![CDATA[data]]>")).toEqual([{ "#text": "data" }]);
  });
});

// =================================================================
// Comments
// =================================================================
describe("comments", () => {
  it("strips comments by default", () => {
    const result = tojson("<root><!-- comment --><child/></root>");
    expect(result).toEqual([{ root: [{ child: [] }] }]);
  });

  it("preserves comments with keepComments", () => {
    const result = tojson("<root><!-- hello --><child/></root>", {
      keepComments: true,
    });
    expect(result).toEqual([
      { root: [{ "#comment": " hello " }, { child: [] }] },
    ]);
  });

  it("preserves multiple comments", () => {
    const result = tojson(
      "<root><!-- first -->text<!-- second --></root>",
      { keepComments: true },
    );
    const rootChildren = (result[0] as any).root;
    expect(rootChildren).toEqual([
      { "#comment": " first " },
      { "#text": "text" },
      { "#comment": " second " },
    ]);
  });
});

// =================================================================
// Processing instructions
// =================================================================
describe("processing instructions", () => {
  it("represents PI as element with ?-prefixed name", () => {
    const result = tojson(
      '<?xml version="1.0" encoding="UTF-8"?><root/>',
    );
    expect(result).toHaveLength(2);
    const pi = result[0]!;
    expect(tagName(pi)).toBe("?xml");
    expect(attrs(pi)).toEqual({ version: "1.0", encoding: "UTF-8" });
  });
});

// =================================================================
// HTML mode
// =================================================================
describe("HTML mode", () => {
  it("handles void elements", () => {
    const result = tojson("<div><br><hr></div>", { html: true });
    const divChildren = (result[0] as any).div;
    expect(divChildren).toEqual([{ br: [] }, { hr: [] }]);
  });

  it("handles raw content tags", () => {
    const result = tojson(
      "<div><script>var x = 1 < 2;</script></div>",
      { html: true },
    );
    const script = (result[0] as any).div[0];
    expect(tagName(script)).toBe("script");
    expect(children(script)).toEqual([{ "#text": "var x = 1 < 2;" }]);
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
    const result = tojson(open + "deep" + close);
    expect(result).toHaveLength(1);
    let cur = result[0]!;
    for (let i = 0; i < depth; i++) {
      expect(tagName(cur)).toBe(`l${i}`);
      const kids = children(cur);
      if (i < depth - 1) {
        expect(kids).toHaveLength(1);
        cur = kids[0]!;
      } else {
        expect(kids).toEqual([{ "#text": "deep" }]);
      }
    }
  });
});

// =================================================================
// Unicode
// =================================================================
describe("unicode", () => {
  it("preserves unicode in text and attributes", () => {
    const result = tojson('<msg lang="多语言">Hello 世界 🌍</msg>');
    expect(result).toEqual([
      {
        msg: [
          { ":@": { lang: "多语言" } },
          { "#text": "Hello 世界 🌍" },
        ],
      },
    ]);
  });
});

// =================================================================
// Fixtures
// =================================================================
describe("fixtures", () => {
  it("parses RSS feed", () => {
    const result = tojson(rssFeed);
    expect(result.length).toBeGreaterThan(0);
    const items = findDeep(result, "item");
    expect(items).toHaveLength(3);
    // Each item should have children
    for (const item of items) {
      expect(children(item).length).toBeGreaterThan(0);
    }
  });

  it("RSS feed preserves CDATA in description as #text", () => {
    const result = tojson(rssFeed);
    const descriptions = findDeep(result, "description");
    const first = descriptions[1]!; // first item's description (index 0 is channel description)
    const text = children(first).find((e) => "#text" in e) as any;
    expect(text).toBeDefined();
    expect(text["#text"]).toContain("<p>");
  });

  it("parses SOAP envelope with deep namespace nesting", () => {
    const result = tojson(soapEnvelope);
    const envelope = result.find((e) => tagName(e) === "soap:Envelope")!;
    expect(envelope).toBeDefined();
    expect(attrs(envelope)!["xmlns:soap"]).toBe(
      "http://schemas.xmlsoap.org/soap/envelope/",
    );
    const security = findDeep(result, "wsse:Security");
    expect(security).toHaveLength(1);
    const refs = findDeep(result, "ds:Reference");
    expect(refs).toHaveLength(2);
  });

  it("parses Maven POM", () => {
    const result = tojson(pomXml);
    const project = result.find((e) => tagName(e) === "project")!;
    expect(project).toBeDefined();
    const deps = findDeep(result, "dependency");
    expect(deps.length).toBeGreaterThanOrEqual(20);
  });

  it("preserves comments in POM with keepComments", () => {
    const result = tojson(pomXml, { keepComments: true });
    const comments = findDeep(result, "#comment");
    // #comment entries won't be found by findDeep (different shape),
    // so search manually
    const allComments: string[] = [];
    function collect(entries: JsonEntry[]) {
      for (const entry of entries) {
        if ("#comment" in entry) {
          allComments.push((entry as any)["#comment"]);
        }
        const kids = children(entry);
        if (kids.length > 0) collect(kids);
      }
    }
    collect(result);
    expect(allComments.length).toBeGreaterThanOrEqual(5);
    expect(allComments.some((c) => c.includes("Spring Boot Starters"))).toBe(
      true,
    );
  });
});

// =================================================================
// JSON serialization round-trip
// =================================================================
describe("JSON serialization", () => {
  it("result is fully JSON-serializable", () => {
    const result = tojson(
      '<root attr="1"><item id="a">hello</item><item id="b"><![CDATA[world]]></item></root>',
    );
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(result);
  });

  it("complex fixture round-trips through JSON", () => {
    const result = tojson(soapEnvelope);
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(result);
  });
});
