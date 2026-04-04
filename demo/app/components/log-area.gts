import Component from '@glimmer/component';

import scrollToBottom from '#modifiers/scroll-to-bottom.ts';

export interface LogEntry {
  type: 'event' | 'chunk' | 'done';
  className?: string;
  tag?: string;
  detail?: string;
  text?: string;
}

interface LogAreaSignature {
  Args: {
    entries: LogEntry[];
  };
}

export default class LogArea extends Component<LogAreaSignature> {
  <template>
    <div class='log-area' {{scrollToBottom @entries.length}}>
      {{#each @entries as |entry|}}
        {{#if (this.isChunk entry)}}
          <div class='log-entry chunk-marker'>{{entry.text}}</div>
        {{else}}
          <div class='log-entry {{entry.className}}'>
            {{#if entry.tag}}
              <span class='event-tag'>{{entry.tag}}</span>
            {{/if}}
            {{#if entry.detail}}
              {{! detail may contain HTML for colorized output }}
              <span class='event-detail'>{{{entry.detail}}}</span>
            {{/if}}
          </div>
        {{/if}}
      {{/each}}
    </div>
  </template>

  isChunk = (entry: LogEntry): boolean => {
    return entry.type === 'chunk';
  };
}
