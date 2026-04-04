import Component from '@glimmer/component';

import type { LogItem } from '#utils/node-log.ts';

interface NodeLogEntrySignature {
  Args: {
    entry: LogItem;
  };
}

export default class NodeLogEntry extends Component<NodeLogEntrySignature> {
  get isChunk(): boolean {
    return this.args.entry.type === 'chunk';
  }

  get isDone(): boolean {
    return this.args.entry.type === 'done';
  }

  get isStopped(): boolean {
    return this.args.entry.text === 'aborted by user';
  }

  <template>
    {{#if this.isChunk}}
      <div class='log-entry chunk-marker'>{{@entry.text}}</div>
    {{else if this.isDone}}
      <div class='log-entry node-done'>
        <span class='node-done-tag'>
          {{#if this.isStopped}}stopped{{else}}done{{/if}}
        </span>
        {{@entry.text}}
      </div>
    {{/if}}
  </template>
}
