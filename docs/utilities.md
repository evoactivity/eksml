# Utilities

The `@eksml/xml/utilities` entry point bundles small helpers for querying parsed trees, extracting text, narrowing node types, and the HTML tag lists used by the parser and writer. Every query helper accepts either a raw XML string or a pre-parsed `(TNode | string)[]` array (see [parsing](./parsing.md) for the `TNode` shape).

```ts
import { getElementById } from '@eksml/xml/utilities';

getElementById(
  '<root><section id="intro"><h1>Hi</h1></section></root>',
  'intro',
);
// => { tagName: "section", attributes: { id: "intro" }, children: [...] }
```

## Exports

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
    <td>HTML raw content tag names (<code>script</code>, <code>style</code>, <code>textarea</code>, <code>title</code>)</td>
  </tr>
</table>

## `filter(input, predicate)`

```ts
function filter(
  input: string | (TNode | string)[],
  predicate: (
    node: TNode,
    index: number,
    depth: number,
    path: string,
  ) => boolean,
): TNode[];
```

Walks the whole tree depth-first, calling the predicate for every element node (text nodes are skipped), and returns the nodes for which it returned `true`. Matches include nested elements at any depth, and children of a matched node are still visited.

```ts
import { filter } from '@eksml/xml/utilities';

const xml =
  '<catalog><book genre="fiction"><title>Dune</title></book>' +
  '<book genre="reference"><title>Atlas</title></book></catalog>';

filter(xml, (node) => node.attributes?.genre === 'fiction');
// => [{ tagName: "book", attributes: { genre: "fiction" }, children: [...] }]

filter(xml, (node) => node.tagName === 'title').length;
// => 2
```

The predicate receives four arguments:

<table>
  <tr>
    <th>Argument</th>
    <th>Type</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><code>node</code></td>
    <td><code>TNode</code></td>
    <td>The current element node</td>
  </tr>
  <tr>
    <td><code>index</code></td>
    <td><code>number</code></td>
    <td>Position in the parent's <code>children</code> array (text node siblings count towards the index)</td>
  </tr>
  <tr>
    <td><code>depth</code></td>
    <td><code>number</code></td>
    <td>Nesting depth, <code>0</code> for top-level nodes</td>
  </tr>
  <tr>
    <td><code>path</code></td>
    <td><code>string</code></td>
    <td>Dotted ancestor trail of <code>index.tagName</code> pairs, empty for top-level nodes</td>
  </tr>
</table>

```ts
filter('<root><a><b>x</b></a><c/></root>', (node, index, depth, path) => {
  console.log(node.tagName, index, depth, path);
  return false;
});
// root 0 0 ""
// a    0 1 "0.root"
// b    0 2 "0.root.0.a"
// c    1 1 "0.root"
```

## `getElementById(input, id)`

```ts
function getElementById(
  input: string | (TNode | string)[],
  id: string,
): TNode | undefined;
```

Returns the first element whose `id` attribute equals `id`, or `undefined` if there is no match. When given a string, it uses the parser's attribute fast path (see the `attrValue` option in [parsing](./parsing.md)) instead of building the full tree first.

```ts
import { getElementById } from '@eksml/xml/utilities';
import { parse } from '@eksml/xml/parser';

const xml = '<root><section id="intro"><h1>Hi</h1></section></root>';

getElementById(xml, 'intro');
// => { tagName: "section", attributes: { id: "intro" }, children: [...] }

getElementById(parse(xml), 'intro'); // pre-parsed input works too
getElementById(xml, 'missing');
// => undefined
```

## `getElementsByClassName(input, className)`

```ts
function getElementsByClassName(
  input: string | (TNode | string)[],
  className: string,
): TNode[];
```

Returns all elements whose `class` attribute contains `className` as a whole word. Multi-class attributes are handled, and partial matches are not (searching for `note` does not match `class="notes"`).

```ts
import { getElementsByClassName, toContentString } from '@eksml/xml/utilities';

const html =
  '<div><p class="note big">one</p><p class="note">two</p>' +
  '<p class="notes">three</p></div>';

getElementsByClassName(html, 'note').map((n) => toContentString(n));
// => ["one", "two"]
```

## `toContentString(node)`

```ts
function toContentString(
  domContent: TNode | (TNode | string)[] | string,
): string;
```

Recursively concatenates the text content of a node, an array of nodes, or a plain string. Useful for reading the readable text out of mixed content.

```ts
import { toContentString } from '@eksml/xml/utilities';
import { parse } from '@eksml/xml/parser';

toContentString(parse('<p>Hello <b>world</b></p>')[0]);
// => "Hello  world"
```

> [!note]
> Segments are joined with a space and the final result is trimmed, so output can contain doubled spaces where text already ended with whitespace before an element (as in the example above). It is a readability helper, not an exact `textContent` equivalent.

## `isTextNode(node)` and `isElementNode(node)`

```ts
function isTextNode(node: TNode | string): node is string;
function isElementNode(node: TNode | string): node is TNode;
```

Type guards for narrowing `TNode | string` values when walking `children` arrays.

```ts
import { isTextNode, isElementNode } from '@eksml/xml/utilities';
import { parse } from '@eksml/xml/parser';

const [div] = parse('<div>Hello <span>World</span></div>');

for (const child of div.children) {
  if (isTextNode(child)) console.log('text:', child); // text: "Hello "
  if (isElementNode(child)) console.log('element:', child.tagName); // element: span
}
```

## `HTML_VOID_ELEMENTS` and `HTML_RAW_CONTENT_TAGS`

The tag lists the parser, writer, and streams use as defaults when `html: true` is set.

```ts
import {
  HTML_VOID_ELEMENTS,
  HTML_RAW_CONTENT_TAGS,
} from '@eksml/xml/utilities';

HTML_VOID_ELEMENTS;
// => ["area", "base", "br", "col", "embed", "hr", "img", "input",
//     "link", "meta", "param", "source", "track", "wbr"]

HTML_RAW_CONTENT_TAGS;
// => ["script", "style", "textarea", "title"]
```

`HTML_VOID_ELEMENTS` is the default for the `selfClosingTags` option (elements that never have children, serialized as `<br>` in HTML mode). `HTML_RAW_CONTENT_TAGS` is the default for `rawContentTags` (elements whose content is raw text, never parsed as markup). Both can be used as a starting point for custom lists, see [parsing](./parsing.md) and [writing](./writing.md).
