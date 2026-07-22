# Benchmarks

All benchmarks run via [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) on Node.js. Fixtures range from ~100 B to ~30 KB of real-world XML (RSS feeds, Atom feeds, SOAP envelopes, Maven POMs, XMLTV EPGs), plus a ~10 KB synthetic attribute-heavy stress document. Full benchmark source is in [`bench/`](./bench/).

Run them yourself:

```sh
pnpm --filter @eksml/xml bench
```

## DOM Parsing

Parse an XML string into a tree structure.

### Overview

<!-- bench:table DOM Parsing :: Overview -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">geometric mean</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right"><strong>71,409 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">35,936 op/s</td>
    <td align="right">1.99x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">14,707 op/s</td>
    <td align="right">4.86x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">5,564 op/s</td>
    <td align="right">12.83x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">5,469 op/s</td>
    <td align="right">13.06x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">3,527 op/s</td>
    <td align="right">20.25x slower</td>
  </tr>
</table>

<!-- /bench:table -->

> [!note]
> tXml crashed on the RSS fixture

### small (~100 B)

<!-- bench:table DOM Parsing :: small (~100 B) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right"><strong>1,661,243 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">1,008,262 op/s</td>
    <td align="right">1.65x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">543,433 op/s</td>
    <td align="right">3.06x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">165,332 op/s</td>
    <td align="right">10.05x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">129,948 op/s</td>
    <td align="right">12.78x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">96,510 op/s</td>
    <td align="right">17.21x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### RSS (~3 KB)

<!-- bench:table DOM Parsing :: RSS (~3 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right"><strong>139,120 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">24,828 op/s</td>
    <td align="right">5.60x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">9,819 op/s</td>
    <td align="right">14.17x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">9,512 op/s</td>
    <td align="right">14.63x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">6,090 op/s</td>
    <td align="right">22.84x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### SOAP (~2 KB)

<!-- bench:table DOM Parsing :: SOAP (~2 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right"><strong>87,674 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">48,827 op/s</td>
    <td align="right">1.80x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">17,611 op/s</td>
    <td align="right">4.98x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">7,163 op/s</td>
    <td align="right">12.24x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">7,089 op/s</td>
    <td align="right">12.37x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">5,055 op/s</td>
    <td align="right">17.34x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### Atom (~3 KB)

<!-- bench:table DOM Parsing :: Atom (~3 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right"><strong>52,445 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">27,496 op/s</td>
    <td align="right">1.91x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">9,508 op/s</td>
    <td align="right">5.52x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">3,847 op/s</td>
    <td align="right">13.63x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">3,534 op/s</td>
    <td align="right">14.84x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">2,578 op/s</td>
    <td align="right">20.34x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### POM (~5 KB)

<!-- bench:table DOM Parsing :: POM (~5 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right"><strong>19,591 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">11,172 op/s</td>
    <td align="right">1.75x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">3,526 op/s</td>
    <td align="right">5.56x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">1,590 op/s</td>
    <td align="right">12.32x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">1,275 op/s</td>
    <td align="right">15.37x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">860 op/s</td>
    <td align="right">22.77x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### EPG (~9 KB)

<!-- bench:table DOM Parsing :: EPG (~9 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right"><strong>23,252 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">13,230 op/s</td>
    <td align="right">1.76x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">4,745 op/s</td>
    <td align="right">4.90x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">2,198 op/s</td>
    <td align="right">10.58x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">2,056 op/s</td>
    <td align="right">11.31x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">1,405 op/s</td>
    <td align="right">16.55x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### attr-heavy (~10 KB)

<!-- bench:table DOM Parsing :: attr-heavy (~10 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right"><strong>19,559 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">10,764 op/s</td>
    <td align="right">1.82x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">3,938 op/s</td>
    <td align="right">4.97x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">1,498 op/s</td>
    <td align="right">13.06x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">1,272 op/s</td>
    <td align="right">15.38x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">733 op/s</td>
    <td align="right">26.67x slower</td>
  </tr>
</table>

<!-- /bench:table -->

## SAX Streaming (256 B chunks, with tree building)

Chunked streaming parse where each parser tokenizes SAX events and builds a full DOM tree.

### Overview

<!-- bench:table SAX Streaming (256 B chunks, with tree building) :: Overview -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">geometric mean</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>21,566 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">16,708 op/s</td>
    <td align="right">1.29x slower</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">15,546 op/s</td>
    <td align="right">1.39x slower</td>
  </tr>
  <tr>
    <td><strong>Eksml (XmlParseStream)</strong></td>
    <td align="right">10,703 op/s</td>
    <td align="right">2.02x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">8,747 op/s</td>
    <td align="right">2.47x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">8,494 op/s</td>
    <td align="right">2.54x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">4,583 op/s</td>
    <td align="right">4.71x slower</td>
  </tr>
</table>

<!-- /bench:table -->

@tuananh/sax-parser 1.6 has largely closed its streaming gap: the EPG 64 B stress fixture is a coin flip between it and Eksml, and it is clear second on EPG, POM, and attr-heavy.

> [!note]
> @tuananh/sax-parser is a native C++ addon; marshalling event arguments across the JS↔C++ boundary dominates its chunked-streaming cost. Since 1.4 it skips argument materialization for zero-arity listeners, so the no-op benchmark callbacks declare parameters — every other parser materializes arguments unconditionally, and the comparison requires equal work. Its throughput is also sensitive to which listener types exist at all: registering comment/cdata/PI listeners costs it roughly a third on EPG, whose ~12.5 KB produce just 9 comments, 1 processing instruction, and no CDATA — the cost comes from the listeners being registered, not from the events occurring. Both suites register the same full event surface (open/close/text/cdata/comment/PI) so their numbers are comparable.

### RSS (~3 KB)

<!-- bench:table SAX Streaming (256 B chunks, with tree building) :: RSS (~3 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>86,980 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">66,925 op/s</td>
    <td align="right">1.30x slower</td>
  </tr>
  <tr>
    <td><strong>Eksml (XmlParseStream)</strong></td>
    <td align="right">32,998 op/s</td>
    <td align="right">2.64x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">29,356 op/s</td>
    <td align="right">2.96x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">28,528 op/s</td>
    <td align="right">3.05x slower</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">23,954 op/s</td>
    <td align="right">3.63x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">14,792 op/s</td>
    <td align="right">5.88x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### EPG (~9 KB)

<!-- bench:table SAX Streaming (256 B chunks, with tree building) :: EPG (~9 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>16,960 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">15,829 op/s</td>
    <td align="right">1.07x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">14,401 op/s</td>
    <td align="right">1.18x slower</td>
  </tr>
  <tr>
    <td><strong>Eksml (XmlParseStream)</strong></td>
    <td align="right">10,874 op/s</td>
    <td align="right">1.56x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">7,039 op/s</td>
    <td align="right">2.41x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">6,612 op/s</td>
    <td align="right">2.57x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,826 op/s</td>
    <td align="right">4.43x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### POM (~5 KB)

<!-- bench:table SAX Streaming (256 B chunks, with tree building) :: POM (~5 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>15,205 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">13,789 op/s</td>
    <td align="right">1.10x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">11,127 op/s</td>
    <td align="right">1.37x slower</td>
  </tr>
  <tr>
    <td><strong>Eksml (XmlParseStream)</strong></td>
    <td align="right">8,754 op/s</td>
    <td align="right">1.74x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">6,692 op/s</td>
    <td align="right">2.27x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">5,647 op/s</td>
    <td align="right">2.69x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,011 op/s</td>
    <td align="right">5.05x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### EPG 64 B stress

<!-- bench:table SAX Streaming (256 B chunks, with tree building) :: EPG 64 B stress -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right"><strong>15,447 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right">15,253 op/s</td>
    <td align="right">1.01x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">11,398 op/s</td>
    <td align="right">1.36x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">6,797 op/s</td>
    <td align="right">2.27x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">6,169 op/s</td>
    <td align="right">2.50x slower</td>
  </tr>
  <tr>
    <td><strong>Eksml (XmlParseStream)</strong></td>
    <td align="right">5,087 op/s</td>
    <td align="right">3.04x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,799 op/s</td>
    <td align="right">4.07x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### attr-heavy (~10 KB)

<!-- bench:table SAX Streaming (256 B chunks, with tree building) :: attr-heavy (~10 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>13,636 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">11,243 op/s</td>
    <td align="right">1.21x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">10,651 op/s</td>
    <td align="right">1.28x slower</td>
  </tr>
  <tr>
    <td><strong>Eksml (XmlParseStream)</strong></td>
    <td align="right">8,787 op/s</td>
    <td align="right">1.55x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">6,642 op/s</td>
    <td align="right">2.05x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">5,518 op/s</td>
    <td align="right">2.47x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,121 op/s</td>
    <td align="right">4.37x slower</td>
  </tr>
</table>

<!-- /bench:table -->

## Raw Tokenization (no-op callbacks)

Pure scanner throughput with no downstream work -- isolates the tokenizer's raw speed.

### Overview

<!-- bench:table Raw Tokenization (no-op callbacks) :: Overview -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">geometric mean</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>27,205 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">18,038 op/s</td>
    <td align="right">1.51x slower</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">16,027 op/s</td>
    <td align="right">1.70x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">11,093 op/s</td>
    <td align="right">2.45x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">9,308 op/s</td>
    <td align="right">2.92x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">4,665 op/s</td>
    <td align="right">5.83x slower</td>
  </tr>
</table>

<!-- /bench:table -->

@tuananh/sax-parser 1.6 is now the clear second on every fixture except RSS, where it trails 5x.

> [!note]
> easysax parses attributes lazily (`startNode` receives a `getAttr()` thunk); the benchmark invokes it so every parser materializes attributes, the work all other parsers do unconditionally for their open-tag events. The no-op callbacks declare parameters so @tuananh/sax-parser's zero-arity fast path (since 1.4) cannot skip argument materialization.

### RSS (~3 KB)

<!-- bench:table Raw Tokenization (no-op callbacks) :: RSS (~3 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>113,398 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">72,718 op/s</td>
    <td align="right">1.56x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">34,958 op/s</td>
    <td align="right">3.24x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">28,807 op/s</td>
    <td align="right">3.94x slower</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">22,715 op/s</td>
    <td align="right">4.99x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">14,575 op/s</td>
    <td align="right">7.78x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### EPG (~9 KB)

<!-- bench:table Raw Tokenization (no-op callbacks) :: EPG (~9 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>20,910 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">16,455 op/s</td>
    <td align="right">1.27x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">15,663 op/s</td>
    <td align="right">1.33x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">9,285 op/s</td>
    <td align="right">2.25x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">7,642 op/s</td>
    <td align="right">2.74x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,938 op/s</td>
    <td align="right">5.31x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### POM (~5 KB)

<!-- bench:table Raw Tokenization (no-op callbacks) :: POM (~5 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>19,668 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">14,481 op/s</td>
    <td align="right">1.36x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">12,674 op/s</td>
    <td align="right">1.55x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">8,199 op/s</td>
    <td align="right">2.40x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">6,288 op/s</td>
    <td align="right">3.13x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,109 op/s</td>
    <td align="right">6.33x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### EPG 64 B stress

<!-- bench:table Raw Tokenization (no-op callbacks) :: EPG 64 B stress -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>17,497 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">15,967 op/s</td>
    <td align="right">1.10x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">11,017 op/s</td>
    <td align="right">1.59x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">8,085 op/s</td>
    <td align="right">2.16x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">7,079 op/s</td>
    <td align="right">2.47x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,763 op/s</td>
    <td align="right">4.65x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### attr-heavy (~10 KB)

<!-- bench:table Raw Tokenization (no-op callbacks) :: attr-heavy (~10 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>18,262 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">12,236 op/s</td>
    <td align="right">1.49x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">12,009 op/s</td>
    <td align="right">1.52x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">7,808 op/s</td>
    <td align="right">2.34x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">7,128 op/s</td>
    <td align="right">2.56x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,290 op/s</td>
    <td align="right">5.55x slower</td>
  </tr>
</table>

<!-- /bench:table -->

## Large document (10 MB, 64 KB chunks)

Chunked tokenization of a 10 MB document — a seeded, faker-generated product catalogue (`bench/generate-large-fixture.mjs`) with real-world shape: mixed attribute density, varied text lengths, comments, and CDATA. The fixture is generated on demand into `test/fixtures/large/` (gitignored); because generation is seeded, every machine benchmarks a byte-identical document. Handler policy matches the tokenization suite. 50 MB and 250 MB runs are available via `pnpm bench:large`.

<!-- bench:table Large document (10 MB, 64 KB chunks) :: catalog (10 MB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right"><strong>32.0 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">21.7 op/s</td>
    <td align="right">1.48x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">12.1 op/s</td>
    <td align="right">2.64x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">10.1 op/s</td>
    <td align="right">3.18x slower</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">8.5 op/s</td>
    <td align="right">3.74x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">5.4 op/s</td>
    <td align="right">5.94x slower</td>
  </tr>
</table>

<!-- /bench:table -->

## XML Serialization (tree to string)

Serialize a pre-parsed in-memory tree back to XML.

### Overview

<!-- bench:table XML Serialization (tree to string) :: Overview -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">geometric mean</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (validate: false)</strong></td>
    <td align="right"><strong>218,385 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">190,592 op/s</td>
    <td align="right">1.15x slower</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">162,265 op/s</td>
    <td align="right">1.35x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">68,263 op/s</td>
    <td align="right">3.20x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">35,335 op/s</td>
    <td align="right">6.18x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">18,703 op/s</td>
    <td align="right">11.68x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">15,320 op/s</td>
    <td align="right">14.25x slower</td>
  </tr>
</table>

<!-- /bench:table -->

With `validate: false`, Eksml leads every fixture (tXml crashes on RSS). With validation on, Eksml holds SOAP, Atom, and POM while the small and EPG fixtures trade with tXml within run-to-run noise. Unlike tXml's stringify, Eksml's writer validates tag/attribute names by default, guards against circular references, and escapes mixed-quote attribute values — `validate: false` skips only the name validation.

> [!note]
> tXml crashed on the RSS fixture

### small (~100 B)

<!-- bench:table XML Serialization (tree to string) :: small (~100 B) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (validate: false)</strong></td>
    <td align="right"><strong>2,595,279 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">2,467,524 op/s</td>
    <td align="right">1.05x slower</td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">2,425,920 op/s</td>
    <td align="right">1.07x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">2,013,627 op/s</td>
    <td align="right">1.29x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">1,146,014 op/s</td>
    <td align="right">2.26x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">382,971 op/s</td>
    <td align="right">6.78x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">245,615 op/s</td>
    <td align="right">10.57x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### RSS (~3 KB)

<!-- bench:table XML Serialization (tree to string) :: RSS (~3 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (validate: false)</strong></td>
    <td align="right"><strong>395,563 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">331,671 op/s</td>
    <td align="right">1.19x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">97,145 op/s</td>
    <td align="right">4.07x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">46,099 op/s</td>
    <td align="right">8.58x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">23,292 op/s</td>
    <td align="right">16.98x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">16,994 op/s</td>
    <td align="right">23.28x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### SOAP (~3 KB)

<!-- bench:table XML Serialization (tree to string) :: SOAP (~3 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (validate: false)</strong></td>
    <td align="right"><strong>269,993 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">235,359 op/s</td>
    <td align="right">1.15x slower</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">232,137 op/s</td>
    <td align="right">1.16x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">69,038 op/s</td>
    <td align="right">3.91x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">39,906 op/s</td>
    <td align="right">6.77x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">27,028 op/s</td>
    <td align="right">9.99x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">19,135 op/s</td>
    <td align="right">14.11x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### Atom (~6 KB)

<!-- bench:table XML Serialization (tree to string) :: Atom (~6 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (validate: false)</strong></td>
    <td align="right"><strong>116,037 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">101,175 op/s</td>
    <td align="right">1.15x slower</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">93,107 op/s</td>
    <td align="right">1.25x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">30,473 op/s</td>
    <td align="right">3.81x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">14,260 op/s</td>
    <td align="right">8.14x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">11,288 op/s</td>
    <td align="right">10.28x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">8,607 op/s</td>
    <td align="right">13.48x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### POM (~8 KB)

<!-- bench:table XML Serialization (tree to string) :: POM (~8 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (validate: false)</strong></td>
    <td align="right"><strong>66,775 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">57,227 op/s</td>
    <td align="right">1.17x slower</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">48,396 op/s</td>
    <td align="right">1.38x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">14,617 op/s</td>
    <td align="right">4.57x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">6,854 op/s</td>
    <td align="right">9.74x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">4,429 op/s</td>
    <td align="right">15.08x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">4,405 op/s</td>
    <td align="right">15.16x slower</td>
  </tr>
</table>

<!-- /bench:table -->

### EPG (~30 KB)

<!-- bench:table XML Serialization (tree to string) :: EPG (~30 KB) -->

<table>
  <tr>
    <th>Library</th>
    <th align="right">op/s</th>
    <th align="right">vs fastest</th>
  </tr>
  <tr>
    <td><strong>Eksml (validate: false)</strong></td>
    <td align="right"><strong>50,509 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">43,716 op/s</td>
    <td align="right">1.16x slower</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">43,583 op/s</td>
    <td align="right">1.16x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">16,821 op/s</td>
    <td align="right">3.00x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">9,445 op/s</td>
    <td align="right">5.35x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">4,270 op/s</td>
    <td align="right">11.83x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">3,551 op/s</td>
    <td align="right">14.22x slower</td>
  </tr>
</table>

<!-- /bench:table -->

## Fixtures

| Fixture    | Size      | Description                                                                                                                                                    |
| ---------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| small      | ~100 B    | Minimal XML element                                                                                                                                            |
| RSS        | ~3 KB     | Real-world RSS feed (`rss-feed.xml`)                                                                                                                           |
| SOAP       | ~2-3 KB   | SOAP envelope (`soap-envelope.xml`)                                                                                                                            |
| Atom       | ~3-6 KB   | Atom feed (`atom-feed.xml`)                                                                                                                                    |
| POM        | ~5-8 KB   | Maven POM (`pom.xml`)                                                                                                                                          |
| EPG        | ~9-30 KB  | XMLTV EPG listing (`xmltv-epg.xml`)                                                                                                                            |
| attr-heavy | ~10 KB    | Synthetic stress doc mirroring @tuananh/sax-parser's benchmark: 158 tiny elements, one attribute each (`attr-heavy-synthetic.xml`)                             |
| catalog    | 10-250 MB | Seeded faker-generated product catalogue, real-world shape; generated on demand into `test/fixtures/large/` (gitignored) by `bench/generate-large-fixture.mjs` |

Size varies between tables because parsing benchmarks measure input size while serialization benchmarks measure output size (which includes indentation and formatting).

All fixtures are in [`test/fixtures/`](./test/fixtures/).

## Methodology

- **Tool**: [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) (wraps [tinybench](https://github.com/tinylibs/tinybench))
- **Tables**: Each section opens with an overview ranking libraries by the geometric mean of op/s across the section's fixtures (an arithmetic mean would be dominated by the smallest, fastest fixture; a library that cannot parse a fixture is not rewarded for the gap, anything that beats it on every fixture it completes ranks above it). The per-fixture tables are sorted by op/s and show each library's speedup relative to that fixture's winner. All tables are generated from a bench run by [`bench/benchmarks-to-markdown.mjs`](./bench/benchmarks-to-markdown.mjs) and spliced into this document in place, between HTML comment markers, by `pnpm bench:tables`. Prose is written by hand; a newly added fixture needs its marker pair placed once, wherever its table should live.
- **Warmup**: Default tinybench warmup iterations
- **Environment**: Single-threaded, synchronous execution on Node.js
- **Parser reuse**: In the SAX streaming and tokenization suites, every parser is constructed once and reused across iterations (all measured parsers support this; verified by comparing event streams across runs). This measures steady-state parse throughput rather than constructor cost. XmlParseStream is the exception, web streams are single-use, so it pays its constructor per iteration.
- **Public APIs**: Every library is measured through its public API. Eksml's SAX rows use `createSaxParser` (the `@eksml/xml/sax` export), not the internal engine.
- **Comparison libraries**: tXml, htmlparser2, fast-xml-parser, xml2js, @xmldom/xmldom, sax, saxes, easysax, @tuananh/sax-parser
- **Source**: [`bench/`](./bench/) directory — `parse.bench.ts`, `stream.bench.ts`, `tokenize.bench.ts`, `large.bench.ts`, `writer.bench.ts`, `convert.bench.ts`, `attr-penalty.bench.ts`
