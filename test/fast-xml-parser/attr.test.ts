/**
 * Ported from fast-xml-parser/spec/attr_spec.js
 *
 * Tests attribute parsing edge cases: valid names, newlines, namespaces,
 * boolean attributes, xmlns handling.
 *
 * Skipped tests:
 *   - parseAttributeValue (number coercion) — we don't coerce
 *   - attributeNamePrefix customization — we always use "$"
 *   - removeNSPrefix — we don't strip namespaces
 *   - XMLValidator tests — we don't have a separate validator API
 */
import { describe, it, expect } from "vitest";
import { lossy } from "../../src/converters/lossy.ts";
import { parse } from "../../src/parser.ts";

describe("attribute parsing (from attr_spec)", () => {
  // ─── "should parse attributes with valid names" ──────────────────
  it("should parse attributes with valid names", () => {
    const xmlData = `<issue _ent-ity.23="Mjg2MzY2OTkyNA==" state="partial" version="1"></issue>`;
    const expected = {
      issue: {
        "$_ent-ity.23": "Mjg2MzY2OTkyNA==",
        $state: "partial",
        $version: "1",
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should parse attributes with newline char" ─────────────────
  it("should parse attributes with newline char in value", () => {
    const xmlData = `<element id="7" data="foo\nbar" bug="true"/>`;
    const result = lossy(xmlData) as any;
    expect(result.element.$id).toBe("7");
    expect(result.element.$data).toBe("foo\nbar");
    expect(result.element.$bug).toBe("true");
  });

  // ─── "should parse attributes separated by newline char" ─────────
  it("should parse attributes separated by newline", () => {
    const xmlData = `<element
id="7" data="foo bar" bug="true"/>`;
    const expected = {
      element: {
        $id: "7",
        $data: "foo bar",
        $bug: "true",
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── xmlns handling ──────────────────────────────────────────────
  it("should preserve xmlns attributes", () => {
    const xmlData = `<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd"></project>`;
    const expected = {
      project: {
        $xmlns: "http://maven.apache.org/POM/4.0.0",
        "$xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "$xsi:schemaLocation":
          "http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd",
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should parse attributes having '>' in value" ───────────────
  it("should parse attribute value containing '>'", () => {
    const xmlData = `<rootNode attr="123>234"><tag></tag><tag>1</tag><tag>val</tag></rootNode>`;
    const result = lossy(xmlData) as any;
    expect(result.rootNode.$attr).toBe("123>234");
  });

  // ─── Attribute with single quotes containing double quote ────────
  it("should parse single-quoted attr containing double quote", () => {
    const xmlData = `<root attr='val"ue'/>`;
    const result = lossy(xmlData) as any;
    expect(result.root.$attr).toBe('val"ue');
  });

  // ─── Attribute with double quotes containing single quote ────────
  it("should parse double-quoted attr containing single quote", () => {
    const xmlData = `<root attr="val'ue"/>`;
    const result = lossy(xmlData) as any;
    expect(result.root.$attr).toBe("val'ue");
  });

  // ─── Multiple attributes on self-closing tag ─────────────────────
  it("should parse multiple attributes on self-closing tag", () => {
    const xmlData = `<element id="7" data="foo bar" flag="true"/>`;
    const expected = {
      element: {
        $id: "7",
        $data: "foo bar",
        $flag: "true",
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should parse Boolean Attributes" (html mode) ───────────────
  it("should parse boolean attributes in html mode", () => {
    const xmlData = `<input disabled checked/>`;
    const result = lossy(xmlData, { html: true }) as any;
    expect(result.input.$disabled).toBeNull();
    expect(result.input.$checked).toBeNull();
  });

  // ─── Empty string attribute value ────────────────────────────────
  it("should parse empty string attribute value", () => {
    const xmlData = `<element str=""/>`;
    const result = lossy(xmlData) as any;
    expect(result.element.$str).toBe("");
  });

  // ─── Attribute with special characters in name ───────────────────
  it("should parse attributes with hyphens and dots in names", () => {
    const xmlData = `<root data-value="1" xml.lang="en"/>`;
    const result = lossy(xmlData) as any;
    expect(result.root["$data-value"]).toBe("1");
    expect(result.root["$xml.lang"]).toBe("en");
  });

  // ─── Attribute with tab separator ────────────────────────────────
  it("should parse attributes separated by tab", () => {
    const xmlData = `<element\tid="7"\tdata="foo"/>`;
    const result = lossy(xmlData) as any;
    expect(result.element.$id).toBe("7");
    expect(result.element.$data).toBe("foo");
  });
});
