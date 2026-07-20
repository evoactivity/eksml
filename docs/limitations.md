# Limitations

Eksml optimizes for speed and simplicity, which means it intentionally does not cover every XML use case. This page lists what is out of scope, what the actual behaviour is, and what to reach for instead when a limitation matters to your project.

## Not a validating parser

Eksml parses structure, not semantics. There is no DTD processing and no XML Schema (XSD) validation. A `<!DOCTYPE>` declaration is preserved as an ordinary node in the tree, but its contents are never applied, so custom entities declared in a DTD are not resolved even with `entities: true`:

```ts
import { parse } from '@eksml/xml/parser';

parse(
  '<?xml version="1.0"?><!DOCTYPE note SYSTEM "note.dtd"><note>&custom;</note>',
  { entities: true },
);
// [
//   { tagName: '?xml', attributes: { version: '1.0' }, children: [] },
//   { tagName: '!DOCTYPE', attributes: { note: null, SYSTEM: null, 'note.dtd': null }, children: [] },
//   { tagName: 'note', attributes: null, children: ['&custom;'] },
// ]
```

If you need to validate documents against a DTD or XSD, run validation as a separate step with a dedicated tool, for example [libxml2-wasm](https://github.com/jameslan/libxml2-wasm) (a maintained WebAssembly binding of libxml2) or the `xmllint` CLI, then hand the validated string to Eksml for fast parsing.

## No namespace resolution

Namespace prefixes are preserved verbatim in tag and attribute names, and `xmlns` declarations are ordinary attributes. Nothing is resolved to URIs and there is no namespace-aware API:

```ts
import { parse } from '@eksml/xml/parser';

const soap = parse(
  `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
    <soap:Body>
      <m:GetPrice xmlns:m="https://example.com/prices">
        <m:Item>Apples</m:Item>
      </m:GetPrice>
    </soap:Body>
  </soap:Envelope>`,
  { trimWhitespace: true },
);

soap[0].tagName; // 'soap:Envelope'
soap[0].attributes['xmlns:soap']; // 'http://www.w3.org/2003/05/soap-envelope'
```

In practice this is workable as long as you match on the prefixed name, or strip the prefix yourself when the prefix may vary between producers:

```ts
import { filter } from '@eksml/xml/utilities';

// Exact prefixed name
filter(soap, (n) => n.tagName === 'm:Item');
// [{ tagName: 'm:Item', attributes: null, children: ['Apples'] }]

// Local name, ignoring whatever prefix the producer chose
filter(soap, (n) => n.tagName.split(':').pop() === 'Body');
// [{ tagName: 'soap:Body', ... }]
```

For documents where correct namespace semantics matter (the same element arriving under different prefixes bound to the same URI), use a namespace-aware parser such as [saxes](https://github.com/lddubeau/saxes) or [@xmldom/xmldom](https://github.com/xmldom/xmldom).

## No XPath or CSS selectors

Querying is limited to the simple functions in `@eksml/xml/utilities`: `filter()` with an arbitrary predicate, `getElementById()`, and `getElementsByClassName()`. See the [utilities](./utilities.md) doc for the full list. A predicate goes a long way:

```ts
import { parse } from '@eksml/xml/parser';
import { getElementById, toContentString } from '@eksml/xml/utilities';

const doc = parse('<div><p id="intro">Hello</p></div>');
toContentString(getElementById(doc, 'intro')); // 'Hello'
```

There is no `//order/item[@status="paid"]` style query language. If your use case is selector-heavy, parse with a DOM library and use [xpath](https://github.com/goto100/xpath) on top, or in HTML contexts use `DOMParser` with `querySelectorAll`.

## Entity decoding is opt-in

By default, entity references in text and attribute values are preserved exactly as written. Pass `entities: true` to decode them:

```ts
import { parse } from '@eksml/xml/parser';

const src = '<note>Ben &amp; Jerry&#8217;s &lt;3</note>';

parse(src)[0].children;
// ['Ben &amp; Jerry&#8217;s &lt;3']

parse(src, { entities: true })[0].children;
// ['Ben & Jerry\u2019s <3']
```

In XML mode this decodes the five standard XML entities plus decimal and hex character references. With `html: true` it decodes the full HTML named entity set (`&nbsp;`, `&copy;`, and so on), see [HTML support](./html.md#entity-handling). The [writer](./writing.md) mirrors this: encoding is also opt-in via its own `entities` option.

> [!warning]
> If you serialize untrusted text without `entities: true` on the writer, characters like `<` and `&` are written verbatim and can produce malformed or unsafe markup. Turn encoding on whenever the tree contains text you did not produce yourself.

## TNode is not a W3C DOM

The parse result is an array of plain objects and strings, not a `Document`. A `TNode` has exactly three properties, `tagName`, `attributes`, and `children`, with no prototype methods, no `parentNode`, no `querySelector`:

```ts
import { parse } from '@eksml/xml/parser';

const [node] = parse('<a href="/x">link</a>');
Object.keys(node); // ['tagName', 'attributes', 'children']
JSON.stringify(node); // '{"tagName":"a","attributes":{"href":"/x"},"children":["link"]}'
```

The upside is that trees are cheap to create, trivially serializable with `JSON.stringify`, and safe to construct or modify by hand. The downside is that nothing tracks parent links or document order for you; if you need upward traversal, either carry the path yourself while walking (the `filter` [parse option](./parsing.md) receives the ancestor path) or use a real DOM implementation such as `DOMParser` in the browser or [@xmldom/xmldom](https://github.com/xmldom/xmldom) in Node.js.

## Single-threaded, synchronous parsing

`parse()` and `write()` run synchronously on the calling thread, so a very large document blocks the event loop for the duration of the call. Two ways to mitigate:

- **Stream it.** Both the [SAX parser](./sax-parser.md) and [`XmlParseStream`](./web-streams.md) process input one chunk at a time. Each chunk is parsed synchronously, but when chunks arrive from an async source (a file stream, a network response), the event loop runs freely between them, so other work is never starved for longer than one chunk takes. `XmlParseStream`'s `select` option additionally lets you process subtrees (say, each `<item>` of a feed) as they close instead of holding the whole tree in memory.
- **Move it off-thread.** For CPU-bound workloads, run the parse in a Web Worker (or `worker_threads` in Node.js) and post the resulting tree back. Because `TNode` trees are plain objects, they pass through `postMessage` structured cloning without any conversion:

  ```ts
  // worker.js
  import { parse } from '@eksml/xml/parser';

  self.onmessage = (e) => {
    self.postMessage(parse(e.data, { trimWhitespace: true }));
  };
  ```

There is no async or parallel parsing mode built in.
