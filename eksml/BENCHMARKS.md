# Benchmarks

All benchmarks run via [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) on Node.js. Fixtures range from ~100 B to ~30 KB of real-world XML (RSS feeds, Atom feeds, SOAP envelopes, Maven POMs, XMLTV EPGs), plus a ~10 KB synthetic attribute-heavy stress document and a generated 10 MB product catalogue (with 50 MB and 250 MB variants via `pnpm bench:large`). Full benchmark source is in [`bench/`](./bench/).

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
    <td align="right"><strong>71,601 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">35,030 op/s</td>
    <td align="right">2.04x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">14,668 op/s</td>
    <td align="right">4.88x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">5,562 op/s</td>
    <td align="right">12.87x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">5,476 op/s</td>
    <td align="right">13.08x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">3,484 op/s</td>
    <td align="right">20.55x slower</td>
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
    <td align="right"><strong>1,633,153 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">965,270 op/s</td>
    <td align="right">1.69x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">533,389 op/s</td>
    <td align="right">3.06x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">173,701 op/s</td>
    <td align="right">9.40x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">129,634 op/s</td>
    <td align="right">12.60x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">94,080 op/s</td>
    <td align="right">17.36x slower</td>
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
    <td align="right"><strong>137,377 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">24,579 op/s</td>
    <td align="right">5.59x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">9,813 op/s</td>
    <td align="right">14.00x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">9,296 op/s</td>
    <td align="right">14.78x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">5,808 op/s</td>
    <td align="right">23.65x slower</td>
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
    <td align="right"><strong>90,320 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">49,642 op/s</td>
    <td align="right">1.82x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">16,901 op/s</td>
    <td align="right">5.34x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">7,142 op/s</td>
    <td align="right">12.65x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">7,064 op/s</td>
    <td align="right">12.79x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">4,989 op/s</td>
    <td align="right">18.10x slower</td>
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
    <td align="right"><strong>52,715 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">26,179 op/s</td>
    <td align="right">2.01x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">9,972 op/s</td>
    <td align="right">5.29x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">3,743 op/s</td>
    <td align="right">14.08x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">3,649 op/s</td>
    <td align="right">14.45x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">2,563 op/s</td>
    <td align="right">20.56x slower</td>
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
    <td align="right"><strong>19,899 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">11,174 op/s</td>
    <td align="right">1.78x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">3,421 op/s</td>
    <td align="right">5.82x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">1,603 op/s</td>
    <td align="right">12.41x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">1,285 op/s</td>
    <td align="right">15.49x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">882 op/s</td>
    <td align="right">22.57x slower</td>
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
    <td align="right"><strong>23,438 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">12,804 op/s</td>
    <td align="right">1.83x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">4,901 op/s</td>
    <td align="right">4.78x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">2,285 op/s</td>
    <td align="right">10.26x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">1,971 op/s</td>
    <td align="right">11.89x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">1,400 op/s</td>
    <td align="right">16.74x slower</td>
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
    <td align="right"><strong>19,366 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">10,296 op/s</td>
    <td align="right">1.88x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">3,945 op/s</td>
    <td align="right">4.91x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">1,450 op/s</td>
    <td align="right">13.36x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">1,277 op/s</td>
    <td align="right">15.16x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">723 op/s</td>
    <td align="right">26.80x slower</td>
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
    <td align="right"><strong>21,122 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">16,631 op/s</td>
    <td align="right">1.27x slower</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">15,037 op/s</td>
    <td align="right">1.40x slower</td>
  </tr>
  <tr>
    <td><strong>Eksml (XmlParseStream)</strong></td>
    <td align="right">10,840 op/s</td>
    <td align="right">1.95x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">8,653 op/s</td>
    <td align="right">2.44x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">8,337 op/s</td>
    <td align="right">2.53x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">4,568 op/s</td>
    <td align="right">4.62x slower</td>
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
    <td align="right"><strong>91,554 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">67,124 op/s</td>
    <td align="right">1.36x slower</td>
  </tr>
  <tr>
    <td><strong>Eksml (XmlParseStream)</strong></td>
    <td align="right">33,971 op/s</td>
    <td align="right">2.70x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">29,824 op/s</td>
    <td align="right">3.07x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">29,578 op/s</td>
    <td align="right">3.10x slower</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">22,979 op/s</td>
    <td align="right">3.98x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">14,185 op/s</td>
    <td align="right">6.45x slower</td>
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
    <td align="right"><strong>17,768 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">15,336 op/s</td>
    <td align="right">1.16x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">14,474 op/s</td>
    <td align="right">1.23x slower</td>
  </tr>
  <tr>
    <td><strong>Eksml (XmlParseStream)</strong></td>
    <td align="right">10,759 op/s</td>
    <td align="right">1.65x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">7,155 op/s</td>
    <td align="right">2.48x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">6,608 op/s</td>
    <td align="right">2.69x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,868 op/s</td>
    <td align="right">4.59x slower</td>
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
    <td align="right"><strong>13,520 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">12,466 op/s</td>
    <td align="right">1.08x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">11,027 op/s</td>
    <td align="right">1.23x slower</td>
  </tr>
  <tr>
    <td><strong>Eksml (XmlParseStream)</strong></td>
    <td align="right">9,125 op/s</td>
    <td align="right">1.48x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">5,911 op/s</td>
    <td align="right">2.29x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">5,668 op/s</td>
    <td align="right">2.39x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,036 op/s</td>
    <td align="right">4.45x slower</td>
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
    <td align="right"><strong>15,387 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td><strong>Eksml (SAX)</strong></td>
    <td align="right">14,770 op/s</td>
    <td align="right">1.04x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">11,140 op/s</td>
    <td align="right">1.38x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">6,256 op/s</td>
    <td align="right">2.46x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">6,237 op/s</td>
    <td align="right">2.47x slower</td>
  </tr>
  <tr>
    <td><strong>Eksml (XmlParseStream)</strong></td>
    <td align="right">5,244 op/s</td>
    <td align="right">2.93x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,797 op/s</td>
    <td align="right">4.05x slower</td>
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
    <td align="right"><strong>12,942 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">11,374 op/s</td>
    <td align="right">1.14x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">10,659 op/s</td>
    <td align="right">1.21x slower</td>
  </tr>
  <tr>
    <td><strong>Eksml (XmlParseStream)</strong></td>
    <td align="right">8,559 op/s</td>
    <td align="right">1.51x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">6,429 op/s</td>
    <td align="right">2.01x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">5,572 op/s</td>
    <td align="right">2.32x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,146 op/s</td>
    <td align="right">4.11x slower</td>
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
    <td align="right"><strong>26,729 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">18,107 op/s</td>
    <td align="right">1.48x slower</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">15,681 op/s</td>
    <td align="right">1.70x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">11,245 op/s</td>
    <td align="right">2.38x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">9,282 op/s</td>
    <td align="right">2.88x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">4,668 op/s</td>
    <td align="right">5.73x slower</td>
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
    <td align="right"><strong>108,772 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">72,583 op/s</td>
    <td align="right">1.50x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">34,658 op/s</td>
    <td align="right">3.14x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">30,335 op/s</td>
    <td align="right">3.59x slower</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">21,781 op/s</td>
    <td align="right">4.99x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">15,280 op/s</td>
    <td align="right">7.12x slower</td>
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
    <td align="right"><strong>21,111 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">16,254 op/s</td>
    <td align="right">1.30x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">15,723 op/s</td>
    <td align="right">1.34x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">9,391 op/s</td>
    <td align="right">2.25x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">7,498 op/s</td>
    <td align="right">2.82x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,765 op/s</td>
    <td align="right">5.61x slower</td>
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
    <td align="right"><strong>19,368 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">14,365 op/s</td>
    <td align="right">1.35x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">11,967 op/s</td>
    <td align="right">1.62x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">7,842 op/s</td>
    <td align="right">2.47x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">6,267 op/s</td>
    <td align="right">3.09x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,059 op/s</td>
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
    <td align="right"><strong>17,818 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">15,297 op/s</td>
    <td align="right">1.16x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">11,990 op/s</td>
    <td align="right">1.49x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">8,429 op/s</td>
    <td align="right">2.11x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">7,091 op/s</td>
    <td align="right">2.51x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,873 op/s</td>
    <td align="right">4.60x slower</td>
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
    <td align="right"><strong>17,215 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">12,186 op/s</td>
    <td align="right">1.41x slower</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">11,887 op/s</td>
    <td align="right">1.45x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">8,357 op/s</td>
    <td align="right">2.06x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">6,815 op/s</td>
    <td align="right">2.53x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">3,251 op/s</td>
    <td align="right">5.30x slower</td>
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
    <td align="right"><strong>32.2 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td>easysax</td>
    <td align="right">20.2 op/s</td>
    <td align="right">1.59x slower</td>
  </tr>
  <tr>
    <td>saxes</td>
    <td align="right">11.6 op/s</td>
    <td align="right">2.77x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">10.1 op/s</td>
    <td align="right">3.18x slower</td>
  </tr>
  <tr>
    <td>@tuananh/sax-parser</td>
    <td align="right">9.0 op/s</td>
    <td align="right">3.56x slower</td>
  </tr>
  <tr>
    <td>sax</td>
    <td align="right">5.4 op/s</td>
    <td align="right">6.00x slower</td>
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
    <td align="right"><strong>221,461 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">191,821 op/s</td>
    <td align="right">1.15x slower</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">160,362 op/s</td>
    <td align="right">1.38x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">69,271 op/s</td>
    <td align="right">3.20x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">35,871 op/s</td>
    <td align="right">6.17x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">18,761 op/s</td>
    <td align="right">11.80x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">14,829 op/s</td>
    <td align="right">14.93x slower</td>
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
    <td align="right"><strong>2,854,612 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">2,520,999 op/s</td>
    <td align="right">1.13x slower</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">2,464,014 op/s</td>
    <td align="right">1.16x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">2,080,986 op/s</td>
    <td align="right">1.37x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">1,147,270 op/s</td>
    <td align="right">2.49x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">380,590 op/s</td>
    <td align="right">7.50x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">247,316 op/s</td>
    <td align="right">11.54x slower</td>
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
    <td align="right"><strong>397,794 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">335,840 op/s</td>
    <td align="right">1.18x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">102,950 op/s</td>
    <td align="right">3.86x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">46,699 op/s</td>
    <td align="right">8.52x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">23,139 op/s</td>
    <td align="right">17.19x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">16,204 op/s</td>
    <td align="right">24.55x slower</td>
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
    <td align="right"><strong>269,207 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">236,969 op/s</td>
    <td align="right">1.14x slower</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">232,661 op/s</td>
    <td align="right">1.16x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">73,950 op/s</td>
    <td align="right">3.64x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">38,777 op/s</td>
    <td align="right">6.94x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">29,285 op/s</td>
    <td align="right">9.19x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">18,159 op/s</td>
    <td align="right">14.82x slower</td>
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
    <td align="right"><strong>115,850 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">99,427 op/s</td>
    <td align="right">1.17x slower</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">88,035 op/s</td>
    <td align="right">1.32x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">28,747 op/s</td>
    <td align="right">4.03x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">14,373 op/s</td>
    <td align="right">8.06x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">11,743 op/s</td>
    <td align="right">9.87x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">8,297 op/s</td>
    <td align="right">13.96x slower</td>
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
    <td align="right"><strong>66,135 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">56,458 op/s</td>
    <td align="right">1.17x slower</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">48,204 op/s</td>
    <td align="right">1.37x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">14,777 op/s</td>
    <td align="right">4.48x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">7,186 op/s</td>
    <td align="right">9.20x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">4,641 op/s</td>
    <td align="right">14.25x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">4,124 op/s</td>
    <td align="right">16.04x slower</td>
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
    <td align="right"><strong>50,369 op/s</strong></td>
    <td align="right">—</td>
  </tr>
  <tr>
    <td><strong>Eksml</strong></td>
    <td align="right">44,234 op/s</td>
    <td align="right">1.14x slower</td>
  </tr>
  <tr>
    <td>tXml</td>
    <td align="right">43,591 op/s</td>
    <td align="right">1.16x slower</td>
  </tr>
  <tr>
    <td>htmlparser2</td>
    <td align="right">16,417 op/s</td>
    <td align="right">3.07x slower</td>
  </tr>
  <tr>
    <td>@xmldom/xmldom</td>
    <td align="right">9,928 op/s</td>
    <td align="right">5.07x slower</td>
  </tr>
  <tr>
    <td>xml2js</td>
    <td align="right">4,269 op/s</td>
    <td align="right">11.80x slower</td>
  </tr>
  <tr>
    <td>fast-xml-parser</td>
    <td align="right">3,102 op/s</td>
    <td align="right">16.24x slower</td>
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
- **Environment**: Single-threaded, synchronous execution on Node.js 24, macOS 14 — MacBook Pro (2021), Apple M1 Max, 64 GB RAM
- **Parser reuse**: In the SAX streaming and tokenization suites, every parser is constructed once and reused across iterations (all measured parsers support this; verified by comparing event streams across runs). This measures steady-state parse throughput rather than constructor cost. XmlParseStream is the exception, web streams are single-use, so it pays its constructor per iteration.
- **Public APIs**: Every library is measured through its public API. Eksml's SAX rows use `createSaxParser` (the `@eksml/xml/sax` export), not the internal engine.
- **Comparison libraries**: tXml, htmlparser2, fast-xml-parser, xml2js, @xmldom/xmldom, sax, saxes, easysax, @tuananh/sax-parser
- **Source**: [`bench/`](./bench/) directory — `parse.bench.ts`, `stream.bench.ts`, `tokenize.bench.ts`, `large.bench.ts`, `writer.bench.ts`, `convert.bench.ts`, `attr-penalty.bench.ts`
