# Writing

`write()` from `@eksml/xml/writer` serializes a tree back to an XML or HTML string. It accepts the DOM trees produced by [parse()](./parsing.md), plus lossy objects and lossless entry arrays from the [converters](./converters.md), detecting the input format automatically. Output is compact by default, with opt-in pretty-printing, entity encoding, and HTML serialization rules.

```ts
import { parse } from '@eksml/xml/parser';
import { write } from '@eksml/xml/writer';

const dom = parse('<root><item id="1">Hello</item></root>');
write(dom);
// => '<root><item id="1">Hello</item></root>'
```

## Accepted inputs

The input format is auto-detected, no manual conversion needed:

- `TNode` or `(TNode | string)[]`: a DOM tree, serialized directly
- `LossyValue` or `LossyValue[]`: converted with `fromLossy()` first
- `LosslessEntry[]`: converted with `fromLossless()` first

```ts
// Single TNode
write({ tagName: 'a', attributes: { href: '/x' }, children: ['link'] });
// => '<a href="/x">link</a>'

// Lossy object
write({ user: { name: 'Alice', age: '30' } });
// => '<user><name>Alice</name><age>30</age></user>'

// Lossless entries
write([
  {
    user: [
      { $attr: { id: '1' } },
      { name: [{ $text: 'Alice' }] },
      { role: [{ $text: 'admin' }] },
    ],
  },
]);
// => '<user id="1"><name>Alice</name><role>admin</role></user>'
```

Detection looks at the first non-string element: objects with a `tagName` string and a `children` array are DOM, objects with `$text` / `$comment` / `$attr` keys (or a single key mapping to an array) are lossless entries, anything else is treated as lossy. Falsy input (`null`, `undefined`, `''`) returns `''`.

> [!note]
> Lossy values must be strings, `null`, nested objects, or arrays of those. Numbers are not converted: `write({ user: { age: 30 } })` produces `<user><age></age></user>`. See [converters](./converters.md) for the full lossy and lossless formats.

## WriterOptions

<table>
  <tr>
    <th>Option</th>
    <th>Type</th>
    <th>Default</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><code>pretty</code></td>
    <td><code>boolean | string</code></td>
    <td><code>false</code></td>
    <td>
      Pretty-print with indentation. <code>true</code> uses 2 spaces; a string
      value is used as the indent directly (e.g. <code>'\t'</code>).
    </td>
  </tr>
  <tr>
    <td><code>entities</code></td>
    <td><code>boolean</code></td>
    <td><code>false</code></td>
    <td>Encode special characters in text and attribute values as entities</td>
  </tr>
  <tr>
    <td><code>html</code></td>
    <td><code>boolean</code></td>
    <td><code>false</code></td>
    <td>
      HTML mode: void elements emit as <code>&lt;br&gt;</code> without a
      closing tag, and a wider escape set is used when <code>entities</code>
      is also <code>true</code>
    </td>
  </tr>
  <tr>
    <td><code>selfClosingTags</code></td>
    <td><code>string[]</code></td>
    <td>HTML voids</td>
    <td>
      Tag names written without a closing tag in HTML mode. Defaults to the
      standard HTML void elements (<code>HTML_VOID_ELEMENTS</code>). Ignored
      unless <code>html: true</code>, XML output always writes explicit
      closing tags
    </td>
  </tr>
  <tr>
    <td><code>validate</code></td>
    <td><code>boolean</code></td>
    <td><code>true</code></td>
    <td>
      Validate tag and attribute names against forbidden characters. Set to
      <code>false</code> for maximum throughput when the tree is trusted.
    </td>
  </tr>
</table>

These are the only options; there are no others in `WriterOptions`.

## Validation

With `validate: true` (the default), every tag name and attribute name is checked before being written:

- names must not be empty
- names must not contain `<`, `>`, `=`, `"`, `'`, or whitespace

A violation throws:

```ts
write({ tagName: 'bad tag', attributes: null, children: [] });
// throws: Invalid tag name: "bad tag" contains forbidden characters
```

That is the full extent of validation. Attribute values and text content are never validated, and attribute keys of `!` declarations (like `!DOCTYPE`) are exempt because they are quoted identifiers, not XML names.

With `validate: false` the name checks are skipped entirely. This is the fastest path and is safe when the tree came straight from `parse()` and was not modified. The tradeoff: forbidden characters in names are written verbatim and can produce malformed XML, including injection if names come from untrusted input:

```ts
write(
  { tagName: 'bad tag', attributes: null, children: [] },
  { validate: false },
);
// => '<bad tag></bad tag>'  (malformed)
```

## Circular reference protection

Circular trees are detected and rejected regardless of the `validate` setting:

```ts
const a = { tagName: 'a', attributes: null, children: [] };
a.children.push(a);
write(a);
// throws: Circular reference detected in TNode tree
```

Without this guard a circular tree would serialize forever, so a single crafted or accidentally self-referencing input could pin the CPU and take the process down. The check exists as a denial-of-service protection and cannot be turned off. It uses a `WeakSet` that only activates beyond a nesting depth of 16, so typical documents pay no overhead for it. See [security](./security.md) for the other protections Eksml provides.

## Attribute serialization

Attribute values are double-quoted by default. If the value contains `"`, single quotes are used; if it contains both quote types, single quotes are used and `'` is escaped as `&apos;`. `null` attribute values are written as bare names:

```ts
write({ tagName: 'a', attributes: { t: 'say "hi"' }, children: [] });
// => `<a t='say "hi"'></a>`

write({ tagName: 'a', attributes: { t: `both ' and "` }, children: [] });
// => `<a t='both &apos; and "'></a>`

write({ tagName: 'input', attributes: { disabled: null }, children: [] });
// => '<input disabled></input>'
```

## Entity encoding

By default, text and attribute values are written verbatim. With `entities: true`:

- XML mode (default): `&`, `<`, `>` are encoded in text content; `&` and `"` are encoded in attribute values.
- HTML mode (`html: true`): `&`, `<`, `>`, `"`, `'` are encoded in both text and attributes.

```ts
const node = {
  tagName: 'a',
  attributes: { t: 'x < y & "z"' },
  children: ['a < b & c'],
};

write(node);
// => `<a t='x < y & "z"'>a < b & c</a>`

write(node, { entities: true });
// => '<a t="x < y &amp; &quot;z&quot;">a &lt; b &amp; c</a>'
```

Non-ASCII characters are left as literal UTF-8 in both modes; characters like `©` are not converted to named references such as `&copy;`. Comment strings (children starting with `<!--`) pass through without encoding.

> [!warning]
> Without `entities: true`, text containing `<` or `&` is written as-is and the output may not be well-formed XML. Enable it whenever the tree holds decoded or hand-built text.

## HTML mode

`html: true` changes serialization in two ways:

- The standard HTML void elements (`area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `param`, `source`, `track`, `wbr`) are written without a closing tag: `<br>` instead of `<br></br>`. Any children of a void element are dropped. Pass `selfClosingTags` to replace this list with your own, mirroring the option on [parse()](./parsing.md), so custom dialects round-trip.
- With `entities: true`, the wider HTML escape set described above is used.

```ts
import { parse } from '@eksml/xml/parser';

const tree = parse('<p>Hello<br>World</p>', { html: true });

write(tree);
// => '<p>Hello<br></br>World</p>'

write(tree, { html: true });
// => '<p>Hello<br>World</p>'
```

See [html](./html.md) for the scope of HTML support overall.

## Pretty-printing

`pretty: true` indents with two spaces per level; pass a string to use it as the indent unit (for example `'\t'` or `'    '`):

```ts
const tree = parse(
  '<?xml version="1.0"?><root><a></a><name>Alice</name></root>',
);

write(tree, { pretty: true });
// => `<?xml version="1.0"?>
// <root>
//   <a/>
//   <name>Alice</name>
// </root>`

write(tree, { pretty: '\t' });
// same, indented with tabs
```

Formatting rules:

- Each element goes on its own line at its nesting depth. Multiple top-level nodes are separated by newlines.
- Empty elements are self-closed: `<a/>`. Without `pretty`, the default output writes `<a></a>` instead.
- Text-only elements stay inline on one line: `<name>Alice</name>`. Each text child is trimmed and non-empty pieces are joined with a single space.
- Mixed content (text interleaved with elements) puts each trimmed text piece and each element on its own indented line:

  ```ts
  write(parse('<p>Hello <b>world</b> again</p>'), { pretty: true });
  // => `<p>
  //   Hello
  //   <b>world</b>
  //   again
  // </p>`
  ```

- Comments (kept via `keepComments` at parse time) get their own indented line and are never trimmed.

> [!important]
> Pretty-printing trims and re-flows text nodes, so it is not whitespace-lossless. Round-trip with the compact default if whitespace must be preserved exactly.

## Processing instructions and doctype

The writer understands the parser's `?` and `!` tag name prefixes, so declarations round-trip:

```ts
write(parse('<?xml version="1.0"?><!DOCTYPE html><html></html>'));
// => '<?xml version="1.0"?><!DOCTYPE html><html></html>'
```

`?` nodes close with `?>`, `!` nodes are void in all modes, and doctype identifier tokens that are not simple keywords are re-quoted:

```ts
write(parse('<!DOCTYPE note SYSTEM "note.dtd"><note/>'));
// => '<!DOCTYPE note SYSTEM "note.dtd"><note></note>'
```
