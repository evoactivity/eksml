import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { fastStream } from '#src/fastStream.ts';
import type { Attributes } from '#src/fastStream.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8');

/** Helper: split a string into chunks of a given size. */
function chunkString(str: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

/** Collected events from a parse run. */
interface Events {
  opens: { name: string; attrs: Attributes }[];
  closes: string[];
  texts: string[];
  cdatas: string[];
  comments: string[];
  pis: { name: string; body: string }[];
  doctypes: { tagName: string; attrs: Attributes }[];
}

/** Feed chunks through fastStream and collect all events. */
function collectEvents(
  chunks: string[],
  options: {
    selfClosingTags?: string[];
    rawContentTags?: string[];
  } = {},
): Events {
  const events: Events = {
    opens: [],
    closes: [],
    texts: [],
    cdatas: [],
    comments: [],
    pis: [],
    doctypes: [],
  };

  const parser = fastStream({
    ...options,
    onopentag(name, attrs) {
      events.opens.push({ name, attrs });
    },
    onclosetag(name) {
      events.closes.push(name);
    },
    ontext(text) {
      events.texts.push(text);
    },
    oncdata(data) {
      events.cdatas.push(data);
    },
    oncomment(comment) {
      events.comments.push(comment);
    },
    onprocessinginstruction(name, body) {
      events.pis.push({ name, body });
    },
    ondoctype(tagName, attrs) {
      events.doctypes.push({ tagName, attrs });
    },
  });

  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.close();

  return events;
}

/** Shorthand: parse a single string and collect events. */
function parseEvents(
  xml: string,
  options?: { selfClosingTags?: string[]; rawContentTags?: string[] },
): Events {
  return collectEvents([xml], options);
}

// =========================================================================
// Basic parsing
// =========================================================================
describe('fastStream', () => {
  describe('basic parsing', () => {
    it('parses a simple element with text', () => {
      const e = parseEvents('<a>hello</a>');
      expect(e.opens).toEqual([{ name: 'a', attrs: {} }]);
      expect(e.closes).toEqual(['a']);
      expect(e.texts).toEqual(['hello']);
    });

    it('parses nested elements', () => {
      const e = parseEvents('<a><b>inner</b></a>');
      expect(e.opens.map((o) => o.name)).toEqual(['a', 'b']);
      expect(e.closes).toEqual(['b', 'a']);
      expect(e.texts).toEqual(['inner']);
    });

    it('parses sibling elements', () => {
      const e = parseEvents('<a>1</a><b>2</b><c>3</c>');
      expect(e.opens.map((o) => o.name)).toEqual(['a', 'b', 'c']);
      expect(e.closes).toEqual(['a', 'b', 'c']);
      expect(e.texts).toEqual(['1', '2', '3']);
    });

    it('parses attributes with double quotes', () => {
      const e = parseEvents('<div id="test" class="foo">x</div>');
      expect(e.opens[0]!.attrs).toEqual({ id: 'test', class: 'foo' });
    });

    it('parses attributes with single quotes', () => {
      const e = parseEvents("<div id='test'>x</div>");
      expect(e.opens[0]!.attrs).toEqual({ id: 'test' });
    });

    it('parses boolean attributes (no value)', () => {
      const e = parseEvents('<input disabled readonly/>');
      expect(e.opens[0]!.attrs).toEqual({ disabled: null, readonly: null });
    });

    it('parses self-closing tags (/>)', () => {
      const e = parseEvents('<br/><hr/>');
      expect(e.opens.map((o) => o.name)).toEqual(['br', 'hr']);
      expect(e.closes).toEqual(['br', 'hr']);
    });

    it('parses self-closing tags with attributes', () => {
      const e = parseEvents('<img src="a.png" alt="pic"/>');
      expect(e.opens[0]!.attrs).toEqual({ src: 'a.png', alt: 'pic' });
      expect(e.closes).toEqual(['img']);
    });

    it('handles empty elements', () => {
      const e = parseEvents('<a></a>');
      expect(e.opens.map((o) => o.name)).toEqual(['a']);
      expect(e.closes).toEqual(['a']);
      expect(e.texts).toEqual([]);
    });

    it('skips whitespace-only text nodes', () => {
      const e = parseEvents('<a>  \n\t  </a>');
      expect(e.texts).toEqual([]);
    });

    it('trims text content', () => {
      const e = parseEvents('<a>  hello  </a>');
      expect(e.texts).toEqual(['hello']);
    });

    it('handles empty input', () => {
      const e = parseEvents('');
      expect(e.opens).toEqual([]);
      expect(e.closes).toEqual([]);
      expect(e.texts).toEqual([]);
    });

    it('parses deeply nested structure', () => {
      const e = parseEvents('<a><b><c><d>deep</d></c></b></a>');
      expect(e.opens.map((o) => o.name)).toEqual(['a', 'b', 'c', 'd']);
      expect(e.closes).toEqual(['d', 'c', 'b', 'a']);
      expect(e.texts).toEqual(['deep']);
    });

    it('handles multiple text nodes interleaved with elements', () => {
      const e = parseEvents('<p>before<b>bold</b>after</p>');
      expect(e.texts).toEqual(['before', 'bold', 'after']);
    });

    it('parses namespaced tags and attributes', () => {
      const e = parseEvents(
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body/></soap:Envelope>',
      );
      expect(e.opens[0]!.name).toBe('soap:Envelope');
      expect(e.opens[0]!.attrs['xmlns:soap']).toBe(
        'http://schemas.xmlsoap.org/soap/envelope/',
      );
      expect(e.opens[1]!.name).toBe('soap:Body');
    });
  });

  // =========================================================================
  // Comments
  // =========================================================================
  describe('comments', () => {
    it('emits comment events', () => {
      const e = parseEvents('<!-- hello --><a/>');
      expect(e.comments).toEqual(['<!-- hello -->']);
      expect(e.opens.map((o) => o.name)).toEqual(['a']);
    });

    it('handles comments between elements', () => {
      const e = parseEvents('<a/><!-- middle --><b/>');
      expect(e.comments).toEqual(['<!-- middle -->']);
      expect(e.opens.map((o) => o.name)).toEqual(['a', 'b']);
    });

    it('handles multi-line comments', () => {
      const e = parseEvents('<!--\n  multi\n  line\n--><a/>');
      expect(e.comments).toHaveLength(1);
      expect(e.comments[0]).toContain('multi');
    });
  });

  // =========================================================================
  // CDATA
  // =========================================================================
  describe('CDATA', () => {
    it('emits cdata events', () => {
      const e = parseEvents('<a><![CDATA[raw <content>]]></a>');
      expect(e.cdatas).toEqual(['raw <content>']);
    });

    it('handles CDATA with special characters', () => {
      const e = parseEvents('<a><![CDATA[a && b < c > d]]></a>');
      expect(e.cdatas).toEqual(['a && b < c > d']);
    });
  });

  // =========================================================================
  // Processing instructions
  // =========================================================================
  describe('processing instructions', () => {
    it('emits processing instruction events', () => {
      const e = parseEvents('<?xml version="1.0"?><root/>');
      expect(e.pis).toHaveLength(1);
      expect(e.pis[0]!.name).toBe('xml');
      expect(e.pis[0]!.body).toContain('version="1.0"');
    });

    it('handles PI without body', () => {
      const e = parseEvents('<?xml?><root/>');
      expect(e.pis).toEqual([{ name: 'xml', body: '' }]);
    });
  });

  // =========================================================================
  // DOCTYPE
  // =========================================================================
  describe('DOCTYPE', () => {
    it('emits DOCTYPE as ondoctype event with parsed attributes', () => {
      const e = parseEvents(
        '<?xml version="1.0"?><!DOCTYPE tv SYSTEM "xmltv.dtd"><tv/>',
      );
      expect(e.pis).toHaveLength(1);
      expect(e.doctypes).toHaveLength(1);
      expect(e.doctypes[0]!.tagName).toBe('!DOCTYPE');
      expect(e.doctypes[0]!.attrs).toEqual({
        tv: null,
        SYSTEM: null,
        'xmltv.dtd': null,
      });
      expect(e.opens.map((o) => o.name)).toEqual(['tv']);
    });

    it('handles DOCTYPE with internal subset (discards bracket content)', () => {
      const e = parseEvents(
        '<!DOCTYPE root [<!ELEMENT root (#PCDATA)>]><root>text</root>',
      );
      expect(e.doctypes).toHaveLength(1);
      expect(e.doctypes[0]!.tagName).toBe('!DOCTYPE');
      expect(e.doctypes[0]!.attrs).toEqual({ root: null });
      expect(e.opens.map((o) => o.name)).toEqual(['root']);
      expect(e.texts).toEqual(['text']);
    });

    it('parses simple HTML5 DOCTYPE', () => {
      const e = parseEvents('<!DOCTYPE html><html></html>');
      expect(e.doctypes).toHaveLength(1);
      expect(e.doctypes[0]!.tagName).toBe('!DOCTYPE');
      expect(e.doctypes[0]!.attrs).toEqual({ html: null });
      expect(e.opens.map((o) => o.name)).toEqual(['html']);
    });

    it('parses DOCTYPE with PUBLIC and SYSTEM identifiers', () => {
      const e = parseEvents(
        '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd"><html/>',
      );
      expect(e.doctypes).toHaveLength(1);
      expect(e.doctypes[0]!.tagName).toBe('!DOCTYPE');
      expect(e.doctypes[0]!.attrs).toEqual({
        html: null,
        PUBLIC: null,
        '-//W3C//DTD XHTML 1.0 Strict//EN': null,
        'http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd': null,
      });
    });

    it('parses DOCTYPE split across chunks', () => {
      const e = collectEvents([
        '<!DOCT',
        'YPE html PUBLIC "-//W3C',
        '//DTD XHTML 1.0 Strict//EN">',
        '<html/>',
      ]);
      expect(e.doctypes).toHaveLength(1);
      expect(e.doctypes[0]!.tagName).toBe('!DOCTYPE');
      expect(e.doctypes[0]!.attrs.html).toBe(null);
      expect(e.doctypes[0]!.attrs.PUBLIC).toBe(null);
      expect(e.doctypes[0]!.attrs['-//W3C//DTD XHTML 1.0 Strict//EN']).toBe(
        null,
      );
    });

    it('does not emit DOCTYPE through onopentag', () => {
      const e = parseEvents('<!DOCTYPE html><html></html>');
      // DOCTYPE should NOT appear in opens — it has its own callback
      expect(e.opens.map((o) => o.name)).toEqual(['html']);
    });
  });

  // =========================================================================
  // selfClosingTags option
  // =========================================================================
  describe('selfClosingTags', () => {
    it('treats listed tags as self-closing', () => {
      const e = parseEvents('<div><br><hr><p>text</p></div>', {
        selfClosingTags: ['br', 'hr'],
      });
      expect(e.opens.map((o) => o.name)).toEqual(['div', 'br', 'hr', 'p']);
      // br and hr should auto-close
      expect(e.closes).toEqual(['br', 'hr', 'p', 'div']);
    });

    it('works with attributes on void tags', () => {
      const e = parseEvents('<img src="a.png"><span>text</span>', {
        selfClosingTags: ['img'],
      });
      expect(e.opens[0]!.attrs.src).toBe('a.png');
      expect(e.closes).toEqual(['img', 'span']);
    });
  });

  // =========================================================================
  // rawContentTags option
  // =========================================================================
  describe('rawContentTags', () => {
    it('treats content of raw tags as text', () => {
      const e = parseEvents('<script>var x = 1 < 2 && 3 > 0;</script>', {
        rawContentTags: ['script'],
      });
      expect(e.opens.map((o) => o.name)).toEqual(['script']);
      expect(e.texts).toEqual(['var x = 1 < 2 && 3 > 0;']);
      expect(e.closes).toEqual(['script']);
    });

    it('handles style tags with CSS', () => {
      const e = parseEvents('<style>.a > .b { color: red; }</style>', {
        rawContentTags: ['style'],
      });
      expect(e.texts).toEqual(['.a > .b { color: red; }']);
      expect(e.closes).toEqual(['style']);
    });

    it('preserves raw content with nested-looking tags', () => {
      const e = parseEvents(
        "<script>document.createElement('<div>')</script>",
        {
          rawContentTags: ['script'],
        },
      );
      expect(e.texts).toEqual(["document.createElement('<div>')"]);
    });
  });

  // =========================================================================
  // Chunked streaming — split across multiple writes
  // =========================================================================
  describe('chunked streaming', () => {
    it('handles elements split across chunks', () => {
      const e = collectEvents(['<a>hel', 'lo</a>']);
      expect(e.opens.map((o) => o.name)).toEqual(['a']);
      expect(e.texts).toEqual(['hello']);
      expect(e.closes).toEqual(['a']);
    });

    it('handles tag split mid-name', () => {
      const e = collectEvents(['<lon', 'gname>text</longname>']);
      expect(e.opens[0]!.name).toBe('longname');
    });

    it('handles attribute split across chunks', () => {
      const e = collectEvents(['<a id="te', 'st">x</a>']);
      expect(e.opens[0]!.attrs.id).toBe('test');
    });

    it('handles close tag split across chunks', () => {
      const e = collectEvents(['<a>text</', 'a>']);
      expect(e.closes).toEqual(['a']);
    });

    it('handles comment split across chunks', () => {
      const e = collectEvents(['<!-- com', 'ment --><a/>']);
      expect(e.comments).toEqual(['<!-- comment -->']);
      expect(e.opens.map((o) => o.name)).toEqual(['a']);
    });

    it('handles CDATA split across chunks', () => {
      const e = collectEvents(['<a><![CDA', 'TA[raw]]></a>']);
      expect(e.cdatas).toEqual(['raw']);
    });

    it('handles PI split across chunks', () => {
      const e = collectEvents(['<?xm', 'l version="1.0"?><a/>']);
      expect(e.pis).toHaveLength(1);
      expect(e.pis[0]!.name).toBe('xml');
    });

    it('handles many small chunks (byte-at-a-time)', () => {
      const xml = '<root><item id="1">hello</item></root>';
      const e = collectEvents(chunkString(xml, 1));
      expect(e.opens.map((o) => o.name)).toEqual(['root', 'item']);
      expect(e.opens[1]!.attrs.id).toBe('1');
      expect(e.texts).toEqual(['hello']);
      expect(e.closes).toEqual(['item', 'root']);
    });

    it('handles empty chunks interspersed', () => {
      const e = collectEvents(['', '<a>', '', 'text', '', '</a>', '']);
      expect(e.opens.map((o) => o.name)).toEqual(['a']);
      expect(e.texts).toEqual(['text']);
      expect(e.closes).toEqual(['a']);
    });

    it('handles rawContentTags split across chunks', () => {
      const e = collectEvents(['<script>var x = 1 <', ' 2;</script>'], {
        rawContentTags: ['script'],
      });
      expect(e.texts).toEqual(['var x = 1 < 2;']);
      expect(e.closes).toEqual(['script']);
    });
  });

  // =========================================================================
  // Complex fixtures
  // =========================================================================
  describe('complex fixtures', () => {
    const rssFeed = fixture('rss-feed.xml');
    const soapEnvelope = fixture('soap-envelope.xml');
    const atomFeed = fixture('atom-feed.xml');
    const pomXml = fixture('pom.xml');
    const xmltvEpg = fixture('xmltv-epg.xml');

    /** Build a tree from fastStream events for comparison. */
    interface Node {
      tagName: string;
      attributes: Attributes;
      children: (Node | string)[];
    }

    function buildTree(
      xml: string,
      chunkSize: number,
      options?: { selfClosingTags?: string[]; rawContentTags?: string[] },
    ): Node[] {
      const chunks = chunkString(xml, chunkSize);
      const roots: (Node | string)[] = [];
      const stack: Node[] = [];

      const parser = fastStream({
        ...options,
        onopentag(name, attrs) {
          const el: Node = {
            tagName: name,
            attributes: { ...attrs },
            children: [],
          };
          if (stack.length > 0) {
            stack[stack.length - 1]!.children.push(el);
          } else {
            roots.push(el);
          }
          stack.push(el);
        },
        onclosetag() {
          stack.pop();
        },
        ontext(text) {
          if (stack.length > 0) {
            stack[stack.length - 1]!.children.push(text);
          } else {
            roots.push(text);
          }
        },
        oncdata(data) {
          if (stack.length > 0) {
            stack[stack.length - 1]!.children.push(data);
          } else {
            roots.push(data);
          }
        },
      });

      for (const chunk of chunks) {
        parser.write(chunk);
      }
      parser.close();

      return roots.filter((r): r is Node => typeof r !== 'string');
    }

    describe('RSS feed', () => {
      it('parses entire document as single chunk', () => {
        const trees = buildTree(rssFeed, rssFeed.length);
        const rss = trees.find((n) => n.tagName === 'rss');
        expect(rss).toBeDefined();
        expect(rss!.attributes.version).toBe('2.0');
      });

      it('produces consistent trees across chunk sizes', () => {
        const sizes = [64, 128, 256, 512, rssFeed.length];
        const tagSets = sizes.map((size) =>
          buildTree(rssFeed, size).map((n) => n.tagName),
        );
        for (let i = 1; i < tagSets.length; i++) {
          expect(tagSets[i]).toEqual(tagSets[0]);
        }
      });
    });

    describe('SOAP envelope', () => {
      it('parses namespaced elements', () => {
        const trees = buildTree(soapEnvelope, soapEnvelope.length);
        const envelope = trees.find((n) => n.tagName === 'soap:Envelope');
        expect(envelope).toBeDefined();
        expect(envelope!.attributes['xmlns:soap']).toBe(
          'http://schemas.xmlsoap.org/soap/envelope/',
        );
      });

      it('preserves deeply nested structure when streamed in 100-byte chunks', () => {
        const trees = buildTree(soapEnvelope, 100);
        const envelope = trees.find((n) => n.tagName === 'soap:Envelope');
        expect(envelope).toBeDefined();
        const header = envelope!.children.find(
          (c) => typeof c !== 'string' && c.tagName === 'soap:Header',
        ) as Node;
        expect(header).toBeDefined();
        const security = header.children.find(
          (c) => typeof c !== 'string' && c.tagName === 'wsse:Security',
        ) as Node;
        expect(security).toBeDefined();
      });
    });

    describe('Atom feed', () => {
      it('parses feed with self-closing links', () => {
        const trees = buildTree(atomFeed, atomFeed.length);
        const feed = trees.find((n) => n.tagName === 'feed');
        expect(feed).toBeDefined();
        expect(feed!.attributes.xmlns).toBe('http://www.w3.org/2005/Atom');
      });

      it('consistent across chunk sizes', () => {
        const sizes = [64, 256, 1024, atomFeed.length];
        const tagSets = sizes.map((size) =>
          buildTree(atomFeed, size).map((n) => n.tagName),
        );
        for (let i = 1; i < tagSets.length; i++) {
          expect(tagSets[i]).toEqual(tagSets[0]);
        }
      });
    });

    describe('Maven POM', () => {
      it('parses and reconstructs full tree', () => {
        const trees = buildTree(pomXml, pomXml.length);
        const project = trees.find((n) => n.tagName === 'project');
        expect(project).toBeDefined();
      });

      it('consistent across chunk sizes', () => {
        const sizes = [50, 200, 500, pomXml.length];
        const tagSets = sizes.map((size) =>
          buildTree(pomXml, size).map((n) => n.tagName),
        );
        for (let i = 1; i < tagSets.length; i++) {
          expect(tagSets[i]).toEqual(tagSets[0]);
        }
      });
    });

    describe('XMLTV EPG', () => {
      it('parses all channels and programmes', () => {
        const trees = buildTree(xmltvEpg, xmltvEpg.length);
        const tv = trees.find((n) => n.tagName === 'tv');
        expect(tv).toBeDefined();

        const channels = tv!.children.filter(
          (c) => typeof c !== 'string' && c.tagName === 'channel',
        ) as Node[];
        const programmes = tv!.children.filter(
          (c) => typeof c !== 'string' && c.tagName === 'programme',
        ) as Node[];

        expect(channels).toHaveLength(8);
        expect(programmes).toHaveLength(28);
      });

      it('preserves programme details when streamed in 97-byte chunks', () => {
        const trees = buildTree(xmltvEpg, 97);
        const tv = trees.find((n) => n.tagName === 'tv');
        expect(tv).toBeDefined();

        const programmes = tv!.children.filter(
          (c) => typeof c !== 'string' && c.tagName === 'programme',
        ) as Node[];
        expect(programmes).toHaveLength(28);

        const first = programmes[0]!;
        expect(first.attributes.channel).toBe('bbc1.uk');
        expect(first.attributes.start).toBe('20260403180000 +0100');

        const title = first.children.find(
          (c) => typeof c !== 'string' && c.tagName === 'title',
        ) as Node;
        expect(title).toBeDefined();
        expect(title.children[0]).toBe('BBC News at Six');
      });

      it('consistent across chunk sizes', () => {
        const sizes = [64, 128, 256, 512, 1024, xmltvEpg.length];
        const treeSets = sizes.map((size) => {
          const trees = buildTree(xmltvEpg, size);
          const tv = trees.find((n) => n.tagName === 'tv');
          return (
            tv?.children.filter((c) => typeof c !== 'string') as Node[]
          ).map((n) => n.tagName);
        });
        for (let i = 1; i < treeSets.length; i++) {
          expect(treeSets[i]).toEqual(treeSets[0]);
        }
      });
    });

    describe('HTML page (with html options)', () => {
      const htmlPage = fixture('html-page.html');

      it('parses HTML with void elements and raw content', () => {
        const trees = buildTree(htmlPage, htmlPage.length, {
          selfClosingTags: [
            'area',
            'base',
            'br',
            'col',
            'embed',
            'hr',
            'img',
            'input',
            'link',
            'meta',
            'param',
            'source',
            'track',
            'wbr',
          ],
          rawContentTags: ['script', 'style'],
        });
        const html = trees.find((n) => n.tagName === 'html');
        expect(html).toBeDefined();
        expect(html!.attributes.lang).toBe('en');
      });

      it('preserves script content with angle brackets', () => {
        const e = collectEvents([htmlPage], {
          selfClosingTags: [
            'area',
            'base',
            'br',
            'col',
            'embed',
            'hr',
            'img',
            'input',
            'link',
            'meta',
            'param',
            'source',
            'track',
            'wbr',
          ],
          rawContentTags: ['script', 'style'],
        });

        // Should have script text containing angle brackets
        const scriptTexts = e.texts.filter(
          (t) => t.includes('createElement') || t.includes('@context'),
        );
        expect(scriptTexts.length).toBeGreaterThan(0);
      });

      it('consistent across chunk sizes with html options', () => {
        const opts = {
          selfClosingTags: [
            'area',
            'base',
            'br',
            'col',
            'embed',
            'hr',
            'img',
            'input',
            'link',
            'meta',
            'param',
            'source',
            'track',
            'wbr',
          ],
          rawContentTags: ['script', 'style'],
        };
        const sizes = [80, 256, 1024, htmlPage.length];
        const tagSets = sizes.map((size) =>
          buildTree(htmlPage, size, opts).map((n) => n.tagName),
        );
        for (let i = 1; i < tagSets.length; i++) {
          expect(tagSets[i]).toEqual(tagSets[0]);
        }
      });
    });
  });

  // =========================================================================
  // Selective callbacks — only register what you need
  // =========================================================================
  describe('selective callbacks', () => {
    it('works with only onopentag', () => {
      const tags: string[] = [];
      const parser = fastStream({
        onopentag(name) {
          tags.push(name);
        },
      });
      parser.write('<a><b/></a>');
      parser.close();
      expect(tags).toEqual(['a', 'b']);
    });

    it('works with no callbacks at all (just tokenizes)', () => {
      const parser = fastStream();
      parser.write('<a><b>text</b></a>');
      parser.close();
      // Should not throw
    });
  });
});
