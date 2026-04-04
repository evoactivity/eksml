# eksml usage guide

eksml exports three main APIs plus two object converters. They all parse XML (and optionally HTML), but they're designed for different situations.

## `parse()` — synchronous, returns a DOM tree

Use when you have the full XML string in memory and want a complete tree of nodes.

```ts
import { parse } from 'eksml';

const nodes = parse('<root><item id="1">hello</item></root>');
// nodes[0].tagName === "root"
// nodes[0].children[0].tagName === "item"
// nodes[0].children[0].children[0] === "hello"
```

Each node is a `TNode`:

```ts
interface TNode {
  tagName: string;
  attributes: Record<string, string | null>;
  children: (TNode | string)[];
}
```

**Pick this when:**

- You already have the full document as a string
- You want a tree structure you can walk, query, or transform
- Performance matters — this is the fastest way to get a DOM tree (2-17x faster than fast-xml-parser, xml2js, xmldom)

## `new XmlParseStream()` — async streaming, emits DOM subtrees

Use when XML arrives in chunks (network response, file stream) and you want `TNode` trees as they complete.

```ts
import { XmlParseStream } from 'eksml/stream';

const stream = new XmlParseStream();
const response = await fetch('https://example.com/feed.xml');
const nodes = [];

for await (const node of response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(stream)) {
  // each node is a TNode or comment string
  nodes.push(node);
}
```

Returns a standard `TransformStream<string, TNode | string>` — works in browsers, Node.js 18+, Deno, and Bun.

Set `output` to get lossy or lossless objects directly from the stream:

```ts
// Lossy output — each item is a LossyValue
const lossy = new XmlParseStream({ output: 'lossy' });

// Lossless output — each item is a LosslessEntry
const lossless = new XmlParseStream({ output: 'lossless' });
```

**Pick this when:**

- XML arrives incrementally (HTTP responses, WebSockets, file reads)
- You want complete `TNode` subtrees without building them yourself
- You need backpressure handling via the Web Streams API
- You want lossy/lossless conversion without a separate post-processing step

## `createSaxParser()` — EventEmitter-style SAX parser, fires callbacks

Use when you need maximum throughput and don't need a tree — or when you want full control over how events are processed.

```ts
import { createSaxParser } from 'eksml/sax';

const parser = createSaxParser();

parser.on('opentag', (name, attrs) => {
  console.log(`<${name}>`, attrs);
});
parser.on('text', (text) => {
  console.log(text);
});
parser.on('closetag', (name) => {
  console.log(`</${name}>`);
});

parser.write(chunk1);
parser.write(chunk2);
parser.close();
```

Available events: `opentag`, `closetag`, `text`, `cdata`, `comment`, `processinginstruction`, `doctype`.

**Pick this when:**

- You're processing large documents and only need specific data (e.g. counting tags, extracting one field)
- You want to build your own data structures directly from events
- Raw speed is the priority — 1.3-2.7x faster than htmlparser2 and saxes

## `lossless()` — order-preserving XML-to-JSON

Converts XML into a JSON-friendly structure that preserves element order, mixed content, and attributes losslessly. Each element is `{ tagName: children[] }`, text is `{ $text: "..." }`, attributes are `{ $attr: {...} }`. All marker keys are valid JS identifiers — use dot notation: `entry.$attr.id`, `entry.$text`.

```ts
import { lossless } from 'eksml';

const result = lossless('<root attr="1"><item>hello</item></root>');
// [{ "root": [{ $attr: { "attr": "1" } }, { "item": [{ $text: "hello" }] }] }]
```

**Pick this when:**

- You need fully lossless output preserving exact sibling order
- You want a JSON-serializable format for storage or IPC

## `lossy()` — simplified lossy XML-to-JS objects

Produces the most compact JS object representation. Text-only elements collapse to strings, empty elements become `null`, repeated siblings become arrays, attributes are `$`-prefixed keys (e.g. `node.$href`), mixed content uses a `$$` array. All marker keys are valid JS identifiers. Sibling order between different tag names is lost.

```ts
import { lossy } from 'eksml';

const result = lossy('<root><name>Alice</name><age>30</age></root>');
// { root: { name: "Alice", age: "30" } }
```

**Pick this when:**

- You want the simplest possible object shape for easy property access
- You don't need to preserve sibling ordering across different tag names

## HTML mode

All APIs support HTML via the `html` option. This sets sensible defaults for void elements (`<br>`, `<img>`, etc.) and raw content tags (`<script>`, `<style>`).

```ts
parse('<div><br><img src="a.png"><p>text</p></div>', { html: true });

new XmlParseStream({ html: true });

createSaxParser({ html: true });

lossy('<div><br><p>text</p></div>', { html: true });
```

## Quick reference

|          | `parse()`                    | `new XmlParseStream()`     | `createSaxParser()`               | `lossless()`      | `lossy()`            |
| -------- | ---------------------------- | -------------------------- | --------------------------------- | ----------------- | -------------------- |
| Input    | full string                  | chunked strings            | chunked strings                   | full string       | full string          |
| Output   | `TNode[]` tree               | `TNode` / lossy / lossless | SAX events via `.on()`            | `LosslessEntry[]` | keyed objects        |
| Async    | no                           | yes                        | no                                | no                | no                   |
| Lossless | yes                          | yes                        | yes                               | yes               | no (sibling order)   |
| Best for | full documents, tree walking | streaming with any format  | max throughput, custom processing | JSON storage/IPC  | easy property access |
