import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  parse,
  filter,
  toContentString,
  HTML_VOID_ELEMENTS,
  HTML_RAW_CONTENT_TAGS,
  type TNode,
} from "../src/parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures", name), "utf-8");

const htmlPage = fixture("html-page.html");

// =================================================================
// fixture: html-page.html  (parsed with { html: true })
// =================================================================
describe("fixture: html-page.html", () => {
  it("parses without error", () => {
    expect(() => parse(htmlPage, { html: true })).not.toThrow();
  });

  it("throws without html mode (angle brackets in script/style)", () => {
    // Without html: true, the <tag> inside CSS and angle brackets in JS are invalid XML
    expect(() => parse(htmlPage)).toThrow();
  });

  it("finds the DOCTYPE and html root", () => {
    const result = parse(htmlPage, { html: true }) as (TNode | string)[];
    // DOCTYPE appears as a string
    const doctype = result.find(
      (n) => typeof n === "string" && n.includes("DOCTYPE"),
    );
    expect(doctype).toBeDefined();
    const html = result.find(
      (n) => typeof n === "object" && n.tagName === "html",
    ) as TNode;
    expect(html).toBeDefined();
    expect(html.attributes.lang).toBe("en");
    expect(html.attributes["data-theme"]).toBe("light");
  });

  it("finds head and body as children of html", () => {
    const result = parse(htmlPage, { html: true });
    const html = result.find(
      (n): n is TNode => typeof n === "object" && n.tagName === "html",
    )!;
    const head = html.children.find(
      (c) => typeof c === "object" && c.tagName === "head",
    ) as TNode;
    const body = html.children.find(
      (c) => typeof c === "object" && c.tagName === "body",
    ) as TNode;
    expect(head).toBeDefined();
    expect(body).toBeDefined();
  });

  // --- Void elements ---

  it("parses all meta elements as self-closing", () => {
    const result = parse(htmlPage, { html: true });
    const metas = filter(result, (n) => n.tagName === "meta");
    expect(metas.length).toBe(5);
    for (const m of metas) {
      expect(m.children).toEqual([]);
    }
    expect(metas[0]!.attributes.charset).toBe("utf-8");
    expect(metas[1]!.attributes.name).toBe("viewport");
  });

  it("parses all link elements as self-closing", () => {
    const result = parse(htmlPage, { html: true });
    const links = filter(result, (n) => n.tagName === "link");
    expect(links.length).toBe(7);
    for (const l of links) {
      expect(l.children).toEqual([]);
    }
    const canonical = links.find((l) => l.attributes.rel === "canonical");
    expect(canonical).toBeDefined();
    expect(canonical!.attributes.href).toBe("https://example.com/dashboard");
  });

  it("parses img elements as self-closing", () => {
    const result = parse(htmlPage, { html: true });
    const imgs = filter(result, (n) => n.tagName === "img");
    expect(imgs.length).toBe(3);
    for (const img of imgs) {
      expect(img.children).toEqual([]);
      expect(img.attributes.src).toBeDefined();
      expect(img.attributes.alt).toBeDefined();
    }
  });

  it("parses input elements as self-closing with various types", () => {
    const result = parse(htmlPage, { html: true });
    const inputs = filter(result, (n) => n.tagName === "input");
    expect(inputs.length).toBe(13);
    for (const input of inputs) {
      expect(input.children).toEqual([]);
    }
    // Various input types
    const types = inputs
      .map((i) => i.attributes.type)
      .filter((t) => t !== null);
    expect(types).toContain("search");
    expect(types).toContain("date");
    expect(types).toContain("checkbox");
    expect(types).toContain("radio");
    expect(types).toContain("text");
    expect(types).toContain("email");
  });

  it("parses hr elements as self-closing", () => {
    const result = parse(htmlPage, { html: true });
    const hrs = filter(result, (n) => n.tagName === "hr");
    expect(hrs.length).toBe(5);
    for (const hr of hrs) {
      expect(hr.children).toEqual([]);
    }
  });

  it("parses source and track elements as self-closing", () => {
    const result = parse(htmlPage, { html: true });
    const sources = filter(result, (n) => n.tagName === "source");
    expect(sources.length).toBe(2);
    for (const s of sources) {
      expect(s.children).toEqual([]);
    }
    const tracks = filter(result, (n) => n.tagName === "track");
    expect(tracks.length).toBe(2);
    for (const t of tracks) {
      expect(t.children).toEqual([]);
    }
    // Verify track attributes
    const englishTrack = tracks.find((t) => t.attributes.srclang === "en");
    expect(englishTrack).toBeDefined();
    expect(englishTrack!.attributes.default).toBeNull(); // boolean attr
  });

  it("parses col and embed elements as self-closing", () => {
    const result = parse(htmlPage, { html: true });
    const cols = filter(result, (n) => n.tagName === "col");
    expect(cols.length).toBe(5);
    const embed = filter(result, (n) => n.tagName === "embed");
    expect(embed.length).toBe(1);
    expect(embed[0]!.children).toEqual([]);
    expect(embed[0]!.attributes.type).toBe("application/pdf");
  });

  it("parses wbr elements as self-closing", () => {
    const result = parse(htmlPage, { html: true });
    const wbrs = filter(result, (n) => n.tagName === "wbr");
    expect(wbrs.length).toBe(5);
    for (const w of wbrs) {
      expect(w.children).toEqual([]);
    }
  });

  // --- Raw content tags (script, style) ---

  it("preserves style content as raw text including CSS child selectors and comments", () => {
    const result = parse(htmlPage, { html: true });
    const styles = filter(result, (n) => n.tagName === "style");
    expect(styles.length).toBe(1);
    const css = styles[0]!.children[0] as string;
    expect(typeof css).toBe("string");
    // CSS > child combinator preserved
    expect(css).toContain(".layout > .sidebar");
    expect(css).toContain("nav > ul > li > a");
    // <tag> inside CSS comment preserved
    expect(css).toContain("/* <tag> inside a CSS comment");
    // Attribute selectors preserved
    expect(css).toContain('input[type="text"]');
    expect(css).toContain("button[disabled]");
    expect(css).toContain('a[href^="https://"]');
  });

  it("parses JSON-LD script with structured data", () => {
    const result = parse(htmlPage, { html: true });
    const scripts = filter(result, (n) => n.tagName === "script");
    const jsonLd = scripts.find(
      (s) => s.attributes.type === "application/ld+json",
    );
    expect(jsonLd).toBeDefined();
    const content = (jsonLd!.children[0] as string).trim();
    const data = JSON.parse(content);
    expect(data["@type"]).toBe("WebApplication");
    expect(data.name).toBe("Acme Dashboard");
    expect(data.offers["@type"]).toBe("Offer");
  });

  it("preserves inline JavaScript with angle brackets and DOM creation", () => {
    const result = parse(htmlPage, { html: true });
    const scripts = filter(result, (n) => n.tagName === "script");
    const inlineScript = scripts.find(
      (s) => !s.attributes.type && s.children.length > 0,
    );
    expect(inlineScript).toBeDefined();
    const js = inlineScript!.children[0] as string;
    // DOM manipulation with innerHTML containing HTML
    expect(js).toContain("banner.innerHTML = '<span");
    // Template literal with embedded HTML
    expect(js).toContain('<div class="tooltip">');
    // Comparison operators that look like XML
    expect(js).toContain("v > 1000 && v < 10000");
    // Dynamic script creation
    expect(js).toContain("document.createElement('script')");
    // Regex with angle brackets
    expect(js).toContain("/<\\/?([a-z]");
    // Object with angle brackets in string
    expect(js).toContain("'<production>'");
  });

  it("preserves module script content", () => {
    const result = parse(htmlPage, { html: true });
    const scripts = filter(result, (n) => n.tagName === "script");
    const moduleScript = scripts.find((s) => s.attributes.type === "module");
    expect(moduleScript).toBeDefined();
    const js = moduleScript!.children[0] as string;
    expect(js).toContain("import { Chart }");
    expect(js).toContain("d.value > 0 && d.date < '2026-04-01'");
  });

  // --- Boolean attributes ---

  it("parses boolean attributes as null", () => {
    const result = parse(htmlPage, { html: true });
    // disabled button
    const buttons = filter(result, (n) => n.tagName === "button");
    const disabledBtn = buttons.find(
      (b) => b.attributes.disabled !== undefined,
    );
    expect(disabledBtn).toBeDefined();
    expect(disabledBtn!.attributes.disabled).toBeNull();

    // checked checkbox
    const inputs = filter(result, (n) => n.tagName === "input");
    const checkedInputs = inputs.filter(
      (i) => i.attributes.checked !== undefined,
    );
    expect(checkedInputs.length).toBeGreaterThanOrEqual(2);
    for (const ci of checkedInputs) {
      expect(ci.attributes.checked).toBeNull();
    }

    // hidden div
    const hiddenDiv = filter(
      result,
      (n) => n.tagName === "div" && n.attributes.hidden !== undefined,
    );
    expect(hiddenDiv.length).toBe(1);
    expect(hiddenDiv[0]!.attributes.hidden).toBeNull();
  });

  // --- Complex structure ---

  it("parses the navigation with nested menus and ARIA attributes", () => {
    const result = parse(htmlPage, { html: true });
    const navs = filter(
      result,
      (n) =>
        n.tagName === "nav" &&
        n.attributes["aria-label"] === "Primary navigation",
    );
    expect(navs.length).toBe(1);
    const nav = navs[0]!;
    // Top-level menu items
    const menuItems = filter(
      nav.children.filter((c) => typeof c === "object") as TNode[],
      (n) => n.tagName === "a" && n.attributes.role === "menuitem",
    );
    expect(menuItems.length).toBeGreaterThanOrEqual(4);
    // Dashboard has aria-current
    const dashLink = menuItems.find(
      (m) => m.attributes["aria-current"] === "page",
    );
    expect(dashLink).toBeDefined();
    // Settings has submenu
    const settingsLink = menuItems.find(
      (m) => m.attributes["aria-haspopup"] === "true",
    );
    expect(settingsLink).toBeDefined();
  });

  it("parses the data table with rows and columns", () => {
    const result = parse(htmlPage, { html: true });
    const tables = filter(result, (n) => n.tagName === "table");
    expect(tables.length).toBe(1);
    const table = tables[0]!;
    // thead
    const thead = table.children.find(
      (c) => typeof c === "object" && c.tagName === "thead",
    ) as TNode;
    expect(thead).toBeDefined();
    const thCells = filter([thead], (n) => n.tagName === "th");
    expect(thCells.length).toBe(5);
    expect(thCells.map((th) => toContentString(th.children))).toEqual([
      "Order ID",
      "Customer",
      "Amount",
      "Status",
      "Date",
    ]);
    // tbody rows
    const tbody = table.children.find(
      (c) => typeof c === "object" && c.tagName === "tbody",
    ) as TNode;
    expect(tbody).toBeDefined();
    const rows = filter([tbody], (n) => n.tagName === "tr");
    expect(rows.length).toBe(3);
  });

  it("parses the form with various input types and fieldsets", () => {
    const result = parse(htmlPage, { html: true });
    const forms = filter(result, (n) => n.tagName === "form");
    expect(forms.length).toBe(2);
    const filterForm = forms.find((f) => f.attributes.id === "filter-form");
    expect(filterForm).toBeDefined();
    const fieldsets = filter([filterForm!], (n) => n.tagName === "fieldset");
    expect(fieldsets.length).toBe(3);
    // Legends
    const legends = filter([filterForm!], (n) => n.tagName === "legend");
    expect(legends.map((l) => toContentString(l.children))).toEqual([
      "Date Range",
      "Status",
      "Priority",
    ]);
  });

  it("parses the video element with source and track children", () => {
    const result = parse(htmlPage, { html: true });
    const videos = filter(result, (n) => n.tagName === "video");
    expect(videos.length).toBe(1);
    const video = videos[0]!;
    expect(video.attributes.controls).toBeNull(); // boolean
    expect(video.attributes.preload).toBe("metadata");
    // source elements inside video
    const sources = video.children.filter(
      (c) => typeof c === "object" && c.tagName === "source",
    ) as TNode[];
    expect(sources.length).toBe(2);
    expect(sources[0]!.attributes.type).toBe("video/mp4");
    expect(sources[1]!.attributes.type).toBe("video/webm");
    // track elements inside video
    const tracks = video.children.filter(
      (c) => typeof c === "object" && c.tagName === "track",
    ) as TNode[];
    expect(tracks.length).toBe(2);
  });

  it("parses summary cards with data attributes", () => {
    const result = parse(htmlPage, { html: true });
    const cards = filter(
      result,
      (n) => n.tagName === "div" && n.attributes["data-metric"] !== undefined,
    );
    expect(cards.length).toBe(4);
    expect(cards.map((c) => c.attributes["data-metric"])).toEqual([
      "revenue",
      "users",
      "orders",
      "conversion",
    ]);
  });

  it("preserves HTML entities as-is in text content", () => {
    const result = parse(htmlPage, { html: true });
    // &amp; is preserved as-is (the parser does not decode entities)
    const text = toContentString(result as (TNode | string)[]);
    expect(text).toContain("Bob Smith &amp; Partners");
    // &copy; preserved as-is
    expect(text).toContain("&copy; 2026 Acme Corp");
  });

  it("preserves comments with keepComments option", () => {
    const result = parse(htmlPage, {
      html: true,
      keepComments: true,
    }) as (TNode | string)[];
    const allComments: string[] = [];
    function collectComments(nodes: (TNode | string)[]) {
      for (const node of nodes) {
        if (typeof node === "string" && node.startsWith("<!--")) {
          allComments.push(node);
        } else if (typeof node === "object") {
          collectComments(node.children);
        }
      }
    }
    collectComments(result);
    expect(allComments.length).toBeGreaterThanOrEqual(4);
    expect(allComments.some((c) => c.includes("Skip navigation"))).toBe(true);
    expect(allComments.some((c) => c.includes("Primary navigation"))).toBe(
      true,
    );
    expect(
      allComments.some((c) => c.includes("More rows loaded dynamically")),
    ).toBe(true);
  });

  it("extracts text content from the entire document", () => {
    const result = parse(htmlPage, { html: true });
    const text = toContentString(result as (TNode | string)[]);
    expect(text).toContain("Dashboard Overview");
    expect(text).toContain("Revenue");
    expect(text).toContain("$142,384.00");
    expect(text).toContain("Active Users");
    expect(text).toContain("Send Feedback");
    expect(text).toContain("Alice Johnson");
  });

  it("exposes HTML_VOID_ELEMENTS and HTML_RAW_CONTENT_TAGS constants", () => {
    expect(HTML_VOID_ELEMENTS).toContain("img");
    expect(HTML_VOID_ELEMENTS).toContain("br");
    expect(HTML_VOID_ELEMENTS).toContain("meta");
    expect(HTML_VOID_ELEMENTS).toContain("link");
    expect(HTML_VOID_ELEMENTS).toContain("input");
    expect(HTML_VOID_ELEMENTS).toContain("hr");
    expect(HTML_VOID_ELEMENTS).toContain("wbr");
    expect(HTML_VOID_ELEMENTS).toContain("source");
    expect(HTML_VOID_ELEMENTS).toContain("track");
    expect(HTML_VOID_ELEMENTS).toContain("col");
    expect(HTML_VOID_ELEMENTS).toContain("embed");
    expect(HTML_VOID_ELEMENTS).toHaveLength(14);

    expect(HTML_RAW_CONTENT_TAGS).toEqual(["script", "style"]);
  });

  it("allows overriding rawContentTags in html mode", () => {
    // Override to also treat <textarea> as raw content
    const result = parse("<div><textarea><b>bold</b></textarea></div>", {
      html: true,
      rawContentTags: ["script", "style", "textarea"],
    });
    const textarea = filter(result, (n) => n.tagName === "textarea");
    expect(textarea.length).toBe(1);
    // Content should be raw text, not parsed
    expect(textarea[0]!.children).toEqual(["<b>bold</b>"]);
  });

  it("allows overriding selfClosingTags in html mode", () => {
    // Override to only treat <br> as self-closing
    const result = parse("<div><br><hr></hr></div>", {
      html: true,
      selfClosingTags: ["br"],
    });
    const div = result[0] as TNode;
    const br = div.children.find(
      (c): c is TNode => typeof c === "object" && c.tagName === "br",
    )!;
    expect(br.children).toEqual([]);
    // hr is NOT self-closing with our override, so it has a close tag
    const hr = div.children.find(
      (c): c is TNode => typeof c === "object" && c.tagName === "hr",
    )!;
    expect(hr).toBeDefined();
  });
});
