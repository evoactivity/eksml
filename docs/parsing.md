# Parsing

`parse()` from `@eksml/xml/parser` turns an XML or HTML string into a plain-object tree in a single pass. It is fault tolerant by default (malformed input is recovered where possible), with an opt-in strict mode that throws with line and column information. The tree it produces is the common currency of the library: the [writer](./writing.md), the [converters](./converters.md), and the [utilities](./utilities.md) all operate on it.

```ts
import { parse } from '@eksml/xml/parser';

parse('<root><item id="1">Hello</item></root>');
// => [
//   {
//     tagName: 'root',
//     attributes: null,
//     children: [
//       { tagName: 'item', attributes: { id: '1' }, children: ['Hello'] },
//     ],
//   },
// ]
```

## Return value

`parse()` returns `(TNode | string)[]`, an array of top-level nodes. Elements are `TNode` objects, text content appears as plain strings. A document usually has one root element, but the array can hold several nodes (for example an XML declaration followed by the root, or text outside any tag).

### `TNode`

```ts
interface TNode {
  tagName: string;
  attributes: Record<string, string | null> | null;
  children: (TNode | string)[];
}
```

- `attributes` is `null` when the element has no attributes at all. Check for `null` before reading attribute keys.
- Attribute values are `string` for valued attributes, `null` for attributes without a value (boolean attributes), and `''` for attributes with an explicitly empty value:

```ts
parse('<input disabled value="" name="x"/>');
// => [
//   {
//     tagName: 'input',
//     attributes: { disabled: null, value: '', name: 'x' },
//     children: [],
//   },
// ]
```

- `children` holds child elements and text in document order. Text nodes are plain strings, so `typeof child === 'string'` distinguishes text from elements (or use the `isTextNode` / `isElementNode` guards from [utilities](./utilities.md)).

> [!note]
> Whitespace-only text between elements is dropped when a container holds only elements and ignorable whitespace. Mixed content is untouched:
>
> ```ts
> parse('<root>\n  <a/>\n  <b/>\n</root>');
> // => children: [ {tagName: 'a', ...}, {tagName: 'b', ...} ]  (no whitespace strings)
>
> parse('<root>  hi  <a/> </root>');
> // => children: [ '  hi  ', {tagName: 'a', ...}, ' ' ]  (text present, whitespace kept)
> ```

## ParseOptions

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
    <td>Tag names treated as self-closing void elements that need no closing tag</td>
  </tr>
  <tr>
    <td><code>rawContentTags</code></td>
    <td><code>string[]</code></td>
    <td><code>[]</code> / <code>['script','style','textarea','title']</code></td>
    <td>Tag names whose content is emitted as a single raw text child, not parsed as markup</td>
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
    <td>Throw on malformed XML instead of recovering</td>
  </tr>
  <tr>
    <td><code>entities</code></td>
    <td><code>boolean</code></td>
    <td><code>false</code></td>
    <td>Decode XML/HTML entities in text and attribute values</td>
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
    <td>Attribute value to search for, matched literally (targeted extraction fast path)</td>
  </tr>
  <tr>
    <td><code>filter</code></td>
    <td><code>(node: TNode, index: number, depth: number, path: string) =&gt; boolean</code></td>
    <td>--</td>
    <td>Predicate applied to every node after parsing; matching nodes are returned as a flat array</td>
  </tr>
</table>

## HTML mode

`html: true` does not change the parsing algorithm, it just fills in HTML-aware defaults for two options:

- `selfClosingTags` defaults to the standard HTML void elements (`area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `param`, `source`, `track`, `wbr`)
- `rawContentTags` defaults to `['script', 'style', 'textarea', 'title']`

Both can still be overridden explicitly in HTML mode. Without these defaults, `<br>` would swallow the rest of the document as children and `<script>` content containing `<` would be parsed as markup:

```ts
parse('<p>Hello<br>World</p>', { html: true });
// => [{ tagName: 'p', attributes: null, children: [
//      'Hello',
//      { tagName: 'br', attributes: null, children: [] },
//      'World',
//    ] }]

parse('<script>if (a < b) x();</script>', { html: true });
// => [{ tagName: 'script', attributes: null, children: ['if (a < b) x();'] }]
```

The tag lists work in any mode. For example, custom void elements in XML:

```ts
parse('<a><sep>x</a>', { selfClosingTags: ['sep'] });
// => [{ tagName: 'a', attributes: null, children: [
//      { tagName: 'sep', attributes: null, children: [] },
//      'x',
//    ] }]
```

See [html](./html.md) for what HTML mode does and does not cover (it is not a WHATWG-compliant HTML parser).

## Entity decoding

By default, entities are preserved as-is:

```ts
parse('<a>Tom &amp; Jerry &#228;</a>');
// => [{ tagName: 'a', attributes: null, children: ['Tom &amp; Jerry &#228;'] }]
```

With `entities: true`, text content and attribute values are decoded. Named entities, decimal character references (`&#228;`), and hex references (`&#xe4;`) are supported:

```ts
parse('<a>Tom &amp; Jerry &#228;</a>', { entities: true });
// => children: ['Tom & Jerry ä']

parse('<a title="A &amp; B"/>', { entities: true });
// => attributes: { title: 'A & B' }
```

Which named entities are recognized depends on the mode:

- XML mode (default): only the five standard XML entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`) plus numeric references. Unknown names like `&nbsp;` are left untouched.
- HTML mode (`html: true`): the full HTML named entity set, for example `&nbsp;`, `&copy;`, `&eacute;`.

```ts
parse('<a>&copy; &nbsp;</a>', { entities: true });
// => children: ['&copy; &nbsp;']  (unknown names preserved in XML mode)

parse('<a>&copy;</a>', { entities: true, html: true });
// => children: ['©']
```

CDATA sections are never decoded, regardless of this setting:

```ts
parse('<a><![CDATA[&amp;]]></a>', { entities: true });
// => children: ['&amp;']
```

## Strict mode

`strict: true` makes the parser throw instead of recovering. Errors include line and column position. It catches:

- unclosed open tags that reach end of input
- unclosed close tags, comments, CDATA sections, and declarations
- mismatched close tags
- non-whitespace text outside any tag (before or after the root element)

```ts
parse('<root><a>', { strict: true });
// throws: Unclosed tag <a> at line 1, column 10

parse('<root/>trailing', { strict: true });
// throws: Text content outside of a tag at line 1, column 8
```

Whitespace around the root element is always allowed, in strict mode too.

## Malformed input without strict

Without `strict`, the parser recovers from most structural problems instead of failing:

- Unclosed tags at end of input are closed implicitly and kept in the tree:

  ```ts
  parse('<root><a>text');
  // => [{ tagName: 'root', attributes: null, children: [
  //      { tagName: 'a', attributes: null, children: ['text'] },
  //    ] }]
  ```

- An unclosed comment or CDATA section consumes the rest of the input.
- Text outside the root element is kept as a top-level string.
- An unterminated attribute string ends the parse and returns what was built so far.

> [!important]
> A mismatched close tag throws even without `strict`, since the parser cannot guess which tag was intended:
>
> ```ts
> parse('<root><a></b></root>');
> // throws: Unexpected close tag </b> (expected </a>) at line 1, column 13
> ```

## Targeted extraction fast paths

For large documents where you only need part of the tree, three public options avoid parsing everything.

### `pos`

Start parsing at a given character offset instead of position 0:

```ts
parse('<skip/><root>hi</root>', { pos: 7 });
// => [{ tagName: 'root', attributes: null, children: ['hi'] }]
```

### `attrName` / `attrValue`

Scan the raw string for elements carrying a specific attribute value, and parse only those elements (as full subtrees). `attrName` defaults to `'id'` when only `attrValue` is given. The value is matched literally against the full quoted attribute value; regex metacharacters in `attrValue` are escaped, so patterns like `a[0-9]` do not work.

```ts
const doc = '<list><item id="a1">One</item><item id="a2">Two</item></list>';

parse(doc, { attrValue: 'a2' });
// => [{ tagName: 'item', attributes: { id: 'a2' }, children: ['Two'] }]

parse(doc, { attrName: 'id', attrValue: 'a1' });
// => [{ tagName: 'item', attributes: { id: 'a1' }, children: ['One'] }]
```

The result is a flat array of every matching element in the document, regardless of nesting depth.

### `filter`

Parse the whole document, then return only the nodes matching a predicate, as a flat array. The predicate receives `(node, index, depth, path)` where `index` is the node's position among its siblings, `depth` is the nesting depth starting at 0, and `path` is a dotted `index.tagName` trail to the parent (for example `'0.root.0.a'`):

```ts
parse('<root><a/><b/><a/></root>', {
  filter: (node) => node.tagName === 'a',
});
// => [
//   { tagName: 'a', attributes: null, children: [] },
//   { tagName: 'a', attributes: null, children: [] },
// ]
```

The same traversal is available standalone as `filter()` in [utilities](./utilities.md). Internal options you may spot in the source (`setPos`, `parseNode`) are not part of the public API.

For truly incremental processing of large inputs, see the [sax-parser](./sax-parser.md) and [web-streams](./web-streams.md) docs.

## Edge cases

### Comments

Comments are discarded by default. With `keepComments: true` they appear as string children including the `<!-- -->` delimiters:

```ts
parse('<root><!-- note --><a/></root>', { keepComments: true });
// => children: ['<!-- note -->', { tagName: 'a', ... }]
```

### CDATA

CDATA content becomes a plain string child with the `<![CDATA[ ]]>` wrapper removed and the content untouched (never entity-decoded):

```ts
parse('<a><![CDATA[x < y]]></a>');
// => children: ['x < y']
```

### Processing instructions

Processing instructions become `TNode`s whose `tagName` starts with `?`, with pseudo-attributes parsed like element attributes:

```ts
parse('<?xml version="1.0"?><root/>');
// => [
//   { tagName: '?xml', attributes: { version: '1.0' }, children: [] },
//   { tagName: 'root', attributes: null, children: [] },
// ]
```

### Doctype

`<!DOCTYPE ...>` (and other `<!...>` declarations) become `TNode`s whose `tagName` starts with `!`. Each space-separated token becomes a null-valued attribute key; quoted identifiers are captured without their quotes; an internal DTD subset (`[...]`) is skipped entirely:

```ts
parse('<!DOCTYPE note SYSTEM "note.dtd"><note/>');
// => [
//   {
//     tagName: '!DOCTYPE',
//     attributes: { note: null, SYSTEM: null, 'note.dtd': null },
//     children: [],
//   },
//   { tagName: 'note', attributes: null, children: [] },
// ]
```

The [writer](./writing.md) understands the `?` and `!` prefixes and serializes these nodes back to `<?...?>` and `<!...>` form. For other things the parser deliberately does not do (DTD validation, namespaces, XPath), see [limitations](./limitations.md).
