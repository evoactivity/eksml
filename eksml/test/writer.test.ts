import { describe, it, expect } from 'vitest';
import { parse } from '#src/parser.ts';
import { write } from '#src/writer.ts';
import { lossy } from '#src/converters/lossy.ts';
import { lossless } from '#src/converters/lossless.ts';
import type { TNode } from '#src/parser.ts';
import type { LossyValue } from '#src/converters/lossy.ts';
import type { LosslessEntry } from '#src/converters/lossless.ts';

// =================================================================
// write
// =================================================================
describe('write', () => {
  it('roundtrips optimal XML', () => {
    const x = '<test a="value"><child a=\'g"g\'>text</child></test>';
    expect(write(parse(x))).toBe(x);
  });

  it('roundtrips attribute without value', () => {
    const s = '<test><something flag></something></test>';
    expect(write(parse(s))).toBe(s);
  });

  it('returns empty string for undefined', () => {
    expect(write(undefined as any)).toBe('');
  });

  it('stringifies a simple element', () => {
    expect(write({ tagName: 'div', attributes: {}, children: [] })).toBe(
      '<div></div>',
    );
  });

  it('stringifies nested elements', () => {
    expect(
      write({
        tagName: 'a',
        attributes: {},
        children: [{ tagName: 'b', attributes: {}, children: ['text'] }],
      }),
    ).toBe('<a><b>text</b></a>');
  });

  it('stringifies boolean attributes', () => {
    expect(
      write({
        tagName: 'input',
        attributes: { disabled: null },
        children: [],
      }),
    ).toBe('<input disabled></input>');
  });

  it('stringifies an array of nodes', () => {
    expect(
      write([
        { tagName: 'a', attributes: {}, children: [] },
        { tagName: 'b', attributes: {}, children: [] },
      ]),
    ).toBe('<a></a><b></b>');
  });

  it('stringifies processing instructions', () => {
    expect(
      write({
        tagName: '?xml',
        attributes: { version: '1.0' },
        children: [],
      }),
    ).toBe('<?xml version="1.0"?>');
  });

  // --- DOCTYPE declarations ---

  it('roundtrips simple HTML5 DOCTYPE', () => {
    const xml = '<!DOCTYPE html><html></html>';
    expect(write(parse(xml))).toBe(xml);
  });

  it('roundtrips DOCTYPE with quoted public and system identifiers', () => {
    const xml =
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">';
    expect(write(parse(xml))).toBe(xml);
  });

  it('roundtrips DOCTYPE with quoted identifiers in pretty mode', () => {
    const xml =
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';
    expect(write(parse(xml), { pretty: true })).toBe(xml);
  });

  it('roundtrips DOCTYPE with quoted identifiers in entities mode', () => {
    const xml =
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">';
    expect(write(parse(xml), { entities: true })).toBe(xml);
  });

  it('roundtrips DOCTYPE with SYSTEM identifier', () => {
    const xml = '<!DOCTYPE note SYSTEM "note.dtd">';
    expect(write(parse(xml))).toBe(xml);
  });

  it('writes DOCTYPE as void (no closing tag) in all modes', () => {
    const node: TNode = {
      tagName: '!DOCTYPE',
      attributes: { html: null },
      children: [],
    };
    expect(write(node)).toBe('<!DOCTYPE html>');
    expect(write(node, { pretty: true })).toBe('<!DOCTYPE html>');
    expect(write(node, { html: true })).toBe('<!DOCTYPE html>');
    expect(write(node, { entities: true })).toBe('<!DOCTYPE html>');
    expect(write(node, { html: true, entities: true, pretty: true })).toBe(
      '<!DOCTYPE html>',
    );
  });

  it('uses single quotes when value contains double quotes', () => {
    expect(
      write({
        tagName: 'div',
        attributes: { data: 'he said "hi"' },
        children: [],
      }),
    ).toBe('<div data=\'he said "hi"\'></div>');
  });

  it('escapes attribute values containing both double and single quotes (compact)', () => {
    const node: TNode = {
      tagName: 'div',
      attributes: { data: `he said "it's"` },
      children: [],
    };
    const xml = write(node);
    // Must produce valid XML that roundtrips correctly
    const reparsed = parse(xml, { entities: true });
    const child = reparsed[0] as TNode;
    expect(child.attributes?.data).toBe(`he said "it's"`);
  });

  it('escapes attribute values containing both quotes (entities mode, compact)', () => {
    const node: TNode = {
      tagName: 'div',
      attributes: { data: `he said "it's"` },
      children: [],
    };
    const xml = write(node, { entities: true });
    const reparsed = parse(xml, { entities: true });
    const child = reparsed[0] as TNode;
    expect(child.attributes?.data).toBe(`he said "it's"`);
  });

  it('escapes attribute values containing both quotes (pretty mode)', () => {
    const node: TNode = {
      tagName: 'root',
      attributes: {},
      children: [
        {
          tagName: 'div',
          attributes: { data: `he said "it's"` },
          children: [],
        },
      ],
    };
    const xml = write(node, { pretty: true });
    const reparsed = parse(xml, { entities: true });
    const root = reparsed[0] as TNode;
    const child = root.children[0] as TNode;
    expect(child.attributes?.data).toBe(`he said "it's"`);
  });

  it('throws a descriptive error for circular references', () => {
    const node: TNode = { tagName: 'a', attributes: {}, children: [] };
    node.children.push(node); // circular!
    expect(() => write(node)).toThrow(
      'Circular reference detected in TNode tree',
    );
  });

  it('throws for circular references in pretty mode', () => {
    const node: TNode = { tagName: 'a', attributes: {}, children: [] };
    const child: TNode = { tagName: 'b', attributes: {}, children: [node] };
    node.children.push(child); // indirect circular
    expect(() => write(node, { pretty: true })).toThrow(
      'Circular reference detected in TNode tree',
    );
  });

  it('throws for circular references in compact mode with entities', () => {
    // Lines 284-288: circular reference detection in compact-with-entities path
    const node: TNode = { tagName: 'a', attributes: {}, children: [] };
    node.children.push(node); // circular!
    expect(() => write(node, { entities: true })).toThrow(
      'Circular reference detected in TNode tree',
    );
  });

  // --- pretty option ---

  it('pretty: true uses 2-space indent', () => {
    const tree = parse('<root><child><leaf></leaf></child></root>');
    expect(write(tree, { pretty: true })).toBe(
      '<root>\n  <child>\n    <leaf/>\n  </child>\n</root>',
    );
  });

  it('pretty: custom indent string', () => {
    const tree = parse('<root><child></child></root>');
    expect(write(tree, { pretty: '\t' })).toBe('<root>\n\t<child/>\n</root>');
  });

  it('pretty: empty elements self-close', () => {
    expect(
      write({ tagName: 'br', attributes: {}, children: [] }, { pretty: true }),
    ).toBe('<br/>');
  });

  it('pretty: text-only elements stay inline', () => {
    const tree = parse('<name>Alice</name>');
    expect(write(tree, { pretty: true })).toBe('<name>Alice</name>');
  });

  it('pretty: mixed content indents each child on its own line', () => {
    const tree = parse('<p>Hello <b>world</b>!</p>');
    expect(write(tree, { pretty: true })).toBe(
      '<p>\n  Hello\n  <b>world</b>\n  !\n</p>',
    );
  });

  it('pretty: processing instructions render correctly', () => {
    expect(
      write(
        { tagName: '?xml', attributes: { version: '1.0' }, children: [] },
        { pretty: true },
      ),
    ).toBe('<?xml version="1.0"?>');
  });

  it('pretty: attributes are preserved', () => {
    const tree = parse('<root id="1"><child class="a"></child></root>');
    expect(write(tree, { pretty: true })).toBe(
      '<root id="1">\n  <child class="a"/>\n</root>',
    );
  });

  it('pretty: multiple top-level nodes', () => {
    const tree = parse('<?xml version="1.0"?><root><a></a></root>');
    expect(write(tree, { pretty: true })).toBe(
      '<?xml version="1.0"?>\n<root>\n  <a/>\n</root>',
    );
  });

  it('pretty: deeply nested structure', () => {
    const tree = parse('<a><b><c><d></d></c></b></a>');
    expect(write(tree, { pretty: true })).toBe(
      '<a>\n  <b>\n    <c>\n      <d/>\n    </c>\n  </b>\n</a>',
    );
  });

  it('pretty: boolean attributes', () => {
    expect(
      write(
        {
          tagName: 'input',
          attributes: { disabled: null, type: 'text' },
          children: [],
        },
        { pretty: true },
      ),
    ).toBe('<input disabled type="text"/>');
  });

  it('pretty: element-only children with text leaf', () => {
    const tree = parse(
      '<root><header><title>Hello</title></header><body></body></root>',
    );
    expect(write(tree, { pretty: true })).toBe(
      '<root>\n  <header>\n    <title>Hello</title>\n  </header>\n  <body/>\n</root>',
    );
  });

  it('pretty: false is same as no option', () => {
    const tree = parse('<root><child></child></root>');
    expect(write(tree, { pretty: false })).toBe(write(tree));
  });

  it('pretty: mixed content with nested elements', () => {
    const tree = parse('<p>Click <a><b>here</b></a> now</p>');
    expect(write(tree, { pretty: true })).toBe(
      '<p>\n  Click\n  <a>\n    <b>here</b>\n  </a>\n  now\n</p>',
    );
  });

  it('pretty: four-space indent string', () => {
    const tree = parse('<root><child></child></root>');
    expect(write(tree, { pretty: '    ' })).toBe(
      '<root>\n    <child/>\n</root>',
    );
  });

  // --- entities option (XML mode) ---

  describe('entities: true (XML mode)', () => {
    it('encodes &, <, > in text nodes', () => {
      const tree: TNode = {
        tagName: 'p',
        attributes: null,
        children: ['Tom & Jerry < Mickey > Goofy'],
      };
      expect(write(tree, { entities: true })).toBe(
        '<p>Tom &amp; Jerry &lt; Mickey &gt; Goofy</p>',
      );
    });

    it('encodes &, ", \' in attribute values', () => {
      const tree: TNode = {
        tagName: 'div',
        attributes: { title: 'A & B "quoted"' },
        children: [],
      };
      // Since " is encoded, double-quote wrapper is safe
      expect(write(tree, { entities: true })).toBe(
        '<div title="A &amp; B &quot;quoted&quot;"></div>',
      );
    });

    it('does not encode single quotes in double-quoted attributes', () => {
      // escapeAttribute only encodes & and " — single quotes are safe
      // inside double-quoted attribute values
      const tree: TNode = {
        tagName: 'div',
        attributes: { title: "it's here" },
        children: [],
      };
      expect(write(tree, { entities: true })).toBe(
        '<div title="it\'s here"></div>',
      );
    });

    it('does not encode when entities is false (default)', () => {
      const tree: TNode = {
        tagName: 'p',
        attributes: { title: 'A & B "C"' },
        children: ['Tom & Jerry'],
      };
      const result = write(tree);
      expect(result).toBe('<p title=\'A & B "C"\'>Tom & Jerry</p>');
    });

    it('encodes text in compact mode', () => {
      const tree: TNode = {
        tagName: 'root',
        attributes: null,
        children: [
          { tagName: 'a', attributes: null, children: ['1 < 2'] },
          { tagName: 'b', attributes: null, children: ['3 > 2'] },
        ],
      };
      expect(write(tree, { entities: true })).toBe(
        '<root><a>1 &lt; 2</a><b>3 &gt; 2</b></root>',
      );
    });

    it('encodes text in pretty mode', () => {
      const tree: TNode = {
        tagName: 'root',
        attributes: null,
        children: [{ tagName: 'msg', attributes: null, children: ['A & B'] }],
      };
      expect(write(tree, { entities: true, pretty: true })).toBe(
        '<root>\n  <msg>A &amp; B</msg>\n</root>',
      );
    });

    it('encodes & in attributes in pretty mode (< and > are safe in attr values)', () => {
      const tree: TNode = {
        tagName: 'input',
        attributes: { value: '1 < 2 & 3 > 0' },
        children: [],
      };
      // escapeAttribute encodes & and " only; < and > are valid in attribute values
      expect(write(tree, { entities: true, pretty: true })).toBe(
        '<input value="1 < 2 &amp; 3 > 0"/>',
      );
    });

    it('encodes mixed content with pretty-print', () => {
      const tree: TNode = {
        tagName: 'p',
        attributes: null,
        children: [
          'Copyright ',
          { tagName: 'b', attributes: null, children: ['A & B'] },
          // escapeText only handles &, <, > — non-ASCII like © is left as-is
          ' \u00A9 2024',
        ],
      };
      expect(write(tree, { entities: true, pretty: true })).toBe(
        '<p>\n  Copyright\n  <b>A &amp; B</b>\n  \u00A9 2024\n</p>',
      );
    });

    it('handles already-safe text without changes', () => {
      const tree: TNode = {
        tagName: 'p',
        attributes: null,
        children: ['Hello world'],
      };
      expect(write(tree, { entities: true })).toBe('<p>Hello world</p>');
    });

    it('top-level string array elements are encoded', () => {
      const nodes: (TNode | string)[] = [
        'before & after',
        { tagName: 'br', attributes: null, children: [] },
      ];
      expect(write(nodes, { entities: true })).toBe(
        'before &amp; after<br></br>',
      );
    });

    it('roundtrip: parse with entities → write with entities', () => {
      const xml = '<root attr="a &amp; b">1 &lt; 2</root>';
      const tree = parse(xml, { entities: true });
      const result = write(tree, { entities: true });
      expect(result).toBe(xml);
    });

    it('roundtrip: complex XML with entities', () => {
      // Use double-quote-safe entities that roundtrip cleanly
      const xml =
        '<catalog><book title="Smith &amp; Associates"><desc>Learn &lt;XML&gt; &amp; more</desc></book></catalog>';
      const tree = parse(xml, { entities: true });
      const result = write(tree, { entities: true });
      expect(result).toBe(xml);
    });
  });

  // --- html option ---

  describe('html: true', () => {
    it('void elements self-close without closing tag (compact)', () => {
      const tree: TNode = {
        tagName: 'div',
        attributes: null,
        children: [
          { tagName: 'br', attributes: null, children: [] },
          'text',
          { tagName: 'hr', attributes: null, children: [] },
        ],
      };
      expect(write(tree, { html: true })).toBe('<div><br>text<hr></div>');
    });

    it('void elements self-close in pretty mode', () => {
      const tree: TNode = {
        tagName: 'div',
        attributes: null,
        children: [
          { tagName: 'img', attributes: { src: 'a.png' }, children: [] },
          { tagName: 'p', attributes: null, children: ['text'] },
        ],
      };
      expect(write(tree, { html: true, pretty: true })).toBe(
        '<div>\n  <img src="a.png">\n  <p>text</p>\n</div>',
      );
    });

    it('void elements on their own line in mixed content', () => {
      const tree: TNode = {
        tagName: 'p',
        attributes: null,
        children: [
          'line 1',
          { tagName: 'br', attributes: null, children: [] },
          'line 2',
        ],
      };
      expect(write(tree, { html: true, pretty: true })).toBe(
        '<p>\n  line 1\n  <br>\n  line 2\n</p>',
      );
    });

    it('non-void elements still get closing tags', () => {
      const tree: TNode = {
        tagName: 'span',
        attributes: null,
        children: [],
      };
      expect(write(tree, { html: true })).toBe('<span></span>');
    });

    it('void element with attributes', () => {
      const tree: TNode = {
        tagName: 'input',
        attributes: { type: 'text', disabled: null },
        children: [],
      };
      expect(write(tree, { html: true })).toBe('<input type="text" disabled>');
    });

    it('all HTML void elements are recognized', () => {
      const voids = [
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
      ];
      for (const tag of voids) {
        const tree: TNode = { tagName: tag, attributes: null, children: [] };
        expect(write(tree, { html: true })).toBe(`<${tag}>`);
      }
    });

    it('void elements in pretty mode self-close (not self-closing />)', () => {
      const tree: TNode = {
        tagName: 'br',
        attributes: null,
        children: [],
      };
      // Should be <br>, not <br/> or <br />
      expect(write(tree, { html: true, pretty: true })).toBe('<br>');
    });
  });

  // --- html + entities combined ---

  describe('html: true + entities: true', () => {
    it('preserves UTF-8 text while encoding XML-critical characters', () => {
      const tree: TNode = {
        tagName: 'p',
        attributes: null,
        children: ['Copyright \u00A9 2024'],
      };
      const result = write(tree, { html: true, entities: true });
      // © is preserved as UTF-8, not encoded to &copy;
      expect(result).toBe('<p>Copyright \u00A9 2024</p>');
    });

    it('preserves UTF-8 in attributes while encoding XML-critical characters', () => {
      const tree: TNode = {
        tagName: 'div',
        attributes: { title: '\u00A9 2024' },
        children: [],
      };
      const result = write(tree, { html: true, entities: true });
      // © is preserved as UTF-8, not encoded to &copy;
      expect(result).toContain('\u00A9');
    });

    it('encodes < and & in HTML mode text', () => {
      const tree: TNode = {
        tagName: 'p',
        attributes: null,
        children: ['A & B < C'],
      };
      const result = write(tree, { html: true, entities: true });
      expect(result).toBe('<p>A &amp; B &lt; C</p>');
    });

    it('void elements + entities combined', () => {
      const tree: TNode = {
        tagName: 'div',
        attributes: null,
        children: [
          { tagName: 'img', attributes: { alt: 'Tom & Jerry' }, children: [] },
          {
            tagName: 'p',
            attributes: null,
            children: ['\u00E9l\u00E8ve'],
          },
        ],
      };
      const result = write(tree, { html: true, entities: true, pretty: true });
      expect(result).toContain('<img');
      expect(result).toContain('&amp;');
      // é and è are preserved as UTF-8, not encoded to &eacute;/&egrave;
      expect(result).toContain('\u00E9');
      expect(result).toContain('\u00E8');
      // img should NOT have a closing tag
      expect(result).not.toContain('</img>');
    });

    it('pretty + html + entities: full example', () => {
      const tree: TNode = {
        tagName: 'html',
        attributes: null,
        children: [
          {
            tagName: 'head',
            attributes: null,
            children: [
              {
                tagName: 'meta',
                attributes: { charset: 'utf-8' },
                children: [],
              },
            ],
          },
          {
            tagName: 'body',
            attributes: null,
            children: [
              {
                tagName: 'p',
                attributes: null,
                children: ['\u00A9 2024 Acme & Co.'],
              },
              { tagName: 'br', attributes: null, children: [] },
              { tagName: 'hr', attributes: null, children: [] },
            ],
          },
        ],
      };
      const result = write(tree, {
        html: true,
        entities: true,
        pretty: true,
      });
      // Void elements should not have closing tags
      expect(result).not.toContain('</meta>');
      expect(result).not.toContain('</br>');
      expect(result).not.toContain('</hr>');
      // Entities should be encoded (XML-critical only; UTF-8 preserved)
      expect(result).toContain('\u00A9');
      expect(result).toContain('&amp;');
      // Structure check
      expect(result).toContain('<meta');
      expect(result).toContain('<br>');
      expect(result).toContain('<hr>');
    });
  });

  // --- lossy input auto-detection ---

  describe('lossy input', () => {
    it('writes a simple lossy object', () => {
      const input: LossyValue = { root: { a: '1', b: '2' } };
      expect(write(input)).toBe('<root><a>1</a><b>2</b></root>');
    });

    it('writes a lossy object with attributes', () => {
      const input: LossyValue = { img: { $src: 'a.png', $alt: 'pic' } };
      expect(write(input)).toBe('<img src="a.png" alt="pic"></img>');
    });

    it('writes a lossy object with repeated elements', () => {
      const input: LossyValue = { list: { item: ['A', 'B', 'C'] } };
      expect(write(input)).toBe(
        '<list><item>A</item><item>B</item><item>C</item></list>',
      );
    });

    it('writes a lossy object with mixed content', () => {
      const input: LossyValue = { p: { $$: ['Hello ', { b: 'world' }] } };
      expect(write(input)).toBe('<p>Hello <b>world</b></p>');
    });

    it('writes a lossy object with pretty option', () => {
      const input: LossyValue = { root: { child: 'text' } };
      expect(write(input, { pretty: true })).toBe(
        '<root>\n  <child>text</child>\n</root>',
      );
    });

    it('writes a lossy object with entities option', () => {
      const input: LossyValue = { root: { msg: 'A & B' } };
      expect(write(input, { entities: true })).toBe(
        '<root><msg>A &amp; B</msg></root>',
      );
    });

    it('writes a lossy array', () => {
      const input: LossyValue[] = [{ a: '1' }, { b: '2' }];
      expect(write(input)).toBe('<a>1</a><b>2</b>');
    });

    it('roundtrips: XML → lossy → writer → parse matches', () => {
      const xml = '<root><item>1</item><item>2</item></root>';
      const lossyData = lossy(xml);
      const result = write(lossyData);
      // lossy loses sibling order between different tags but preserves same-tag
      const reParsedLossy = lossy(result);
      expect(reParsedLossy).toEqual(lossyData);
    });
  });

  // --- lossless input auto-detection ---

  describe('lossless input', () => {
    it('writes simple lossless entries', () => {
      const input: LosslessEntry[] = [
        { root: [{ child: [{ $text: 'hello' }] }] },
      ];
      expect(write(input)).toBe('<root><child>hello</child></root>');
    });

    it('writes lossless entries with attributes', () => {
      const input: LosslessEntry[] = [
        {
          user: [{ $attr: { id: '1' } }, { name: [{ $text: 'Alice' }] }],
        },
      ];
      expect(write(input)).toBe('<user id="1"><name>Alice</name></user>');
    });

    it('writes lossless entries with comments', () => {
      const input: LosslessEntry[] = [
        {
          root: [{ $comment: ' a comment ' }, { child: [{ $text: 'text' }] }],
        },
      ];
      expect(write(input)).toBe(
        '<root><!-- a comment --><child>text</child></root>',
      );
    });

    it('writes lossless entries with pretty option', () => {
      const input: LosslessEntry[] = [
        { root: [{ a: [] }, { b: [{ $text: 'text' }] }] },
      ];
      expect(write(input, { pretty: true })).toBe(
        '<root>\n  <a/>\n  <b>text</b>\n</root>',
      );
    });

    it('writes lossless entries with entities option', () => {
      const input: LosslessEntry[] = [
        { root: [{ msg: [{ $text: 'A & B < C' }] }] },
      ];
      expect(write(input, { entities: true })).toBe(
        '<root><msg>A &amp; B &lt; C</msg></root>',
      );
    });

    it('roundtrips: XML → lossless → writer matches original', () => {
      const xml = '<root id="1"><item>A</item><item>B</item></root>';
      const losslessData = lossless(xml);
      const result = write(losslessData);
      expect(result).toBe(xml);
    });

    it('roundtrips: complex XML → lossless → writer', () => {
      const xml =
        '<catalog><book title="XML Guide"><chapter>Intro</chapter><chapter>Advanced</chapter></book></catalog>';
      const losslessData = lossless(xml);
      const result = write(losslessData);
      expect(result).toBe(xml);
    });
  });

  // --- tag/attribute name validation (issue 4) ---

  describe('tag/attribute name validation (issue 4)', () => {
    it('throws for tag name injection in compact mode', () => {
      const node: TNode = {
        tagName: '"><script>alert(1)</script><x',
        attributes: null,
        children: [],
      };
      expect(() => write(node)).toThrow();
    });

    it('throws for tag name containing >', () => {
      const node: TNode = {
        tagName: 'foo>bar',
        attributes: null,
        children: [],
      };
      expect(() => write(node)).toThrow();
    });

    it('throws for tag name containing <', () => {
      const node: TNode = {
        tagName: 'foo<bar',
        attributes: null,
        children: [],
      };
      expect(() => write(node)).toThrow();
    });

    it('throws for tag name containing space', () => {
      const node: TNode = {
        tagName: 'foo bar',
        attributes: null,
        children: [],
      };
      expect(() => write(node)).toThrow();
    });

    it('throws for tag name containing double quote', () => {
      const node: TNode = {
        tagName: 'foo"bar',
        attributes: null,
        children: [],
      };
      expect(() => write(node)).toThrow();
    });

    it('throws for tag name containing single quote', () => {
      const node: TNode = {
        tagName: "foo'bar",
        attributes: null,
        children: [],
      };
      expect(() => write(node)).toThrow();
    });

    it('throws for attribute name containing =', () => {
      const node: TNode = {
        tagName: 'div',
        attributes: { 'foo=bar': 'value' },
        children: [],
      };
      expect(() => write(node)).toThrow();
    });

    it('throws for attribute name containing >', () => {
      const node: TNode = {
        tagName: 'div',
        attributes: { 'foo>': 'value' },
        children: [],
      };
      expect(() => write(node)).toThrow();
    });

    it('throws for attribute name containing <', () => {
      const node: TNode = {
        tagName: 'div',
        attributes: { '<script': 'value' },
        children: [],
      };
      expect(() => write(node)).toThrow();
    });

    it('throws for attribute name containing space', () => {
      const node: TNode = {
        tagName: 'div',
        attributes: { 'foo bar': 'value' },
        children: [],
      };
      expect(() => write(node)).toThrow();
    });

    it('throws for empty tag name', () => {
      const node: TNode = {
        tagName: '',
        attributes: null,
        children: [],
      };
      expect(() => write(node)).toThrow();
    });

    it('allows valid XML tag names (including namespaced)', () => {
      expect(() =>
        write({
          tagName: 'soap:Envelope',
          attributes: { 'xmlns:soap': 'http://example.com' },
          children: [],
        }),
      ).not.toThrow();
    });

    it('allows valid processing instruction and DOCTYPE names', () => {
      expect(() =>
        write({
          tagName: '?xml',
          attributes: { version: '1.0' },
          children: [],
        }),
      ).not.toThrow();
      expect(() =>
        write({
          tagName: '!DOCTYPE',
          attributes: { html: null },
          children: [],
        }),
      ).not.toThrow();
    });

    it('throws for tag name injection in pretty mode', () => {
      const node: TNode = {
        tagName: '"><script>alert(1)</script><x',
        attributes: null,
        children: [],
      };
      expect(() => write(node, { pretty: true })).toThrow();
    });

    it('throws for tag name injection in entities mode', () => {
      const node: TNode = {
        tagName: '"><script>alert(1)</script><x',
        attributes: null,
        children: [],
      };
      expect(() => write(node, { entities: true })).toThrow();
    });

    it('throws for attribute name injection in entities mode', () => {
      const node: TNode = {
        tagName: 'div',
        attributes: { 'x"><script>alert(1)</script><x y': 'value' },
        children: [],
      };
      expect(() => write(node, { entities: true })).toThrow();
    });
  });

  // --- edge cases for input auto-detection ---

  describe('input auto-detection edge cases', () => {
    it('empty array returns empty string', () => {
      expect(write([])).toBe('');
    });

    it('null/undefined returns empty string', () => {
      expect(write(null as any)).toBe('');
      expect(write(undefined as any)).toBe('');
    });

    it('single TNode (not wrapped in array) works', () => {
      const node: TNode = { tagName: 'div', attributes: null, children: [] };
      expect(write(node)).toBe('<div></div>');
    });

    it('DOM array with text strings passes through', () => {
      const dom: (TNode | string)[] = [
        'hello ',
        { tagName: 'b', attributes: null, children: ['world'] },
      ];
      expect(write(dom)).toBe('hello <b>world</b>');
    });

    it('all-string array passes through as DOM text', () => {
      expect(write(['hello', ' ', 'world'] as any)).toBe('hello world');
    });

    it('bare string lossy input is converted', () => {
      // toDom receives a bare string (non-array, non-object) — treated as lossy
      expect(write('just text' as any)).toBe('just text');
    });

    it('lossy object without tagName property is converted', () => {
      // Non-array object without tagName → lossy format
      const input = { root: null };
      expect(write(input as any)).toBe('<root></root>');
    });
  });

  // --- attribute value quoting edge cases ---

  describe('attribute value quoting', () => {
    it('compact path: attribute with both quote types escapes single quotes', () => {
      const node: TNode = {
        tagName: 'div',
        attributes: { data: 'he said "it\'s" ok' },
        children: [],
      };
      // Value contains both " and ' — the writer should escape ' to &apos;
      const result = write(node);
      expect(result).toContain('&apos;');
      expect(result).toContain('he said');
    });

    it('full path (no entities): attribute with both quote types escapes single quotes', () => {
      const node: TNode = {
        tagName: 'div',
        attributes: { data: 'he said "it\'s" ok' },
        children: ['text'],
      };
      // entities defaults to false, so encodeAttributeValue is identity — both raw quotes survive
      const result = write(node);
      expect(result).toContain('&apos;');
      expect(result).toContain('he said');
    });

    it('pretty path (no entities): attribute with both quote types escapes single quotes', () => {
      const node: TNode = {
        tagName: 'div',
        attributes: { data: 'he said "it\'s" ok' },
        children: ['text'],
      };
      // pretty: true without entities — identity encoder, both raw quotes survive
      const result = write(node, { pretty: true });
      expect(result).toContain('&apos;');
      expect(result).toContain('he said');
    });
  });

  // --- pretty mode edge cases ---

  describe('pretty mode edge cases', () => {
    it('DOCTYPE with non-simple-keyword attributes in pretty mode', () => {
      // Non-simple keyword attrs in DOCTYPE are quoted with double quotes
      const node: TNode = {
        tagName: '!DOCTYPE',
        attributes: {
          html: null,
          PUBLIC: null,
          '-//W3C//DTD HTML 4.01//EN': null,
          'http://www.w3.org/TR/html4/strict.dtd': null,
        },
        children: [],
      };
      const result = write(node, { pretty: true, entities: true });
      expect(result).toContain('html');
      expect(result).toContain('PUBLIC');
      // URIs should be double-quoted
      expect(result).toContain('"-//W3C//DTD HTML 4.01//EN"');
      expect(result).toContain(
        '"http://www.w3.org/TR/html4/strict.dtd"',
      );
    });

    it('pretty: mixed content with elements gets each child on its own line', () => {
      const node: TNode = {
        tagName: 'p',
        attributes: null,
        children: [
          'Hello ',
          { tagName: 'b', attributes: null, children: ['world'] },
          ' end',
        ],
      };
      const result = write(node, { pretty: true, entities: true });
      // Mixed content: text and elements on separate indented lines
      expect(result).toContain('\n  Hello');
      expect(result).toContain('\n  <b>world</b>');
      expect(result).toContain('\n  end');
    });

    it('pretty: comment in mixed content preserves comment', () => {
      const node: TNode = {
        tagName: 'root',
        attributes: null,
        children: [
          'text',
          '<!-- comment -->',
          { tagName: 'child', attributes: null, children: [] },
        ],
      };
      const result = write(node, {
        pretty: true,
        entities: true,
      });
      expect(result).toContain('<!-- comment -->');
    });

    it('pretty: comment in element-only children', () => {
      const node: TNode = {
        tagName: 'root',
        attributes: null,
        children: [
          '<!-- header comment -->',
          { tagName: 'child', attributes: null, children: ['text'] },
        ],
      };
      const result = write(node, {
        pretty: true,
        entities: true,
      });
      expect(result).toContain('<!-- header comment -->');
      expect(result).toContain('<child>text</child>');
    });

    it('pretty: top-level text node', () => {
      const nodes: (TNode | string)[] = [
        'top level text',
        { tagName: 'root', attributes: null, children: [] },
      ];
      const result = write(nodes, {
        pretty: true,
        entities: true,
      });
      expect(result).toContain('top level text');
      expect(result).toContain('<root/>');
    });

    it('prettyWriteNode handles null/undefined node gracefully', () => {
      // Force a null node into the children array — the null guard
      // at the top of prettyWriteNode should prevent a crash
      const node: TNode = {
        tagName: 'root',
        attributes: null,
        children: [null as any, { tagName: 'a', attributes: null, children: [] }],
      };
      const result = write(node, { pretty: true, entities: true });
      expect(result).toContain('<a/>');
    });
  });

  // --- validateTagName: bare ? or ! ---
  describe('validateTagName edge cases', () => {
    it('allows bare ? as a degenerate but harmless tag name', () => {
      // Line 29: `name.length === 0` for tag "?"
      const node: TNode = { tagName: '?', attributes: null, children: [] };
      expect(() => write(node)).not.toThrow();
    });

    it('allows bare ! as a degenerate but harmless tag name', () => {
      const node: TNode = { tagName: '!', attributes: null, children: [] };
      expect(() => write(node)).not.toThrow();
    });
  });

  // --- compact: no-attr PI and declaration ---
  describe('compact path: PI and declaration with null attributes', () => {
    it('writes PI with null attributes as <?tag?>', () => {
      // Lines 177-178: compact path, PI with null attrs
      const node: TNode = { tagName: '?xml', attributes: null, children: [] };
      expect(write(node)).toBe('<?xml?>');
    });

    it('writes declaration with null attributes as <!tag>', () => {
      // Lines 181-182: compact path, ! tag with null attrs
      const node: TNode = {
        tagName: '!DOCTYPE',
        attributes: null,
        children: [],
      };
      expect(write(node)).toBe('<!DOCTYPE>');
    });
  });

  // --- full compact-with-entities: no-attr PI and declaration ---
  describe('full compact path (entities): PI and declaration with null attrs', () => {
    it('writes PI with null attributes as <?tag?> in entities mode', () => {
      // Lines 301-302: full path, PI with null attrs
      const node: TNode = { tagName: '?xml', attributes: null, children: [] };
      expect(write(node, { entities: true })).toBe('<?xml?>');
    });

    it('writes declaration with null attributes in entities mode', () => {
      // Lines 306-307: full path, ! tag with null attrs
      const node: TNode = {
        tagName: '!DOCTYPE',
        attributes: null,
        children: [],
      };
      expect(write(node, { entities: true })).toBe('<!DOCTYPE>');
    });
  });

  // --- full compact: attribute single-quote fallback and both-quotes ---
  describe('full compact: attribute quoting edge cases', () => {
    it('single-quote fallback when value contains double quotes', () => {
      // Line 332-333: encoded has " but no ' → single-quote wrapping
      // With entities, escapeAttribute encodes " → &quot;, so the first branch
      // catches it. Without entities, identity function is used.
      // Use no-entities mode to get raw quotes into the encoded value
      const node: TNode = {
        tagName: 'div',
        attributes: { data: 'he said "hello"' },
        children: ['text'],
      };
      const result = write(node);
      // Without entities, value has raw " → falls to single-quote branch
      expect(result).toContain("data='he said \"hello\"'");
    });

    it('both-quotes branch with entities in full path (unreachable with escapeAttribute)', () => {
      // Lines 334-341: unreachable with entities since escapeAttribute/escapeUTF8
      // always encode quotes. Test the no-entities path for both quotes, which
      // goes through the compact writeNode.
      // Already tested in "compact path: attribute with both quote types"
    });
  });

  // --- full compact: PI with attributes closing ---
  describe('full compact: PI with attributes', () => {
    it('closes PI with ?> after writing attributes', () => {
      // Lines 346-347: PI with attributes, full path
      const node: TNode = {
        tagName: '?xml',
        attributes: { version: '1.0' },
        children: [],
      };
      const result = write(node, { entities: true });
      expect(result).toBe('<?xml version="1.0"?>');
    });
  });

  // --- pretty: single-quote fallback for attribute ---
  describe('pretty: attribute quoting', () => {
    it('uses single quotes when value contains double quotes (pretty mode)', () => {
      // Line 399: pretty path, value has " but no ' → single-quote wrapper
      const node: TNode = {
        tagName: 'div',
        attributes: { data: 'he said "hello"' },
        children: ['text'],
      };
      const result = write(node, { pretty: true });
      expect(result).toContain("data='he said \"hello\"'");
    });
  });

  // --- pretty: text-only element with empty/multiple segments ---
  describe('pretty: text-only element formatting', () => {
    it('skips empty text nodes and separates with space', () => {
      // Lines 483-484: text-only children, empty segments skipped, space between
      const node: TNode = {
        tagName: 'title',
        attributes: null,
        children: ['  ', 'Hello', '  ', 'World', '  '],
      };
      const result = write(node, { pretty: true, entities: true });
      expect(result).toContain('<title>Hello World</title>');
    });
  });

  // --- toDom: null guard ---
  describe('toDom: null/undefined input', () => {
    it('returns empty string for null input', () => {
      // Line 574: toDom guard
      expect(write(null as any)).toBe('');
    });

    it('returns empty string for undefined input', () => {
      expect(write(undefined as any)).toBe('');
    });
  });

  // --- isLosslessEntry checks ---
  describe('isLosslessEntry format detection', () => {
    it('detects lossless entry with $text marker', () => {
      // Line 641: { $text: ... } is recognized as lossless
      const input = [{ name: [{ $text: 'Alice' }] }];
      const result = write(input as any);
      expect(result).toContain('Alice');
    });

    it('detects lossless entry with $comment marker', () => {
      const input = [{ $comment: 'a comment' }];
      const result = write(input as any);
      expect(result).toContain('<!--a comment-->');
    });

    it('detects lossless entry with $attr marker', () => {
      const input = [
        { div: [{ $attr: { id: 'main' } }, { $text: 'content' }] },
      ];
      const result = write(input as any);
      expect(result).toContain('id="main"');
      expect(result).toContain('content');
    });

    it('rejects non-object values in isLosslessEntry', () => {
      // Line 637: typeof !== 'object' → false
      // Bare string input → passes through toDom lossy path, outputs the string
      const result = write('hello' as any);
      expect(result).toBe('hello');
    });

    it('rejects empty objects in isLosslessEntry', () => {
      // Line 639: keys.length === 0 → false
      const result = write([{}] as any);
      // Empty object should not crash
      expect(typeof result).toBe('string');
    });
  });
});
