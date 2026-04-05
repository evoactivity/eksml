import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parse, type TNode } from '#src/parser.ts';
import { filter } from '#src/utilities/filter.ts';
import { write } from '#src/writer.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8');

const commentedSvg = fixture('commented.svg');
const wordpadDocxDocument = fixture('wordpad.docx.document.xml');

describe('parse', () => {
  it('returns empty array for empty string', () => {
    expect(Array.isArray(parse(''))).toBe(true);
    expect(parse('')).toEqual([]);
  });

  it('simplest parsing test', () => {
    expect(parse('<test>')).toEqual([
      { tagName: 'test', attributes: null, children: [] },
    ]);
  });

  it('single attribute', () => {
    expect(parse('<test att="v">')).toEqual([
      { tagName: 'test', attributes: { att: 'v' }, children: [] },
    ]);
  });

  it('multiple attributes', () => {
    expect(parse('<test att="v" att2="two">')).toEqual([
      { tagName: 'test', attributes: { att: 'v', att2: 'two' }, children: [] },
    ]);
  });

  it('single text node', () => {
    expect(parse('childTest')).toEqual(['childTest']);
  });

  it('single child text', () => {
    expect(parse('<test>childTest')).toEqual([
      { tagName: 'test', attributes: null, children: ['childTest'] },
    ]);
  });

  it('simple closing tag', () => {
    expect(parse('<test></test>')).toEqual([
      { tagName: 'test', attributes: null, children: [] },
    ]);
  });

  it('two child nodes', () => {
    expect(parse('<test><cc></cc><cc></cc></test>')).toEqual([
      {
        tagName: 'test',
        attributes: null,
        children: [
          { tagName: 'cc', attributes: null, children: [] },
          { tagName: 'cc', attributes: null, children: [] },
        ],
      },
    ]);
  });

  it('ignores comments by default', () => {
    expect(
      parse(
        '<!-- some comment --><test><cc c="d"><!-- some comment --></cc><!-- some comment --><cc>value<!-- some comment --></cc></test>',
      ),
    ).toEqual([
      {
        tagName: 'test',
        attributes: null,
        children: [
          { tagName: 'cc', children: [], attributes: { c: 'd' } },
          { tagName: 'cc', attributes: null, children: ['value'] },
        ],
      },
    ]);
  });

  it('parses doctype declaration as TNode', () => {
    expect(parse('<!DOCTYPE html><test><cc></cc><cc></cc></test>')).toEqual([
      {
        tagName: '!DOCTYPE',
        attributes: { html: null },
        children: [],
      },
      {
        tagName: 'test',
        attributes: null,
        children: [
          { tagName: 'cc', attributes: null, children: [] },
          { tagName: 'cc', attributes: null, children: [] },
        ],
      },
    ]);
  });

  it('filter option', () => {
    expect(
      parse('<test><cc></cc><cc></cc></test>', {
        filter: (element) => element.tagName.toLowerCase() === 'cc',
      }),
    ).toEqual([
      { tagName: 'cc', attributes: null, children: [] },
      { tagName: 'cc', attributes: null, children: [] },
    ]);
  });

  it('CSS with CDATA inside style (valid XML)', () => {
    expect(
      parse(
        '<test><style><![CDATA[*{some:10px;}/* <tag> comment */]]></style></test>',
      ),
    ).toEqual([
      {
        tagName: 'test',
        attributes: null,
        children: [
          {
            tagName: 'style',
            attributes: null,
            children: ['*{some:10px;}/* <tag> comment */'],
          },
        ],
      },
    ]);
  });

  it('does not cut off last character in style', () => {
    expect(parse('<style>p { color: "red" }</style>')).toEqual([
      {
        tagName: 'style',
        attributes: null,
        children: ['p { color: "red" }'],
      },
    ]);
  });

  it('JavaScript with CDATA inside script (valid XML)', () => {
    expect(
      parse('<test><script><![CDATA[$("<div>")]]></script></test>'),
    ).toEqual([
      {
        tagName: 'test',
        attributes: null,
        children: [
          {
            tagName: 'script',
            attributes: null,
            children: ['$("<div>")'],
          },
        ],
      },
    ]);
  });

  it('attribute without value', () => {
    const s = '<test><something flag></something></test>';
    expect(write(parse(s))).toBe(s);
  });

  it('CDATA', () => {
    expect(parse('<xml><![CDATA[some data]]></xml>')).toEqual([
      { tagName: 'xml', attributes: null, children: ['some data'] },
    ]);
  });

  it('standalone CDATA', () => {
    expect(parse('<![CDATA[nothing]]>')).toEqual(['nothing']);
  });

  it('unclosed CDATA', () => {
    expect(parse('<![CDATA[nothing')).toEqual(['nothing']);
  });

  it('keepComments option', () => {
    expect(parse('<test><!-- test --></test>', { keepComments: true })).toEqual(
      [{ tagName: 'test', attributes: null, children: ['<!-- test -->'] }],
    );
  });

  it('keeps two comments', () => {
    expect(
      parse('<test><!-- test --><!-- test2 --></test>', {
        keepComments: true,
      }),
    ).toEqual([
      {
        tagName: 'test',
        attributes: null,
        children: ['<!-- test -->', '<!-- test2 -->'],
      },
    ]);
  });

  it('throws on wrong close tag', () => {
    expect(() => {
      parse('<user><name>robert</firstName><user>');
    }).toThrow();
  });

  it('throws when close tag is a superstring of the open tag', () => {
    expect(() => {
      parse('<foo>text</foobar>');
    }).toThrow();
  });

  it('throws when close tag is a superstring of the open tag (nested)', () => {
    expect(() => {
      parse('<root><foo>text</foobar></root>');
    }).toThrow();
  });

  it('handles close tags with trailing whitespace', () => {
    expect(parse('<foo>text</foo >')).toEqual([
      { tagName: 'foo', attributes: null, children: ['text'] },
    ]);
  });

  it('SVG with comment', () => {
    expect(parse(commentedSvg, { trimWhitespace: true })).toEqual([
      {
        tagName: '?xml',
        attributes: { version: '1.0', encoding: 'UTF-8' },
        children: [],
      },
      {
        tagName: 'svg',
        attributes: { height: '200', width: '500' },
        children: [
          {
            tagName: 'polyline',
            attributes: {
              points: '20,20 40,25 60,40 80,120 120,140 200,180',
              style: 'fill:none;stroke:black;stroke-width:3',
            },
            children: [],
          },
        ],
      },
    ]);
  });

  it('preserves whitespace in text nodes by default', () => {
    const filtered = filter(
      parse(wordpadDocxDocument),
      (n) => n.tagName === 'w:t',
    );
    expect(filtered[1]!.children[0]).toBe('    ');
  });

  it('trimWhitespace option trims and discards whitespace-only text nodes', () => {
    const filtered = filter(
      parse(wordpadDocxDocument, { trimWhitespace: true }),
      (n) => n.tagName === 'w:t',
    );
    // The whitespace-only "    " child should be discarded
    expect(filtered[1]!.children).toEqual([]);
  });

  it('arbitrary text / lorem ipsum', () => {
    const loremIpsum =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
    expect(parse(loremIpsum)).toEqual([loremIpsum]);
  });

  it('mixed text with XML fragments', () => {
    const result = parse('Some text before <tag>content</tag> and after');
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('Some text before ');
    expect((result[1] as TNode).tagName).toBe('tag');
    expect(result[2]).toBe(' and after');
  });

  it('duplicate attributes (last wins)', () => {
    const result = parse('<test att="first" att="second" att="third">');
    expect((result[0] as TNode).attributes!.att).toBe('third');
  });

  it('many attributes', () => {
    const result = parse(
      '<element id="test-id" class="cls" data-value="123" disabled aria-label="lbl" tabindex="0" role="button">',
    );
    const el = result[0] as TNode;
    expect(el.attributes!.id).toBe('test-id');
    expect(el.attributes!.class).toBe('cls');
    expect(el.attributes!['data-value']).toBe('123');
    expect(el.attributes!.disabled).toBeNull();
    expect(el.attributes!['aria-label']).toBe('lbl');
    expect(el.attributes!.tabindex).toBe('0');
    expect(el.attributes!.role).toBe('button');
  });

  it('XML with namespaces', () => {
    const xml =
      '<root xmlns:custom="http://example.com/custom"><custom:element custom:attr="value">Content</custom:element></root>';
    const result = parse(xml);
    const root = result[0] as TNode;
    expect(root.attributes!['xmlns:custom']).toBe('http://example.com/custom');
    const child = root.children.find(
      (el) => typeof el === 'object' && el.tagName === 'custom:element',
    ) as TNode;
    expect(child).toBeDefined();
    expect(child.attributes!['custom:attr']).toBe('value');
  });

  it('deeply nested structure', () => {
    const depth = 50;
    const openTags = Array.from({ length: depth }, (_, i) => `<l${i}>`).join(
      '',
    );
    const closeTags = Array.from(
      { length: depth },
      (_, i) => `</l${depth - 1 - i}>`,
    ).join('');
    const result = parse(openTags + 'deep' + closeTags);
    expect(result).toHaveLength(1);
    let cur = result[0] as TNode;
    for (let i = 1; i < depth; i++) {
      expect(cur.children).toHaveLength(1);
      cur = cur.children[0] as TNode;
      expect(cur.tagName).toBe(`l${i}`);
    }
    expect(cur.children[0]).toBe('deep');
  });

  it('self-closing tags (explicit slash)', () => {
    const result = parse('<root><empty></empty><sc/><sc2 /></root>');
    const root = result[0] as TNode;
    expect(root.children).toHaveLength(3);
    for (const child of root.children) {
      expect((child as TNode).children).toEqual([]);
    }
  });

  it('mixed quoted attributes', () => {
    const result = parse(
      `<e single='v1' double="v2" mixed='has "q"' other="has 'q'"/>`,
    );
    const el = result[0] as TNode;
    expect(el.attributes!.single).toBe('v1');
    expect(el.attributes!.double).toBe('v2');
    expect(el.attributes!.mixed).toBe('has "q"');
    expect(el.attributes!.other).toBe("has 'q'");
  });

  it('unicode and emoji', () => {
    const result = parse('<msg lang="多语言">Hello 世界 🌍</msg>');
    const el = result[0] as TNode;
    expect(el.attributes!.lang).toBe('多语言');
    expect(el.children[0]).toBe('Hello 世界 🌍');
  });

  it('processing instructions', () => {
    const result = parse(
      '<?xml version="1.0" encoding="UTF-8"?><root>content</root>',
    );
    const root = result.find(
      (el) => typeof el === 'object' && el.tagName === 'root',
    ) as TNode;
    expect(root).toBeDefined();
    expect(root.children[0]).toBe('content');
  });

  it('HTML5 doctype', () => {
    const result = parse(
      '<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>',
    );
    const doctype = result[0] as TNode;
    expect(doctype.tagName).toBe('!DOCTYPE');
    expect(doctype.attributes).toEqual({ html: null });
    const html = result.find(
      (el) => typeof el === 'object' && el.tagName === 'html',
    ) as TNode;
    expect(html).toBeDefined();
  });

  it('custom selfClosingTags option', () => {
    const result = parse('<div><custom></div>', {
      selfClosingTags: ['custom'],
    });
    const div = result[0] as TNode;
    const custom = div.children[0] as TNode;
    expect(custom.tagName).toBe('custom');
    expect(custom.children).toEqual([]);
  });

  it('null vs empty string vs value in attributes', () => {
    const result = parse('<input disabled required="" value="test" checked>');
    const el = result[0] as TNode;
    expect(el.attributes!.disabled).toBeNull();
    expect(el.attributes!.checked).toBeNull();
    expect(el.attributes!.required).toBe('');
    expect(el.attributes!.value).toBe('test');
  });

  it('handles deeply nested XML (5000 levels) without stack overflow', () => {
    const depth = 5000;
    const open = '<a>'.repeat(depth);
    const close = '</a>'.repeat(depth);
    const xml = open + 'leaf' + close;
    const result = parse(xml);
    // Walk to the innermost node and verify structure
    let node = result[0] as TNode;
    for (let i = 1; i < depth; i++) {
      expect(node.tagName).toBe('a');
      node = node.children[0] as TNode;
    }
    expect(node.tagName).toBe('a');
    expect(node.children[0]).toBe('leaf');
  });

  // =========================================================================
  // Issue 6 — findElements regex matches attribute name suffixes
  // =========================================================================
  describe('findElements attribute matching (issue 6)', () => {
    it('does not match suffix of attribute name (id vs data-id)', () => {
      // Searching for attrName="id" attrValue="123" should NOT match data-id="123"
      const xml =
        '<root><item data-id="123">wrong</item><item id="123">right</item></root>';
      const result = parse(xml, { attrName: 'id', attrValue: '123' });
      expect(result).toHaveLength(1);
      expect((result[0] as TNode).tagName).toBe('item');
      expect((result[0] as TNode).children[0]).toBe('right');
    });

    it('does not match prefix of attribute name', () => {
      // Searching for attrName="class" should NOT match className="foo"
      const xml =
        '<root><item className="foo">wrong</item><item class="foo">right</item></root>';
      const result = parse(xml, { attrName: 'class', attrValue: 'foo' });
      expect(result).toHaveLength(1);
      expect((result[0] as TNode).tagName).toBe('item');
      expect((result[0] as TNode).children[0]).toBe('right');
    });

    it('matches exact attribute name correctly', () => {
      const xml = '<div id="test">found</div>';
      const result = parse(xml, { attrName: 'id', attrValue: 'test' });
      expect(result).toHaveLength(1);
      expect((result[0] as TNode).tagName).toBe('div');
    });

    it('matches attribute on the first attribute position', () => {
      // The regex uses \s before the attribute name, so the first attribute
      // (right after the tag name with just a space) should still match
      const xml = '<div id="x">found</div>';
      const result = parse(xml, { attrName: 'id', attrValue: 'x' });
      expect(result).toHaveLength(1);
    });
  });

  // =========================================================================
  // Issue 7 — findElements loop fragile with pos reuse
  // =========================================================================
  describe('findElements multiple matches (issue 7)', () => {
    it('finds multiple elements matching the same attribute', () => {
      const xml =
        '<root><a class="x">1</a><b>skip</b><c class="x">2</c></root>';
      const result = parse(xml, { attrName: 'class', attrValue: 'x' });
      expect(result).toHaveLength(2);
      expect((result[0] as TNode).tagName).toBe('a');
      expect((result[0] as TNode).children[0]).toBe('1');
      expect((result[1] as TNode).tagName).toBe('c');
      expect((result[1] as TNode).children[0]).toBe('2');
    });

    it('finds elements when matches are far apart in the document', () => {
      const filler = '<filler>' + 'x'.repeat(100) + '</filler>';
      const xml = `<root><a id="target">1</a>${filler}<b id="target">2</b>${filler}<c id="target">3</c></root>`;
      const result = parse(xml, { attrName: 'id', attrValue: 'target' });
      expect(result).toHaveLength(3);
      expect((result[0] as TNode).children[0]).toBe('1');
      expect((result[1] as TNode).children[0]).toBe('2');
      expect((result[2] as TNode).children[0]).toBe('3');
    });
  });

  // =========================================================================
  // Strict mode — error message content and line/column accuracy
  // =========================================================================
  describe('strict mode error messages', () => {
    it('unclosed tag includes tag name and line/column', () => {
      const xml = '<root><open>text';
      expect(() => parse(xml, { strict: true })).toThrow(
        /Unclosed tag <open>.*line 1.*column 17/,
      );
    });

    it('unclosed comment includes line/column', () => {
      const xml = '<root><!-- oops';
      expect(() => parse(xml, { strict: true })).toThrow(
        /Unclosed comment.*line 1.*column 7/,
      );
    });

    it('unclosed CDATA includes line/column', () => {
      const xml = '<root><![CDATA[oops';
      expect(() => parse(xml, { strict: true })).toThrow(
        /Unclosed CDATA.*line 1.*column 7/,
      );
    });

    it('unclosed close tag includes line/column', () => {
      const xml = '<root></root';
      expect(() => parse(xml, { strict: true })).toThrow(
        /Unclosed close tag.*line 1.*column 7/,
      );
    });

    it('mismatched close tag includes both tag names', () => {
      const xml = '<root><a>text</b></root>';
      expect(() => parse(xml, { strict: true })).toThrow(
        /Unexpected close tag <\/b>.*expected <\/a>/,
      );
    });

    it('reports correct line for multiline input', () => {
      const xml = '<root>\n  <child>\n    <!-- unclosed';
      expect(() => parse(xml, { strict: true })).toThrow(/line 3/);
    });

    it('reports correct column for multiline input', () => {
      const xml = '<root>\n  <child>\n    <open>text';
      expect(() => parse(xml, { strict: true })).toThrow(/line 3.*column 15/);
    });

    it('unclosed declaration includes line/column', () => {
      const xml = '<!DOCTYPE html';
      expect(() => parse(xml, { strict: true })).toThrow(
        /Unclosed declaration.*line 1/,
      );
    });
  });
});
