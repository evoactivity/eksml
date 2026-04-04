import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { action } from '@ember/object';

import BenchResultList from '#components/bench-result-list.gts';
import DurationSelect from '#components/duration-select.gts';
import MonacoEditor from '#components/monaco-editor.gts';
import TabStrip from '#components/tab-strip.gts';
import TwoPaneLayout from '#components/two-pane-layout.gts';
import { BenchResult, formatSize } from '#utils/bench-result.ts';

import type { BenchmarkModel, SuiteDef } from '../routes/benchmark';
import type Owner from '@ember/owner';

// ---------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------

interface BenchmarkTemplateSignature {
  Args: {
    model: BenchmarkModel;
  };
}

/** Duration each parser gets to run, in ms */
const DEFAULT_DURATION_MS = 2000;

// ---------------------------------------------------------------------------
// Route template component — orchestration only
// ---------------------------------------------------------------------------

class BenchmarkTemplate extends Component<BenchmarkTemplateSignature> {
  @tracked activeTab = 0;
  @tracked inputContent = '';
  @tracked results: BenchResult[] = [];
  @tracked running = false;
  @tracked durationMs = String(DEFAULT_DURATION_MS);
  @tracked suiteIndex = 0;

  private worker: Worker | null = null;

  constructor(owner: Owner, args: BenchmarkTemplateSignature['Args']) {
    super(owner, args);

    const firstSample = this.args.model.samples[0];

    this.inputContent = firstSample ? firstSample.content : '';
  }

  willDestroy(): void {
    super.willDestroy();
    this.worker?.terminate();
    this.worker = null;
  }

  // ------- Computed -------

  get tabs(): { label: string; size: string }[] {
    return this.args.model.samples.map((s) => ({
      label: s.label,
      size: formatSize(s.content.length),
    }));
  }

  get currentSuite(): SuiteDef {
    return this.args.model.suites[this.suiteIndex] as SuiteDef;
  }

  get isSuite0(): boolean {
    return this.suiteIndex === 0;
  }

  get isSuite1(): boolean {
    return this.suiteIndex === 1;
  }

  // ------- Worker management -------

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../workers/benchmark-worker.js', import.meta.url),
        { type: 'module' },
      );
    }

    return this.worker;
  }

  private runSingle(
    xml: string,
    parserId: string,
    durationMs: number,
  ): Promise<{ iterations: number; elapsed: number } | { error: string }> {
    return new Promise((resolve) => {
      const w = this.ensureWorker();

      const handler = (
        event: MessageEvent<{
          type: string;
          parserId: string;
          iterations?: number;
          elapsed?: number;
          message?: string;
        }>,
      ): void => {
        const data = event.data;

        if (data.parserId !== parserId) return;

        w.removeEventListener('message', handler);

        if (data.type === 'result') {
          resolve({
            iterations: data.iterations ?? 0,
            elapsed: data.elapsed ?? 0,
          });
        } else {
          resolve({ error: data.message ?? 'Unknown error' });
        }
      };

      w.addEventListener('message', handler);
      w.postMessage({ type: 'run', xml, parserId, durationMs });
    });
  }

  // ------- Actions -------

  @action
  selectTab(index: number): void {
    this.activeTab = index;

    const sample = this.args.model.samples[index];

    this.inputContent = sample ? sample.content : '';
  }

  @action
  onInputChange(value: string): void {
    this.inputContent = value;
  }

  @action
  setDuration(value: string): void {
    this.durationMs = value;
  }

  @action
  setSuite(event: Event): void {
    this.suiteIndex = parseInt((event.target as HTMLSelectElement).value, 10);
    this.results = [];
  }

  @action
  async run(): Promise<void> {
    if (this.running) return;

    const xml = this.inputContent;
    const durationMs = parseInt(this.durationMs, 10) || DEFAULT_DURATION_MS;
    const parsers = this.currentSuite.parsers;

    // Initialise fresh results
    this.results = parsers.map((p) => new BenchResult(p));
    this.running = true;

    // Run each parser sequentially so they don't contend
    for (const result of this.results) {
      result.status = 'running';

      // Re-assign to trigger tracked array update for sortedResults
      this.results = [...this.results];

      const outcome = await this.runSingle(xml, result.def.id, durationMs);

      if ('error' in outcome) {
        result.status = 'error';
        result.errorMessage = outcome.error;
      } else {
        result.iterations = outcome.iterations;
        result.elapsed = outcome.elapsed;
        result.status = 'done';
      }

      // Re-assign to trigger re-sort
      this.results = [...this.results];
    }

    this.running = false;
  }

  // ------- Template -------

  <template>
    <h1>Benchmark</h1>
    <p class='subtitle'>
      {{this.currentSuite.description}}
    </p>

    <div class='controls'>
      <label for='suite'>Suite</label>
      <select
        id='suite'
        disabled={{this.running}}
        {{on 'change' this.setSuite}}
      >
        <option value='0' selected={{this.isSuite0}}>Parse (DOM)</option>
        <option value='1' selected={{this.isSuite1}}>Stream (SAX)</option>
      </select>

      <DurationSelect
        @value={{this.durationMs}}
        @onChange={{this.setDuration}}
      />

      <button class='primary' disabled={{this.running}} {{on 'click' this.run}}>
        {{#if this.running}}
          Running...
        {{else}}
          Run Benchmark
        {{/if}}
      </button>
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
        />
      </:left>

      <:right>
        <BenchResultList @results={{this.results}} @running={{this.running}} />
      </:right>
    </TwoPaneLayout>
  </template>
}

export default BenchmarkTemplate;
