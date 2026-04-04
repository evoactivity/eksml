import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { action } from '@ember/object';

import { lossless } from 'eksml/lossless';
import { lossy } from 'eksml/lossy';
import { parse } from 'eksml/parser';

import MonacoEditor from '#components/monaco-editor.gts';
import TabStrip from '#components/tab-strip.gts';
import TwoPaneLayout from '#components/two-pane-layout.gts';

import type { ParseModel } from '../routes/parse';
import type Owner from '@ember/owner';
import type { init as monacoInit } from 'modern-monaco';

type MonacoApi = Awaited<ReturnType<typeof monacoInit>>;
type InputEditorInstance = ReturnType<MonacoApi['editor']['create']> | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(microseconds: number): string {
  if (microseconds < 1000) return `${microseconds.toFixed(1)} us`;
  if (microseconds < 1_000_000) return `${(microseconds / 1000).toFixed(3)} ms`;

  return `${(microseconds / 1_000_000).toFixed(3)} s`;
}

type ParseFn = (xml: string, options: Record<string, boolean>) => unknown;

function selectParser(mode: string): ParseFn {
  if (mode === 'dom') return parse;
  if (mode === 'lossy') return lossy as ParseFn;

  return lossless as ParseFn;
}

function yieldFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
}

const BENCH_TARGET_MS = 200;
const BENCH_MIN_ITERATIONS = 10;
const BENCH_MAX_ITERATIONS = 200_000;

// ---------------------------------------------------------------------------
// Route template component
// ---------------------------------------------------------------------------

interface ParseTemplateSignature {
  Args: {
    model: ParseModel;
  };
}

class ParseTemplate extends Component<ParseTemplateSignature> {
  @tracked mode = 'dom';
  @tracked entities = false;
  @tracked html = false;
  @tracked bench = false;
  @tracked activeTab = 0;
  @tracked timing = '';
  @tracked benching = false;
  @tracked error: string | null = null;
  @tracked outputContent = '';
  @tracked parseDisabled = false;
  @tracked inputContent = '';

  private inputEditorInstance: InputEditorInstance = null;
  private monacoApi: MonacoApi | null = null;

  constructor(owner: Owner, args: ParseTemplateSignature['Args']) {
    super(owner, args);
    this.inputContent = this.sampleContent(0);
  }

  // ------- Computed: tabs -------

  get tabs(): { label: string; size: string }[] {
    const { samples, getLargeCatalog } = this.args.model;
    const result = samples.map((s) => ({
      label: s.label,
      size: formatSize(s.content.length),
    }));
    const largeCatalog = getLargeCatalog();

    result.push({
      label: 'Catalog (5K)',
      size: formatSize(largeCatalog.length),
    });

    return result;
  }

  private sampleContent(index: number): string {
    const { samples, getLargeCatalog } = this.args.model;

    if (index < samples.length) {
      const sample = samples[index];

      return sample ? sample.content : '';
    }

    return getLargeCatalog();
  }

  // ------- Actions -------

  @action
  onInputReady(
    editor: ParseTemplate['inputEditorInstance'],
    monaco: ParseTemplate['monacoApi'],
  ): void {
    this.inputEditorInstance = editor;
    this.monacoApi = monaco;

    // Cmd/Ctrl+Enter to parse
    if (monaco && editor) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        void this.run();
      });
    }

    // Run initial parse
    void this.run();
  }

  @action
  onInputChange(value: string): void {
    this.inputContent = value;
    void this.run();
  }

  @action
  selectTab(index: number): void {
    this.activeTab = index;
    this.inputContent = this.sampleContent(index);
    void this.run();
  }

  @action
  setMode(event: Event): void {
    this.mode = (event.target as HTMLSelectElement).value;
    void this.run();
  }

  @action
  toggleEntities(): void {
    this.entities = !this.entities;
    void this.run();
  }

  @action
  toggleHtml(): void {
    this.html = !this.html;
    void this.run();
  }

  @action
  toggleBench(): void {
    this.bench = !this.bench;
  }

  @action
  async run(): Promise<void> {
    const xml = this.inputContent;
    const mode = this.mode;
    const bench = this.bench;
    const options: Record<string, boolean> = {};

    if (this.entities) options.entities = true;
    if (this.html) options.html = true;

    this.error = null;

    try {
      const parseFn = selectParser(mode);

      // Single run
      const t0 = performance.now();
      const result = parseFn(xml, options);
      const singleMs = performance.now() - t0;

      this.outputContent = JSON.stringify(result, null, 2);

      if (bench) {
        this.timing = 'benching...';
        this.benching = true;
        this.parseDisabled = true;
        await yieldFrame();

        const iterations = Math.max(
          BENCH_MIN_ITERATIONS,
          Math.min(
            BENCH_MAX_ITERATIONS,
            Math.ceil(BENCH_TARGET_MS / Math.max(singleMs, 0.001)),
          ),
        );

        const batchStart = performance.now();

        for (let i = 0; i < iterations; i++) parseFn(xml, options);

        const batchMs = performance.now() - batchStart;

        const avgMicro = (batchMs / iterations) * 1000;

        this.timing = `${formatDuration(avgMicro)} (avg of ${iterations.toLocaleString()})`;
        this.benching = false;
        this.parseDisabled = false;
      } else {
        const micro = singleMs * 1000;

        this.timing = micro < 1000 ? '< 1 ms' : formatDuration(micro);
      }
    } catch (err: unknown) {
      this.error = (err as Error).message;
      this.timing = '';
      this.benching = false;
      this.parseDisabled = false;
    }
  }

  <template>
    <h1>Parse</h1>
    <p class='subtitle'>
      Enter XML on the left, see parsed output on the right.
    </p>

    <div class='controls'>
      <label for='mode'>Output mode</label>
      <select id='mode' {{on 'change' this.setMode}}>
        <option value='dom' selected={{this.isDom}}>DOM (TNode[])</option>
        <option value='lossy' selected={{this.isLossy}}>Lossy</option>
        <option value='lossless' selected={{this.isLossless}}>Lossless</option>
      </select>

      <label>
        <input
          type='checkbox'
          checked={{this.entities}}
          {{on 'change' this.toggleEntities}}
        />
        Decode entities
      </label>

      <label>
        <input
          type='checkbox'
          checked={{this.html}}
          {{on 'change' this.toggleHtml}}
        />
        HTML mode
      </label>

      <label>
        <input
          type='checkbox'
          checked={{this.bench}}
          {{on 'change' this.toggleBench}}
        />
        Bench
      </label>

      <button
        class='primary'
        disabled={{this.parseDisabled}}
        {{on 'click' this.run}}
      >Parse</button>
    </div>

    <TwoPaneLayout>
      <:left>
        <div class='pane-header'>Input XML</div>
        <TabStrip
          @tabs={{this.tabs}}
          @activeIndex={{this.activeTab}}
          @onSelect={{this.selectTab}}
        />
        <MonacoEditor
          @language='xml'
          @content={{this.inputContent}}
          @onChange={{this.onInputChange}}
          @onReady={{this.onInputReady}}
        />
      </:left>

      <:right>
        <div class='pane-header'>
          <span>Output</span>
          <span class='timing {{if this.benching "benching"}}'>
            {{this.timing}}
          </span>
        </div>
        <MonacoEditor
          @language='json'
          @readOnly={{true}}
          @content={{this.outputContent}}
        />
        {{#if this.error}}
          <div class='error-overlay'>{{this.error}}</div>
        {{/if}}
      </:right>
    </TwoPaneLayout>
  </template>

  // Select helpers for <option selected>
  get isDom(): boolean {
    return this.mode === 'dom';
  }
  get isLossy(): boolean {
    return this.mode === 'lossy';
  }
  get isLossless(): boolean {
    return this.mode === 'lossless';
  }
}

export default ParseTemplate;
