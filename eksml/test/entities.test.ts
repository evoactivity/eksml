import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parse, type TNode } from '#src/parser.ts';
import { createSaxParser, type SaxParserOptions } from '#src/sax.ts';
import {
  XmlParseStream,
  type XmlParseStreamOptions,
} from '#src/xmlParseStream.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Feed chunks through createSaxParser and record every event in order. */
function saxEvents(chunks: string[], options?: SaxParserOptions): unknown[] {
  const events: unknown[] = [];
  const sax = createSaxParser(options);
  sax.on('openTag', (name, attributes) =>
    events.push(['openTag', name, { ...attributes }]),
  );
  sax.on('closeTag', (name) => events.push(['closeTag', name]));
  sax.on('text', (text) => events.push(['text', text]));
  sax.on('cdata', (data) => events.push(['cdata', data]));
  for (const chunk of chunks) sax.write(chunk);
  sax.close();
  return events;
}

/** Build a TNode tree from SAX events, the same shape parse() produces. */
function saxTree(chunks: string[], options?: SaxParserOptions): TNode[] {
  const roots: TNode[] = [];
  const stack: TNode[] = [];
  const sax = createSaxParser(options);
  sax.on('openTag', (tagName, attributes) => {
    const node: TNode = {
      tagName,
      attributes: Object.keys(attributes).length ? attributes : null,
      children: [],
    };
    if (stack.length) stack[stack.length - 1]!.children.push(node);
    else roots.push(node);
    stack.push(node);
  });
  sax.on('closeTag', () => stack.pop());
  const onText = (text: string) => {
    if (stack.length) stack[stack.length - 1]!.children.push(text);
  };
  sax.on('text', onText);
  sax.on('cdata', onText);
  for (const chunk of chunks) sax.write(chunk);
  sax.close();
  return roots;
}

async function streamNodes(
  chunks: string[],
  options?: XmlParseStreamOptions,
): Promise<(TNode | string)[]> {
  const stream = new XmlParseStream(options ?? {});
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const results: (TNode | string)[] = [];
  const readAll = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      results.push(value);
    }
  })();
  for (const chunk of chunks) await writer.write(chunk);
  await writer.close();
  await readAll;
  return results;
}

/** Split a string into chunks of a fixed size. */
function chunked(input: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < input.length; i += size) {
    chunks.push(input.slice(i, i + size));
  }
  return chunks;
}

describe('entities option', () => {
  describe('createSaxParser()', () => {
    it('leaves entities as written by default', () => {
      expect(saxEvents(['<a t="x &amp; y">Tom &amp; Jerry</a>'])).toEqual([
        ['openTag', 'a', { t: 'x &amp; y' }],
        ['text', 'Tom &amp; Jerry'],
        ['closeTag', 'a'],
      ]);
    });

    it('decodes text and attribute values', () => {
      expect(
        saxEvents(
          ['<a t="&lt;b&gt; &quot;q&quot;">Tom &amp; Jerry &#228; &#xe4;</a>'],
          {
            entities: true,
          },
        ),
      ).toEqual([
        ['openTag', 'a', { t: '<b> "q"' }],
        ['text', 'Tom & Jerry ä ä'],
        ['closeTag', 'a'],
      ]);
    });

    it('decodes unquoted and single-quoted attribute values', () => {
      expect(
        saxEvents(["<a s='x &amp; y' u=a&amp;b/>"], { entities: true }),
      ).toEqual([
        ['openTag', 'a', { s: 'x & y', u: 'a&b' }],
        ['closeTag', 'a'],
      ]);
    });

    it('decodes an entity split across chunks', () => {
      expect(
        saxEvents(['<a t="x &am', 'p; y">Tom &a', 'mp; Jerry</a>'], {
          entities: true,
        }),
      ).toEqual([
        ['openTag', 'a', { t: 'x & y' }],
        ['text', 'Tom & Jerry'],
        ['closeTag', 'a'],
      ]);
    });

    it('never decodes CDATA', () => {
      expect(
        saxEvents(['<a><![CDATA[x &amp; y]]></a>'], { entities: true }),
      ).toEqual([
        ['openTag', 'a', {}],
        ['cdata', 'x &amp; y'],
        ['closeTag', 'a'],
      ]);
    });

    it('never decodes raw content', () => {
      expect(
        saxEvents(['<script>a &amp;&amp; b</script>'], {
          html: true,
          entities: true,
        }),
      ).toEqual([
        ['openTag', 'script', {}],
        ['text', 'a &amp;&amp; b'],
        ['closeTag', 'script'],
      ]);
    });

    it('decodes HTML named entities only in HTML mode', () => {
      expect(saxEvents(['<p>&copy; &amp;</p>'], { entities: true })).toEqual([
        ['openTag', 'p', {}],
        ['text', '&copy; &'],
        ['closeTag', 'p'],
      ]);
      expect(
        saxEvents(['<p>&copy; &amp;</p>'], { entities: true, html: true }),
      ).toEqual([
        ['openTag', 'p', {}],
        ['text', '© &'],
        ['closeTag', 'p'],
      ]);
    });

    it('trims text before decoding it', () => {
      expect(
        saxEvents(['<a> &#32;x&#32; </a><b>&#32;</b>'], { entities: true }),
      ).toEqual([
        ['openTag', 'a', {}],
        ['text', ' x '],
        ['closeTag', 'a'],
        ['openTag', 'b', {}],
        ['text', ' '],
        ['closeTag', 'b'],
      ]);
    });
  });

  describe('XmlParseStream', () => {
    it('leaves entities as written by default', async () => {
      expect(
        await streamNodes(['<a t="x &amp; y">Tom &amp; Jerry</a>']),
      ).toEqual([
        {
          tagName: 'a',
          attributes: { t: 'x &amp; y' },
          children: ['Tom &amp; Jerry'],
        },
      ]);
    });

    it('decodes text and attribute values', async () => {
      expect(
        await streamNodes(['<a t="x &amp; y">Tom &amp; Jerry</a>'], {
          entities: true,
        }),
      ).toEqual([
        { tagName: 'a', attributes: { t: 'x & y' }, children: ['Tom & Jerry'] },
      ]);
    });

    it('decodes inside selected subtrees split across chunks', async () => {
      expect(
        await streamNodes(
          [
            '<tv><programme channel="a&a',
            'mp;b"><title>Tom &am',
            'p; Jerry</title></programme></tv>',
          ],
          { entities: true, select: 'programme' },
        ),
      ).toEqual([
        {
          tagName: 'programme',
          attributes: { channel: 'a&b' },
          children: [
            { tagName: 'title', attributes: null, children: ['Tom & Jerry'] },
          ],
        },
      ]);
    });

    it('never decodes CDATA or raw content', async () => {
      expect(
        await streamNodes(
          ['<div><![CDATA[x &amp; y]]><script>a &amp;&amp; b</script></div>'],
          { entities: true, html: true },
        ),
      ).toEqual([
        {
          tagName: 'div',
          attributes: null,
          children: [
            'x &amp; y',
            {
              tagName: 'script',
              attributes: null,
              children: ['a &amp;&amp; b'],
            },
          ],
        },
      ]);
    });

    it('decodes before converting to lossy output', async () => {
      expect(
        await streamNodes(['<a>Tom &amp; Jerry</a>'], {
          entities: true,
          output: 'lossy',
        }),
      ).toEqual([{ a: 'Tom & Jerry' }]);
    });
  });

  describe('parse()', () => {
    it('trims text before decoding it', () => {
      expect(
        parse('<r><a> &#32;x&#32; </a><b>&#32;</b></r>', {
          entities: true,
          trimWhitespace: true,
        }),
      ).toEqual([
        {
          tagName: 'r',
          attributes: null,
          children: [
            { tagName: 'a', attributes: null, children: [' x '] },
            { tagName: 'b', attributes: null, children: [' '] },
          ],
        },
      ]);
    });

    it('treats encoded whitespace as text, not as whitespace to drop', () => {
      expect(parse('<r>\n  <a>&#32;</a>\n</r>', { entities: true })).toEqual([
        {
          tagName: 'r',
          attributes: null,
          children: [{ tagName: 'a', attributes: null, children: [' '] }],
        },
      ]);
    });

    it('decodes mixed content without trimming it', () => {
      expect(
        parse('<p>Tom &amp; <b>Jerry</b> &#228; </p>', { entities: true }),
      ).toEqual([
        {
          tagName: 'p',
          attributes: null,
          children: [
            'Tom & ',
            { tagName: 'b', attributes: null, children: ['Jerry'] },
            ' ä ',
          ],
        },
      ]);
    });
  });

  describe('createSaxParser() matches parse()', () => {
    const fixtures = readdirSync(resolve(__dirname, 'fixtures')).filter(
      (name) => name.endsWith('.xml'),
    );

    it.each(fixtures)('%s', (name) => {
      const xml = readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8');
      const elementsOnly = (nodes: (TNode | string)[]) =>
        nodes.filter((node): node is TNode => typeof node === 'object');
      const expected = elementsOnly(
        parse(xml, { entities: true, trimWhitespace: true }),
      ).filter(
        (node) =>
          !node.tagName.startsWith('?') && !node.tagName.startsWith('!'),
      );

      expect(saxTree([xml], { entities: true })).toEqual(expected);
      expect(saxTree(chunked(xml, 7), { entities: true })).toEqual(expected);
    });
  });
});
