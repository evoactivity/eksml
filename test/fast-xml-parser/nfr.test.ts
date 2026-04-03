/**
 * Ported from fast-xml-parser/spec/nfr_spec.js
 *
 * Tests security-related concerns: prototype pollution prevention,
 * dangerous property names.
 *
 * Skipped tests:
 *   - onDangerousProperty callback — not supported
 *   - commentPropName / strictReservedNames options — not supported
 *   - DANGEROUS_PROPERTY_NAMES / criticalProperties imports — internal to fast-xml-parser
 *   - maxNestedTags option — not configurable in eksml
 *
 * What we test here:
 *   - That parsing tags with dangerous names (__proto__, constructor, prototype)
 *     doesn't cause actual prototype pollution
 *   - That deeply nested XML doesn't crash (basic resilience)
 */
import { describe, it, expect } from "vitest";
import { parse, type TNode } from "../../src/parser.ts";
import { lossy } from "../../src/converters/lossy.ts";
import { lossless } from "../../src/converters/lossless.ts";

const dangerousNames = ["__proto__", "constructor", "prototype"];

describe("security / prototype pollution — lossy (from nfr_spec)", () => {
  it("should not pollute Object.prototype via tag names", () => {
    for (const name of dangerousNames) {
      const xml = `<root><${name}>malicious</${name}></root>`;
      const result = lossy(xml) as any;
      const emptyObj: any = {};
      expect(emptyObj[name]).not.toBe("malicious");
    }
  });

  it("should parse dangerous tag names as regular properties", () => {
    for (const name of dangerousNames) {
      const xml = `<root><${name}>value</${name}></root>`;
      const result = lossy(xml) as any;
      expect(result.root[name]).toBe("value");
    }
  });

  it("should not pollute via attribute names", () => {
    for (const name of dangerousNames) {
      const xml = `<root ${name}="malicious">text</root>`;
      const result = lossy(xml) as any;
      const emptyObj: any = {};
      expect(emptyObj[name]).not.toBe("malicious");
    }
  });

  it("should handle deeply nested XML without crashing", () => {
    const depth = 100;
    const xml = "<a>".repeat(depth) + "x" + "</a>".repeat(depth);
    const result = lossy(xml) as any;
    let node: any = result;
    for (let i = 0; i < depth; i++) {
      node = node.a;
    }
    expect(node).toBe("x");
  });
});

describe("security / prototype pollution — lossless (from nfr_spec)", () => {
  it("should not pollute Object.prototype via tag names", () => {
    for (const name of dangerousNames) {
      const xml = `<root><${name}>malicious</${name}></root>`;
      const result = lossless(xml) as any;
      const emptyObj: any = {};
      expect(emptyObj[name]).not.toBe("malicious");
    }
  });

  it("should produce accessible entries for dangerous tag names", () => {
    for (const name of dangerousNames) {
      const xml = `<root><${name}>value</${name}></root>`;
      const result = lossless(xml) as any;
      // Lossless wraps each element as { tagName: children[] }
      const rootChildren = result[0].root;
      const entry = rootChildren.find(
        (e: any) => Object.prototype.hasOwnProperty.call(e, name),
      );
      expect(entry).toBeDefined();
      expect(entry[name]).toEqual([{ $text: "value" }]);
    }
  });

  it("should not pollute via attribute names", () => {
    for (const name of dangerousNames) {
      const xml = `<root ${name}="malicious">text</root>`;
      const result = lossless(xml) as any;
      const emptyObj: any = {};
      expect(emptyObj[name]).not.toBe("malicious");
    }
  });

  it("should handle deeply nested XML without crashing", () => {
    const depth = 100;
    const xml = "<a>".repeat(depth) + "x" + "</a>".repeat(depth);
    const result = lossless(xml) as any;
    let node: any = result[0];
    for (let i = 0; i < depth; i++) {
      node = node.a[0];
    }
    expect(node).toEqual({ $text: "x" });
  });
});

describe("security / prototype pollution — parse (from nfr_spec)", () => {
  it("should not pollute Object.prototype via tag names", () => {
    for (const name of dangerousNames) {
      const xml = `<root><${name}>malicious</${name}></root>`;
      parse(xml);
      const emptyObj: any = {};
      expect(emptyObj[name]).not.toBe("malicious");
    }
  });

  it("should store dangerous tag names correctly on TNode", () => {
    for (const name of dangerousNames) {
      const xml = `<root><${name}>value</${name}></root>`;
      const result = parse(xml);
      const root = result[0] as TNode;
      expect(root.tagName).toBe("root");
      const child = root.children[0] as TNode;
      expect(child.tagName).toBe(name);
      expect(child.children).toEqual(["value"]);
    }
  });

  it("should not pollute via attribute names", () => {
    for (const name of dangerousNames) {
      const xml = `<root ${name}="malicious">text</root>`;
      parse(xml);
      const emptyObj: any = {};
      expect(emptyObj[name]).not.toBe("malicious");
    }
  });

  it("should store dangerous attribute names as own properties", () => {
    for (const name of dangerousNames) {
      const xml = `<root ${name}="malicious">text</root>`;
      const result = parse(xml);
      const root = result[0] as TNode;
      expect(Object.prototype.hasOwnProperty.call(root.attributes, name)).toBe(
        true,
      );
      expect(root.attributes![name]).toBe("malicious");
    }
  });

  it("should handle deeply nested XML without crashing", () => {
    const depth = 100;
    const xml = "<a>".repeat(depth) + "x" + "</a>".repeat(depth);
    const result = parse(xml);
    let node: any = result[0];
    for (let i = 0; i < depth; i++) {
      node = node.children[0];
    }
    expect(node).toBe("x");
  });
});
