import Component from '@glimmer/component';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';

interface Tab {
  label: string;
  size?: string;
}

interface TabStripSignature {
  Args: {
    tabs: Tab[];
    activeIndex: number;
    onSelect: (index: number) => void;
  };
}

export default class TabStrip extends Component<TabStripSignature> {
  <template>
    <div class='tabs'>
      {{#each @tabs as |tab index|}}
        <button
          type='button'
          class='tab {{if (this.isActive index) "active"}}'
          {{on 'click' (fn @onSelect index)}}
        >
          {{tab.label}}
          {{#if tab.size}}
            <span class='size'>{{tab.size}}</span>
          {{/if}}
        </button>
      {{/each}}
    </div>
  </template>

  isActive = (index: number): boolean => {
    return index === this.args.activeIndex;
  };
}
