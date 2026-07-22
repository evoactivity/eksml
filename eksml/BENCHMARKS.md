# Benchmarks

All benchmarks run via [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) on Node.js. Fixtures range from ~100 B to ~30 KB of real-world XML (RSS feeds, Atom feeds, SOAP envelopes, Maven POMs, XMLTV EPGs), plus a ~10 KB synthetic attribute-heavy stress document. Full benchmark source is in [`bench/`](./bench/).

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
    <th align="right">attr-heavy (~10 KB)</th>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right"><strong>1,671,761 op/s</strong></td>
    <td align="right"><strong>136,836 op/s</strong></td>
    <td align="right"><strong>80,224 op/s</strong></td>
    <td align="right"><strong>50,820 op/s</strong></td>
    <td align="right"><strong>19,368 op/s</strong></td>
    <td align="right"><strong>23,393 op/s</strong></td>
    <td align="right"><strong>19,238 op/s</strong></td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">938,409 op/s</td>
    <td align="right">--</td>
    <td align="right">48,620 op/s</td>
    <td align="right">27,021 op/s</td>
    <td align="right">11,108 op/s</td>
    <td align="right">13,098 op/s</td>
    <td align="right">10,194 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">535,825 op/s</td>
    <td align="right">25,042 op/s</td>
    <td align="right">15,399 op/s</td>
    <td align="right">9,501 op/s</td>
    <td align="right">3,306 op/s</td>
    <td align="right">4,455 op/s</td>
    <td align="right">3,918 op/s</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">156,563 op/s</td>
    <td align="right">9,766 op/s</td>
    <td align="right">7,369 op/s</td>
    <td align="right">3,294 op/s</td>
    <td align="right">1,315 op/s</td>
    <td align="right">2,233 op/s</td>
    <td align="right">1,271 op/s</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">119,736 op/s</td>
    <td align="right">8,574 op/s</td>
    <td align="right">6,932 op/s</td>
    <td align="right">3,876 op/s</td>
    <td align="right">1,589 op/s</td>
    <td align="right">2,036 op/s</td>
    <td align="right">1,406 op/s</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">93,498 op/s</td>
    <td align="right">6,212 op/s</td>
    <td align="right">4,952 op/s</td>
    <td align="right">2,551 op/s</td>
    <td align="right">870 op/s</td>
    <td align="right">1,396 op/s</td>
    <td align="right">732 op/s</td>
  </tr>
</table>

Eksml is **1.7-1.9x faster than tXml**, **3-6x faster than htmlparser2**, **10-15x faster than fast-xml-parser**, and **16-26x faster than xmldom**.

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
    <th align="right">attr-heavy (~10 KB)</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>88,604 op/s</strong></td>
    <td align="right">18,605 op/s</td>
    <td align="right"><strong>14,986 op/s</strong></td>
    <td align="right">15,003 op/s</td>
    <td align="right"><strong>13,719 op/s</strong></td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">66,566 op/s</td>
    <td align="right">13,357 op/s</td>
    <td align="right">11,065 op/s</td>
    <td align="right">11,233 op/s</td>
    <td align="right">10,310 op/s</td>
  </tr>
  <tr>
    <td>Eksml (XmlParseStream)</td>
    <td align="right">33,687 op/s</td>
    <td align="right">10,776 op/s</td>
    <td align="right">9,020 op/s</td>
    <td align="right">5,186 op/s</td>
    <td align="right">9,352 op/s</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">27,902 op/s</td>
    <td align="right">5,884 op/s</td>
    <td align="right">6,687 op/s</td>
    <td align="right">6,013 op/s</td>
    <td align="right">5,117 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">26,433 op/s</td>
    <td align="right">7,080 op/s</td>
    <td align="right">5,779 op/s</td>
    <td align="right">6,598 op/s</td>
    <td align="right">6,791 op/s</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">24,238 op/s</td>
    <td align="right"><strong>19,238 op/s</strong></td>
    <td align="right">12,849 op/s</td>
    <td align="right"><strong>18,062 op/s</strong></td>
    <td align="right">11,681 op/s</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">14,553 op/s</td>
    <td align="right">3,773 op/s</td>
    <td align="right">2,848 op/s</td>
    <td align="right">3,775 op/s</td>
    <td align="right">3,055 op/s</td>
  </tr>
  <tr>
    <td>fast-xml-parser (sync, no streaming)</td>
    <td align="right">9,296 op/s</td>
    <td align="right">1,560 op/s</td>
    <td align="right">1,659 op/s</td>
    <td align="right">1,471 op/s</td>
    <td align="right">1,271 op/s</td>
  </tr>
</table>

Eksml's SAX parser is **1.3-1.4x faster than easysax**, **2.1-3.4x faster than htmlparser2/saxes**, and **4-6.1x faster than sax**. @tuananh/sax-parser 1.6 has largely closed its streaming gap: it takes the two EPG columns (its 64 B number now exceeds its 256 B number, so per-write cost is effectively gone) while Eksml holds RSS, POM, and attr-heavy.

> [!note]
> @tuananh/sax-parser is a native C++ addon; marshalling event arguments across the JS↔C++ boundary dominates its chunked-streaming cost. Since 1.4 it skips argument materialization for zero-arity listeners, so the no-op benchmark callbacks declare parameters — every other parser materializes arguments unconditionally, and the comparison requires equal work.

> [!note]
> fast-xml-parser cannot stream; its row parses the fully buffered document synchronously and is included as a reference point.

## Raw Tokenization (no-op callbacks)

Pure scanner throughput with no downstream work -- isolates the tokenizer's raw speed.

<table>
  <tr>
    <th>Library</th>
    <th align="right">RSS (~3 KB)</th>
    <th align="right">EPG (~9 KB)</th>
    <th align="right">POM (~5 KB)</th>
    <th align="right">EPG 64 B stress</th>
    <th align="right">attr-heavy (~10 KB)</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>110,856 op/s</strong></td>
    <td align="right"><strong>21,940 op/s</strong></td>
    <td align="right"><strong>19,298 op/s</strong></td>
    <td align="right"><strong>16,679 op/s</strong></td>
    <td align="right"><strong>17,334 op/s</strong></td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">72,166 op/s</td>
    <td align="right">14,151 op/s</td>
    <td align="right">12,304 op/s</td>
    <td align="right">11,824 op/s</td>
    <td align="right">11,712 op/s</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">35,117 op/s</td>
    <td align="right">8,889 op/s</td>
    <td align="right">8,110 op/s</td>
    <td align="right">8,692 op/s</td>
    <td align="right">8,225 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">30,412 op/s</td>
    <td align="right">7,587 op/s</td>
    <td align="right">5,852 op/s</td>
    <td align="right">7,028 op/s</td>
    <td align="right">7,186 op/s</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">22,011 op/s</td>
    <td align="right">16,577 op/s</td>
    <td align="right">14,692 op/s</td>
    <td align="right">15,889 op/s</td>
    <td align="right">11,361 op/s</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">14,798 op/s</td>
    <td align="right">3,871 op/s</td>
    <td align="right">3,102 op/s</td>
    <td align="right">3,935 op/s</td>
    <td align="right">3,229 op/s</td>
  </tr>
</table>

Eksml's tokenizer is **1.4-1.6x faster than easysax**, **2.2-3.6x faster than saxes/htmlparser2**, and **4.2-7.5x faster than sax**. @tuananh/sax-parser 1.6 is now the clear second on the EPG and POM columns (Eksml's lead there is 1.05-1.3x), though it trails 5x on RSS.

> [!note]
> easysax parses attributes lazily (`startNode` receives a `getAttr()` thunk); the benchmark invokes it so every parser materializes attributes, the work all other parsers do unconditionally for their open-tag events. The no-op callbacks declare parameters so @tuananh/sax-parser's zero-arity fast path (since 1.4) cannot skip argument materialization.

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
    <td><strong>Eksml (validate: false)</strong></td>
    <td align="right"><strong>2,871,391 op/s</strong></td>
    <td align="right"><strong>397,795 op/s</strong></td>
    <td align="right"><strong>268,371 op/s</strong></td>
    <td align="right"><strong>114,966 op/s</strong></td>
    <td align="right"><strong>65,675 op/s</strong></td>
    <td align="right"><strong>48,937 op/s</strong></td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">2,505,673 op/s</td>
    <td align="right">333,746 op/s</td>
    <td align="right">239,973 op/s</td>
    <td align="right">99,309 op/s</td>
    <td align="right">56,743 op/s</td>
    <td align="right">44,820 op/s</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">2,497,332 op/s</td>
    <td align="right">--</td>
    <td align="right">226,516 op/s</td>
    <td align="right">94,239 op/s</td>
    <td align="right">48,090 op/s</td>
    <td align="right">43,259 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">1,970,254 op/s</td>
    <td align="right">91,344 op/s</td>
    <td align="right">69,848 op/s</td>
    <td align="right">31,198 op/s</td>
    <td align="right">15,045 op/s</td>
    <td align="right">16,766 op/s</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">1,127,647 op/s</td>
    <td align="right">46,274 op/s</td>
    <td align="right">39,898 op/s</td>
    <td align="right">14,238 op/s</td>
    <td align="right">6,713 op/s</td>
    <td align="right">6,579 op/s</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">379,445 op/s</td>
    <td align="right">22,185 op/s</td>
    <td align="right">27,485 op/s</td>
    <td align="right">10,187 op/s</td>
    <td align="right">4,375 op/s</td>
    <td align="right">3,526 op/s</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">243,078 op/s</td>
    <td align="right">17,016 op/s</td>
    <td align="right">19,815 op/s</td>
    <td align="right">8,582 op/s</td>
    <td align="right">4,354 op/s</td>
    <td align="right">3,735 op/s</td>
  </tr>
</table>

Eksml leads every fixture, with and without validation (tXml crashes on RSS, and default-validation Eksml edges tXml within noise on the small fixture). Unlike tXml's stringify, Eksml's writer validates tag/attribute names by default, guards against circular references, and escapes mixed-quote attribute values — `validate: false` skips only the name validation. Eksml is **2-8x faster than @xmldom/xmldom** and **7-20x faster than fast-xml-parser/xml2js** at serialization on non-trivial documents.

> [!note]
> tXml crashed on the RSS fixture

## Fixtures

| Fixture    | Size     | Description                                                                                                                        |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| small      | ~100 B   | Minimal XML element                                                                                                                |
| RSS        | ~3 KB    | Real-world RSS feed (`rss-feed.xml`)                                                                                               |
| SOAP       | ~2-3 KB  | SOAP envelope (`soap-envelope.xml`)                                                                                                |
| Atom       | ~3-6 KB  | Atom feed (`atom-feed.xml`)                                                                                                        |
| POM        | ~5-8 KB  | Maven POM (`pom.xml`)                                                                                                              |
| EPG        | ~9-30 KB | XMLTV EPG listing (`xmltv-epg.xml`)                                                                                                |
| attr-heavy | ~10 KB   | Synthetic stress doc mirroring @tuananh/sax-parser's benchmark: 158 tiny elements, one attribute each (`attr-heavy-synthetic.xml`) |

Size varies between tables because parsing benchmarks measure input size while serialization benchmarks measure output size (which includes indentation and formatting).

All fixtures are in [`test/fixtures/`](./test/fixtures/).

## Methodology

- **Tool**: [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) (wraps [tinybench](https://github.com/tinylibs/tinybench))
- **Warmup**: Default tinybench warmup iterations
- **Environment**: Single-threaded, synchronous execution on Node.js
- **Parser reuse**: In the SAX streaming and tokenization suites, every parser is constructed once and reused across iterations (all measured parsers support this; verified by comparing event streams across runs). This measures steady-state parse throughput rather than constructor cost. XmlParseStream is the exception, web streams are single-use, so it pays its constructor per iteration.
- **Public APIs**: Every library is measured through its public API. Eksml's SAX rows use `createSaxParser` (the `@eksml/xml/sax` export), not the internal engine.
- **Comparison libraries**: tXml, htmlparser2, fast-xml-parser, xml2js, @xmldom/xmldom, sax, saxes, easysax, @tuananh/sax-parser
- **Source**: [`bench/`](./bench/) directory — `parse.bench.ts`, `stream.bench.ts`, `tokenize.bench.ts`, `writer.bench.ts`, `convert.bench.ts`
