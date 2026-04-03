import { describe, it, expect } from "vitest";
import { parse } from "../src/parser.js";
import { writer } from "../src/writer.js";

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
