# Converters

Eksml can convert parsed XML/HTML into two JSON-friendly object formats, and back again. `lossy()` produces the most compact JavaScript objects at the cost of some document fidelity, `lossless()` produces a verbose structure that preserves everything in document order. `fromLossy()` and `fromLossless()` reverse the conversion, turning either format back into a `TNode` DOM tree (see [parsing](./parsing.md) for the `TNode` shape).

```ts
import { lossy } from '@eksml/xml/lossy';

lossy('<user><name>Alice</name><age>30</age></user>');
// => { user: { name: "Alice", age: "30" } }
```

## Choosing a format

<table>
  <tr>
    <th>Format</th>
    <th>Best for</th>
    <th>Trade-off</th>
  </tr>
  <tr>
    <td>Plain DOM (<code>parse()</code>)</td>
    <td>Traversal, transformation, re-serialization</td>
    <td>Verbose to read values out of by hand</td>
  </tr>
  <tr>
    <td><code>lossy()</code></td>
    <td>Config files, API payloads, data-centric XML where you want <code>doc.user.name</code> access</td>
    <td>Sibling order between different tag names is not preserved</td>
  </tr>
  <tr>
    <td><code>lossless()</code></td>
    <td>JSON serialization that must round-trip exactly (order, attributes, comments)</td>
    <td>Verbose, every value needs unwrapping</td>
  </tr>
</table>

Both converters accept either a raw XML string or a pre-parsed `(TNode | string)[]` array (from `parse()` or collected from a stream). When given a string they parse it themselves and accept the same `ParseOptions` as `parse()`:

```ts
import { parse } from '@eksml/xml/parser';
import { lossy } from '@eksml/xml/lossy';

// String input, with parse options
lossy('<name>A &amp; B</name>', { entities: true });
// => { name: "A & B" }

// Pre-parsed input (options are ignored, the tree is already built)
const dom = parse('<user><name>Alice</name></user>');
lossy(dom);
// => { user: { name: "Alice" } }
```

The [streaming](./web-streams.md) entry point can also emit these formats directly via its `output: 'lossy' | 'lossless'` option, so you rarely need to convert stream output yourself.

## `lossy(input, options?)`

```ts
function lossy(
  input: string,
  options?: LossyOptions,
): LossyValue | LossyValue[];
function lossy(input: (TNode | string)[]): LossyValue | LossyValue[];
```

Returns a single value for a single root element (typically `{ rootTag: ... }`), or an array when the document has multiple top-level nodes. Processing instructions (`<?xml ...?>`) and whitespace-only top-level text are dropped.

### Shape rules

**Text-only elements collapse to plain strings:**

```ts
lossy('<name>Alice</name>');
// => { name: "Alice" }
```

**Empty or void elements collapse to `null`:**

```ts
lossy('<root><br/></root>');
// => { root: { br: null } }
```

**Attributes become `$`-prefixed keys on the element object:**

```ts
lossy('<img src="a.png"/>');
// => { img: { $src: "a.png" } }
```

**Repeated same-name siblings become an array** (a single occurrence stays a plain value):

```ts
lossy('<list><item>A</item><item>B</item></list>');
// => { list: { item: ["A", "B"] } }

lossy('<list><item>A</item></list>');
// => { list: { item: "A" } }
```

**Mixed content (text interleaved with elements) goes into an ordered `$$` array**, preserving the exact interleaving:

```ts
lossy('<p>Hello <b>world</b></p>');
// => { p: { $$: ["Hello ", { b: "world" }] } }
```

An element with both attributes and text content also uses `$$`, since the text can no longer be a plain string value:

```ts
lossy('<a href="/">link</a>');
// => { a: { $href: "/", $$: ["link"] } }
```

**Element-only children become a keyed object:**

```ts
lossy('<root><a>1</a><b>2</b></root>');
// => { root: { a: "1", b: "2" } }
```

All marker keys (`$href`, `$$`) are valid JavaScript identifiers, so dot notation works: `node.$href`, `node.$$`.

> [!warning]
> Because element-only children are grouped by tag name, ordering between different tag names is lost. `<root><a>1</a><b>2</b><a>3</a></root>` becomes `{ root: { a: ["1", "3"], b: "2" } }`, and converting back produces `<root><a>1</a><a>3</a><b>2</b></root>`. If order matters, use `lossless()`.

## `lossless(input, options?)`

```ts
function lossless(input: string, options?: LosslessOptions): LosslessEntry[];
function lossless(input: (TNode | string)[]): LosslessEntry[];
```

Always returns an array of top-level entries. Every node, attribute, text segment, and comment is represented in document order, and the result is fully JSON-serializable.

```ts
import { lossless } from '@eksml/xml/lossless';

lossless('<user id="1"><name>Alice</name></user>');
// => [{ user: [{ $attr: { id: "1" } }, { name: [{ $text: "Alice" }] }] }]
```

### Entry types

<table>
  <tr>
    <th>Entry</th>
    <th>Shape</th>
    <th>Notes</th>
  </tr>
  <tr>
    <td>Element</td>
    <td><code>{ tagName: LosslessEntry[] }</code></td>
    <td>Single-key object, children in document order</td>
  </tr>
  <tr>
    <td>Text</td>
    <td><code>{ $text: "..." }</code></td>
    <td>One entry per text segment</td>
  </tr>
  <tr>
    <td>Attributes</td>
    <td><code>{ $attr: { name: value } }</code></td>
    <td>Always the first entry in its element's children array; boolean attributes have <code>null</code> values</td>
  </tr>
  <tr>
    <td>Comment</td>
    <td><code>{ $comment: "..." }</code></td>
    <td>Only present when parsing with <code>keepComments: true</code>; the delimiters are stripped, inner whitespace is kept</td>
  </tr>
</table>

Examples of each:

```ts
// Element and text
lossless('<root attr="1"><item>hell<b>o</b></item></root>');
// => [
//   { root: [
//     { $attr: { attr: "1" } },
//     { item: [
//       { $text: "hell" },
//       { b: [{ $text: "o" }] },
//     ]},
//   ]},
// ]

// Comments (delimiters stripped, whitespace kept)
lossless('<root><!-- note --><a>1</a></root>', { keepComments: true });
// => [{ root: [{ $comment: " note " }, { a: [{ $text: "1" }] }] }]
```

Like the marker keys in the lossy format, `$text`, `$attr`, and `$comment` are valid identifiers: `entry.$attr.id`, `entry.$text`.

## Round-trip guarantees

**Lossless is exact.** `fromLossless(lossless(input))` reproduces the parsed tree identically, including element order, mixed content, attributes, comments (with `keepComments: true`), CDATA content, processing instructions, and DOCTYPE declarations:

```ts
import { write } from '@eksml/xml/writer';
import { lossless } from '@eksml/xml/lossless';
import { fromLossless } from '@eksml/xml/from-lossless';

const src = '<root><!-- note --><a x="1">hi</a></root>';
write(fromLossless(lossless(src, { keepComments: true })));
// => '<root><!-- note --><a x="1">hi</a></root>'
```

**Lossy is best-effort.** What survives a lossy round-trip:

- Attributes (including boolean attributes with `null` values)
- Text content and the exact interleaving inside `$$` mixed-content arrays
- Repeated same-name siblings, in order

What does not survive:

- Sibling order between different tag names (elements come back in object key insertion order, arrays expand in sequence)
- Processing instructions (dropped during conversion)
- Whitespace-only top-level text (dropped during conversion)

The lossy format is stable in one sense: converting the round-tripped document again yields the same object, so `lossy(write(fromLossy(x)))` equals `x`.

## `fromLossy(input)` and `fromLossless(entries)`

```ts
function fromLossy(input: LossyValue | LossyValue[]): (TNode | string)[];
function fromLossless(entries: LosslessEntry[]): (TNode | string)[];
```

Both return a `(TNode | string)[]` DOM array suitable for `write()`, the [utilities](./utilities.md), or any other code that works on parsed trees.

```ts
import { fromLossy } from '@eksml/xml/from-lossy';
import { write } from '@eksml/xml/writer';

const dom = fromLossy({ user: { name: 'Alice' } });
// => [{ tagName: "user", attributes: null,
//       children: [{ tagName: "name", attributes: null, children: ["Alice"] }] }]

write(dom);
// => '<user><name>Alice</name></user>'
```

`fromLossy` reverses each lossy rule: `null` becomes an empty element, a string becomes a text-only element, `$`-prefixed keys become attributes (prefix stripped, `null` values become boolean attributes), `$$` arrays become mixed content, and value arrays expand back into repeated siblings:

```ts
fromLossy({ input: { $type: 'text', $disabled: null } });
// => [{ tagName: "input", attributes: { type: "text", disabled: null }, children: [] }]

write(fromLossy({ p: { $$: ['Hello ', { b: 'world' }] } }));
// => '<p>Hello <b>world</b></p>'
```

`fromLossless` reverses the lossless entries, consuming a leading `{ $attr }` entry as the element's attributes:

```ts
import { fromLossless } from '@eksml/xml/from-lossless';
import { lossless } from '@eksml/xml/lossless';

const entries = lossless('<root attr="1"><item>hello</item></root>');
write(fromLossless(entries));
// => '<root attr="1"><item>hello</item></root>'
```

> [!note]
> `write()` auto-detects lossy and lossless input and converts it internally, so you rarely need these functions directly. `write({ user: { name: 'Alice' } })` produces the same output as `write(fromLossy({ user: { name: 'Alice' } }))`. Reach for `fromLossy`/`fromLossless` when you want the DOM tree itself, for inspection or manipulation before serializing. See [writing](./writing.md).
