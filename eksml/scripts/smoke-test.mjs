/**
 * Lightweight smoke test that imports every public export from the built
 * dist/ and runs basic assertions. Used in CI to verify runtime
 * compatibility on Node versions where the dev tooling cannot run.
 *
 * Usage:  node scripts/smoke-test.mjs
 * Exit 0 on success, non-zero on failure.
 */

import assert from 'node:assert/strict';

// — parser —
const { parse } = await import('@eksml/xml/parser');
const dom = parse('<root><item id="1">hello</item></root>');
assert.equal(dom.length, 1);
assert.equal(dom[0].tagName, 'root');
assert.equal(dom[0].children.length, 1);
assert.equal(dom[0].children[0].tagName, 'item');
assert.equal(dom[0].children[0].attributes.id, '1');
assert.equal(dom[0].children[0].children[0], 'hello');

// — writer —
const { write } = await import('@eksml/xml/writer');
const xml = write(dom);
assert.equal(xml, '<root><item id="1">hello</item></root>');

// — sax —
const { createSaxParser } = await import('@eksml/xml/sax');
const tags = [];
const p = createSaxParser();
p.on('openTag', (name) => tags.push(name));
p.write('<a><b/></a>');
p.close();
assert.deepEqual(tags, ['a', 'b']);

// — stream —
const { XmlParseStream } = await import('@eksml/xml/stream');
assert.equal(typeof XmlParseStream, 'function');
const stream = new XmlParseStream();
const reader = stream.readable.getReader();
const writer = stream.writable.getWriter();
writer.write('<r><x/></r>').then(() => writer.close());
const chunks = [];
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  chunks.push(value);
}
assert.ok(chunks.length > 0);

// — lossy —
const { lossy } = await import('@eksml/xml/lossy');
const obj = lossy('<user><name>Alice</name></user>');
assert.equal(obj.user.name, 'Alice');

// — lossless —
const { lossless } = await import('@eksml/xml/lossless');
const entries = lossless('<a>text</a>');
assert.ok(Array.isArray(entries));
assert.ok(entries.length > 0);

// — fromLossy —
const { fromLossy } = await import('@eksml/xml/from-lossy');
const fromLossyDom = fromLossy({ item: 'val' });
assert.ok(Array.isArray(fromLossyDom));
assert.equal(fromLossyDom[0].tagName, 'item');

// — fromLossless —
const { fromLossless } = await import('@eksml/xml/from-lossless');
const fromLosslessDom = fromLossless([{ item: [{ $text: 'val' }] }]);
assert.ok(Array.isArray(fromLosslessDom));
assert.equal(fromLosslessDom[0].tagName, 'item');

// — utilities —
const {
  filter,
  getElementById,
  getElementsByClassName,
  toContentString,
  isTextNode,
  isElementNode,
  HTML_VOID_ELEMENTS,
  HTML_RAW_CONTENT_TAGS,
} = await import('@eksml/xml/utilities');
assert.equal(typeof filter, 'function');
assert.equal(typeof getElementById, 'function');
assert.equal(typeof getElementsByClassName, 'function');
assert.equal(typeof toContentString, 'function');
assert.equal(typeof isTextNode, 'function');
assert.equal(typeof isElementNode, 'function');
assert.ok(Array.isArray(HTML_VOID_ELEMENTS));
assert.ok(Array.isArray(HTML_RAW_CONTENT_TAGS));
assert.ok(isElementNode(dom[0]));
assert.ok(isTextNode('hello'));
assert.equal(toContentString(dom[0]), 'hello');

console.log('Smoke test passed.');
