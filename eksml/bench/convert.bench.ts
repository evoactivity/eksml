/**
 * Benchmarks comparing eksml object converters (lossless, lossy) against
 * fast-xml-parser and xml2js which produce similar JS object output.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bench, describe } from 'vitest';

// --- eksml ---
import { lossless } from '#src/converters/lossless.ts';
import { lossy } from '#src/converters/lossy.ts';

// --- competitors ---
import { XMLParser } from 'fast-xml-parser';
import { parseStringPromise } from 'xml2js';
import {
  parse as txmlParse,
  simplify as txmlSimplify,
  simplifyLostLess,
  type tNode,
  // @ts-ignore
} from 'txml/dist/txml.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, '../test/fixtures', name), 'utf-8');

const small = `<?xml version="1.0"?><root><item id="1">hello</item><item id="2">world</item></root>`;
const rssFeed = fixture('rss-feed.xml');
const soapEnvelope = fixture('soap-envelope.xml');
const atomFeed = fixture('atom-feed.xml');
const pomXml = fixture('pom.xml');
const xmltvEpg = fixture('xmltv-epg.xml');

// Pre-instantiate reusable parser instances
const fxp = new XMLParser({ ignoreAttributes: false });

// ---------------------------------------------------------------------------
// Small document — ~100 bytes
// ---------------------------------------------------------------------------
describe('convert: small XML (~100 B)', () => {
  bench('lossless', () => {
    lossless(small);
  });

  bench('lossy', () => {
    lossy(small);
  });

  bench('lossless (strict)', () => {
    lossless(small, { strict: true });
  });

  bench('lossy (strict)', () => {
    lossy(small, { strict: true });
  });

  bench('fast-xml-parser', () => {
    fxp.parse(small);
  });

  bench('xml2js', async () => {
    await parseStringPromise(small);
  });

  bench('txml (simplify)', () => {
    txmlSimplify(txmlParse(small) as tNode[]);
  });

  bench('txml (simplifyLostLess)', () => {
    simplifyLostLess(txmlParse(small) as tNode[]);
  });
});

// ---------------------------------------------------------------------------
// RSS feed — ~3 KB
// ---------------------------------------------------------------------------
describe('convert: RSS feed (~3 KB)', () => {
  bench('lossless', () => {
    lossless(rssFeed);
  });

  bench('lossy', () => {
    lossy(rssFeed);
  });

  bench('lossless (strict)', () => {
    lossless(rssFeed, { strict: true });
  });

  bench('lossy (strict)', () => {
    lossy(rssFeed, { strict: true });
  });

  bench('fast-xml-parser', () => {
    fxp.parse(rssFeed);
  });

  bench('xml2js', async () => {
    await parseStringPromise(rssFeed);
  });

  // txml crashes on this fixture — omitted
});

// ---------------------------------------------------------------------------
// SOAP envelope — ~3 KB
// ---------------------------------------------------------------------------
describe('convert: SOAP envelope (~3 KB)', () => {
  bench('lossless', () => {
    lossless(soapEnvelope);
  });

  bench('lossy', () => {
    lossy(soapEnvelope);
  });

  bench('lossless (strict)', () => {
    lossless(soapEnvelope, { strict: true });
  });

  bench('lossy (strict)', () => {
    lossy(soapEnvelope, { strict: true });
  });

  bench('fast-xml-parser', () => {
    fxp.parse(soapEnvelope);
  });

  bench('xml2js', async () => {
    await parseStringPromise(soapEnvelope);
  });

  bench('txml (simplify)', () => {
    txmlSimplify(txmlParse(soapEnvelope) as tNode[]);
  });

  bench('txml (simplifyLostLess)', () => {
    simplifyLostLess(txmlParse(soapEnvelope) as tNode[]);
  });
});

// ---------------------------------------------------------------------------
// Atom feed — ~6 KB
// ---------------------------------------------------------------------------
describe('convert: Atom feed (~6 KB)', () => {
  bench('lossless', () => {
    lossless(atomFeed);
  });

  bench('lossy', () => {
    lossy(atomFeed);
  });

  bench('lossless (strict)', () => {
    lossless(atomFeed, { strict: true });
  });

  bench('lossy (strict)', () => {
    lossy(atomFeed, { strict: true });
  });

  bench('fast-xml-parser', () => {
    fxp.parse(atomFeed);
  });

  bench('xml2js', async () => {
    await parseStringPromise(atomFeed);
  });

  bench('txml (simplify)', () => {
    txmlSimplify(txmlParse(atomFeed) as tNode[]);
  });

  bench('txml (simplifyLostLess)', () => {
    simplifyLostLess(txmlParse(atomFeed) as tNode[]);
  });
});

// ---------------------------------------------------------------------------
// Maven POM — ~8 KB
// ---------------------------------------------------------------------------
describe('convert: Maven POM (~8 KB)', () => {
  bench('lossless', () => {
    lossless(pomXml);
  });

  bench('lossy', () => {
    lossy(pomXml);
  });

  bench('lossless (strict)', () => {
    lossless(pomXml, { strict: true });
  });

  bench('lossy (strict)', () => {
    lossy(pomXml, { strict: true });
  });

  bench('fast-xml-parser', () => {
    fxp.parse(pomXml);
  });

  bench('xml2js', async () => {
    await parseStringPromise(pomXml);
  });

  bench('txml (simplify)', () => {
    txmlSimplify(txmlParse(pomXml) as tNode[]);
  });

  bench('txml (simplifyLostLess)', () => {
    simplifyLostLess(txmlParse(pomXml) as tNode[]);
  });
});

// ---------------------------------------------------------------------------
// XMLTV EPG — ~30 KB
// ---------------------------------------------------------------------------
describe('convert: XMLTV EPG (~30 KB)', () => {
  bench('lossless', () => {
    lossless(xmltvEpg);
  });

  bench('lossy', () => {
    lossy(xmltvEpg);
  });

  bench('lossless (strict)', () => {
    lossless(xmltvEpg, { strict: true });
  });

  bench('lossy (strict)', () => {
    lossy(xmltvEpg, { strict: true });
  });

  bench('fast-xml-parser', () => {
    fxp.parse(xmltvEpg);
  });

  bench('xml2js', async () => {
    await parseStringPromise(xmltvEpg);
  });

  bench('txml (simplify)', () => {
    txmlSimplify(txmlParse(xmltvEpg) as tNode[]);
  });

  bench('txml (simplifyLostLess)', () => {
    simplifyLostLess(txmlParse(xmltvEpg) as tNode[]);
  });
});
