/**
 * Very large document benchmarks — 10 MB, 50 MB, and 250 MB of plausible
 * real-world XML (a faker-generated product catalogue), delivered in 64 KB
 * chunks (Node's default stream highWaterMark).
 *
 * Opt-in because generation plus the slower parsers make this suite take
 * tens of minutes:
 *
 *   pnpm bench:large                       # all three sizes
 *   LARGE_BENCH_SIZES=10,50 pnpm bench:large
 *
 * Fixtures live in test/fixtures/large/ (gitignored) and are generated on
 * demand by bench/generate-large-fixture.mjs; generation is seeded, so
 * every machine benchmarks byte-identical documents.
 *
 * Handler policy matches tokenize.bench.ts: every parser registers the
 * full event surface (open/close/text/cdata/comment/PI) with no-op
 * callbacks that declare parameters, so no parser can skip argument
 * materialization or event collection.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bench, describe } from 'vitest';

import { createSaxParser } from '#src/sax.ts';

import SaxParser from '@tuananh/sax-parser';
import EasySax from 'easysax';
import { Parser as Htmlparser2 } from 'htmlparser2';
import sax from 'sax';
import { SaxesParser } from 'saxes';

// @ts-expect-error plain-JS generator module without type declarations
import { generateLargeFixture } from './generate-large-fixture.mjs';

const ENABLED = process.env.LARGE_BENCH === '1';
const CHUNK_BYTES = 64 * 1024;

const ALL_SIZES = [10, 50, 250];
const sizes = process.env.LARGE_BENCH_SIZES
  ? process.env.LARGE_BENCH_SIZES.split(',').map(Number)
  : ALL_SIZES;

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = (mb: number) =>
  resolve(__dirname, '../test/fixtures/large', `catalog-${mb}mb.xml`);

if (!ENABLED) {
  describe('large documents (disabled)', () => {
    bench.skip('set LARGE_BENCH=1 or run pnpm bench:large', () => {});
  });
} else {
  // Generate any missing fixtures before the suites are registered.
  for (const mb of sizes) {
    if (!existsSync(fixturePath(mb))) {
      console.log(`[large] generating ${mb} MB fixture...`);
      const { products } = await generateLargeFixture(
        mb * 1024 * 1024,
        fixturePath(mb),
      );
      console.log(`[large] wrote ${products.toLocaleString()} products`);
    }
  }

  // No-op callback with DECLARED parameters, matching tokenize.bench.ts:
  // some parsers probe listener arity and skip materializing arguments for
  // zero-arity handlers.
  const noop = (_a?: unknown, _b?: unknown) => {};

  const eksmlParser = createSaxParser();
  eksmlParser.on('openTag', noop);
  eksmlParser.on('closeTag', noop);
  eksmlParser.on('text', noop);
  eksmlParser.on('cdata', noop);
  eksmlParser.on('comment', noop);
  eksmlParser.on('processingInstruction', noop);

  const saxParser = sax.parser(true);
  saxParser.onopentag = noop;
  saxParser.onclosetag = noop;
  saxParser.ontext = noop;
  saxParser.oncdata = noop;
  saxParser.oncomment = noop;
  saxParser.onprocessinginstruction = noop;

  const saxesParser = new SaxesParser();
  saxesParser.on('opentag', noop);
  saxesParser.on('closetag', noop);
  saxesParser.on('text', noop);
  saxesParser.on('cdata', noop);
  saxesParser.on('comment', noop);
  saxesParser.on('processinginstruction', noop);

  const htmlparser2Parser = new Htmlparser2(
    {
      onopentag: noop,
      onclosetag: noop,
      ontext: noop,
      oncdatastart: noop,
      oncdataend: noop,
      oncomment: noop,
      onprocessinginstruction: noop,
    },
    { xmlMode: true },
  );

  const tuananhParser = new SaxParser();
  tuananhParser.on('startElement', noop);
  tuananhParser.on('endElement', noop);
  tuananhParser.on('text', noop);
  tuananhParser.on('cdata', noop);
  tuananhParser.on('comment', noop);
  tuananhParser.on('processingInstruction', noop);

  const easysaxParser = new EasySax();
  easysaxParser.on('startNode', (_name: string, getAttr: () => unknown) => {
    getAttr();
  });
  easysaxParser.on('endNode', noop);
  easysaxParser.on('textNode', noop);
  easysaxParser.on('cdata', noop);
  easysaxParser.on('comment', noop);
  easysaxParser.on('question', noop);

  const runners: Record<string, (chunks: string[]) => void> = {
    eksml: (chunks) => {
      for (const chunk of chunks) eksmlParser.write(chunk);
      eksmlParser.close();
    },
    sax: (chunks) => {
      for (const chunk of chunks) saxParser.write(chunk);
      saxParser.close();
    },
    saxes: (chunks) => {
      for (const chunk of chunks) saxesParser.write(chunk);
      saxesParser.close();
    },
    htmlparser2: (chunks) => {
      for (const chunk of chunks) htmlparser2Parser.write(chunk);
      htmlparser2Parser.end();
      htmlparser2Parser.reset();
    },
    '@tuananh/sax-parser': (chunks) => {
      for (const chunk of chunks) tuananhParser.write(chunk);
      tuananhParser.end();
    },
    easysax: (chunks) => {
      for (const chunk of chunks) easysaxParser.write(chunk);
      easysaxParser.end();
    },
  };

  // Iteration counts shrink with document size so the suite finishes in
  // reasonable time; time: 0 disables tinybench's duration-based looping.
  const iterationsBySize: Record<number, number> = { 10: 5, 50: 3, 250: 2 };

  for (const mb of sizes) {
    const doc = readFileSync(fixturePath(mb), 'utf8');
    const chunks: string[] = [];
    for (let i = 0; i < doc.length; i += CHUNK_BYTES) {
      chunks.push(doc.slice(i, i + CHUNK_BYTES));
    }
    const options = {
      time: 0,
      warmupTime: 0,
      warmupIterations: 1,
      iterations: iterationsBySize[mb] ?? 2,
    };

    describe(`large: catalog ${mb} MB (64 KB chunks)`, () => {
      for (const [name, run] of Object.entries(runners)) {
        bench(
          name,
          () => {
            run(chunks);
          },
          options,
        );
      }
    });
  }
}
