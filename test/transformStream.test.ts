import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { transformStream } from "#src/transformStream.ts";
import { type TNode } from "#src/parser.ts";
import { isElementNode } from "#src/utilities/isElementNode.ts";
import assert from "node:assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures", name), "utf-8");

/** Collect all chunks emitted by a TransformStream fed with the given input chunks. */
async function collect(
  stream: TransformStream<string, TNode | string>,
  chunks: string[],
): Promise<(TNode | string)[]> {
  const results: (TNode | string)[] = [];
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();

  const readAll = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      results.push(value);
    }
  })();

  for (const chunk of chunks) {
    await writer.write(chunk);
  }
  await writer.close();
  await readAll;
  return results;
}

describe("transformStream", () => {
  it("parses all nodes from a single chunk", async () => {
    const stream = transformStream();
    const results = await collect(stream, ["<a>1</a><b>2</b><c>3</c>"]);
    const tags = results
      .filter((r): r is TNode => typeof r === "object")
      .map((r) => r.tagName);
    expect(tags).toEqual(["a", "b", "c"]);
  });

  it("parses a complete XML document in a single chunk", async () => {
    const stream = transformStream();
    const results = await collect(stream, ["<root><item>hello</item></root>"]);
    expect(results).toHaveLength(1);
    const root = results[0] as TNode;
    expect(root.tagName).toBe("root");
    const item = root.children[0] as TNode;
    expect(item.tagName).toBe("item");
    expect(item.children).toEqual(["hello"]);
  });

  it("parses XML split across multiple chunks", async () => {
    const stream = transformStream();
    const results = await collect(stream, ["<a>1</a><b>he", "llo</b><c>3</c>"]);
    const tags = results
      .filter((r): r is TNode => typeof r === "object")
      .map((r) => r.tagName);
    expect(tags).toEqual(["a", "b", "c"]);
    const b = results.find(
      (r) => typeof r === "object" && r.tagName === "b",
    ) as TNode;
    expect(b.children).toEqual(["hello"]);
  });

  it("accepts a numeric offset", async () => {
    const prefix = "JUNK";
    const stream = transformStream(prefix.length);
    const results = await collect(stream, [prefix + "<a>text</a>"]);
    const a = results.find(
      (r) => typeof r === "object" && r.tagName === "a",
    ) as TNode;
    expect(a).toBeDefined();
    expect(a.children).toEqual(["text"]);
  });

  it("accepts a string offset (uses its length)", async () => {
    const prefix = "PREFIX";
    const stream = transformStream(prefix);
    const results = await collect(stream, [prefix + "<a>ok</a>"]);
    const a = results.find(
      (r) => typeof r === "object" && r.tagName === "a",
    ) as TNode;
    expect(a).toBeDefined();
    expect(a.children).toEqual(["ok"]);
  });

  it("skips comments by default", async () => {
    const stream = transformStream();
    const results = await collect(stream, ["<!-- comment --><a>val</a>"]);
    const strings = results.filter(
      (r) => typeof r === "string" && r.startsWith("<!--"),
    );
    expect(strings).toHaveLength(0);
    const a = results.find(
      (r) => typeof r === "object" && r.tagName === "a",
    ) as TNode;
    expect(a).toBeDefined();
    expect(a.children).toEqual(["val"]);
  });

  it("emits comments when keepComments is true", async () => {
    const stream = transformStream(0, { keepComments: true });
    const results = await collect(stream, ["<!-- hello --><a>val</a>"]);
    const comments = results.filter(
      (r) => typeof r === "string" && r.startsWith("<!--"),
    );
    expect(comments).toHaveLength(1);
    expect(comments[0]).toBe("<!-- hello -->");
  });

  it("handles an incomplete element across chunks", async () => {
    const stream = transformStream();
    const results = await collect(stream, [
      '<item id="1">fir',
      'st</item><item id="2">second</item>',
    ]);
    const items = results.filter(
      (r): r is TNode => typeof r === "object" && r.tagName === "item",
    );
    expect(items).toHaveLength(2);
    expect(items[0]!.attributes!.id).toBe("1");
    expect(items[0]!.children).toEqual(["first"]);
    expect(items[1]!.attributes!.id).toBe("2");
    expect(items[1]!.children).toEqual(["second"]);
  });

  it("parses attributes correctly in streamed XML", async () => {
    const stream = transformStream();
    const results = await collect(stream, [
      '<item id="test" class="foo">content</item>',
    ]);
    const item = results.find(
      (r) => typeof r === "object" && r.tagName === "item",
    ) as TNode;
    expect(item).toBeDefined();
    expect(item.attributes!.id).toBe("test");
    expect(item.attributes!.class).toBe("foo");
    expect(item.children).toEqual(["content"]);
  });

  it("handles self-closing tags", async () => {
    const stream = transformStream();
    const results = await collect(stream, ["<br/><hr/>"]);
    const tags = results
      .filter((r): r is TNode => typeof r === "object")
      .map((r) => r.tagName);
    expect(tags).toContain("br");
    expect(tags).toContain("hr");
  });

  it("handles empty input", async () => {
    const stream = transformStream();
    const results = await collect(stream, [""]);
    expect(results).toEqual([]);
  });

  it("handles comment split across chunks", async () => {
    const stream = transformStream(0, { keepComments: true });
    const results = await collect(stream, [
      "<!-- com",
      "ment --><item>ok</item>",
    ]);
    const comments = results.filter(
      (r) => typeof r === "string" && r.startsWith("<!--"),
    );
    expect(comments).toHaveLength(1);
    expect(comments[0]).toBe("<!-- comment -->");
  });

  it("passes through parseOptions to the parser", async () => {
    const stream = transformStream(0, {
      selfClosingTags: ["custom"],
    });
    const results = await collect(stream, ["<custom><a>text</a>"]);
    const tags = results
      .filter((r): r is TNode => typeof r === "object")
      .map((r) => r.tagName);
    expect(tags).toContain("custom");
    expect(tags).toContain("a");
    const custom = results.find(
      (r) => typeof r === "object" && r.tagName === "custom",
    ) as TNode;
    expect(custom.children).toEqual([]);
  });

  it("handles multiple comments interleaved with elements", async () => {
    const stream = transformStream(0, { keepComments: true });
    const results = await collect(stream, [
      "<!-- c1 --><a>1</a><!-- c2 --><b>2</b><c>3</c>",
    ]);
    const comments = results.filter(
      (r) => typeof r === "string" && r.startsWith("<!--"),
    );
    expect(comments).toHaveLength(2);
    expect(comments[0]).toBe("<!-- c1 -->");
    expect(comments[1]).toBe("<!-- c2 -->");
    const tags = results
      .filter((r): r is TNode => typeof r === "object")
      .map((r) => r.tagName);
    expect(tags).toEqual(["a", "b", "c"]);
  });

  it("emits both nodes for two sibling elements", async () => {
    const stream = transformStream();
    const results = await collect(stream, ["<first/><second/>"]);
    const tags = results
      .filter((r): r is TNode => typeof r === "object")
      .map((r) => r.tagName);
    expect(tags).toEqual(["first", "second"]);
  });

  it("flushes a trailing comment when keepComments is true", async () => {
    const stream = transformStream(0, { keepComments: true });
    const results = await collect(stream, ["<a>1</a><!-- trailing -->"]);
    const comments = results.filter(
      (r) => typeof r === "string" && r.startsWith("<!--"),
    );
    expect(comments).toHaveLength(1);
    expect(comments[0]).toBe("<!-- trailing -->");
  });
});

// =================================================================
// Helper: split a string into chunks of a given size
// =================================================================
function chunkString(str: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

// =================================================================
// Streaming tests with complex fixture documents
// =================================================================
describe("transformStream with large fixtures", () => {
  const rssFeed = fixture("rss-feed.xml");
  const soapEnvelope = fixture("soap-envelope.xml");
  const atomFeed = fixture("atom-feed.xml");
  const xhtmlPage = fixture("xhtml-page.xml");
  const pomXml = fixture("pom.xml");

  describe("rss-feed.xml", () => {
    it("streams entire document as a single chunk", async () => {
      const stream = transformStream();
      const results = await collect(stream, [rssFeed]);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      expect(nodes.length).toBeGreaterThanOrEqual(1);
      // Should emit the rss root (possibly preceded by a processing instruction)
      const rss = nodes.find((n) => n.tagName === "rss");
      expect(rss).toBeDefined();
      expect(rss!.attributes!.version).toBe("2.0");
    });

    it("streams in small chunks (64 bytes) and still produces valid nodes", async () => {
      const stream = transformStream();
      const chunks = chunkString(rssFeed, 64);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const rss = nodes.find((n) => n.tagName === "rss");
      expect(rss).toBeDefined();
    });

    it("streams in medium chunks (256 bytes)", async () => {
      const stream = transformStream();
      const chunks = chunkString(rssFeed, 256);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      expect(nodes.length).toBeGreaterThanOrEqual(1);
    });

    it("produces consistent results across different chunk sizes", async () => {
      const tagSets: string[][] = [];
      for (const size of [32, 128, 512, rssFeed.length]) {
        const stream = transformStream();
        const chunks = chunkString(rssFeed, size);
        const results = await collect(stream, chunks);
        const tags = results
          .filter((r): r is TNode => typeof r === "object")
          .map((r) => r.tagName);
        tagSets.push(tags);
      }
      // All chunk sizes should produce the same set of top-level tags
      for (let i = 1; i < tagSets.length; i++) {
        expect(tagSets[i]).toEqual(tagSets[0]);
      }
    });
  });

  describe("soap-envelope.xml", () => {
    it("streams entire document as a single chunk", async () => {
      const stream = transformStream();
      const results = await collect(stream, [soapEnvelope]);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const envelope = nodes.find((n) => n.tagName === "soap:Envelope");
      expect(envelope).toBeDefined();
      expect(envelope!.attributes!["xmlns:soap"]).toBe(
        "http://schemas.xmlsoap.org/soap/envelope/",
      );
    });

    it("streams in small chunks (48 bytes)", async () => {
      const stream = transformStream();
      const chunks = chunkString(soapEnvelope, 48);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const envelope = nodes.find((n) => n.tagName === "soap:Envelope");
      expect(envelope).toBeDefined();
    });

    it("preserves deeply nested structure when streamed", async () => {
      const stream = transformStream();
      const chunks = chunkString(soapEnvelope, 100);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const envelope = nodes.find((n) => n.tagName === "soap:Envelope");
      expect(envelope).toBeDefined();

      // Drill into Header > Security > Timestamp
      const header = envelope!.children.find(
        (c) => typeof c === "object" && c.tagName === "soap:Header",
      ) as TNode;
      expect(header).toBeDefined();
      const security = header.children.find(
        (c) => typeof c === "object" && c.tagName === "wsse:Security",
      ) as TNode;
      expect(security).toBeDefined();
      const timestamp = security.children.find(
        (c) => typeof c === "object" && c.tagName === "wsu:Timestamp",
      ) as TNode;
      expect(timestamp).toBeDefined();
      expect(timestamp.attributes!["wsu:Id"]).toBe("TS-1");
    });

    it("produces consistent results across different chunk sizes", async () => {
      const tagSets: string[][] = [];
      for (const size of [50, 200, soapEnvelope.length]) {
        const stream = transformStream();
        const chunks = chunkString(soapEnvelope, size);
        const results = await collect(stream, chunks);
        const tags = results
          .filter((r): r is TNode => typeof r === "object")
          .map((r) => r.tagName);
        tagSets.push(tags);
      }
      for (let i = 1; i < tagSets.length; i++) {
        expect(tagSets[i]).toEqual(tagSets[0]);
      }
    });
  });

  describe("atom-feed.xml", () => {
    it("streams entire document as a single chunk", async () => {
      const stream = transformStream();
      const results = await collect(stream, [atomFeed]);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const feed = nodes.find((n) => n.tagName === "feed");
      expect(feed).toBeDefined();
      expect(feed!.attributes!.xmlns).toBe("http://www.w3.org/2005/Atom");
    });

    it("streams in small chunks (80 bytes)", async () => {
      const stream = transformStream();
      const chunks = chunkString(atomFeed, 80);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const feed = nodes.find((n) => n.tagName === "feed");
      expect(feed).toBeDefined();
    });

    it("produces consistent results across different chunk sizes", async () => {
      const tagSets: string[][] = [];
      for (const size of [64, 256, 1024, atomFeed.length]) {
        const stream = transformStream();
        const chunks = chunkString(atomFeed, size);
        const results = await collect(stream, chunks);
        const tags = results
          .filter((r): r is TNode => typeof r === "object")
          .map((r) => r.tagName);
        tagSets.push(tags);
      }
      for (let i = 1; i < tagSets.length; i++) {
        expect(tagSets[i]).toEqual(tagSets[0]);
      }
    });
  });

  describe("xhtml-page.xml", () => {
    it("streams entire document as a single chunk", async () => {
      const stream = transformStream();
      const results = await collect(stream, [xhtmlPage]);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const html = nodes.find((n) => n.tagName === "html");
      expect(html).toBeDefined();
    });

    it("streams in small chunks (100 bytes)", async () => {
      const stream = transformStream();
      const chunks = chunkString(xhtmlPage, 100);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const html = nodes.find((n) => n.tagName === "html");
      expect(html).toBeDefined();
    });

    it("streams with keepComments enabled", async () => {
      const stream = transformStream(0, { keepComments: true });
      const results = await collect(stream, chunkString(xhtmlPage, 150));
      const comments = results.filter(
        (r) => typeof r === "string" && r.startsWith("<!--"),
      );
      // There should be no top-level comments (they are all inside <html>)
      // but the nodes inside should still have comments preserved
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const html = nodes.find((n) => n.tagName === "html");
      expect(html).toBeDefined();
    });

    it("produces consistent results across different chunk sizes", async () => {
      const tagSets: string[][] = [];
      for (const size of [75, 300, 1000, xhtmlPage.length]) {
        const stream = transformStream();
        const chunks = chunkString(xhtmlPage, size);
        const results = await collect(stream, chunks);
        const tags = results
          .filter((r): r is TNode => typeof r === "object")
          .map((r) => r.tagName);
        tagSets.push(tags);
      }
      for (let i = 1; i < tagSets.length; i++) {
        expect(tagSets[i]).toEqual(tagSets[0]);
      }
    });
  });

  describe("pom.xml", () => {
    it("streams entire document as a single chunk", async () => {
      const stream = transformStream();
      const results = await collect(stream, [pomXml]);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const project = nodes.find((n) => n.tagName === "project");
      expect(project).toBeDefined();
    });

    it("streams in small chunks (64 bytes)", async () => {
      const stream = transformStream();
      const chunks = chunkString(pomXml, 64);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const project = nodes.find((n) => n.tagName === "project");
      expect(project).toBeDefined();
    });

    it("preserves deeply nested build plugin configuration when streamed", async () => {
      const stream = transformStream();
      const chunks = chunkString(pomXml, 128);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const project = nodes.find((n) => n.tagName === "project");
      expect(project).toBeDefined();

      // Verify we can drill into build > plugins > plugin
      const build = project!.children.find(
        (c) => typeof c === "object" && c.tagName === "build",
      );
      expect(build).toBeDefined();
      assert(isElementNode(build!));
      const plugins = build!.children.find(
        (c) => typeof c === "object" && c.tagName === "plugins",
      );
      expect(plugins).toBeDefined();
      assert(isElementNode(plugins!));
      const pluginElements = plugins!.children.filter(
        (c) => typeof c === "object" && c.tagName === "plugin",
      );
      expect(pluginElements.length).toBeGreaterThanOrEqual(3);
    });

    it("produces consistent results across different chunk sizes", async () => {
      const tagSets: string[][] = [];
      for (const size of [50, 200, 500, pomXml.length]) {
        const stream = transformStream();
        const chunks = chunkString(pomXml, size);
        const results = await collect(stream, chunks);
        const tags = results
          .filter((r): r is TNode => typeof r === "object")
          .map((r) => r.tagName);
        tagSets.push(tags);
      }
      for (let i = 1; i < tagSets.length; i++) {
        expect(tagSets[i]).toEqual(tagSets[0]);
      }
    });
  });

  // =================================================================
  // Real-world use case: streaming an XMLTV EPG feed
  // =================================================================
  // XMLTV is a standard XML format for electronic programme guide data,
  // used by TV tuner software (MythTV, TVHeadend, Jellyfin, Plex, etc.).
  // This test simulates receiving an XMLTV feed in chunks over a network
  // connection and incrementally building a channel -> programme mapping.
  describe("xmltv-epg.xml — real-world EPG streaming", () => {
    const xmltvFeed = fixture("xmltv-epg.xml");

    type Programme = {
      start: string;
      end: string;
      title: string;
      description: string;
    };
    type EPG = Record<string, Programme[]>;

    /**
     * Simulates a real-world streaming consumer that builds an EPG record
     * from XMLTV data arriving in arbitrary chunks. Instead of collecting
     * all nodes and processing them after, this processes each node as it
     * arrives — exactly how you'd handle a live XMLTV stream from a socket
     * or HTTP response.
     */
    async function buildEPGFromStream(chunks: string[]): Promise<{
      channels: Map<string, string>;
      epg: EPG;
    }> {
      const stream = transformStream();
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      const channels = new Map<string, string>(); // id -> display name
      const epg: EPG = {};

      // Consumer: read nodes as they arrive and build the EPG
      const consumer = (async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (typeof value === "string") continue;

          const node = value as TNode;

          if (node.tagName === "tv") {
            // The root <tv> element — process its children for channels/programmes
            for (const child of node.children) {
              if (typeof child === "string") continue;
              processNode(child);
            }
          } else {
            processNode(node);
          }
        }
      })();

      function processNode(node: TNode) {
        if (node.tagName === "channel") {
          const id = node.attributes!.id as string;
          const displayName = node.children.find(
            (c) => typeof c !== "string" && c.tagName === "display-name",
          ) as TNode | undefined;
          if (displayName) {
            channels.set(id, displayName.children[0] as string);
          }
          if (!epg[id]) epg[id] = [];
        }

        if (node.tagName === "programme") {
          const channelId = node.attributes!.channel as string;
          const start = node.attributes!.start as string;
          const end = node.attributes!.stop as string;

          const titleNode = node.children.find(
            (c) => typeof c !== "string" && c.tagName === "title",
          ) as TNode | undefined;
          const descNode = node.children.find(
            (c) => typeof c !== "string" && c.tagName === "desc",
          ) as TNode | undefined;

          if (!epg[channelId]) epg[channelId] = [];
          epg[channelId].push({
            start,
            end,
            title: titleNode ? (titleNode.children[0] as string) : "",
            description: descNode ? (descNode.children[0] as string) : "",
          });
        }
      }

      // Producer: feed chunks to the stream
      for (const chunk of chunks) {
        await writer.write(chunk);
      }
      await writer.close();
      await consumer;

      return { channels, epg };
    }

    it("builds a complete EPG from a single chunk", async () => {
      const { channels, epg } = await buildEPGFromStream([xmltvFeed]);

      // 8 channels
      expect(channels.size).toBe(8);
      expect(channels.get("bbc1.uk")).toBe("BBC One");
      expect(channels.get("itv1.uk")).toBe("ITV");
      expect(channels.get("film4.uk")).toBe("Film4");

      // Correct number of programmes per channel
      expect(epg["bbc1.uk"]).toHaveLength(5);
      expect(epg["bbc2.uk"]).toHaveLength(4);
      expect(epg["itv1.uk"]).toHaveLength(4);
      expect(epg["ch4.uk"]).toHaveLength(3);
      expect(epg["five.uk"]).toHaveLength(3);
      expect(epg["sky-news.uk"]).toHaveLength(3);
      expect(epg["dave.uk"]).toHaveLength(4);
      expect(epg["film4.uk"]).toHaveLength(2);

      // Total programmes
      const total = Object.values(epg).reduce((sum, p) => sum + p.length, 0);
      expect(total).toBe(28);
    });

    it("builds a complete EPG from small chunks (128 bytes) simulating slow network", async () => {
      const chunks = chunkString(xmltvFeed, 128);
      expect(chunks.length).toBeGreaterThan(10); // many chunks

      const { channels, epg } = await buildEPGFromStream(chunks);

      expect(channels.size).toBe(8);
      const total = Object.values(epg).reduce((sum, p) => sum + p.length, 0);
      expect(total).toBe(28);
    });

    it("preserves programme details when streamed in 256-byte chunks", async () => {
      const chunks = chunkString(xmltvFeed, 256);
      const { epg } = await buildEPGFromStream(chunks);

      // Verify specific programme details
      const bbcNews = epg["bbc1.uk"]![0]!;
      expect(bbcNews.title).toBe("BBC News at Six");
      expect(bbcNews.start).toBe("20260403180000 +0100");
      expect(bbcNews.end).toBe("20260403183000 +0100");
      expect(bbcNews.description).toContain("national and international news");

      // Film4's Blade Runner 2049
      const bladeRunner = epg["film4.uk"]![0]!;
      expect(bladeRunner.title).toBe("Blade Runner 2049");
      expect(bladeRunner.start).toBe("20260403183000 +0100");
      expect(bladeRunner.end).toBe("20260403205500 +0100");
      expect(bladeRunner.description).toContain("Denis Villeneuve");

      // ITV's Vera (last programme in slot)
      const vera = epg["itv1.uk"]!.find((p) => p.title === "Vera")!;
      expect(vera).toBeDefined();
      expect(vera.start).toBe("20260403200000 +0100");
      expect(vera.end).toBe("20260403220000 +0100");
      expect(vera.description).toContain("Northumberland");
    });

    it("produces identical EPG across different chunk sizes", async () => {
      const sizes = [64, 128, 256, 512, 1024, xmltvFeed.length];
      const results: EPG[] = [];

      for (const size of sizes) {
        const chunks = chunkString(xmltvFeed, size);
        const { epg } = await buildEPGFromStream(chunks);
        results.push(epg);
      }

      // All chunk sizes should produce the same EPG
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0]);
      }
    });

    it("handles chunks that split mid-attribute and mid-entity", async () => {
      // Use a prime chunk size to maximize splits at awkward boundaries
      const chunks = chunkString(xmltvFeed, 97);
      const { channels, epg } = await buildEPGFromStream(chunks);

      expect(channels.size).toBe(8);

      // Programmes with apostrophes and special characters
      const oneShow = epg["bbc1.uk"]!.find((p) => p.title === "The One Show");
      expect(oneShow).toBeDefined();

      // Sky News documentary with long description
      const climateFiles = epg["sky-news.uk"]!.find((p) =>
        p.title.includes("Climate Files"),
      );
      expect(climateFiles).toBeDefined();
      expect(climateFiles!.description).toContain("leaked documents");
    });

    it("builds EPG progressively — early channels appear before later programmes", async () => {
      // This test verifies the streaming nature: we can start processing
      // channels before all programmes have arrived
      const stream = transformStream();
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      const arrivedChannels: string[] = [];
      const arrivedProgrammes: string[] = [];

      const consumer = (async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (typeof value === "string") continue;

          const node = value as TNode;
          // The root <tv> wraps everything, so drill into its children
          if (node.tagName === "tv") {
            for (const child of node.children) {
              if (typeof child === "string") continue;
              if (child.tagName === "channel") {
                arrivedChannels.push(child.attributes!.id as string);
              }
              if (child.tagName === "programme") {
                arrivedProgrammes.push(child.attributes!.channel as string);
              }
            }
          }
        }
      })();

      // Feed entire document
      const chunks = chunkString(xmltvFeed, 512);
      for (const chunk of chunks) {
        await writer.write(chunk);
      }
      await writer.close();
      await consumer;

      // All 8 channels should have been seen
      expect(arrivedChannels).toHaveLength(8);
      expect(arrivedChannels[0]).toBe("bbc1.uk");
      expect(arrivedChannels[7]).toBe("film4.uk");

      // All 28 programmes should have been seen
      expect(arrivedProgrammes).toHaveLength(28);
    });
  });

  describe("html-page.html", () => {
    const htmlPage = fixture("html-page.html");

    it("streams entire document as a single chunk with html mode", async () => {
      const stream = transformStream(0, { html: true });
      const results = await collect(stream, [htmlPage]);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const html = nodes.find((n) => n.tagName === "html");
      expect(html).toBeDefined();
      expect(html!.attributes!.lang).toBe("en");
    });

    it("streams in small chunks (100 bytes) with html mode", async () => {
      const stream = transformStream(0, { html: true });
      const chunks = chunkString(htmlPage, 100);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const html = nodes.find((n) => n.tagName === "html");
      expect(html).toBeDefined();
    });

    it("preserves script content when streamed with html mode", async () => {
      const stream = transformStream(0, { html: true });
      const results = await collect(stream, [htmlPage]);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const html = nodes.find((n) => n.tagName === "html")!;
      // Find scripts deeply
      const scripts: TNode[] = [];
      function findScripts(children: (TNode | string)[]) {
        for (const c of children) {
          if (typeof c === "object") {
            if (c.tagName === "script") scripts.push(c);
            findScripts(c.children);
          }
        }
      }
      findScripts(html.children);
      expect(scripts.length).toBe(3);

      // JSON-LD should be valid JSON
      const jsonLd = scripts.find(
        (s) => s.attributes!.type === "application/ld+json",
      );
      expect(jsonLd).toBeDefined();
      const jsonContent = (jsonLd!.children[0] as string).trim();
      expect(() => JSON.parse(jsonContent)).not.toThrow();

      // Inline JS should contain angle brackets
      const inlineJs = scripts.find((s) => !s.attributes!.type);
      expect(inlineJs).toBeDefined();
      const jsContent = inlineJs!.children[0] as string;
      expect(jsContent).toContain("createElement('script')");
      expect(jsContent).toContain("v > 1000 && v < 10000");
    });

    it("preserves style content when streamed with html mode", async () => {
      const stream = transformStream(0, { html: true });
      const results = await collect(stream, [htmlPage]);
      const nodes = results.filter((r): r is TNode => typeof r === "object");
      const html = nodes.find((n) => n.tagName === "html")!;
      // Find style deeply
      const styles: TNode[] = [];
      function findStyles(children: (TNode | string)[]) {
        for (const c of children) {
          if (typeof c === "object") {
            if (c.tagName === "style") styles.push(c);
            findStyles(c.children);
          }
        }
      }
      findStyles(html.children);
      expect(styles.length).toBe(1);
      const css = styles[0]!.children[0] as string;
      expect(css).toContain(".layout > .sidebar");
      expect(css).toContain("/* <tag>");
    });

    it("produces consistent results across different chunk sizes", async () => {
      const tagSets: string[][] = [];
      for (const size of [80, 256, 1024, htmlPage.length]) {
        const stream = transformStream(0, { html: true });
        const chunks = chunkString(htmlPage, size);
        const results = await collect(stream, chunks);
        const tags = results
          .filter((r): r is TNode => typeof r === "object")
          .map((r) => r.tagName);
        tagSets.push(tags);
      }
      for (let i = 1; i < tagSets.length; i++) {
        expect(tagSets[i]).toEqual(tagSets[0]);
      }
    });
  });
});
