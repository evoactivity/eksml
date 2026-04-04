import ExpandableNodeLogEntry from '#components/expandable-node-log-entry.gts';
import NodeLogEntry from '#components/node-log-entry.gts';
import scrollToBottom from '#modifiers/scroll-to-bottom.ts';

import type { TOC } from '@ember/component/template-only';
import type { LogItem, NodeEntry } from '#utils/node-log.ts';

interface NodeLogAreaSignature {
  Args: {
    items: (LogItem & { entry: NodeEntry })[];
  };
}

function isNode(item: LogItem): boolean {
  return item.type === 'node';
}

const NodeLogArea: TOC<NodeLogAreaSignature> = <template>
  <div class='log-area' {{scrollToBottom @items.length}}>
    {{#each @items as |item|}}
      {{#if (isNode item)}}
        <ExpandableNodeLogEntry @entry={{item.entry}} />
      {{else}}
        <NodeLogEntry @entry={{item}} />
      {{/if}}
    {{/each}}
  </div>
</template>;

export default NodeLogArea;
