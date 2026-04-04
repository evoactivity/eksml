import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { action } from '@ember/object';

import { fromLossless } from 'eksml/from-lossless';
import { fromLossy } from 'eksml/from-lossy';
import { writer } from 'eksml/writer';

import MonacoEditor from '#components/monaco-editor.gts';
import TabStrip from '#components/tab-strip.gts';
import TwoPaneLayout from '#components/two-pane-layout.gts';

import type { WriterModel } from '../routes/writer';
import type Owner from '@ember/owner';
import type { init as monacoInit } from 'modern-monaco';

type MonacoApi = Awaited<ReturnType<typeof monacoInit>>;
type EditorInstance = ReturnType<MonacoApi['editor']['create']> | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(microseconds: number): string {
  if (microseconds < 1000) return `${microseconds.toFixed(1)} us`;
  if (microseconds < 1_000_000) return `${(microseconds / 1000).toFixed(3)} ms`;

  return `${(microseconds / 1_000_000).toFixed(3)} s`;
}

// ---------------------------------------------------------------------------
// Route template component
// ---------------------------------------------------------------------------

interface WriterTemplateSignature {
  Args: {
    model: WriterModel;
  };
}

class WriterTemplate extends Component<WriterTemplateSignature> {
  @tracked format: 'dom' | 'lossy' | 'lossless' = 'dom';
  @tracked pretty = true;
  @tracked entities = false;
  @tracked html = false;
  @tracked activeTab = 0;
  @tracked timing = '';
  @tracked error: string | null = null;
  @tracked outputContent = '';
  @tracked inputContent = '';

  private inputEditorInstance: EditorInstance = null;
  private monacoApi: MonacoApi | null = null;

  constructor(owner: Owner, args: WriterTemplateSignature['Args']) {
    super(owner, args);
    this.inputContent = this.sampleContent(0);
  }

  // ------- Computed -------

  get tabs(): { label: string }[] {
    return this.args.model.samples.map((s) => ({ label: s.label }));
  }

  private sampleContent(index: number): string {
    const sample = this.args.model.samples[index];

    if (!sample) return '';

    return sample[this.format];
  }

  // ------- Actions -------

  @action
  onInputReady(
    editor: WriterTemplate['inputEditorInstance'],
    monaco: WriterTemplate['monacoApi'],
  ): void {
    this.inputEditorInstance = editor;
    this.monacoApi = monaco;

    if (monaco && editor) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        this.run();
      });
    }

    this.run();
  }

  @action
  onInputChange(value: string): void {
    this.inputContent = value;
    this.run();
  }

  @action
  selectTab(index: number): void {
    this.activeTab = index;
    this.inputContent = this.sampleContent(index);
    this.run();
  }

  @action
  setFormat(event: Event): void {
    this.format = (event.target as HTMLSelectElement).value as
      | 'dom'
      | 'lossy'
      | 'lossless';
    this.inputContent = this.sampleContent(this.activeTab);
    this.run();
  }

  @action
  togglePretty(): void {
    this.pretty = !this.pretty;
    this.run();
  }

  @action
  toggleEntities(): void {
    this.entities = !this.entities;
    this.run();
  }

  @action
  toggleHtml(): void {
    this.html = !this.html;
    this.run();
  }

  @action
  run(): void {
    const jsonText = this.inputContent;
    const format = this.format;
    const options: Record<string, boolean> = {};

    if (this.pretty) options.pretty = true;
    if (this.entities) options.entities = true;
    if (this.html) options.html = true;

    this.error = null;

    try {
      const parsed: unknown = JSON.parse(jsonText);

      // Convert to DOM if needed
      let dom: unknown;

      if (format === 'lossy') {
        dom = fromLossy(parsed as Parameters<typeof fromLossy>[0]);
      } else if (format === 'lossless') {
        dom = fromLossless(parsed as Parameters<typeof fromLossless>[0]);
      } else {
        dom = parsed;
      }

      const t0 = performance.now();
      const xml = writer(dom as Parameters<typeof writer>[0], options);
      const elapsed = performance.now() - t0;

      this.outputContent = xml;

      const micro = elapsed * 1000;

      this.timing = micro < 1000 ? '< 1 ms' : formatDuration(micro);
    } catch (err: unknown) {
      this.error = (err as Error).message;
      this.timing = '';
    }
  }

  <template>
    <h1>eksml / Writer</h1>
    <p class='subtitle'>
      Enter JSON (DOM, lossy, or lossless) on the left, see serialized XML on
      the right.
    </p>

    <div class='controls'>
      <label for='format'>Input format</label>
      <select id='format' {{on 'change' this.setFormat}}>
        <option value='dom' selected={{this.isDom}}>DOM (TNode[])</option>
        <option value='lossy' selected={{this.isLossy}}>Lossy</option>
        <option value='lossless' selected={{this.isLossless}}>Lossless</option>
      </select>

      <label>
        <input
          type='checkbox'
          checked={{this.pretty}}
          {{on 'change' this.togglePretty}}
        />
        Pretty-print
      </label>

      <label>
        <input
          type='checkbox'
          checked={{this.entities}}
          {{on 'change' this.toggleEntities}}
        />
        Encode entities
      </label>

      <label>
        <input
          type='checkbox'
          checked={{this.html}}
          {{on 'change' this.toggleHtml}}
        />
        HTML mode
      </label>

      <button class='primary' {{on 'click' this.run}}>Write</button>
    </div>

    <TwoPaneLayout>
      <:left>
        <div class='pane-header'>Input JSON</div>
        <TabStrip
          @tabs={{this.tabs}}
          @activeIndex={{this.activeTab}}
          @onSelect={{this.selectTab}}
        />
        <MonacoEditor
          @language='json'
          @content={{this.inputContent}}
          @onChange={{this.onInputChange}}
          @onReady={{this.onInputReady}}
        />
      </:left>

      <:right>
        <div class='pane-header'>
          <span>Output XML</span>
          <span class='timing'>{{this.timing}}</span>
        </div>
        <MonacoEditor
          @language='xml'
          @readOnly={{true}}
          @content={{this.outputContent}}
        />
        {{#if this.error}}
          <div class='error-overlay'>{{this.error}}</div>
        {{/if}}
      </:right>
    </TwoPaneLayout>
  </template>

  get isDom(): boolean {
    return this.format === 'dom';
  }
  get isLossy(): boolean {
    return this.format === 'lossy';
  }
  get isLossless(): boolean {
    return this.format === 'lossless';
  }
}

export default WriterTemplate;
