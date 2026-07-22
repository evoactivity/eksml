// Generates a plausible real-world-style XML document of any target size,
// for benchmarking parsers on very large inputs.
//
// Usage:
//   node bench/generate-large-fixture.mjs <sizeInMB> <outputPath>
//
// The document is a product catalogue: varied element depth, a mix of
// attribute-light and attribute-heavy elements, short and long text runs,
// occasional comments and CDATA sections, and entity-escaped text. Tag
// names avoid tXml's hardcoded HTML void-element list (link, meta, img,
// br, hr, input) so every comparison parser can read the output.
//
// Faker is seeded and record composition uses a seeded PRNG, so a given
// target size always produces byte-identical output. Field values are
// drawn from pre-generated pools rather than per-record faker calls, which
// keeps 250 MB generation to seconds rather than minutes; composition
// varies per record so content does not visibly repeat.
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { once } from 'node:events';
import { faker } from '@faker-js/faker';

const SEED = 424242;

function escapeXml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Deterministic PRNG (mulberry32) for record composition. */
function createRandom(seed) {
  let state = seed;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPools() {
  faker.seed(SEED);
  const pool = (count, fn) =>
    Array.from({ length: count }, () => escapeXml(fn()));
  return {
    productNames: pool(2000, () => faker.commerce.productName()),
    brands: pool(800, () => faker.company.name()),
    descriptions: pool(2000, () => faker.lorem.sentences({ min: 1, max: 4 })),
    reviewBodies: pool(1500, () => faker.lorem.sentences({ min: 1, max: 3 })),
    authors: pool(1000, () => faker.person.fullName()),
    categories: pool(60, () => faker.commerce.department().toLowerCase()),
    warehouses: pool(
      80,
      () =>
        `${faker.location
          .city()
          .toUpperCase()
          .replace(/[^A-Z]/g, '')}-${faker.number.int({ min: 1, max: 9 })}`,
    ),
    currencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD'],
  };
}

export async function generateLargeFixture(targetBytes, outputPath) {
  const pools = buildPools();
  const random = createRandom(SEED);
  const pick = (list) => list[Math.floor(random() * list.length)];

  mkdirSync(dirname(outputPath), { recursive: true });
  const out = createWriteStream(outputPath);
  let bytes = 0;
  async function write(text) {
    bytes += Buffer.byteLength(text);
    if (!out.write(text)) await once(out, 'drain');
  }

  const header =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<catalog generated="2026-07-22T00:00:00Z" schemaVersion="1.4">\n';
  const footer = '</catalog>\n';
  await write(header);

  let id = 0;
  while (bytes < targetBytes - Buffer.byteLength(footer)) {
    id++;
    if (id % 50 === 1) {
      await write(`  <!-- batch ${Math.ceil(id / 50)} -->\n`);
    }

    const sku = `${String.fromCharCode(65 + Math.floor(random() * 26))}${String.fromCharCode(65 + Math.floor(random() * 26))}${String.fromCharCode(65 + Math.floor(random() * 26))}-${String(Math.floor(random() * 9000) + 1000)}`;
    const updated = `2026-${String(1 + Math.floor(random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(random() * 28)).padStart(2, '0')}T${String(Math.floor(random() * 24)).padStart(2, '0')}:${String(Math.floor(random() * 60)).padStart(2, '0')}:00Z`;
    const price = (random() * 990 + 10).toFixed(2);

    let record =
      `  <product id="prd-${String(id).padStart(7, '0')}" sku="${sku}" updated="${updated}">\n` +
      `    <name>${pick(pools.productNames)}</name>\n` +
      `    <brand>${pick(pools.brands)}</brand>\n` +
      `    <price currency="${pick(pools.currencies)}">${price}</price>\n` +
      `    <stock warehouse="${pick(pools.warehouses)}">${Math.floor(random() * 2000)}</stock>\n`;

    const categoryCount = 1 + Math.floor(random() * 3);
    record += '    <categories>\n';
    for (let i = 0; i < categoryCount; i++) {
      record += `      <category>${pick(pools.categories)}</category>\n`;
    }
    record += '    </categories>\n';

    record += `    <description>${pick(pools.descriptions)}</description>\n`;

    const reviewCount = Math.floor(random() * 4); // 0-3
    for (let i = 0; i < reviewCount; i++) {
      const rating = 1 + Math.floor(random() * 5);
      const verified = random() < 0.7;
      record +=
        `    <review rating="${rating}" verified="${verified}">\n` +
        `      <author>${pick(pools.authors)}</author>\n`;
      // CDATA for roughly a third of review bodies, plain text otherwise
      record +=
        random() < 0.33
          ? `      <body><![CDATA[${pick(pools.reviewBodies).replaceAll('&amp;', '&')}]]></body>\n`
          : `      <body>${pick(pools.reviewBodies)}</body>\n`;
      record += '    </review>\n';
    }

    record += '  </product>\n';
    await write(record);
  }

  await write(footer);
  out.end();
  await once(out, 'finish');
  return { bytes, products: id };
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const sizeMb = Number(process.argv[2]);
  const outputPath = process.argv[3];
  if (!sizeMb || !outputPath) {
    console.error(
      'usage: node bench/generate-large-fixture.mjs <sizeInMB> <outputPath>',
    );
    process.exit(1);
  }
  const started = performance.now();
  const { bytes, products } = await generateLargeFixture(
    sizeMb * 1024 * 1024,
    outputPath,
  );
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(
    `wrote ${(bytes / 1024 / 1024).toFixed(1)} MB (${products.toLocaleString()} products) to ${outputPath} in ${seconds}s`,
  );
}
