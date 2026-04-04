import { describe, it, expect, vi } from 'vitest';
import { Eksml } from '#src/eksml.ts';
import type { TNode } from '#src/parser.ts';

// ---------------------------------------------------------------------------
// Constructor & defaults
// ---------------------------------------------------------------------------
describe('Eksml constructor', () => {
  it('creates an instance with no options', () => {
    const eksml = new Eksml();
    expect(eksml).toBeInstanceOf(Eksml);
  });

  it('creates an instance with options', () => {
    const eksml = new Eksml({ entities: true, html: true });
    expect(eksml).toBeInstanceOf(Eksml);
  });
});

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------
describe('Eksml.parse()', () => {
  it('parses a simple XML string', () => {
    const eksml = new Eksml();
    const result = eksml.parse('<root><item>hello</item></root>');
    expect(result).toHaveLength(1);
    const root = result[0] as TNode;
    expect(root.tagName).toBe('root');
    expect(root.children).toHaveLength(1);
    const item = root.children[0] as TNode;
    expect(item.tagName).toBe('item');
    expect(item.children).toEqual(['hello']);
  });

  it('applies constructor defaults', () => {
    const eksml = new Eksml({ trimWhitespace: true });
    const result = eksml.parse('<root>  <item>hello</item>  </root>');
    const root = result[0] as TNode;
    // trimWhitespace should remove whitespace-only text nodes
    expect(root.children).toHaveLength(1);
    expect((root.children[0] as TNode).tagName).toBe('item');
  });

  it('merges per-call overrides on top of defaults', () => {
    const eksml = new Eksml({ trimWhitespace: false });
    const result = eksml.parse('<root>  <item>hello</item>  </root>', {
      trimWhitespace: true,
    });
    const root = result[0] as TNode;
    expect(root.children).toHaveLength(1);
  });

  it('per-call overrides win over constructor defaults', () => {
    const eksml = new Eksml({ keepComments: true });
    const result = eksml.parse('<root><!-- comment --></root>', {
      keepComments: false,
    });
    const root = result[0] as TNode;
    expect(root.children).toHaveLength(0);
  });

  it('decodes entities when entities option is set in constructor', () => {
    const eksml = new Eksml({ entities: true });
    const result = eksml.parse('<root>&amp; &lt; &gt;</root>');
    const root = result[0] as TNode;
    expect(root.children[0]).toBe('& < >');
  });

  it('parses HTML void elements with html mode', () => {
    const eksml = new Eksml({ html: true });
    const result = eksml.parse('<div><br><hr><p>text</p></div>');
    const div = result[0] as TNode;
    expect(div.children).toHaveLength(3);
    expect((div.children[0] as TNode).tagName).toBe('br');
    expect((div.children[1] as TNode).tagName).toBe('hr');
    expect((div.children[2] as TNode).tagName).toBe('p');
  });

  it('works with strict mode from constructor', () => {
    const eksml = new Eksml({ strict: true });
    expect(() => eksml.parse('<root><unclosed>')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// write
// ---------------------------------------------------------------------------
describe('Eksml.write()', () => {
  it('serializes a TNode tree to XML', () => {
    const eksml = new Eksml();
    const node: TNode = {
      tagName: 'root',
      attributes: null,
      children: ['hello'],
    };
    expect(eksml.write(node)).toBe('<root>hello</root>');
  });

  it('serializes an array of nodes', () => {
    const eksml = new Eksml();
    const nodes: (TNode | string)[] = [
      { tagName: 'a', attributes: null, children: ['1'] },
      { tagName: 'b', attributes: null, children: ['2'] },
    ];
    expect(eksml.write(nodes)).toBe('<a>1</a><b>2</b>');
  });

  it('accepts write options per-call', () => {
    const eksml = new Eksml();
    const node: TNode = {
      tagName: 'root',
      attributes: null,
      children: [{ tagName: 'item', attributes: null, children: ['hello'] }],
    };
    const result = eksml.write(node, { pretty: true });
    expect(result).toContain('\n');
  });

  it('encodes entities when write entities option is set', () => {
    const eksml = new Eksml();
    const node: TNode = {
      tagName: 'root',
      attributes: null,
      children: ['a & b < c'],
    };
    expect(eksml.write(node, { entities: true })).toBe(
      '<root>a &amp; b &lt; c</root>',
    );
  });

  it('round-trips parse → write', () => {
    const eksml = new Eksml();
    const xml =
      '<root><item id="1">hello</item><item id="2">world</item></root>';
    const tree = eksml.parse(xml);
    const output = eksml.write(tree);
    expect(output).toBe(xml);
  });
});

// ---------------------------------------------------------------------------
// parse — lossy output mode
// ---------------------------------------------------------------------------
describe('Eksml.parse() with output: lossy', () => {
  it('converts simple XML to lossy object', () => {
    const eksml = new Eksml({ output: 'lossy' });
    const result = eksml.parse('<root><name>Alice</name><age>30</age></root>');
    expect(result).toEqual({ root: { name: 'Alice', age: '30' } });
  });

  it('applies constructor parse defaults to lossy conversion', () => {
    const eksml = new Eksml({ output: 'lossy', entities: true });
    const result = eksml.parse('<root><name>A &amp; B</name></root>');
    expect(result).toEqual({ root: { name: 'A & B' } });
  });

  it('applies per-call parse overrides to lossy conversion', () => {
    const eksml = new Eksml({ output: 'lossy' });
    const result = eksml.parse('<root><name>A &amp; B</name></root>', {
      entities: true,
    });
    expect(result).toEqual({ root: { name: 'A & B' } });
  });
});

// ---------------------------------------------------------------------------
// parse — lossless output mode
// ---------------------------------------------------------------------------
describe('Eksml.parse() with output: lossless', () => {
  it('converts to lossless format', () => {
    const eksml = new Eksml({ output: 'lossless' });
    const result = eksml.parse('<root><item>hello</item></root>');
    expect(result).toEqual([{ root: [{ item: [{ $text: 'hello' }] }] }]);
  });

  it('applies constructor parse defaults to lossless conversion', () => {
    const eksml = new Eksml({ output: 'lossless', entities: true });
    const result = eksml.parse('<root>&amp;</root>');
    expect(result).toEqual([{ root: [{ $text: '&' }] }]);
  });
});

// ---------------------------------------------------------------------------
// sax
// ---------------------------------------------------------------------------
describe('Eksml.sax()', () => {
  it('fires opentag and closetag events', () => {
    const eksml = new Eksml();
    const sax = eksml.sax();

    const openTags: string[] = [];
    const closeTags: string[] = [];

    sax.on('opentag', (name) => openTags.push(name));
    sax.on('closetag', (name) => closeTags.push(name));

    sax.write('<root><item>hello</item></root>');
    sax.close();

    expect(openTags).toEqual(['root', 'item']);
    expect(closeTags).toEqual(['item', 'root']);
  });

  it('fires text events', () => {
    const eksml = new Eksml();
    const sax = eksml.sax();
    const texts: string[] = [];

    sax.on('text', (text) => texts.push(text));
    sax.write('<root>hello world</root>');
    sax.close();

    expect(texts).toEqual(['hello world']);
  });

  it('fires opentag with attributes', () => {
    const eksml = new Eksml();
    const sax = eksml.sax();
    const attrs: Record<string, string | null>[] = [];

    sax.on('opentag', (_name, attributes) => attrs.push({ ...attributes }));
    sax.write('<root id="1" class="main">text</root>');
    sax.close();

    expect(attrs[0]).toEqual({ id: '1', class: 'main' });
  });

  it('fires comment events', () => {
    const eksml = new Eksml();
    const sax = eksml.sax();
    const comments: string[] = [];

    sax.on('comment', (c) => comments.push(c));
    sax.write('<root><!-- hello --></root>');
    sax.close();

    expect(comments).toHaveLength(1);
    expect(comments[0]).toContain('hello');
  });

  it('fires cdata events', () => {
    const eksml = new Eksml();
    const sax = eksml.sax();
    const cdatas: string[] = [];

    sax.on('cdata', (data) => cdatas.push(data));
    sax.write('<root><![CDATA[raw <content>]]></root>');
    sax.close();

    expect(cdatas).toEqual(['raw <content>']);
  });

  it('fires processinginstruction events', () => {
    const eksml = new Eksml();
    const sax = eksml.sax();
    const pis: Array<{ name: string; body: string }> = [];

    sax.on('processinginstruction', (name, body) => pis.push({ name, body }));
    sax.write('<?xml version="1.0"?><root/>');
    sax.close();

    expect(pis).toHaveLength(1);
    expect(pis[0]!.name).toBe('xml');
  });

  it('supports .off() to remove handlers', () => {
    const eksml = new Eksml();
    const sax = eksml.sax();
    const tags: string[] = [];

    const handler = (name: string) => tags.push(name);
    sax.on('opentag', handler);

    sax.write('<a>');
    sax.off('opentag', handler);
    sax.write('<b>');
    sax.close();

    // Only "a" should be captured — handler was removed before "b"
    expect(tags).toEqual(['a']);
  });

  it('supports multiple handlers for the same event', () => {
    const eksml = new Eksml();
    const sax = eksml.sax();
    const log1: string[] = [];
    const log2: string[] = [];

    sax.on('opentag', (name) => log1.push(name));
    sax.on('opentag', (name) => log2.push(name));
    sax.write('<root/>');
    sax.close();

    expect(log1).toEqual(['root']);
    expect(log2).toEqual(['root']);
  });

  it('respects selfClosingTags from constructor html mode', () => {
    const eksml = new Eksml({ html: true });
    const sax = eksml.sax();
    const open: string[] = [];
    const close: string[] = [];

    sax.on('opentag', (n) => open.push(n));
    sax.on('closetag', (n) => close.push(n));
    sax.write('<div><br><p>text</p></div>');
    sax.close();

    expect(open).toEqual(['div', 'br', 'p']);
    // br should self-close
    expect(close).toContain('br');
  });

  it('handles chunked input', () => {
    const eksml = new Eksml();
    const sax = eksml.sax();
    const tags: string[] = [];

    sax.on('opentag', (name) => tags.push(name));
    sax.write('<roo');
    sax.write('t><ite');
    sax.write('m>hello</item></root>');
    sax.close();

    expect(tags).toEqual(['root', 'item']);
  });
});

// ---------------------------------------------------------------------------
// stream
// ---------------------------------------------------------------------------
describe('Eksml.stream()', () => {
  it('returns a ReadableStream of parsed nodes', async () => {
    const eksml = new Eksml();
    const input = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('<root><item>hello</item></root>');
        controller.close();
      },
    });

    const output = eksml.stream(input);
    const reader = output.getReader();
    const nodes: (TNode | string)[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      nodes.push(value);
    }

    expect(nodes).toHaveLength(1);
    const root = nodes[0] as TNode;
    expect(root.tagName).toBe('root');
    expect((root.children[0] as TNode).children[0]).toBe('hello');
  });

  it('handles chunked stream input', async () => {
    const eksml = new Eksml();
    const chunks = ['<root>', '<item>he', 'llo</item>', '</root>'];
    const input = new ReadableStream<string>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const output = eksml.stream(input);
    const reader = output.getReader();
    const nodes: (TNode | string)[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      nodes.push(value);
    }

    expect(nodes).toHaveLength(1);
    const root = nodes[0] as TNode;
    expect(root.tagName).toBe('root');
  });

  it('applies constructor parse options to stream', async () => {
    const eksml = new Eksml({ html: true });
    const input = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('<div><br><p>text</p></div>');
        controller.close();
      },
    });

    const output = eksml.stream(input);
    const reader = output.getReader();
    const nodes: (TNode | string)[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      nodes.push(value);
    }

    const div = nodes[0] as TNode;
    expect(div.tagName).toBe('div');
    // br should be self-closing in HTML mode
    expect((div.children[0] as TNode).tagName).toBe('br');
    expect((div.children[1] as TNode).tagName).toBe('p');
  });

  it('applies per-call overrides to stream', async () => {
    const eksml = new Eksml();
    const input = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('<root><!-- comment --><item>text</item></root>');
        controller.close();
      },
    });

    const output = eksml.stream(input, { keepComments: true });
    const reader = output.getReader();
    const nodes: (TNode | string)[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      nodes.push(value);
    }

    const root = nodes[0] as TNode;
    // Should have 2 children: the comment string and the <item> node
    expect(root.children).toHaveLength(2);
  });
});
