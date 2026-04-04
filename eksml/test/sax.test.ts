import { describe, it, expect } from 'vitest';
import { createSaxParser } from '#src/sax.ts';

// ---------------------------------------------------------------------------
// createSaxParser
// ---------------------------------------------------------------------------
describe('createSaxParser()', () => {
  it('fires opentag and closetag events', () => {
    const sax = createSaxParser();

    const openTags: string[] = [];
    const closeTags: string[] = [];

    sax.on('openTag', (name) => openTags.push(name));
    sax.on('closeTag', (name) => closeTags.push(name));

    sax.write('<root><item>hello</item></root>');
    sax.close();

    expect(openTags).toEqual(['root', 'item']);
    expect(closeTags).toEqual(['item', 'root']);
  });

  it('fires text events', () => {
    const sax = createSaxParser();
    const texts: string[] = [];

    sax.on('text', (text) => texts.push(text));
    sax.write('<root>hello world</root>');
    sax.close();

    expect(texts).toEqual(['hello world']);
  });

  it('fires opentag with attributes', () => {
    const sax = createSaxParser();
    const attrs: Record<string, string | null>[] = [];

    sax.on('openTag', (_name, attributes) => attrs.push({ ...attributes }));
    sax.write('<root id="1" class="main">text</root>');
    sax.close();

    expect(attrs[0]).toEqual({ id: '1', class: 'main' });
  });

  it('fires comment events', () => {
    const sax = createSaxParser();
    const comments: string[] = [];

    sax.on('comment', (c) => comments.push(c));
    sax.write('<root><!-- hello --></root>');
    sax.close();

    expect(comments).toHaveLength(1);
    expect(comments[0]).toContain('hello');
  });

  it('fires cdata events', () => {
    const sax = createSaxParser();
    const cdatas: string[] = [];

    sax.on('cdata', (data) => cdatas.push(data));
    sax.write('<root><![CDATA[raw <content>]]></root>');
    sax.close();

    expect(cdatas).toEqual(['raw <content>']);
  });

  it('fires processinginstruction events', () => {
    const sax = createSaxParser();
    const pis: Array<{ name: string; body: string }> = [];

    sax.on('processingInstruction', (name, body) => pis.push({ name, body }));
    sax.write('<?xml version="1.0"?><root/>');
    sax.close();

    expect(pis).toHaveLength(1);
    expect(pis[0]!.name).toBe('xml');
  });

  it('supports .off() to remove handlers', () => {
    const sax = createSaxParser();
    const tags: string[] = [];

    const handler = (name: string) => tags.push(name);
    sax.on('openTag', handler);

    sax.write('<a>');
    sax.off('openTag', handler);
    sax.write('<b>');
    sax.close();

    // Only "a" should be captured — handler was removed before "b"
    expect(tags).toEqual(['a']);
  });

  it('supports multiple handlers for the same event', () => {
    const sax = createSaxParser();
    const log1: string[] = [];
    const log2: string[] = [];

    sax.on('openTag', (name) => log1.push(name));
    sax.on('openTag', (name) => log2.push(name));
    sax.write('<root/>');
    sax.close();

    expect(log1).toEqual(['root']);
    expect(log2).toEqual(['root']);
  });

  it('respects selfClosingTags from html mode', () => {
    const sax = createSaxParser({ html: true });
    const open: string[] = [];
    const close: string[] = [];

    sax.on('openTag', (n) => open.push(n));
    sax.on('closeTag', (n) => close.push(n));
    sax.write('<div><br><p>text</p></div>');
    sax.close();

    expect(open).toEqual(['div', 'br', 'p']);
    // br should self-close
    expect(close).toContain('br');
  });

  it('handles chunked input', () => {
    const sax = createSaxParser();
    const tags: string[] = [];

    sax.on('openTag', (name) => tags.push(name));
    sax.write('<roo');
    sax.write('t><ite');
    sax.write('m>hello</item></root>');
    sax.close();

    expect(tags).toEqual(['root', 'item']);
  });
});
