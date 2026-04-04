import { describe, it, expect } from 'vitest';
import { parse } from '#src/parser.ts';
import { writer } from '#src/writer.ts';
import type { TNode } from '#src/parser.ts';

// =================================================================
// writer
// =================================================================
describe('writer', () => {
  it('roundtrips optimal XML', () => {
    const x = '<test a="value"><child a=\'g"g\'>text</child></test>';
    expect(writer(parse(x))).toBe(x);
  });

  it('roundtrips attribute without value', () => {
    const s = '<test><something flag></something></test>';
    expect(writer(parse(s))).toBe(s);
  });

  it('returns empty string for undefined', () => {
    expect(writer(undefined as any)).toBe('');
  });

  it('stringifies a simple element', () => {
    expect(writer({ tagName: 'div', attributes: {}, children: [] })).toBe(
      '<div></div>',
    );
  });

  it('stringifies nested elements', () => {
    expect(
      writer({
        tagName: 'a',
        attributes: {},
        children: [{ tagName: 'b', attributes: {}, children: ['text'] }],
      }),
    ).toBe('<a><b>text</b></a>');
  });

  it('stringifies boolean attributes', () => {
    expect(
      writer({
        tagName: 'input',
        attributes: { disabled: null },
        children: [],
      }),
    ).toBe('<input disabled></input>');
  });

  it('stringifies an array of nodes', () => {
    expect(
      writer([
        { tagName: 'a', attributes: {}, children: [] },
        { tagName: 'b', attributes: {}, children: [] },
      ]),
    ).toBe('<a></a><b></b>');
  });

  it('stringifies processing instructions', () => {
    expect(
      writer({
        tagName: '?xml',
        attributes: { version: '1.0' },
        children: [],
      }),
    ).toBe('<?xml version="1.0"?>');
  });

  // --- DOCTYPE declarations ---

  it('roundtrips simple HTML5 DOCTYPE', () => {
    const xml = '<!DOCTYPE html><html></html>';
    expect(writer(parse(xml))).toBe(xml);
  });

  it('roundtrips DOCTYPE with quoted public and system identifiers', () => {
    const xml =
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">';
    expect(writer(parse(xml))).toBe(xml);
  });

  it('roundtrips DOCTYPE with quoted identifiers in pretty mode', () => {
    const xml =
      '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';
    expect(writer(parse(xml), { pretty: true })).toBe(xml);
  });

  it('roundtrips DOCTYPE with quoted identifiers in entities mode', () => {
    const xml =
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">';
    expect(writer(parse(xml), { entities: true })).toBe(xml);
  });

  it('roundtrips DOCTYPE with SYSTEM identifier', () => {
    const xml = '<!DOCTYPE note SYSTEM "note.dtd">';
    expect(writer(parse(xml))).toBe(xml);
  });

  it('writes DOCTYPE as void (no closing tag) in all modes', () => {
    const node: TNode = {
      tagName: '!DOCTYPE',
      attributes: { html: null },
      children: [],
    };
    expect(writer(node)).toBe('<!DOCTYPE html>');
    expect(writer(node, { pretty: true })).toBe('<!DOCTYPE html>');
    expect(writer(node, { html: true })).toBe('<!DOCTYPE html>');
    expect(writer(node, { entities: true })).toBe('<!DOCTYPE html>');
    expect(writer(node, { html: true, entities: true, pretty: true })).toBe(
      '<!DOCTYPE html>',
    );
  });

  it('uses single quotes when value contains double quotes', () => {
    expect(
      writer({
        tagName: 'div',
        attributes: { data: 'he said "hi"' },
        children: [],
      }),
    ).toBe('<div data=\'he said "hi"\'></div>');
  });

  // --- pretty option ---

  it('pretty: true uses 2-space indent', () => {
    const tree = parse('<root><child><leaf></leaf></child></root>');
    expect(writer(tree, { pretty: true })).toBe(
      '<root>\n  <child>\n    <leaf/>\n  </child>\n</root>',
    );
  });

  it('pretty: custom indent string', () => {
    const tree = parse('<root><child></child></root>');
    expect(writer(tree, { pretty: '\t' })).toBe('<root>\n\t<child/>\n</root>');
  });

  it('pretty: empty elements self-close', () => {
    expect(
      writer({ tagName: 'br', attributes: {}, children: [] }, { pretty: true }),
    ).toBe('<br/>');
  });

  it('pretty: text-only elements stay inline', () => {
    const tree = parse('<name>Alice</name>');
    expect(writer(tree, { pretty: true })).toBe('<name>Alice</name>');
  });

  it('pretty: mixed content indents each child on its own line', () => {
    const tree = parse('<p>Hello <b>world</b>!</p>');
    expect(writer(tree, { pretty: true })).toBe(
      '<p>\n  Hello\n  <b>world</b>\n  !\n</p>',
    );
  });

  it('pretty: processing instructions render correctly', () => {
    expect(
      writer(
        { tagName: '?xml', attributes: { version: '1.0' }, children: [] },
        { pretty: true },
      ),
    ).toBe('<?xml version="1.0"?>');
  });

  it('pretty: attributes are preserved', () => {
    const tree = parse('<root id="1"><child class="a"></child></root>');
    expect(writer(tree, { pretty: true })).toBe(
      '<root id="1">\n  <child class="a"/>\n</root>',
    );
  });

  it('pretty: multiple top-level nodes', () => {
    const tree = parse('<?xml version="1.0"?><root><a></a></root>');
    expect(writer(tree, { pretty: true })).toBe(
      '<?xml version="1.0"?>\n<root>\n  <a/>\n</root>',
    );
  });

  it('pretty: deeply nested structure', () => {
    const tree = parse('<a><b><c><d></d></c></b></a>');
    expect(writer(tree, { pretty: true })).toBe(
      '<a>\n  <b>\n    <c>\n      <d/>\n    </c>\n  </b>\n</a>',
    );
  });

  it('pretty: boolean attributes', () => {
    expect(
      writer(
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
    expect(writer(tree, { pretty: true })).toBe(
      '<root>\n  <header>\n    <title>Hello</title>\n  </header>\n  <body/>\n</root>',
    );
  });

  it('pretty: false is same as no option', () => {
    const tree = parse('<root><child></child></root>');
    expect(writer(tree, { pretty: false })).toBe(writer(tree));
  });

  it('pretty: mixed content with nested elements', () => {
    const tree = parse('<p>Click <a><b>here</b></a> now</p>');
    expect(writer(tree, { pretty: true })).toBe(
      '<p>\n  Click\n  <a>\n    <b>here</b>\n  </a>\n  now\n</p>',
    );
  });

  it('pretty: four-space indent string', () => {
    const tree = parse('<root><child></child></root>');
    expect(writer(tree, { pretty: '    ' })).toBe(
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
      expect(writer(tree, { entities: true })).toBe(
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
      expect(writer(tree, { entities: true })).toBe(
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
      expect(writer(tree, { entities: true })).toBe(
        '<div title="it\'s here"></div>',
      );
    });

    it('does not encode when entities is false (default)', () => {
      const tree: TNode = {
        tagName: 'p',
        attributes: { title: 'A & B "C"' },
        children: ['Tom & Jerry'],
      };
      const result = writer(tree);
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
      expect(writer(tree, { entities: true })).toBe(
        '<root><a>1 &lt; 2</a><b>3 &gt; 2</b></root>',
      );
    });

    it('encodes text in pretty mode', () => {
      const tree: TNode = {
        tagName: 'root',
        attributes: null,
        children: [{ tagName: 'msg', attributes: null, children: ['A & B'] }],
      };
      expect(writer(tree, { entities: true, pretty: true })).toBe(
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
      expect(writer(tree, { entities: true, pretty: true })).toBe(
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
      expect(writer(tree, { entities: true, pretty: true })).toBe(
        '<p>\n  Copyright\n  <b>A &amp; B</b>\n  \u00A9 2024\n</p>',
      );
    });

    it('handles already-safe text without changes', () => {
      const tree: TNode = {
        tagName: 'p',
        attributes: null,
        children: ['Hello world'],
      };
      expect(writer(tree, { entities: true })).toBe('<p>Hello world</p>');
    });

    it('top-level string array elements are encoded', () => {
      const nodes: (TNode | string)[] = [
        'before & after',
        { tagName: 'br', attributes: null, children: [] },
      ];
      expect(writer(nodes, { entities: true })).toBe(
        'before &amp; after<br></br>',
      );
    });

    it('roundtrip: parse with entities → write with entities', () => {
      const xml = '<root attr="a &amp; b">1 &lt; 2</root>';
      const tree = parse(xml, { entities: true });
      const result = writer(tree, { entities: true });
      expect(result).toBe(xml);
    });

    it('roundtrip: complex XML with entities', () => {
      // Use double-quote-safe entities that roundtrip cleanly
      const xml =
        '<catalog><book title="Smith &amp; Associates"><desc>Learn &lt;XML&gt; &amp; more</desc></book></catalog>';
      const tree = parse(xml, { entities: true });
      const result = writer(tree, { entities: true });
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
      expect(writer(tree, { html: true })).toBe('<div><br>text<hr></div>');
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
      expect(writer(tree, { html: true, pretty: true })).toBe(
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
      expect(writer(tree, { html: true, pretty: true })).toBe(
        '<p>\n  line 1\n  <br>\n  line 2\n</p>',
      );
    });

    it('non-void elements still get closing tags', () => {
      const tree: TNode = {
        tagName: 'span',
        attributes: null,
        children: [],
      };
      expect(writer(tree, { html: true })).toBe('<span></span>');
    });

    it('void element with attributes', () => {
      const tree: TNode = {
        tagName: 'input',
        attributes: { type: 'text', disabled: null },
        children: [],
      };
      expect(writer(tree, { html: true })).toBe('<input type="text" disabled>');
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
        expect(writer(tree, { html: true })).toBe(`<${tag}>`);
      }
    });

    it('void elements in pretty mode self-close (not self-closing />)', () => {
      const tree: TNode = {
        tagName: 'br',
        attributes: null,
        children: [],
      };
      // Should be <br>, not <br/> or <br />
      expect(writer(tree, { html: true, pretty: true })).toBe('<br>');
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
      const result = writer(tree, { html: true, entities: true });
      // © is preserved as UTF-8, not encoded to &copy;
      expect(result).toBe('<p>Copyright \u00A9 2024</p>');
    });

    it('preserves UTF-8 in attributes while encoding XML-critical characters', () => {
      const tree: TNode = {
        tagName: 'div',
        attributes: { title: '\u00A9 2024' },
        children: [],
      };
      const result = writer(tree, { html: true, entities: true });
      // © is preserved as UTF-8, not encoded to &copy;
      expect(result).toContain('\u00A9');
    });

    it('encodes < and & in HTML mode text', () => {
      const tree: TNode = {
        tagName: 'p',
        attributes: null,
        children: ['A & B < C'],
      };
      const result = writer(tree, { html: true, entities: true });
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
      const result = writer(tree, { html: true, entities: true, pretty: true });
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
      const result = writer(tree, {
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
});
