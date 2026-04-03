/**
 * Ported from fast-xml-parser/spec/entities_spec.js
 *
 * Tests entity handling: built-in XML entities, hex/decimal character references,
 * DOCTYPE passthrough, CDATA with entities.
 *
 * Skipped tests:
 *   - Custom DOCTYPE entity definitions (<!ENTITY writer "...">) — eksml doesn't process custom entities
 *   - htmlEntities option — not supported
 *   - addEntity() external entity API — doesn't exist in eksml
 *   - processEntities option — not configurable, built-in only
 *   - preserveOrder mode — use lossless() instead
 *   - attributeNamePrefix: "" — eksml always uses `$` prefix
 *   - Tests that rely on number coercion — eksml keeps all values as strings
 *   - Entity value with tags in content — requires custom entity processing
 *   - Dynamic/chained entity resolution — requires custom entity processing
 *   - localised entity names — requires custom entity processing
 *   - Regex char in entity names — requires custom entity processing
 *   - Invalid entity name validation — requires custom entity processing
 */
import { describe, it, expect } from "vitest";
import { lossy } from "#src/converters/lossy.ts";

describe("entity handling (from entities_spec)", () => {
  // ─── Built-in XML entities ────────────────────────────────────────

  it("should decode &amp; in text content", () => {
    const xml = `<root>test&amp;value</root>`;
    const result = lossy(xml, { entities: true }) as any;
    expect(result.root).toBe("test&value");
  });

  it("should decode &lt; in text content", () => {
    const xml = `<root>test&lt;value</root>`;
    const result = lossy(xml, { entities: true }) as any;
    expect(result.root).toBe("test<value");
  });

  it("should decode &gt; in text content", () => {
    const xml = `<root>test&gt;value</root>`;
    const result = lossy(xml, { entities: true }) as any;
    expect(result.root).toBe("test>value");
  });

  it("should decode &apos; in text content", () => {
    const xml = `<root>test&apos;value</root>`;
    const result = lossy(xml, { entities: true }) as any;
    expect(result.root).toBe("test'value");
  });

  it("should decode &quot; in text content", () => {
    const xml = `<root>test&quot;value</root>`;
    const result = lossy(xml, { entities: true }) as any;
    expect(result.root).toBe('test"value');
  });

  it("should decode multiple entities in text", () => {
    const xml = `<root>test&amp;\nтест&lt;\ntest</root>`;
    const result = lossy(xml, { entities: true }) as any;
    expect(result.root).toBe("test&\nтест<\ntest");
  });

  it("should decode entities in attribute values", () => {
    const xml = `<root attr="2foo&amp;bar&apos;">text</root>`;
    const result = lossy(xml, { entities: true }) as any;
    expect(result.root.$attr).toBe("2foo&bar'");
  });

  // ─── &amp;lt; double-encoding ─────────────────────────────────────

  it("should replace &amp;lt; with &lt;", () => {
    const xml = `<SimpleScalarPropertiesInputOutput>
        <stringValue>&amp;lt;</stringValue>
      </SimpleScalarPropertiesInputOutput>`;
    const result = lossy(xml, { entities: true }) as any;
    expect(result.SimpleScalarPropertiesInputOutput.stringValue).toBe("&lt;");
  });

  // ─── Hex character references ─────────────────────────────────────

  it("should decode hex character references in text", () => {
    // &#xe4; = ä (Latin small letter a with diaerma)
    const xml = `<root>B&#xe4;ren</root>`;
    const result = lossy(xml, { entities: true }) as any;
    expect(result.root).toBe("Bären");
  });

  it("should decode hex character references in attributes", () => {
    // &#x295; = ʕ, &#x2022; = •, &#x1D25; = ᴥ, &#x294; = ʔ
    const xml = `<root face="&#x295;&#x2022;&#x1D25;&#x2022;&#x294;">text</root>`;
    const result = lossy(xml, { entities: true }) as any;
    expect(result.root.$face).toBe("ʕ•ᴥ•ʔ");
  });

  // ─── Decimal character references ─────────────────────────────────

  it("should decode decimal character references", () => {
    // &#228; = ä
    const xml = `<root>B&#228;ren</root>`;
    const result = lossy(xml, { entities: true }) as any;
    expect(result.root).toBe("Bären");
  });

  // ─── Unicode emoji via character references ────────────────────────

  it("should decode high Unicode codepoints (emoji)", () => {
    // &#x1F60A; = 😊, &#128523; = 😋 (decimal for U+1F60B)
    const xml = `<root smile="&#x1F60A;&#128523;">text</root>`;
    const result = lossy(xml, { entities: true }) as any;
    expect(result.root.$smile).toBe("\u{1F60A}\u{1F60B}");
  });

  // ─── DOCTYPE handling ─────────────────────────────────────────────

  it("should parse XML with DOCTYPE without internal DTD", () => {
    const xml = `<?xml version='1.0' standalone='no'?>
            <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" >
            <svg><metadata>test</metadata></svg>`;
    // DOCTYPE is preserved as a top-level string alongside the root element
    const result = lossy(xml) as any;
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatch(/^!DOCTYPE svg/);
    expect(result[1].svg.metadata).toBe("test");
  });

  it("should parse XML with DOCTYPE without internal DTD (brackets in content)", () => {
    const xml = `<?xml version='1.0' standalone='no'?>
        <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" >
        <svg>
            <metadata>[test]</metadata>
        </svg>`;
    const result = lossy(xml) as any;
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatch(/^!DOCTYPE svg/);
    expect(result[1].svg.metadata).toBe("[test]");
  });

  it("should parse XML with DOCTYPE with internal DTD and comments", () => {
    const xml =
      '<?xml version="1.0" standalone="yes" ?>' +
      "<!--open the DOCTYPE declaration -" +
      "  the open square bracket indicates an internal DTD-->" +
      "<!DOCTYPE foo [" +
      "<!--define the internal DTD-->" +
      "<!ELEMENT foo EMPTY>" +
      "<!ELEMENT foo ANY>" +
      "<!--close the DOCTYPE declaration-->" +
      "]>" +
      "<foo>Hello World.</foo>";
    // DOCTYPE is preserved as a top-level string
    const result = lossy(xml) as any;
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatch(/^!DOCTYPE foo/);
    expect(result[1].foo).toBe("Hello World.");
  });

  it("should not throw when DTD comments contain '<' or '>'", () => {
    const xml = `<!DOCTYPE greeting [<!-- < > < -->]><root>ok</root>`;
    // DOCTYPE is preserved as a top-level string
    const result = lossy(xml) as any;
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatch(/^!DOCTYPE greeting/);
    expect(result[1].root).toBe("ok");
  });

  it("should handle entity value with matching quotes in DTD", () => {
    const xml = `<!DOCTYPE x [ <!ENTITY x 'x">]><!--'> ]>
            <X>
                <Y/><![CDATA[--><X><Z/><!--]]>-->
            </X>`;
    // DOCTYPE is preserved; the actual XML is <X> with <Y/> and CDATA
    // Since <X> contains both elements and text (CDATA), it's genuine mixed content → $$
    const result = lossy(xml) as any;
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatch(/^!DOCTYPE x/);
    // Y is inside the $$ mixed-content array as { Y: null }
    const mixed = result[1].X.$$;
    expect(mixed).toBeDefined();
    expect(mixed[0]).toEqual({ Y: null });
    // CDATA content and trailing text (may include whitespace before closing tag)
    expect(mixed[1]).toBe("--><X><Z/><!--");
    expect(mixed[2]).toContain("-->");
  });

  it("should allow !ATTLIST & !NOTATION in DOCTYPE", () => {
    const xml = `<?xml version="1.0"?>
        <!DOCTYPE code [
          <!ELEMENT code (#PCDATA)>
          <!NOTATION vrml PUBLIC "VRML 1.0">
          <!NOTATION vrml2 PUBLIC "VRML 1.0"   "system">
          <!ATTLIST code lang NOTATION (vrml) #REQUIRED>
        ]>
        <code lang="vrml">Some VRML instructions</code>`;
    // DOCTYPE is preserved as a top-level string
    const result = lossy(xml) as any;
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatch(/^!DOCTYPE code/);
    expect(result[1].code.$lang).toBe("vrml");
    // eksml uses $$ when attributes + text coexist
    expect(result[1].code.$$).toBeDefined();
  });

  // ─── CDATA with entities ──────────────────────────────────────────

  it("should not decode entities inside CDATA", () => {
    const xml = `<root><![CDATA[&amp; &lt; &gt;]]></root>`;
    const result = lossy(xml, { entities: true }) as any;
    // CDATA content should be literal, no entity decoding
    expect(result.root).toBe("&amp; &lt; &gt;");
  });

  // ─── Namespaced elements with entities ────────────────────────────

  it("should handle entities in namespaced elements", () => {
    const xml = `<a:root xmlns:a="urn:none">
        <a:c>test&amp;\nтест&lt;\ntest</a:c>
    </a:root>`;
    const result = lossy(xml, { entities: true }) as any;
    expect(result["a:root"]["a:c"]).toBe("test&\nтест<\ntest");
  });

  // ─── Unknown entities ─────────────────────────────────────────────

  it("should preserve unknown entities as-is", () => {
    const xml = `<root>&unknown;</root>`;
    const result = lossy(xml, { entities: true }) as any;
    // eksml only decodes built-in XML entities; unknown ones are preserved
    expect(result.root).toBe("&unknown;");
  });
});
