# Security

Eksml is regularly fed untrusted input (feeds, scraped pages, uploaded documents), so the library hardens the places where XML parsing has historically gone wrong. This page lists the protections that are built in, the classic XML attacks that do not apply to Eksml by design, and the limits you should still plan for. Everything below is verified by tests or was reproduced against the released build.

For reporting a vulnerability, see the repository's [security policy](https://github.com/evoactivity/eksml/blob/main/SECURITY.md).

## Built-in protections

### Prototype pollution

Attribute names and element names become object keys, and attacker-controlled keys like `__proto__` or `constructor` are a classic route to polluting `Object.prototype`. Eksml stores dangerous names as own properties (via `Object.defineProperty`) instead of assigning them, on every path that builds records: the DOM parser, the SAX engine, the stream, and the converters.

```ts
import { parse } from '@eksml/xml/parser';

const dom = parse('<a __proto__="polluted">hi</a>');

({}).polluted;
// => undefined, Object.prototype is untouched

dom[0].attributes;
// => { __proto__: 'polluted' } as an own property, prototype unchanged
```

### Circular reference rejection

A `TNode` tree is a plain object graph, so nothing stops code from accidentally (or maliciously) making a node its own descendant. Without a guard, `write()` would serialize forever and pin the CPU. The writer detects cycles and throws instead:

```ts
import { write } from '@eksml/xml/writer';

const a = { tagName: 'a', attributes: null, children: [] };
a.children.push(a);
write(a);
// throws: Circular reference detected in TNode tree
```

This check cannot be disabled, `validate: false` does not turn it off. It activates beyond a nesting depth of 16, so ordinary trees pay nothing for it.

### Name validation in the writer

By default `write()` validates tag and attribute names, so a name containing `<`, `>`, `=`, quotes, or whitespace throws instead of being interpolated into markup (an injection vector when names come from untrusted data). See [writing](./writing.md#validation) for details and the `validate: false` tradeoff.

## Attacks that do not apply

### Billion laughs (entity expansion)

The classic XML bomb defines nested entities in the DTD that expand exponentially. Eksml never resolves custom entities: the DTD internal subset is not processed, and entity decoding (`entities: true`) only covers the standard XML/HTML named sets and numeric references. The bomb parses in microseconds and the entity references come out as literal text:

```ts
parse(billionLaughsDocument, { entities: true });
// <lolz>&lol5;</lolz> parses to children: ['&lol5;'], nothing expands
```

### External entities (XXE)

XXE attacks make a parser fetch `SYSTEM` entities (local files, internal URLs). Eksml performs no I/O of any kind: `SYSTEM` identifiers in a DOCTYPE are preserved as inert tokens and external entity references are never resolved.

```ts
parse(
  '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
  { entities: true },
);
// children: ['&xxe;'], no file is read
```

### Catastrophic backtracking

The parsers are plain character scanners, no regular expressions run over document content, so there is no pathological input that triggers exponential regex backtracking. A 10 MB attribute value scans in linear time (a few milliseconds).

## Limits to plan for

- **Deeply nested input.** `parse()` handles extreme nesting (tested to 100,000 levels), but `write()` recurses per level and throws a catchable `RangeError: Maximum call stack size exceeded` at several thousand levels of depth. A malicious document can therefore parse successfully but fail to re-serialize. If you round-trip untrusted documents, treat that error as an input problem, not a crash.
- **Memory is bounded by input size, not configured limits.** There is no option to cap document size or token size; a 1 GB text node uses on the order of 1 GB. Enforce size limits upstream (HTTP body limits, file size checks) before handing input to the parser.
- **Parsing is synchronous.** A huge document occupies the thread for the duration of the parse. See [limitations](./limitations.md#single-threaded-synchronous-parsing) for streaming and worker strategies.

> [!note]
> None of the protections above depend on options being set. There is no "secure mode" to remember to enable.
