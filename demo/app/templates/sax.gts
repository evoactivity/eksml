import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';

import { createSaxParser } from 'eksml/sax';
import pageTitle from 'ember-page-title/helpers/page-title';

import LogArea from '#components/log-area.gts';
import MonacoEditor from '#components/monaco-editor.gts';
import ProgressBar from '#components/progress-bar.gts';
import { formatMs } from '#components/run-duration.gts';
import TwoPaneLayout from '#components/two-pane-layout.gts';

import type { SaxModel } from '../routes/sax';
import type { LogEntry } from '#components/log-area.gts';
import type * as ModernMonaco from 'modern-monaco';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string | undefined): string {
  if (!str) return '';

  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(str: string, max = 120): string {
  if (str.length <= max) return str;

  return str.slice(0, max) + '...';
}

function formatAttrs(attrs: Record<string, string | null>): string {
  const keys = Object.keys(attrs);

  if (keys.length === 0) return '';

  const parts = keys.map((k) => {
    const v = attrs[k];

    return v === null
      ? k
      : `${k}=<span class="event-value">"${escapeHtml(v)}"</span>`;
  });

  return ` { ${parts.join(', ')} }`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Route template component
// ---------------------------------------------------------------------------

interface SaxTemplateSignature {
  Args: {
    model: SaxModel;
  };
}

class SaxTemplate extends Component<SaxTemplateSignature> {
  @tracked throttle = '100';
  @tracked chunkSize = '64';
  @tracked stats = '';
  @tracked progress = 0;
  @tracked entries: LogEntry[] = [];
  @tracked running = false;

  private abortController: AbortController | null = null;
  private eventCount = 0;

  private inputEditorInstance: ReturnType<
    Awaited<ReturnType<typeof ModernMonaco.init>>['editor']['create']
  > | null = null;

  get xmlContent(): string {
    return this.args.model.defaultXml;
  }

  // ------- Helpers -------

  private appendLog(className: string, tag: string, detail: string): void {
    this.eventCount++;
    this.entries = [...this.entries, { type: 'event', className, tag, detail }];
  }

  private appendChunk(index: number, content: string): void {
    this.entries = [
      ...this.entries,
      {
        type: 'chunk',
        text: `--- chunk ${index} (${content.length} bytes) ---`,
      },
    ];
  }

  // ------- Actions -------

  onInputReady = (
    editor: SaxTemplate['inputEditorInstance'],
    monaco: Awaited<ReturnType<typeof ModernMonaco.init>>,
  ): void => {
    this.inputEditorInstance = editor;

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

  run = async (): Promise<void> => {
    const xml = this.inputEditorInstance
      ? ((
          this.inputEditorInstance as { getValue?: () => string }
        ).getValue?.() ?? this.xmlContent)
      : this.xmlContent;
    const delay = parseInt(this.throttle, 10);
    const chunkSize = Math.max(1, parseInt(this.chunkSize, 10) || 64);

    // Reset
    this.entries = [];
    this.stats = '';
    this.progress = 0;
    this.eventCount = 0;
    this.running = true;

    this.abortController = new AbortController();

    const signal = this.abortController.signal;

    // Split XML into chunks
    const chunks: string[] = [];

    for (let i = 0; i < xml.length; i += chunkSize) {
      chunks.push(xml.slice(i, i + chunkSize));
    }

    const parser = createSaxParser();

    parser.on(
      'opentag',
      (name: string, attrs: Record<string, string | null>) => {
        this.appendLog(
          'event-opentag',
          'opentag',
          `&lt;${escapeHtml(name)}&gt;${formatAttrs(attrs)}`,
        );
      },
    );
    parser.on('closetag', (name: string) => {
      this.appendLog(
        'event-closetag',
        'closetag',
        `&lt;/${escapeHtml(name)}&gt;`,
      );
    });
    parser.on('text', (text: string) => {
      this.appendLog(
        'event-text',
        'text',
        `<span class="event-value">"${escapeHtml(truncate(text))}"</span>`,
      );
    });
    parser.on('cdata', (data: string) => {
      this.appendLog(
        'event-cdata',
        'cdata',
        `<span class="event-value">${escapeHtml(truncate(data))}</span>`,
      );
    });
    parser.on('comment', (comment: string) => {
      this.appendLog(
        'event-comment',
        'comment',
        `<span class="event-value">${escapeHtml(truncate(comment))}</span>`,
      );
    });
    parser.on('processinginstruction', (name: string, body: string) => {
      this.appendLog(
        'event-pi',
        'pi',
        `&lt;?${escapeHtml(name)} ${escapeHtml(truncate(body))}?&gt;`,
      );
    });
    parser.on(
      'doctype',
      (tagName: string, attrs: Record<string, string | null>) => {
        this.appendLog(
          'event-doctype',
          'doctype',
          `&lt;${escapeHtml(tagName)}&gt;${formatAttrs(attrs)}`,
        );
      },
    );

    const totalChunks = chunks.length;
    const startTime = performance.now();

    for (let i = 0; i < totalChunks; i++) {
      if (signal.aborted) break;

      const chunk = chunks[i] as string;

      this.appendChunk(i + 1, chunk);
      parser.write(chunk);

      const pct = ((i + 1) / totalChunks) * 100;

      this.progress = pct;
      this.stats = `chunk ${i + 1}/${totalChunks} | ${this.eventCount} events`;

      if (delay > 0 && i < totalChunks - 1) {
        await sleep(delay);
      }
    }

    if (!signal.aborted) {
      parser.close();

      const elapsed = performance.now() - startTime;

      this.appendLog(
        'event-done',
        'done',
        `${this.eventCount} events in ${formatMs(elapsed)}`,
      );
      this.progress = 100;
      this.stats = `${this.eventCount} events`;
    }

    this.running = false;
    this.abortController = null;
  };

  stop = (): void => {
    if (this.abortController) {
      this.abortController.abort();
      this.appendLog('event-done', 'stopped', 'aborted by user');
      this.running = false;
    }
  };

  get hasEntries(): boolean {
    return this.entries.length > 0;
  }

  get showEmptyState(): boolean {
    return !this.running && !this.hasEntries;
  }

  get notRunning(): boolean {
    return !this.running;
  }

  isThrottle = (value: string): boolean => this.throttle === value;

  <template>
    {{pageTitle 'SAX Parser'}}

    <h1>SAX Parser</h1>
    <p class='subtitle'>
      Feeds XML to the SAX parser chunk-by-chunk with configurable throttle to
      simulate network conditions and chunk size.
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
          <span>Events</span>
          <span class='stats'>{{this.stats}}</span>
        </div>
        {{#if this.showEmptyState}}
          <div class='bench-empty'>
            Click "Stream" to begin parsing.
          </div>
        {{else}}
          <ProgressBar @percent={{this.progress}} />
          <LogArea @entries={{this.entries}} />
        {{/if}}
      </:right>
    </TwoPaneLayout>
  </template>
}

export default SaxTemplate;
