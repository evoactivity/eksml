import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { XmlParseStream } from '#src/xmlParseStream.ts';
import { type TNode } from '#src/parser.ts';
import { isElementNode } from '#src/utilities/isElementNode.ts';
import assert from 'node:assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8');

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

describe('XmlParseStream', () => {
  it('parses all nodes from a single chunk', async () => {
    const stream = new XmlParseStream();
    const results = await collect(stream, ['<a>1</a><b>2</b><c>3</c>']);
    const tags = results
      .filter((r): r is TNode => typeof r === 'object')
      .map((r) => r.tagName);
    expect(tags).toEqual(['a', 'b', 'c']);
  });

  it('parses a complete XML document in a single chunk', async () => {
    const stream = new XmlParseStream();
    const results = await collect(stream, ['<root><item>hello</item></root>']);
    expect(results).toHaveLength(1);
    const root = results[0] as TNode;
    expect(root.tagName).toBe('root');
    const item = root.children[0] as TNode;
    expect(item.tagName).toBe('item');
    expect(item.children).toEqual(['hello']);
  });

  it('parses XML split across multiple chunks', async () => {
    const stream = new XmlParseStream();
    const results = await collect(stream, ['<a>1</a><b>he', 'llo</b><c>3</c>']);
    const tags = results
      .filter((r): r is TNode => typeof r === 'object')
      .map((r) => r.tagName);
    expect(tags).toEqual(['a', 'b', 'c']);
    const b = results.find(
      (r) => typeof r === 'object' && r.tagName === 'b',
    ) as TNode;
    expect(b.children).toEqual(['hello']);
  });

  it('accepts a numeric offset', async () => {
    const prefix = 'JUNK';
    const stream = new XmlParseStream({ offset: prefix.length });
    const results = await collect(stream, [prefix + '<a>text</a>']);
    const a = results.find(
      (r) => typeof r === 'object' && r.tagName === 'a',
    ) as TNode;
    expect(a).toBeDefined();
    expect(a.children).toEqual(['text']);
  });

  it('accepts a string offset (uses its length)', async () => {
    const prefix = 'PREFIX';
    const stream = new XmlParseStream({ offset: prefix });
    const results = await collect(stream, [prefix + '<a>ok</a>']);
    const a = results.find(
      (r) => typeof r === 'object' && r.tagName === 'a',
    ) as TNode;
    expect(a).toBeDefined();
    expect(a.children).toEqual(['ok']);
  });

  it('skips comments by default', async () => {
    const stream = new XmlParseStream();
    const results = await collect(stream, ['<!-- comment --><a>val</a>']);
    const strings = results.filter(
      (r) => typeof r === 'string' && r.startsWith('<!--'),
    );
    expect(strings).toHaveLength(0);
    const a = results.find(
      (r) => typeof r === 'object' && r.tagName === 'a',
    ) as TNode;
    expect(a).toBeDefined();
    expect(a.children).toEqual(['val']);
  });

  it('emits comments when keepComments is true', async () => {
    const stream = new XmlParseStream({ keepComments: true });
    const results = await collect(stream, ['<!-- hello --><a>val</a>']);
    const comments = results.filter(
      (r) => typeof r === 'string' && r.startsWith('<!--'),
    );
    expect(comments).toHaveLength(1);
    expect(comments[0]).toBe('<!-- hello -->');
  });

  it('handles an incomplete element across chunks', async () => {
    const stream = new XmlParseStream();
    const results = await collect(stream, [
      '<item id="1">fir',
      'st</item><item id="2">second</item>',
    ]);
    const items = results.filter(
      (r): r is TNode => typeof r === 'object' && r.tagName === 'item',
    );
    expect(items).toHaveLength(2);
    expect(items[0]!.attributes!.id).toBe('1');
    expect(items[0]!.children).toEqual(['first']);
    expect(items[1]!.attributes!.id).toBe('2');
    expect(items[1]!.children).toEqual(['second']);
  });

  it('parses attributes correctly in streamed XML', async () => {
    const stream = new XmlParseStream();
    const results = await collect(stream, [
      '<item id="test" class="foo">content</item>',
    ]);
    const item = results.find(
      (r) => typeof r === 'object' && r.tagName === 'item',
    ) as TNode;
    expect(item).toBeDefined();
    expect(item.attributes!.id).toBe('test');
    expect(item.attributes!.class).toBe('foo');
    expect(item.children).toEqual(['content']);
  });

  it('handles self-closing tags', async () => {
    const stream = new XmlParseStream();
    const results = await collect(stream, ['<br/><hr/>']);
    const tags = results
      .filter((r): r is TNode => typeof r === 'object')
      .map((r) => r.tagName);
    expect(tags).toContain('br');
    expect(tags).toContain('hr');
  });

  it('handles empty input', async () => {
    const stream = new XmlParseStream();
    const results = await collect(stream, ['']);
    expect(results).toEqual([]);
  });

  it('handles comment split across chunks', async () => {
    const stream = new XmlParseStream({ keepComments: true });
    const results = await collect(stream, [
      '<!-- com',
      'ment --><item>ok</item>',
    ]);
    const comments = results.filter(
      (r) => typeof r === 'string' && r.startsWith('<!--'),
    );
    expect(comments).toHaveLength(1);
    expect(comments[0]).toBe('<!-- comment -->');
  });

  it('passes through parseOptions to the parser', async () => {
    const stream = new XmlParseStream({
      selfClosingTags: ['custom'],
    });
    const results = await collect(stream, ['<custom><a>text</a>']);
    const tags = results
      .filter((r): r is TNode => typeof r === 'object')
      .map((r) => r.tagName);
    expect(tags).toContain('custom');
    expect(tags).toContain('a');
    const custom = results.find(
      (r) => typeof r === 'object' && r.tagName === 'custom',
    ) as TNode;
    expect(custom.children).toEqual([]);
  });

  it('handles multiple comments interleaved with elements', async () => {
    const stream = new XmlParseStream({ keepComments: true });
    const results = await collect(stream, [
      '<!-- c1 --><a>1</a><!-- c2 --><b>2</b><c>3</c>',
    ]);
    const comments = results.filter(
      (r) => typeof r === 'string' && r.startsWith('<!--'),
    );
    expect(comments).toHaveLength(2);
    expect(comments[0]).toBe('<!-- c1 -->');
    expect(comments[1]).toBe('<!-- c2 -->');
    const tags = results
      .filter((r): r is TNode => typeof r === 'object')
      .map((r) => r.tagName);
    expect(tags).toEqual(['a', 'b', 'c']);
  });

  it('emits both nodes for two sibling elements', async () => {
    const stream = new XmlParseStream();
    const results = await collect(stream, ['<first/><second/>']);
    const tags = results
      .filter((r): r is TNode => typeof r === 'object')
      .map((r) => r.tagName);
    expect(tags).toEqual(['first', 'second']);
  });

  // --- DOCTYPE ---

  it('emits DOCTYPE as a TNode', async () => {
    const stream = new XmlParseStream();
    const results = await collect(stream, ['<!DOCTYPE html><html></html>']);
    expect(results).toHaveLength(2);
    const doctype = results[0] as TNode;
    expect(doctype.tagName).toBe('!DOCTYPE');
    expect(doctype.attributes).toEqual({ html: null });
    expect(doctype.children).toEqual([]);
    const html = results[1] as TNode;
    expect(html.tagName).toBe('html');
  });

  it('emits DOCTYPE with quoted identifiers', async () => {
    const stream = new XmlParseStream();
    const results = await collect(stream, [
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd"><html/>',
    ]);
    const doctype = results.find(
      (r): r is TNode => typeof r === 'object' && r.tagName === '!DOCTYPE',
    )!;
    expect(doctype).toBeDefined();
    expect(doctype.attributes).toEqual({
      html: null,
      PUBLIC: null,
      '-//W3C//DTD XHTML 1.0 Strict//EN': null,
      'http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd': null,
    });
  });

  it('emits DOCTYPE with internal subset discarded', async () => {
    const stream = new XmlParseStream();
    const results = await collect(stream, [
      '<!DOCTYPE root [<!ELEMENT root (#PCDATA)>]><root>text</root>',
    ]);
    const doctype = results.find(
      (r): r is TNode => typeof r === 'object' && r.tagName === '!DOCTYPE',
    )!;
    expect(doctype).toBeDefined();
    expect(doctype.attributes).toEqual({ root: null });
    const root = results.find(
      (r): r is TNode => typeof r === 'object' && r.tagName === 'root',
    )!;
    expect(root.children).toEqual(['text']);
  });

  it('emits DOCTYPE split across chunks', async () => {
    const stream = new XmlParseStream();
    const results = await collect(stream, [
      '<!DOCT',
      'YPE html>',
      '<html></html>',
    ]);
    const doctype = results.find(
      (r): r is TNode => typeof r === 'object' && r.tagName === '!DOCTYPE',
    )!;
    expect(doctype).toBeDefined();
    expect(doctype.attributes).toEqual({ html: null });
  });

  it('flushes a trailing comment when keepComments is true', async () => {
    const stream = new XmlParseStream({ keepComments: true });
    const results = await collect(stream, ['<a>1</a><!-- trailing -->']);
    const comments = results.filter(
      (r) => typeof r === 'string' && r.startsWith('<!--'),
    );
    expect(comments).toHaveLength(1);
    expect(comments[0]).toBe('<!-- trailing -->');
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
describe('XmlParseStream with large fixtures', () => {
  const rssFeed = fixture('rss-feed.xml');
  const soapEnvelope = fixture('soap-envelope.xml');
  const atomFeed = fixture('atom-feed.xml');
  const xhtmlPage = fixture('xhtml-page.xml');
  const pomXml = fixture('pom.xml');

  describe('rss-feed.xml', () => {
    it('streams entire document as a single chunk', async () => {
      const stream = new XmlParseStream();
      const results = await collect(stream, [rssFeed]);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      expect(nodes.length).toBeGreaterThanOrEqual(1);
      // Should emit the rss root (possibly preceded by a processing instruction)
      const rss = nodes.find((n) => n.tagName === 'rss');
      expect(rss).toBeDefined();
      expect(rss!.attributes!.version).toBe('2.0');
    });

    it('streams in small chunks (64 bytes) and still produces valid nodes', async () => {
      const stream = new XmlParseStream();
      const chunks = chunkString(rssFeed, 64);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const rss = nodes.find((n) => n.tagName === 'rss');
      expect(rss).toBeDefined();
    });

    it('streams in medium chunks (256 bytes)', async () => {
      const stream = new XmlParseStream();
      const chunks = chunkString(rssFeed, 256);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      expect(nodes.length).toBeGreaterThanOrEqual(1);
    });

    it('produces consistent results across different chunk sizes', async () => {
      const tagSets: string[][] = [];
      for (const size of [32, 128, 512, rssFeed.length]) {
        const stream = new XmlParseStream();
        const chunks = chunkString(rssFeed, size);
        const results = await collect(stream, chunks);
        const tags = results
          .filter((r): r is TNode => typeof r === 'object')
          .map((r) => r.tagName);
        tagSets.push(tags);
      }
      // All chunk sizes should produce the same set of top-level tags
      for (let i = 1; i < tagSets.length; i++) {
        expect(tagSets[i]).toEqual(tagSets[0]);
      }
    });
  });

  describe('soap-envelope.xml', () => {
    it('streams entire document as a single chunk', async () => {
      const stream = new XmlParseStream();
      const results = await collect(stream, [soapEnvelope]);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const envelope = nodes.find((n) => n.tagName === 'soap:Envelope');
      expect(envelope).toBeDefined();
      expect(envelope!.attributes!['xmlns:soap']).toBe(
        'http://schemas.xmlsoap.org/soap/envelope/',
      );
    });

    it('streams in small chunks (48 bytes)', async () => {
      const stream = new XmlParseStream();
      const chunks = chunkString(soapEnvelope, 48);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const envelope = nodes.find((n) => n.tagName === 'soap:Envelope');
      expect(envelope).toBeDefined();
    });

    it('preserves deeply nested structure when streamed', async () => {
      const stream = new XmlParseStream();
      const chunks = chunkString(soapEnvelope, 100);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const envelope = nodes.find((n) => n.tagName === 'soap:Envelope');
      expect(envelope).toBeDefined();

      // Drill into Header > Security > Timestamp
      const header = envelope!.children.find(
        (c) => typeof c === 'object' && c.tagName === 'soap:Header',
      ) as TNode;
      expect(header).toBeDefined();
      const security = header.children.find(
        (c) => typeof c === 'object' && c.tagName === 'wsse:Security',
      ) as TNode;
      expect(security).toBeDefined();
      const timestamp = security.children.find(
        (c) => typeof c === 'object' && c.tagName === 'wsu:Timestamp',
      ) as TNode;
      expect(timestamp).toBeDefined();
      expect(timestamp.attributes!['wsu:Id']).toBe('TS-1');
    });

    it('produces consistent results across different chunk sizes', async () => {
      const tagSets: string[][] = [];
      for (const size of [50, 200, soapEnvelope.length]) {
        const stream = new XmlParseStream();
        const chunks = chunkString(soapEnvelope, size);
        const results = await collect(stream, chunks);
        const tags = results
          .filter((r): r is TNode => typeof r === 'object')
          .map((r) => r.tagName);
        tagSets.push(tags);
      }
      for (let i = 1; i < tagSets.length; i++) {
        expect(tagSets[i]).toEqual(tagSets[0]);
      }
    });
  });

  describe('atom-feed.xml', () => {
    it('streams entire document as a single chunk', async () => {
      const stream = new XmlParseStream();
      const results = await collect(stream, [atomFeed]);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const feed = nodes.find((n) => n.tagName === 'feed');
      expect(feed).toBeDefined();
      expect(feed!.attributes!.xmlns).toBe('http://www.w3.org/2005/Atom');
    });

    it('streams in small chunks (80 bytes)', async () => {
      const stream = new XmlParseStream();
      const chunks = chunkString(atomFeed, 80);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const feed = nodes.find((n) => n.tagName === 'feed');
      expect(feed).toBeDefined();
    });

    it('produces consistent results across different chunk sizes', async () => {
      const tagSets: string[][] = [];
      for (const size of [64, 256, 1024, atomFeed.length]) {
        const stream = new XmlParseStream();
        const chunks = chunkString(atomFeed, size);
        const results = await collect(stream, chunks);
        const tags = results
          .filter((r): r is TNode => typeof r === 'object')
          .map((r) => r.tagName);
        tagSets.push(tags);
      }
      for (let i = 1; i < tagSets.length; i++) {
        expect(tagSets[i]).toEqual(tagSets[0]);
      }
    });
  });

  describe('xhtml-page.xml', () => {
    it('streams entire document as a single chunk', async () => {
      const stream = new XmlParseStream();
      const results = await collect(stream, [xhtmlPage]);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const html = nodes.find((n) => n.tagName === 'html');
      expect(html).toBeDefined();
    });

    it('streams in small chunks (100 bytes)', async () => {
      const stream = new XmlParseStream();
      const chunks = chunkString(xhtmlPage, 100);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const html = nodes.find((n) => n.tagName === 'html');
      expect(html).toBeDefined();
    });

    it('streams with keepComments enabled', async () => {
      const stream = new XmlParseStream({ keepComments: true });
      const results = await collect(stream, chunkString(xhtmlPage, 150));
      const comments = results.filter(
        (r) => typeof r === 'string' && r.startsWith('<!--'),
      );
      // There should be no top-level comments (they are all inside <html>)
      // but the nodes inside should still have comments preserved
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const html = nodes.find((n) => n.tagName === 'html');
      expect(html).toBeDefined();
    });

    it('produces consistent results across different chunk sizes', async () => {
      const tagSets: string[][] = [];
      for (const size of [75, 300, 1000, xhtmlPage.length]) {
        const stream = new XmlParseStream();
        const chunks = chunkString(xhtmlPage, size);
        const results = await collect(stream, chunks);
        const tags = results
          .filter((r): r is TNode => typeof r === 'object')
          .map((r) => r.tagName);
        tagSets.push(tags);
      }
      for (let i = 1; i < tagSets.length; i++) {
        expect(tagSets[i]).toEqual(tagSets[0]);
      }
    });
  });

  describe('pom.xml', () => {
    it('streams entire document as a single chunk', async () => {
      const stream = new XmlParseStream();
      const results = await collect(stream, [pomXml]);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const project = nodes.find((n) => n.tagName === 'project');
      expect(project).toBeDefined();
    });

    it('streams in small chunks (64 bytes)', async () => {
      const stream = new XmlParseStream();
      const chunks = chunkString(pomXml, 64);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const project = nodes.find((n) => n.tagName === 'project');
      expect(project).toBeDefined();
    });

    it('preserves deeply nested build plugin configuration when streamed', async () => {
      const stream = new XmlParseStream();
      const chunks = chunkString(pomXml, 128);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const project = nodes.find((n) => n.tagName === 'project');
      expect(project).toBeDefined();

      // Verify we can drill into build > plugins > plugin
      const build = project!.children.find(
        (c) => typeof c === 'object' && c.tagName === 'build',
      );
      expect(build).toBeDefined();
      assert(isElementNode(build!));
      const plugins = build!.children.find(
        (c) => typeof c === 'object' && c.tagName === 'plugins',
      );
      expect(plugins).toBeDefined();
      assert(isElementNode(plugins!));
      const pluginElements = plugins!.children.filter(
        (c) => typeof c === 'object' && c.tagName === 'plugin',
      );
      expect(pluginElements.length).toBeGreaterThanOrEqual(3);
    });

    it('produces consistent results across different chunk sizes', async () => {
      const tagSets: string[][] = [];
      for (const size of [50, 200, 500, pomXml.length]) {
        const stream = new XmlParseStream();
        const chunks = chunkString(pomXml, size);
        const results = await collect(stream, chunks);
        const tags = results
          .filter((r): r is TNode => typeof r === 'object')
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
  describe('xmltv-epg.xml — real-world EPG streaming', () => {
    const xmltvFeed = fixture('xmltv-epg.xml');

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
      const stream = new XmlParseStream();
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      const channels = new Map<string, string>(); // id -> display name
      const epg: EPG = {};

      // Consumer: read nodes as they arrive and build the EPG
      const consumer = (async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (typeof value === 'string') continue;

          const node = value as TNode;

          if (node.tagName === 'tv') {
            // The root <tv> element — process its children for channels/programmes
            for (const child of node.children) {
              if (typeof child === 'string') continue;
              processNode(child);
            }
          } else {
            processNode(node);
          }
        }
      })();

      function processNode(node: TNode) {
        if (node.tagName === 'channel') {
          const id = node.attributes!.id as string;
          const displayName = node.children.find(
            (c) => typeof c !== 'string' && c.tagName === 'display-name',
          ) as TNode | undefined;
          if (displayName) {
            channels.set(id, displayName.children[0] as string);
          }
          if (!epg[id]) epg[id] = [];
        }

        if (node.tagName === 'programme') {
          const channelId = node.attributes!.channel as string;
          const start = node.attributes!.start as string;
          const end = node.attributes!.stop as string;

          const titleNode = node.children.find(
            (c) => typeof c !== 'string' && c.tagName === 'title',
          ) as TNode | undefined;
          const descNode = node.children.find(
            (c) => typeof c !== 'string' && c.tagName === 'desc',
          ) as TNode | undefined;

          if (!epg[channelId]) epg[channelId] = [];
          epg[channelId].push({
            start,
            end,
            title: titleNode ? (titleNode.children[0] as string) : '',
            description: descNode ? (descNode.children[0] as string) : '',
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

    it('builds a complete EPG from a single chunk', async () => {
      const { channels, epg } = await buildEPGFromStream([xmltvFeed]);

      // 8 channels
      expect(channels.size).toBe(8);
      expect(channels.get('bbc1.uk')).toBe('BBC One');
      expect(channels.get('itv1.uk')).toBe('ITV');
      expect(channels.get('film4.uk')).toBe('Film4');

      // Correct number of programmes per channel
      expect(epg['bbc1.uk']).toHaveLength(5);
      expect(epg['bbc2.uk']).toHaveLength(4);
      expect(epg['itv1.uk']).toHaveLength(4);
      expect(epg['ch4.uk']).toHaveLength(3);
      expect(epg['five.uk']).toHaveLength(3);
      expect(epg['sky-news.uk']).toHaveLength(3);
      expect(epg['dave.uk']).toHaveLength(4);
      expect(epg['film4.uk']).toHaveLength(2);

      // Total programmes
      const total = Object.values(epg).reduce((sum, p) => sum + p.length, 0);
      expect(total).toBe(28);
    });

    it('builds a complete EPG from small chunks (128 bytes) simulating slow network', async () => {
      const chunks = chunkString(xmltvFeed, 128);
      expect(chunks.length).toBeGreaterThan(10); // many chunks

      const { channels, epg } = await buildEPGFromStream(chunks);

      expect(channels.size).toBe(8);
      const total = Object.values(epg).reduce((sum, p) => sum + p.length, 0);
      expect(total).toBe(28);
    });

    it('preserves programme details when streamed in 256-byte chunks', async () => {
      const chunks = chunkString(xmltvFeed, 256);
      const { epg } = await buildEPGFromStream(chunks);

      // Verify specific programme details
      const bbcNews = epg['bbc1.uk']![0]!;
      expect(bbcNews.title).toBe('BBC News at Six');
      expect(bbcNews.start).toBe('20260403180000 +0100');
      expect(bbcNews.end).toBe('20260403183000 +0100');
      expect(bbcNews.description).toContain('national and international news');

      // Film4's Blade Runner 2049
      const bladeRunner = epg['film4.uk']![0]!;
      expect(bladeRunner.title).toBe('Blade Runner 2049');
      expect(bladeRunner.start).toBe('20260403183000 +0100');
      expect(bladeRunner.end).toBe('20260403205500 +0100');
      expect(bladeRunner.description).toContain('Denis Villeneuve');

      // ITV's Vera (last programme in slot)
      const vera = epg['itv1.uk']!.find((p) => p.title === 'Vera')!;
      expect(vera).toBeDefined();
      expect(vera.start).toBe('20260403200000 +0100');
      expect(vera.end).toBe('20260403220000 +0100');
      expect(vera.description).toContain('Northumberland');
    });

    it('produces identical EPG across different chunk sizes', async () => {
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

    it('handles chunks that split mid-attribute and mid-entity', async () => {
      // Use a prime chunk size to maximize splits at awkward boundaries
      const chunks = chunkString(xmltvFeed, 97);
      const { channels, epg } = await buildEPGFromStream(chunks);

      expect(channels.size).toBe(8);

      // Programmes with apostrophes and special characters
      const oneShow = epg['bbc1.uk']!.find((p) => p.title === 'The One Show');
      expect(oneShow).toBeDefined();

      // Sky News documentary with long description
      const climateFiles = epg['sky-news.uk']!.find((p) =>
        p.title.includes('Climate Files'),
      );
      expect(climateFiles).toBeDefined();
      expect(climateFiles!.description).toContain('leaked documents');
    });

    it('builds EPG progressively — early channels appear before later programmes', async () => {
      // This test verifies the streaming nature: we can start processing
      // channels before all programmes have arrived
      const stream = new XmlParseStream();
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      const arrivedChannels: string[] = [];
      const arrivedProgrammes: string[] = [];

      const consumer = (async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (typeof value === 'string') continue;

          const node = value as TNode;
          // The root <tv> wraps everything, so drill into its children
          if (node.tagName === 'tv') {
            for (const child of node.children) {
              if (typeof child === 'string') continue;
              if (child.tagName === 'channel') {
                arrivedChannels.push(child.attributes!.id as string);
              }
              if (child.tagName === 'programme') {
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
      expect(arrivedChannels[0]).toBe('bbc1.uk');
      expect(arrivedChannels[7]).toBe('film4.uk');

      // All 28 programmes should have been seen
      expect(arrivedProgrammes).toHaveLength(28);
    });
  });

  describe('html-page.html', () => {
    const htmlPage = fixture('html-page.html');

    it('streams entire document as a single chunk with html mode', async () => {
      const stream = new XmlParseStream({ html: true });
      const results = await collect(stream, [htmlPage]);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const html = nodes.find((n) => n.tagName === 'html');
      expect(html).toBeDefined();
      expect(html!.attributes!.lang).toBe('en');
    });

    it('streams in small chunks (100 bytes) with html mode', async () => {
      const stream = new XmlParseStream({ html: true });
      const chunks = chunkString(htmlPage, 100);
      const results = await collect(stream, chunks);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const html = nodes.find((n) => n.tagName === 'html');
      expect(html).toBeDefined();
    });

    it('preserves script content when streamed with html mode', async () => {
      const stream = new XmlParseStream({ html: true });
      const results = await collect(stream, [htmlPage]);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const html = nodes.find((n) => n.tagName === 'html')!;
      // Find scripts deeply
      const scripts: TNode[] = [];
      function findScripts(children: (TNode | string)[]) {
        for (const c of children) {
          if (typeof c === 'object') {
            if (c.tagName === 'script') scripts.push(c);
            findScripts(c.children);
          }
        }
      }
      findScripts(html.children);
      expect(scripts.length).toBe(3);

      // JSON-LD should be valid JSON
      const jsonLd = scripts.find(
        (s) => s.attributes!.type === 'application/ld+json',
      );
      expect(jsonLd).toBeDefined();
      const jsonContent = (jsonLd!.children[0] as string).trim();
      expect(() => JSON.parse(jsonContent)).not.toThrow();

      // Inline JS should contain angle brackets
      const inlineJs = scripts.find((s) => !s.attributes?.type);
      expect(inlineJs).toBeDefined();
      const jsContent = inlineJs!.children[0] as string;
      expect(jsContent).toContain("createElement('script')");
      expect(jsContent).toContain('v > 1000 && v < 10000');
    });

    it('preserves style content when streamed with html mode', async () => {
      const stream = new XmlParseStream({ html: true });
      const results = await collect(stream, [htmlPage]);
      const nodes = results.filter((r): r is TNode => typeof r === 'object');
      const html = nodes.find((n) => n.tagName === 'html')!;
      // Find style deeply
      const styles: TNode[] = [];
      function findStyles(children: (TNode | string)[]) {
        for (const c of children) {
          if (typeof c === 'object') {
            if (c.tagName === 'style') styles.push(c);
            findStyles(c.children);
          }
        }
      }
      findStyles(html.children);
      expect(styles.length).toBe(1);
      const css = styles[0]!.children[0] as string;
      expect(css).toContain('.layout > .sidebar');
      expect(css).toContain('/* <tag>');
    });

    it('produces consistent results across different chunk sizes', async () => {
      const tagSets: string[][] = [];
      for (const size of [80, 256, 1024, htmlPage.length]) {
        const stream = new XmlParseStream({ html: true });
        const chunks = chunkString(htmlPage, size);
        const results = await collect(stream, chunks);
        const tags = results
          .filter((r): r is TNode => typeof r === 'object')
          .map((r) => r.tagName);
        tagSets.push(tags);
      }
      for (let i = 1; i < tagSets.length; i++) {
        expect(tagSets[i]).toEqual(tagSets[0]);
      }
    });
  });
});

// =================================================================
// select option tests
// =================================================================
describe('XmlParseStream with select', () => {
  it('emits only matching elements from a wrapped root', async () => {
    const stream = new XmlParseStream({ select: 'item' });
    const results = await collect(stream, [
      '<root><item>1</item><item>2</item><item>3</item></root>',
    ]);
    expect(results).toHaveLength(3);
    const tags = results
      .filter((r): r is TNode => typeof r === 'object')
      .map((r) => r.tagName);
    expect(tags).toEqual(['item', 'item', 'item']);
    expect((results[0] as TNode).children).toEqual(['1']);
    expect((results[1] as TNode).children).toEqual(['2']);
    expect((results[2] as TNode).children).toEqual(['3']);
  });

  it('does not emit the root element', async () => {
    const stream = new XmlParseStream({ select: 'item' });
    const results = await collect(stream, ['<root><item>a</item></root>']);
    const tags = results
      .filter((r): r is TNode => typeof r === 'object')
      .map((r) => r.tagName);
    expect(tags).toEqual(['item']);
    // root should NOT appear
    expect(tags).not.toContain('root');
  });

  it('emits nothing when no elements match the selector', async () => {
    const stream = new XmlParseStream({ select: 'missing' });
    const results = await collect(stream, [
      '<root><item>1</item><entry>2</entry></root>',
    ]);
    expect(results).toHaveLength(0);
  });

  it('preserves subtree structure inside matched elements', async () => {
    const stream = new XmlParseStream({ select: 'item' });
    const results = await collect(stream, [
      '<root><item><name>Widget</name><price currency="USD">9.99</price></item></root>',
    ]);
    expect(results).toHaveLength(1);
    const item = results[0] as TNode;
    expect(item.tagName).toBe('item');
    expect(item.children).toHaveLength(2);
    const name = item.children[0] as TNode;
    expect(name.tagName).toBe('name');
    expect(name.children).toEqual(['Widget']);
    const price = item.children[1] as TNode;
    expect(price.tagName).toBe('price');
    expect(price.attributes!.currency).toBe('USD');
    expect(price.children).toEqual(['9.99']);
  });

  it('preserves attributes on matched elements', async () => {
    const stream = new XmlParseStream({ select: 'item' });
    const results = await collect(stream, [
      '<root><item id="1" class="active">text</item></root>',
    ]);
    const item = results[0] as TNode;
    expect(item.attributes!.id).toBe('1');
    expect(item.attributes!.class).toBe('active');
  });

  it('accepts an array of tag names to select', async () => {
    const stream = new XmlParseStream({ select: ['item', 'entry'] });
    const results = await collect(stream, [
      '<root><item>1</item><other>skip</other><entry>2</entry></root>',
    ]);
    expect(results).toHaveLength(2);
    const tags = results
      .filter((r): r is TNode => typeof r === 'object')
      .map((r) => r.tagName);
    expect(tags).toEqual(['item', 'entry']);
  });

  it('emits nested selected elements as part of the outermost match', async () => {
    // Nested <item> inside an <item> — the outer one is the selected match;
    // the inner one is just a child in its subtree.
    const stream = new XmlParseStream({ select: 'item' });
    const results = await collect(stream, [
      '<root><item><item>inner</item></item></root>',
    ]);
    expect(results).toHaveLength(1);
    const outer = results[0] as TNode;
    expect(outer.tagName).toBe('item');
    const inner = outer.children[0] as TNode;
    expect(inner.tagName).toBe('item');
    expect(inner.children).toEqual(['inner']);
  });

  it('handles deeply nested selected elements', async () => {
    const stream = new XmlParseStream({ select: 'item' });
    const results = await collect(stream, [
      '<a><b><c><item>deep</item></c></b></a>',
    ]);
    expect(results).toHaveLength(1);
    const item = results[0] as TNode;
    expect(item.tagName).toBe('item');
    expect(item.children).toEqual(['deep']);
  });

  it('handles multiple selected elements at different depths', async () => {
    const stream = new XmlParseStream({ select: 'item' });
    const results = await collect(stream, [
      '<root><item>1</item><wrapper><item>2</item></wrapper><item>3</item></root>',
    ]);
    expect(results).toHaveLength(3);
    expect((results[0] as TNode).children).toEqual(['1']);
    expect((results[1] as TNode).children).toEqual(['2']);
    expect((results[2] as TNode).children).toEqual(['3']);
  });

  it('discards text outside selected elements', async () => {
    const stream = new XmlParseStream({ select: 'item' });
    const results = await collect(stream, [
      '<root>before<item>inside</item>after</root>',
    ]);
    expect(results).toHaveLength(1);
    const item = results[0] as TNode;
    expect(item.children).toEqual(['inside']);
  });

  it('discards comments outside selected elements', async () => {
    const stream = new XmlParseStream({
      select: 'item',
      keepComments: true,
    });
    const results = await collect(stream, [
      '<!-- top -->  <root><!-- mid --><item><!-- inner -->val</item></root>',
    ]);
    // Only the <item> is emitted, and the comment inside it is preserved
    expect(results).toHaveLength(1);
    const item = results[0] as TNode;
    expect(item.children).toContain('<!-- inner -->');
    expect(item.children).toContain('val');
  });

  it('handles chunks that split across selected element boundaries', async () => {
    const stream = new XmlParseStream({ select: 'item' });
    const results = await collect(stream, [
      '<root><ite',
      'm>hel',
      'lo</it',
      'em><item>world</item></root>',
    ]);
    expect(results).toHaveLength(2);
    expect((results[0] as TNode).children).toEqual(['hello']);
    expect((results[1] as TNode).children).toEqual(['world']);
  });

  it('handles self-closing selected elements', async () => {
    const stream = new XmlParseStream({
      select: 'br',
      selfClosingTags: ['br'],
    });
    const results = await collect(stream, [
      '<root><br/><p>text</p><br/></root>',
    ]);
    expect(results).toHaveLength(2);
    expect((results[0] as TNode).tagName).toBe('br');
    expect((results[1] as TNode).tagName).toBe('br');
  });

  it('handles HTML void elements with select', async () => {
    const stream = new XmlParseStream({
      select: 'img',
      html: true,
    });
    const results = await collect(stream, [
      '<div><img src="a.png"><p>text</p><img src="b.png"></div>',
    ]);
    expect(results).toHaveLength(2);
    expect((results[0] as TNode).attributes!.src).toBe('a.png');
    expect((results[1] as TNode).attributes!.src).toBe('b.png');
  });

  it('works with CDATA inside selected elements', async () => {
    const stream = new XmlParseStream({ select: 'data' });
    const results = await collect(stream, [
      '<root><data><![CDATA[<raw>&content</raw>]]></data></root>',
    ]);
    expect(results).toHaveLength(1);
    const data = results[0] as TNode;
    expect(data.children).toEqual(['<raw>&content</raw>']);
  });

  it('falls back to default behavior when select is undefined', async () => {
    // This verifies we didn't break the default path
    const stream = new XmlParseStream();
    const results = await collect(stream, [
      '<root><item>1</item></root><other>2</other>',
    ]);
    expect(results).toHaveLength(2);
    expect((results[0] as TNode).tagName).toBe('root');
    expect((results[1] as TNode).tagName).toBe('other');
  });

  it('falls back to default behavior when select is empty array', async () => {
    const stream = new XmlParseStream({ select: [] });
    const results = await collect(stream, ['<root><item>1</item></root>']);
    expect(results).toHaveLength(1);
    expect((results[0] as TNode).tagName).toBe('root');
  });

  it('emits selected elements from RSS feed (channel/item)', async () => {
    const rssFeed = fixture('rss-feed.xml');
    const stream = new XmlParseStream({ select: 'item' });
    const results = await collect(stream, [rssFeed]);
    const items = results.filter(
      (r): r is TNode => typeof r === 'object' && r.tagName === 'item',
    );
    expect(items.length).toBeGreaterThanOrEqual(1);
    // Each item should have title, link, description children
    for (const item of items) {
      const childTags = item.children
        .filter((c): c is TNode => typeof c === 'object')
        .map((c) => c.tagName);
      expect(childTags).toContain('title');
    }
  });

  it('produces consistent results across chunk sizes with select', async () => {
    const rssFeed = fixture('rss-feed.xml');
    const tagSets: string[][] = [];
    for (const size of [64, 128, 256, rssFeed.length]) {
      const stream = new XmlParseStream({ select: 'item' });
      const chunks = chunkString(rssFeed, size);
      const results = await collect(stream, chunks);
      const titles = results
        .filter((r): r is TNode => typeof r === 'object')
        .map((r) => {
          const title = r.children.find(
            (c): c is TNode => typeof c === 'object' && c.tagName === 'title',
          );
          return title ? (title.children[0] as string) : '';
        });
      tagSets.push(titles);
    }
    for (let i = 1; i < tagSets.length; i++) {
      expect(tagSets[i]).toEqual(tagSets[0]);
    }
  });

  it('selects XMLTV programme elements for incremental EPG building', async () => {
    const xmltvFeed = fixture('xmltv-epg.xml');
    // Select both channel and programme elements for incremental processing
    const stream = new XmlParseStream({
      select: ['channel', 'programme'],
    });
    const chunks = chunkString(xmltvFeed, 128);
    const results = await collect(stream, chunks);

    const channels = results.filter(
      (r): r is TNode => typeof r === 'object' && r.tagName === 'channel',
    );
    const programmes = results.filter(
      (r): r is TNode => typeof r === 'object' && r.tagName === 'programme',
    );

    expect(channels).toHaveLength(8);
    expect(programmes).toHaveLength(28);

    // Verify channel structure
    expect(channels[0]!.attributes!.id).toBe('bbc1.uk');
    const displayName = channels[0]!.children.find(
      (c): c is TNode => typeof c === 'object' && c.tagName === 'display-name',
    );
    expect(displayName).toBeDefined();
    expect(displayName!.children[0]).toBe('BBC One');

    // Verify programme structure
    const firstProgramme = programmes[0]!;
    expect(firstProgramme.attributes!.channel).toBe('bbc1.uk');
    const title = firstProgramme.children.find(
      (c): c is TNode => typeof c === 'object' && c.tagName === 'title',
    );
    expect(title).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// output option
// ---------------------------------------------------------------------------

describe('XmlParseStream with output option', () => {
  /** Generic collect that works for any output type. */
  async function collectAny<T>(
    stream: TransformStream<string, T>,
    chunks: string[],
  ): Promise<T[]> {
    const results: T[] = [];
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

  describe('output: "lossy"', () => {
    it('converts a simple element to lossy format', async () => {
      const stream = new XmlParseStream({ output: 'lossy' });
      const results = await collectAny(stream, ['<name>Alice</name>']);
      expect(results).toEqual([{ name: 'Alice' }]);
    });

    it('converts multiple top-level elements', async () => {
      const stream = new XmlParseStream({ output: 'lossy' });
      const results = await collectAny(stream, ['<a>1</a><b>2</b><c>3</c>']);
      expect(results).toEqual([{ a: '1' }, { b: '2' }, { c: '3' }]);
    });

    it('converts nested elements with attributes', async () => {
      const stream = new XmlParseStream({ output: 'lossy' });
      const results = await collectAny(stream, [
        '<root><item id="1">text</item></root>',
      ]);
      // root has one child: item with attr and text → mixed content
      expect(results).toEqual([{ root: { item: { $id: '1', $$: ['text'] } } }]);
    });

    it('converts an empty element to null', async () => {
      const stream = new XmlParseStream({ output: 'lossy' });
      const results = await collectAny(stream, ['<empty/>']);
      expect(results).toEqual([{ empty: null }]);
    });

    it('works with select option', async () => {
      const stream = new XmlParseStream({
        output: 'lossy',
        select: 'item',
      });
      const results = await collectAny(stream, [
        '<root><item>A</item><item>B</item></root>',
      ]);
      expect(results).toEqual([{ item: 'A' }, { item: 'B' }]);
    });

    it('works with chunked input', async () => {
      const stream = new XmlParseStream({ output: 'lossy' });
      const results = await collectAny(stream, [
        '<roo',
        't><child>',
        'hello</child>',
        '</root>',
      ]);
      expect(results).toEqual([{ root: { child: 'hello' } }]);
    });
  });

  describe('output: "lossless"', () => {
    it('converts a simple element to lossless format', async () => {
      const stream = new XmlParseStream({ output: 'lossless' });
      const results = await collectAny(stream, ['<name>Alice</name>']);
      expect(results).toEqual([{ name: [{ $text: 'Alice' }] }]);
    });

    it('converts multiple top-level elements', async () => {
      const stream = new XmlParseStream({ output: 'lossless' });
      const results = await collectAny(stream, ['<a>1</a><b>2</b><c>3</c>']);
      expect(results).toEqual([
        { a: [{ $text: '1' }] },
        { b: [{ $text: '2' }] },
        { c: [{ $text: '3' }] },
      ]);
    });

    it('converts nested elements with attributes', async () => {
      const stream = new XmlParseStream({ output: 'lossless' });
      const results = await collectAny(stream, [
        '<root><item id="1">text</item></root>',
      ]);
      expect(results).toEqual([
        {
          root: [
            {
              item: [{ $attr: { id: '1' } }, { $text: 'text' }],
            },
          ],
        },
      ]);
    });

    it('converts an empty element to an entry with empty children', async () => {
      const stream = new XmlParseStream({ output: 'lossless' });
      const results = await collectAny(stream, ['<empty/>']);
      expect(results).toEqual([{ empty: [] }]);
    });

    it('works with select option', async () => {
      const stream = new XmlParseStream({
        output: 'lossless',
        select: 'item',
      });
      const results = await collectAny(stream, [
        '<root><item>A</item><item>B</item></root>',
      ]);
      expect(results).toEqual([
        { item: [{ $text: 'A' }] },
        { item: [{ $text: 'B' }] },
      ]);
    });

    it('works with chunked input', async () => {
      const stream = new XmlParseStream({ output: 'lossless' });
      const results = await collectAny(stream, [
        '<roo',
        't><child>',
        'hello</child>',
        '</root>',
      ]);
      expect(results).toEqual([{ root: [{ child: [{ $text: 'hello' }] }] }]);
    });
  });

  describe('output: "dom" (explicit)', () => {
    it('emits TNode | string just like the default', async () => {
      const stream = new XmlParseStream({ output: 'dom' });
      const results = await collectAny(stream, ['<a>1</a>']);
      expect(results).toHaveLength(1);
      const node = results[0] as TNode;
      expect(node.tagName).toBe('a');
      expect(node.children).toEqual(['1']);
    });
  });
});
