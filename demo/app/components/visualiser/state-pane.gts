import { phaseColor, phaseLabel } from '#components/visualiser/phase-utils.ts';

import type { TOC } from '@ember/component/template-only';
import type { Phase, StackEntry } from '#utils/parser-stepper.ts';

function childSummary(entry: StackEntry): string {
  const { elementCount, textCount } = entry;
  const parts: string[] = [];

  if (elementCount > 0) {
    parts.push(
      `${elementCount} ${elementCount === 1 ? 'element' : 'elements'}`,
    );
  }

  if (textCount > 0) {
    parts.push(`${textCount} text`);
  }

  return parts.length > 0 ? parts.join(', ') : 'empty';
}

function indentStyle(index: number): string {
  return `padding-left: ${index * 16}px`;
}

interface StatePaneSignature {
  Args: {
    phase: Phase;
    description: string;
    nodesEmitted: number;
    tagName: string;
    attributes: { name: string; value: string | null }[];
    stack: StackEntry[];
  };
}

const StatePane: TOC<StatePaneSignature> = <template>
  <div class='pane-header'>
    <span>Parser State</span>
    <span class='stats'>{{@nodesEmitted}} nodes</span>
  </div>
  <div class='vis-state-container'>
    <div class='vis-phase-badge {{phaseColor @phase}}'>
      {{phaseLabel @phase}}
    </div>
    <p class='vis-description'>{{@description}}</p>

    <div class='vis-columns'>
      <div class='vis-section vis-tag-section'>
        <div class='vis-tag-block'>
          <h3 class='vis-section-title'>Current Tag</h3>
          {{#if @tagName.length}}
            <code class='vis-tag-name'>&lt;{{@tagName}}&gt;</code>
          {{else}}
            <span class='vis-empty'>None</span>
          {{/if}}
        </div>

        <div class='vis-attr-block'>
          <h3 class='vis-section-title'>Attributes</h3>
          {{#if @attributes.length}}
            <ul class='vis-attr-list'>
              {{#each @attributes as |attr|}}
                <li>
                  <span class='vis-attr-key'>{{attr.name}}</span>
                  {{#if attr.value}}
                    <span class='vis-attr-eq'>=</span>
                    <span class='vis-attr-val'>"{{attr.value}}"</span>
                  {{/if}}
                </li>
              {{/each}}
            </ul>
          {{else}}
            <span class='vis-empty'>None</span>
          {{/if}}
        </div>
      </div>

      <div class='vis-section vis-stack-section'>
        <h3 class='vis-section-title'>
          Element Stack
          <span class='vis-stack-depth'>
            ({{@stack.length}})
          </span>
        </h3>
        {{#if @stack.length}}
          <ul class='vis-stack'>
            {{#each @stack as |entry index|}}
              <li class='vis-stack-entry' style={{indentStyle index}}>
                <span class='vis-stack-tag'>
                  &lt;{{entry.tagName}}&gt;
                </span>
                <span class='vis-stack-children'>
                  {{childSummary entry}}
                </span>
              </li>
            {{/each}}
          </ul>
        {{else}}
          <p class='vis-empty'>Empty — at document root</p>
        {{/if}}
      </div>
    </div>
  </div>
</template>;

export default StatePane;
