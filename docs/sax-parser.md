# SAX parser

`createSaxParser()` from `@eksml/xml/sax` is a high-performance, EventEmitter-style SAX parser. Feed it chunks of XML with `.write()` and receive events through `.on()` handlers as tags, text, and other constructs are encountered. Nothing is buffered into a tree, so memory use stays flat no matter how large the document is. If you want a tree instead of events, see [parsing](./parsing.md), or [web-streams](./web-streams.md) for an incremental tree builder.

```ts
import { createSaxParser } from '@eksml/xml/sax';

const parser = createSaxParser();

parser.on('openTag', (tagName, attributes) => {
  console.log('open:', tagName, attributes);
});
parser.on('text', (text) => {
  console.log('text:', text);
});

parser.write('<feed><item id="1">Hello</item>');
parser.write('<item id="2">World</item></feed>');
parser.close();
// open: feed {}
// open: item { id: '1' }
// text: Hello
// open: item { id: '2' }
// text: World
```

Input can be split at any point, even mid-tag or mid-attribute. The parser buffers only the incomplete tail of a chunk and resumes when the next chunk arrives. Call `close()` when the input ends to flush anything still buffered.

> [!important]
> `parser.write()` accepts strings, not Buffers or byte arrays. Decode bytes to strings before writing (see [Using with Node streams](#using-with-node-streams) below).

## Events

Register handlers with `parser.on(event, handler)` and remove them with `parser.off(event, handler)`.

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
    <td>Closing tag (also fired for self-closing and void elements)</td>
  </tr>
  <tr>
    <td><code>text</code></td>
    <td><code>(text) =&gt; void</code></td>
    <td>Text content between tags</td>
  </tr>
  <tr>
    <td><code>cdata</code></td>
    <td><code>(data) =&gt; void</code></td>
    <td>CDATA section content (without the <code>&lt;![CDATA[ ... ]]&gt;</code> delimiters)</td>
  </tr>
  <tr>
    <td><code>comment</code></td>
    <td><code>(comment) =&gt; void</code></td>
    <td>Comment (full <code>&lt;!-- ... --&gt;</code> string including delimiters)</td>
  </tr>
  <tr>
    <td><code>processingInstruction</code></td>
    <td><code>(name, body) =&gt; void</code></td>
    <td>Processing instruction, e.g. <code>name: 'xml'</code>, <code>body: 'version="1.0"'</code></td>
  </tr>
  <tr>
    <td><code>doctype</code></td>
    <td><code>(tagName, attributes) =&gt; void</code></td>
    <td>DOCTYPE declaration (<code>tagName</code> is <code>'!DOCTYPE'</code>)</td>
  </tr>
</table>

> [!note]
> The `attributes` argument is always a plain object, an empty `{}` when the tag has no attributes. Boolean attributes (e.g. `<input disabled>`) have the value `null`. This differs from the `TNode.attributes` field produced by [parsing](./parsing.md), which is `null` when empty.

## Options

```ts
const parser = createSaxParser({ html: true });
```

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
    <td><code>[]</code> / <code>['script','style','textarea','title']</code></td>
    <td>Tag names whose content is raw text (emitted as a single <code>text</code> event, not parsed for child elements)</td>
  </tr>
</table>

With `html: true`, void elements like `<br>` fire both `openTag` and `closeTag`, and script and style content arrives as one raw `text` event:

```ts
const parser = createSaxParser({ html: true });
parser.on('openTag', (t) => console.log('open:', t));
parser.on('closeTag', (t) => console.log('close:', t));
parser.on('text', (t) => console.log('text:', t));

parser.write('<div><br><script>if (a < b) go();</script></div>');
parser.close();
// open: div
// open: br
// close: br
// open: script
// text: if (a < b) go();
// close: script
// close: div
```

See [html](./html.md) for what HTML mode does and does not cover.

## Adding and removing handlers dynamically

Handlers can be added and removed at any time, including between writes. This is useful for skipping sections of a document you do not care about:

```ts
const parser = createSaxParser();
const seen: string[] = [];

const logOpen = (tagName: string) => seen.push(tagName);

parser.on('openTag', logOpen);
parser.write('<a>');
parser.off('openTag', logOpen); // stop listening mid-stream
parser.write('<b></b></a>');
parser.close();

console.log(seen); // ['a']
```

Multiple handlers can be registered for the same event, and registering the same function twice is a no-op (Set semantics). The single-handler case is the fast path, so there is no cost to only ever using one handler per event.

## Using with Node streams

The parser is not a Node stream itself, but bridging is a few lines. `parser.write()` is a plain synchronous call, so this path has no streaming machinery overhead.

With async iteration:

```ts
import { createReadStream } from 'node:fs';
import { createSaxParser } from '@eksml/xml/sax';

const parser = createSaxParser();
parser.on('openTag', (tagName, attributes) => {
  /* ... */
});

const stream = createReadStream('feed.xml');
stream.setEncoding('utf8');

for await (const chunk of stream) {
  parser.write(chunk);
}
parser.close();
```

Or wrapped in a `Writable` for `.pipe()` / `pipeline()`:

```ts
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const sink = new Writable({
  decodeStrings: false,
  write(chunk, _encoding, callback) {
    parser.write(chunk);
    callback();
  },
  final(callback) {
    parser.close();
    callback();
  },
});

await pipeline(createReadStream('feed.xml', { encoding: 'utf8' }), sink);
```

> [!important]
> `parser.write()` accepts strings, not Buffers. Set an encoding on the readable (`setEncoding('utf8')` or the `encoding` option) so Node decodes for you, since Node handles multibyte characters split across chunk boundaries. Calling `chunk.toString()` on raw Buffers yourself does not.

## SAX or the web stream?

Both `createSaxParser()` and [`XmlParseStream`](./web-streams.md) parse incrementally on the same underlying engine. Choose based on what you need:

- **`createSaxParser()`** is the fastest option. Events are dispatched with direct synchronous calls and there is no tree construction or stream machinery. Use it when you want raw events, are building your own data structure, or throughput matters most.
- **`XmlParseStream`** is a standard `TransformStream`, so it composes with `pipeThrough()`, `fetch` bodies, `TextDecoderStream`, and backpressure for free, and it hands you assembled `TNode` subtrees instead of individual events.
