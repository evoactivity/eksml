/**
 * Ported from fast-xml-parser/spec/cdata_spec.js
 *
 * Tests CDATA handling: parsing, mixed with text, entities in CDATA, etc.
 *
 * Skipped tests:
 *   - cdataPropName option (separate CDATA tag) — we don't support this
 *   - preserveOrder mode — use lossless() for that
 *   - Tests reading fixture files from fast-xml-parser's assets/
 */
import { describe, it, expect } from "vitest";
import { lossy } from "#src/converters/lossy.ts";

describe("CDATA handling (from cdata_spec)", () => {
  // ─── "should parse multiline tag value" ────────────────────────────
  it("should parse multiline text value", () => {
    const xmlData = `<root><person>lastname
firstname
patronymic</person></root>`;
    const expected = {
      root: {
        person: "lastname\nfirstname\npatronymic",
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should parse tag having CDATA" ───────────────────────────────
  it("should parse tag having CDATA (inline with text)", () => {
    const xmlData = `
<any_name>
    <person>
        <phone>+122233344550</phone>
        <name><![CDATA[<some>Jack</some>]]><![CDATA[Jack]]></name>
        <name><![CDATA[<some>Mohan</some>]]></name>
        <blank><![CDATA[]]></blank>
        <regx><![CDATA[^[ ].*$]]></regx>
        <phone>+122233344551</phone>
    </person>
</any_name>`;

    const result = lossy(xmlData) as any;
    const person = result.any_name.person;

    // phone should be an array of two strings
    expect(person.phone).toEqual(["+122233344550", "+122233344551"]);

    // name[0] should have two CDATA sections concatenated
    expect(person.name[0]).toBe("<some>Jack</some>Jack");
    // name[1] should be the second name
    expect(person.name[1]).toBe("<some>Mohan</some>");

    // blank CDATA produces empty string
    expect(person.blank).toBe("");

    // regex CDATA
    expect(person.regx).toBe("^[ ].*$");
  });

  // ─── "should parse tag having CDATA 2" ─────────────────────────────
  it("should parse CDATA inside elements with attributes", () => {
    const xmlData = `<sql-queries>
    <sql-query id='testquery'><![CDATA[select * from search_urls]]></sql-query>
    <sql-query id='searchinfo'><![CDATA[select * from search_urls where search_urls=?]]></sql-query>
    <sql-query id='searchurls'><![CDATA[select search_url from search_urls ]]></sql-query>
</sql-queries>`;

    const result = lossy(xmlData) as any;
    const queries = result["sql-queries"]["sql-query"];

    expect(Array.isArray(queries)).toBe(true);
    expect(queries).toHaveLength(3);

    // Each should have $id attribute and text in $$ array
    expect(queries[0].$id).toBe("testquery");
    expect(queries[0].$$).toContain("select * from search_urls");

    expect(queries[1].$id).toBe("searchinfo");
    expect(queries[1].$$).toContain(
      "select * from search_urls where search_urls=?",
    );

    expect(queries[2].$id).toBe("searchurls");
    expect(queries[2].$$).toContain("select search_url from search_urls ");
  });

  // ─── "should parse tag having whitespaces before / after CDATA" ────
  it("should parse CDATA with surrounding whitespace", () => {
    const xmlData = `<xml>
    <a>text</a>
    <d><![CDATA[text]]></d>
</xml>`;
    const result = lossy(xmlData) as any;
    expect(result.xml.a).toBe("text");
    expect(result.xml.d).toBe("text");
  });

  // ─── "should parse tag having text before / after CDATA" ───────────
  it("should parse text before and after CDATA", () => {
    const xmlData = `<xml>
    <c><![CDATA[text]]>after</c>
    <d>before<![CDATA[text]]>after</d>
</xml>`;
    const result = lossy(xmlData) as any;
    expect(result.xml.c).toBe("textafter");
    expect(result.xml.d).toBe("beforetextafter");
  });

  // ─── "should not parse tag value if having CDATA" ──────────────────
  it("should concatenate text and empty CDATA", () => {
    const xmlData = `<xml>
    <d>23<![CDATA[]]>24</d>
</xml>`;
    const result = lossy(xmlData) as any;
    expect(result.xml.d).toBe("2324");
  });

  // ─── "should ignore comment" ───────────────────────────────────────
  it("should ignore comment within elements", () => {
    const xmlData = `<rootNode><!-- <tag> - - --><tag>1</tag><tag>val</tag></rootNode>`;
    const expected = {
      rootNode: {
        tag: ["1", "val"],
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should ignore multiline comments" ────────────────────────────
  it("should ignore multiline comments", () => {
    const xmlData =
      "<rootNode><!-- <tag> - - \n--><tag>1</tag><tag>val</tag></rootNode>";
    const expected = {
      rootNode: {
        tag: ["1", "val"],
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should not process entities in CDATA" ────────────────────────
  it("should not process entities inside CDATA", () => {
    const xmlData = `<xml><![CDATA[&lt;text&gt;]]></xml>`;
    const expected = {
      xml: "&lt;text&gt;",
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should parse CDATA with 0" ──────────────────────────────────
  it("should parse CDATA containing just '0'", () => {
    const xmlData = `<a><![CDATA[0]]></a>`;
    const result = lossy(xmlData) as any;
    expect(result.a).toBe("0");
  });

  // ─── Additional: CDATA with special characters ─────────────────────
  it("should preserve special XML chars inside CDATA", () => {
    const xmlData = `<root><![CDATA[<div class="test">&amp; more</div>]]></root>`;
    const expected = {
      root: '<div class="test">&amp; more</div>',
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── Adjacent CDATA sections ───────────────────────────────────────
  it("should concatenate adjacent CDATA sections", () => {
    const xmlData = `<root><![CDATA[hello]]><![CDATA[ world]]></root>`;
    const expected = {
      root: "hello world",
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── CDATA with regex content ──────────────────────────────────────
  it("should preserve regex patterns in CDATA", () => {
    const xmlData = `<pattern><![CDATA[^[ ].*$]]></pattern>`;
    const expected = {
      pattern: "^[ ].*$",
    };
    expect(lossy(xmlData)).toEqual(expected);
  });
});
