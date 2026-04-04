import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { trackedArray } from '@ember/reactive/collections';

import { XmlParseStream } from 'eksml/stream';
import type { XmlParseStreamOptions } from 'eksml/stream';
import pageTitle from 'ember-page-title/helpers/page-title';
import { init } from 'modern-monaco';

import MonacoEditor from '#components/monaco-editor.gts';
import NodeLogArea from '#components/node-log-area.gts';
import ProgressBar from '#components/progress-bar.gts';
import { formatMs } from '#components/run-duration.gts';
import TwoPaneLayout from '#components/two-pane-layout.gts';
import { NodeEntry } from '#utils/node-log.ts';

import type { StreamModel } from '../routes/stream';
import type { LogItem } from '#utils/node-log.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TNode {
  tagName: string;
  attributes: Record<string, string | null> | null;
  children: (TNode | string)[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatNode(node: TNode): string {
  let html = `<span class="node-tag">&lt;${escapeHtml(node.tagName)}&gt;</span>`;

  if (node.attributes) {
    const keys = Object.keys(node.attributes);

    if (keys.length > 0) {
      const parts = keys.map((k) => {
        const v = node.attributes?.[k];

        if (v == null)
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

function formatConverted(value: unknown): string {
  if (value === null) return `<span class="node-text-val">null</span>`;
  if (typeof value === 'string')
    return `<span class="node-text-val">string</span> "${escapeHtml(
      value.length > 60 ? value.slice(0, 60) + '...' : value,
    )}"`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  const tag = keys.find((k) => !k.startsWith('$'));
  const label = tag
    ? `<span class="node-tag">&lt;${escapeHtml(tag)}&gt;</span>`
    : `<span class="node-tag">object</span>`;
  const keyCount = keys.length;

  return `${label} <span class="node-children">${keyCount} ${keyCount === 1 ? 'key' : 'keys'}</span>`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let monacoInstance: Awaited<ReturnType<typeof init>> | null = null;

async function getMonaco(): Promise<Awaited<ReturnType<typeof init>>> {
  if (!monacoInstance) {
    monacoInstance = await init();

    // Warm up JSON grammar
    const warmup = monacoInstance.editor.createModel('{}', 'json');

    await monacoInstance.editor.colorize('{}', 'json', { tabSize: 2 });
    warmup.dispose();
  }

  return monacoInstance;
}

// ---------------------------------------------------------------------------
// Route template component
// ---------------------------------------------------------------------------

interface StreamTemplateSignature {
  Args: {
    model: StreamModel;
  };
}

let nextEntryId = 0;

class StreamTemplate extends Component<StreamTemplateSignature> {
  @tracked throttle = '100';
  @tracked chunkSize = '64';
  @tracked selectTags = '';
  @tracked outputMode: 'dom' | 'lossy' | 'lossless' = 'dom';
  @tracked stats = '';
  @tracked progress = 0;
  @tracked logItems: LogItem[] = trackedArray([]);
  @tracked running = false;

  private abortController: AbortController | null = null;

  private inputEditorInstance: ReturnType<
    Awaited<ReturnType<typeof init>>['editor']['create']
  > | null = null;
  private monacoApi: Awaited<ReturnType<typeof init>> | null = null;

  get xmlContent(): string {
    return this.args.model.defaultXml;
  }

  // ------- Helpers -------

  private appendNode(node: unknown): void {
    const isDom = this.outputMode === 'dom';
    let summary: string;

    if (isDom) {
      const isText = typeof node === 'string';
      summary = isText
        ? `<span class="node-text-val">text</span> "${escapeHtml(
            (node as string).length > 80
              ? (node as string).slice(0, 80) + '...'
              : (node as string),
          )}"`
        : formatNode(node as TNode);
    } else {
      summary = formatConverted(node);
    }

    const jsonRaw = JSON.stringify(node, null, 2);
    const entry = new NodeEntry(nextEntryId++, node, summary, jsonRaw);

    this.logItems.push({ type: 'node', entry });

    // Colorize asynchronously
    void getMonaco().then((monaco) => {
      void monaco.editor
        .colorize(jsonRaw, 'json', { tabSize: 2 })
        .then((colorized) => {
          entry.colorizedJson = colorized;
        });
    });
  }

  private appendChunkMarker(index: number, content: string): void {
    this.logItems.push({
      type: 'chunk',
      text: `--- chunk ${index} (${content.length} bytes) ---`,
    });
  }

  private appendDone(nodeCount: number, elapsed: number): void {
    this.logItems.push({
      type: 'done',
      text: `${nodeCount} nodes in ${formatMs(elapsed)}`,
    });
  }

  // ------- Actions -------

  onInputReady = (
    editor: StreamTemplate['inputEditorInstance'],
    monaco: StreamTemplate['monacoApi'],
  ): void => {
    this.inputEditorInstance = editor;
    this.monacoApi = monaco;

    if (monaco && editor) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        void this.run();
      });
    }
  };

  setThrottle = (event: Event): void => {
    this.throttle = (event.target as HTMLSelectElement).value;
  };

  setChunkSize = (event: Event): void => {
    this.chunkSize = (event.target as HTMLInputElement).value;
  };

  setSelectTags = (event: Event): void => {
    this.selectTags = (event.target as HTMLInputElement).value;
  };

  setOutputMode = (event: Event): void => {
    this.outputMode = (event.target as HTMLSelectElement).value as
      | 'dom'
      | 'lossy'
      | 'lossless';
  };

  run = async (): Promise<void> => {
    const xml = this.inputEditorInstance
      ? ((
          this.inputEditorInstance as { getValue?: () => string }
        ).getValue?.() ?? this.xmlContent)
      : this.xmlContent;
    const delay = parseInt(this.throttle, 10);
    const chunkSize = Math.max(1, parseInt(this.chunkSize, 10) || 64);

    // Parse select tags
    const selectRaw = this.selectTags
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const options: XmlParseStreamOptions = {};

    if (selectRaw.length > 0) {
      options.select = selectRaw;
    }

    if (this.outputMode !== 'dom') {
      options.output = this.outputMode;
    }

    // Reset
    this.logItems = trackedArray([]);
    this.stats = '';
    this.progress = 0;
    this.running = true;

    this.abortController = new AbortController();

    const signal = this.abortController.signal;

    // Split XML into chunks
    const chunks: string[] = [];

    for (let i = 0; i < xml.length; i += chunkSize) {
      chunks.push(xml.slice(i, i + chunkSize));
    }

    const totalChunks = chunks.length;
    const startTime = performance.now();
    let nodeCount = 0;

    // Create the stream
    const stream = new XmlParseStream(options);
    const streamWriter = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    // Read nodes in background
    const readPromise = (async () => {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;
        nodeCount++;
        this.appendNode(value);
        this.stats = `${nodeCount} nodes`;
      }
    })();

    // Write chunks with throttle
    for (let i = 0; i < totalChunks; i++) {
      if (signal.aborted) break;

      const chunk = chunks[i] as string;

      this.appendChunkMarker(i + 1, chunk);
      await streamWriter.write(chunk);

      const pct = ((i + 1) / totalChunks) * 100;

      this.progress = pct;

      if (delay > 0 && i < totalChunks - 1) {
        await sleep(delay);
      }
    }

    if (!signal.aborted) {
      await streamWriter.close();
      await readPromise;

      const elapsed = performance.now() - startTime;

      this.appendDone(nodeCount, elapsed);
      this.progress = 100;
      this.stats = `${nodeCount} nodes`;
    }

    this.running = false;
    this.abortController = null;
  };

  stop = (): void => {
    if (this.abortController) {
      this.abortController.abort();
      this.logItems.push({ type: 'done', text: 'aborted by user' });
      this.running = false;
    }
  };

  get notRunning(): boolean {
    return !this.running;
  }

  get hasLogItems(): boolean {
    return this.logItems.length > 0;
  }

  get showEmptyState(): boolean {
    return !this.running && !this.hasLogItems;
  }

  isThrottle = (value: string): boolean => this.throttle === value;

  isOutputMode = (value: string): boolean => this.outputMode === value;

  <template>
    {{pageTitle 'Stream'}}
    <h1>Stream</h1>
    <p class='subtitle'>
      Feeds XML chunks through an XmlParseStream, emitting complete TNode
      subtrees as they close.
    </p>

    <div class='controls'>
      <label for='throttle'>Throttle</label>
      <select id='throttle' {{on 'change' this.setThrottle}}>
        <option value='0' selected={{this.isThrottle '0'}}>No delay</option>
        <option value='16' selected={{this.isThrottle '16'}}>16 ms (60 fps)</option>
        <option value='50' selected={{this.isThrottle '50'}}>50 ms</option>
        <option value='100' selected={{this.isThrottle '100'}}>100 ms</option>
        <option value='250' selected={{this.isThrottle '250'}}>250 ms</option>
        <option value='500' selected={{this.isThrottle '500'}}>500 ms</option>
        <option value='1000' selected={{this.isThrottle '1000'}}>1000 ms</option>
      </select>

      <label for='chunk-size'>Chunk size (bytes)</label>
      <input
        type='number'
        id='chunk-size'
        value={{this.chunkSize}}
        min='1'
        max='100000'
        {{on 'input' this.setChunkSize}}
      />

      <label for='select-tags'>Select</label>
      <input
        type='text'
        id='select-tags'
        placeholder='e.g. book, author'
        spellcheck='false'
        title='Comma-separated tag names to emit (leave empty for default top-level emission)'
        value={{this.selectTags}}
        {{on 'input' this.setSelectTags}}
      />

      <label for='output-mode'>Output</label>
      <select id='output-mode' {{on 'change' this.setOutputMode}}>
        <option value='dom' selected={{this.isOutputMode 'dom'}}>DOM (TNode)</option>
        <option
          value='lossy'
          selected={{this.isOutputMode 'lossy'}}
        >Lossy</option>
        <option
          value='lossless'
          selected={{this.isOutputMode 'lossless'}}
        >Lossless</option>
      </select>

      <button
        class='primary'
        disabled={{this.running}}
        {{on 'click' this.run}}
      >Stream</button>
      <button
        class='danger'
        disabled={{this.notRunning}}
        {{on 'click' this.stop}}
      >Stop</button>
    </div>

    <TwoPaneLayout>
      <:left>
        <div class='pane-header'>Input XML</div>
        <MonacoEditor
          @language='xml'
          @content={{this.xmlContent}}
          @onReady={{this.onInputReady}}
        />
      </:left>

      <:right>
        <div class='pane-header'>
          <span>Emitted Nodes</span>
          <span class='stats'>{{this.stats}}</span>
        </div>
        {{#if this.showEmptyState}}
          <div class='bench-empty'>
            Click "Stream" to begin parsing.
          </div>
        {{else}}
          <ProgressBar @percent={{this.progress}} />
          <NodeLogArea @items={{this.logItems}} />
        {{/if}}
      </:right>
    </TwoPaneLayout>
  </template>
}

export default StreamTemplate;
