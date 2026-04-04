import Component from '@glimmer/component';
import { on } from '@ember/modifier';

import type { NodeEntry } from '#utils/node-log.ts';

interface ExpandableNodeLogEntrySignature {
  Args: {
    entry: NodeEntry;
  };
}

export default class ExpandableNodeLogEntry extends Component<ExpandableNodeLogEntrySignature> {
  get isTextNode(): boolean {
    return typeof this.args.entry.node === 'string';
  }

  toggle = (): void => {
    this.args.entry.expanded = !this.args.entry.expanded;
  };

  <template>
    <div
      class='log-entry collapsible
        {{if this.isTextNode "node-text" "node-element"}}
        {{if @entry.expanded "expanded"}}'
      role='button'
      {{on 'click' this.toggle}}
    >
      <div class='node-summary'>
        {{{@entry.summary}}}
        <span class='expand-hint'>click to expand</span>
      </div>
      <div class='json-body'>
        {{#if @entry.colorizedJson}}
          {{{@entry.colorizedJson}}}
        {{else}}
          {{@entry.json}}
        {{/if}}
      </div>
    </div>
  </template>
}
