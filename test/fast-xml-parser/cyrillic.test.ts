/**
 * Ported from fast-xml-parser/spec/x_cyrillic_2j_str_spec.js
 *
 * Tests Unicode/Cyrillic character support in tag names and text content.
 */
import { describe, it, expect } from "vitest";
import { lossy } from "../../src/converters/lossy.ts";

describe("Cyrillic/Unicode support (from x_cyrillic_2j_str_spec)", () => {
  it("should parse XML with Cyrillic tag names and text content", () => {
    const xml = `<КорневаяЗапись><Тэг>ЗначениеValue53456</Тэг></КорневаяЗапись>`;
    const expected = {
      КорневаяЗапись: {
        Тэг: "ЗначениеValue53456",
      },
    };
    const result = lossy(xml);
    expect(result).toEqual(expected);
  });

  it("should parse XML with Cyrillic attribute values", () => {
    const xml = `<root attr="Привет">Мир</root>`;
    const result = lossy(xml) as any;
    expect(result.root.$attr).toBe("Привет");
    expect(result.root.$$).toEqual(["Мир"]);
  });

  it("should parse XML with mixed Cyrillic and Latin content", () => {
    const xml = `<data><item>Тест123Test</item></data>`;
    const result = lossy(xml) as any;
    expect(result.data.item).toBe("Тест123Test");
  });
});
