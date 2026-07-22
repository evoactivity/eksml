// Turns a vitest bench JSON report into the markdown tables used in
// BENCHMARKS.md.
//
// Usage:
//   vitest bench --run --outputJson=bench-results.json
//   node bench/benchmarks-to-markdown.mjs bench-results.json
//
// Each section gets an overview table ranking libraries by the geometric
// mean of op/s across the section's fixtures, followed by one table per
// fixture showing exact op/s and the speedup relative to that fixture's
// winner (the same ratios vitest prints in its run summary).
//
// Overview ordering: an arithmetic mean would be dominated by the
// smallest, fastest fixture, so the geometric mean is used. A library
// with a missing fixture (for example tXml crashing on RSS) is not
// rewarded for the gap: any library that beats it on every fixture it
// completes is ranked above it.
import { readFileSync, writeFileSync } from 'node:fs';

// Suite names as they appear in the vitest report, mapped to the fixture
// headings used in BENCHMARKS.md. Suites not listed here (XHTML, convert,
// attr-penalty) are intentionally not tabulated.
const SECTIONS = [
  {
    title: 'DOM Parsing',
    fixtures: [
      { header: 'small (~100 B)', suite: 'small XML (~100 B)' },
      { header: 'RSS (~3 KB)', suite: 'RSS feed (~3 KB)' },
      { header: 'SOAP (~2 KB)', suite: 'SOAP envelope (~2 KB)' },
      { header: 'Atom (~3 KB)', suite: 'Atom feed (~3 KB)' },
      { header: 'POM (~5 KB)', suite: 'Maven POM (~5 KB)' },
      { header: 'EPG (~9 KB)', suite: 'XMLTV EPG (~9 KB)' },
      {
        header: 'attr-heavy (~10 KB)',
        suite: 'attr-heavy synthetic (~10 KB)',
      },
    ],
  },
  {
    title: 'SAX Streaming (256 B chunks, with tree building)',
    fixtures: [
      { header: 'RSS (~3 KB)', suite: 'stream: RSS feed (256 B chunks)' },
      {
        header: 'EPG (~9 KB)',
        suite: 'stream: XMLTV EPG (256 B chunks)',
      },
      {
        header: 'POM (~5 KB)',
        suite: 'stream: Maven POM (256 B chunks)',
      },
      {
        header: 'EPG 64 B stress',
        suite: 'stream: XMLTV EPG (64 B chunks — stress)',
      },
      {
        header: 'attr-heavy (~10 KB)',
        suite: 'stream: attr-heavy synthetic (256 B chunks)',
      },
    ],
  },
  {
    title: 'Raw Tokenization (no-op callbacks)',
    fixtures: [
      {
        header: 'RSS (~3 KB)',
        suite: 'tokenize: RSS feed (256 B chunks)',
      },
      {
        header: 'EPG (~9 KB)',
        suite: 'tokenize: XMLTV EPG (256 B chunks)',
      },
      {
        header: 'POM (~5 KB)',
        suite: 'tokenize: Maven POM (256 B chunks)',
      },
      {
        header: 'EPG 64 B stress',
        suite: 'tokenize: XMLTV EPG (64 B chunks — stress)',
      },
      {
        header: 'attr-heavy (~10 KB)',
        suite: 'tokenize: attr-heavy synthetic (256 B chunks)',
      },
    ],
    // the tokenize bench registers eksml as plain "eksml" but the
    // published table labels the row with the API it measures
    renames: { eksml: 'Eksml (SAX)' },
  },
  {
    title: 'Large document (10 MB, 64 KB chunks)',
    fixtures: [
      {
        header: 'catalog (10 MB)',
        suite: 'large: catalog 10 MB (64 KB chunks)',
      },
    ],
    renames: { eksml: 'Eksml (SAX)' },
  },
  {
    title: 'XML Serialization (tree to string)',
    fixtures: [
      { header: 'small (~100 B)', suite: 'write: small XML (~100 B)' },
      { header: 'RSS (~3 KB)', suite: 'write: RSS feed (~3 KB)' },
      { header: 'SOAP (~3 KB)', suite: 'write: SOAP envelope (~3 KB)' },
      { header: 'Atom (~6 KB)', suite: 'write: Atom feed (~6 KB)' },
      { header: 'POM (~8 KB)', suite: 'write: Maven POM (~8 KB)' },
      { header: 'EPG (~30 KB)', suite: 'write: XMLTV EPG (~30 KB)' },
    ],
  },
];

// Bench registration names mapped to published display names. Names not
// listed pass through unchanged.
const DISPLAY_NAMES = {
  eksml: 'Eksml',
  'eksml (validate: false)': 'Eksml (validate: false)',
  'eksml (SAX)': 'Eksml (SAX)',
  'eksml (XmlParseStream)': 'Eksml (XmlParseStream)',
  txml: 'tXml',
  'txml (simplify)': 'tXml (simplify)',
  'txml (simplifyLostLess)': 'tXml (simplifyLostLess)',
};

function loadResults(path) {
  const report = JSON.parse(readFileSync(path, 'utf8'));
  // suite name -> { bench name -> hz }
  const suites = new Map();
  for (const file of report.files) {
    for (const group of file.groups) {
      // fullName is "bench/file.bench.ts > suite name"
      const suiteName = group.fullName.split(' > ').slice(1).join(' > ');
      const entries = new Map();
      for (const bench of group.benchmarks) {
        entries.set(bench.name, bench.hz);
      }
      suites.set(suiteName, entries);
    }
  }
  return suites;
}

function displayName(section, name) {
  return section.renames?.[name] ?? DISPLAY_NAMES[name] ?? name;
}

function label(display) {
  return display.startsWith('Eksml') ? `<strong>${display}</strong>` : display;
}

function opsCell(hz, isWinner) {
  // low-rate benches (large documents) need the decimal to be comparable
  const value =
    hz >= 100 ? Math.round(hz).toLocaleString('en-US') : hz.toFixed(1);
  const formatted = `${value} op/s`;
  return isWinner ? `<strong>${formatted}</strong>` : formatted;
}

function geometricMean(values) {
  let logSum = 0;
  for (const value of values) logSum += Math.log(value);
  return Math.exp(logSum / values.length);
}

/** True when b beats a on every fixture a completed. */
function dominates(b, a) {
  return a.values.every(
    (value, i) => value === null || (b.values[i] ?? 0) > value,
  );
}

function buildOverviewRows(section, columnData) {
  const libraries = new Set();
  for (const entries of columnData) {
    for (const name of entries.keys()) libraries.add(name);
  }

  const rows = [...libraries].map((name) => {
    const values = columnData.map((entries) => entries.get(name) ?? null);
    const present = values.filter((v) => v !== null);
    return {
      display: displayName(section, name),
      values,
      geomean: geometricMean(present),
    };
  });

  rows.sort((a, b) => b.geomean - a.geomean);

  // Dominance fixup for rows with missing fixtures: their geomean is
  // computed over an easier set, so bubble them below any row that beats
  // them on every fixture they completed.
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < rows.length - 1; i++) {
      const above = rows[i];
      const below = rows[i + 1];
      if (above.values.includes(null) && dominates(below, above)) {
        rows[i] = below;
        rows[i + 1] = above;
        changed = true;
      }
    }
  }

  return rows;
}

function renderOverview(rows) {
  const lines = [
    '<table>',
    '  <tr>',
    '    <th>Library</th>',
    '    <th align="right">geometric mean</th>',
    '    <th align="right">vs fastest</th>',
    '  </tr>',
  ];
  // rows[0] is not always the highest geomean: the dominance fixup can
  // demote a library with missing fixtures, so find the true maximum
  const best = Math.max(...rows.map((row) => row.geomean));
  for (const row of rows) {
    const relative =
      row.geomean === best ? '—' : `${(best / row.geomean).toFixed(2)}x slower`;
    lines.push(
      '  <tr>',
      `    <td>${label(row.display)}</td>`,
      `    <td align="right">${opsCell(row.geomean, row.geomean === best)}</td>`,
      `    <td align="right">${relative}</td>`,
      '  </tr>',
    );
  }
  lines.push('</table>');
  return lines.join('\n');
}

function renderFixture(section, entries) {
  const rows = [...entries.entries()]
    .map(([name, hz]) => ({ display: displayName(section, name), hz }))
    .sort((a, b) => b.hz - a.hz);
  const fastest = rows[0].hz;

  const lines = [
    '<table>',
    '  <tr>',
    '    <th>Library</th>',
    '    <th align="right">op/s</th>',
    '    <th align="right">vs fastest</th>',
    '  </tr>',
  ];
  for (const row of rows) {
    const relative =
      row.hz === fastest ? '—' : `${(fastest / row.hz).toFixed(2)}x slower`;
    lines.push(
      '  <tr>',
      `    <td>${label(row.display)}</td>`,
      `    <td align="right">${opsCell(row.hz, row.hz === fastest)}</td>`,
      `    <td align="right">${relative}</td>`,
      '  </tr>',
    );
  }
  lines.push('</table>');
  return lines.join('\n');
}

/** Render every table, keyed by "<section title> :: <Overview|fixture header>". */
function renderAll(suites) {
  const tables = new Map();
  for (const section of SECTIONS) {
    const columnData = section.fixtures.map(({ suite }) => {
      const entries = suites.get(suite);
      if (!entries) throw new Error(`missing suite in report: ${suite}`);
      return entries;
    });
    // a single-fixture section's overview would duplicate its only table
    if (section.fixtures.length > 1) {
      tables.set(
        `${section.title} :: Overview`,
        renderOverview(buildOverviewRows(section, columnData)),
      );
    }
    section.fixtures.forEach((fixture, i) => {
      tables.set(
        `${section.title} :: ${fixture.header}`,
        renderFixture(section, columnData[i]),
      );
    });
  }
  return tables;
}

/**
 * Replace the contents of every marked block in the document:
 *
 *   <!-- bench:table <key> -->
 *   ...replaced...
 *   <!-- /bench:table -->
 *
 * Errors on markers with unknown keys; warns about rendered tables that
 * have no marker (a newly added fixture needs its marker placed by hand
 * once, wherever it should live in the document).
 */
function spliceIntoDocument(documentPath, tables) {
  const doc = readFileSync(documentPath, 'utf8');
  const seen = new Set();
  const out = doc.replace(
    /<!-- bench:table (.+?) -->[\s\S]*?<!-- \/bench:table -->/g,
    (_match, key) => {
      const table = tables.get(key);
      if (!table) throw new Error(`marker with unknown key: ${key}`);
      seen.add(key);
      return `<!-- bench:table ${key} -->\n\n${table}\n\n<!-- /bench:table -->`;
    },
  );
  for (const key of tables.keys()) {
    if (!seen.has(key)) {
      console.warn(`warning: no marker in ${documentPath} for: ${key}`);
    }
  }
  writeFileSync(documentPath, out);
  return seen.size;
}

const args = process.argv.slice(2);
const writeIndex = args.indexOf('--write');
const documentPath = writeIndex === -1 ? null : args[writeIndex + 1];
const inputPath =
  args.filter((a, i) => i !== writeIndex && i !== writeIndex + 1)[0] ??
  'bench-results.json';

const tables = renderAll(loadResults(inputPath));

if (documentPath) {
  const count = spliceIntoDocument(documentPath, tables);
  console.log(`updated ${count} tables in ${documentPath}`);
} else {
  const output = [];
  for (const [key, table] of tables) {
    output.push(`<!-- ${key} -->`, '', table, '');
  }
  console.log(output.join('\n'));
}
