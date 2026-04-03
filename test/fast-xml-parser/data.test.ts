/**
 * Ported from fast-xml-parser/spec/data_spec.js
 *
 * Tests mixed data scenarios: attributes with '>' in values, boolean attrs,
 * mixed content, undefined text, error handling on malformed XML.
 *
 * Skipped tests:
 *   - removeNSPrefix — we don't strip namespaces
 *   - processEntities: false — we always handle basic XML entities
 *   - attributesGroupName — we don't group attributes
 *   - Validation-only tests — we don't have a separate XMLValidator
 */
import { describe, it, expect } from "vitest";
import { lossy } from "../../src/converters/lossy.ts";

describe("mixed data (from data_spec)", () => {
  // ─── "should parse attributes having '>' in value" ─────────────────
  it("should parse attributes having '>' in value", () => {
    const xmlData = `
        <testStep type="restrequest" name="test step name (bankId -> Error)" id="90e453d3-30cd-4958-a3be-61ecfe7a7cbe">
              <settings/>
              <encoding>UTF-8</encoding>
        </testStep>`;

    const result = lossy(xmlData) as any;
    expect(result.testStep.$type).toBe("restrequest");
    expect(result.testStep.$name).toBe(
      "test step name (bankId -> Error)",
    );
    expect(result.testStep.$id).toBe(
      "90e453d3-30cd-4958-a3be-61ecfe7a7cbe",
    );
    expect(result.testStep.settings).toBeNull();
    expect(result.testStep.encoding).toBe("UTF-8");
  });

  // ─── "should parse tagName without whitespace chars" ───────────────
  it("should parse tag with attribute on next line", () => {
    const xmlData = `<a:root
         attr='df'>val
    </a:root>`;
    const result = lossy(xmlData) as any;
    expect(result["a:root"].$attr).toBe("df");
    // Text with attributes → $$ array
    expect(result["a:root"].$$).toBeDefined();
  });

  // ─── "should parse XML with undefined as text" ─────────────────────
  it('should parse "undefined" as literal text, not undefined value', () => {
    const xmlData = `<tag><![CDATA[undefined]]><nested>undefined</nested></tag>`;
    const result = lossy(xmlData) as any;
    // CDATA + nested element = genuine mixed content → $$ array
    expect(result.tag.$$).toBeDefined();
    expect(result.tag.$$[0]).toBe("undefined");
    expect(result.tag.$$[1]).toEqual({ nested: "undefined" });
  });

  // ─── Error handling: unclosed tag ──────────────────────────────────
  it("should error when closing tag is not closed", () => {
    const xmlData = `<?xml version="1.0"?><tag></tag`;
    expect(() => lossy(xmlData, { strict: true })).toThrow();
  });

  it("should error for unclosed comment", () => {
    const xmlData = `<?xml version="1.0"?><!-- bad `;
    expect(() => lossy(xmlData, { strict: true })).toThrow();
  });

  it("should error for unclosed CDATA", () => {
    const xmlData = `<?xml version="1.0"?><![CDATA ]`;
    expect(() => lossy(xmlData, { strict: true })).toThrow();
  });

  it("should error for unclosed PI tag", () => {
    const xmlData = `<?xml version="1.0"?><?pi  `;
    expect(() => lossy(xmlData, { strict: true })).toThrow();
  });

  // ─── "should parse XML when there is a space after tagname" ────────
  it("should parse tag with trailing space", () => {
    const xmlData = `<tag ><![CDATA[undefined]]><nested>undefined</nested></tag>`;
    const result = lossy(xmlData) as any;
    // CDATA text + nested element = genuine mixed content → $$ array
    expect(result.tag).toBeDefined();
    expect(result.tag.$$).toBeDefined();
    expect(result.tag.$$[0]).toBe("undefined");
    expect(result.tag.$$[1]).toEqual({ nested: "undefined" });
  });

  // ─── Tab/newline in tag attributes ─────────────────────────────────
  it("should parse attributes separated by tab and newline", () => {
    const xmlData = `<MPD
\tavailabilityStartTime="2020-02-16T10:52:03.119Z"
\txmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
\t<Period
\t\tid="1578477220">
\t</Period>
</MPD>`;
    const result = lossy(xmlData) as any;
    expect(result.MPD.$availabilityStartTime).toBe(
      "2020-02-16T10:52:03.119Z",
    );
    expect(result.MPD["$xmlns:xsi"]).toBe(
      "http://www.w3.org/2001/XMLSchema-instance",
    );
    expect(result.MPD.Period.$id).toBe("1578477220");
  });
});
