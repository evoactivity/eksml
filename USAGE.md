# eksml usage guide

eksml exports five main APIs. They all parse XML (and optionally HTML), but they're designed for different situations.

## `parse()` — synchronous, returns a DOM tree

Use when you have the full XML string in memory and want a complete tree of nodes.

```ts
import { parse } from "eksml";

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

## `transformStream()` — async streaming, emits DOM subtrees

Use when XML arrives in chunks (network response, file stream) and you want `TNode` trees as they complete.

```ts
import { transformStream } from "eksml";

const stream = transformStream();
const response = await fetch("https://example.com/feed.xml");
const nodes = [];

for await (const node of response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(stream)) {
  // each node is a TNode or comment string
  nodes.push(node);
}
```

Returns a standard `TransformStream<string, TNode | string>` — works in browsers, Node.js 18+, Deno, and Bun.

**Pick this when:**

- XML arrives incrementally (HTTP responses, WebSockets, file reads)
- You want complete `TNode` subtrees without building them yourself
- You need backpressure handling via the Web Streams API

## `fastStream()` — synchronous SAX parser, fires callbacks

Use when you need maximum throughput and don't need a tree — or when you want full control over how events are processed.

```ts
import { fastStream } from "eksml";

const parser = fastStream({
  onopentag(name, attrs) {
    console.log(`<${name}>`, attrs);
  },
  ontext(text) {
    console.log(text);
  },
  onclosetag(name) {
    console.log(`</${name}>`);
  },
});

parser.write(chunk1);
parser.write(chunk2);
parser.close();
```

Available callbacks: `onopentag`, `onclosetag`, `ontext`, `oncdata`, `oncomment`, `onprocessinginstruction`.

**Pick this when:**

- You're processing large documents and only need specific data (e.g. counting tags, extracting one field)
- You want to build your own data structures directly from events
- Raw speed is the priority — 1.3-2.7x faster than htmlparser2 and saxes

## `tojs()` — lossless XML-to-JS object conversion

Use when you want a plain JS object tree instead of `TNode`. Each element becomes `{ $name, $attrs, $children }` — preserving exact element ordering, mixed content, and all attributes losslessly.

```ts
import { tojs } from "eksml";

const result = tojs('<root attr="1"><item>hello</item></root>');
// result[0].$name === "root"
// result[0].$attrs === { attr: "1" }
// result[0].$children[0].$name === "item"
// result[0].$children[0].$children[0] === "hello"
```

Each element is a `JsNode`:

```ts
interface JsNode {
  $name: string;
  $attrs: Record<string, string | null>;
  $children: (JsNode | string)[];
}
```

**Pick this when:**

- You want a clean JS object tree without the `tagName`/`attributes`/`children` naming of `TNode`
- You need lossless round-trip fidelity (element order, mixed content, attribute order all preserved)
- You want to serialize to JSON for storage or IPC

## `tojsevents()` — same output, SAX-powered

Produces the exact same `JsNode` output as `tojs()`, but uses `fastStream` (SAX events) internally instead of building an intermediate `TNode` DOM. Slightly faster for larger documents.

```ts
import { tojsevents } from "eksml";

const result = tojsevents('<root attr="1"><item>hello</item></root>');
// Identical output to tojs()
```

> **Note:** `tojsevents()` drops `<!DOCTYPE>` declarations because `fastStream` does not emit doctype events. Use `tojs()` if you need to preserve doctypes.

**Pick this when:**

- Same use cases as `tojs()`, especially for larger documents
- You don't need DOCTYPE preservation

## HTML mode

All five APIs support HTML via the `html` option. This sets sensible defaults for void elements (`<br>`, `<img>`, etc.) and raw content tags (`<script>`, `<style>`).

```ts
parse('<div><br><img src="a.png"><p>text</p></div>', { html: true });

transformStream(0, { html: true });

fastStream({ selfClosingTags: HTML_VOID_ELEMENTS, rawContentTags: HTML_RAW_CONTENT_TAGS });

tojs('<div><br><p>text</p></div>', { html: true });
tojsevents('<div><br><p>text</p></div>', { html: true });
```

## Quick reference

| | `parse()` | `transformStream()` | `fastStream()` | `tojs()` | `tojsevents()` |
|---|---|---|---|---|---|
| Input | full string | chunked strings | chunked strings | full string | full string |
| Output | `TNode[]` tree | `TNode` stream | SAX callbacks | `JsNode[]` | `JsNode[]` |
| Async | no | yes | no | no | no |
| Tree building | automatic | automatic | manual | automatic | automatic |
| Best for | full documents, tree walking | streaming with DOM nodes | max throughput, custom processing | lossless JS objects | lossless JS objects (large docs) |
