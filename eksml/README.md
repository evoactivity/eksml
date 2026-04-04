<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./logo.svg">
  <img alt="eksml" src="./logo.svg">
</picture>

# Eksml

A fast, lightweight XML/HTML parser, serializer, and streaming toolkit for JavaScript and TypeScript. Eksml provides both a convenient class-based API and individual function exports for tree parsing, SAX streaming, object conversion, and serialization.

Built on the same core parsing architecture as [txml](https://github.com/tobiasNickel/tXml) by Tobias Nickel, Eksml improves the performances and extends it with more features.

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
import { Eksml } from 'eksml';

const xml = new Eksml();
const dom = xml.parse('<root><item id="1">Hello</item></root>');
const str = xml.write(dom);
```

---

## The `Eksml` Class

The `Eksml` class is the all-in-one entry point. It wraps every major feature behind a single import with shared configuration.

```ts
import { Eksml } from 'eksml';
```

### Constructor

```ts
const xml = new Eksml(options?: EksmlOptions);
```

### `EksmlOptions`

Extends all `ParseOptions` (see below) plus:

| Option   | Type                             | Default | Description                                                                                                                                             |
| -------- | -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `output` | `'dom' \| 'lossy' \| 'lossless'` | `'dom'` | Output format for `.parse()`. `'dom'` returns a `TNode` tree, `'lossy'` returns compact JS objects, `'lossless'` returns order-preserving JSON entries. |

### Methods

#### `xml.parse(input, overrides?)`

Parse an XML or HTML string. The return type depends on the `output` mode.

```ts
// DOM mode (default)
const xml = new Eksml();
const dom: (TNode | string)[] = xml.parse('<root>Hello</root>');

// Lossy mode
const xml = new Eksml({ output: 'lossy' });
const obj = xml.parse('<root>Hello</root>');
// => { root: "Hello" }

// Lossless mode
const xml = new Eksml({ output: 'lossless' });
const entries = xml.parse('<root>Hello</root>');
// => [{ root: [{ $text: "Hello" }] }]
```

#### `xml.write(input, options?)`

Serialize a parsed tree back to an XML/HTML string. Accepts DOM nodes, lossy objects, or lossless entries -- input format is auto-detected and converted to DOM before serialization.

```ts
const xml = new Eksml();

// From a DOM tree
const dom = xml.parse('<root><item>1</item></root>');
xml.write(dom);
// => '<root><item>1</item></root>'

xml.write(dom, { pretty: true });
// => '<root>\n  <item>1</item>\n</root>'

// From a lossy object
xml.write({ user: { name: 'Alice', age: '30' } });
// => '<user><name>Alice</name><age>30</age></user>'

// From lossless entries
xml.write([{ user: [{ $attr: { id: '1' } }, { name: [{ $text: 'Alice' }] }] }]);
// => '<user id="1"><name>Alice</name></user>'
```

#### `xml.stream(readable, overrides?)`

Pipe a `ReadableStream<string>` through an internal transform parser. Returns a `ReadableStream<TNode | string>` that emits complete subtrees as they close.

```ts
const xml = new Eksml({ html: true });
const response = await fetch('/feed.xml');
const nodes = xml.stream(response.body);

for await (const node of nodes) {
  console.log(node);
}
```

Use `select` to emit specific elements as they close at any depth:

```ts
const items = xml.stream(response.body, { select: 'item' });
```

#### `xml.sax(overrides?)`

Create an event-based SAX parser with `.on()` / `.off()` methods.

```ts
const xml = new Eksml();
const parser = xml.sax();

parser.on('opentag', (tagName, attributes) => {
  console.log('opened:', tagName, attributes);
});
parser.on('text', (text) => {
  console.log('text:', text);
});

parser.write('<root><item id="1">Hello</item>');
parser.write('</root>');
parser.close();
```

### SAX Events

| Event                   | Callback Signature                                                      | Description                            |
| ----------------------- | ----------------------------------------------------------------------- | -------------------------------------- |
| `opentag`               | `(tagName: string, attributes: Record<string, string \| null>) => void` | Opening tag with parsed attributes     |
| `closetag`              | `(tagName: string) => void`                                             | Closing tag                            |
| `text`                  | `(text: string) => void`                                                | Text content between tags              |
| `cdata`                 | `(data: string) => void`                                                | CDATA section content                  |
| `comment`               | `(comment: string) => void`                                             | Comment content                        |
| `processinginstruction` | `(name: string, body: string) => void`                                  | Processing instruction (`<?xml ...?>`) |
| `doctype`               | `(tagName: string, attributes: Record<string, string \| null>) => void` | DOCTYPE declaration                    |

---

## Functional API

Every feature is also available as a standalone function import for tree-shaking and direct use.

### `parse(xml, options?)`

```ts
import { parse } from 'eksml/parser';

const dom = parse('<root><item>Hello</item></root>');
```

#### `ParseOptions`

| Option            | Type                                    | Default                     | Description                                                       |
| ----------------- | --------------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| `pos`             | `number`                                | `0`                         | Starting character position in the string                         |
| `html`            | `boolean`                               | `false`                     | Enable HTML mode (sets void element and raw content tag defaults) |
| `selfClosingTags` | `string[]`                              | `[]` / HTML voids           | Tag names treated as self-closing void elements                   |
| `rawContentTags`  | `string[]`                              | `[]` / `['script','style']` | Tag names whose content is raw text (not parsed)                  |
| `keepComments`    | `boolean`                               | `false`                     | Include XML/HTML comments in the output tree                      |
| `trimWhitespace`  | `boolean`                               | `false`                     | Trim text nodes and discard whitespace-only text                  |
| `strict`          | `boolean`                               | `false`                     | Throw on malformed XML instead of recovering silently             |
| `entities`        | `boolean`                               | `false`                     | Decode XML/HTML entities in text and attributes                   |
| `attrName`        | `string`                                | `'id'`                      | Attribute name to search for (used with `attrValue`)              |
| `attrValue`       | `string`                                | --                          | Regex pattern to match attribute values (fast-path filter)        |
| `filter`          | `(node, index, depth, path) => boolean` | --                          | Predicate to filter nodes during parsing                          |

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

### `writer(input, options?)`

Serialize a DOM tree, lossy object, or lossless entries back to an XML/HTML string.
Input format is auto-detected — no manual conversion needed.

```ts
import { writer } from 'eksml/writer';

// DOM input
const xml = writer(dom);
const pretty = writer(dom, { pretty: true });
const html = writer(dom, { html: true, entities: true });

// Lossy input — converted to DOM automatically
const fromObj = writer({ user: { name: 'Alice', age: 30 } });
// → '<user><name>Alice</name><age>30</age></user>'

// Lossless input — converted to DOM automatically
const fromEntries = writer([
  { user: [{ name: ['Alice'] }, { role: ['admin'] }] },
]);
// → '<user><name>Alice</name><role>admin</role></user>'
```

#### `WriterOptions`

| Option     | Type                | Default | Description                                                                                                                 |
| ---------- | ------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `pretty`   | `boolean \| string` | `false` | Pretty-print with indentation. `true` uses 2 spaces; a string value is used as the indent (e.g. `'\t'`).                    |
| `entities` | `boolean`           | `false` | Encode special characters as XML/HTML entities                                                                              |
| `html`     | `boolean`           | `false` | HTML mode: void elements emit as `<br>` instead of `<br/>`, and HTML named entities are used when `entities` is also `true` |

---

### `fastStream(options?)`

A high-performance synchronous SAX parser. Feed it chunks of XML and receive events via callbacks.

```ts
import { fastStream } from 'eksml/stream';

const parser = fastStream({
  onopentag(tagName, attributes) {
    /* ... */
  },
  onclosetag(tagName) {
    /* ... */
  },
  ontext(text) {
    /* ... */
  },
  oncdata(data) {
    /* ... */
  },
  oncomment(comment) {
    /* ... */
  },
  onprocessinginstruction(name, body) {
    /* ... */
  },
  ondoctype(tagName, attributes) {
    /* ... */
  },
});

parser.write('<root><item>1</item>');
parser.write('<item>2</item></root>');
parser.close();
```

#### `FastStreamOptions`

| Option                    | Type                            | Default | Description                                     |
| ------------------------- | ------------------------------- | ------- | ----------------------------------------------- |
| `selfClosingTags`         | `string[]`                      | `[]`    | Tag names treated as self-closing void elements |
| `rawContentTags`          | `string[]`                      | `[]`    | Tag names whose content is raw text             |
| `onopentag`               | `(tagName, attributes) => void` | --      | Opening tag handler                             |
| `onclosetag`              | `(tagName) => void`             | --      | Closing tag handler                             |
| `ontext`                  | `(text) => void`                | --      | Text content handler                            |
| `oncdata`                 | `(data) => void`                | --      | CDATA section handler                           |
| `oncomment`               | `(comment) => void`             | --      | Comment handler                                 |
| `onprocessinginstruction` | `(name, body) => void`          | --      | Processing instruction handler                  |
| `ondoctype`               | `(tagName, attributes) => void` | --      | DOCTYPE handler                                 |

---

### `transformStream(offset?, options?)`

A Web Streams `TransformStream` that parses XML chunks into `TNode` subtrees. Works in browsers, Node.js 18+, Deno, and Bun.

```ts
import { transformStream } from 'eksml/transform-stream';

const response = await fetch('/feed.xml');
const reader = response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(transformStream())
  .getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(value); // TNode or string
}
```

#### `TransformStreamOptions`

| Option            | Type                 | Default                     | Description                                                                            |
| ----------------- | -------------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| `html`            | `boolean`            | `false`                     | Enable HTML mode                                                                       |
| `selfClosingTags` | `string[]`           | `[]` / HTML voids           | Tag names treated as self-closing                                                      |
| `rawContentTags`  | `string[]`           | `[]` / `['script','style']` | Tag names whose content is raw text                                                    |
| `keepComments`    | `boolean`            | `false`                     | Include comments in the output                                                         |
| `select`          | `string \| string[]` | --                          | Emit only elements matching these tag names as they close, regardless of nesting depth |

The `select` option is particularly useful for large feeds:

```ts
// Emit each <item> independently instead of waiting for the root to close
const ts = transformStream(undefined, { select: 'item' });
```

---

### `lossy(input, options?)`

Convert XML into compact JavaScript objects. Ideal when you need a simple JS representation and don't care about preserving document order between mixed siblings.

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

---

### `lossless(input, options?)`

Convert XML into an order-preserving JSON-friendly structure. Every node, attribute, text segment, and comment is represented in document order.

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

---

### `fromLossy(input)` / `fromLossless(entries)`

Convert lossy or lossless representations back into `TNode` DOM trees.

> **Note:** `writer()` auto-detects lossy and lossless inputs, so you rarely
> need these directly. They're useful when you want the DOM tree for inspection
> or further manipulation before serializing.

```ts
import { fromLossy } from 'eksml/from-lossy';
import { fromLossless } from 'eksml/from-lossless';
import { writer } from 'eksml/writer';

// Explicit conversion (when you need the DOM tree)
const dom = fromLossy({ user: { name: 'Alice' } });
writer(dom); // => '<user><name>Alice</name></user>'

// Or just pass lossy/lossless directly to writer()
writer({ user: { name: 'Alice' } }); // same result
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

| Export                                     | Description                                                          |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `filter(input, predicate)`                 | Recursively walk a tree and return all `TNode`s matching a predicate |
| `getElementById(input, id)`                | Find an element by its `id` attribute                                |
| `getElementsByClassName(input, className)` | Find elements by class name (supports multi-class attributes)        |
| `toContentString(node)`                    | Extract concatenated text content from a node or tree                |
| `isTextNode(node)`                         | Type guard: `node is string`                                         |
| `isElementNode(node)`                      | Type guard: `node is TNode`                                          |
| `HTML_VOID_ELEMENTS`                       | Standard HTML void element tag names                                 |
| `HTML_RAW_CONTENT_TAGS`                    | HTML raw content tag names (`script`, `style`)                       |

---

## Benchmarks

All benchmarks run via [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) on Node.js. Fixtures range from ~100 B to ~30 KB of real-world XML (RSS feeds, Atom feeds, SOAP envelopes, Maven POMs, XMLTV EPGs). Full benchmark source is in [`bench/`](./bench/).

### DOM Parsing

Parse an XML string into a tree structure.

| Library         |     small (~100 B) |     RSS (~3 KB) |    SOAP (~2 KB) |    Atom (~3 KB) |     POM (~5 KB) |     EPG (~9 KB) |
| --------------- | -----------------: | --------------: | --------------: | --------------: | --------------: | --------------: |
| **eksml**       | **1,361,164 op/s** | **86,551 op/s** | **61,091 op/s** | **33,542 op/s** | **12,916 op/s** | **17,004 op/s** |
| txml            |       906,585 op/s |              -- |     48,017 op/s |     26,981 op/s |     11,032 op/s |     13,317 op/s |
| htmlparser2     |       470,327 op/s |     24,047 op/s |     16,455 op/s |      9,791 op/s |      3,442 op/s |      4,732 op/s |
| fast-xml-parser |       169,185 op/s |      9,412 op/s |      7,133 op/s |      3,482 op/s |      1,313 op/s |      2,279 op/s |
| xml2js          |       130,322 op/s |      8,832 op/s |      6,414 op/s |      3,833 op/s |      1,556 op/s |      2,015 op/s |
| @xmldom/xmldom  |        92,091 op/s |      5,834 op/s |      4,770 op/s |      2,469 op/s |        861 op/s |      1,378 op/s |

eksml is **1.2-1.5x faster than txml**, **3-4x faster than htmlparser2**, **7-10x faster than fast-xml-parser**, and **8-15x faster than xmldom**.

### SAX Streaming (256 B chunks, with tree building)

Chunked streaming parse where each parser tokenizes SAX events and builds a full DOM tree.

| Library                 |     RSS (~3 KB) |     EPG (~9 KB) |    POM (~5 KB) | EPG 64 B stress |
| ----------------------- | --------------: | --------------: | -------------: | --------------: |
| **eksml (fastStream)**  | **73,744 op/s** | **12,385 op/s** | **8,313 op/s** | **11,452 op/s** |
| eksml (transformStream) |     31,459 op/s |      7,764 op/s |     5,967 op/s |      4,559 op/s |
| saxes                   |     29,121 op/s |      6,628 op/s |     6,791 op/s |      6,284 op/s |
| htmlparser2             |     27,279 op/s |      7,372 op/s |     5,919 op/s |      6,821 op/s |
| sax                     |     12,224 op/s |      3,720 op/s |     3,078 op/s |      4,013 op/s |

eksml's SAX engine is **1.6-2.5x faster than htmlparser2/saxes** and **3-6x faster than sax**.

### Raw Tokenization (no-op callbacks)

Pure scanner throughput with no downstream work -- isolates the tokenizer's raw speed.

| Library                |     RSS (~3 KB) |     EPG (~9 KB) |     POM (~5 KB) | EPG 64 B stress |
| ---------------------- | --------------: | --------------: | --------------: | --------------: |
| **eksml (fastStream)** | **85,798 op/s** | **16,367 op/s** | **13,465 op/s** | **14,763 op/s** |
| saxes                  |     34,370 op/s |      8,990 op/s |      8,484 op/s |      8,965 op/s |
| htmlparser2            |     28,558 op/s |      7,534 op/s |      6,126 op/s |      6,980 op/s |
| sax                    |     15,331 op/s |      4,193 op/s |      3,183 op/s |      3,950 op/s |

### XML Serialization (tree to string)

Serialize a pre-parsed in-memory tree back to XML.

| Library         |     small (~100 B) |      RSS (~3 KB) |     SOAP (~3 KB) |    Atom (~6 KB) |     POM (~8 KB) |    EPG (~30 KB) |
| --------------- | -----------------: | ---------------: | ---------------: | --------------: | --------------: | --------------: |
| **eksml**       | **1,885,288 op/s** | **308,059 op/s** |     195,102 op/s |     87,992 op/s | **52,345 op/s** |     34,001 op/s |
| txml            | **2,459,009 op/s** |               -- | **226,242 op/s** | **95,098 op/s** |     48,697 op/s | **43,192 op/s** |
| htmlparser2     |     1,996,848 op/s |      99,635 op/s |      72,448 op/s |     29,742 op/s |     14,393 op/s |     16,840 op/s |
| @xmldom/xmldom  |     1,075,965 op/s |      44,446 op/s |      38,996 op/s |     14,354 op/s |      7,318 op/s |     10,038 op/s |
| fast-xml-parser |       356,881 op/s |      23,261 op/s |      27,979 op/s |     11,582 op/s |      4,622 op/s |      3,435 op/s |
| xml2js          |       220,393 op/s |      16,480 op/s |      19,606 op/s |      8,577 op/s |      4,114 op/s |      4,174 op/s |

eksml and txml trade top position depending on document size and shape. Both are **3-7x faster than @xmldom/xmldom** and **7-13x faster than fast-xml-parser/xml2js** at serialization.

---

## Acknowledgments

eksml's DOM parser is built on the work of **[Tobias Nickel](https://github.com/nickel-org)** and his [txml](https://github.com/tobiasNickel/tXml) library. The core parsing architecture -- a single-pass, position-tracking string scanner that builds the tree as it goes -- is what makes both libraries so fast. txml demonstrated that you don't need a separate tokenizer-then-tree-builder pipeline to parse XML at high speed, and eksml carries that insight forward.

eksml extends txml's foundation with:

- A high-performance SAX streaming engine (`fastStream`)
- A Web Streams `TransformStream` for incremental parsing
- Lossy and lossless JSON converters with round-trip support
- HTML-aware parsing and serialization (void elements, raw content tags, entity encoding)
- Strict mode validation
- Entity decoding (XML and full HTML named entities)
- A unified `Eksml` class API

Thank you, Tobias, for the elegant approach that made all of this possible.

---

## Why is eksml So Fast?

Most XML parsers follow a two-phase architecture: first tokenize the input into a stream of events (open tag, close tag, text, etc.), then build a tree from those events. This means the input is traversed at least twice, with intermediate allocations for every event.

eksml's DOM parser takes a different approach inherited from txml: **it builds the tree in a single pass directly from the input string**. There is no intermediate token stream, no event objects, no callback dispatch during tree construction. The parser advances a position cursor through the string, recognizes structural characters (`<`, `>`, `/`, `=`, quotes), and constructs `TNode` objects in-place as it goes.

Key architectural decisions that contribute to speed:

- **No intermediate representation.** The parser reads characters and writes tree nodes. No tokens, no events, no temporary strings that get discarded.
- **Minimal allocation.** Attributes use `Object.create(null)` only when they exist (otherwise `null`). Text nodes are plain strings. No wrapper objects.
- **`substring` over concatenation.** String values are extracted with `substring()` which in V8 can reference the original string's backing store rather than copying.
- **Batch scanning in the SAX engine.** `fastStream` uses `indexOf` to skip past known-safe regions (e.g., scanning for `>` to find the end of a tag, or `]]>` to find the end of CDATA). This lets V8's optimized native string search handle the inner loop.
- **Synchronous, zero-overhead callbacks.** `fastStream`'s SAX callbacks are plain function calls -- no event emitter dispatch, no promise resolution, no queue management.
- **No validation by default.** The parser is fault-tolerant and recovers from malformed input rather than spending cycles validating structure. Strict mode is opt-in.

---

## Limitations

eksml optimizes for speed and simplicity, which means it intentionally does not cover every XML use case:

- **Not a validating parser.** eksml does not validate against DTDs or XML Schema. It parses structure, not semantics.
- **No namespace support.** Namespace prefixes are preserved in tag and attribute names (e.g. `soap:Envelope`) but not resolved to URIs. There is no namespace-aware API.
- **No XPath or CSS selectors.** Querying uses simple functions like `filter()`, `getElementById()`, and `getElementsByClassName()`. For complex queries, use the DOM output with a dedicated query library.
- **Entity decoding is opt-in.** By default, entities like `&amp;` and `&#x20;` are left as-is in text and attribute values. Pass `entities: true` to decode them.
- **Streaming always emits DOM nodes.** The `transformStream` and `stream()` API emit `TNode` subtrees regardless of the class-level `output` mode. Convert after receiving if you need lossy/lossless format.
- **Not a drop-in replacement for the W3C DOM.** `TNode` is a plain object with `tagName`, `attributes`, and `children` -- not a `Node`/`Element`/`Document` with methods like `querySelector`, `parentNode`, etc.
- **Single-threaded.** Parsing runs synchronously on the calling thread. For CPU-bound workloads with very large documents, consider offloading to a Web Worker.

---

## License

MIT
