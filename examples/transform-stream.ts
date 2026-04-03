import { transformStream } from "#src/transformStream.ts";
import type { TransformStreamOptions } from "#src/transformStream.ts";
import type { TNode } from "#src/parser.ts";

const inputEl = document.getElementById("input") as HTMLTextAreaElement;
const logEl = document.getElementById("log") as HTMLDivElement;
const statsEl = document.getElementById("stats") as HTMLSpanElement;
const progressEl = document.getElementById("progress") as HTMLDivElement;
const throttleEl = document.getElementById("throttle") as HTMLSelectElement;
const chunkSizeEl = document.getElementById("chunk-size") as HTMLInputElement;
const selectTagsEl = document.getElementById("select-tags") as HTMLInputElement;
const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
const stopBtn = document.getElementById("stop-btn") as HTMLButtonElement;

let abortController: AbortController | null = null;

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
      html += ` { ${parts.join(", ")} }`;
    }
  }

  const childCount = node.children ? node.children.length : 0;
  html += ` <span class="node-children">${childCount} children</span>`;

  return html;
}

function appendNode(node: TNode | string): void {
  const isText = typeof node === "string";
  const entry = document.createElement("div");
  entry.className = `log-entry collapsible ${isText ? "node-text" : "node-element"}`;

  const summary = isText
    ? `<span class="node-text-val">text</span> "${escapeHtml(node.length > 80 ? node.slice(0, 80) + "..." : node)}"`
    : formatNode(node);

  const jsonStr = escapeHtml(JSON.stringify(node, null, 2));

  entry.innerHTML =
    `<div class="node-summary">${summary} <span class="expand-hint">click to expand</span></div>` +
    `<div class="json-body">${jsonStr}</div>`;

  entry.addEventListener("click", () => {
    entry.classList.toggle("expanded");
  });

  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function appendChunkMarker(index: number, content: string): void {
  const entry = document.createElement("div");
  entry.className = "log-entry chunk-marker";
  entry.textContent = `--- chunk ${index} (${content.length} bytes) ---`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function appendDone(nodeCount: number, elapsed: number): void {
  const entry = document.createElement("div");
  entry.className = "log-entry node-done";
  entry.innerHTML = `<span class="node-tag" style="color:#6366f1">done</span> ${nodeCount} nodes in ${elapsed.toFixed(1)} ms`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(): Promise<void> {
  const xml = inputEl.value;
  const delay = parseInt(throttleEl.value, 10);
  const chunkSize = Math.max(1, parseInt(chunkSizeEl.value, 10) || 64);

  // Parse the select input: comma-separated tag names, trimmed, empty strings removed
  const selectRaw = selectTagsEl.value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const options: TransformStreamOptions = {};
  if (selectRaw.length > 0) {
    options.select = selectRaw;
  }

  // Reset
  logEl.innerHTML = "";
  statsEl.textContent = "";
  progressEl.style.width = "0%";

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
    progressEl.style.width = pct + "%";

    if (delay > 0 && i < totalChunks - 1) {
      await sleep(delay);
    }
  }

  if (!signal.aborted) {
    await streamWriter.close();
    await readPromise;

    const elapsed = performance.now() - startTime;
    appendDone(nodeCount, elapsed);
    progressEl.style.width = "100%";
    statsEl.textContent = `${nodeCount} nodes | ${elapsed.toFixed(1)} ms`;
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
  abortController = null;
}

function stop(): void {
  if (abortController) {
    abortController.abort();
    const entry = document.createElement("div");
    entry.className = "log-entry node-done";
    entry.innerHTML = `<span class="node-tag" style="color:#dc2626">stopped</span> aborted by user`;
    logEl.appendChild(entry);
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

startBtn.addEventListener("click", run);
stopBtn.addEventListener("click", stop);

inputEl.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    run();
  }
});
