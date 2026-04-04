import Route from '@ember/routing/route';

interface Sample {
  label: string;
  content: string;
}

const SAMPLES: Sample[] = [
  {
    label: 'Bookstore',
    content: `\
<?xml version="1.0" encoding="UTF-8"?>
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
  <book category="fiction">
    <title lang="es">Cien a\xF1os de soledad</title>
    <author>Gabriel Garc\xEDa M\xE1rquez</author>
    <year>1967</year>
    <price>12.50</price>
  </book>
</bookstore>`,
  },
  {
    label: 'SOAP Envelope',
    content: `\
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
               xmlns:ord="http://example.com/orders/v2">
  <soap:Header>
    <wsse:Security soap:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>api-client-42</wsse:Username>
        <wsse:Nonce>dGhlIG5vbmNlIHZhbHVl</wsse:Nonce>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    <ord:GetOrderDetailsRequest>
      <ord:OrderId>ORD-2026-78432</ord:OrderId>
      <ord:IncludeLineItems>true</ord:IncludeLineItems>
      <ord:Format>full</ord:Format>
    </ord:GetOrderDetailsRequest>
  </soap:Body>
</soap:Envelope>`,
  },
  {
    label: 'RSS Feed',
    content: `\
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Engineering Blog</title>
    <link>https://engineering.example.com</link>
    <description>Posts from the engineering team</description>
    <item>
      <title>Migrating to HTTP/3</title>
      <link>https://engineering.example.com/http3</link>
      <dc:creator>Jane Kim</dc:creator>
      <pubDate>Sat, 29 Mar 2026 10:00:00 +0000</pubDate>
      <description>How we rolled out QUIC across our edge fleet.</description>
      <content:encoded><![CDATA[
        <p>After months of testing, our edge fleet now serves <strong>100%</strong>
        of traffic over HTTP/3. Here's what we learned along the way.</p>
        <ul>
          <li>Connection migration reduced mobile errors by 34%</li>
          <li>0-RTT resumption cut TTFB by 40 ms at p50</li>
          <li>UDP-based transport required firewall rule changes in 12 regions</li>
        </ul>
      ]]></content:encoded>
    </item>
    <item>
      <title>Building a Real-Time Feature Store</title>
      <link>https://engineering.example.com/feature-store</link>
      <dc:creator>Alex Chen</dc:creator>
      <pubDate>Mon, 24 Mar 2026 09:30:00 +0000</pubDate>
      <description>Low-latency feature serving for ML inference at scale.</description>
    </item>
  </channel>
</rss>`,
  },
  {
    label: 'SVG Chart',
    content: `\
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="bar-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <rect width="600" height="400" fill="url(#bg)" rx="8"/>
  <text x="300" y="35" text-anchor="middle" fill="#e2e8f0" font-size="16" font-weight="600">Monthly Revenue (thousands)</text>
  <line x1="80" y1="60" x2="80" y2="340" stroke="#334155" stroke-width="1"/>
  <line x1="80" y1="340" x2="560" y2="340" stroke="#334155" stroke-width="1"/>
  <g>
    <rect x="100" y="180" width="30" height="160" fill="url(#bar-fill)" rx="3"/>
    <text x="115" y="360" text-anchor="middle" fill="#94a3b8" font-size="10">Jan</text>
    <rect x="150" y="140" width="30" height="200" fill="url(#bar-fill)" rx="3"/>
    <text x="165" y="360" text-anchor="middle" fill="#94a3b8" font-size="10">Feb</text>
    <rect x="200" y="100" width="30" height="240" fill="url(#bar-fill)" rx="3"/>
    <text x="215" y="360" text-anchor="middle" fill="#94a3b8" font-size="10">Mar</text>
    <rect x="250" y="120" width="30" height="220" fill="url(#bar-fill)" rx="3"/>
    <text x="265" y="360" text-anchor="middle" fill="#94a3b8" font-size="10">Apr</text>
    <rect x="300" y="80" width="30" height="260" fill="url(#bar-fill)" rx="3"/>
    <text x="315" y="360" text-anchor="middle" fill="#94a3b8" font-size="10">May</text>
    <rect x="350" y="60" width="30" height="280" fill="url(#bar-fill)" rx="3"/>
    <text x="365" y="360" text-anchor="middle" fill="#94a3b8" font-size="10">Jun</text>
  </g>
</svg>`,
  },
];

/** Parser definitions exposed to the UI */
export interface ParserDef {
  id: string;
  label: string;
  color: string;
}

export const PARSER_DEFS: ParserDef[] = [
  { id: 'eksml', label: 'eksml', color: '#3b82f6' },
  { id: 'fast-xml-parser', label: 'fast-xml-parser', color: '#f97316' },
  { id: 'txml', label: 'txml', color: '#a855f7' },
  { id: '@rgrove/parse-xml', label: '@rgrove/parse-xml', color: '#14b8a6' },
  { id: 'htmlparser2', label: 'htmlparser2', color: '#ef4444' },
  { id: 'xml2js', label: 'xml2js', color: '#eab308' },
];

export const STREAM_PARSER_DEFS: ParserDef[] = [
  { id: 'eksml-stream', label: 'eksml fastStream', color: '#3b82f6' },
  { id: 'htmlparser2-sax', label: 'htmlparser2 (SAX)', color: '#ef4444' },
  { id: 'sax', label: 'sax', color: '#22c55e' },
  { id: 'saxes', label: 'saxes', color: '#ec4899' },
];

export interface SuiteDef {
  id: string;
  label: string;
  description: string;
  parsers: ParserDef[];
}

export const SUITES: SuiteDef[] = [
  {
    id: 'parse',
    label: 'Parse (DOM)',
    description:
      'Synchronous XML-to-tree parsing — each library produces a full document tree.',
    parsers: PARSER_DEFS,
  },
  {
    id: 'stream',
    label: 'Stream (SAX)',
    description:
      'SAX-style event parsing — each library tokenises XML and fires callbacks for every event.',
    parsers: STREAM_PARSER_DEFS,
  },
];

export interface BenchmarkModel {
  samples: Sample[];
  suites: SuiteDef[];
}

export default class BenchmarkRoute extends Route {
  model(): BenchmarkModel {
    return {
      samples: SAMPLES,
      suites: SUITES,
    };
  }
}
