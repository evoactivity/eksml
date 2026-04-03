/**
 * Ported from fast-xml-parser/spec/comments_spec.js
 *
 * Tests comment handling: stripping by default, preserving when keepComments is set.
 *
 * Skipped tests:
 *   - commentPropName option — we don't have a separate comment property name
 *   - preserveOrder mode — use lossless() for that
 */
import { describe, it, expect } from "vitest";
import { lossy } from "../../src/converters/lossy.ts";
import { lossless } from "../../src/converters/lossless.ts";

describe("comment handling (from comments_spec)", () => {
  const XMLdata = `
    <!--Students grades are uploaded by months-->
    <class_list>
       <student>
         <!--Student details-->
         <!--A second comment-->
         <!-- A third comment -->
         <name>Tanmay</name>
         <!-->> ISO DICTIONARY TYPES <<-->
         <grade>A</grade>
       </student>
    </class_list>`;

  it("should strip comments by default in lossy mode", () => {
    const result = lossy(XMLdata) as any;
    expect(result.class_list.student.name).toBe("Tanmay");
    expect(result.class_list.student.grade).toBe("A");
    // No comment content should leak into the output
    const json = JSON.stringify(result);
    expect(json).not.toContain("Students grades");
    expect(json).not.toContain("Student details");
    expect(json).not.toContain("ISO DICTIONARY");
  });

  it("should preserve comments in lossy mode when keepComments is true", () => {
    const result = lossy(XMLdata, { keepComments: true }) as any;
    const json = JSON.stringify(result);
    // Comments should appear somewhere in the output
    expect(json).toContain("Student details");
  });

  it("should strip comments by default in lossless mode", () => {
    const result = lossless(XMLdata);
    const json = JSON.stringify(result);
    expect(json).not.toContain("Students grades");
    expect(json).not.toContain("Student details");
  });

  it("should preserve comments in lossless mode when keepComments is true", () => {
    const result = lossless(XMLdata, { keepComments: true });
    const json = JSON.stringify(result);
    expect(json).toContain("Student details");
    expect(json).toContain("A second comment");
    expect(json).toContain("ISO DICTIONARY");
  });

  // ─── Comment with dashes ───────────────────────────────────────────
  it("should handle comment containing dashes", () => {
    const xmlData = `<rootNode><!-- <tag> - - --><tag>1</tag></rootNode>`;
    const result = lossy(xmlData) as any;
    expect(result.rootNode.tag).toBe("1");
  });

  // ─── Multiline comment ─────────────────────────────────────────────
  it("should handle multiline comment", () => {
    const xmlData = `<rootNode><!-- multi
line
comment --><tag>value</tag></rootNode>`;
    const result = lossy(xmlData) as any;
    expect(result.rootNode.tag).toBe("value");
  });

  // ─── Comment at document level ─────────────────────────────────────
  it("should handle comment at document level", () => {
    const xmlData = `<!-- top level comment --><root><child/></root>`;
    const result = lossy(xmlData) as any;
    expect(result.root.child).toBeNull();
  });

  // ─── Comment between elements ──────────────────────────────────────
  it("should handle comment between sibling elements", () => {
    const xmlData = `<root><a>1</a><!-- middle --><b>2</b></root>`;
    const result = lossy(xmlData) as any;
    expect(result.root.a).toBe("1");
    expect(result.root.b).toBe("2");
  });
});
