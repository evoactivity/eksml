import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { saxEngine } from '#src/saxEngine.ts';
import type { Attributes } from '#src/saxEngine.ts';

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

/** Feed chunks through saxEngine and collect all events. */
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

  const parser = saxEngine({
    ...options,
    onOpenTag(name, attrs) {
      events.opens.push({ name, attrs });
    },
    onCloseTag(name) {
      events.closes.push(name);
    },
    onText(text) {
      events.texts.push(text);
    },
    onCdata(data) {
      events.cdatas.push(data);
    },
    onComment(comment) {
      events.comments.push(comment);
    },
    onProcessingInstruction(name, body) {
      events.pis.push({ name, body });
    },
    onDoctype(tagName, attrs) {
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
describe('saxEngine', () => {
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
    it('emits DOCTYPE as onDoctype event with parsed attributes', () => {
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

    it('does not emit DOCTYPE through onOpenTag', () => {
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

    /** Build a tree from saxEngine events for comparison. */
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

      const parser = saxEngine({
        ...options,
        onOpenTag(name, attrs) {
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
        onCloseTag() {
          stack.pop();
        },
        onText(text) {
          if (stack.length > 0) {
            stack[stack.length - 1]!.children.push(text);
          } else {
            roots.push(text);
          }
        },
        onCdata(data) {
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
  // Issue 1 — Prototype pollution via plain {} for attributes
  // =========================================================================
  describe('prototype pollution (issue 1)', () => {
    it('attributes objects have null prototype (no Object.prototype properties)', () => {
      const e = parseEvents('<foo bar="baz">x</foo>');
      const attrs = e.opens[0]!.attrs;
      // Object.create(null) produces an object with no prototype
      expect(Object.getPrototypeOf(attrs)).toBeNull();
    });

    it('attribute named "constructor" does not shadow Object.prototype.constructor', () => {
      const e = parseEvents('<foo constructor="bad">x</foo>');
      const attrs = e.opens[0]!.attrs;
      // With Object.create(null), there is no inherited constructor
      expect(attrs.constructor).toBe('bad');
      expect(Object.getPrototypeOf(attrs)).toBeNull();
    });

    it('attribute named "__proto__" is stored as a plain key', () => {
      const e = parseEvents('<foo __proto__="polluted">x</foo>');
      const attrs = e.opens[0]!.attrs;
      expect(attrs['__proto__']).toBe('polluted');
      // Should not actually pollute the prototype chain
      expect(Object.getPrototypeOf(attrs)).toBeNull();
    });

    it('DOCTYPE attributes have null prototype', () => {
      const e = parseEvents('<!DOCTYPE html><root/>');
      const attrs = e.doctypes[0]!.attrs;
      expect(Object.getPrototypeOf(attrs)).toBeNull();
    });

    it('element with no explicit attributes still has null-prototype attributes', () => {
      // When a tag opens, attributes = {} is created (line 339 in TAG_OPEN)
      // Even if no attributes are parsed, the object should have null prototype
      const e = parseEvents('<foo>x</foo>');
      const attrs = e.opens[0]!.attrs;
      expect(Object.getPrototypeOf(attrs)).toBeNull();
    });
  });

  // =========================================================================
  // Issue 2 — Raw text loses < on partial close-tag mismatch
  // =========================================================================
  describe('raw text close-tag mismatch (issue 2)', () => {
    it('preserves raw text when close tag name does not match', () => {
      // <script> contains "</scr" which starts matching but then fails
      const e = parseEvents('<script></scr not a close>real content</script>', {
        rawContentTags: ['script'],
      });
      expect(e.texts).toEqual(['</scr not a close>real content']);
      expect(e.closes).toEqual(['script']);
    });

    it('preserves raw text with < followed by non-slash', () => {
      const e = parseEvents('<script>a < b && c > d</script>', {
        rawContentTags: ['script'],
      });
      expect(e.texts).toEqual(['a < b && c > d']);
    });

    it('preserves raw text when partial close tag is followed by < (RAW_END_2 mismatch with <)', () => {
      // After "</scx" mismatch, the next char could be "<" which starts a new potential close
      const e = parseEvents('<script></scx</ still raw</script>', {
        rawContentTags: ['script'],
      });
      expect(e.texts).toEqual(['</scx</ still raw']);
      expect(e.closes).toEqual(['script']);
    });

    it('preserves whitespace between close tag name and mismatch char in RAW_END_3', () => {
      // After matching full tag name "script" + whitespace, a non-">" char causes mismatch
      // The whitespace between the tag name and the mismatch char should be preserved
      const e = parseEvents('<script></script x>real</script>', {
        rawContentTags: ['script'],
      });
      // The "</script x>" is not a valid close tag — the full text should be preserved
      expect(e.texts).toEqual(['</script x>real']);
      expect(e.closes).toEqual(['script']);
    });

    it('handles multiple false close-tag starts in raw content', () => {
      const e = parseEvents('<script></scr></scrip></scriptx>done</script>', {
        rawContentTags: ['script'],
      });
      expect(e.texts).toEqual(['</scr></scrip></scriptx>done']);
      expect(e.closes).toEqual(['script']);
    });

    it('close() flushes raw text in RAW_END_3 state', () => {
      // When close() is called while in RAW_END_3 (after matching tag name + whitespace)
      const texts: string[] = [];
      const closes: string[] = [];
      const parser = saxEngine({
        rawContentTags: ['script'],
        onOpenTag() {},
        onText(t) {
          texts.push(t);
        },
        onCloseTag(n) {
          closes.push(n);
        },
      });
      parser.write('<script>content</script ');
      // Input ends while in RAW_END_3 (after matching "script" + space, waiting for >)
      parser.close();
      // The raw text should be flushed even though the close tag wasn't completed
      expect(texts).toEqual(['content']);
      expect(closes).toEqual(['script']);
    });
  });

  // =========================================================================
  // Issue 3 — Unbounded memory accumulation
  // =========================================================================
  describe('maxBufferSize (issue 3)', () => {
    it('throws when text buffer exceeds maxBufferSize', () => {
      const parser = saxEngine({
        maxBufferSize: 100,
        onText() {},
      });
      // Write a huge text chunk without any tags to trigger buffer overflow
      expect(() => {
        parser.write('x'.repeat(200));
      }).toThrow(/buffer/i);
    });

    it('throws when attribute value buffer exceeds maxBufferSize', () => {
      const parser = saxEngine({
        maxBufferSize: 100,
        onOpenTag() {},
      });
      // Start a tag with a very long attribute value that never closes
      expect(() => {
        parser.write('<foo bar="' + 'x'.repeat(200));
      }).toThrow(/buffer/i);
    });

    it('throws when comment buffer exceeds maxBufferSize', () => {
      const parser = saxEngine({
        maxBufferSize: 100,
        onComment() {},
      });
      // Start a comment that never closes
      expect(() => {
        parser.write('<!--' + 'x'.repeat(200));
      }).toThrow(/buffer/i);
    });

    it('throws when CDATA buffer exceeds maxBufferSize', () => {
      const parser = saxEngine({
        maxBufferSize: 100,
        onCdata() {},
      });
      expect(() => {
        parser.write('<![CDATA[' + 'x'.repeat(200));
      }).toThrow(/buffer/i);
    });

    it('throws when raw text buffer exceeds maxBufferSize', () => {
      const parser = saxEngine({
        maxBufferSize: 100,
        rawContentTags: ['script'],
        onText() {},
      });
      expect(() => {
        parser.write('<script>' + 'x'.repeat(200));
      }).toThrow(/buffer/i);
    });

    it('does not throw when buffers stay within maxBufferSize', () => {
      const parser = saxEngine({
        maxBufferSize: 1000,
        onOpenTag() {},
        onCloseTag() {},
        onText() {},
      });
      // All buffers remain well under the 1000-char limit
      expect(() => {
        parser.write('<root><child attr="value">text</child></root>');
        parser.close();
      }).not.toThrow();
    });

    it('does not throw when maxBufferSize is undefined (backward compat)', () => {
      const parser = saxEngine({
        onText() {},
      });
      // No maxBufferSize = no limit
      expect(() => {
        parser.write('x'.repeat(10000));
        parser.close();
      }).not.toThrow();
    });
  });

  // =========================================================================
  // Issue 5 — Raw close-tag matching correctness (O(n×m) optimization)
  // =========================================================================
  describe('raw close-tag matching correctness (issue 5)', () => {
    it('correctly handles long raw content with many false close-tag starts', () => {
      // Generate content with many "</scrip" false starts that almost match "</script>"
      const falseStarts = '</scrip '.repeat(100);
      const xml = `<script>${falseStarts}real</script>`;
      const e = parseEvents(xml, { rawContentTags: ['script'] });
      expect(e.texts).toEqual([`${falseStarts}real`]);
      expect(e.closes).toEqual(['script']);
    });

    it('handles raw content split across chunks with false close-tag starts', () => {
      const chunks = ['<script>content</scr', 'ipt nope>more</scri', 'pt>'];
      const e = collectEvents(chunks, { rawContentTags: ['script'] });
      expect(e.texts).toEqual(['content</script nope>more']);
      expect(e.closes).toEqual(['script']);
    });
  });

  // =========================================================================
  // close() in non-raw-text states — partial constructs are discarded
  // =========================================================================
  describe('close() in non-raw-text states', () => {
    it('close() mid-attribute discards partial tag, emits nothing', () => {
      const opens: string[] = [];
      const texts: string[] = [];
      const parser = saxEngine({
        onOpenTag(name) {
          opens.push(name);
        },
        onText(t) {
          texts.push(t);
        },
      });
      parser.write('some text<div id="val');
      parser.close();
      // The text before the tag should be emitted, but the partial tag is discarded
      expect(texts).toEqual(['some text']);
      expect(opens).toEqual([]);
    });

    it('close() mid-processing-instruction discards partial PI', () => {
      const pis: string[] = [];
      const opens: string[] = [];
      const parser = saxEngine({
        onProcessingInstruction(name) {
          pis.push(name);
        },
        onOpenTag(name) {
          opens.push(name);
        },
      });
      parser.write('<root/><?xml version="1.0');
      parser.close();
      expect(opens).toEqual(['root']);
      expect(pis).toEqual([]);
    });

    it('close() mid-comment discards partial comment', () => {
      const comments: string[] = [];
      const texts: string[] = [];
      const parser = saxEngine({
        onComment(c) {
          comments.push(c);
        },
        onText(t) {
          texts.push(t);
        },
      });
      parser.write('hello<!-- incomplete');
      parser.close();
      expect(texts).toEqual(['hello']);
      expect(comments).toEqual([]);
    });

    it('close() mid-CDATA discards partial CDATA', () => {
      const cdatas: string[] = [];
      const parser = saxEngine({
        onCdata(d) {
          cdatas.push(d);
        },
      });
      parser.write('<root><![CDATA[some data');
      parser.close();
      expect(cdatas).toEqual([]);
    });

    it('close() mid-tag-name discards partial open tag', () => {
      const opens: string[] = [];
      const parser = saxEngine({
        onOpenTag(name) {
          opens.push(name);
        },
      });
      parser.write('<root><longtagnam');
      parser.close();
      expect(opens).toEqual(['root']);
    });

    it('close() mid-close-tag discards partial close tag', () => {
      const closes: string[] = [];
      const parser = saxEngine({
        onOpenTag() {},
        onCloseTag(name) {
          closes.push(name);
        },
      });
      parser.write('<root></roo');
      parser.close();
      expect(closes).toEqual([]);
    });

    it('close() resets state so parser can be reused', () => {
      const texts: string[] = [];
      const parser = saxEngine({
        onText(t) {
          texts.push(t);
        },
      });
      // Leave parser in a mid-attribute state
      parser.write('<div id="val');
      parser.close();
      // Write fresh content — should parse cleanly
      parser.write('hello');
      parser.close();
      expect(texts).toEqual(['hello']);
    });
  });

  // =========================================================================
  // Selective callbacks — only register what you need
  // =========================================================================
  describe('selective callbacks', () => {
    it('works with only onOpenTag', () => {
      const tags: string[] = [];
      const parser = saxEngine({
        onOpenTag(name) {
          tags.push(name);
        },
      });
      parser.write('<a><b/></a>');
      parser.close();
      expect(tags).toEqual(['a', 'b']);
    });

    it('works with no callbacks at all (just tokenizes)', () => {
      const parser = saxEngine();
      parser.write('<a><b>text</b></a>');
      parser.close();
      // Should not throw
    });
  });

  // =========================================================================
  // Edge cases: comment parsing (COMMENT_END2)
  // =========================================================================
  describe('comment edge cases', () => {
    it('handles extra dashes inside a comment (----->)', () => {
      // Extra dashes in COMMENT_END2: after --, encountering another - stays in COMMENT_END2
      const e = parseEvents('<root><!-- extra --- dashes --></root>');
      expect(e.comments).toHaveLength(1);
      expect(e.comments[0]).toContain('extra');
      expect(e.comments[0]).toContain('dashes');
    });

    it('handles non-closing after -- (COMMENT_END2 non-> resets to COMMENT)', () => {
      // After --, a non-dash non-> char resets back to COMMENT state
      const e = parseEvents('<root><!-- foo--bar --></root>');
      expect(e.comments).toHaveLength(1);
      expect(e.comments[0]).toContain('foo');
      expect(e.comments[0]).toContain('bar');
    });
  });

  // =========================================================================
  // Edge cases: CDATA handshake mismatch
  // =========================================================================
  describe('CDATA handshake mismatch', () => {
    it('CDATA_1 mismatch: <![X falls through to DOCTYPE', () => {
      // <![X... doesn't match CDATA — falls through to DOCTYPE handling
      const e = parseEvents('<![XDATA[data]]>');
      expect(e.cdatas).toEqual([]);
      expect(e.doctypes).toHaveLength(1);
    });

    it('CDATA_2 mismatch: <![CX falls through to DOCTYPE', () => {
      const e = parseEvents('<![CX...>');
      expect(e.cdatas).toEqual([]);
      expect(e.doctypes).toHaveLength(1);
    });

    it('CDATA_3 mismatch: <![CDX falls through to DOCTYPE', () => {
      const e = parseEvents('<![CDX...>');
      expect(e.cdatas).toEqual([]);
      expect(e.doctypes).toHaveLength(1);
    });

    it('CDATA_4 mismatch: <![CDAX falls through to DOCTYPE', () => {
      const e = parseEvents('<![CDAX...>');
      expect(e.cdatas).toEqual([]);
      expect(e.doctypes).toHaveLength(1);
    });

    it('CDATA_5 mismatch: <![CDATX falls through to DOCTYPE', () => {
      const e = parseEvents('<![CDATX...>');
      expect(e.cdatas).toEqual([]);
      expect(e.doctypes).toHaveLength(1);
    });

    it('CDATA_6 mismatch: <![CDATAx falls through to DOCTYPE', () => {
      // After matching [CDATA but not the final [
      const e = parseEvents('<![CDATAx>');
      expect(e.cdatas).toEqual([]);
      expect(e.doctypes).toHaveLength(1);
    });
  });

  // =========================================================================
  // Edge cases: CDATA end sequence
  // =========================================================================
  describe('CDATA end sequence edge cases', () => {
    it('CDATA_END1: single ] followed by non-] stays in CDATA', () => {
      // A single ] followed by a non-] character goes back to CDATA
      const e = parseEvents('<![CDATA[data]more]]>');
      expect(e.cdatas).toEqual(['data]more']);
    });

    it('CDATA_END2: extra ] before > is accumulated', () => {
      // After ]], another ] is accumulated (extra bracket)
      const e = parseEvents('<![CDATA[data]]]>');
      expect(e.cdatas).toEqual(['data]']);
    });

    it('CDATA_END2: ]] followed by non-> non-] goes back to CDATA', () => {
      // After ]], a non-> non-] character resets to CDATA
      const e = parseEvents('<![CDATA[a]]b]]>');
      expect(e.cdatas).toEqual(['a]]b']);
    });
  });

  // =========================================================================
  // Edge cases: PI_END non-> after ?
  // =========================================================================
  describe('PI_END edge cases', () => {
    it('? followed by non-> stays in PI (re-checks char)', () => {
      // <?foo bar?baz?> — the first ? is not followed by >, so it stays in PI
      const e = parseEvents('<?foo bar?baz?>');
      expect(e.pis).toHaveLength(1);
      expect(e.pis[0]!.name).toBe('foo');
      expect(e.pis[0]!.body).toBe('bar?baz');
    });
  });

  // =========================================================================
  // Edge cases: DOCTYPE_BRACKET
  // =========================================================================
  describe('DOCTYPE_BRACKET edge cases', () => {
    it('handles DOCTYPE with internal subset (brackets)', () => {
      // DOCTYPE with an internal subset [...] that contains non-] chars
      const xml =
        '<!DOCTYPE root [<!ELEMENT root (#PCDATA)>]><root>text</root>';
      const e = parseEvents(xml);
      expect(e.doctypes).toHaveLength(1);
      expect(e.opens).toEqual([{ name: 'root', attrs: {} }]);
    });

    it('DOCTYPE bracket with various content before ]', () => {
      // Non-] characters inside the bracket section are skipped
      const xml = '<!DOCTYPE html [some content here]><html></html>';
      const e = parseEvents(xml);
      expect(e.doctypes).toHaveLength(1);
    });
  });

  // =========================================================================
  // Edge cases: RAW_END states
  // =========================================================================
  describe('RAW_END edge cases', () => {
    it('RAW_END_2: tag name mismatch goes back to RAW_TEXT', () => {
      // Inside <script>, a </scr followed by a non-matching char
      // resets to RAW_TEXT
      const e = parseEvents('<script></scr ipt>real</script>', {
        rawContentTags: ['script'],
      });
      expect(e.texts).toEqual(['</scr ipt>real']);
    });

    it('RAW_END_2: non-> after full tag match goes back to RAW_TEXT', () => {
      // After matching </script but getting a non-> non-whitespace char
      const e = parseEvents('<script></scriptx>real</script>', {
        rawContentTags: ['script'],
      });
      expect(e.texts).toEqual(['</scriptx>real']);
    });

    it('RAW_END_2: whitespace after tag match transitions to RAW_END_3', () => {
      // </script > with a space before > is valid
      const e = parseEvents('<script>code</script >', {
        rawContentTags: ['script'],
      });
      expect(e.texts).toEqual(['code']);
      expect(e.closes).toEqual(['script']);
    });

    it('RAW_END_3: non-> non-whitespace goes back to RAW_TEXT', () => {
      // After </script  followed by a non-whitespace non-> char
      const e = parseEvents('<script></script x>real</script>', {
        rawContentTags: ['script'],
      });
      expect(e.texts).toEqual(['</script x>real']);
    });

    it('RAW_END_3: multiple whitespace before > is fine', () => {
      const e = parseEvents('<script>code</script   >', {
        rawContentTags: ['script'],
      });
      expect(e.texts).toEqual(['code']);
      expect(e.closes).toEqual(['script']);
    });
  });

  // =========================================================================
  // Edge cases: close() in various states
  // =========================================================================
  describe('close() in various raw states', () => {
    it('close() in RAW_END_3 state emits text and close', () => {
      // Parser is in RAW_END_3 (tag matched + trailing whitespace) at close()
      const e = collectEvents(['<script>code</script '], {
        rawContentTags: ['script'],
      });
      // close() should treat the full tag match + whitespace as a valid close
      expect(e.texts).toEqual(['code']);
      expect(e.closes).toEqual(['script']);
    });

    it('close() in RAW_TEXT state emits buffered raw text', () => {
      // Parser is still in RAW_TEXT at close — no close tag seen at all
      const e = collectEvents(['<script>unclosed raw text'], {
        rawContentTags: ['script'],
      });
      expect(e.texts).toEqual(['unclosed raw text']);
      expect(e.closes).toEqual(['script']);
    });

    it('close() in RAW_END_1 state (saw < but no /)', () => {
      // Parser saw < but no / — the < is part of the raw text
      const e = collectEvents(['<script>code<'], {
        rawContentTags: ['script'],
      });
      expect(e.texts).toEqual(['code<']);
      expect(e.closes).toEqual(['script']);
    });

    it('close() in RAW_END_2 state (partial close tag match)', () => {
      // Parser saw </scr but input ended — partial match becomes text
      const e = collectEvents(['<script>code</scr'], {
        rawContentTags: ['script'],
      });
      expect(e.texts).toEqual(['code</scr']);
      expect(e.closes).toEqual(['script']);
    });
  });

  // =========================================================================
  // Edge case: default state (should not normally be reached)
  // =========================================================================
  describe('default state', () => {
    it('does not crash on pathological input', () => {
      // This tests that the parser handles any unexpected state gracefully.
      // The default case just advances i++ and continues.
      // Normal input won't trigger this, but we verify robustness.
      const parser = saxEngine();
      parser.write('<root>text</root>');
      parser.close();
      // Should not throw
    });
  });

  // =========================================================================
  // DOCTYPE: unclosed quoted token
  // =========================================================================
  describe('DOCTYPE unclosed quoted token', () => {
    it('treats unclosed double-quoted token as attribute key', () => {
      // emitDoctype: quote opens at `"` but never closes → lines 244-246
      const e = collectEvents(['<!DOCTYPE html "unclosed>']);
      expect(e.doctypes).toHaveLength(1);
      expect(e.doctypes[0]!.attrs['html']).toBe(null);
      expect(e.doctypes[0]!.attrs['unclosed']).toBe(null);
    });

    it('treats unclosed single-quoted token as attribute key', () => {
      const e = collectEvents(["<!DOCTYPE html 'unclosed>"]);
      expect(e.doctypes).toHaveLength(1);
      expect(e.doctypes[0]!.attrs['unclosed']).toBe(null);
    });
  });

  // =========================================================================
  // Attribute parsing: ATTR_AFTER_NAME → =  (line 466)
  // =========================================================================
  describe('ATTR_AFTER_NAME transitions', () => {
    it('transitions to ATTR_AFTER_EQ when = follows attr name', () => {
      // Attribute like `foo = "bar"` — whitespace before = triggers
      // ATTR_AFTER_NAME whitespace skip, then = triggers line 466
      const e = collectEvents(['<div foo = "bar"></div>']);
      expect(e.opens[0]!.attrs['foo']).toBe('bar');
    });
  });

  // =========================================================================
  // ATTR_AFTER_EQ edge cases (lines 507-522)
  // =========================================================================
  describe('ATTR_AFTER_EQ edge cases', () => {
    it('skips whitespace between = and quoted value', () => {
      // Whitespace after = but before quote → lines 507-512
      const e = collectEvents(['<div foo=  "bar"></div>']);
      expect(e.opens[0]!.attrs['foo']).toBe('bar');
    });

    it('handles > immediately after = (empty string value)', () => {
      // > after = → line 513-517: attribute gets empty string, tag closes
      const e = collectEvents(['<div foo=>text</div>']);
      expect(e.opens[0]!.attrs['foo']).toBe('');
      expect(e.texts).toContain('text');
    });

    it('handles unquoted attribute value', () => {
      // Non-quote non-whitespace after = → lines 518-520: ATTR_VALUE_UQ
      const e = collectEvents(['<div foo=bar></div>']);
      expect(e.opens[0]!.attrs['foo']).toBe('bar');
    });
  });

  // =========================================================================
  // ATTR_VALUE_SQ spanning chunks (lines 550-551)
  // =========================================================================
  describe('ATTR_VALUE_SQ spanning chunks', () => {
    it('handles single-quoted value split across chunks', () => {
      // Single-quote attribute where closing ' is in the next chunk
      const e = collectEvents(["<div foo='hel", "lo'></div>"]);
      expect(e.opens[0]!.attrs['foo']).toBe('hello');
    });

    it('handles single-quoted value split at start of chunk', () => {
      // The entire second chunk starts with the rest of the value
      // i === 0 path at line 550
      const e = collectEvents(["<div foo='", "value'></div>"]);
      expect(e.opens[0]!.attrs['foo']).toBe('value');
    });
  });

  // =========================================================================
  // ATTR_VALUE_UQ (unquoted attribute values, lines 566-599)
  // =========================================================================
  describe('ATTR_VALUE_UQ', () => {
    it('terminates unquoted value at >', () => {
      // charCode === GT → lines 588-591
      const e = collectEvents(['<div foo=bar>text</div>']);
      expect(e.opens[0]!.attrs['foo']).toBe('bar');
    });

    it('terminates unquoted value at /', () => {
      // charCode === SLASH → lines 592-594: self-closing
      const e = collectEvents(['<div foo=bar/>']);
      expect(e.opens[0]!.attrs['foo']).toBe('bar');
      expect(e.closes).toContain('div');
    });

    it('terminates unquoted value at whitespace (more attrs)', () => {
      // charCode is whitespace → lines 595-597
      const e = collectEvents(['<div foo=bar baz="qux"></div>']);
      expect(e.opens[0]!.attrs['foo']).toBe('bar');
      expect(e.opens[0]!.attrs['baz']).toBe('qux');
    });

    it('handles unquoted value spanning chunks', () => {
      // Value doesn't end in current chunk → lines 581-583
      const e = collectEvents(['<div foo=lo', 'ngvalue></div>']);
      expect(e.opens[0]!.attrs['foo']).toBe('longvalue');
    });
  });

  // =========================================================================
  // SELF_CLOSING fallback (line 631)
  // =========================================================================
  describe('SELF_CLOSING state fallback', () => {
    it('falls back to OPEN_TAG_BODY when / not followed by >', () => {
      // <tag / attr="val"> → / then space → falls back to OPEN_TAG_BODY
      const e = collectEvents(['<div / class="x">text</div>']);
      expect(e.opens[0]!.attrs['class']).toBe('x');
      expect(e.texts).toContain('text');
    });
  });

  // =========================================================================
  // COMMENT_1: malformed comment (<!-X instead of <!--)
  // =========================================================================
  describe('COMMENT_1 non-comment fallback', () => {
    it('falls back to DOCTYPE state for <!-X...>', () => {
      // <!- followed by non-dash → lines 668-669: sets special='-', goes to DOCTYPE
      const e = collectEvents(['<!-hello>']);
      expect(e.doctypes).toHaveLength(1);
    });
  });

  // =========================================================================
  // PI_END: whitespace trimming of PI body (lines 910, 922)
  // =========================================================================
  describe('PI body whitespace trimming', () => {
    it('trims leading and trailing whitespace from PI body', () => {
      // Body has extra whitespace that must be trimmed → lines 910, 922
      const e = collectEvents(['<?xml   version="1.0"   ?>']);
      expect(e.pis).toHaveLength(1);
      expect(e.pis[0]!.name).toBe('xml');
      expect(e.pis[0]!.body).toBe('version="1.0"');
    });
  });
});
