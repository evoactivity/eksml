import { init } from 'modern-monaco';
import { transformStream } from '#src/transformStream.ts';
import type { TransformStreamOptions } from '#src/transformStream.ts';
import type { TNode } from '#src/parser.ts';

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const inputEditorContainer = document.getElementById('input-editor')!;
const logEl = document.getElementById('log') as HTMLDivElement;
const statsEl = document.getElementById('stats') as HTMLSpanElement;
const progressEl = document.getElementById('progress') as HTMLDivElement;
const throttleEl = document.getElementById('throttle') as HTMLSelectElement;
const chunkSizeEl = document.getElementById('chunk-size') as HTMLInputElement;
const selectTagsEl = document.getElementById('select-tags') as HTMLInputElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;

// ---------------------------------------------------------------------------
// Default XML sample
// ---------------------------------------------------------------------------

const DEFAULT_XML = `\
<?xml version="1.0" encoding="UTF-8"?>
<library>
  <section name="Fiction">
    <book isbn="978-0-13-468599-1">
      <title>The Pragmatic Programmer</title>
      <authors>
        <author>David Thomas</author>
        <author>Andrew Hunt</author>
      </authors>
      <year>2019</year>
    </book>
    <book isbn="978-0-596-51774-8">
      <title>JavaScript: The Good Parts</title>
      <authors>
        <author>Douglas Crockford</author>
      </authors>
      <year>2008</year>
    </book>
  </section>
  <section name="Science">
    <book isbn="978-0-553-38016-2">
      <title>A Brief History of Time</title>
      <authors>
        <author>Stephen Hawking</author>
      </authors>
      <year>1988</year>
      <notes><![CDATA[Classic physics & cosmology text]]></notes>
    </book>
  </section>
  <!-- More sections to come -->
</library>`;

// ---------------------------------------------------------------------------
// Monaco editor setup
// ---------------------------------------------------------------------------

const EDITOR_THEME = 'vitesse-dark';

const monaco = await init();

const inputEditor = monaco.editor.create(inputEditorContainer, {
  automaticLayout: true,
  fontSize: 13,
  lineHeight: 1.5,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  padding: { top: 10 },
  theme: EDITOR_THEME,
  tabSize: 2,
});

const inputModel = monaco.editor.createModel(DEFAULT_XML, 'xml');
inputEditor.setModel(inputModel);

// Trigger JSON grammar loading so monaco.editor.colorize("...", "json") works.
// modern-monaco loads grammars lazily via onLanguage; creating a model forces the load.
const jsonWarmupModel = monaco.editor.createModel('{}', 'json');
await monaco.editor.colorize('{}', 'json', { tabSize: 2 });
jsonWarmupModel.dispose();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let abortController: AbortController | null = null;

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatNode(node: TNode): string {
  let html = `<span class="node-tag">&lt;${escapeHtml(node.tagName)}&gt;</span>`;

  if (node.attributes) {
    const keys = Object.keys(node.attributes);
    if (keys.length > 0) {
      const parts = keys.map((k) => {
        const v = node.attributes![k];
        if (v === null)
          return `<span class="node-attr-key">${escapeHtml(k)}</span>`;
        return `<span class="node-attr-key">${escapeHtml(k)}</span>=<span class="node-attr-val">"${escapeHtml(v)}"</span>`;
      });
      html += ` { ${parts.join(', ')} }`;
    }
  }

  const childCount = node.children ? node.children.length : 0;
  html += ` <span class="node-children">${childCount} children</span>`;

  return html;
}

function appendNode(node: TNode | string): void {
  const isText = typeof node === 'string';
  const entry = document.createElement('div');
  entry.className = `log-entry collapsible ${isText ? 'node-text' : 'node-element'}`;

  const summary = isText
    ? `<span class="node-text-val">text</span> "${escapeHtml(node.length > 80 ? node.slice(0, 80) + '...' : node)}"`
    : formatNode(node);

  const jsonRaw = JSON.stringify(node, null, 2);

  entry.innerHTML =
    `<div class="node-summary">${summary} <span class="expand-hint">click to expand</span></div>` +
    `<div class="json-body">${escapeHtml(jsonRaw)}</div>`;

  const jsonBody = entry.querySelector('.json-body') as HTMLDivElement;

  // Colorize the JSON asynchronously using Monaco's built-in tokenizer
  monaco.editor
    .colorize(jsonRaw, 'json', { tabSize: 2 })
    .then((colorizedHtml) => {
      jsonBody.innerHTML = colorizedHtml;
    });

  entry.addEventListener('click', () => {
    entry.classList.toggle('expanded');
  });

  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function appendChunkMarker(index: number, content: string): void {
  const entry = document.createElement('div');
  entry.className = 'log-entry chunk-marker';
  entry.textContent = `--- chunk ${index} (${content.length} bytes) ---`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function appendDone(nodeCount: number, elapsed: number): void {
  const entry = document.createElement('div');
  entry.className = 'log-entry node-done';
  entry.innerHTML = `<span class="node-tag" style="color:#6366f1">done</span> ${nodeCount} nodes in ${elapsed.toFixed(1)} ms`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Stream run
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  const xml = inputModel.getValue();
  const delay = parseInt(throttleEl.value, 10);
  const chunkSize = Math.max(1, parseInt(chunkSizeEl.value, 10) || 64);

  // Parse the select input: comma-separated tag names, trimmed, empty strings removed
  const selectRaw = selectTagsEl.value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const options: TransformStreamOptions = {};
  if (selectRaw.length > 0) {
    options.select = selectRaw;
  }

  // Reset
  logEl.innerHTML = '';
  statsEl.textContent = '';
  progressEl.style.width = '0%';

  abortController = new AbortController();
  const signal = abortController.signal;

  startBtn.disabled = true;
  stopBtn.disabled = false;

  // Split XML into chunks
  const chunks: string[] = [];
  for (let i = 0; i < xml.length; i += chunkSize) {
    chunks.push(xml.slice(i, i + chunkSize));
  }

  const totalChunks = chunks.length;
  const startTime = performance.now();
  let nodeCount = 0;

  // Create the transform stream
  const stream = transformStream(undefined, options);
  const streamWriter = stream.writable.getWriter();
  const reader = stream.readable.getReader();

  // Read nodes in background
  const readPromise = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      nodeCount++;
      appendNode(value);
      statsEl.textContent = `${nodeCount} nodes`;
    }
  })();

  // Write chunks with throttle
  for (let i = 0; i < totalChunks; i++) {
    if (signal.aborted) break;

    appendChunkMarker(i + 1, chunks[i]!);
    await streamWriter.write(chunks[i]!);

    const pct = ((i + 1) / totalChunks) * 100;
    progressEl.style.width = pct + '%';

    if (delay > 0 && i < totalChunks - 1) {
      await sleep(delay);
    }
  }

  if (!signal.aborted) {
    await streamWriter.close();
    await readPromise;

    const elapsed = performance.now() - startTime;
    appendDone(nodeCount, elapsed);
    progressEl.style.width = '100%';
    statsEl.textContent = `${nodeCount} nodes | ${elapsed.toFixed(1)} ms`;
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
  abortController = null;
}

function stop(): void {
  if (abortController) {
    abortController.abort();
    const entry = document.createElement('div');
    entry.className = 'log-entry node-done';
    entry.innerHTML = `<span class="node-tag" style="color:#dc2626">stopped</span> aborted by user`;
    logEl.appendChild(entry);
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

startBtn.addEventListener('click', run);
stopBtn.addEventListener('click', stop);

inputEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
  run();
});
