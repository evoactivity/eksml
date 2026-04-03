import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  parse,
  filter,
  toContentString,
  getElementById,
  getElementsByClassName,
  isTextNode,
  isElementNode,
  HTML_VOID_ELEMENTS,
  HTML_RAW_CONTENT_TAGS,
  type TNode,
} from "../src/parser.js";
import { writer } from "../src/writer.js";
import assert from "node:assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures", name), "utf-8");

const commentedSvg = fixture("commented.svg");
const wordpadDocxDocument = fixture("wordpad.docx.document.xml");
const rssFeed = fixture("rss-feed.xml");
const soapEnvelope = fixture("soap-envelope.xml");
const atomFeed = fixture("atom-feed.xml");
const xhtmlPage = fixture("xhtml-page.xml");
const pomXml = fixture("pom.xml");
const htmlPage = fixture("html-page.html");

// =================================================================
// Tests ported from upstream tXml test suite
// =================================================================

describe("parse", () => {
  it("returns empty array for empty string", () => {
    expect(Array.isArray(parse(""))).toBe(true);
    expect(parse("")).toEqual([]);
  });

  it("simplest parsing test", () => {
    expect(parse("<test>")).toEqual([
      { tagName: "test", attributes: {}, children: [] },
    ]);
  });

  it("single attribute", () => {
    expect(parse('<test att="v">')).toEqual([
      { tagName: "test", attributes: { att: "v" }, children: [] },
    ]);
  });

  it("multiple attributes", () => {
    expect(parse('<test att="v" att2="two">')).toEqual([
      { tagName: "test", attributes: { att: "v", att2: "two" }, children: [] },
    ]);
  });

  it("single text node", () => {
    expect(parse("childTest")).toEqual(["childTest"]);
  });

  it("single child text", () => {
    expect(parse("<test>childTest")).toEqual([
      { tagName: "test", attributes: {}, children: ["childTest"] },
    ]);
  });

  it("simple closing tag", () => {
    expect(parse("<test></test>")).toEqual([
      { tagName: "test", attributes: {}, children: [] },
    ]);
  });

  it("two child nodes", () => {
    expect(parse("<test><cc></cc><cc></cc></test>")).toEqual([
      {
        tagName: "test",
        attributes: {},
        children: [
          { tagName: "cc", attributes: {}, children: [] },
          { tagName: "cc", attributes: {}, children: [] },
        ],
      },
    ]);
  });

  it("ignores comments by default", () => {
    expect(
      parse(
        '<!-- some comment --><test><cc c="d"><!-- some comment --></cc><!-- some comment --><cc>value<!-- some comment --></cc></test>',
      ),
    ).toEqual([
      {
        tagName: "test",
        attributes: {},
        children: [
          { tagName: "cc", children: [], attributes: { c: "d" } },
          { tagName: "cc", attributes: {}, children: ["value"] },
        ],
      },
    ]);
  });

  it("ignores doctype declaration", () => {
    expect(parse("<!DOCTYPE html><test><cc></cc><cc></cc></test>")).toEqual([
      "!DOCTYPE html",
      {
        tagName: "test",
        attributes: {},
        children: [
          { tagName: "cc", attributes: {}, children: [] },
          { tagName: "cc", attributes: {}, children: [] },
        ],
      },
    ]);
  });

  it("filter option", () => {
    expect(
      parse("<test><cc></cc><cc></cc></test>", {
        filter: (element) => element.tagName.toLowerCase() === "cc",
      }),
    ).toEqual([
      { tagName: "cc", attributes: {}, children: [] },
      { tagName: "cc", attributes: {}, children: [] },
    ]);
  });

  it("CSS with CDATA inside style (valid XML)", () => {
    expect(
      parse(
        "<test><style><![CDATA[*{some:10px;}/* <tag> comment */]]></style></test>",
      ),
    ).toEqual([
      {
        tagName: "test",
        attributes: {},
        children: [
          {
            tagName: "style",
            attributes: {},
            children: ["*{some:10px;}/* <tag> comment */"],
          },
        ],
      },
    ]);
  });

  it("does not cut off last character in style", () => {
    expect(parse('<style>p { color: "red" }</style>')).toEqual([
      {
        tagName: "style",
        attributes: {},
        children: ['p { color: "red" }'],
      },
    ]);
  });

  it("JavaScript with CDATA inside script (valid XML)", () => {
    expect(
      parse('<test><script><![CDATA[$("<div>")]]></script></test>'),
    ).toEqual([
      {
        tagName: "test",
        attributes: {},
        children: [
          {
            tagName: "script",
            attributes: {},
            children: ['$("<div>")'],
          },
        ],
      },
    ]);
  });

  it("attribute without value", () => {
    const s = "<test><something flag></something></test>";
    expect(writer(parse(s))).toBe(s);
  });

  it("CDATA", () => {
    expect(parse("<xml><![CDATA[some data]]></xml>")).toEqual([
      { tagName: "xml", attributes: {}, children: ["some data"] },
    ]);
  });

  it("standalone CDATA", () => {
    expect(parse("<![CDATA[nothing]]>")).toEqual(["nothing"]);
  });

  it("unclosed CDATA", () => {
    expect(parse("<![CDATA[nothing")).toEqual(["nothing"]);
  });

  it("keepComments option", () => {
    expect(parse("<test><!-- test --></test>", { keepComments: true })).toEqual(
      [{ tagName: "test", attributes: {}, children: ["<!-- test -->"] }],
    );
  });

  it("keeps two comments", () => {
    expect(
      parse("<test><!-- test --><!-- test2 --></test>", {
        keepComments: true,
      }),
    ).toEqual([
      {
        tagName: "test",
        attributes: {},
        children: ["<!-- test -->", "<!-- test2 -->"],
      },
    ]);
  });

  it("throws on wrong close tag", () => {
    expect(() => {
      parse("<user><name>robert</firstName><user>");
    }).toThrow();
  });

  it("SVG with comment", () => {
    expect(parse(commentedSvg, { trimWhitespace: true })).toEqual([
      {
        tagName: "?xml",
        attributes: { version: "1.0", encoding: "UTF-8" },
        children: [],
      },
      {
        tagName: "svg",
        attributes: { height: "200", width: "500" },
        children: [
          {
            tagName: "polyline",
            attributes: {
              points: "20,20 40,25 60,40 80,120 120,140 200,180",
              style: "fill:none;stroke:black;stroke-width:3",
            },
            children: [],
          },
        ],
      },
    ]);
  });

  it("preserves whitespace in text nodes by default", () => {
    const filtered = filter(
      parse(wordpadDocxDocument),
      (n) => n.tagName === "w:t",
    );
    expect(filtered[1]!.children[0]).toBe("    ");
  });

  it("trimWhitespace option trims and discards whitespace-only text nodes", () => {
    const filtered = filter(
      parse(wordpadDocxDocument, { trimWhitespace: true }),
      (n) => n.tagName === "w:t",
    );
    // The whitespace-only "    " child should be discarded
    expect(filtered[1]!.children).toEqual([]);
  });

  it("arbitrary text / lorem ipsum", () => {
    const loremIpsum =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
    expect(parse(loremIpsum)).toEqual([loremIpsum]);
  });

  it("mixed text with XML fragments", () => {
    const result = parse("Some text before <tag>content</tag> and after");
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("Some text before ");
    expect((result[1] as TNode).tagName).toBe("tag");
    expect(result[2]).toBe(" and after");
  });

  it("duplicate attributes (last wins)", () => {
    const result = parse('<test att="first" att="second" att="third">');
    expect((result[0] as TNode).attributes.att).toBe("third");
  });

  it("many attributes", () => {
    const result = parse(
      '<element id="test-id" class="cls" data-value="123" disabled aria-label="lbl" tabindex="0" role="button">',
    );
    const el = result[0] as TNode;
    expect(el.attributes.id).toBe("test-id");
    expect(el.attributes.class).toBe("cls");
    expect(el.attributes["data-value"]).toBe("123");
    expect(el.attributes.disabled).toBeNull();
    expect(el.attributes["aria-label"]).toBe("lbl");
    expect(el.attributes.tabindex).toBe("0");
    expect(el.attributes.role).toBe("button");
  });

  it("XML with namespaces", () => {
    const xml =
      '<root xmlns:custom="http://example.com/custom"><custom:element custom:attr="value">Content</custom:element></root>';
    const result = parse(xml);
    const root = result[0] as TNode;
    expect(root.attributes["xmlns:custom"]).toBe("http://example.com/custom");
    const child = root.children.find(
      (el) => typeof el === "object" && el.tagName === "custom:element",
    ) as TNode;
    expect(child).toBeDefined();
    expect(child.attributes["custom:attr"]).toBe("value");
  });

  it("deeply nested structure", () => {
    const depth = 50;
    const openTags = Array.from({ length: depth }, (_, i) => `<l${i}>`).join(
      "",
    );
    const closeTags = Array.from(
      { length: depth },
      (_, i) => `</l${depth - 1 - i}>`,
    ).join("");
    const result = parse(openTags + "deep" + closeTags);
    expect(result).toHaveLength(1);
    let cur = result[0] as TNode;
    for (let i = 1; i < depth; i++) {
      expect(cur.children).toHaveLength(1);
      cur = cur.children[0] as TNode;
      expect(cur.tagName).toBe(`l${i}`);
    }
    expect(cur.children[0]).toBe("deep");
  });

  it("self-closing tags (explicit slash)", () => {
    const result = parse("<root><empty></empty><sc/><sc2 /></root>");
    const root = result[0] as TNode;
    expect(root.children).toHaveLength(3);
    for (const child of root.children) {
      expect((child as TNode).children).toEqual([]);
    }
  });

  it("mixed quoted attributes", () => {
    const result = parse(
      `<e single='v1' double="v2" mixed='has "q"' other="has 'q'"/>`,
    );
    const el = result[0] as TNode;
    expect(el.attributes.single).toBe("v1");
    expect(el.attributes.double).toBe("v2");
    expect(el.attributes.mixed).toBe('has "q"');
    expect(el.attributes.other).toBe("has 'q'");
  });

  it("unicode and emoji", () => {
    const result = parse('<msg lang="多语言">Hello 世界 🌍</msg>');
    const el = result[0] as TNode;
    expect(el.attributes.lang).toBe("多语言");
    expect(el.children[0]).toBe("Hello 世界 🌍");
  });

  it("processing instructions", () => {
    const result = parse(
      '<?xml version="1.0" encoding="UTF-8"?><root>content</root>',
    );
    const root = result.find(
      (el) => typeof el === "object" && el.tagName === "root",
    ) as TNode;
    expect(root).toBeDefined();
    expect(root.children[0]).toBe("content");
  });

  it("HTML5 doctype", () => {
    const result = parse(
      "<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>",
    );
    expect(result[0]).toBe("!DOCTYPE html");
    const html = result.find(
      (el) => typeof el === "object" && el.tagName === "html",
    ) as TNode;
    expect(html).toBeDefined();
  });

  it("custom selfClosingTags option", () => {
    const result = parse("<div><custom></div>", {
      selfClosingTags: ["custom"],
    });
    const div = result[0] as TNode;
    const custom = div.children[0] as TNode;
    expect(custom.tagName).toBe("custom");
    expect(custom.children).toEqual([]);
  });

  it("null vs empty string vs value in attributes", () => {
    const result = parse('<input disabled required="" value="test" checked>');
    const el = result[0] as TNode;
    expect(el.attributes.disabled).toBeNull();
    expect(el.attributes.checked).toBeNull();
    expect(el.attributes.required).toBe("");
    expect(el.attributes.value).toBe("test");
  });
});

// =================================================================
// filter
// =================================================================
describe("filter", () => {
  it("allows nodes without children property", () => {
    expect(filter([{} as TNode], () => true)).toEqual([{}]);
  });

  it("filters top-level nodes by tagName", () => {
    const root = parse("<root><a></a><b></b><a></a></root>")[0] as TNode;
    const result = filter(root.children, (n) => n.tagName === "a");
    expect(result).toHaveLength(2);
    expect(result.every((n) => n.tagName === "a")).toBe(true);
  });

  it("filters recursively into children", () => {
    const root = parse("<root><a><b></b></a></root>")[0] as TNode;
    const result = filter(root.children, (n) => n.tagName === "b");
    expect(result).toHaveLength(1);
    expect(result[0]!.tagName).toBe("b");
  });

  it("provides depth and path to filter function", () => {
    const root = parse("<root><a><b></b></a></root>")[0] as TNode;
    const calls: { depth: number; path: string }[] = [];
    filter(root.children, (_n, _i, depth, path) => {
      calls.push({ depth, path });
      return false;
    });
    expect(calls[0]!.depth).toBe(0);
    expect(calls[1]!.depth).toBe(1);
    expect(calls[1]!.path).toContain("a");
  });

  it("returns empty array when nothing matches", () => {
    const root = parse("<root><a></a></root>")[0] as TNode;
    expect(filter(root.children, (n) => n.tagName === "z")).toEqual([]);
  });
});

// =================================================================
// writer
// =================================================================
describe("writer", () => {
  it("roundtrips optimal XML", () => {
    const x = '<test a="value"><child a=\'g"g\'>text</child></test>';
    expect(writer(parse(x))).toBe(x);
  });

  it("roundtrips attribute without value", () => {
    const s = "<test><something flag></something></test>";
    expect(writer(parse(s))).toBe(s);
  });

  it("returns empty string for undefined", () => {
    expect(writer(undefined as any)).toBe("");
  });

  it("stringifies a simple element", () => {
    expect(writer({ tagName: "div", attributes: {}, children: [] })).toBe(
      "<div></div>",
    );
  });

  it("stringifies nested elements", () => {
    expect(
      writer({
        tagName: "a",
        attributes: {},
        children: [{ tagName: "b", attributes: {}, children: ["text"] }],
      }),
    ).toBe("<a><b>text</b></a>");
  });

  it("stringifies boolean attributes", () => {
    expect(
      writer({
        tagName: "input",
        attributes: { disabled: null },
        children: [],
      }),
    ).toBe("<input disabled></input>");
  });

  it("stringifies an array of nodes", () => {
    expect(
      writer([
        { tagName: "a", attributes: {}, children: [] },
        { tagName: "b", attributes: {}, children: [] },
      ]),
    ).toBe("<a></a><b></b>");
  });

  it("stringifies processing instructions", () => {
    expect(
      writer({
        tagName: "?xml",
        attributes: { version: "1.0" },
        children: [],
      }),
    ).toBe('<?xml version="1.0"?>');
  });

  it("uses single quotes when value contains double quotes", () => {
    expect(
      writer({
        tagName: "div",
        attributes: { data: 'he said "hi"' },
        children: [],
      }),
    ).toBe("<div data='he said \"hi\"'></div>");
  });

  // --- pretty option ---

  it("pretty: true uses 2-space indent", () => {
    const tree = parse("<root><child><leaf></leaf></child></root>");
    expect(writer(tree, { pretty: true })).toBe(
      "<root>\n  <child>\n    <leaf/>\n  </child>\n</root>",
    );
  });

  it("pretty: custom indent string", () => {
    const tree = parse("<root><child></child></root>");
    expect(writer(tree, { pretty: "\t" })).toBe("<root>\n\t<child/>\n</root>");
  });

  it("pretty: empty elements self-close", () => {
    expect(
      writer({ tagName: "br", attributes: {}, children: [] }, { pretty: true }),
    ).toBe("<br/>");
  });

  it("pretty: text-only elements stay inline", () => {
    const tree = parse("<name>Alice</name>");
    expect(writer(tree, { pretty: true })).toBe("<name>Alice</name>");
  });

  it("pretty: mixed content stays inline", () => {
    const tree = parse("<p>Hello <b>world</b>!</p>");
    expect(writer(tree, { pretty: true })).toBe("<p>Hello<b>world</b>!</p>");
  });

  it("pretty: processing instructions render correctly", () => {
    expect(
      writer(
        { tagName: "?xml", attributes: { version: "1.0" }, children: [] },
        { pretty: true },
      ),
    ).toBe('<?xml version="1.0"?>');
  });

  it("pretty: attributes are preserved", () => {
    const tree = parse('<root id="1"><child class="a"></child></root>');
    expect(writer(tree, { pretty: true })).toBe(
      '<root id="1">\n  <child class="a"/>\n</root>',
    );
  });

  it("pretty: multiple top-level nodes", () => {
    const tree = parse('<?xml version="1.0"?><root><a></a></root>');
    expect(writer(tree, { pretty: true })).toBe(
      '<?xml version="1.0"?>\n<root>\n  <a/>\n</root>',
    );
  });

  it("pretty: deeply nested structure", () => {
    const tree = parse("<a><b><c><d></d></c></b></a>");
    expect(writer(tree, { pretty: true })).toBe(
      "<a>\n  <b>\n    <c>\n      <d/>\n    </c>\n  </b>\n</a>",
    );
  });

  it("pretty: boolean attributes", () => {
    expect(
      writer(
        {
          tagName: "input",
          attributes: { disabled: null, type: "text" },
          children: [],
        },
        { pretty: true },
      ),
    ).toBe('<input disabled type="text"/>');
  });

  it("pretty: element-only children with text leaf", () => {
    const tree = parse(
      "<root><header><title>Hello</title></header><body></body></root>",
    );
    expect(writer(tree, { pretty: true })).toBe(
      "<root>\n  <header>\n    <title>Hello</title>\n  </header>\n  <body/>\n</root>",
    );
  });

  it("pretty: false is same as no option", () => {
    const tree = parse("<root><child></child></root>");
    expect(writer(tree, { pretty: false })).toBe(writer(tree));
  });

  it("pretty: mixed content with nested inline elements", () => {
    const tree = parse("<p>Click <a><b>here</b></a> now</p>");
    expect(writer(tree, { pretty: true })).toBe(
      "<p>Click<a><b>here</b></a>now</p>",
    );
  });

  it("pretty: four-space indent string", () => {
    const tree = parse("<root><child></child></root>");
    expect(writer(tree, { pretty: "    " })).toBe(
      "<root>\n    <child/>\n</root>",
    );
  });
});

// =================================================================
// toContentString
// =================================================================
describe("toContentString", () => {
  it("extracts text from mixed content", () => {
    expect(
      toContentString(parse('<test>f<case number="2">f</case>f</test>')),
    ).toBe("f f  f");
  });

  it("extracts text from deeply nested elements", () => {
    const dom = parse("<a><b><c>deep</c></b></a>");
    expect(toContentString(dom)).toBe("deep");
  });

  it("handles a plain string", () => {
    expect(toContentString("test")).toBe(" test");
  });

  it("handles a single TNode", () => {
    const el = parse("<p>hi</p>")[0] as TNode;
    expect(toContentString(el)).toBe("hi");
  });

  it("concatenates text from nested elements", () => {
    const dom = parse(
      "<article><title>The Title</title><p>First <b>bold</b>.</p></article>",
    );
    const content = toContentString(dom);
    expect(content).toContain("The Title");
    expect(content).toContain("bold");
  });
});

// =================================================================
// getElementById
// =================================================================
describe("getElementById", () => {
  it("finds an element by id", () => {
    const result = getElementById(
      '<test><child id="theId">found</child></test>',
      "theId",
    ) as TNode;
    expect(result).toEqual({
      tagName: "child",
      attributes: { id: "theId" },
      children: ["found"],
    });
  });

  it("returns undefined when id not found", () => {
    expect(
      getElementById("<div><span>no id</span></div>", "missing"),
    ).toBeUndefined();
  });
});

// =================================================================
// getElementsByClassName
// =================================================================
describe("getElementsByClassName", () => {
  it("finds elements by class name", () => {
    const result = getElementsByClassName(
      '<html><head></head><body><h1 class="test package-name other-class test2"></h1></body></html>',
      "package-name",
    );
    expect(result).toEqual([
      {
        tagName: "h1",
        attributes: {
          class: "test package-name other-class test2",
        },
        children: [],
      },
    ]);
  });

  it("finds multiple elements by class", () => {
    const html =
      '<div><span class="highlight active">1</span><span class="highlight">2</span><span class="active">3</span></div>';
    expect(getElementsByClassName(html, "highlight").length).toBe(2);
    expect(getElementsByClassName(html, "active").length).toBe(2);
  });
});

// =================================================================
// isTextNode / isElementNode
// =================================================================
describe("isTextNode", () => {
  it("returns true for strings", () => {
    expect(isTextNode("hello")).toBe(true);
  });

  it("returns false for TNode objects", () => {
    expect(isTextNode({ tagName: "div", attributes: {}, children: [] })).toBe(
      false,
    );
  });

  it("filters text nodes from parsed children", () => {
    const [div] = parse("<div>Hello <span>World</span>!</div>");
    assert(isElementNode(div!));
    const texts = div!.children.filter(isTextNode);
    expect(texts).toEqual(["Hello ", "!"]);
  });
});

describe("isElementNode", () => {
  it("returns true for TNode objects", () => {
    expect(
      isElementNode({ tagName: "div", attributes: {}, children: [] }),
    ).toBe(true);
  });

  it("returns false for strings", () => {
    expect(isElementNode("hello")).toBe(false);
  });

  it("filters element nodes from parsed children", () => {
    const [div] = parse("<div>Hello <span>World</span>!</div>");
    assert(isElementNode(div!));
    const elements = div!.children.filter(isElementNode);
    expect(elements).toHaveLength(1);
    assert(isElementNode(elements[0]!));
    expect(elements[0]!.tagName).toBe("span");
  });
});

// =================================================================
// Complex fixture tests — RSS feed
// =================================================================
describe("fixture: rss-feed.xml", () => {
  it("parses without error", () => {
    const result = parse(rssFeed);
    expect(result.length).toBeGreaterThan(0);
  });

  it("finds the rss root with version attribute", () => {
    const result = parse(rssFeed);
    const rss = result.find(
      (n) => typeof n === "object" && n.tagName === "rss",
    ) as TNode;
    expect(rss).toBeDefined();
    expect(rss.attributes.version).toBe("2.0");
    expect(rss.attributes["xmlns:atom"]).toBe("http://www.w3.org/2005/Atom");
    expect(rss.attributes["xmlns:dc"]).toBe("http://purl.org/dc/elements/1.1/");
  });

  it("extracts all three items", () => {
    const result = parse(rssFeed);
    const items = filter(result, (n) => n.tagName === "item");
    expect(items).toHaveLength(3);
  });

  it("extracts CDATA content in description", () => {
    const result = parse(rssFeed);
    const items = filter(result, (n) => n.tagName === "item");
    const desc = items[0]!.children.find(
      (c) => typeof c === "object" && c.tagName === "description",
    ) as TNode;
    expect(desc).toBeDefined();
    // CDATA content should be extracted as a text child
    const text = desc.children[0] as string;
    expect(text).toContain("<p>");
    expect(text).toContain("<strong>migrated</strong>");
  });

  it("handles ampersand in dc:creator", () => {
    const result = parse(rssFeed);
    const creators = filter(result, (n) => n.tagName === "dc:creator");
    const bobCarol = creators.find((c) =>
      (c.children[0] as string).includes("Bob"),
    );
    expect(bobCarol).toBeDefined();
    // &amp; is raw in XML, parser should preserve it as-is or decode
    expect(bobCarol!.children[0]).toContain("&");
  });

  it("finds multiple category elements per item", () => {
    const result = parse(rssFeed);
    const items = filter(result, (n) => n.tagName === "item");
    const firstItemCategories = items[0]!.children.filter(
      (c) => typeof c === "object" && c.tagName === "category",
    ) as TNode[];
    expect(firstItemCategories).toHaveLength(3);
    expect(firstItemCategories.map((c) => c.children[0])).toEqual([
      "Streams",
      "JavaScript",
      "Performance",
    ]);
  });

  it("roundtrips via writer then re-parse", () => {
    const result = parse(rssFeed, { trimWhitespace: true });
    const xml = writer(result);
    const reparsed = parse(xml, { trimWhitespace: true });
    // Same number of top-level nodes
    expect(reparsed.length).toBe(result.length);
    // Same number of items
    const originalItems = filter(result, (n) => n.tagName === "item");
    const reparsedItems = filter(reparsed, (n) => n.tagName === "item");
    expect(reparsedItems).toHaveLength(originalItems.length);
  });

  it("extracts text content from the entire feed", () => {
    const result = parse(rssFeed);
    const content = toContentString(result);
    expect(content).toContain("Tech Engineering Blog");
    expect(content).toContain("Migrating to Web Streams");
    expect(content).toContain("XML Parsing at Scale");
  });

  it("self-closing atom:link is parsed correctly", () => {
    const result = parse(rssFeed);
    const atomLinks = filter(result, (n) => n.tagName === "atom:link");
    expect(atomLinks.length).toBeGreaterThanOrEqual(1);
    expect(atomLinks[0]!.attributes.rel).toBe("self");
    expect(atomLinks[0]!.attributes.type).toBe("application/rss+xml");
  });
});

// =================================================================
// Complex fixture tests — SOAP envelope
// =================================================================
describe("fixture: soap-envelope.xml", () => {
  it("parses without error", () => {
    const result = parse(soapEnvelope);
    expect(result.length).toBeGreaterThan(0);
  });

  it("finds the soap:Envelope root with multiple namespace declarations", () => {
    const result = parse(soapEnvelope);
    const envelope = result.find(
      (n) => typeof n === "object" && n.tagName === "soap:Envelope",
    ) as TNode;
    expect(envelope).toBeDefined();
    expect(envelope.attributes["xmlns:soap"]).toBe(
      "http://schemas.xmlsoap.org/soap/envelope/",
    );
    expect(envelope.attributes["xmlns:wsse"]).toContain("wss-wssecurity");
    expect(envelope.attributes["xmlns:ds"]).toBe(
      "http://www.w3.org/2000/09/xmldsig#",
    );
  });

  it("finds soap:Header and soap:Body", () => {
    const result = parse(soapEnvelope);
    const envelope = result.find(
      (n) => typeof n === "object" && n.tagName === "soap:Envelope",
    ) as TNode;
    const header = envelope.children.find(
      (c) => typeof c === "object" && c.tagName === "soap:Header",
    ) as TNode;
    const body = envelope.children.find(
      (c) => typeof c === "object" && c.tagName === "soap:Body",
    ) as TNode;
    expect(header).toBeDefined();
    expect(body).toBeDefined();
    expect(body.attributes["wsu:Id"]).toBe("Body-1");
  });

  it("drills into deeply nested WS-Security elements", () => {
    const result = parse(soapEnvelope);
    const security = filter(result, (n) => n.tagName === "wsse:Security");
    expect(security).toHaveLength(1);
    expect(security[0]!.attributes["soap:mustUnderstand"]).toBe("1");

    const timestamps = filter(result, (n) => n.tagName === "wsu:Timestamp");
    expect(timestamps).toHaveLength(1);
    expect(timestamps[0]!.attributes["wsu:Id"]).toBe("TS-1");
  });

  it("finds ds:Reference elements with URI attributes", () => {
    const result = parse(soapEnvelope);
    const refs = filter(result, (n) => n.tagName === "ds:Reference");
    expect(refs).toHaveLength(2);
    const uris = refs.map((r) => r.attributes.URI);
    expect(uris).toContain("#TS-1");
    expect(uris).toContain("#Body-1");
  });

  it("finds self-closing elements with Algorithm attributes", () => {
    const result = parse(soapEnvelope);
    const methods = filter(
      result,
      (n) =>
        n.tagName === "ds:CanonicalizationMethod" ||
        n.tagName === "ds:SignatureMethod" ||
        n.tagName === "ds:DigestMethod" ||
        n.tagName === "ds:Transform",
    );
    expect(methods.length).toBeGreaterThanOrEqual(5);
    for (const m of methods) {
      expect(m.attributes.Algorithm).toBeDefined();
      expect(m.children).toEqual([]);
    }
  });

  it("finds the request body with nested filter elements", () => {
    const result = parse(soapEnvelope);
    const request = filter(
      result,
      (n) => n.tagName === "GetOrderDetailsRequest",
    );
    expect(request).toHaveLength(1);
    const statuses = filter(
      request[0]!.children,
      (n) => n.tagName === "Status",
    );
    expect(statuses).toHaveLength(3);
    expect(statuses.map((s) => s.children[0])).toEqual([
      "CONFIRMED",
      "SHIPPED",
      "DELIVERED",
    ]);
  });

  it("preserves comments with keepComments", () => {
    const result = parse(soapEnvelope, { keepComments: true });
    const allText = filter(result, () => false); // just to walk the tree
    // Check that the comment is a string child somewhere
    const envelope = result.find(
      (n) => typeof n === "object" && n.tagName === "soap:Envelope",
    ) as TNode;
    const header = envelope.children.find(
      (c) => typeof c === "object" && c.tagName === "soap:Header",
    ) as TNode;
    const commentChild = header.children.find(
      (c) => typeof c === "string" && c.includes("Correlation ID"),
    );
    expect(commentChild).toBeDefined();
  });
});

// =================================================================
// Complex fixture tests — Atom feed
// =================================================================
describe("fixture: atom-feed.xml", () => {
  it("parses without error", () => {
    const result = parse(atomFeed);
    expect(result.length).toBeGreaterThan(0);
  });

  it("finds the feed root with multiple namespace attributes", () => {
    const result = parse(atomFeed);
    const feed = result.find(
      (n) => typeof n === "object" && n.tagName === "feed",
    ) as TNode;
    expect(feed).toBeDefined();
    expect(feed.attributes.xmlns).toBe("http://www.w3.org/2005/Atom");
    expect(feed.attributes["xmlns:media"]).toBe(
      "http://search.yahoo.com/mrss/",
    );
    expect(feed.attributes["xmlns:georss"]).toBe(
      "http://www.georss.org/georss",
    );
    expect(feed.attributes["xml:lang"]).toBe("en");
  });

  it("extracts all three entries", () => {
    const result = parse(atomFeed);
    const entries = filter(result, (n) => n.tagName === "entry");
    expect(entries).toHaveLength(3);
  });

  it("finds multiple link elements with different rel attributes", () => {
    const result = parse(atomFeed);
    const feed = result.find(
      (n) => typeof n === "object" && n.tagName === "feed",
    ) as TNode;
    const links = feed.children.filter(
      (c) => typeof c === "object" && c.tagName === "link",
    ) as TNode[];
    expect(links.length).toBeGreaterThanOrEqual(4);
    const rels = links.map((l) => l.attributes.rel);
    expect(rels).toContain("alternate");
    expect(rels).toContain("self");
    expect(rels).toContain("next");
    expect(rels).toContain("hub");
  });

  it("parses XHTML content blocks within entries", () => {
    const result = parse(atomFeed);
    const entries = filter(result, (n) => n.tagName === "entry");
    const tsEntry = entries[0]!;
    const contentEl = tsEntry.children.find(
      (c) => typeof c === "object" && c.tagName === "content",
    ) as TNode;
    expect(contentEl).toBeDefined();
    expect(contentEl.attributes.type).toBe("xhtml");
    // Should contain a div child with XHTML namespace
    const div = contentEl.children.find(
      (c) => typeof c === "object" && c.tagName === "div",
    ) as TNode;
    expect(div).toBeDefined();
    expect(div.attributes.xmlns).toBe("http://www.w3.org/1999/xhtml");
  });

  it("finds media:group and georss elements", () => {
    const result = parse(atomFeed);
    const mediaGroups = filter(result, (n) => n.tagName === "media:group");
    expect(mediaGroups).toHaveLength(1);
    const mediaContent = filter(result, (n) => n.tagName === "media:content");
    expect(mediaContent).toHaveLength(1);
    expect(mediaContent[0]!.attributes.type).toBe("image/png");

    const georssPoints = filter(result, (n) => n.tagName === "georss:point");
    expect(georssPoints.length).toBeGreaterThanOrEqual(1);

    const gmlPoints = filter(result, (n) => n.tagName === "gml:Point");
    expect(gmlPoints).toHaveLength(1);
  });

  it("handles HTML entities in subtitle", () => {
    const result = parse(atomFeed);
    const subtitles = filter(result, (n) => n.tagName === "subtitle");
    expect(subtitles).toHaveLength(1);
    expect(subtitles[0]!.attributes.type).toBe("html");
  });

  it("parses entry with HTML-encoded content (Node.js 24 entry)", () => {
    const result = parse(atomFeed);
    const entries = filter(result, (n) => n.tagName === "entry");
    const nodeEntry = entries[2]!;
    const contentEl = nodeEntry.children.find(
      (c) => typeof c === "object" && c.tagName === "content",
    ) as TNode;
    expect(contentEl).toBeDefined();
    expect(contentEl.attributes.type).toBe("html");
    // HTML-encoded content should be a text child
    const text = contentEl.children[0] as string;
    expect(text).toContain("Node.js 24 LTS");
  });
});

// =================================================================
// Complex fixture tests — XHTML page
// =================================================================
describe("fixture: xhtml-page.xml", () => {
  it("parses without error", () => {
    const result = parse(xhtmlPage);
    expect(result.length).toBeGreaterThan(0);
  });

  it("finds doctype and html root", () => {
    const result = parse(xhtmlPage);
    const doctype = result.find(
      (n) => typeof n === "string" && n.startsWith("!DOCTYPE"),
    );
    expect(doctype).toBeDefined();

    const html = result.find(
      (n) => typeof n === "object" && n.tagName === "html",
    ) as TNode;
    expect(html).toBeDefined();
    expect(html.attributes.xmlns).toBe("http://www.w3.org/1999/xhtml");
    expect(html.attributes["xml:lang"]).toBe("en");
  });

  it("finds head with meta, title, link, and style elements", () => {
    const result = parse(xhtmlPage);
    const html = result.find(
      (n) => typeof n === "object" && n.tagName === "html",
    ) as TNode;
    const head = html.children.find(
      (c) => typeof c === "object" && c.tagName === "head",
    ) as TNode;
    expect(head).toBeDefined();

    const metas = head.children.filter(
      (c) => typeof c === "object" && c.tagName === "meta",
    ) as TNode[];
    expect(metas.length).toBeGreaterThanOrEqual(3);

    const title = head.children.find(
      (c) => typeof c === "object" && c.tagName === "title",
    ) as TNode;
    expect(title.children[0]).toContain("XHTML Fixture");

    const style = head.children.find(
      (c) => typeof c === "object" && c.tagName === "style",
    ) as TNode;
    expect(style).toBeDefined();
    // Style content should include the CSS with the <tag> comment
    const cssText = style.children
      .filter((c): c is string => typeof c === "string")
      .join("");
    expect(cssText).toContain("box-sizing");
    expect(cssText).toContain("<tag>");
  });

  it("finds self-closing meta and link elements", () => {
    const result = parse(xhtmlPage, {
      selfClosingTags: ["meta", "link", "img", "br", "input", "hr"],
    });
    const metas = filter(result, (n) => n.tagName === "meta");
    for (const meta of metas) {
      expect(meta.children).toEqual([]);
    }
    const links = filter(result, (n) => n.tagName === "link");
    for (const link of links) {
      expect(link.children).toEqual([]);
    }
  });

  it("preserves comments with keepComments", () => {
    const result = parse(xhtmlPage, { keepComments: true });
    // Collect all string children that are comments
    const allComments: string[] = [];
    function collectComments(nodes: (TNode | string)[]) {
      for (const node of nodes) {
        if (typeof node === "string" && node.startsWith("<!--")) {
          allComments.push(node);
        } else if (typeof node === "object") {
          collectComments(node.children);
        }
      }
    }
    collectComments(result);
    expect(allComments.length).toBeGreaterThanOrEqual(4);
    expect(allComments.some((c) => c.includes("Primary Navigation"))).toBe(
      true,
    );
    expect(allComments.some((c) => c.includes("Hero Section"))).toBe(true);
  });

  it("parses the feature comparison table", () => {
    const result = parse(xhtmlPage);
    const tables = filter(result, (n) => n.tagName === "table");
    const featureTable = tables.find(
      (t) => t.attributes.class === "feature-table",
    );
    expect(featureTable).toBeDefined();

    const rows = filter(featureTable!.children, (n) => n.tagName === "tr");
    // 1 header row + 5 data rows
    expect(rows).toHaveLength(6);

    const headerCells = filter(rows[0]!.children, (n) => n.tagName === "th");
    expect(headerCells).toHaveLength(5);

    // Check data-supported attributes
    const dataCells = filter(featureTable!.children, (n) => n.tagName === "td");
    const supportedCells = dataCells.filter(
      (c) => c.attributes["data-supported"] !== undefined,
    );
    expect(supportedCells.length).toBeGreaterThan(0);
  });

  it("parses deeply nested article with microdata", () => {
    const result = parse(xhtmlPage);
    const articles = filter(result, (n) => n.tagName === "article");
    expect(articles.length).toBeGreaterThanOrEqual(1);
    const post = articles.find((a) => a.attributes.class === "blog-post");
    expect(post).toBeDefined();
    expect(post!.attributes.itemscope).toBe(""); // XHTML boolean attribute (itemscope="")
    expect(post!.attributes.itemtype).toBe("https://schema.org/BlogPosting");
  });

  it("parses definition list (dl/dt/dd)", () => {
    const result = parse(xhtmlPage);
    const dls = filter(result, (n) => n.tagName === "dl");
    expect(dls).toHaveLength(1);
    const dts = filter(dls[0]!.children, (n) => n.tagName === "dt");
    const dds = filter(dls[0]!.children, (n) => n.tagName === "dd");
    expect(dts.length).toBeGreaterThanOrEqual(6);
    expect(dds.length).toBe(dts.length);
  });

  it("parses script elements with their content preserved", () => {
    const result = parse(xhtmlPage);
    const scripts = filter(result, (n) => n.tagName === "script");
    expect(scripts.length).toBeGreaterThanOrEqual(2);
    // JSON-LD script
    const jsonLd = scripts.find(
      (s) => s.attributes.type === "application/ld+json",
    );
    expect(jsonLd).toBeDefined();
    const jsonContent = (jsonLd!.children[0] as string).trim();
    expect(() => JSON.parse(jsonContent)).not.toThrow();

    // JavaScript script
    const jsScript = scripts.find(
      (s) => s.attributes.type === "text/javascript",
    );
    expect(jsScript).toBeDefined();
    const jsText = jsScript!.children
      .filter((c): c is string => typeof c === "string")
      .join("");
    expect(jsText).toContain("createElement");
  });

  it("parses the diagram figure with data-step attributes", () => {
    const result = parse(xhtmlPage);
    const stages = filter(
      result,
      (n) => n.tagName === "div" && n.attributes.class === "stage",
    );
    expect(stages).toHaveLength(5);
    expect(stages.map((s) => s.attributes["data-step"])).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
  });

  it("extracts full text content", () => {
    const result = parse(xhtmlPage);
    const content = toContentString(result);
    expect(content).toContain("Complex XHTML");
    expect(content).toContain("Getting Started");
    expect(content).toContain("Feature Comparison");
    expect(content).toContain("Understanding XML Parsing Internals");
    expect(content).toContain("Phase 1: Lexical Analysis");
  });

  it("getElementById finds elements by id", () => {
    const hero = getElementById(xhtmlPage, "hero") as TNode;
    expect(hero).toBeDefined();
    expect(hero.tagName).toBe("header");
    expect(hero.attributes.class).toBe("hero-section");

    const content = getElementById(xhtmlPage, "content") as TNode;
    expect(content).toBeDefined();
    expect(content.tagName).toBe("main");
  });

  it("getElementsByClassName finds cards", () => {
    const cards = getElementsByClassName(xhtmlPage, "card") as TNode[];
    expect(cards).toHaveLength(3);
    const ids = cards.map((c) => c.attributes.id);
    expect(ids).toContain("card-install");
    expect(ids).toContain("card-usage");
    expect(ids).toContain("card-streaming");
  });
});

// =================================================================
// Complex fixture tests — Maven POM
// =================================================================
describe("fixture: pom.xml", () => {
  it("parses without error", () => {
    const result = parse(pomXml);
    expect(result.length).toBeGreaterThan(0);
  });

  it("finds the project root with Maven namespace", () => {
    const result = parse(pomXml);
    const project = result.find(
      (n) => typeof n === "object" && n.tagName === "project",
    ) as TNode;
    expect(project).toBeDefined();
    expect(project.attributes.xmlns).toBe("http://maven.apache.org/POM/4.0.0");
    expect(project.attributes["xmlns:xsi"]).toBe(
      "http://www.w3.org/2001/XMLSchema-instance",
    );
  });

  it("extracts GAV coordinates", () => {
    const result = parse(pomXml);
    const project = result.find(
      (n) => typeof n === "object" && n.tagName === "project",
    ) as TNode;
    const groupId = project.children.find(
      (c) => typeof c === "object" && c.tagName === "groupId",
    ) as TNode;
    const artifactId = project.children.find(
      (c) => typeof c === "object" && c.tagName === "artifactId",
    ) as TNode;
    const version = project.children.find(
      (c) => typeof c === "object" && c.tagName === "version",
    ) as TNode;
    expect(groupId.children[0]).toBe("com.example.services");
    expect(artifactId.children[0]).toBe("order-service");
    expect(version.children[0]).toBe("2.8.0-SNAPSHOT");
  });

  it("finds the parent POM reference", () => {
    const result = parse(pomXml);
    const parents = filter(result, (n) => n.tagName === "parent");
    expect(parents).toHaveLength(1);
    const parentChildren = parents[0]!.children.filter(
      (c) => typeof c === "object",
    ) as TNode[];
    const parentGroupId = parentChildren.find((c) => c.tagName === "groupId")!;
    expect(parentGroupId.children[0]).toBe("com.example");
  });

  it("extracts all dependency elements", () => {
    const result = parse(pomXml);
    const allDeps = filter(result, (n) => n.tagName === "dependency");
    // Should have many dependencies (managed + direct + test)
    expect(allDeps.length).toBeGreaterThanOrEqual(20);
  });

  it("finds dependencies by scope", () => {
    const result = parse(pomXml);
    const allDeps = filter(result, (n) => n.tagName === "dependency");
    const testDeps = allDeps.filter((d) => {
      const scope = d.children.find(
        (c) => typeof c === "object" && c.tagName === "scope",
      ) as TNode | undefined;
      return scope && scope.children[0] === "test";
    });
    expect(testDeps.length).toBeGreaterThanOrEqual(4);
  });

  it("finds exclusions in test dependencies", () => {
    const result = parse(pomXml);
    const exclusions = filter(result, (n) => n.tagName === "exclusion");
    expect(exclusions).toHaveLength(1);
    const excludedArtifact = exclusions[0]!.children.find(
      (c) => typeof c === "object" && c.tagName === "artifactId",
    ) as TNode;
    expect(excludedArtifact.children[0]).toBe("junit-vintage-engine");
  });

  it("extracts property values", () => {
    const result = parse(pomXml);
    const props = filter(result, (n) => n.tagName === "properties");
    expect(props).toHaveLength(1);
    const javaVersion = props[0]!.children.find(
      (c) => typeof c === "object" && c.tagName === "java.version",
    ) as TNode;
    expect(javaVersion.children[0]).toBe("21");
    const springBoot = props[0]!.children.find(
      (c) => typeof c === "object" && c.tagName === "spring-boot.version",
    ) as TNode;
    expect(springBoot.children[0]).toBe("3.3.0");
  });

  it("finds build plugins and their configurations", () => {
    const result = parse(pomXml);
    const plugins = filter(result, (n) => n.tagName === "plugin");
    expect(plugins.length).toBeGreaterThanOrEqual(4);

    // Find the compiler plugin
    const compilerPlugin = plugins.find((p) => {
      const aid = p.children.find(
        (c) => typeof c === "object" && c.tagName === "artifactId",
      ) as TNode | undefined;
      return aid && aid.children[0] === "maven-compiler-plugin";
    });
    expect(compilerPlugin).toBeDefined();

    // Check annotationProcessorPaths
    const processorPaths = filter(
      compilerPlugin!.children,
      (n) => n.tagName === "path",
    );
    expect(processorPaths).toHaveLength(3);
  });

  it("finds profiles", () => {
    const result = parse(pomXml);
    const profiles = filter(result, (n) => n.tagName === "profile");
    expect(profiles).toHaveLength(2);
    const profileIds = profiles.map((p) => {
      const id = p.children.find(
        (c) => typeof c === "object" && c.tagName === "id",
      ) as TNode;
      return id.children[0];
    });
    expect(profileIds).toContain("docker");
    expect(profileIds).toContain("integration-test");
  });

  it("finds developers with roles", () => {
    const result = parse(pomXml);
    const developers = filter(result, (n) => n.tagName === "developer");
    expect(developers).toHaveLength(2);

    const alice = developers.find((d) => {
      const id = d.children.find(
        (c) => typeof c === "object" && c.tagName === "id",
      ) as TNode;
      return id && id.children[0] === "alice";
    });
    expect(alice).toBeDefined();
    const roles = filter(alice!.children, (n) => n.tagName === "role");
    expect(roles).toHaveLength(2);
    expect(roles[0]!.children[0]).toBe("Lead Developer");
  });

  it("preserves comments about dependency sections", () => {
    const result = parse(pomXml, { keepComments: true });
    const allComments: string[] = [];
    function collectComments(nodes: (TNode | string)[]) {
      for (const node of nodes) {
        if (typeof node === "string" && node.startsWith("<!--")) {
          allComments.push(node);
        } else if (typeof node === "object") {
          collectComments(node.children);
        }
      }
    }
    collectComments(result);
    expect(allComments.length).toBeGreaterThanOrEqual(5);
    expect(allComments.some((c) => c.includes("Spring Boot Starters"))).toBe(
      true,
    );
    expect(allComments.some((c) => c.includes("Database"))).toBe(true);
    expect(allComments.some((c) => c.includes("Testing"))).toBe(true);
  });

  it("roundtrips via writer", () => {
    const result = parse(pomXml);
    const xml = writer(result);
    const reparsed = parse(xml);
    // Same number of dependencies
    const origDeps = filter(result, (n) => n.tagName === "dependency");
    const reparsedDeps = filter(reparsed, (n) => n.tagName === "dependency");
    expect(reparsedDeps).toHaveLength(origDeps.length);
  });
});

// =================================================================
// fixture: html-page.html  (parsed with { html: true })
// =================================================================
describe("fixture: html-page.html", () => {
  it("parses without error", () => {
    expect(() => parse(htmlPage, { html: true })).not.toThrow();
  });

  it("throws without html mode (angle brackets in script/style)", () => {
    // Without html: true, the <tag> inside CSS and angle brackets in JS are invalid XML
    expect(() => parse(htmlPage)).toThrow();
  });

  it("finds the DOCTYPE and html root", () => {
    const result = parse(htmlPage, { html: true }) as (TNode | string)[];
    // DOCTYPE appears as a string
    const doctype = result.find(
      (n) => typeof n === "string" && n.includes("DOCTYPE"),
    );
    expect(doctype).toBeDefined();
    const html = result.find(
      (n) => typeof n === "object" && n.tagName === "html",
    ) as TNode;
    expect(html).toBeDefined();
    expect(html.attributes.lang).toBe("en");
    expect(html.attributes["data-theme"]).toBe("light");
  });

  it("finds head and body as children of html", () => {
    const result = parse(htmlPage, { html: true });
    const html = result.find(
      (n): n is TNode => typeof n === "object" && n.tagName === "html",
    )!;
    const head = html.children.find(
      (c) => typeof c === "object" && c.tagName === "head",
    ) as TNode;
    const body = html.children.find(
      (c) => typeof c === "object" && c.tagName === "body",
    ) as TNode;
    expect(head).toBeDefined();
    expect(body).toBeDefined();
  });

  // --- Void elements ---

  it("parses all meta elements as self-closing", () => {
    const result = parse(htmlPage, { html: true });
    const metas = filter(result, (n) => n.tagName === "meta");
    expect(metas.length).toBe(5);
    for (const m of metas) {
      expect(m.children).toEqual([]);
    }
    expect(metas[0]!.attributes.charset).toBe("utf-8");
    expect(metas[1]!.attributes.name).toBe("viewport");
  });

  it("parses all link elements as self-closing", () => {
    const result = parse(htmlPage, { html: true });
    const links = filter(result, (n) => n.tagName === "link");
    expect(links.length).toBe(7);
    for (const l of links) {
      expect(l.children).toEqual([]);
    }
    const canonical = links.find((l) => l.attributes.rel === "canonical");
    expect(canonical).toBeDefined();
    expect(canonical!.attributes.href).toBe("https://example.com/dashboard");
  });

  it("parses img elements as self-closing", () => {
    const result = parse(htmlPage, { html: true });
    const imgs = filter(result, (n) => n.tagName === "img");
    expect(imgs.length).toBe(3);
    for (const img of imgs) {
      expect(img.children).toEqual([]);
      expect(img.attributes.src).toBeDefined();
      expect(img.attributes.alt).toBeDefined();
    }
  });

  it("parses input elements as self-closing with various types", () => {
    const result = parse(htmlPage, { html: true });
    const inputs = filter(result, (n) => n.tagName === "input");
    expect(inputs.length).toBe(13);
    for (const input of inputs) {
      expect(input.children).toEqual([]);
    }
    // Various input types
    const types = inputs
      .map((i) => i.attributes.type)
      .filter((t) => t !== null);
    expect(types).toContain("search");
    expect(types).toContain("date");
    expect(types).toContain("checkbox");
    expect(types).toContain("radio");
    expect(types).toContain("text");
    expect(types).toContain("email");
  });

  it("parses hr elements as self-closing", () => {
    const result = parse(htmlPage, { html: true });
    const hrs = filter(result, (n) => n.tagName === "hr");
    expect(hrs.length).toBe(5);
    for (const hr of hrs) {
      expect(hr.children).toEqual([]);
    }
  });

  it("parses source and track elements as self-closing", () => {
    const result = parse(htmlPage, { html: true });
    const sources = filter(result, (n) => n.tagName === "source");
    expect(sources.length).toBe(2);
    for (const s of sources) {
      expect(s.children).toEqual([]);
    }
    const tracks = filter(result, (n) => n.tagName === "track");
    expect(tracks.length).toBe(2);
    for (const t of tracks) {
      expect(t.children).toEqual([]);
    }
    // Verify track attributes
    const englishTrack = tracks.find((t) => t.attributes.srclang === "en");
    expect(englishTrack).toBeDefined();
    expect(englishTrack!.attributes.default).toBeNull(); // boolean attr
  });

  it("parses col and embed elements as self-closing", () => {
    const result = parse(htmlPage, { html: true });
    const cols = filter(result, (n) => n.tagName === "col");
    expect(cols.length).toBe(5);
    const embed = filter(result, (n) => n.tagName === "embed");
    expect(embed.length).toBe(1);
    expect(embed[0]!.children).toEqual([]);
    expect(embed[0]!.attributes.type).toBe("application/pdf");
  });

  it("parses wbr elements as self-closing", () => {
    const result = parse(htmlPage, { html: true });
    const wbrs = filter(result, (n) => n.tagName === "wbr");
    expect(wbrs.length).toBe(5);
    for (const w of wbrs) {
      expect(w.children).toEqual([]);
    }
  });

  // --- Raw content tags (script, style) ---

  it("preserves style content as raw text including CSS child selectors and comments", () => {
    const result = parse(htmlPage, { html: true });
    const styles = filter(result, (n) => n.tagName === "style");
    expect(styles.length).toBe(1);
    const css = styles[0]!.children[0] as string;
    expect(typeof css).toBe("string");
    // CSS > child combinator preserved
    expect(css).toContain(".layout > .sidebar");
    expect(css).toContain("nav > ul > li > a");
    // <tag> inside CSS comment preserved
    expect(css).toContain("/* <tag> inside a CSS comment");
    // Attribute selectors preserved
    expect(css).toContain('input[type="text"]');
    expect(css).toContain("button[disabled]");
    expect(css).toContain('a[href^="https://"]');
  });

  it("parses JSON-LD script with structured data", () => {
    const result = parse(htmlPage, { html: true });
    const scripts = filter(result, (n) => n.tagName === "script");
    const jsonLd = scripts.find(
      (s) => s.attributes.type === "application/ld+json",
    );
    expect(jsonLd).toBeDefined();
    const content = (jsonLd!.children[0] as string).trim();
    const data = JSON.parse(content);
    expect(data["@type"]).toBe("WebApplication");
    expect(data.name).toBe("Acme Dashboard");
    expect(data.offers["@type"]).toBe("Offer");
  });

  it("preserves inline JavaScript with angle brackets and DOM creation", () => {
    const result = parse(htmlPage, { html: true });
    const scripts = filter(result, (n) => n.tagName === "script");
    const inlineScript = scripts.find(
      (s) => !s.attributes.type && s.children.length > 0,
    );
    expect(inlineScript).toBeDefined();
    const js = inlineScript!.children[0] as string;
    // DOM manipulation with innerHTML containing HTML
    expect(js).toContain("banner.innerHTML = '<span");
    // Template literal with embedded HTML
    expect(js).toContain('<div class="tooltip">');
    // Comparison operators that look like XML
    expect(js).toContain("v > 1000 && v < 10000");
    // Dynamic script creation
    expect(js).toContain("document.createElement('script')");
    // Regex with angle brackets
    expect(js).toContain("/<\\/?([a-z]");
    // Object with angle brackets in string
    expect(js).toContain("'<production>'");
  });

  it("preserves module script content", () => {
    const result = parse(htmlPage, { html: true });
    const scripts = filter(result, (n) => n.tagName === "script");
    const moduleScript = scripts.find((s) => s.attributes.type === "module");
    expect(moduleScript).toBeDefined();
    const js = moduleScript!.children[0] as string;
    expect(js).toContain("import { Chart }");
    expect(js).toContain("d.value > 0 && d.date < '2026-04-01'");
  });

  // --- Boolean attributes ---

  it("parses boolean attributes as null", () => {
    const result = parse(htmlPage, { html: true });
    // disabled button
    const buttons = filter(result, (n) => n.tagName === "button");
    const disabledBtn = buttons.find(
      (b) => b.attributes.disabled !== undefined,
    );
    expect(disabledBtn).toBeDefined();
    expect(disabledBtn!.attributes.disabled).toBeNull();

    // checked checkbox
    const inputs = filter(result, (n) => n.tagName === "input");
    const checkedInputs = inputs.filter(
      (i) => i.attributes.checked !== undefined,
    );
    expect(checkedInputs.length).toBeGreaterThanOrEqual(2);
    for (const ci of checkedInputs) {
      expect(ci.attributes.checked).toBeNull();
    }

    // hidden div
    const hiddenDiv = filter(
      result,
      (n) => n.tagName === "div" && n.attributes.hidden !== undefined,
    );
    expect(hiddenDiv.length).toBe(1);
    expect(hiddenDiv[0]!.attributes.hidden).toBeNull();
  });

  // --- Complex structure ---

  it("parses the navigation with nested menus and ARIA attributes", () => {
    const result = parse(htmlPage, { html: true });
    const navs = filter(
      result,
      (n) =>
        n.tagName === "nav" &&
        n.attributes["aria-label"] === "Primary navigation",
    );
    expect(navs.length).toBe(1);
    const nav = navs[0]!;
    // Top-level menu items
    const menuItems = filter(
      nav.children.filter((c) => typeof c === "object") as TNode[],
      (n) => n.tagName === "a" && n.attributes.role === "menuitem",
    );
    expect(menuItems.length).toBeGreaterThanOrEqual(4);
    // Dashboard has aria-current
    const dashLink = menuItems.find(
      (m) => m.attributes["aria-current"] === "page",
    );
    expect(dashLink).toBeDefined();
    // Settings has submenu
    const settingsLink = menuItems.find(
      (m) => m.attributes["aria-haspopup"] === "true",
    );
    expect(settingsLink).toBeDefined();
  });

  it("parses the data table with rows and columns", () => {
    const result = parse(htmlPage, { html: true });
    const tables = filter(result, (n) => n.tagName === "table");
    expect(tables.length).toBe(1);
    const table = tables[0]!;
    // thead
    const thead = table.children.find(
      (c) => typeof c === "object" && c.tagName === "thead",
    ) as TNode;
    expect(thead).toBeDefined();
    const thCells = filter([thead], (n) => n.tagName === "th");
    expect(thCells.length).toBe(5);
    expect(thCells.map((th) => toContentString(th.children))).toEqual([
      "Order ID",
      "Customer",
      "Amount",
      "Status",
      "Date",
    ]);
    // tbody rows
    const tbody = table.children.find(
      (c) => typeof c === "object" && c.tagName === "tbody",
    ) as TNode;
    expect(tbody).toBeDefined();
    const rows = filter([tbody], (n) => n.tagName === "tr");
    expect(rows.length).toBe(3);
  });

  it("parses the form with various input types and fieldsets", () => {
    const result = parse(htmlPage, { html: true });
    const forms = filter(result, (n) => n.tagName === "form");
    expect(forms.length).toBe(2);
    const filterForm = forms.find((f) => f.attributes.id === "filter-form");
    expect(filterForm).toBeDefined();
    const fieldsets = filter([filterForm!], (n) => n.tagName === "fieldset");
    expect(fieldsets.length).toBe(3);
    // Legends
    const legends = filter([filterForm!], (n) => n.tagName === "legend");
    expect(legends.map((l) => toContentString(l.children))).toEqual([
      "Date Range",
      "Status",
      "Priority",
    ]);
  });

  it("parses the video element with source and track children", () => {
    const result = parse(htmlPage, { html: true });
    const videos = filter(result, (n) => n.tagName === "video");
    expect(videos.length).toBe(1);
    const video = videos[0]!;
    expect(video.attributes.controls).toBeNull(); // boolean
    expect(video.attributes.preload).toBe("metadata");
    // source elements inside video
    const sources = video.children.filter(
      (c) => typeof c === "object" && c.tagName === "source",
    ) as TNode[];
    expect(sources.length).toBe(2);
    expect(sources[0]!.attributes.type).toBe("video/mp4");
    expect(sources[1]!.attributes.type).toBe("video/webm");
    // track elements inside video
    const tracks = video.children.filter(
      (c) => typeof c === "object" && c.tagName === "track",
    ) as TNode[];
    expect(tracks.length).toBe(2);
  });

  it("parses summary cards with data attributes", () => {
    const result = parse(htmlPage, { html: true });
    const cards = filter(
      result,
      (n) => n.tagName === "div" && n.attributes["data-metric"] !== undefined,
    );
    expect(cards.length).toBe(4);
    expect(cards.map((c) => c.attributes["data-metric"])).toEqual([
      "revenue",
      "users",
      "orders",
      "conversion",
    ]);
  });

  it("preserves HTML entities as-is in text content", () => {
    const result = parse(htmlPage, { html: true });
    // &amp; is preserved as-is (the parser does not decode entities)
    const text = toContentString(result as (TNode | string)[]);
    expect(text).toContain("Bob Smith &amp; Partners");
    // &copy; preserved as-is
    expect(text).toContain("&copy; 2026 Acme Corp");
  });

  it("preserves comments with keepComments option", () => {
    const result = parse(htmlPage, {
      html: true,
      keepComments: true,
    }) as (TNode | string)[];
    const allComments: string[] = [];
    function collectComments(nodes: (TNode | string)[]) {
      for (const node of nodes) {
        if (typeof node === "string" && node.startsWith("<!--")) {
          allComments.push(node);
        } else if (typeof node === "object") {
          collectComments(node.children);
        }
      }
    }
    collectComments(result);
    expect(allComments.length).toBeGreaterThanOrEqual(4);
    expect(allComments.some((c) => c.includes("Skip navigation"))).toBe(true);
    expect(allComments.some((c) => c.includes("Primary navigation"))).toBe(
      true,
    );
    expect(
      allComments.some((c) => c.includes("More rows loaded dynamically")),
    ).toBe(true);
  });

  it("extracts text content from the entire document", () => {
    const result = parse(htmlPage, { html: true });
    const text = toContentString(result as (TNode | string)[]);
    expect(text).toContain("Dashboard Overview");
    expect(text).toContain("Revenue");
    expect(text).toContain("$142,384.00");
    expect(text).toContain("Active Users");
    expect(text).toContain("Send Feedback");
    expect(text).toContain("Alice Johnson");
  });

  it("exposes HTML_VOID_ELEMENTS and HTML_RAW_CONTENT_TAGS constants", () => {
    expect(HTML_VOID_ELEMENTS).toContain("img");
    expect(HTML_VOID_ELEMENTS).toContain("br");
    expect(HTML_VOID_ELEMENTS).toContain("meta");
    expect(HTML_VOID_ELEMENTS).toContain("link");
    expect(HTML_VOID_ELEMENTS).toContain("input");
    expect(HTML_VOID_ELEMENTS).toContain("hr");
    expect(HTML_VOID_ELEMENTS).toContain("wbr");
    expect(HTML_VOID_ELEMENTS).toContain("source");
    expect(HTML_VOID_ELEMENTS).toContain("track");
    expect(HTML_VOID_ELEMENTS).toContain("col");
    expect(HTML_VOID_ELEMENTS).toContain("embed");
    expect(HTML_VOID_ELEMENTS).toHaveLength(14);

    expect(HTML_RAW_CONTENT_TAGS).toEqual(["script", "style"]);
  });

  it("allows overriding rawContentTags in html mode", () => {
    // Override to also treat <textarea> as raw content
    const result = parse("<div><textarea><b>bold</b></textarea></div>", {
      html: true,
      rawContentTags: ["script", "style", "textarea"],
    });
    const textarea = filter(result, (n) => n.tagName === "textarea");
    expect(textarea.length).toBe(1);
    // Content should be raw text, not parsed
    expect(textarea[0]!.children).toEqual(["<b>bold</b>"]);
  });

  it("allows overriding selfClosingTags in html mode", () => {
    // Override to only treat <br> as self-closing
    const result = parse("<div><br><hr></hr></div>", {
      html: true,
      selfClosingTags: ["br"],
    });
    const div = result[0] as TNode;
    const br = div.children.find(
      (c): c is TNode => typeof c === "object" && c.tagName === "br",
    )!;
    expect(br.children).toEqual([]);
    // hr is NOT self-closing with our override, so it has a close tag
    const hr = div.children.find(
      (c): c is TNode => typeof c === "object" && c.tagName === "hr",
    )!;
    expect(hr).toBeDefined();
  });
});
