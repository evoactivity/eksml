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
    <td align="right"><strong>1,221,950 op/s</strong></td>
    <td align="right"><strong>87,714 op/s</strong></td>
    <td align="right"><strong>66,135 op/s</strong></td>
    <td align="right"><strong>35,922 op/s</strong></td>
    <td align="right"><strong>13,943 op/s</strong></td>
    <td align="right"><strong>16,917 op/s</strong></td>
    <td align="right"><strong>14,420 op/s</strong></td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">1,007,229 op/s</td>
    <td align="right">--</td>
    <td align="right">45,389 op/s</td>
    <td align="right">27,982 op/s</td>
    <td align="right">9,383 op/s</td>
    <td align="right">13,520 op/s</td>
    <td align="right">11,369 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">523,318 op/s</td>
    <td align="right">25,204 op/s</td>
    <td align="right">17,709 op/s</td>
    <td align="right">10,151 op/s</td>
    <td align="right">3,590 op/s</td>
    <td align="right">4,942 op/s</td>
    <td align="right">3,886 op/s</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">171,272 op/s</td>
    <td align="right">9,932 op/s</td>
    <td align="right">7,520 op/s</td>
    <td align="right">3,745 op/s</td>
    <td align="right">1,360 op/s</td>
    <td align="right">2,358 op/s</td>
    <td align="right">1,282 op/s</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">133,748 op/s</td>
    <td align="right">9,809 op/s</td>
    <td align="right">6,727 op/s</td>
    <td align="right">3,951 op/s</td>
    <td align="right">1,563 op/s</td>
    <td align="right">2,080 op/s</td>
    <td align="right">1,510 op/s</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">89,126 op/s</td>
    <td align="right">5,640 op/s</td>
    <td align="right">5,112 op/s</td>
    <td align="right">2,604 op/s</td>
    <td align="right">895 op/s</td>
    <td align="right">1,414 op/s</td>
    <td align="right">702 op/s</td>
  </tr>
</table>

Eksml is **1.2-1.5x faster than tXml**, **2.3-3.9x faster than htmlparser2**, **7-11x faster than fast-xml-parser**, and **12-21x faster than xmldom**.

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
    <td align="right"><strong>95,408 op/s</strong></td>
    <td align="right"><strong>17,945 op/s</strong></td>
    <td align="right"><strong>13,932 op/s</strong></td>
    <td align="right"><strong>14,932 op/s</strong></td>
    <td align="right"><strong>13,431 op/s</strong></td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">66,897 op/s</td>
    <td align="right">14,591 op/s</td>
    <td align="right">11,235 op/s</td>
    <td align="right">10,517 op/s</td>
    <td align="right">10,604 op/s</td>
  </tr>
  <tr>
    <td>Eksml (XmlParseStream)</td>
    <td align="right">30,549 op/s</td>
    <td align="right">9,794 op/s</td>
    <td align="right">8,947 op/s</td>
    <td align="right">4,457 op/s</td>
    <td align="right">8,690 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">30,083 op/s</td>
    <td align="right">7,384 op/s</td>
    <td align="right">5,461 op/s</td>
    <td align="right">6,912 op/s</td>
    <td align="right">6,877 op/s</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">26,185 op/s</td>
    <td align="right">6,602 op/s</td>
    <td align="right">6,780 op/s</td>
    <td align="right">5,821 op/s</td>
    <td align="right">5,634 op/s</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">14,988 op/s</td>
    <td align="right">3,561 op/s</td>
    <td align="right">3,044 op/s</td>
    <td align="right">3,806 op/s</td>
    <td align="right">2,922 op/s</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">14,084 op/s</td>
    <td align="right">3,918 op/s</td>
    <td align="right">3,249 op/s</td>
    <td align="right">2,394 op/s</td>
    <td align="right">2,410 op/s</td>
  </tr>
</table>

Eksml's SAX parser is **1.2-1.4x faster than easysax**, **2-3.6x faster than htmlparser2/saxes**, and **3.9-6.4x faster than sax**.

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
    <th align="right">attr-heavy (~10 KB)</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>104,122 op/s</strong></td>
    <td align="right"><strong>20,970 op/s</strong></td>
    <td align="right"><strong>19,927 op/s</strong></td>
    <td align="right"><strong>17,063 op/s</strong></td>
    <td align="right"><strong>15,605 op/s</strong></td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">73,389 op/s</td>
    <td align="right">15,678 op/s</td>
    <td align="right">11,899 op/s</td>
    <td align="right">11,982 op/s</td>
    <td align="right">11,933 op/s</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">35,355 op/s</td>
    <td align="right">9,492 op/s</td>
    <td align="right">7,290 op/s</td>
    <td align="right">8,870 op/s</td>
    <td align="right">8,562 op/s</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">30,520 op/s</td>
    <td align="right">7,647 op/s</td>
    <td align="right">6,334 op/s</td>
    <td align="right">6,475 op/s</td>
    <td align="right">7,145 op/s</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">15,307 op/s</td>
    <td align="right">3,679 op/s</td>
    <td align="right">3,184 op/s</td>
    <td align="right">3,928 op/s</td>
    <td align="right">3,315 op/s</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">12,907 op/s</td>
    <td align="right">4,197 op/s</td>
    <td align="right">3,217 op/s</td>
    <td align="right">2,388 op/s</td>
    <td align="right">2,608 op/s</td>
  </tr>
</table>

Eksml's tokenizer is **1.3-1.7x faster than easysax**, **1.8-3.4x faster than saxes/htmlparser2**, and **4.3-6.8x faster than sax**.

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
