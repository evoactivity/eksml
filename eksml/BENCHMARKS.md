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
    <td align="right"><strong>1,367,666 op/s</strong></td>
    <td align="right"><strong>85,865 op/s</strong></td>
    <td align="right"><strong>64,349 op/s</strong></td>
    <td align="right"><strong>35,517 op/s</strong></td>
    <td align="right"><strong>13,759 op/s</strong></td>
    <td align="right"><strong>17,521 op/s</strong></td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">933,149 op/s</td>
    <td align="right">--</td>
    <td align="right">48,483 op/s</td>
    <td align="right">27,743 op/s</td>
    <td align="right">10,431 op/s</td>
    <td align="right">13,589 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">504,972 op/s</td>
    <td align="right">24,360 op/s</td>
    <td align="right">17,565 op/s</td>
    <td align="right">9,660 op/s</td>
    <td align="right">3,529 op/s</td>
    <td align="right">4,902 op/s</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">166,395 op/s</td>
    <td align="right">9,365 op/s</td>
    <td align="right">7,477 op/s</td>
    <td align="right">3,680 op/s</td>
    <td align="right">1,339 op/s</td>
    <td align="right">2,342 op/s</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">135,079 op/s</td>
    <td align="right">9,673 op/s</td>
    <td align="right">6,895 op/s</td>
    <td align="right">3,912 op/s</td>
    <td align="right">1,525 op/s</td>
    <td align="right">2,068 op/s</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">93,167 op/s</td>
    <td align="right">6,088 op/s</td>
    <td align="right">4,924 op/s</td>
    <td align="right">2,471 op/s</td>
    <td align="right">853 op/s</td>
    <td align="right">1,344 op/s</td>
  </tr>
</table>

Eksml is **1.3-1.5x faster than tXml**, **2.7-4x faster than htmlparser2**, **7-10x faster than fast-xml-parser**, and **13-16x faster than xmldom**.

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
    <td align="right"><strong>88,608 op/s</strong></td>
    <td align="right"><strong>17,966 op/s</strong></td>
    <td align="right"><strong>13,614 op/s</strong></td>
    <td align="right"><strong>14,717 op/s</strong></td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">64,878 op/s</td>
    <td align="right">14,448 op/s</td>
    <td align="right">11,126 op/s</td>
    <td align="right">9,907 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">29,863 op/s</td>
    <td align="right">7,143 op/s</td>
    <td align="right">5,366 op/s</td>
    <td align="right">6,757 op/s</td>
  </tr>
  <tr>
    <td>Eksml (XmlParseStream)</td>
    <td align="right">27,275 op/s</td>
    <td align="right">8,796 op/s</td>
    <td align="right">7,372 op/s</td>
    <td align="right">4,544 op/s</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">26,235 op/s</td>
    <td align="right">6,514 op/s</td>
    <td align="right">6,622 op/s</td>
    <td align="right">5,322 op/s</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">14,799 op/s</td>
    <td align="right">3,346 op/s</td>
    <td align="right">3,009 op/s</td>
    <td align="right">3,503 op/s</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">14,087 op/s</td>
    <td align="right">3,912 op/s</td>
    <td align="right">3,224 op/s</td>
    <td align="right">2,418 op/s</td>
  </tr>
</table>

Eksml's SAX engine is **1.2-1.5x faster than easysax**, **2.1-3.4x faster than htmlparser2/saxes**, and **4-6x faster than sax**.

> [!note]
> @tuananh/sax-parser is a native C++ addon; every `write()` crosses the JS↔C++ boundary, which dominates in chunked streaming.

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
    <td align="right"><strong>112,899 op/s</strong></td>
    <td align="right"><strong>21,792 op/s</strong></td>
    <td align="right"><strong>17,824 op/s</strong></td>
    <td align="right"><strong>17,008 op/s</strong></td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">65,433 op/s</td>
    <td align="right">19,826 op/s</td>
    <td align="right">12,637 op/s</td>
    <td align="right">14,532 op/s</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">34,890 op/s</td>
    <td align="right">7,707 op/s</td>
    <td align="right">8,160 op/s</td>
    <td align="right">8,782 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">30,117 op/s</td>
    <td align="right">7,482 op/s</td>
    <td align="right">5,540 op/s</td>
    <td align="right">6,976 op/s</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">14,575 op/s</td>
    <td align="right">4,397 op/s</td>
    <td align="right">3,384 op/s</td>
    <td align="right">2,260 op/s</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">13,343 op/s</td>
    <td align="right">3,909 op/s</td>
    <td align="right">3,141 op/s</td>
    <td align="right">3,869 op/s</td>
  </tr>
</table>

Eksml's raw tokenizer is **1.1-1.7x faster than easysax**, **1.9-3.2x faster than saxes**, **2.4-3.7x faster than htmlparser2**, and **4-8x faster than sax**.

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
    <td align="right">1,749,947 op/s</td>
    <td align="right">291,007 op/s</td>
    <td align="right">176,028 op/s</td>
    <td align="right">78,439 op/s</td>
    <td align="right"><strong>53,619 op/s</strong></td>
    <td align="right">32,253 op/s</td>
  </tr>
  <tr>
    <td><strong>Eksml (validate: false)</strong></td>
    <td align="right">1,936,294 op/s</td>
    <td align="right"><strong>357,848 op/s</strong></td>
    <td align="right">204,989 op/s</td>
    <td align="right">94,131 op/s</td>
    <td align="right"><strong>64,960 op/s</strong></td>
    <td align="right">36,462 op/s</td>
  </tr>
  <tr>
    <td><strong>tXml</strong></td>
    <td align="right"><strong>2,485,611 op/s</strong></td>
    <td align="right">--</td>
    <td align="right"><strong>225,162 op/s</strong></td>
    <td align="right"><strong>96,822 op/s</strong></td>
    <td align="right">48,394 op/s</td>
    <td align="right"><strong>43,455 op/s</strong></td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">2,027,682 op/s</td>
    <td align="right">100,516 op/s</td>
    <td align="right">73,469 op/s</td>
    <td align="right">30,964 op/s</td>
    <td align="right">14,839 op/s</td>
    <td align="right">15,867 op/s</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">1,117,265 op/s</td>
    <td align="right">45,503 op/s</td>
    <td align="right">39,805 op/s</td>
    <td align="right">15,015 op/s</td>
    <td align="right">6,973 op/s</td>
    <td align="right">10,019 op/s</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">347,964 op/s</td>
    <td align="right">23,913 op/s</td>
    <td align="right">28,453 op/s</td>
    <td align="right">11,452 op/s</td>
    <td align="right">4,610 op/s</td>
    <td align="right">3,609 op/s</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">239,685 op/s</td>
    <td align="right">15,809 op/s</td>
    <td align="right">19,398 op/s</td>
    <td align="right">8,295 op/s</td>
    <td align="right">3,954 op/s</td>
    <td align="right">3,898 op/s</td>
  </tr>
</table>

Eksml wins POM and RSS (where tXml crashes) and, with `validate: false`, ties tXml on Atom (0.97x); tXml keeps the lead on the small, SOAP, and EPG fixtures. Unlike tXml's stringify, Eksml's writer validates tag/attribute names by default, guards against circular references, and escapes mixed-quote attribute values — `validate: false` skips only the name validation. Eksml is **2-6x faster than @xmldom/xmldom** and **4-13x faster than fast-xml-parser/xml2js** at serialization on non-trivial documents.

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
- **Parser reuse**: In the SAX streaming and tokenization suites, every parser is constructed once and reused across iterations (all measured parsers support this; verified by comparing event streams across runs). This measures steady-state parse throughput rather than constructor cost. XmlParseStream is the exception, web streams are single-use, so it pays its constructor per iteration.
- **Comparison libraries**: tXml, htmlparser2, fast-xml-parser, xml2js, @xmldom/xmldom, sax, saxes, easysax, @tuananh/sax-parser
- **Source**: [`bench/`](./bench/) directory — `parse.bench.ts`, `stream.bench.ts`, `tokenize.bench.ts`, `writer.bench.ts`, `convert.bench.ts`
