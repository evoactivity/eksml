/**
 * Experiment: attribute parsing penalty in the eksml SAX engine.
 *
 * Compares the eksml SAX engine against itself on two ~10 KB XML documents
 * that share the exact same element count and structure. The only difference
 * is that one document gives every element an `id` attribute and the other
 * gives them none.
 *
 * If attribute handling is cheap we expect the two variants to run at roughly
 * the same speed. A large gap points at the attribute path (name/value scan
 * plus property assignment onto the null-proto attributes object) as the cost
 * we want to remove.
 */
import { bench, describe } from 'vitest';

import { saxEngine } from '#src/saxEngine.ts';
import type { Attributes } from '#src/saxEngine.ts';

// ---------------------------------------------------------------------------
// Fixtures — same element count, id attribute is the only difference
// ---------------------------------------------------------------------------
const TARGET_BYTES = 10 * 1024; // ~10 KB

/** Build a document of `count` <item> children, optionally with an id attr. */
function buildDoc(count: number, withId: boolean): string {
  let body = '';
  for (let n = 0; n < count; n++) {
    body += withId
      ? `  <item id="id-${n}">value ${n}</item>\n`
      : `  <item>value ${n}</item>\n`;
  }
  return `<root>\n${body}</root>`;
}

// Grow the with-id document until it reaches ~10 KB, then lock in that element
// count and build the no-id document with the identical count.
let elementCount = 0;
while (buildDoc(elementCount, true).length < TARGET_BYTES) {
  elementCount += 10;
}

const withIdDoc = buildDoc(elementCount, true);
const noIdDoc = buildDoc(elementCount, false);

// Reported once at import so the run shows what is being compared.
// eslint-disable-next-line no-console
console.log(
  `[attr-penalty] elements=${elementCount} ` +
    `withId=${withIdDoc.length}B noId=${noIdDoc.length}B`,
);

// ---------------------------------------------------------------------------
// Runners
// ---------------------------------------------------------------------------
//
// The parsers are created once and reused across every iteration. Each
// `saxEngine()` call captures its own handler closures, so making a fresh
// parser per iteration gives the internal `onOpenTag` call site an unstable
// target and keeps `processChunk` deoptimized — which measures a cold, deopted
// path rather than real throughput. Reusing one parser per variant (parsers are
// reset by `close()`) reflects how the engine is actually used: one parser,
// many documents.

// Sink to stop the engine's work from being optimized away.
let sink = 0;

// Module-scope handlers => stable call targets => steady-state measurement.
function consumeAttrs(_tagName: string, attributes: Attributes): void {
  for (const key in attributes) {
    const value = attributes[key];
    if (value !== null) sink += value.length;
  }
}
function noopOpenTag(): void {}

const consumingParser = saxEngine({ onOpenTag: consumeAttrs });
const noopParser = saxEngine({ onOpenTag: noopOpenTag });

/** Parse the whole document in a single write, consuming any attributes. */
function parseConsuming(xml: string): void {
  consumingParser.write(xml);
  consumingParser.close();
}

/** Parse the whole document in a single write with a no-op open-tag handler. */
function parseNoop(xml: string): void {
  noopParser.write(xml);
  noopParser.close();
}

// Pre-warm both code paths to steady state before measuring. tinybench's
// default warmup budget is short, and the heavier with-id path needs more
// invocations than the lighter no-id path to reach the top JIT tier. Warming
// both shapes together (interleaved) gives `processChunk` complete type
// feedback so the benchmark measures optimized throughput, not a half-warmed,
// deoptimized path.
for (let i = 0; i < 20_000; i++) {
  parseConsuming(withIdDoc);
  parseConsuming(noIdDoc);
  parseNoop(withIdDoc);
  parseNoop(noIdDoc);
}

// ---------------------------------------------------------------------------
// Attributes consumed in the callback
// ---------------------------------------------------------------------------
describe('attr penalty: eksml SAX (~10 KB, attrs consumed)', () => {
  bench('with id', () => {
    parseConsuming(withIdDoc);
  });

  bench('no id', () => {
    parseConsuming(noIdDoc);
  });
});

// ---------------------------------------------------------------------------
// No-op open-tag handler — isolates the engine's internal attribute cost
// ---------------------------------------------------------------------------
describe('attr penalty: eksml SAX (~10 KB, no-op onOpenTag)', () => {
  bench('with id', () => {
    parseNoop(withIdDoc);
  });

  bench('no id', () => {
    parseNoop(noIdDoc);
  });
});
