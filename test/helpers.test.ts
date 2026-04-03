import { describe, it, expect } from "vitest";
import { parse, type TNode } from "#src/parser.ts";
import { filter } from "#src/utilities/filter.ts";
import { toContentString } from "#src/utilities/toContentString.ts";
import { getElementById } from "#src/utilities/getElementById.ts";
import { getElementsByClassName } from "#src/utilities/getElementsByClassName.ts";
import { isTextNode } from "#src/utilities/isTextNode.ts";
import { isElementNode } from "#src/utilities/isElementNode.ts";
import assert from "node:assert";

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
