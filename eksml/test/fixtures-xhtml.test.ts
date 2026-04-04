import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parse, type TNode } from '#src/parser.ts';
import { filter } from '#src/utilities/filter.ts';
import { toContentString } from '#src/utilities/toContentString.ts';
import { getElementById } from '#src/utilities/getElementById.ts';
import { getElementsByClassName } from '#src/utilities/getElementsByClassName.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8');

const xhtmlPage = fixture('xhtml-page.xml');

// =================================================================
// Complex fixture tests — XHTML page
// =================================================================
describe('fixture: xhtml-page.xml', () => {
  it('parses without error', () => {
    const result = parse(xhtmlPage);
    expect(result.length).toBeGreaterThan(0);
  });

  it('finds doctype and html root', () => {
    const result = parse(xhtmlPage);
    const doctype = result.find(
      (n) => typeof n === 'object' && n.tagName === '!DOCTYPE',
    ) as TNode;
    expect(doctype).toBeDefined();
    expect(doctype.attributes!.html).toBe(null);

    const html = result.find(
      (n) => typeof n === 'object' && n.tagName === 'html',
    ) as TNode;
    expect(html).toBeDefined();
    expect(html.attributes!.xmlns).toBe('http://www.w3.org/1999/xhtml');
    expect(html.attributes!['xml:lang']).toBe('en');
  });

  it('finds head with meta, title, link, and style elements', () => {
    const result = parse(xhtmlPage);
    const html = result.find(
      (n) => typeof n === 'object' && n.tagName === 'html',
    ) as TNode;
    const head = html.children.find(
      (c) => typeof c === 'object' && c.tagName === 'head',
    ) as TNode;
    expect(head).toBeDefined();

    const metas = head.children.filter(
      (c) => typeof c === 'object' && c.tagName === 'meta',
    ) as TNode[];
    expect(metas.length).toBeGreaterThanOrEqual(3);

    const title = head.children.find(
      (c) => typeof c === 'object' && c.tagName === 'title',
    ) as TNode;
    expect(title.children[0]).toContain('XHTML Fixture');

    const style = head.children.find(
      (c) => typeof c === 'object' && c.tagName === 'style',
    ) as TNode;
    expect(style).toBeDefined();
    // Style content should include the CSS with the <tag> comment
    const cssText = style.children
      .filter((c): c is string => typeof c === 'string')
      .join('');
    expect(cssText).toContain('box-sizing');
    expect(cssText).toContain('<tag>');
  });

  it('finds self-closing meta and link elements', () => {
    const result = parse(xhtmlPage, {
      selfClosingTags: ['meta', 'link', 'img', 'br', 'input', 'hr'],
    });
    const metas = filter(result, (n) => n.tagName === 'meta');
    for (const meta of metas) {
      expect(meta.children).toEqual([]);
    }
    const links = filter(result, (n) => n.tagName === 'link');
    for (const link of links) {
      expect(link.children).toEqual([]);
    }
  });

  it('preserves comments with keepComments', () => {
    const result = parse(xhtmlPage, { keepComments: true });
    // Collect all string children that are comments
    const allComments: string[] = [];
    function collectComments(nodes: (TNode | string)[]) {
      for (const node of nodes) {
        if (typeof node === 'string' && node.startsWith('<!--')) {
          allComments.push(node);
        } else if (typeof node === 'object') {
          collectComments(node.children);
        }
      }
    }
    collectComments(result);
    expect(allComments.length).toBeGreaterThanOrEqual(4);
    expect(allComments.some((c) => c.includes('Primary Navigation'))).toBe(
      true,
    );
    expect(allComments.some((c) => c.includes('Hero Section'))).toBe(true);
  });

  it('parses the feature comparison table', () => {
    const result = parse(xhtmlPage);
    const tables = filter(result, (n) => n.tagName === 'table');
    const featureTable = tables.find(
      (t) => t.attributes!.class === 'feature-table',
    );
    expect(featureTable).toBeDefined();

    const rows = filter(featureTable!.children, (n) => n.tagName === 'tr');
    // 1 header row + 5 data rows
    expect(rows).toHaveLength(6);

    const headerCells = filter(rows[0]!.children, (n) => n.tagName === 'th');
    expect(headerCells).toHaveLength(5);

    // Check data-supported attributes
    const dataCells = filter(featureTable!.children, (n) => n.tagName === 'td');
    const supportedCells = dataCells.filter(
      (c) => c.attributes?.['data-supported'] !== undefined,
    );
    expect(supportedCells.length).toBeGreaterThan(0);
  });

  it('parses deeply nested article with microdata', () => {
    const result = parse(xhtmlPage);
    const articles = filter(result, (n) => n.tagName === 'article');
    expect(articles.length).toBeGreaterThanOrEqual(1);
    const post = articles.find((a) => a.attributes!.class === 'blog-post');
    expect(post).toBeDefined();
    expect(post!.attributes!.itemscope).toBe(''); // XHTML boolean attribute (itemscope="")
    expect(post!.attributes!.itemtype).toBe('https://schema.org/BlogPosting');
  });

  it('parses definition list (dl/dt/dd)', () => {
    const result = parse(xhtmlPage);
    const dls = filter(result, (n) => n.tagName === 'dl');
    expect(dls).toHaveLength(1);
    const dts = filter(dls[0]!.children, (n) => n.tagName === 'dt');
    const dds = filter(dls[0]!.children, (n) => n.tagName === 'dd');
    expect(dts.length).toBeGreaterThanOrEqual(6);
    expect(dds.length).toBe(dts.length);
  });

  it('parses script elements with their content preserved', () => {
    const result = parse(xhtmlPage);
    const scripts = filter(result, (n) => n.tagName === 'script');
    expect(scripts.length).toBeGreaterThanOrEqual(2);
    // JSON-LD script
    const jsonLd = scripts.find(
      (s) => s.attributes!.type === 'application/ld+json',
    );
    expect(jsonLd).toBeDefined();
    const jsonContent = (jsonLd!.children[0] as string).trim();
    expect(() => JSON.parse(jsonContent)).not.toThrow();

    // JavaScript script
    const jsScript = scripts.find(
      (s) => s.attributes!.type === 'text/javascript',
    );
    expect(jsScript).toBeDefined();
    const jsText = jsScript!.children
      .filter((c): c is string => typeof c === 'string')
      .join('');
    expect(jsText).toContain('createElement');
  });

  it('parses the diagram figure with data-step attributes', () => {
    const result = parse(xhtmlPage);
    const stages = filter(
      result,
      (n) => n.tagName === 'div' && n.attributes!.class === 'stage',
    );
    expect(stages).toHaveLength(5);
    expect(stages.map((s) => s.attributes!['data-step'])).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
  });

  it('extracts full text content', () => {
    const result = parse(xhtmlPage);
    const content = toContentString(result);
    expect(content).toContain('Complex XHTML');
    expect(content).toContain('Getting Started');
    expect(content).toContain('Feature Comparison');
    expect(content).toContain('Understanding XML Parsing Internals');
    expect(content).toContain('Phase 1: Lexical Analysis');
  });

  it('getElementById finds elements by id', () => {
    const hero = getElementById(xhtmlPage, 'hero') as TNode;
    expect(hero).toBeDefined();
    expect(hero.tagName).toBe('header');
    expect(hero.attributes!.class).toBe('hero-section');

    const content = getElementById(xhtmlPage, 'content') as TNode;
    expect(content).toBeDefined();
    expect(content.tagName).toBe('main');
  });

  it('getElementsByClassName finds cards', () => {
    const cards = getElementsByClassName(xhtmlPage, 'card') as TNode[];
    expect(cards).toHaveLength(3);
    const ids = cards.map((c) => c.attributes!.id);
    expect(ids).toContain('card-install');
    expect(ids).toContain('card-usage');
    expect(ids).toContain('card-streaming');
  });
});
