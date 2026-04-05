import { parse } from '@eksml/xml/parser';
import { lossy } from '@eksml/xml/lossy';
import { lossless } from '@eksml/xml/lossless';

const xml = `
<bookstore>
  <book category="fiction">
    <title lang="en">The Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
    <year>1925</year>
    <price>10.99</price>
  </book>
  <book category="non-fiction">
    <title lang="en">Sapiens</title>
    <author>Yuval Noah Harari</author>
    <year>2011</year>
    <price>14.99</price>
  </book>
</bookstore>
`;

// DOM output (default)
const dom = parse(xml);
console.log('DOM:', JSON.stringify(dom, null, 2));

// Lossy JSON — compact, loses attribute/child distinction
const lossyResult = lossy(xml);
console.log('\nLossy:', JSON.stringify(lossyResult, null, 2));

// Lossless JSON — preserves full structure
const losslessResult = lossless(xml);
console.log('\nLossless:', JSON.stringify(losslessResult, null, 2));

// Parse options
const strict = parse(xml, { strict: true, trimWhitespace: true });
console.log('\nStrict + trimmed:', JSON.stringify(strict, null, 2));
