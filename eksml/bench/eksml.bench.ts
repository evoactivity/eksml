/**
 * Benchmarks comparing Eksml class methods vs direct function calls.
 *
 * The class is instantiated once outside the benchmarks so we only measure
 * the per-call overhead of the class dispatch (option merging, method call).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bench, describe } from 'vitest';

// --- direct imports ---
import { parse } from '#src/parser.ts';
import { writer } from '#src/writer.ts';
import { lossy } from '#src/converters/lossy.ts';
import { lossless } from '#src/converters/lossless.ts';

// --- class import ---
import { Eksml } from '#src/eksml.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, '../test/fixtures', name), 'utf-8');

const small = `<?xml version="1.0"?><root><item id="1">hello</item><item id="2">world</item></root>`;
const rssFeed = fixture('rss-feed.xml');
const pomXml = fixture('pom.xml');
const xmltvEpg = fixture('xmltv-epg.xml');

// Pre-instantiate class instances (outside benchmarks)
const eksml = new Eksml();
const eksmlEntities = new Eksml({ entities: true });
const eksmlLossy = new Eksml({ output: 'lossy' });
const eksmlLossless = new Eksml({ output: 'lossless' });

// Pre-parse fixtures for writer benchmarks
const parsedSmall = parse(small);
const parsedRss = parse(rssFeed);
const parsedPom = parse(pomXml);
const parsedEpg = parse(xmltvEpg);

// ---------------------------------------------------------------------------
// Parse: class vs direct
// ---------------------------------------------------------------------------
describe('class vs direct: parse small (~100 B)', () => {
  bench('direct parse()', () => {
    parse(small);
  });

  bench('Eksml.parse()', () => {
    eksml.parse(small);
  });
});

describe('class vs direct: parse RSS (~3 KB)', () => {
  bench('direct parse()', () => {
    parse(rssFeed);
  });

  bench('Eksml.parse()', () => {
    eksml.parse(rssFeed);
  });
});

describe('class vs direct: parse POM (~5 KB)', () => {
  bench('direct parse()', () => {
    parse(pomXml);
  });

  bench('Eksml.parse()', () => {
    eksml.parse(pomXml);
  });
});

describe('class vs direct: parse EPG (~9 KB)', () => {
  bench('direct parse()', () => {
    parse(xmltvEpg);
  });

  bench('Eksml.parse()', () => {
    eksml.parse(xmltvEpg);
  });
});

// ---------------------------------------------------------------------------
// Parse with options: class vs direct
// ---------------------------------------------------------------------------
describe('class vs direct: parse with entities small (~100 B)', () => {
  bench('direct parse(entities)', () => {
    parse(small, { entities: true });
  });

  bench('Eksml.parse() (entities in constructor)', () => {
    eksmlEntities.parse(small);
  });
});

describe('class vs direct: parse with entities EPG (~9 KB)', () => {
  bench('direct parse(entities)', () => {
    parse(xmltvEpg, { entities: true });
  });

  bench('Eksml.parse() (entities in constructor)', () => {
    eksmlEntities.parse(xmltvEpg);
  });
});

// ---------------------------------------------------------------------------
// Write: class vs direct
// ---------------------------------------------------------------------------
describe('class vs direct: write small (~100 B)', () => {
  bench('direct writer()', () => {
    writer(parsedSmall);
  });

  bench('Eksml.write()', () => {
    eksml.write(parsedSmall);
  });
});

describe('class vs direct: write RSS (~3 KB)', () => {
  bench('direct writer()', () => {
    writer(parsedRss);
  });

  bench('Eksml.write()', () => {
    eksml.write(parsedRss);
  });
});

describe('class vs direct: write POM (~5 KB)', () => {
  bench('direct writer()', () => {
    writer(parsedPom);
  });

  bench('Eksml.write()', () => {
    eksml.write(parsedPom);
  });
});

describe('class vs direct: write EPG (~9 KB)', () => {
  bench('direct writer()', () => {
    writer(parsedEpg);
  });

  bench('Eksml.write()', () => {
    eksml.write(parsedEpg);
  });
});

// ---------------------------------------------------------------------------
// Convert lossy: class vs direct
// ---------------------------------------------------------------------------
describe('class vs direct: convert lossy small (~100 B)', () => {
  bench('direct lossy()', () => {
    lossy(small);
  });

  bench("Eksml({ output: 'lossy' }).parse()", () => {
    eksmlLossy.parse(small);
  });
});

describe('class vs direct: convert lossy EPG (~9 KB)', () => {
  bench('direct lossy()', () => {
    lossy(xmltvEpg);
  });

  bench("Eksml({ output: 'lossy' }).parse()", () => {
    eksmlLossy.parse(xmltvEpg);
  });
});

// ---------------------------------------------------------------------------
// Convert lossless: class vs direct
// ---------------------------------------------------------------------------
describe('class vs direct: convert lossless small (~100 B)', () => {
  bench('direct lossless()', () => {
    lossless(small);
  });

  bench("Eksml({ output: 'lossless' }).parse()", () => {
    eksmlLossless.parse(small);
  });
});

describe('class vs direct: convert lossless EPG (~9 KB)', () => {
  bench('direct lossless()', () => {
    lossless(xmltvEpg);
  });

  bench("Eksml({ output: 'lossless' }).parse()", () => {
    eksmlLossless.parse(xmltvEpg);
  });
});
