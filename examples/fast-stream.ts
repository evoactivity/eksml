import { fastStream } from "#src/fastStream.ts";

const inputEl = document.getElementById("input") as HTMLTextAreaElement;
const logEl = document.getElementById("log") as HTMLDivElement;
const statsEl = document.getElementById("stats") as HTMLSpanElement;
const progressEl = document.getElementById("progress") as HTMLDivElement;
const throttleEl = document.getElementById("throttle") as HTMLSelectElement;
const chunkSizeEl = document.getElementById("chunk-size") as HTMLInputElement;
const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
const stopBtn = document.getElementById("stop-btn") as HTMLButtonElement;

let abortController: AbortController | null = null;
let eventCount = 0;

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(str: string, max = 120): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + "...";
}

function appendLog(className: string, tag: string, detail: string): void {
  eventCount++;
  const entry = document.createElement("div");
  entry.className = `log-entry ${className}`;
  entry.innerHTML =
    `<span class="event-tag">${tag}</span> ` +
    `<span class="event-detail">${detail}</span>`;
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

function formatAttrs(attrs: Record<string, string | null>): string {
  const keys = Object.keys(attrs);
  if (keys.length === 0) return "";
  const parts = keys.map((k) => {
    const v = attrs[k];
    return v === null
      ? k
      : `${k}=<span class="event-value">"${escapeHtml(v)}"</span>`;
  });
  return ` { ${parts.join(", ")} }`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(): Promise<void> {
  const xml = inputEl.value;
  const delay = parseInt(throttleEl.value, 10);
  const chunkSize = Math.max(1, parseInt(chunkSizeEl.value, 10) || 64);

  // Reset
  logEl.innerHTML = "";
  statsEl.textContent = "";
  progressEl.style.width = "0%";
  eventCount = 0;

  abortController = new AbortController();
  const signal = abortController.signal;

  startBtn.disabled = true;
  stopBtn.disabled = false;

  // Split XML into chunks
  const chunks: string[] = [];
  for (let i = 0; i < xml.length; i += chunkSize) {
    chunks.push(xml.slice(i, i + chunkSize));
  }

  const parser = fastStream({
    onopentag(name, attrs) {
      appendLog(
        "event-opentag",
        "opentag",
        `&lt;${escapeHtml(name)}&gt;${formatAttrs(attrs)}`,
      );
    },
    onclosetag(name) {
      appendLog(
        "event-closetag",
        "closetag",
        `&lt;/${escapeHtml(name)}&gt;`,
      );
    },
    ontext(text) {
      appendLog(
        "event-text",
        "text",
        `<span class="event-value">"${escapeHtml(truncate(text))}"</span>`,
      );
    },
    oncdata(data) {
      appendLog(
        "event-cdata",
        "cdata",
        `<span class="event-value">${escapeHtml(truncate(data))}</span>`,
      );
    },
    oncomment(comment) {
      appendLog(
        "event-comment",
        "comment",
        `<span class="event-value">${escapeHtml(truncate(comment))}</span>`,
      );
    },
    onprocessinginstruction(name, body) {
      appendLog(
        "event-pi",
        "pi",
        `&lt;?${escapeHtml(name)} ${escapeHtml(truncate(body))}?&gt;`,
      );
    },
  });

  const totalChunks = chunks.length;
  const startTime = performance.now();

  for (let i = 0; i < totalChunks; i++) {
    if (signal.aborted) break;

    appendChunkMarker(i + 1, chunks[i]!);
    parser.write(chunks[i]!);

    const pct = ((i + 1) / totalChunks) * 100;
    progressEl.style.width = pct + "%";
    statsEl.textContent = `chunk ${i + 1}/${totalChunks} | ${eventCount} events`;

    if (delay > 0 && i < totalChunks - 1) {
      await sleep(delay);
    }
  }

  if (!signal.aborted) {
    parser.close();
    const elapsed = performance.now() - startTime;
    appendLog(
      "event-done",
      "done",
      `${eventCount} events in ${elapsed.toFixed(1)} ms`,
    );
    progressEl.style.width = "100%";
    statsEl.textContent = `${eventCount} events | ${elapsed.toFixed(1)} ms`;
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
  abortController = null;
}

function stop(): void {
  if (abortController) {
    abortController.abort();
    appendLog("event-done", "stopped", "aborted by user");
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
