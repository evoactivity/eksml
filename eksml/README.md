<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./logo.svg">
  <img alt="Eksml" src="./logo.svg">
</picture>

# Eksml

A fast, lightweight XML/HTML parser, serializer, and streaming toolkit for JavaScript and TypeScript. Import only what you need — tree parsing, SAX streaming, object conversion, or serialization — each as a standalone export.

Built on the same core parsing architecture as [tXml](https://github.com/tobiasNickel/tXml) by Tobias Nickel, Eksml improves the performance and extends it with additional features.

**[Try the interactive demo](https://evoactivity.github.io/eksml/)**

## Installation

```bash
pnpm add eksml
```

```bash
npm install eksml
```

```bash
yarn add eksml
```

## Quick Start

```ts
import { parse } from 'eksml/parser';
import { write } from 'eksml/writer';

const dom = parse('<root><item id="1">Hello</item></root>');
const str = write(dom);
```

---

## API

```ts
import { parse } from 'eksml/parser';

const dom = parse('<root><item>Hello</item></root>');
```

#### `ParseOptions`

<table>
  <tr>
    <th>Option</th>
    <th>Type</th>
    <th>Default</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><code>pos</code></td>
    <td><code>number</code></td>
    <td><code>0</code></td>
    <td>Starting character position in the string</td>
  </tr>
  <tr>
    <td><code>html</code></td>
    <td><code>boolean</code></td>
    <td><code>false</code></td>
    <td>Enable HTML mode (sets void element and raw content tag defaults)</td>
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
    <td><code>[]</code> / <code>['script','style']</code></td>
    <td>Tag names whose content is raw text (not parsed)</td>
  </tr>
  <tr>
    <td><code>keepComments</code></td>
    <td><code>boolean</code></td>
    <td><code>false</code></td>
    <td>Include XML/HTML comments in the output tree</td>
  </tr>
  <tr>
    <td><code>trimWhitespace</code></td>
    <td><code>boolean</code></td>
    <td><code>false</code></td>
    <td>Trim text nodes and discard whitespace-only text</td>
  </tr>
  <tr>
    <td><code>strict</code></td>
    <td><code>boolean</code></td>
    <td><code>false</code></td>
    <td>Throw on malformed XML instead of recovering silently</td>
  </tr>
  <tr>
    <td><code>entities</code></td>
    <td><code>boolean</code></td>
    <td><code>false</code></td>
    <td>Decode XML/HTML entities in text and attributes</td>
  </tr>
  <tr>
    <td><code>attrName</code></td>
    <td><code>string</code></td>
    <td><code>'id'</code></td>
    <td>Attribute name to search for (used with <code>attrValue</code>)</td>
  </tr>
  <tr>
    <td><code>attrValue</code></td>
    <td><code>string</code></td>
    <td>--</td>
    <td>Regex pattern to match attribute values (fast-path filter)</td>
  </tr>
  <tr>
    <td><code>filter</code></td>
    <td><code>(node, index, depth, path) =&gt; boolean</code></td>
    <td>--</td>
    <td>Predicate to filter nodes during parsing</td>
  </tr>
</table>

#### `TNode`

```ts
interface TNode {
  tagName: string;
  attributes: Record<string, string | null> | null;
  children: (TNode | string)[];
}
```

- `attributes` is `null` when the element has no attributes.
- Attribute values are `string` for valued attributes, `null` for boolean attributes (e.g. `<input disabled>`).

---

### `write(input, options?)`

Serialize a DOM tree, lossy object, or lossless entries back to an XML/HTML string.
Input format is auto-detected — no manual conversion needed.

```ts
import { write } from 'eksml/writer';

// DOM input
const xml = write(dom);
const pretty = write(dom, { pretty: true });
const html = write(dom, { html: true, entities: true });

// Lossy input — converted to DOM automatically
const fromObj = write({ user: { name: 'Alice', age: 30 } });
// -> '<user><name>Alice</name><age>30</age></user>'

// Lossless input — converted to DOM automatically
const fromEntries = write([
  { user: [{ name: ['Alice'] }, { role: ['admin'] }] },
]);
// -> '<user><name>Alice</name><role>admin</role></user>'
```

#### `WriterOptions`

<table>
  <tr>
    <th>Option</th>
    <th>Type</th>
    <th>Default</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><code>pretty</code></td>
    <td><code>boolean | string</code></td>
    <td><code>false</code></td>
    <td>
      Pretty-print with indentation. <code>true</code> uses 2 spaces; a string
      value is used as the indent (e.g. <code>'\t'</code>).
    </td>
  </tr>
  <tr>
    <td><code>entities</code></td>
    <td><code>boolean</code></td>
    <td><code>false</code></td>
    <td>Encode special characters as XML/HTML entities</td>
  </tr>
  <tr>
    <td><code>html</code></td>
    <td><code>boolean</code></td>
    <td><code>false</code></td>
    <td>
      HTML mode: void elements emit as <code>&lt;br&gt;</code> instead of
      <code>&lt;br/&gt;</code>, and HTML named entities are used when
      <code>entities</code> is also <code>true</code>
    </td>
  </tr>
</table>

---

### `createSaxParser(options?)`

A high-performance EventEmitter-style SAX parser. Feed it chunks of XML and receive events via `.on()` / `.off()` handlers. Handlers can be added and removed dynamically at any time.

```ts
import { createSaxParser } from 'eksml/sax';

const parser = createSaxParser();

parser.on('openTag', (tagName, attributes) => {
  console.log('opened:', tagName, attributes);
});
parser.on('text', (text) => {
  console.log('text:', text);
});

parser.write('<root><item>1</item>');
parser.write('<item>2</item></root>');
parser.close();

// Remove a handler
parser.off('openTag', myHandler);
```

#### `SaxParserOptions`

<table>
  <tr>
    <th>Option</th>
    <th>Type</th>
    <th>Default</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><code>html</code></td>
    <td><code>boolean</code></td>
    <td><code>false</code></td>
    <td>Enable HTML mode (sets void element and raw content tag defaults)</td>
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
    <td><code>[]</code> / <code>['script','style']</code></td>
    <td>Tag names whose content is raw text</td>
  </tr>
</table>

#### SAX Events

<table>
  <tr>
    <th>Event</th>
    <th>Handler signature</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><code>openTag</code></td>
    <td><code>(tagName, attributes) =&gt; void</code></td>
    <td>Opening tag with parsed attributes</td>
  </tr>
  <tr>
    <td><code>closeTag</code></td>
    <td><code>(tagName) =&gt; void</code></td>
    <td>Closing tag</td>
  </tr>
  <tr>
    <td><code>text</code></td>
    <td><code>(text) =&gt; void</code></td>
    <td>Text content between tags</td>
  </tr>
  <tr>
    <td><code>cdata</code></td>
    <td><code>(data) =&gt; void</code></td>
    <td>CDATA section content</td>
  </tr>
  <tr>
    <td><code>comment</code></td>
    <td><code>(comment) =&gt; void</code></td>
    <td>Comment (full <code>&lt;!-- ... --&gt;</code> string including delimiters)</td>
  </tr>
  <tr>
    <td><code>processingInstruction</code></td>
    <td><code>(name, body) =&gt; void</code></td>
    <td>Processing instruction</td>
  </tr>
  <tr>
    <td><code>doctype</code></td>
    <td><code>(tagName, attributes) =&gt; void</code></td>
    <td>DOCTYPE declaration</td>
  </tr>
</table>

---

### `new XmlParseStream(options?)`

A Web Streams `TransformStream` that parses XML chunks into `TNode` subtrees. Works in browsers, Node.js 18+, Deno, and Bun. Follows the platform stream class convention (`TextDecoderStream`, `DecompressionStream`, etc.).

```ts
import { XmlParseStream } from 'eksml/stream';

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

#### `XmlParseStreamOptions`

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
    <td>Starting byte offset — skip this many leading characters. When a string is passed, its <code>.length</code> is used.</td>
  </tr>
  <tr>
    <td><code>html</code></td>
    <td><code>boolean</code></td>
    <td><code>false</code></td>
    <td>Enable HTML mode</td>
  </tr>
  <tr>
    <td><code>selfClosingTags</code></td>
    <td><code>string[]</code></td>
    <td><code>[]</code> / HTML voids</td>
    <td>Tag names treated as self-closing</td>
  </tr>
  <tr>
    <td><code>rawContentTags</code></td>
    <td><code>string[]</code></td>
    <td><code>[]</code> / <code>['script','style']</code></td>
    <td>Tag names whose content is raw text</td>
  </tr>
  <tr>
    <td><code>keepComments</code></td>
    <td><code>boolean</code></td>
    <td><code>false</code></td>
    <td>Include comments in the output</td>
  </tr>
  <tr>
    <td><code>select</code></td>
    <td><code>string | string[]</code></td>
    <td>--</td>
    <td>Emit only elements matching these tag names as they close, regardless of nesting depth</td>
  </tr>
  <tr>
    <td><code>output</code></td>
    <td><code>'dom' | 'lossy' | 'lossless'</code></td>
    <td><code>'dom'</code></td>
    <td>Output format — <code>'dom'</code> emits <code>TNode | string</code>, <code>'lossy'</code> emits <code>LossyValue</code>, <code>'lossless'</code> emits <code>LosslessEntry</code></td>
  </tr>
</table>

The `select` option is particularly useful for large feeds:

```ts
// Emit each <item> independently instead of waiting for the root to close
const stream = new XmlParseStream({ select: 'item' });
```

---

### `lossy(input, options?)`

Convert XML into compact JavaScript objects. Ideal when you need a simple JS representation and don't care about preserving document order between mixed siblings.

`input` is `string | (TNode | string)[]` — pass a raw XML string, or a pre-parsed DOM array (from `parse()` or `stream()`).

```ts
import { lossy } from 'eksml/lossy';

lossy('<user><name>Alice</name><age>30</age></user>');
// => { user: { name: "Alice", age: "30" } }
```

- Text-only elements become string values
- Empty/void elements become `null`
- Attributes are `$`-prefixed keys (e.g. `$href`)
- Repeated same-name siblings become arrays
- Mixed content (text interleaved with elements) is stored in a `$$` array

> [!note]
> Accepts the same ParseOptions as parse().

---

### `lossless(input, options?)`

Convert XML into an order-preserving JSON-friendly structure. Every node, attribute, text segment, and comment is represented in document order.

`input` is `string | (TNode | string)[]` — pass a raw XML string, or a pre-parsed DOM array (from `parse()` or `stream()`).

```ts
import { lossless } from 'eksml/lossless';

lossless('<user id="1"><name>Alice</name></user>');
// => [{ user: [{ $attr: { id: "1" } }, { name: [{ $text: "Alice" }] }] }]
```

Each entry type:

- Element: `{ tagName: children[] }`
- Text: `{ $text: "..." }`
- Attributes: `{ $attr: { ... } }` (first child of its element)
- Comment: `{ $comment: "..." }`

> [!note]
> Accepts the same ParseOptions as parse().

---

### `fromLossy(input)` / `fromLossless(entries)`

Convert lossy or lossless representations back into `TNode` DOM trees.

> **Note:** `write()` auto-detects lossy and lossless inputs, so you rarely
> need these directly. They're useful when you want the DOM tree for inspection
> or further manipulation before serializing.

```ts
import { fromLossy } from 'eksml/from-lossy';
import { fromLossless } from 'eksml/from-lossless';
import { write } from 'eksml/writer';

// Explicit conversion (when you need the DOM tree)
const dom = fromLossy({ user: { name: 'Alice' } });
write(dom); // => '<user><name>Alice</name></user>'

// Or just pass lossy/lossless directly to write()
write({ user: { name: 'Alice' } }); // same result
```

---

### Utilities

```ts
import {
  filter,
  getElementById,
  getElementsByClassName,
  toContentString,
  isTextNode,
  isElementNode,
  HTML_VOID_ELEMENTS,
  HTML_RAW_CONTENT_TAGS,
} from 'eksml/utilities';
```

<table>
  <tr>
    <th>Export</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><code>filter(input, predicate)</code></td>
    <td>Recursively walk a tree and return all <code>TNode</code>s matching a predicate</td>
  </tr>
  <tr>
    <td><code>getElementById(input, id)</code></td>
    <td>Find an element by its <code>id</code> attribute</td>
  </tr>
  <tr>
    <td><code>getElementsByClassName(input, className)</code></td>
    <td>Find elements by class name (supports multi-class attributes)</td>
  </tr>
  <tr>
    <td><code>toContentString(node)</code></td>
    <td>Extract concatenated text content from a node or tree</td>
  </tr>
  <tr>
    <td><code>isTextNode(node)</code></td>
    <td>Type guard: <code>node is string</code></td>
  </tr>
  <tr>
    <td><code>isElementNode(node)</code></td>
    <td>Type guard: <code>node is TNode</code></td>
  </tr>
  <tr>
    <td><code>HTML_VOID_ELEMENTS</code></td>
    <td>Standard HTML void element tag names</td>
  </tr>
  <tr>
    <td><code>HTML_RAW_CONTENT_TAGS</code></td>
    <td>HTML raw content tag names (<code>script</code>, <code>style</code>)</td>
  </tr>
</table>

---

## Benchmarks

Eksml is consistently the fastest across parsing, streaming, and serialization. Benchmarks run via [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) against real-world XML fixtures from ~100 B to ~30 KB.

- **DOM parsing**: 1.2-1.5x faster than tXml, 3-4x faster than htmlparser2, 7-15x faster than fast-xml-parser/xml2js/xmldom
- **SAX streaming**: 1.6-2.5x faster than htmlparser2/saxes, 3-6x faster than sax
- **Raw tokenization**: 2-2.5x faster than saxes, 2-3x faster than htmlparser2, 4-6x faster than sax
- **Serialization**: Trades top position with tXml; both are 3-7x faster than xmldom and 7-13x faster than fast-xml-parser/xml2js

Full results with per-fixture op/s tables: **[BENCHMARKS.md](./BENCHMARKS.md)**

Run similar benchmarks in your browser: **[Interactive benchmark](https://evoactivity.github.io/eksml/benchmark)**

---

## HTML Support

Eksml can parse and serialize HTML, but it is **not an HTML spec-compliant parser**. It does not implement the [WHATWG HTML parsing algorithm](https://html.spec.whatwg.org/multipage/parsing.html) — there is no tokenizer state machine, no tree construction stage, no implicit element insertion, and no error recovery for malformed markup.

What Eksml does provide is a set of **HTML-aware options** that cover the most common differences between XML and HTML:

- **Void elements** — `<br>`, `<img>`, `<input>`, etc. are recognized as self-closing when `html: true` is set (or when you provide a custom `selfClosingTags` list). The full list is exported as `HTML_VOID_ELEMENTS` from `eksml/utilities`.
- **Raw content tags** — `<script>` and `<style>` content is treated as raw text (not parsed for child elements) when `html: true` is set. Customizable via `rawContentTags`. Exported as `HTML_RAW_CONTENT_TAGS`.
- **Entity encoding** — The writer uses HTML named entities (e.g. `&nbsp;`, `&copy;`) instead of numeric references when `html: true` and `entities: true` are both set.
- **Serialization style** — Void elements serialize as `<br>` instead of `<br/>` in HTML mode.

This is sufficient for well-formed HTML and most real-world documents. However, Eksml will not handle things like:

- Optional closing tags (`<li>` without `</li>`, `<p>` auto-closed by a sibling `<p>`)
- Implicit elements (`<html>`, `<head>`, `<body>` inserted by the spec when missing)
- Misnested formatting tags (the adoption agency algorithm)
- `<table>` foster parenting

If you need full HTML spec compliance, use a dedicated HTML parser like [parse5](https://github.com/inikulin/parse5) or the browser's built-in `DOMParser`.

---

## Acknowledgments

Eksml's DOM parser is built on the work of **[Tobias Nickel](https://github.com/nickel-org)** and his [tXml](https://github.com/tobiasNickel/tXml) library. The core parsing architecture, a single-pass, position-tracking string scanner that builds the tree as it goes, is what makes both libraries so fast. tXml demonstrated that you don't need a separate tokenizer-then-tree-builder pipeline to parse XML at high speed, and Eksml carries that insight forward.

Eksml extends tXml's foundation with:

- A high-performance SAX streaming engine with an EventEmitter-style API (`createSaxParser`)
- A Web Streams `TransformStream` for incremental parsing (`XmlParseStream`)
- Lossy and lossless JSON converters with round-trip support
- HTML-aware parsing and serialization (void elements, raw content tags, entity encoding)
- Strict mode validation
- Entity decoding (XML and full HTML named entities)

Thank you, Tobias, for the elegant approach that made all of this possible.

---

## Limitations

Eksml optimizes for speed and simplicity, which means it intentionally does not cover every XML use case:

- **Not a validating parser.** Eksml does not validate against DTDs or XML Schema. It parses structure, not semantics.
- **No namespace support.** Namespace prefixes are preserved in tag and attribute names (e.g. `soap:Envelope`) but not resolved to URIs. There is no namespace-aware API.
- **No XPath or CSS selectors.** Querying uses simple functions like `filter()`, `getElementById()`, and `getElementsByClassName()`. For complex queries, use the DOM output with a dedicated query library.
- **Entity decoding is opt-in.** By default, entities like `&amp;` and `&#x20;` are left as-is in text and attribute values. Pass `entities: true` to decode them.
- **Not a drop-in replacement for the W3C DOM.** `TNode` is a plain object with `tagName`, `attributes`, and `children` -- not a `Node`/`Element`/`Document` with methods like `querySelector`, `parentNode`, etc.
- **Single-threaded.** Parsing runs synchronously on the calling thread. For CPU-bound workloads with very large documents, consider offloading to a Web Worker.

---

## License

MIT
