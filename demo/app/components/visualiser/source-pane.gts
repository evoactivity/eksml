import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';

import { modifier } from 'ember-modifier';

import MonacoEditor from '#components/monaco-editor.gts';
import { phaseColor } from '#components/visualiser/phase-utils.ts';

import type { Step } from '#utils/parser-stepper.ts';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const scrollToHighlight = modifier(
  (element: HTMLElement, [_stepIndex]: [number]) => {
    void _stepIndex;

    const target =
      element.querySelector('.vis-highlight') ??
      element.querySelector('.vis-cursor');

    if (target) {
      const container = element;
      const targetRect = target.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      const isVisible =
        targetRect.top >= containerRect.top &&
        targetRect.bottom <= containerRect.bottom;

      if (!isVisible) {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  },
);

interface SourcePaneSignature {
  Args: {
    step: Step;
    stepIndex: number;
    source: string;
    onChange: (value: string) => void;
  };
}

export default class SourcePane extends Component<SourcePaneSignature> {
  @tracked _editorHasOpened = false;
  @tracked editorOpen = false;

  get editorHasOpened(): boolean {
    return this._editorHasOpened;
  }

  get highlightedSource(): string {
    const step = this.args.step;
    const xml = this.args.source;
    const [hlStart, hlEnd] = step.highlight;

    const before = escapeHtml(xml.substring(0, hlStart));
    const highlighted = escapeHtml(xml.substring(hlStart, hlEnd));
    const after = escapeHtml(xml.substring(hlEnd));
    const dimAfter =
      after.length > 0 ? `<span class="vis-dim">${after}</span>` : '';

    if (highlighted.length === 0) {
      return before + '<span class="vis-cursor"></span>' + dimAfter;
    }

    return (
      before +
      `<span class="vis-highlight ${phaseColor(step.phase)}">` +
      highlighted +
      '</span>' +
      dimAfter
    );
  }

  onToggleEditor = (event: Event): void => {
    this.editorOpen = (event.target as HTMLDetailsElement).open;

    if (this.editorOpen) {
      this._editorHasOpened = true;
    }
  };

  <template>
    <div class='pane-header'>
      <span>XML Source</span>
      <span class='stats'>pos {{@step.pos}}</span>
    </div>
    <div class='vis-source-container' {{scrollToHighlight @stepIndex}}>
      <pre class='vis-source'>{{{this.highlightedSource}}}</pre>
    </div>
    <div class='vis-edit-row'>
      <details {{on 'toggle' this.onToggleEditor}}>
        <summary>Edit XML</summary>
        {{#if this.editorHasOpened}}
          <MonacoEditor
            @language='xml'
            @content={{@source}}
            @onChange={{@onChange}}
          />
        {{/if}}
      </details>
    </div>
  </template>
}
