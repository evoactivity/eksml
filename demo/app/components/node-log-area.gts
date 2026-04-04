import ExpandableNodeLogEntry from '#components/expandable-node-log-entry.gts';
import NodeLogEntry from '#components/node-log-entry.gts';
import scrollToBottom from '#modifiers/scroll-to-bottom.ts';

import type { TOC } from '@ember/component/template-only';
import type { LogItem, NodeEntry } from '#utils/node-log.ts';

interface NodeLogAreaSignature {
  Args: {
    items: LogItem[];
  };
}

function isNode(item: LogItem): boolean {
  return item.type === 'node';
}

function getEntry(item: LogItem): NodeEntry {
  return item.entry as NodeEntry;
}

const NodeLogArea: TOC<NodeLogAreaSignature> = <template>
  <div class='log-area' {{scrollToBottom @items.length}}>
    {{#each @items as |item|}}
      {{#if (isNode item)}}
        <ExpandableNodeLogEntry @entry={{getEntry item}} />
      {{else}}
        <NodeLogEntry @entry={{item}} />
      {{/if}}
    {{/each}}
  </div>
</template>;

export default NodeLogArea;
