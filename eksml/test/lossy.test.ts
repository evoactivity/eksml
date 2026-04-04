import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { lossy } from '#src/converters/lossy.ts';
import type { LossyValue, LossyObject } from '#src/converters/lossy.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8');

const rssFeed = fixture('rss-feed.xml');
const soapEnvelope = fixture('soap-envelope.xml');
const pomXml = fixture('pom.xml');
const atomFeed = fixture('atom-feed.xml');

// =================================================================
// User's original example
// =================================================================
describe('user example', () => {
  const xml = `<thing>
  <second with="attributes">Text</second>
  <third>More text</third>
  <second another="attribute">Even more text
    <fourth>Nested text</fourth>
  </second>
</thing>`;

  it('matches the expected output', () => {
    expect(lossy(xml)).toMatchSnapshot();
  });
});

// =================================================================
// Mixed content — interleaved text and elements
// =================================================================
describe('mixed content', () => {
  it('interleaved text and elements use $$ array', () => {
    expect(
      lossy('<p>Hello <b>world</b> and <i>goodbye</i></p>'),
    ).toMatchSnapshot();
  });

  it('single text with attributes uses $$ array', () => {
    expect(lossy('<a href="/">link text</a>')).toMatchSnapshot();
  });

  it('nested mixed content', () => {
    expect(
      lossy('<div>before <span>inner <b>bold</b> after</span> end</div>'),
    ).toMatchSnapshot();
  });
});

// =================================================================
// Text-only elements
// =================================================================
describe('text-only elements', () => {
  it('collapses to string', () => {
    expect(lossy('<name>Alice</name>')).toMatchSnapshot();
  });

  it('preserves entities as raw text', () => {
    expect(lossy('<val>&amp; &lt;</val>')).toMatchSnapshot();
  });
});

// =================================================================
// Empty elements
// =================================================================
describe('empty elements', () => {
  it('self-closing becomes null', () => {
    expect(lossy('<root><br/></root>')).toMatchSnapshot();
  });

  it('empty open/close becomes null', () => {
    expect(lossy('<root><empty></empty></root>')).toMatchSnapshot();
  });

  it('empty element with attributes becomes object with only $keys', () => {
    expect(
      lossy('<root><img src="a.png" alt="pic"/></root>'),
    ).toMatchSnapshot();
  });
});

// =================================================================
// Attributes
// =================================================================
describe('attributes', () => {
  it('attributes prefixed with $', () => {
    expect(
      lossy('<div id="main" class="wide"><p>text</p></div>'),
    ).toMatchSnapshot();
  });

  it('null-valued attribute (boolean)', () => {
    expect(lossy('<input disabled/>', { html: true })).toMatchSnapshot();
  });

  it('element with attributes and element-only children', () => {
    expect(lossy('<root lang="en"><a>1</a><b>2</b></root>')).toMatchSnapshot();
  });
});

// =================================================================
// Repeated same-name siblings
// =================================================================
describe('repeated siblings', () => {
  it('repeated tags become array', () => {
    expect(
      lossy('<list><item>A</item><item>B</item><item>C</item></list>'),
    ).toMatchSnapshot();
  });

  it('single tag is not wrapped in array', () => {
    expect(lossy('<list><item>only</item></list>')).toMatchSnapshot();
  });

  it('repeated complex elements', () => {
    expect(
      lossy('<root><x id="1"><y>a</y></x><x id="2"><y>b</y></x></root>'),
    ).toMatchSnapshot();
  });

  it('mixed repeated and unique siblings', () => {
    expect(lossy('<root><a>1</a><b>X</b><a>2</a></root>')).toMatchSnapshot();
  });
});

// =================================================================
// Single root element vs multiple top-level nodes
// =================================================================
describe('top-level handling', () => {
  it('single root returns object', () => {
    expect(lossy('<root><a>1</a></root>')).toMatchSnapshot();
  });

  it('multiple roots returns array', () => {
    expect(lossy('<a>1</a><b>2</b>')).toMatchSnapshot();
  });

  it('strips top-level whitespace text', () => {
    expect(lossy('  <root/>  ')).toMatchSnapshot();
  });
});

// =================================================================
// Deeply nested
// =================================================================
describe('deep nesting', () => {
  it('multiple levels', () => {
    expect(lossy('<a><b><c><d>deep</d></c></b></a>')).toMatchSnapshot();
  });
});

// =================================================================
// Comments
// =================================================================
describe('comments', () => {
  it('comments are dropped by default', () => {
    expect(lossy('<root><!-- hello --><a>1</a></root>')).toMatchSnapshot();
  });

  it('comments kept when keepComments is true', () => {
    expect(
      lossy('<root><!-- hello --><a>1</a></root>', {
        keepComments: true,
      }),
    ).toMatchSnapshot();
  });
});

// =================================================================
// Processing instructions
// =================================================================
describe('processing instructions', () => {
  it('xml declaration is filtered at top level', () => {
    expect(lossy('<?xml version="1.0"?><root>text</root>')).toMatchSnapshot();
  });
});

// =================================================================
// HTML mode
// =================================================================
describe('HTML mode', () => {
  it('void elements self-close', () => {
    expect(
      lossy('<div><br><p>text</p></div>', { html: true }),
    ).toMatchSnapshot();
  });

  it('img with attributes', () => {
    expect(
      lossy('<div><img src="x.png" alt="photo"><span>caption</span></div>', {
        html: true,
      }),
    ).toMatchSnapshot();
  });
});

// =================================================================
// JSON round-trip
// =================================================================
describe('JSON serialization', () => {
  it('survives JSON.stringify/parse', () => {
    const xml = '<root id="1"><a>text</a><b><c>deep</c></b></root>';
    const result = lossy(xml);
    const roundTripped = JSON.parse(JSON.stringify(result));
    expect(roundTripped).toEqual(result);
  });

  it('mixed content survives JSON round-trip', () => {
    const xml = '<p>Hello <b>world</b> end</p>';
    const result = lossy(xml);
    const roundTripped = JSON.parse(JSON.stringify(result));
    expect(roundTripped).toEqual(result);
  });
});

// =================================================================
// Fixtures
// =================================================================
describe('fixture: rss-feed.xml', () => {
  it('full output', () => {
    expect(lossy(rssFeed)).toMatchSnapshot();
  });
});

describe('fixture: soap-envelope.xml', () => {
  it('full output', () => {
    expect(lossy(soapEnvelope)).toMatchSnapshot();
  });
});

describe('fixture: atom-feed.xml', () => {
  it('full output', () => {
    expect(lossy(atomFeed)).toMatchSnapshot();
  });
});

describe('fixture: pom.xml', () => {
  it('full output', () => {
    expect(lossy(pomXml)).toMatchSnapshot();
  });
});

// =================================================================
// Edge cases
// =================================================================
describe('edge cases', () => {
  it('CDATA treated as text', () => {
    expect(lossy('<root><![CDATA[raw <text>]]></root>')).toMatchSnapshot();
  });

  it('empty root document', () => {
    expect(lossy('<root/>')).toMatchSnapshot();
  });

  it('attributes with empty string values', () => {
    expect(lossy('<input value=""/>')).toMatchSnapshot();
  });

  it('element-only children with attributes on parent', () => {
    expect(
      lossy('<root version="2"><a>x</a><b>y</b></root>'),
    ).toMatchSnapshot();
  });

  it('repeated empty elements', () => {
    expect(lossy('<root><br/><br/><br/></root>')).toMatchSnapshot();
  });

  it('mixed repeated elements with different complexity', () => {
    expect(
      lossy('<root><x>simple</x><x><y>nested</y></x></root>'),
    ).toMatchSnapshot();
  });
});
