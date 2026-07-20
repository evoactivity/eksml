<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/evoactivity/eksml/main/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/evoactivity/eksml/main/logo.svg">
  <img alt="Eksml" src="https://raw.githubusercontent.com/evoactivity/eksml/main/logo.svg">
</picture>

# Eksml

[![CI](https://github.com/evoactivity/eksml/actions/workflows/ci.yml/badge.svg)](https://github.com/evoactivity/eksml/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/evoactivity/a81d2cb6fcee7165ffe898a8cfff9f4c/raw/eksml-coverage.json)](https://github.com/evoactivity/eksml/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@eksml/xml)](https://www.npmjs.com/package/@eksml/xml)
[![license](https://img.shields.io/npm/l/@eksml/xml)](https://github.com/evoactivity/eksml/blob/main/LICENSE)

A fast, lightweight XML/HTML parser, serializer, and streaming toolkit for JavaScript and TypeScript. Import only what you need, tree parsing, SAX streaming, object conversion, or serialization, each as a standalone export.

Built on the same core parsing architecture as [tXml](https://github.com/tobiasNickel/tXml) by Tobias Nickel, Eksml improves the performance and extends it with additional features.

**[Try the interactive demo](https://evoactivity.github.io/eksml/)**

## Installation

```bash
pnpm add @eksml/xml
# or: npm install @eksml/xml / yarn add @eksml/xml
```

Eksml is **ESM-only** and requires Node.js 18+ (or any modern browser, Deno, or Bun). There are no CommonJS exports.

## Parsing

`parse()` turns an XML string into an array of plain-object nodes:

```ts
import { parse } from '@eksml/xml/parser';

const dom = parse('<feed><item id="1">Hello</item></feed>');
// [
//   {
//     tagName: 'feed',
//     attributes: null,
//     children: [
//       { tagName: 'item', attributes: { id: '1' }, children: ['Hello'] },
//     ],
//   },
// ]
```

Every element is a `TNode`, `{ tagName, attributes, children }`, and text is a plain string. That's the whole tree model, it's JSON-serializable and safe to clone.

Prefer working with simple objects instead of a tree? Convert directly:

```ts
import { lossy } from '@eksml/xml/lossy';

lossy('<user><name>Alice</name><age>30</age></user>');
// => { user: { name: 'Alice', age: '30' } }
```

See [parsing](https://github.com/evoactivity/eksml/blob/main/docs/parsing.md) for all options (HTML mode, strict mode, entity decoding, targeted extraction) and [converters](https://github.com/evoactivity/eksml/blob/main/docs/converters.md) for the lossy and lossless object formats.

## Writing

`write()` serializes a tree (or a lossy/lossless object, auto-detected) back to a string:

```ts
import { write } from '@eksml/xml/writer';

write(dom);
// => '<feed><item id="1">Hello</item></feed>'

write(dom, { pretty: true });
// => '<feed>\n  <item id="1">Hello</item>\n</feed>'

write({ user: { name: 'Alice' } });
// => '<user><name>Alice</name></user>'
```

See [writing](https://github.com/evoactivity/eksml/blob/main/docs/writing.md) for pretty-printing, entity encoding, HTML output, and validation options.

## Streaming

For documents too large to hold in memory, or data arriving over the network, `XmlParseStream` is a standard web `TransformStream` that emits parsed subtrees as they complete:

```ts
import { XmlParseStream } from '@eksml/xml/stream';

const response = await fetch('/feed.xml');
const nodes = response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new XmlParseStream({ select: 'item' }));

for await (const item of nodes) {
  console.log(item.tagName); // each <item> as soon as it closes
}
```

The `select` option emits matching elements individually instead of waiting for the whole document. Works in browsers, Node.js 18+, Deno, and Bun; Node streams bridge in with `Readable.toWeb()`.

If you want raw events instead of trees (or maximum throughput), there's also an EventEmitter-style SAX parser:

```ts
import { createSaxParser } from '@eksml/xml/sax';

const parser = createSaxParser();
parser.on('openTag', (tagName, attributes) => console.log(tagName));
parser.write('<feed><item id="1">');
parser.write('Hello</item></feed>');
parser.close();
```

See [web streams](https://github.com/evoactivity/eksml/blob/main/docs/web-streams.md) and [SAX parser](https://github.com/evoactivity/eksml/blob/main/docs/sax-parser.md) for options, output formats, and Node stream interop.

## Documentation

<table>
  <tr>
    <th>Topic</th>
    <th>Covers</th>
  </tr>
  <tr>
    <td><a href="https://github.com/evoactivity/eksml/blob/main/docs/parsing.md">Parsing</a></td>
    <td><code>parse()</code>, all options, the <code>TNode</code> tree model, strict mode, entity decoding, targeted extraction</td>
  </tr>
  <tr>
    <td><a href="https://github.com/evoactivity/eksml/blob/main/docs/writing.md">Writing</a></td>
    <td><code>write()</code>, pretty-printing, entity encoding, validation, input auto-detection</td>
  </tr>
  <tr>
    <td><a href="https://github.com/evoactivity/eksml/blob/main/docs/web-streams.md">Web streams</a></td>
    <td><code>XmlParseStream</code>, the <code>select</code> option, output formats, chunk buffering, Node interop</td>
  </tr>
  <tr>
    <td><a href="https://github.com/evoactivity/eksml/blob/main/docs/sax-parser.md">SAX parser</a></td>
    <td><code>createSaxParser()</code>, events, dynamic handlers, using with Node streams</td>
  </tr>
  <tr>
    <td><a href="https://github.com/evoactivity/eksml/blob/main/docs/converters.md">Converters</a></td>
    <td><code>lossy()</code>, <code>lossless()</code>, shape rules, round-tripping back to XML</td>
  </tr>
  <tr>
    <td><a href="https://github.com/evoactivity/eksml/blob/main/docs/utilities.md">Utilities</a></td>
    <td><code>filter()</code>, <code>getElementById()</code>, <code>getElementsByClassName()</code>, type guards, HTML constants</td>
  </tr>
  <tr>
    <td><a href="https://github.com/evoactivity/eksml/blob/main/docs/html.md">HTML support</a></td>
    <td>What <code>html: true</code> does in each API, and where Eksml stops short of a spec-compliant HTML parser</td>
  </tr>
  <tr>
    <td><a href="https://github.com/evoactivity/eksml/blob/main/docs/security.md">Security</a></td>
    <td>Prototype pollution and circular reference protections, why billion laughs and XXE don't apply</td>
  </tr>
  <tr>
    <td><a href="https://github.com/evoactivity/eksml/blob/main/docs/limitations.md">Limitations</a></td>
    <td>No DTD/schema validation, no namespace resolution, no XPath, and the workarounds</td>
  </tr>
</table>

## Benchmarks

Eksml is consistently the fastest JavaScript library at DOM parsing, SAX streaming, and raw tokenization, and leads serialization with `validate: false`. Full per-fixture results: **[BENCHMARKS.md](https://github.com/evoactivity/eksml/blob/main/eksml/BENCHMARKS.md)**.

There is also an **[interactive benchmark](https://evoactivity.github.io/eksml/benchmark)** that runs in your browser. It is a separate suite from BENCHMARKS.md: it only includes libraries that run on the web, and uses its own fixtures (or XML you paste in), so its numbers are not directly comparable.

## Acknowledgments

Eksml's DOM parser is built on the work of **[Tobias Nickel](https://github.com/tobiasNickel)** and his [tXml](https://github.com/tobiasNickel/tXml) library. The core parsing architecture, a single-pass, position-tracking string scanner that builds the tree as it goes, is what makes both libraries so fast. Thank you, Tobias, for the elegant approach that made all of this possible.

## License

MIT
