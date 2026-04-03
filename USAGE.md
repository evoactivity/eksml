# eksml usage guide

eksml exports three parsing APIs. They all parse XML (and optionally HTML), but they're designed for different situations.

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

## HTML mode

All three APIs support HTML via the `html` option. This sets sensible defaults for void elements (`<br>`, `<img>`, etc.) and raw content tags (`<script>`, `<style>`).

```ts
parse('<div><br><img src="a.png"><p>text</p></div>', { html: true });

transformStream(0, { html: true });

fastStream({ selfClosingTags: HTML_VOID_ELEMENTS, rawContentTags: HTML_RAW_CONTENT_TAGS });
```

## Quick reference

| | `parse()` | `transformStream()` | `fastStream()` |
|---|---|---|---|
| Input | full string | chunked strings | chunked strings |
| Output | `TNode[]` tree | `TNode` stream | SAX callbacks |
| Async | no | yes | no |
| Tree building | automatic | automatic | manual |
| Best for | full documents in memory | streaming with DOM nodes | max throughput, custom processing |
