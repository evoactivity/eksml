import { describe, it, expect } from 'vitest';
import { lossy } from '#src/converters/lossy.ts';
import type { LossyValue, LossyObject } from '#src/converters/lossy.ts';
import { fromLossy } from '#src/converters/fromLossy.ts';
import { write } from '#src/writer.ts';
import type { TNode } from '#src/parser.ts';

// =================================================================
// Direct construction — known lossy objects → expected TNode
// =================================================================
describe('direct construction', () => {
  it('null value → empty element', () => {
    const result = fromLossy({ root: null });
    expect(result).toEqual([
      { tagName: 'root', attributes: null, children: [] },
    ]);
  });

  it('string value → text-only element', () => {
    const result = fromLossy({ name: 'Alice' });
    expect(result).toEqual([
      { tagName: 'name', attributes: null, children: ['Alice'] },
    ]);
  });

  it('element-only children', () => {
    const result = fromLossy({ root: { a: '1', b: '2' } });
    expect(result).toEqual([
      {
        tagName: 'root',
        attributes: null,
        children: [
          { tagName: 'a', attributes: null, children: ['1'] },
          { tagName: 'b', attributes: null, children: ['2'] },
        ],
      },
    ]);
  });

  it('attributes with $ prefix', () => {
    const result = fromLossy({ img: { $src: 'a.png', $alt: 'pic' } });
    expect(result).toEqual([
      {
        tagName: 'img',
        attributes: { src: 'a.png', alt: 'pic' },
        children: [],
      },
    ]);
  });

  it('boolean attribute (null value)', () => {
    const result = fromLossy({ input: { $disabled: null } });
    expect(result).toEqual([
      {
        tagName: 'input',
        attributes: { disabled: null },
        children: [],
      },
    ]);
  });

  it('attributes + element children', () => {
    const result = fromLossy({
      root: { $lang: 'en', a: '1', b: '2' },
    });
    expect(result).toEqual([
      {
        tagName: 'root',
        attributes: { lang: 'en' },
        children: [
          { tagName: 'a', attributes: null, children: ['1'] },
          { tagName: 'b', attributes: null, children: ['2'] },
        ],
      },
    ]);
  });

  it('mixed content with $$ array', () => {
    const result = fromLossy({
      p: { $$: ['Hello ', { b: 'world' }, ' end'] },
    });
    expect(result).toEqual([
      {
        tagName: 'p',
        attributes: null,
        children: [
          'Hello ',
          { tagName: 'b', attributes: null, children: ['world'] },
          ' end',
        ],
      },
    ]);
  });

  it('attributes + mixed content', () => {
    const result = fromLossy({
      a: { $href: '/', $$: ['link text'] },
    });
    expect(result).toEqual([
      {
        tagName: 'a',
        attributes: { href: '/' },
        children: ['link text'],
      },
    ]);
  });

  it('repeated siblings (array)', () => {
    const result = fromLossy({
      list: { item: ['A', 'B', 'C'] },
    });
    expect(result).toEqual([
      {
        tagName: 'list',
        attributes: null,
        children: [
          { tagName: 'item', attributes: null, children: ['A'] },
          { tagName: 'item', attributes: null, children: ['B'] },
          { tagName: 'item', attributes: null, children: ['C'] },
        ],
      },
    ]);
  });

  it('repeated complex elements', () => {
    const result = fromLossy({
      root: {
        x: [
          { $id: '1', y: 'a' },
          { $id: '2', y: 'b' },
        ],
      },
    });
    expect(result).toEqual([
      {
        tagName: 'root',
        attributes: null,
        children: [
          {
            tagName: 'x',
            attributes: { id: '1' },
            children: [{ tagName: 'y', attributes: null, children: ['a'] }],
          },
          {
            tagName: 'x',
            attributes: { id: '2' },
            children: [{ tagName: 'y', attributes: null, children: ['b'] }],
          },
        ],
      },
    ]);
  });

  it('deep nesting', () => {
    const result = fromLossy({ a: { b: { c: { d: 'deep' } } } });
    expect(result).toEqual([
      {
        tagName: 'a',
        attributes: null,
        children: [
          {
            tagName: 'b',
            attributes: null,
            children: [
              {
                tagName: 'c',
                attributes: null,
                children: [
                  {
                    tagName: 'd',
                    attributes: null,
                    children: ['deep'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });
});

// =================================================================
// Top-level handling
// =================================================================
describe('top-level handling', () => {
  it('single root object', () => {
    const result = fromLossy({ root: null });
    expect(result).toHaveLength(1);
    expect((result[0] as TNode).tagName).toBe('root');
  });

  it('multiple roots (array)', () => {
    const result = fromLossy([{ a: '1' }, { b: '2' }]);
    expect(result).toHaveLength(2);
    expect((result[0] as TNode).tagName).toBe('a');
    expect((result[1] as TNode).tagName).toBe('b');
  });

  it('bare string', () => {
    const result = fromLossy('just text');
    expect(result).toEqual(['just text']);
  });

  it('null input', () => {
    const result = fromLossy(null);
    expect(result).toEqual([]);
  });

  it('string in top-level array', () => {
    const result = fromLossy(['hello' as unknown as LossyValue]);
    expect(result).toEqual(['hello']);
  });
});

// =================================================================
// Round-trip: XML → lossy → fromLossy → writer → lossy → compare
// =================================================================
describe('lossy round-trip through writer', () => {
  it('simple element', () => {
    const xml = '<root><a>1</a><b>2</b></root>';
    const original = lossy(xml);
    const dom = fromLossy(original);
    const rewritten = write(dom);
    const roundTripped = lossy(rewritten);
    expect(roundTripped).toEqual(original);
  });

  it('text-only element', () => {
    const xml = '<name>Alice</name>';
    const original = lossy(xml);
    const dom = fromLossy(original);
    const rewritten = write(dom);
    const roundTripped = lossy(rewritten);
    expect(roundTripped).toEqual(original);
  });

  it('element with attributes', () => {
    const xml = '<div id="main" class="wide"><p>text</p></div>';
    const original = lossy(xml);
    const dom = fromLossy(original);
    const rewritten = write(dom);
    const roundTripped = lossy(rewritten);
    expect(roundTripped).toEqual(original);
  });

  it('mixed content', () => {
    const xml = '<p>Hello <b>world</b> end</p>';
    const original = lossy(xml);
    const dom = fromLossy(original);
    const rewritten = write(dom);
    const roundTripped = lossy(rewritten);
    expect(roundTripped).toEqual(original);
  });

  it('repeated siblings', () => {
    const xml = '<list><item>A</item><item>B</item><item>C</item></list>';
    const original = lossy(xml);
    const dom = fromLossy(original);
    const rewritten = write(dom);
    const roundTripped = lossy(rewritten);
    expect(roundTripped).toEqual(original);
  });

  it('empty element', () => {
    const xml = '<root><br/></root>';
    const original = lossy(xml);
    const dom = fromLossy(original);
    const rewritten = write(dom);
    const roundTripped = lossy(rewritten);
    expect(roundTripped).toEqual(original);
  });

  it('attributes with empty string values', () => {
    const xml = '<input value=""/>';
    const original = lossy(xml);
    const dom = fromLossy(original);
    const rewritten = write(dom);
    const roundTripped = lossy(rewritten);
    expect(roundTripped).toEqual(original);
  });
});

// =================================================================
// Writer integration — produces valid XML
// =================================================================
describe('writer integration', () => {
  it('produces valid XML from simple lossy object', () => {
    const dom = fromLossy({ root: { a: '1', b: '2' } });
    const xml = write(dom);
    expect(xml).toBe('<root><a>1</a><b>2</b></root>');
  });

  it('produces valid XML with attributes', () => {
    const dom = fromLossy({ img: { $src: 'a.png', $alt: 'pic' } });
    const xml = write(dom);
    expect(xml).toBe('<img src="a.png" alt="pic"></img>');
  });

  it('produces valid XML with mixed content', () => {
    const dom = fromLossy({
      p: { $$: ['Hello ', { b: 'world' }] },
    });
    const xml = write(dom);
    expect(xml).toBe('<p>Hello <b>world</b></p>');
  });

  it('produces valid XML with repeated elements', () => {
    const dom = fromLossy({
      list: { item: ['A', 'B'] },
    });
    const xml = write(dom);
    expect(xml).toBe('<list><item>A</item><item>B</item></list>');
  });
});

// =================================================================
// JSON deserialization — fromLossy works on JSON.parse'd data
// =================================================================
describe('JSON deserialization', () => {
  it("works on JSON.parse'd lossy data", () => {
    const xml = '<root id="1"><a>text</a><b><c>deep</c></b></root>';
    const original = lossy(xml);
    const json = JSON.stringify(original);
    const parsed = JSON.parse(json);
    const dom = fromLossy(parsed);
    const rewritten = write(dom);
    const roundTripped = lossy(rewritten);
    expect(roundTripped).toEqual(original);
  });
});

// =================================================================
// Edge cases
// =================================================================
describe('edge cases', () => {
  it('empty object value → element with no children', () => {
    const result = fromLossy({ root: {} as LossyObject });
    expect(result).toEqual([
      { tagName: 'root', attributes: null, children: [] },
    ]);
  });

  it('nested null elements', () => {
    const result = fromLossy({ root: { br: [null, null, null] } });
    expect(result).toEqual([
      {
        tagName: 'root',
        attributes: null,
        children: [
          { tagName: 'br', attributes: null, children: [] },
          { tagName: 'br', attributes: null, children: [] },
          { tagName: 'br', attributes: null, children: [] },
        ],
      },
    ]);
  });

  it('mixed repeated and unique siblings', () => {
    // Note: lossy loses interleaving order between different tags,
    // so fromLossy just uses object key order
    const result = fromLossy({
      root: { a: ['1', '2'], b: 'X' },
    });
    expect(result).toEqual([
      {
        tagName: 'root',
        attributes: null,
        children: [
          { tagName: 'a', attributes: null, children: ['1'] },
          { tagName: 'a', attributes: null, children: ['2'] },
          { tagName: 'b', attributes: null, children: ['X'] },
        ],
      },
    ]);
  });

  it('null in top-level array is skipped', () => {
    const result = fromLossy([
      null as unknown as LossyValue,
      { a: 'text' },
    ]);
    expect(result).toHaveLength(1);
    expect((result[0] as TNode).tagName).toBe('a');
  });

  it('array value passed directly to convertElement uses first item', () => {
    // When a value is an array (e.g. from malformed lossy input),
    // convertElement treats it defensively by using the first item
    const result = fromLossy({
      root: { item: [['nested'] as unknown as LossyValue] },
    });
    // The array ['nested'] gets passed to convertElement, which calls
    // convertElement(tagName, value[0]) -> convertElement('item', 'nested')
    expect(result).toHaveLength(1);
    const root = result[0] as TNode;
    expect(root.children).toHaveLength(1);
    const item = root.children[0] as TNode;
    expect(item.tagName).toBe('item');
    expect(item.children).toEqual(['nested']);
  });
});
