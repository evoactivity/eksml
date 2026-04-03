import { init } from "modern-monaco";
import { writer } from "#src/writer.ts";
import type { WriterOptions } from "#src/writer.ts";
import { fromLossy } from "#src/converters/fromLossy.ts";
import { fromLossless } from "#src/converters/fromLossless.ts";
import type { TNode } from "#src/parser.ts";
import type { LossyValue } from "#src/converters/lossy.ts";
import type { LosslessEntry } from "#src/converters/lossless.ts";

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const inputEditorContainer = document.getElementById("input-editor")!;
const outputEditorContainer = document.getElementById("output-editor")!;
const errorOverlay = document.getElementById("error-overlay") as HTMLDivElement;
const timingEl = document.getElementById("timing") as HTMLSpanElement;
const formatEl = document.getElementById("format") as HTMLSelectElement;
const prettyEl = document.getElementById("pretty") as HTMLInputElement;
const entitiesEl = document.getElementById("entities") as HTMLInputElement;
const htmlEl = document.getElementById("html") as HTMLInputElement;
const writeBtn = document.getElementById("write-btn") as HTMLButtonElement;
const tabsEl = document.getElementById("tabs") as HTMLDivElement;

// ---------------------------------------------------------------------------
// Sample data per format
// ---------------------------------------------------------------------------

interface Sample {
  label: string;
  format: "dom" | "lossy" | "lossless";
  content: string;
}

const DOM_SAMPLES: Sample[] = [
  {
    label: "Bookstore",
    format: "dom",
    content: JSON.stringify(
      [
        {
          tagName: "?xml",
          attributes: { version: "1.0", encoding: "UTF-8" },
          children: [],
        },
        {
          tagName: "bookstore",
          attributes: null,
          children: [
            {
              tagName: "book",
              attributes: { category: "fiction" },
              children: [
                {
                  tagName: "title",
                  attributes: { lang: "en" },
                  children: ["The Great Gatsby"],
                },
                {
                  tagName: "author",
                  attributes: null,
                  children: ["F. Scott Fitzgerald"],
                },
                { tagName: "year", attributes: null, children: ["1925"] },
                { tagName: "price", attributes: null, children: ["10.99"] },
              ],
            },
            {
              tagName: "book",
              attributes: { category: "non-fiction" },
              children: [
                {
                  tagName: "title",
                  attributes: { lang: "en" },
                  children: ["Sapiens"],
                },
                {
                  tagName: "author",
                  attributes: null,
                  children: ["Yuval Noah Harari"],
                },
                { tagName: "year", attributes: null, children: ["2011"] },
                { tagName: "price", attributes: null, children: ["14.99"] },
              ],
            },
          ],
        },
      ],
      null,
      2,
    ),
  },
  {
    label: "HTML Fragment",
    format: "dom",
    content: JSON.stringify(
      [
        { tagName: "!DOCTYPE", attributes: { html: null }, children: [] },
        {
          tagName: "html",
          attributes: { lang: "en" },
          children: [
            {
              tagName: "head",
              attributes: null,
              children: [
                {
                  tagName: "meta",
                  attributes: { charset: "UTF-8" },
                  children: [],
                },
                {
                  tagName: "title",
                  attributes: null,
                  children: ["Hello World"],
                },
              ],
            },
            {
              tagName: "body",
              attributes: null,
              children: [
                {
                  tagName: "h1",
                  attributes: null,
                  children: ["Hello World"],
                },
                {
                  tagName: "p",
                  attributes: null,
                  children: [
                    "This is a ",
                    {
                      tagName: "strong",
                      attributes: null,
                      children: ["simple"],
                    },
                    " page.",
                  ],
                },
                { tagName: "br", attributes: null, children: [] },
                {
                  tagName: "img",
                  attributes: { src: "photo.jpg", alt: "A photo" },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
      null,
      2,
    ),
  },
  {
    label: "Mixed Content",
    format: "dom",
    content: JSON.stringify(
      [
        {
          tagName: "article",
          attributes: { id: "intro" },
          children: [
            {
              tagName: "p",
              attributes: null,
              children: [
                "Welcome to ",
                {
                  tagName: "em",
                  attributes: null,
                  children: ["eksml"],
                },
                ", a ",
                {
                  tagName: "strong",
                  attributes: null,
                  children: ["high-performance"],
                },
                " XML parser.",
              ],
            },
            "<!-- This is a comment -->",
            {
              tagName: "ul",
              attributes: null,
              children: [
                {
                  tagName: "li",
                  attributes: null,
                  children: ["Fast parsing"],
                },
                {
                  tagName: "li",
                  attributes: null,
                  children: ["Streaming support"],
                },
                {
                  tagName: "li",
                  attributes: null,
                  children: ["Multiple output formats"],
                },
              ],
            },
          ],
        },
      ],
      null,
      2,
    ),
  },
];

const LOSSY_SAMPLES: Sample[] = [
  {
    label: "Catalog",
    format: "lossy",
    content: JSON.stringify(
      {
        catalog: {
          product: [
            {
              $id: "p1",
              $category: "electronics",
              name: "Wireless Mouse",
              price: "29.99",
              specs: {
                weight: "85g",
                battery: "AA",
              },
            },
            {
              $id: "p2",
              $category: "accessories",
              name: "USB-C Hub",
              price: "49.99",
              specs: {
                ports: "7",
                weight: "120g",
              },
            },
          ],
        },
      },
      null,
      2,
    ),
  },
  {
    label: "Mixed Content",
    format: "lossy",
    content: JSON.stringify(
      {
        div: {
          $class: "content",
          $$: [
            "Hello ",
            { strong: "world" },
            "! Visit ",
            { a: { $href: "https://example.com", $$: ["our site"] } },
            " for more.",
          ],
        },
      },
      null,
      2,
    ),
  },
  {
    label: "Config",
    format: "lossy",
    content: JSON.stringify(
      {
        config: {
          $version: "2.0",
          database: {
            host: "localhost",
            port: "5432",
            name: "myapp",
            pool: { $min: "2", $max: "10" },
          },
          cache: {
            $enabled: null,
            ttl: "3600",
            backend: "redis",
          },
          logging: {
            level: "info",
            format: "json",
          },
        },
      },
      null,
      2,
    ),
  },
];

const LOSSLESS_SAMPLES: Sample[] = [
  {
    label: "Order",
    format: "lossless",
    content: JSON.stringify(
      [
        {
          order: [
            { $attr: { id: "ORD-001", status: "shipped" } },
            {
              customer: [
                { $attr: { tier: "gold" } },
                { name: [{ $text: "Alice Johnson" }] },
                { email: [{ $text: "alice@example.com" }] },
              ],
            },
            {
              items: [
                {
                  item: [
                    { $attr: { sku: "SKU-100" } },
                    { name: [{ $text: "Widget Pro" }] },
                    { quantity: [{ $text: "3" }] },
                    { price: [{ $text: "29.99" }] },
                  ],
                },
                {
                  item: [
                    { $attr: { sku: "SKU-200" } },
                    { name: [{ $text: "Gadget Plus" }] },
                    { quantity: [{ $text: "1" }] },
                    { price: [{ $text: "79.99" }] },
                  ],
                },
              ],
            },
            { $comment: " Shipping info " },
            {
              shipping: [
                { method: [{ $text: "express" }] },
                { tracking: [{ $text: "1Z999AA10123456784" }] },
              ],
            },
          ],
        },
      ],
      null,
      2,
    ),
  },
  {
    label: "SOAP Message",
    format: "lossless",
    content: JSON.stringify(
      [
        {
          "soap:Envelope": [
            {
              $attr: {
                "xmlns:soap": "http://schemas.xmlsoap.org/soap/envelope/",
                "xmlns:ord": "http://example.com/orders",
              },
            },
            {
              "soap:Body": [
                {
                  "ord:GetOrder": [
                    { "ord:OrderId": [{ $text: "12345" }] },
                    { "ord:Format": [{ $text: "full" }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
      null,
      2,
    ),
  },
];

// ---------------------------------------------------------------------------
// Samples by format
// ---------------------------------------------------------------------------

function getSamples(format: string): Sample[] {
  if (format === "lossy") return LOSSY_SAMPLES;
  if (format === "lossless") return LOSSLESS_SAMPLES;
  return DOM_SAMPLES;
}

// ---------------------------------------------------------------------------
// Monaco editor setup
// ---------------------------------------------------------------------------

const EDITOR_THEME = "vitesse-dark";

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

const inputModel = monaco.editor.createModel("", "json");
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

const outputModel = monaco.editor.createModel("", "xml");
outputEditor.setModel(outputModel);

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

let activeTab = 0;

function renderTabs(): void {
  const samples = getSamples(formatEl.value);
  tabsEl.innerHTML = "";
  for (let i = 0; i < samples.length; i++) {
    const btn = document.createElement("button");
    btn.className = "tab" + (i === activeTab ? " active" : "");
    btn.textContent = samples[i]!.label;
    btn.addEventListener("click", () => switchTab(i));
    tabsEl.appendChild(btn);
  }
}

function switchTab(index: number): void {
  activeTab = index;
  const samples = getSamples(formatEl.value);
  if (index < samples.length) {
    inputModel.setValue(samples[index]!.content);
  }
  renderTabs();
  run();
}

// ---------------------------------------------------------------------------
// Conversion dispatch
// ---------------------------------------------------------------------------

function toDom(json: unknown, format: string): TNode | (TNode | string)[] {
  if (format === "lossy") {
    return fromLossy(json as LossyValue | LossyValue[]);
  }
  if (format === "lossless") {
    return fromLossless(json as LosslessEntry[]);
  }
  // DOM: already TNode | (TNode | string)[]
  return json as (TNode | string)[];
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function run(): void {
  const jsonText = inputModel.getValue();
  const format = formatEl.value;
  const options: WriterOptions = {};

  if (prettyEl.checked) options.pretty = true;
  if (entitiesEl.checked) options.entities = true;
  if (htmlEl.checked) options.html = true;

  errorOverlay.hidden = true;

  try {
    const parsed = JSON.parse(jsonText);
    const dom = toDom(parsed, format);

    const t0 = performance.now();
    const xml = writer(dom, options);
    const elapsed = performance.now() - t0;

    outputModel.setValue(xml);

    const micro = elapsed * 1000;
    timingEl.textContent = micro < 1000 ? "< 1 ms" : formatDuration(micro);
  } catch (err: unknown) {
    errorOverlay.hidden = false;
    errorOverlay.textContent = (err as Error).message;
    timingEl.textContent = "";
  }
}

function formatDuration(microseconds: number): string {
  if (microseconds < 1000) return `${microseconds.toFixed(1)} us`;
  if (microseconds < 1_000_000) return `${(microseconds / 1000).toFixed(3)} ms`;
  return `${(microseconds / 1_000_000).toFixed(3)} s`;
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

writeBtn.addEventListener("click", run);
inputEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
  run();
});

formatEl.addEventListener("change", () => {
  activeTab = 0;
  const samples = getSamples(formatEl.value);
  inputModel.setValue(samples[0]!.content);
  renderTabs();
  run();
});

// Initialize
renderTabs();
inputModel.setValue(getSamples(formatEl.value)[0]!.content);
run();
