import { parse } from "#src/parser.ts";
import { lossy } from "#src/converters/lossy.ts";
import { lossless } from "#src/converters/lossless.ts";

const inputEl = document.getElementById("input") as HTMLTextAreaElement;
const outputEl = document.getElementById("output") as HTMLDivElement;
const timingEl = document.getElementById("timing") as HTMLSpanElement;
const modeEl = document.getElementById("mode") as HTMLSelectElement;
const entitiesEl = document.getElementById("entities") as HTMLInputElement;
const htmlEl = document.getElementById("html") as HTMLInputElement;
const benchEl = document.getElementById("bench") as HTMLInputElement;
const parseBtn = document.getElementById("parse-btn") as HTMLButtonElement;

type ParseFn = (xml: string, options: Record<string, boolean>) => unknown;

function selectParser(mode: string): ParseFn {
  if (mode === "dom") return parse;
  if (mode === "lossy") return lossy as ParseFn;
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
const BENCH_MAX_ITERATIONS = 1_000_000;

async function run(): Promise<void> {
  const xml = inputEl.value;
  const mode = modeEl.value;
  const bench = benchEl.checked;
  const options: Record<string, boolean> = {};
  if (entitiesEl.checked) options.entities = true;
  if (htmlEl.checked) options.html = true;

  outputEl.classList.remove("error");

  try {
    const fn = selectParser(mode);

    // Single run -- always needed for the output
    const t0 = performance.now();
    const result = fn(xml, options);
    const singleMs = performance.now() - t0;

    outputEl.textContent = JSON.stringify(result, null, 2);

    if (bench) {
      // Show spinner, disable button, yield so the browser paints
      timingEl.textContent = "benching...";
      timingEl.classList.add("benching");
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
      timingEl.classList.remove("benching");
      parseBtn.disabled = false;
    } else {
      const micro = singleMs * 1000;
      timingEl.textContent = micro < 1000 ? "< 1 ms" : formatDuration(micro);
    }
  } catch (err: unknown) {
    outputEl.classList.add("error");
    outputEl.textContent = (err as Error).message;
    timingEl.textContent = "";
    timingEl.classList.remove("benching");
    parseBtn.disabled = false;
  }
}

parseBtn.addEventListener("click", run);
inputEl.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    run();
  }
});

// Parse on load
run();
