# Benchmarks

All benchmarks run via [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) on Node.js. Fixtures range from ~100 B to ~30 KB of real-world XML (RSS feeds, Atom feeds, SOAP envelopes, Maven POMs, XMLTV EPGs). Full benchmark source is in [`bench/`](./bench/).

Run them yourself:

```sh
pnpm --filter @eksml/xml bench
```

## DOM Parsing

Parse an XML string into a tree structure.

<table>
  <tr>
    <th>Library</th>
    <th align="right">small (~100 B)</th>
    <th align="right">RSS (~3 KB)</th>
    <th align="right">SOAP (~2 KB)</th>
    <th align="right">Atom (~3 KB)</th>
    <th align="right">POM (~5 KB)</th>
    <th align="right">EPG (~9 KB)</th>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right"><strong>1,361,164 op/s</strong></td>
    <td align="right"><strong>86,551 op/s</strong></td>
    <td align="right"><strong>61,091 op/s</strong></td>
    <td align="right"><strong>33,542 op/s</strong></td>
    <td align="right"><strong>12,916 op/s</strong></td>
    <td align="right"><strong>17,004 op/s</strong></td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">906,585 op/s</td>
    <td align="right">--</td>
    <td align="right">48,017 op/s</td>
    <td align="right">26,981 op/s</td>
    <td align="right">11,032 op/s</td>
    <td align="right">13,317 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">470,327 op/s</td>
    <td align="right">24,047 op/s</td>
    <td align="right">16,455 op/s</td>
    <td align="right">9,791 op/s</td>
    <td align="right">3,442 op/s</td>
    <td align="right">4,732 op/s</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">169,185 op/s</td>
    <td align="right">9,412 op/s</td>
    <td align="right">7,133 op/s</td>
    <td align="right">3,482 op/s</td>
    <td align="right">1,313 op/s</td>
    <td align="right">2,279 op/s</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">130,322 op/s</td>
    <td align="right">8,832 op/s</td>
    <td align="right">6,414 op/s</td>
    <td align="right">3,833 op/s</td>
    <td align="right">1,556 op/s</td>
    <td align="right">2,015 op/s</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">92,091 op/s</td>
    <td align="right">5,834 op/s</td>
    <td align="right">4,770 op/s</td>
    <td align="right">2,469 op/s</td>
    <td align="right">861 op/s</td>
    <td align="right">1,378 op/s</td>
  </tr>
</table>

Eksml is **1.2-1.5x faster than tXml**, **3-4x faster than htmlparser2**, **7-10x faster than fast-xml-parser**, and **8-15x faster than xmldom**.

> [!note]
> tXml crashed on the RSS fixture

## SAX Streaming (256 B chunks, with tree building)

Chunked streaming parse where each parser tokenizes SAX events and builds a full DOM tree.

<table>
  <tr>
    <th>Library</th>
    <th align="right">RSS (~3 KB)</th>
    <th align="right">EPG (~9 KB)</th>
    <th align="right">POM (~5 KB)</th>
    <th align="right">EPG 64 B stress</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>73,744 op/s</strong></td>
    <td align="right"><strong>12,385 op/s</strong></td>
    <td align="right"><strong>8,313 op/s</strong></td>
    <td align="right"><strong>11,452 op/s</strong></td>
  </tr>
  <tr>
    <td>Eksml (XmlParseStream)</td>
    <td align="right">31,459 op/s</td>
    <td align="right">7,764 op/s</td>
    <td align="right">5,967 op/s</td>
    <td align="right">4,559 op/s</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">29,121 op/s</td>
    <td align="right">6,628 op/s</td>
    <td align="right">6,791 op/s</td>
    <td align="right">6,284 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">27,279 op/s</td>
    <td align="right">7,372 op/s</td>
    <td align="right">5,919 op/s</td>
    <td align="right">6,821 op/s</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">12,224 op/s</td>
    <td align="right">3,720 op/s</td>
    <td align="right">3,078 op/s</td>
    <td align="right">4,013 op/s</td>
  </tr>
</table>

Eksml's SAX engine is **1.6-2.5x faster than htmlparser2/saxes** and **3-6x faster than sax**.

## Raw Tokenization (no-op callbacks)

Pure scanner throughput with no downstream work -- isolates the tokenizer's raw speed.

<table>
  <tr>
    <th>Library</th>
    <th align="right">RSS (~3 KB)</th>
    <th align="right">EPG (~9 KB)</th>
    <th align="right">POM (~5 KB)</th>
    <th align="right">EPG 64 B stress</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>85,798 op/s</strong></td>
    <td align="right"><strong>16,367 op/s</strong></td>
    <td align="right"><strong>13,465 op/s</strong></td>
    <td align="right"><strong>14,763 op/s</strong></td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">34,370 op/s</td>
    <td align="right">8,990 op/s</td>
    <td align="right">8,484 op/s</td>
    <td align="right">8,965 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">28,558 op/s</td>
    <td align="right">7,534 op/s</td>
    <td align="right">6,126 op/s</td>
    <td align="right">6,980 op/s</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">15,331 op/s</td>
    <td align="right">4,193 op/s</td>
    <td align="right">3,183 op/s</td>
    <td align="right">3,950 op/s</td>
  </tr>
</table>

Eksml's raw tokenizer is **2-2.5x faster than saxes**, **2-3x faster than htmlparser2**, and **4-6x faster than sax**.

## XML Serialization (tree to string)

Serialize a pre-parsed in-memory tree back to XML.

<table>
  <tr>
    <th>Library</th>
    <th align="right">small (~100 B)</th>
    <th align="right">RSS (~3 KB)</th>
    <th align="right">SOAP (~3 KB)</th>
    <th align="right">Atom (~6 KB)</th>
    <th align="right">POM (~8 KB)</th>
    <th align="right">EPG (~30 KB)</th>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right"><strong>1,885,288 op/s</strong></td>
    <td align="right"><strong>308,059 op/s</strong></td>
    <td align="right">195,102 op/s</td>
    <td align="right">87,992 op/s</td>
    <td align="right"><strong>52,345 op/s</strong></td>
    <td align="right">34,001 op/s</td>
  </tr>
  <tr>
    <td><strong>tXml</strong></td>
    <td align="right"><strong>2,459,009 op/s</strong></td>
    <td align="right">--</td>
    <td align="right"><strong>226,242 op/s</strong></td>
    <td align="right"><strong>95,098 op/s</strong></td>
    <td align="right">48,697 op/s</td>
    <td align="right"><strong>43,192 op/s</strong></td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">1,996,848 op/s</td>
    <td align="right">99,635 op/s</td>
    <td align="right">72,448 op/s</td>
    <td align="right">29,742 op/s</td>
    <td align="right">14,393 op/s</td>
    <td align="right">16,840 op/s</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">1,075,965 op/s</td>
    <td align="right">44,446 op/s</td>
    <td align="right">38,996 op/s</td>
    <td align="right">14,354 op/s</td>
    <td align="right">7,318 op/s</td>
    <td align="right">10,038 op/s</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">356,881 op/s</td>
    <td align="right">23,261 op/s</td>
    <td align="right">27,979 op/s</td>
    <td align="right">11,582 op/s</td>
    <td align="right">4,622 op/s</td>
    <td align="right">3,435 op/s</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">220,393 op/s</td>
    <td align="right">16,480 op/s</td>
    <td align="right">19,606 op/s</td>
    <td align="right">8,577 op/s</td>
    <td align="right">4,114 op/s</td>
    <td align="right">4,174 op/s</td>
  </tr>
</table>

Eksml and tXml trade top position depending on document size and shape. Both are **3-7x faster than @xmldom/xmldom** and **7-13x faster than fast-xml-parser/xml2js** at serialization.

> [!note]
> tXml crashed on the RSS fixture

## Fixtures

| Fixture | Size     | Description                          |
| ------- | -------- | ------------------------------------ |
| small   | ~100 B   | Minimal XML element                  |
| RSS     | ~3 KB    | Real-world RSS feed (`rss-feed.xml`) |
| SOAP    | ~2-3 KB  | SOAP envelope (`soap-envelope.xml`)  |
| Atom    | ~3-6 KB  | Atom feed (`atom-feed.xml`)          |
| POM     | ~5-8 KB  | Maven POM (`pom.xml`)                |
| EPG     | ~9-30 KB | XMLTV EPG listing (`xmltv-epg.xml`)  |

Size varies between tables because parsing benchmarks measure input size while serialization benchmarks measure output size (which includes indentation and formatting).

All fixtures are in [`test/fixtures/`](./test/fixtures/).

## Methodology

- **Tool**: [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) (wraps [tinybench](https://github.com/tinylibs/tinybench))
- **Warmup**: Default tinybench warmup iterations
- **Environment**: Single-threaded, synchronous execution on Node.js
- **Comparison libraries**: tXml, htmlparser2, fast-xml-parser, xml2js, @xmldom/xmldom, sax, saxes
- **Source**: [`bench/`](./bench/) directory — `parse.bench.ts`, `stream.bench.ts`, `tokenize.bench.ts`, `writer.bench.ts`, `convert.bench.ts`
