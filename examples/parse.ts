import { init } from 'modern-monaco';
import { parse } from '#src/parser.ts';
import { lossy } from '#src/converters/lossy.ts';
import { lossless } from '#src/converters/lossless.ts';

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const inputEditorContainer = document.getElementById('input-editor')!;
const outputEditorContainer = document.getElementById('output-editor')!;
const errorOverlay = document.getElementById('error-overlay') as HTMLDivElement;
const timingEl = document.getElementById('timing') as HTMLSpanElement;
const modeEl = document.getElementById('mode') as HTMLSelectElement;
const entitiesEl = document.getElementById('entities') as HTMLInputElement;
const htmlEl = document.getElementById('html') as HTMLInputElement;
const benchEl = document.getElementById('bench') as HTMLInputElement;
const parseBtn = document.getElementById('parse-btn') as HTMLButtonElement;
const tabsEl = document.getElementById('tabs') as HTMLDivElement;

// ---------------------------------------------------------------------------
// Sample documents
// ---------------------------------------------------------------------------

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
    <item>
      <title>Lessons from Our Kafka Migration</title>
      <link>https://engineering.example.com/kafka</link>
      <dc:creator>Priya Patel</dc:creator>
      <pubDate>Thu, 20 Mar 2026 14:00:00 +0000</pubDate>
      <description>Moving 2 billion events/day from RabbitMQ to Kafka.</description>
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
  <!-- Grid lines -->
  <line x1="80" y1="60" x2="80" y2="340" stroke="#334155" stroke-width="1"/>
  <line x1="80" y1="340" x2="560" y2="340" stroke="#334155" stroke-width="1"/>
  <!-- Bars -->
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
  {
    label: 'Config (pom.xml)',
    content: `\
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>order-service</artifactId>
  <version>2.4.1-SNAPSHOT</version>
  <packaging>jar</packaging>
  <name>Order Service</name>
  <description>Handles order lifecycle, payment integration, and fulfilment orchestration.</description>

  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.4.2</version>
    <relativePath/>
  </parent>

  <properties>
    <java.version>21</java.version>
    <spring-cloud.version>2024.0.1</spring-cloud.version>
    <grpc.version>1.70.0</grpc.version>
    <protobuf.version>4.29.3</protobuf.version>
    <jacoco.version>0.8.12</jacoco.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.cloud</groupId>
      <artifactId>spring-cloud-starter-openfeign</artifactId>
    </dependency>
    <dependency>
      <groupId>io.grpc</groupId>
      <artifactId>grpc-netty-shaded</artifactId>
      <version>\${grpc.version}</version>
    </dependency>
    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-core</artifactId>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
      <plugin>
        <groupId>org.jacoco</groupId>
        <artifactId>jacoco-maven-plugin</artifactId>
        <version>\${jacoco.version}</version>
        <executions>
          <execution>
            <goals><goal>prepare-agent</goal></goals>
          </execution>
          <execution>
            <id>report</id>
            <phase>verify</phase>
            <goals><goal>report</goal></goals>
          </execution>
        </executions>
      </plugin>
    </plugins>
  </build>
</project>`,
  },
];

// ---------------------------------------------------------------------------
// Generate the "very large" sample (~1 MB product catalog)
// ---------------------------------------------------------------------------

function generateLargeCatalog(): string {
  const categories = [
    'Electronics',
    'Books',
    'Clothing',
    'Home & Garden',
    'Sports',
    'Toys',
    'Automotive',
    'Health',
  ];
  const adjectives = [
    'Premium',
    'Ultra',
    'Pro',
    'Essential',
    'Classic',
    'Advanced',
    'Compact',
    'Deluxe',
    'Eco',
    'Smart',
  ];
  const nouns = [
    'Widget',
    'Gadget',
    'Device',
    'Tool',
    'Kit',
    'Module',
    'Sensor',
    'Adapter',
    'Controller',
    'Monitor',
  ];

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<catalog xmlns="http://example.com/catalog/v1" generated="2026-04-03T12:00:00Z">',
  );

  // ~5,000 products produces roughly 1 MB
  const productCount = 5000;
  for (let i = 1; i <= productCount; i++) {
    const adj = adjectives[i % adjectives.length]!;
    const noun = nouns[Math.floor(i / adjectives.length) % nouns.length]!;
    const cat = categories[i % categories.length]!;
    const price = (5 + ((i * 7.31) % 993)).toFixed(2);
    const stock = (i * 13) % 500;
    const rating = (1 + (i % 50) / 10).toFixed(1);
    const sku = `SKU-${String(i).padStart(6, '0')}`;

    lines.push(`  <product id="${i}" sku="${sku}">`);
    lines.push(`    <name>${adj} ${noun} ${i}</name>`);
    lines.push(`    <category>${cat}</category>`);
    lines.push(`    <price currency="USD">${price}</price>`);
    lines.push(`    <stock>${stock}</stock>`);
    lines.push(`    <rating>${rating}</rating>`);
    lines.push(
      `    <description>The ${adj.toLowerCase()} ${noun.toLowerCase()} is perfect for ${cat.toLowerCase()} enthusiasts. Model #${i}.</description>`,
    );
    lines.push('  </product>');
  }

  lines.push('</catalog>');
  return lines.join('\n');
}

// Add the large sample (generated once, lazily)
let largeCatalog: string | null = null;
function getLargeCatalog(): string {
  if (largeCatalog === null) largeCatalog = generateLargeCatalog();
  return largeCatalog;
}

// ---------------------------------------------------------------------------
// Format file size for display
// ---------------------------------------------------------------------------

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Monaco editor setup
// ---------------------------------------------------------------------------

const EDITOR_THEME = 'vitesse-dark';

const monaco = await init();

type MonacoEditor = ReturnType<typeof monaco.editor.create>;

const inputEditor: MonacoEditor = monaco.editor.create(inputEditorContainer, {
  automaticLayout: true,
  fontSize: 13,
  lineHeight: 1.5,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  padding: { top: 10 },
  theme: EDITOR_THEME,
  tabSize: 2,
});

const inputModel = monaco.editor.createModel('', 'xml');
inputEditor.setModel(inputModel);

const outputEditor: MonacoEditor = monaco.editor.create(outputEditorContainer, {
  automaticLayout: true,
  fontSize: 13,
  lineHeight: 1.5,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  padding: { top: 10 },
  theme: EDITOR_THEME,
  readOnly: true,
  tabSize: 2,
});

const outputModel = monaco.editor.createModel('', 'json');
outputEditor.setModel(outputModel);

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

let activeTab = 0;

function getContent(index: number): string {
  if (index < SAMPLES.length) return SAMPLES[index]!.content;
  return getLargeCatalog();
}

function getLabel(index: number): string {
  if (index < SAMPLES.length) return SAMPLES[index]!.label;
  return 'Catalog (5K)';
}

function getTabCount(): number {
  return SAMPLES.length + 1; // +1 for the generated large sample
}

function renderTabs(): void {
  tabsEl.innerHTML = '';
  const count = getTabCount();
  for (let i = 0; i < count; i++) {
    const btn = document.createElement('button');
    btn.className = 'tab' + (i === activeTab ? ' active' : '');
    const content = getContent(i);
    btn.innerHTML = `${getLabel(i)}<span class="size">${formatSize(content.length)}</span>`;
    btn.addEventListener('click', () => switchTab(i));
    tabsEl.appendChild(btn);
  }
}

function switchTab(index: number): void {
  activeTab = index;
  inputModel.setValue(getContent(index));
  renderTabs();
  run();
}

// ---------------------------------------------------------------------------
// Parser dispatch
// ---------------------------------------------------------------------------

type ParseFn = (xml: string, options: Record<string, boolean>) => unknown;

function selectParser(mode: string): ParseFn {
  if (mode === 'dom') return parse;
  if (mode === 'lossy') return lossy as ParseFn;
  return lossless as ParseFn;
}

function formatDuration(microseconds: number): string {
  if (microseconds < 1000) return `${microseconds.toFixed(1)} us`;
  if (microseconds < 1_000_000) return `${(microseconds / 1000).toFixed(3)} ms`;
  return `${(microseconds / 1_000_000).toFixed(3)} s`;
}

/** Yield to the browser so it can paint. */
function yieldFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
}

const BENCH_TARGET_MS = 200;
const BENCH_MIN_ITERATIONS = 10;
const BENCH_MAX_ITERATIONS = 200_000;

async function run(): Promise<void> {
  const xml = inputModel.getValue();
  const mode = modeEl.value;
  const bench = benchEl.checked;
  const options: Record<string, boolean> = {};
  if (entitiesEl.checked) options.entities = true;
  if (htmlEl.checked) options.html = true;

  errorOverlay.hidden = true;

  try {
    const fn = selectParser(mode);

    // Single run -- always needed for the output
    const t0 = performance.now();
    const result = fn(xml, options);
    const singleMs = performance.now() - t0;

    outputModel.setValue(JSON.stringify(result, null, 2));

    if (bench) {
      // Show spinner, disable button, yield so the browser paints
      timingEl.textContent = 'benching...';
      timingEl.classList.add('benching');
      parseBtn.disabled = true;
      await yieldFrame();

      // Calibrate iteration count from the single-run time
      const iterations = Math.max(
        BENCH_MIN_ITERATIONS,
        Math.min(
          BENCH_MAX_ITERATIONS,
          Math.ceil(BENCH_TARGET_MS / Math.max(singleMs, 0.001)),
        ),
      );

      const batchStart = performance.now();
      for (let i = 0; i < iterations; i++) fn(xml, options);
      const batchMs = performance.now() - batchStart;

      const avgMicro = (batchMs / iterations) * 1000;
      timingEl.textContent = `${formatDuration(avgMicro)} (avg of ${iterations.toLocaleString()})`;
      timingEl.classList.remove('benching');
      parseBtn.disabled = false;
    } else {
      const micro = singleMs * 1000;
      timingEl.textContent = micro < 1000 ? '< 1 ms' : formatDuration(micro);
    }
  } catch (err: unknown) {
    errorOverlay.hidden = false;
    errorOverlay.textContent = (err as Error).message;
    timingEl.textContent = '';
    timingEl.classList.remove('benching');
    parseBtn.disabled = false;
  }
}

parseBtn.addEventListener('click', run);
inputEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
  run();
});

// Initialize: render tabs, load first sample, parse on load
renderTabs();
inputModel.setValue(getContent(0));
run();
