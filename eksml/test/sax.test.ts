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

  it('multiple instances do not share state', () => {
    const tags1: string[] = [];
    const tags2: string[] = [];

    const sax1 = createSaxParser();
    const sax2 = createSaxParser();

    sax1.on('openTag', (name) => tags1.push(name));
    sax2.on('openTag', (name) => tags2.push(name));

    // Interleave writes to both parsers
    sax1.write('<root>');
    sax2.write('<doc>');
    sax1.write('<a/>');
    sax2.write('<b/>');
    sax1.write('</root>');
    sax2.write('<c/>');
    sax2.write('</doc>');

    sax1.close();
    sax2.close();

    expect(tags1).toEqual(['root', 'a']);
    expect(tags2).toEqual(['doc', 'b', 'c']);
  });

  it('multiple instances have independent event listeners', () => {
    const sax1 = createSaxParser();
    const sax2 = createSaxParser();
    const texts1: string[] = [];
    const texts2: string[] = [];

    sax1.on('text', (t) => texts1.push(t));
    sax2.on('text', (t) => texts2.push(t));

    sax1.write('<a>one</a>');
    sax2.write('<b>two</b>');
    sax1.close();
    sax2.close();

    expect(texts1).toEqual(['one']);
    expect(texts2).toEqual(['two']);
  });

  it('fires doctype events', () => {
    const sax = createSaxParser();
    const doctypes: Array<{
      tagName: string;
      attributes: Record<string, string | null>;
    }> = [];

    sax.on('doctype', (tagName, attributes) =>
      doctypes.push({ tagName, attributes: { ...attributes } }),
    );
    sax.write('<!DOCTYPE html><html></html>');
    sax.close();

    expect(doctypes).toHaveLength(1);
    expect(doctypes[0]!.tagName).toBe('!DOCTYPE');
    expect(doctypes[0]!.attributes).toHaveProperty('html');
  });

  it('multiple instances with different options', () => {
    const tags1: string[] = [];
    const texts1: string[] = [];
    const tags2: string[] = [];
    const texts2: string[] = [];

    const sax1 = createSaxParser({ rawContentTags: ['script'] });
    const sax2 = createSaxParser();

    sax1.on('openTag', (n) => tags1.push(n));
    sax1.on('text', (t) => texts1.push(t));
    sax2.on('openTag', (n) => tags2.push(n));
    sax2.on('text', (t) => texts2.push(t));

    // sax1 treats <script> as raw — inner <b> is text, not a tag
    sax1.write('<script><b>code</b></script>');
    // sax2 parses <script> normally — inner <b> is a tag
    sax2.write('<script><b>code</b></script>');

    sax1.close();
    sax2.close();

    expect(tags1).toEqual(['script']);
    expect(texts1).toEqual(['<b>code</b>']);

    expect(tags2).toEqual(['script', 'b']);
    expect(texts2).toEqual(['code']);
  });
});
