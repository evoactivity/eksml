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
    <td align="right"><strong>1,687,050 op/s</strong></td>
    <td align="right"><strong>137,518 op/s</strong></td>
    <td align="right"><strong>91,376 op/s</strong></td>
    <td align="right"><strong>52,689 op/s</strong></td>
    <td align="right"><strong>20,580 op/s</strong></td>
    <td align="right"><strong>23,075 op/s</strong></td>
    <td align="right"><strong>18,117 op/s</strong></td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">880,187 op/s</td>
    <td align="right">--</td>
    <td align="right">49,093 op/s</td>
    <td align="right">23,746 op/s</td>
    <td align="right">11,110 op/s</td>
    <td align="right">11,358 op/s</td>
    <td align="right">10,858 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">540,625 op/s</td>
    <td align="right">24,978 op/s</td>
    <td align="right">16,564 op/s</td>
    <td align="right">9,935 op/s</td>
    <td align="right">3,237 op/s</td>
    <td align="right">4,910 op/s</td>
    <td align="right">3,935 op/s</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">174,929 op/s</td>
    <td align="right">9,687 op/s</td>
    <td align="right">7,397 op/s</td>
    <td align="right">3,277 op/s</td>
    <td align="right">1,332 op/s</td>
    <td align="right">2,193 op/s</td>
    <td align="right">1,113 op/s</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">120,589 op/s</td>
    <td align="right">8,880 op/s</td>
    <td align="right">7,095 op/s</td>
    <td align="right">3,905 op/s</td>
    <td align="right">1,591 op/s</td>
    <td align="right">2,060 op/s</td>
    <td align="right">1,275 op/s</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">96,819 op/s</td>
    <td align="right">6,170 op/s</td>
    <td align="right">5,033 op/s</td>
    <td align="right">2,563 op/s</td>
    <td align="right">881 op/s</td>
    <td align="right">1,398 op/s</td>
    <td align="right">718 op/s</td>
  </tr>
</table>

Eksml is **1.7-2.2x faster than tXml**, **3-6x faster than htmlparser2**, **10-16x faster than fast-xml-parser**, and **16-25x faster than xmldom**.

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
    <td align="right"><strong>94,345 op/s</strong></td>
    <td align="right"><strong>18,070 op/s</strong></td>
    <td align="right"><strong>15,222 op/s</strong></td>
    <td align="right"><strong>15,334 op/s</strong></td>
    <td align="right"><strong>14,359 op/s</strong></td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">67,106 op/s</td>
    <td align="right">14,223 op/s</td>
    <td align="right">10,839 op/s</td>
    <td align="right">11,231 op/s</td>
    <td align="right">10,515 op/s</td>
  </tr>
  <tr>
    <td>Eksml (XmlParseStream)</td>
    <td align="right">34,741 op/s</td>
    <td align="right">10,990 op/s</td>
    <td align="right">9,123 op/s</td>
    <td align="right">5,351 op/s</td>
    <td align="right">9,627 op/s</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">29,564 op/s</td>
    <td align="right">6,497 op/s</td>
    <td align="right">6,671 op/s</td>
    <td align="right">6,272 op/s</td>
    <td align="right">5,558 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">29,354 op/s</td>
    <td align="right">7,236 op/s</td>
    <td align="right">5,983 op/s</td>
    <td align="right">6,789 op/s</td>
    <td align="right">6,807 op/s</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">25,873 op/s</td>
    <td align="right">7,271 op/s</td>
    <td align="right">6,468 op/s</td>
    <td align="right">6,222 op/s</td>
    <td align="right">4,751 op/s</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">14,816 op/s</td>
    <td align="right">3,826 op/s</td>
    <td align="right">3,010 op/s</td>
    <td align="right">3,773 op/s</td>
    <td align="right">3,073 op/s</td>
  </tr>
  <tr>
    <td>fast-xml-parser (sync, no streaming)</td>
    <td align="right">9,887 op/s</td>
    <td align="right">1,590 op/s</td>
    <td align="right">1,693 op/s</td>
    <td align="right">1,560 op/s</td>
    <td align="right">1,285 op/s</td>
  </tr>
</table>

Eksml's SAX parser is **1.3-1.4x faster than easysax**, **2.1-3.2x faster than htmlparser2/saxes**, and **4.1-6.4x faster than sax**.

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
    <td align="right"><strong>113,482 op/s</strong></td>
    <td align="right"><strong>20,462 op/s</strong></td>
    <td align="right"><strong>18,506 op/s</strong></td>
    <td align="right"><strong>17,186 op/s</strong></td>
    <td align="right"><strong>17,462 op/s</strong></td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">74,171 op/s</td>
    <td align="right">15,868 op/s</td>
    <td align="right">12,637 op/s</td>
    <td align="right">11,124 op/s</td>
    <td align="right">11,316 op/s</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">33,493 op/s</td>
    <td align="right">9,434 op/s</td>
    <td align="right">8,241 op/s</td>
    <td align="right">7,690 op/s</td>
    <td align="right">7,885 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">28,743 op/s</td>
    <td align="right">7,347 op/s</td>
    <td align="right">6,309 op/s</td>
    <td align="right">7,122 op/s</td>
    <td align="right">7,081 op/s</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">27,172 op/s</td>
    <td align="right">7,496 op/s</td>
    <td align="right">6,145 op/s</td>
    <td align="right">6,001 op/s</td>
    <td align="right">5,036 op/s</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">15,458 op/s</td>
    <td align="right">3,997 op/s</td>
    <td align="right">2,945 op/s</td>
    <td align="right">3,664 op/s</td>
    <td align="right">3,252 op/s</td>
  </tr>
</table>

Eksml's tokenizer is **1.3-1.6x faster than easysax**, **2.2-4x faster than saxes/htmlparser2**, and **4.7-7.3x faster than sax**.

> [!note]
> easysax parses attributes lazily (`startNode` receives a `getAttr()` thunk); the benchmark invokes it so every parser materializes attributes, the work all other parsers do unconditionally for their open-tag events.

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
    <td align="right"><strong>2,956,198 op/s</strong></td>
    <td align="right"><strong>398,598 op/s</strong></td>
    <td align="right">242,411 op/s</td>
    <td align="right"><strong>105,006 op/s</strong></td>
    <td align="right"><strong>67,255 op/s</strong></td>
    <td align="right"><strong>50,517 op/s</strong></td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">2,594,809 op/s</td>
    <td align="right">--</td>
    <td align="right">205,646 op/s</td>
    <td align="right">84,696 op/s</td>
    <td align="right">44,360 op/s</td>
    <td align="right">39,346 op/s</td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">2,290,597 op/s</td>
    <td align="right">319,812 op/s</td>
    <td align="right"><strong>246,313 op/s</strong></td>
    <td align="right">101,814 op/s</td>
    <td align="right">53,384 op/s</td>
    <td align="right">36,384 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">2,144,522 op/s</td>
    <td align="right">103,346 op/s</td>
    <td align="right">75,736 op/s</td>
    <td align="right">31,101 op/s</td>
    <td align="right">14,203 op/s</td>
    <td align="right">17,500 op/s</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">1,133,615 op/s</td>
    <td align="right">42,888 op/s</td>
    <td align="right">40,083 op/s</td>
    <td align="right">14,805 op/s</td>
    <td align="right">7,392 op/s</td>
    <td align="right">10,422 op/s</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">333,373 op/s</td>
    <td align="right">24,028 op/s</td>
    <td align="right">29,116 op/s</td>
    <td align="right">12,108 op/s</td>
    <td align="right">4,785 op/s</td>
    <td align="right">3,645 op/s</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">239,138 op/s</td>
    <td align="right">17,067 op/s</td>
    <td align="right">20,056 op/s</td>
    <td align="right">8,778 op/s</td>
    <td align="right">4,332 op/s</td>
    <td align="right">4,174 op/s</td>
  </tr>
</table>

With `validate: false`, Eksml leads every fixture (tXml crashes on RSS). With validation on (the default), Eksml still wins RSS, SOAP, Atom, and POM; tXml edges out the small and EPG fixtures. Unlike tXml's stringify, Eksml's writer validates tag/attribute names by default, guards against circular references, and escapes mixed-quote attribute values — `validate: false` skips only the name validation. Eksml is **2-7x faster than @xmldom/xmldom** and **7-19x faster than fast-xml-parser/xml2js** at serialization on non-trivial documents.

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
