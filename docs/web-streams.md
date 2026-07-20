# Web streams

`XmlParseStream` from `@eksml/xml/stream` is a Web Streams `TransformStream` that incrementally parses XML chunks into `TNode` subtrees (or lossy/lossless objects). It works in browsers, Node.js 18+, Deno, and Bun, and follows the platform stream class convention (like `TextDecoderStream` and `DecompressionStream`): instantiate with `new` and compose with `.pipeThrough()`. For raw events without tree construction, see the [SAX parser](./sax-parser.md); for one-shot parsing of a complete string, see [parsing](./parsing.md).

```ts
import { XmlParseStream } from '@eksml/xml/stream';

const response = await fetch('/feed.xml');
const reader = response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new XmlParseStream())
  .getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(value); // TNode or string
}
```

The stream accepts string chunks and emits completed nodes. By default a node is emitted each time a top-level element closes, so a document with one root element emits a single `TNode` after the root's close tag arrives. Processing instructions and DOCTYPEs are emitted as `TNode`s too (with `tagName` values like `'?xml'` and `'!DOCTYPE'`), and top-level comments are emitted as strings when `keepComments` is on.

Input can be split anywhere, mid-tag, mid-attribute, or mid-entity; the parser buffers the incomplete tail and resumes on the next chunk. Output is identical regardless of how the input was chunked.

## Options

<table>
  <tr>
    <th>Option</th>
    <th>Type</th>
    <th>Default</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><code>offset</code></td>
    <td><code>number | string</code></td>
    <td><code>0</code></td>
    <td>Skip this many leading characters of the input. When a string is passed, its <code>.length</code> is used. The skip may span multiple chunks.</td>
  </tr>
  <tr>
    <td><code>html</code></td>
    <td><code>boolean</code></td>
    <td><code>false</code></td>
    <td>Enable HTML mode (sets void element and raw content tag defaults, see <a href="./html.md">html</a>)</td>
  </tr>
  <tr>
    <td><code>selfClosingTags</code></td>
    <td><code>string[]</code></td>
    <td><code>[]</code> / HTML voids</td>
    <td>Tag names treated as self-closing void elements</td>
  </tr>
  <tr>
    <td><code>rawContentTags</code></td>
    <td><code>string[]</code></td>
    <td><code>[]</code> / <code>['script','style','textarea','title']</code></td>
    <td>Tag names whose content is raw text (not parsed for child elements)</td>
  </tr>
  <tr>
    <td><code>keepComments</code></td>
    <td><code>boolean</code></td>
    <td><code>false</code></td>
    <td>Include comments in the output (as strings like <code>'&lt;!-- ... --&gt;'</code>, either emitted directly at the top level or attached as children)</td>
  </tr>
  <tr>
    <td><code>select</code></td>
    <td><code>string | string[]</code></td>
    <td>--</td>
    <td>Emit only elements matching these tag names, each as it closes, regardless of nesting depth</td>
  </tr>
  <tr>
    <td><code>output</code></td>
    <td><code>'dom' | 'lossy' | 'lossless'</code></td>
    <td><code>'dom'</code></td>
    <td>Output format: <code>'dom'</code> emits <code>TNode | string</code>, <code>'lossy'</code> emits <code>LossyValue</code>, <code>'lossless'</code> emits <code>LosslessEntry</code></td>
  </tr>
  <tr>
    <td><code>bufferSize</code></td>
    <td><code>number</code></td>
    <td><code>0</code> (off)</td>
    <td>Coalesce incoming chunks until at least this many characters are buffered before parsing</td>
  </tr>
</table>

## Selecting elements from large feeds

Without `select`, a feed wrapped in a single root element produces exactly one giant `TNode` when the root closes, which defeats the point of streaming. The `select` option emits each matching element the moment its close tag is encountered, at any depth, and never builds the ancestors at all:

```ts
import { XmlParseStream } from '@eksml/xml/stream';

const response = await fetch('/feed.xml');
const items = response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new XmlParseStream({ select: 'item' }));

for await (const item of items) {
  // Each <item> subtree arrives as soon as </item> is parsed,
  // long before the enclosing root element closes.
  const title = item.children.find(
    (c) => typeof c === 'object' && c.tagName === 'title',
  );
  console.log(title?.children[0]);
}
```

Details of `select` behaviour, all verified by the test suite:

- The root and other non-matching ancestors are never emitted, and no memory is spent building them.
- Text, comments, CDATA, and processing instructions outside selected subtrees are discarded.
- `select` accepts a single tag name or an array of names.
- An empty array falls back to the default top-level behaviour.
- Matching self-closing or void elements are emitted too.

When multiple selected tags are nested, each matching element is emitted independently as it closes. The inner element appears both as its own emission and as a child within its ancestor's subtree, in close-tag order (innermost first):

```ts
const stream = new XmlParseStream({ select: ['book', 'author'] });
// Input: <library><book isbn="978-1"><author>Alice</author><author>Bob</author></book></library>
// Emits, in order:
//   { tagName: 'author', attributes: null, children: ['Alice'] }
//   { tagName: 'author', attributes: null, children: ['Bob'] }
//   { tagName: 'book', attributes: { isbn: '978-1' }, children: [ ...both authors... ] }
```

> [!note]
> Async iteration over a `ReadableStream` (`for await`) works in Node.js 18+, Deno, and Bun, but browser support is still uneven. Use the `getReader()` loop from the first example for maximum browser compatibility.

## Output modes

By default the stream emits raw `TNode | string` values. The `output` option converts each emitted item to one of the JSON-friendly formats described in [converters](./converters.md):

```ts
// Input: '<user id="1"><name>Alice</name></user>'

new XmlParseStream(); // or { output: 'dom' }
// emits: { tagName: 'user', attributes: { id: '1' },
//          children: [{ tagName: 'name', attributes: null, children: ['Alice'] }] }

new XmlParseStream({ output: 'lossy' });
// emits: { user: { $id: '1', name: 'Alice' } }

new XmlParseStream({ output: 'lossless' });
// emits: { user: [{ $attr: { id: '1' } }, { name: [{ $text: 'Alice' }] }] }
```

- `'dom'` (default) emits raw `TNode | string` values.
- `'lossy'` emits compact `LossyValue` objects, ideal for simple data extraction.
- `'lossless'` emits order-preserving `LosslessEntry` objects that can round-trip back to XML.

The `LossyValue` and `LosslessEntry` types are re-exported from `@eksml/xml/stream`. Conversion applies per emitted item, so it combines naturally with `select`:

```ts
const stream = new XmlParseStream({ select: 'item', output: 'lossy' });
// '<root><item>A</item><item>B</item></root>' emits { item: 'A' }, then { item: 'B' }
```

## Buffering small chunks

Sources that deliver very small chunks (tens of bytes, common with slow network streams) spend most of their time on per-chunk overhead. The `bufferSize` option coalesces incoming chunks into an internal buffer of at least that many characters before running the parser, so many tiny writes become one 1-4 KB parse that runs at near full-document speed:

```ts
const stream = new XmlParseStream({ select: 'item', bufferSize: 4096 });
```

The trade-off is emission latency: parsed nodes are only produced once the buffer fills (or the stream flushes at the end of input), so a slow trickle of input delays output by up to `bufferSize` characters. Anything still buffered is always parsed when the stream closes, and the final output is identical to running without buffering.

Leave it unset to parse every chunk as it arrives. Reach for it when profiling shows the stream is receiving tiny chunks and throughput matters more than reacting to each element immediately.

## Bridging from Node streams

Node readables convert to web streams with `Readable.toWeb()`:

```ts
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { XmlParseStream } from '@eksml/xml/stream';

const nodes = Readable.toWeb(createReadStream('feed.xml'))
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new XmlParseStream());
```

`TextDecoderStream` handles byte-to-string decoding, including multibyte characters split across chunk boundaries. If you prefer to stay entirely in Node stream land, the [SAX parser](./sax-parser.md) bridges to Node streams with a few lines and less machinery.

## Single-use streams

Like every `TransformStream`, an `XmlParseStream` instance represents a single pass over one input. Once its writable side is closed the instance is done; writing again rejects with a `TypeError` (in Node.js, `Invalid state: WritableStream is closed`). Construct a new `XmlParseStream` for each document you parse.

## Malformed input

`XmlParseStream` is a forgiving parser and does not error the stream on malformed XML:

- An element whose close tag never arrives is never emitted (in default mode its whole top-level subtree is dropped, because emission happens when the top-level element closes). Its text is not recovered on flush.
- Close tags are matched positionally, not by name, so a mismatched close tag like `<a><b>x</wrong></a>` still produces a well-formed tree (`</wrong>` closes `<b>`).

There is no `strict` option on the stream. If you need validation errors with line and column information, parse the complete document with `parse(input, { strict: true })` instead, see [parsing](./parsing.md).
