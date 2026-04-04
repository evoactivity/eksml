import type { TOC } from '@ember/component/template-only';

interface TwoPaneLayoutSignature {
  Blocks: {
    left: [];
    right: [];
  };
}

const TwoPaneLayout: TOC<TwoPaneLayoutSignature> = <template>
  <div class='panes'>
    <div class='pane'>
      {{yield to='left'}}
    </div>
    <div class='pane'>
      {{yield to='right'}}
    </div>
  </div>
</template>;

export default TwoPaneLayout;
