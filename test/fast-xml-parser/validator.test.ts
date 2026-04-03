/**
 * Ported from fast-xml-parser/spec/validator_spec.js
 *
 * Tests malformed/invalid XML handling. fast-xml-parser has a separate
 * XMLValidator.validate() API; eksml doesn't have a validator but its parser
 * should handle malformed XML gracefully — either parsing it best-effort
 * or throwing an error.
 *
 * Skipped tests:
 *   - XMLValidator.validate() API-specific tests (eksml has no validator)
 *   - File-based validation tests (sample.xml, complex.xml, etc.)
 *   - unpairedTags / allowBooleanAttributes options
 *   - Line/column error reporting
 *
 * What we test:
 *   - Valid XML parses without throwing
 *   - Self-closing tags parse correctly
 *   - XML with namespaces parses correctly
 *   - CDATA sections parse correctly
 *   - DOCTYPE declarations don't break parsing
 *   - XML processing instructions parse correctly
 *   - Various edge cases in tag/attribute syntax
 */
import { describe, it, expect } from "vitest";
import { lossy } from "#src/converters/lossy.ts";

describe("malformed XML handling (from validator_spec)", () => {
  // ─── Valid XML should parse without throwing ──────────────────────

  it("should parse simple xml string", () => {
    const result = lossy("<rootNode></rootNode>") as any;
    expect(result.rootNode).toBeNull();
  });

  it("should parse simple xml string with trailing space in close tag", () => {
    const result = lossy(`<rootNode></rootNode     >`) as any;
    expect(result.rootNode).toBeNull();
  });

  it("should parse self-closing tags", () => {
    const xml = `<rootNode><validtag1  /><validtag2/><validtag3  with='attrib'/><validtag4 />text<validtag5/>text</rootNode>`;
    const result = lossy(xml) as any;
    expect(result.rootNode).toBeDefined();
    // rootNode has mixed content (elements + text) → $$ array
    const mixed = result.rootNode.$$;
    expect(mixed).toBeDefined();
    expect(mixed[0]).toEqual({ validtag1: null });
    expect(mixed[1]).toEqual({ validtag2: null });
    expect(mixed[2]).toEqual({ validtag3: { $with: "attrib" } });
    expect(mixed[3]).toEqual({ validtag4: null });
    expect(mixed[4]).toBe("text");
    expect(mixed[5]).toEqual({ validtag5: null });
    expect(mixed[6]).toBe("text");
  });

  it("should parse xml with namespace", () => {
    const result = lossy("<root:Node></root:Node>") as any;
    expect(result["root:Node"]).toBeNull();
  });

  it("should parse xml with namespace and value", () => {
    const result = lossy("<root:Node>some value</root:Node>") as any;
    expect(result["root:Node"]).toBe("some value");
  });

  it("should parse xml with nested tags", () => {
    const result = lossy(
      "<rootNode><tag></tag><tag>1</tag><tag>val</tag></rootNode>"
    ) as any;
    expect(result.rootNode.tag).toBeDefined();
    // 3 <tag> elements → array
    expect(Array.isArray(result.rootNode.tag)).toBe(true);
    expect(result.rootNode.tag).toHaveLength(3);
  });

  it("should parse xml with comment", () => {
    const result = lossy(
      "<rootNode><!-- <tag> - - --><tag>1</tag><tag>val</tag></rootNode>"
    ) as any;
    expect(result.rootNode.tag).toBeDefined();
  });

  it("should parse xml with multiline comment", () => {
    const result = lossy(
      "<rootNode><!-- <tag> - - \n--><tag>1</tag><tag>val</tag></rootNode>"
    ) as any;
    expect(result.rootNode.tag).toBeDefined();
  });

  it("should parse xml with CDATA", () => {
    const result = lossy("<name><![CDATA[Jack]]></name>") as any;
    expect(result.name).toBe("Jack");
  });

  it("should parse xml with repeated CDATA", () => {
    const result = lossy(
      "<name><![CDATA[Jack]]><![CDATA[Jack]]></name>"
    ) as any;
    expect(result.name).toBe("JackJack");
  });

  it("should parse xml when CDATA contains regex or blank data", () => {
    const result = lossy(
      "<name><![CDATA[]]><![CDATA[^[ ].*$]]></name>"
    ) as any;
    expect(result.name).toBe("^[ ].*$");
  });

  it("should parse valid tag names with dots and dashes", () => {
    const result = lossy(
      "<ns:start_tag-2.0></ns:start_tag-2.0>"
    ) as any;
    expect(result["ns:start_tag-2.0"]).toBeNull();
  });

  it("should parse XML with DOCTYPE", () => {
    const xml =
      '<?xml version="1.0" standalone="yes" ?>' +
      "<!--open the DOCTYPE declaration -" +
      "  the open square bracket indicates an internal DTD-->" +
      "<!DOCTYPE foo [" +
      "<!--define the internal DTD-->" +
      "<!ELEMENT foo (#PCDATA)>" +
      "<!--close the DOCTYPE declaration-->" +
      "]>" +
      "<foo>Hello World.</foo>";
    // DOCTYPE is preserved as a top-level string
    const result = lossy(xml) as any;
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatch(/^!DOCTYPE foo/);
    expect(result[1].foo).toBe("Hello World.");
  });

  // ─── Attributes edge cases ────────────────────────────────────────

  it('should parse xml with a "length" attribute', () => {
    const result = lossy('<name length="1"></name>') as any;
    expect(result.name.$length).toBe("1");
  });

  it("should parse xml with multiline attributes", () => {
    const xml = `
<name
attribute1="attribute1"
attribute2="attribute2"
/>`;
    const result = lossy(xml) as any;
    expect(result.name.$attribute1).toBe("attribute1");
    expect(result.name.$attribute2).toBe("attribute2");
  });

  // ─── Entity validation in text ────────────────────────────────────

  it("should parse value with &amp; entity", () => {
    const result = lossy(
      "<rootNode>jekyll &amp; hyde</rootNode>",
      { entities: true },
    ) as any;
    expect(result.rootNode).toBe("jekyll & hyde");
  });

  it("should parse value with decimal character reference", () => {
    const result = lossy(
      "<rootNode>jekyll &#123; hyde</rootNode>",
      { entities: true },
    ) as any;
    // &#123; = {
    expect(result.rootNode).toBe("jekyll { hyde");
  });

  it("should parse value with hex character reference", () => {
    const result = lossy(
      "<rootNode>jekyll &#x1945abcdef; hyde</rootNode>"
    ) as any;
    // Should at least not throw — the hex ref may or may not resolve
    expect(result.rootNode).toBeDefined();
  });

  // ─── Processing instructions ──────────────────────────────────────

  it("should parse XML processing instructions", () => {
    const xml =
      '<?xml version="1.0"?>' +
      "<?mso-contentType?>" +
      "<h1></h1>" +
      '<?mso-contentType something="val"?>';
    const result = lossy(xml) as any;
    expect(result.h1).toBeNull();
  });

  it("should parse XML PIs within elements", () => {
    const xml = "<h1><?mso?> abc</h1>";
    const result = lossy(xml) as any;
    expect(result.h1).toBeDefined();
  });
});
