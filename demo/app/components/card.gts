import { LinkTo } from '@ember/routing';

import type { TOC } from '@ember/component/template-only';

interface CardSignature {
  Element: HTMLAnchorElement;
  Args: {
    route: string;
  };
  Blocks: {
    title: [];
    content: [];
    tag: [];
  };
}

const Card: TOC<CardSignature> = <template>
  <LinkTo @route={{@route}} class='card' ...attributes>
    <h2>{{yield to='title'}}</h2>
    <p>{{yield to='content'}}</p>
    {{#if (has-block 'tag')}}
      {{yield to='tag'}}
    {{/if}}
  </LinkTo>
</template>;

export default Card;
