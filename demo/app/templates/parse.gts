import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';

import { lossless } from '@eksml/xml/lossless';
import { lossy } from '@eksml/xml/lossy';
import { parse } from '@eksml/xml/parser';
import pageTitle from 'ember-page-title/helpers/page-title';

import MonacoEditor from '#components/monaco-editor.gts';
import RunDuration from '#components/run-duration.gts';
import TabStrip from '#components/tab-strip.gts';
import TwoPaneLayout from '#components/two-pane-layout.gts';

import type { ParseModel } from '../routes/parse';
import type Owner from '@ember/owner';
import type { init as monacoInit } from 'modern-monaco';

type MonacoApi = Awaited<ReturnType<typeof monacoInit>>;
type InputEditorInstance = ReturnType<MonacoApi['editor']['create']> | null;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ParseFn = (xml: string, options: Record<string, boolean>) => unknown;

function selectParser(mode: string): ParseFn {
  if (mode === 'dom') return parse;
  if (mode === 'lossy') return lossy as ParseFn;

  return lossless as ParseFn;
}

interface ParseTemplateSignature {
  Args: {
    model: ParseModel;
  };
}

class ParseTemplate extends Component<ParseTemplateSignature> {
  @tracked mode = 'dom';
  @tracked entities = false;
  @tracked html = false;
  @tracked activeTab = 0;
  @tracked elapsedMs: number | null = null;
  @tracked error: string | null = null;
  @tracked outputContent = '';
  @tracked inputContent = '';

  private inputEditorInstance: InputEditorInstance = null;
  private monacoApi: MonacoApi | null = null;

  constructor(owner: Owner, args: ParseTemplateSignature['Args']) {
    super(owner, args);
    this.inputContent = this.sampleContent(0);
  }

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

  onInputReady = (
    editor: ParseTemplate['inputEditorInstance'],
    monaco: ParseTemplate['monacoApi'],
  ): void => {
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
  };

  onInputChange = (value: string): void => {
    this.inputContent = value;
    void this.run();
  };

  selectTab = (index: number): void => {
    this.activeTab = index;
    this.inputContent = this.sampleContent(index);
    void this.run();
  };

  setMode = (event: Event): void => {
    this.mode = (event.target as HTMLSelectElement).value;
    void this.run();
  };

  toggleEntities = (): void => {
    this.entities = !this.entities;
    void this.run();
  };

  toggleHtml = (): void => {
    this.html = !this.html;
    void this.run();
  };

  run = (): void => {
    const xml = this.inputContent;
    const mode = this.mode;
    const options: Record<string, boolean> = {};

    if (this.entities) options.entities = true;
    if (this.html) options.html = true;

    this.error = null;

    try {
      const parseFn = selectParser(mode);

      const t0 = performance.now();
      const result = parseFn(xml, options);
      const elapsed = performance.now() - t0;

      this.outputContent = JSON.stringify(result, null, 2);
      this.elapsedMs = elapsed;
    } catch (err: unknown) {
      this.error = (err as Error).message;
      this.elapsedMs = null;
    }
  };

  get isDom(): boolean {
    return this.mode === 'dom';
  }
  get isLossy(): boolean {
    return this.mode === 'lossy';
  }
  get isLossless(): boolean {
    return this.mode === 'lossless';
  }

  <template>
    {{pageTitle 'Parse'}}
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
          <RunDuration @ms={{this.elapsedMs}} />
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
}

export default ParseTemplate;
