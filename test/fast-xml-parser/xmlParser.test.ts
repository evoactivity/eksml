/**
 * Ported from fast-xml-parser/spec/xmlParser_spec.js
 *
 * Key differences from fast-xml-parser:
 *   - eksml does NOT coerce values (no number/boolean parsing) — all text stays as strings
 *   - Attribute prefix is "$" not "@_"
 *   - Mixed text+elements uses "$$" array, not "#text" key
 *   - Empty elements produce `null`, not `""`
 *   - We always parse attributes (no ignoreAttributes option)
 *   - No removeNSPrefix option — namespaces are preserved as-is
 *
 * Tests that rely on options we don't support (parseTagValue, numberParseOptions,
 * trimValues, removeNSPrefix, alwaysCreateTextNode, textNodeName, etc.)
 * are either adapted or skipped.
 */
import { describe, it, expect } from "vitest";
import { lossy } from "#src/converters/lossy.ts";

// ─── Adapted from: "should parse all values as string" ─────────────────
// Original expected numbers/booleans — we keep everything as strings.
describe("core parsing (from xmlParser_spec)", () => {
  it("should parse all values as strings (no coercion)", () => {
    const xmlData = `<rootNode>
        <tag>value</tag>
        <boolean>true</boolean>
        <intTag>045</intTag>
        <floatTag>65.34</floatTag>
        <hexadecimal>0x15</hexadecimal>
        </rootNode>`;
    const expected = {
      rootNode: {
        tag: "value",
        boolean: "true",
        intTag: "045",
        floatTag: "65.34",
        hexadecimal: "0x15",
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should parse empty text Node" ────────────────────────────────
  // Original expected { rootNode: { tag: "" } }, we produce null for empty elements
  it("should parse empty element as null", () => {
    const xmlData = `<rootNode><tag></tag></rootNode>`;
    const expected = {
      rootNode: {
        tag: null,
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should parse self closing tags" ──────────────────────────────
  it("should parse self closing tags with attributes", () => {
    const xmlData = `<rootNode><tag ns:arg='value'/></rootNode>`;
    const expected = {
      rootNode: {
        tag: {
          "$ns:arg": "value",
        },
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should parse single self closing tag" ────────────────────────
  it("should parse single self closing tag", () => {
    const xmlData = `<tag arg='value'/>`;
    const expected = {
      tag: {
        $arg: "value",
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should parse repeated nodes in array" ────────────────────────
  // Original expected numbers; we keep strings
  it("should parse repeated nodes in array", () => {
    const xmlData = `<rootNode>
        <tag>value</tag>
        <tag>45</tag>
        <tag>65.34</tag>
    </rootNode>`;
    const expected = {
      rootNode: {
        tag: ["value", "45", "65.34"],
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should parse nested nodes in nested properties" ──────────────
  it("should parse nested nodes in nested properties", () => {
    const xmlData = `<rootNode>
        <parenttag>
            <tag>value</tag>
            <tag>45</tag>
            <tag>65.34</tag>
        </parenttag>
    </rootNode>`;
    const expected = {
      rootNode: {
        parenttag: {
          tag: ["value", "45", "65.34"],
        },
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should parse non-text nodes with value for repeated nodes" ───
  it("should parse repeated elements with attributes", () => {
    const xmlData = `
<rootNode>
    <parenttag attr1='some val' attr2='another val'>
        <tag>value</tag>
        <tag attr1='val' attr2='234'>45</tag>
        <tag>65.34</tag>
    </parenttag>
    <parenttag attr1='some val' attr2='another val'>
        <tag>value</tag>
        <tag attr1='val' attr2='234'>45</tag>
        <tag>65.34</tag>
    </parenttag>
</rootNode>`;
    const expected = {
      rootNode: {
        parenttag: [
          {
            $attr1: "some val",
            $attr2: "another val",
            tag: [
              "value",
              {
                $attr1: "val",
                $attr2: "234",
                $$: ["45"],
              },
              "65.34",
            ],
          },
          {
            $attr1: "some val",
            $attr2: "another val",
            tag: [
              "value",
              {
                $attr1: "val",
                $attr2: "234",
                $$: ["45"],
              },
              "65.34",
            ],
          },
        ],
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should preserve node value" (trimValues:false equivalent) ────
  // We don't trim by default, so this should just work.
  it("should preserve whitespace in text and attributes", () => {
    const xmlData = `<rootNode attr1=' some val ' name='another val'> some val </rootNode>`;
    const expected = {
      rootNode: {
        $attr1: " some val ",
        $name: "another val",
        $$: [" some val "],
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should parse with attributes and value when there is single node" ─
  it("should parse element with attributes and text value", () => {
    const xmlData = `<rootNode attr1='some val' attr2='another val'>val</rootNode>`;
    const expected = {
      rootNode: {
        $attr1: "some val",
        $attr2: "another val",
        $$: ["val"],
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should parse different tags" ─────────────────────────────────
  it("should parse different top-level tags", () => {
    const xmlData = `<tag.1>val1</tag.1><tag.2>val2</tag.2>`;
    const result = lossy(xmlData);
    // Multiple roots → array
    expect(result).toEqual([{ "tag.1": "val1" }, { "tag.2": "val2" }]);
  });

  // ─── "should parse nested elements with attributes" ────────────────
  it("should parse nested elements with attributes", () => {
    const xmlData = `<root>
    <Meet date="2017-05-03" type="A" name="Meeting 'A'">
        <Event time="00:05:00" ID="574" Name="Some Event Name">
            <User ID="1">Bob</User>
        </Event>
    </Meet>
</root>`;
    const expected = {
      root: {
        Meet: {
          $date: "2017-05-03",
          $type: "A",
          $name: "Meeting 'A'",
          Event: {
            $time: "00:05:00",
            $ID: "574",
            $Name: "Some Event Name",
            User: {
              $ID: "1",
              $$: ["Bob"],
            },
          },
        },
      },
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  // ─── "should parse node with space in closing node" (Issue #77) ────
  it("should parse node with space in closing tag", () => {
    const xmlData =
      "<?xml version='1.0'?>" +
      "<any_name>" +
      "    <person>" +
      "        <name1>Jack 1</name1 >" +
      "        <name2>Jack 2</name2>" +
      "    </person>" +
      "</any_name>";

    const result = lossy(xmlData) as Record<string, unknown>;
    // We strip processing instructions at top level
    // The important thing is the content parses correctly
    expect(result).toHaveProperty("any_name");
    const anyName = (result as any).any_name;
    expect(anyName.person.name1).toBe("Jack 1");
    expect(anyName.person.name2).toBe("Jack 2");
  });

  // ─── "should parse node with text before, after and between subtags" ─
  it("should handle mixed content with text around subtags", () => {
    const xmlData =
      "<tag>before" +
      "    <subtag>subtag text</subtag>" +
      "    middle" +
      "    <self />" +
      "    after self" +
      "    <subtag2>subtag text</subtag2>" +
      "    after" +
      "</tag>";

    // In our lossy format, mixed content uses $$ array
    const result = lossy(xmlData) as any;
    expect(result.tag).toHaveProperty("$$");
    // The $$ array should contain text and element entries
    const mixed = result.tag.$$;
    expect(Array.isArray(mixed)).toBe(true);
    // Should contain text nodes and element objects
    const textParts = mixed.filter((e: any) => typeof e === "string");
    const elemParts = mixed.filter((e: any) => typeof e === "object");
    expect(textParts.length).toBeGreaterThan(0);
    expect(elemParts.length).toBeGreaterThan(0);
  });

  // ─── "should validate before parsing" (error on malformed XML) ─────
  it("should throw on unclosed tag", () => {
    const xmlData = "<tag>" + "    <subtag2>subtag text</subtag2>" + "</tag";
    expect(() => {
      lossy(xmlData, { strict: true });
    }).toThrow();
  });
});

// ─── Whitespace and value preservation ────────────────────────────────
describe("whitespace handling (from xmlParser_spec)", () => {
  it("should not trim tag value by default", () => {
    const xmlData = "<rootNode>       123        </rootNode>";
    const expected = {
      rootNode: "       123        ",
    };
    expect(lossy(xmlData)).toEqual(expected);
  });

  it("should encode default XML entities", () => {
    const xmlData = "<rootNode>       foo&amp;bar&apos;        </rootNode>";
    // &amp; → &, &apos; → '
    const result = lossy(xmlData, { entities: true }) as any;
    expect(result.rootNode).toContain("foo&bar'");
  });
});

// ─── Namespace handling ───────────────────────────────────────────────
describe("namespace handling (from xmlParser_spec)", () => {
  it("should preserve namespace prefixes on tag names", () => {
    const xmlData = `<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/" >
    <soap-env:Header>
        <cor:applicationID>dashboardweb</cor:applicationID>
        <cor:providerID>abc</cor:providerID>
    </soap-env:Header>
    <soap-env:Body>
        <man:getOffers>
            <man:customerId>
                <cor:msisdn>123456789</cor:msisdn>
            </man:customerId>
        </man:getOffers>
    </soap-env:Body>
</soap-env:Envelope>`;

    const result = lossy(xmlData) as any;
    // We preserve namespace prefixes (no removeNSPrefix option)
    expect(result).toHaveProperty("soap-env:Envelope");
    const envelope = result["soap-env:Envelope"];
    expect(envelope).toHaveProperty("soap-env:Header");
    expect(envelope).toHaveProperty("soap-env:Body");
    expect(envelope["soap-env:Header"]["cor:applicationID"]).toBe(
      "dashboardweb",
    );
  });

  it("should parse xmlns attributes", () => {
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
});
