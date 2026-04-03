import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { tojs, type JsNode } from "../src/tojs.js";
import { tojsevents } from "../src/tojsevents.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures", name), "utf-8");

const rssFeed = fixture("rss-feed.xml");
const soapEnvelope = fixture("soap-envelope.xml");
const atomFeed = fixture("atom-feed.xml");
const pomXml = fixture("pom.xml");

// ---- helpers ----
function asJsNodes(result: (JsNode | string)[]): JsNode[] {
  return result.filter((n): n is JsNode => typeof n !== "string");
}

function findByName(
  children: (JsNode | string)[],
  name: string,
): JsNode | undefined {
  for (const child of children) {
    if (typeof child === "object" && child.$name === name) return child;
  }
  return undefined;
}

function findAllByName(
  children: (JsNode | string)[],
  name: string,
): JsNode[] {
  const result: JsNode[] = [];
  for (const child of children) {
    if (typeof child === "object" && child.$name === name) result.push(child);
  }
  return result;
}

function findDeep(nodes: (JsNode | string)[], name: string): JsNode[] {
  const out: JsNode[] = [];
  for (const node of nodes) {
    if (typeof node === "string") continue;
    if (node.$name === name) out.push(node);
    out.push(...findDeep(node.$children, name));
  }
  return out;
}

// =================================================================
// Both converters should produce identical output — run each test
// against both implementations.
// =================================================================
const converters = [
  { name: "tojs", fn: tojs },
  { name: "tojsevents", fn: tojsevents },
] as const;

for (const { name, fn } of converters) {
  describe(name, () => {
    // ---------------------------------------------------------------
    // Basic parsing
    // ---------------------------------------------------------------
    describe("basic parsing", () => {
      it("returns empty array for empty string", () => {
        expect(fn("")).toEqual([]);
      });

      it("parses a simple element", () => {
        expect(fn("<test></test>")).toEqual([
          { $name: "test", $attrs: {}, $children: [] },
        ]);
      });

      it("parses element with attributes", () => {
        expect(fn('<test att="v" att2="two"></test>')).toEqual([
          {
            $name: "test",
            $attrs: { att: "v", att2: "two" },
            $children: [],
          },
        ]);
      });

      it("parses element with text child", () => {
        expect(fn("<test>hello</test>")).toEqual([
          { $name: "test", $attrs: {}, $children: ["hello"] },
        ]);
      });

      it("parses nested elements", () => {
        const result = fn(
          '<root><child id="1">text</child><child id="2">more</child></root>',
        );
        expect(result).toEqual([
          {
            $name: "root",
            $attrs: {},
            $children: [
              { $name: "child", $attrs: { id: "1" }, $children: ["text"] },
              { $name: "child", $attrs: { id: "2" }, $children: ["more"] },
            ],
          },
        ]);
      });

      it("parses self-closing elements", () => {
        const result = fn("<root><empty/><also /></root>");
        const root = result[0] as JsNode;
        expect(root.$children).toHaveLength(2);
        expect((root.$children[0] as JsNode).$name).toBe("empty");
        expect((root.$children[0] as JsNode).$children).toEqual([]);
        expect((root.$children[1] as JsNode).$name).toBe("also");
      });

      it("parses text-only content", () => {
        expect(fn("just text")).toEqual(["just text"]);
      });

      it("parses mixed content", () => {
        const result = fn("<p>Hello <b>world</b>!</p>");
        const p = result[0] as JsNode;
        expect(p.$children).toHaveLength(3);
        expect(p.$children[0]).toBe("Hello");
        expect((p.$children[1] as JsNode).$name).toBe("b");
        expect((p.$children[1] as JsNode).$children).toEqual(["world"]);
        expect(p.$children[2]).toBe("!");
      });

      it("parses boolean attributes as null", () => {
        const result = fn("<input disabled checked/>");
        const input = result[0] as JsNode;
        expect(input.$attrs.disabled).toBeNull();
        expect(input.$attrs.checked).toBeNull();
      });

      it("parses empty string attributes", () => {
        const result = fn('<input value=""/>');
        const input = result[0] as JsNode;
        expect(input.$attrs.value).toBe("");
      });

      it("parses unicode content", () => {
        const result = fn('<msg lang="多语言">Hello 世界 🌍</msg>');
        const msg = result[0] as JsNode;
        expect(msg.$attrs.lang).toBe("多语言");
        expect(msg.$children[0]).toBe("Hello 世界 🌍");
      });

      it("parses deeply nested structure", () => {
        const depth = 20;
        const open = Array.from({ length: depth }, (_, i) => `<l${i}>`).join("");
        const close = Array.from(
          { length: depth },
          (_, i) => `</l${depth - 1 - i}>`,
        ).join("");
        const result = fn(open + "deep" + close);
        expect(result).toHaveLength(1);
        let cur = result[0] as JsNode;
        for (let i = 1; i < depth; i++) {
          expect(cur.$children).toHaveLength(1);
          cur = cur.$children[0] as JsNode;
          expect(cur.$name).toBe(`l${i}`);
        }
        expect(cur.$children[0]).toBe("deep");
      });
    });

    // ---------------------------------------------------------------
    // CDATA
    // ---------------------------------------------------------------
    describe("CDATA", () => {
      it("extracts CDATA content as text", () => {
        const result = fn("<root><![CDATA[hello <world>]]></root>");
        const root = result[0] as JsNode;
        expect(root.$children[0]).toBe("hello <world>");
      });

      it("handles standalone CDATA", () => {
        expect(fn("<![CDATA[data]]>")).toEqual(["data"]);
      });
    });

    // ---------------------------------------------------------------
    // Comments
    // ---------------------------------------------------------------
    describe("comments", () => {
      it("strips comments by default", () => {
        const result = fn("<root><!-- comment --><child/></root>");
        const root = result[0] as JsNode;
        expect(root.$children).toHaveLength(1);
        expect((root.$children[0] as JsNode).$name).toBe("child");
      });

      it("preserves comments with keepComments", () => {
        const result = fn("<root><!-- comment --><child/></root>", {
          keepComments: true,
        });
        const root = result[0] as JsNode;
        expect(root.$children).toHaveLength(2);
        expect(root.$children[0]).toBe("<!-- comment -->");
        expect((root.$children[1] as JsNode).$name).toBe("child");
      });
    });

    // ---------------------------------------------------------------
    // Processing instructions
    // ---------------------------------------------------------------
    describe("processing instructions", () => {
      it("parses XML declaration", () => {
        const result = fn(
          '<?xml version="1.0" encoding="UTF-8"?><root/>',
        );
        const elements = asJsNodes(result);
        const pi = elements.find((n) => n.$name === "?xml");
        expect(pi).toBeDefined();
        expect(pi!.$attrs.version).toBe("1.0");
        expect(pi!.$attrs.encoding).toBe("UTF-8");
        expect(pi!.$children).toEqual([]);
      });
    });

    // ---------------------------------------------------------------
    // Namespaces
    // ---------------------------------------------------------------
    describe("namespaces", () => {
      it("preserves namespace prefixes in tag names and attributes", () => {
        const result = fn(
          '<root xmlns:ns="http://example.com"><ns:elem ns:attr="val">text</ns:elem></root>',
        );
        const root = result[0] as JsNode;
        expect(root.$attrs["xmlns:ns"]).toBe("http://example.com");
        const child = root.$children[0] as JsNode;
        expect(child.$name).toBe("ns:elem");
        expect(child.$attrs["ns:attr"]).toBe("val");
        expect(child.$children[0]).toBe("text");
      });
    });

    // ---------------------------------------------------------------
    // HTML mode
    // ---------------------------------------------------------------
    describe("HTML mode", () => {
      it("handles void elements in HTML mode", () => {
        const result = fn("<div><br><hr><input></div>", { html: true });
        const div = result[0] as JsNode;
        expect(div.$children).toHaveLength(3);
        for (const child of div.$children) {
          expect((child as JsNode).$children).toEqual([]);
        }
      });

      it("handles raw content tags in HTML mode", () => {
        const result = fn(
          "<div><script>var x = 1 < 2;</script></div>",
          { html: true },
        );
        const div = result[0] as JsNode;
        const script = div.$children[0] as JsNode;
        expect(script.$name).toBe("script");
        expect(script.$children[0]).toBe("var x = 1 < 2;");
      });

      it("respects custom selfClosingTags", () => {
        const result = fn("<div><custom></div>", {
          selfClosingTags: ["custom"],
        });
        const div = result[0] as JsNode;
        const custom = div.$children[0] as JsNode;
        expect(custom.$name).toBe("custom");
        expect(custom.$children).toEqual([]);
      });

      it("respects custom rawContentTags", () => {
        const result = fn(
          "<div><raw><b>not parsed</b></raw></div>",
          { rawContentTags: ["raw"] },
        );
        const div = result[0] as JsNode;
        const raw = div.$children[0] as JsNode;
        expect(raw.$name).toBe("raw");
        expect(raw.$children[0]).toBe("<b>not parsed</b>");
      });
    });

    // ---------------------------------------------------------------
    // JsNode structure
    // ---------------------------------------------------------------
    describe("JsNode structure", () => {
      it("every element has $name, $attrs, $children", () => {
        const result = fn(
          '<root a="1"><child>text</child><empty/></root>',
        );
        function assertStructure(nodes: (JsNode | string)[]) {
          for (const node of nodes) {
            if (typeof node === "string") continue;
            expect(node).toHaveProperty("$name");
            expect(node).toHaveProperty("$attrs");
            expect(node).toHaveProperty("$children");
            expect(typeof node.$name).toBe("string");
            expect(typeof node.$attrs).toBe("object");
            expect(Array.isArray(node.$children)).toBe(true);
            assertStructure(node.$children);
          }
        }
        assertStructure(result);
      });

      it("preserves attribute order", () => {
        const result = fn('<el z="3" a="1" m="2"/>');
        const el = result[0] as JsNode;
        expect(Object.keys(el.$attrs)).toEqual(["z", "a", "m"]);
      });

      it("preserves child ordering for mixed content", () => {
        const result = fn(
          "<p>Start <b>bold</b> middle <i>italic</i> end</p>",
        );
        const p = result[0] as JsNode;
        expect(p.$children).toEqual([
          "Start",
          { $name: "b", $attrs: {}, $children: ["bold"] },
          "middle",
          { $name: "i", $attrs: {}, $children: ["italic"] },
          "end",
        ]);
      });
    });

    // ---------------------------------------------------------------
    // Fixtures
    // ---------------------------------------------------------------
    describe("fixtures", () => {
      it("parses RSS feed", () => {
        const result = fn(rssFeed);
        const elements = asJsNodes(result);
        expect(elements.length).toBeGreaterThan(0);
        const rss = findByName(result, "rss");
        expect(rss).toBeDefined();
        expect(rss!.$attrs.version).toBe("2.0");
        const items = findDeep(result, "item");
        expect(items).toHaveLength(3);
      });

      it("parses SOAP envelope with namespaces", () => {
        const result = fn(soapEnvelope);
        const envelope = findByName(result, "soap:Envelope");
        expect(envelope).toBeDefined();
        expect(envelope!.$attrs["xmlns:soap"]).toBe(
          "http://schemas.xmlsoap.org/soap/envelope/",
        );
        const security = findDeep(result, "wsse:Security");
        expect(security).toHaveLength(1);
      });

      it("parses Atom feed with XHTML content", () => {
        const result = fn(atomFeed);
        const feed = findByName(result, "feed");
        expect(feed).toBeDefined();
        expect(feed!.$attrs.xmlns).toBe("http://www.w3.org/2005/Atom");
        const entries = findDeep(result, "entry");
        expect(entries).toHaveLength(3);
      });

      it("parses Maven POM with deep nesting", () => {
        const result = fn(pomXml);
        const project = findByName(result, "project");
        expect(project).toBeDefined();
        const deps = findDeep(result, "dependency");
        expect(deps.length).toBeGreaterThanOrEqual(20);
      });
    });
  });
}

// =================================================================
// Cross-converter consistency: both must produce identical output
// =================================================================
describe("tojs vs tojsevents consistency", () => {
  it("produces identical output for simple XML", () => {
    const xml = '<root attr="1"><a>text</a><b id="2"><c/></b></root>';
    expect(tojs(xml)).toEqual(tojsevents(xml));
  });

  it("produces identical output for XML with PI", () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?><root>content</root>';
    expect(tojs(xml)).toEqual(tojsevents(xml));
  });

  it("produces identical output for XML with comments", () => {
    const xml = "<root><!-- comment --><child/><!-- another --></root>";
    expect(tojs(xml, { keepComments: true })).toEqual(
      tojsevents(xml, { keepComments: true }),
    );
  });

  it("produces identical output for XML with CDATA", () => {
    const xml = "<root><![CDATA[some <data>]]></root>";
    expect(tojs(xml)).toEqual(tojsevents(xml));
  });

  it("produces identical output for mixed content", () => {
    const xml =
      "<article>Some <b>bold</b> and <i>italic</i> text.</article>";
    expect(tojs(xml)).toEqual(tojsevents(xml));
  });

  it("produces identical output for namespaced XML", () => {
    const xml =
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><req id="1"/></soap:Body></soap:Envelope>';
    expect(tojs(xml)).toEqual(tojsevents(xml));
  });

  it("produces identical output for RSS fixture", () => {
    expect(tojs(rssFeed)).toEqual(tojsevents(rssFeed));
  });

  it("produces identical output for SOAP fixture", () => {
    expect(tojs(soapEnvelope)).toEqual(tojsevents(soapEnvelope));
  });

  it("produces identical output for Atom fixture", () => {
    expect(tojs(atomFeed)).toEqual(tojsevents(atomFeed));
  });

  it("produces identical output for POM fixture", () => {
    expect(tojs(pomXml)).toEqual(tojsevents(pomXml));
  });

  it("produces identical output with keepComments on RSS", () => {
    expect(tojs(rssFeed, { keepComments: true })).toEqual(
      tojsevents(rssFeed, { keepComments: true }),
    );
  });

  it("produces identical output with keepComments on SOAP", () => {
    expect(tojs(soapEnvelope, { keepComments: true })).toEqual(
      tojsevents(soapEnvelope, { keepComments: true }),
    );
  });

  it("produces identical output in HTML mode", () => {
    const html =
      "<div><br><img src='a.png' alt='test'><script>x < 2;</script></div>";
    expect(tojs(html, { html: true })).toEqual(
      tojsevents(html, { html: true }),
    );
  });
});

// =================================================================
// DOCTYPE handling difference
// =================================================================
describe("DOCTYPE handling", () => {
  it("tojs preserves DOCTYPE as a string", () => {
    const result = tojs("<!DOCTYPE html><html></html>");
    expect(result[0]).toBe("!DOCTYPE html");
    expect((result[1] as JsNode).$name).toBe("html");
  });

  it("tojsevents drops DOCTYPE (fastStream does not emit doctype events)", () => {
    const result = tojsevents("<!DOCTYPE html><html></html>");
    // Only the html element is returned
    expect(result).toHaveLength(1);
    expect((result[0] as JsNode).$name).toBe("html");
  });
});
