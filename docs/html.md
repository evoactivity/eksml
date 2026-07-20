# HTML Support

Eksml can parse and serialize HTML through the `html: true` option, which is accepted by [`parse()`](./parsing.md), [`write()`](./writing.md), [`createSaxParser()`](./sax-parser.md), and [`XmlParseStream`](./web-streams.md). HTML mode adjusts the handful of rules where HTML genuinely differs from XML (void elements, raw text inside `<script>` and `<style>`, entity handling, serialization style), which is enough for well-formed HTML and most real-world documents. It is not, and does not try to be, a spec-compliant HTML parser.

> [!important]
> Eksml does not implement the [WHATWG HTML parsing algorithm](https://html.spec.whatwg.org/multipage/parsing.html). There is no tokenizer state machine, no tree construction stage, no implicit element insertion, and no error recovery for malformed markup. If you need full spec compliance, use [parse5](https://github.com/inikulin/parse5) or the browser's built-in `DOMParser`. See [what is not supported](#what-is-not-supported) below for the concrete list.

## What `html: true` changes per API

| API                 | Effect of `html: true`                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `parse()`           | `selfClosingTags` defaults to `HTML_VOID_ELEMENTS`, `rawContentTags` defaults to `['script', 'style', 'textarea', 'title']`. With `entities: true`, the full HTML named entity set is decoded instead of only the five XML entities. |
| `write()`           | Void elements serialize as `<br>` with no closing tag. With `entities: true`, reserved characters are escaped with named entities in both text and attributes.                                                                       |
| `createSaxParser()` | Same `selfClosingTags` and `rawContentTags` defaults as `parse()`. Void elements fire `openTag` followed immediately by `closeTag`. Raw content tags emit their body as a single `text` event.                                       |
| `XmlParseStream`    | Same `selfClosingTags` and `rawContentTags` defaults as `parse()`. The stream has no `entities` option, decode after the fact if you need it.                                                                                        |

In every API, an explicit `selfClosingTags` or `rawContentTags` array overrides the HTML defaults, so `html: true` is shorthand for sensible defaults rather than a separate parsing algorithm.

## Void elements

HTML void elements like `<br>` and `<img>` never have children and never have a closing tag. In XML mode these look like unclosed tags, so parsing typically fails or produces a garbled tree. With `html: true` they are recognized as self-closing:

```ts
import { parse } from '@eksml/xml/parser';

parse('<p>line one<br>line two</p>', { html: true });
// [
//   {
//     tagName: 'p',
//     attributes: null,
//     children: [
//       'line one',
//       { tagName: 'br', attributes: null, children: [] },
//       'line two',
//     ],
//   },
// ]
```

The full list is exported as `HTML_VOID_ELEMENTS` from `@eksml/xml/utilities` (see the [utilities](./utilities.md) doc):

```ts
import { HTML_VOID_ELEMENTS } from '@eksml/xml/utilities';

console.log(HTML_VOID_ELEMENTS);
// ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
//  'link', 'meta', 'param', 'source', 'track', 'wbr']
```

Passing your own `selfClosingTags` replaces this list entirely, even in HTML mode:

```ts
// Only <br> is treated as void; <hr> now needs an explicit closing tag
parse('<div><br><hr></hr></div>', { html: true, selfClosingTags: ['br'] });
```

## Raw content tags

In HTML, the contents of `<script>` and `<style>` are raw text, not markup. Without `html: true`, an angle bracket inside JavaScript is happily parsed as a tag and the tree comes out garbled:

```ts
import { parse } from '@eksml/xml/parser';

const src = '<script>if (count < items.length) { render(); }</script>';

// XML mode: `< items.length)` is misparsed as an element
parse(src);
// [
//   {
//     tagName: 'script',
//     attributes: null,
//     children: [
//       'if (count ',
//       { tagName: '', attributes: { 'items.length)': null, 'render();': null, script: null }, children: [] },
//     ],
//   },
// ]

// HTML mode: the body is kept as a single raw text child
parse(src, { html: true });
// [
//   {
//     tagName: 'script',
//     attributes: null,
//     children: ['if (count < items.length) { render(); }'],
//   },
// ]
```

The default list is exported as `HTML_RAW_CONTENT_TAGS` from `@eksml/xml/utilities` and contains `['script', 'style', 'textarea', 'title']`: the WHATWG raw text elements plus the RCDATA elements, whose content can never hold child elements.

```ts
// textarea content is raw by default in html mode
parse('<div><textarea><b>bold</b></textarea></div>', { html: true });
// The textarea's children are ['<b>bold</b>'], a raw string, not a parsed <b> element
```

You can replace the list with `rawContentTags`:

```ts
// Treat <code-block> content as raw text too
parse(doc, {
  html: true,
  rawContentTags: [...HTML_RAW_CONTENT_TAGS, 'code-block'],
});
```

## Entity handling

HTML mode changes which entities are recognized, on both the parse and write side.

**Parsing.** Entity decoding is opt-in everywhere (see [limitations](./limitations.md#entity-decoding-is-opt-in)). With `entities: true`, XML mode decodes only the five standard XML entities plus numeric references, while HTML mode decodes the full HTML named entity set:

```ts
import { parse } from '@eksml/xml/parser';

const src = '<p>Fish &amp; chips &copy; &#169;</p>';

parse(src, { entities: true })[0].children;
// ['Fish & chips &copy; ©']   (XML mode: &copy; is not an XML entity)

parse(src, { html: true, entities: true })[0].children;
// ['Fish & chips © ©']        (HTML mode: full named entity set)
```

**Writing.** With `html: true` and `entities: true` together, the writer escapes the reserved characters `&`, `<`, `>`, `"`, `'` using named entities in both text content and attribute values. All other characters, including non-ASCII ones like `©` or a non-breaking space, are written as literal UTF-8, which is valid HTML:

```ts
import { write } from '@eksml/xml/writer';

const dom = [
  { tagName: 'p', attributes: null, children: ['Fish & chips © 2026'] },
];

write(dom, { html: true, entities: true });
// '<p>Fish &amp; chips © 2026</p>'
```

> [!note]
> The writer never converts characters like `©` into `&copy;`. Named entities are only used for the reserved characters that must be escaped. In XML mode (`entities: true` without `html`), text escaping covers `&`, `<`, `>` and the non-breaking space, and attribute escaping covers `&`, `"` and the non-breaking space.

## Serialization style

The writer never uses XML self-closing syntax (`<br/>`). An element with no children is written as an open and close pair in XML mode. In HTML mode, elements in `HTML_VOID_ELEMENTS` drop the closing tag:

```ts
import { write } from '@eksml/xml/writer';

const dom = [{ tagName: 'br', attributes: null, children: [] }];

write(dom); // '<br></br>'
write(dom, { html: true }); // '<br>'
```

The writer's void element list defaults to `HTML_VOID_ELEMENTS` and can be replaced with the `selfClosingTags` option, mirroring `parse()`, so custom dialects round-trip. A non-void element with no children (say an empty `<div>`) is written as `<div></div>` in both modes. See [writing](./writing.md) for details.

## Worked example

Parsing a realistic snippet with `html: true` (note the void `<img>` and `<br>`, and the undecoded `&amp;`, since `entities` defaults to `false`):

```ts
import { parse } from '@eksml/xml/parser';
import { write } from '@eksml/xml/writer';

const html = `<div class="card">
  <img src="avatar.png" alt="Avatar">
  <h2>Alice Johnson</h2>
  <p>Signed up<br>in 2024 &amp; still active</p>
</div>`;

const tree = parse(html, { html: true, trimWhitespace: true });
// [
//   {
//     tagName: 'div',
//     attributes: { class: 'card' },
//     children: [
//       { tagName: 'img', attributes: { src: 'avatar.png', alt: 'Avatar' }, children: [] },
//       { tagName: 'h2', attributes: null, children: ['Alice Johnson'] },
//       {
//         tagName: 'p',
//         attributes: null,
//         children: [
//           'Signed up',
//           { tagName: 'br', attributes: null, children: [] },
//           'in 2024 &amp; still active',
//         ],
//       },
//     ],
//   },
// ]

write(tree, { html: true });
// '<div class="card"><img src="avatar.png" alt="Avatar"><h2>Alice Johnson</h2><p>Signed up<br>in 2024 &amp; still active</p></div>'
```

A `<!DOCTYPE html>` at the top of a document is preserved as a node with `tagName: '!DOCTYPE'` and `attributes: { html: null }`.

## What is not supported

Eksml parses HTML with XML-style structural rules plus the adjustments above. It does not implement the WHATWG behaviours that repair or restructure markup:

- **Optional closing tags.** `<li>` without `</li>`, or a `<p>` auto-closed by a sibling `<p>`, are treated as mismatched tags and throw a parse error rather than being auto-closed:

  ```ts
  parse('<ul><li>One<li>Two</ul>', { html: true });
  // Error: Unexpected close tag </ul> (expected </li>) at line 1, column 32
  ```

- **Implicit elements.** Missing `<html>`, `<head>`, or `<body>` are not inserted. `parse('<p>hello</p>', { html: true })` returns just the `<p>` node.
- **Misnested formatting tags.** The adoption agency algorithm is not implemented. `<b>bold <i>both</b> italic</i>` throws instead of being repaired.
- **Table foster parenting.** Stray content inside `<table>` is not relocated out of the table.

If your input relies on any of these, use [parse5](https://github.com/inikulin/parse5) (a full WHATWG implementation for Node.js) or the browser's `DOMParser`, and reserve Eksml for well-formed documents where its speed pays off.
