import Component from '@glimmer/component';
import { LinkTo } from '@ember/routing';
import { service } from '@ember/service';

import pageTitle from 'ember-page-title/helpers/page-title';

import logoDark from '/logo-dark.svg?url';

import type RouterService from '@ember/routing/router-service';

export default class ApplicationTemplate extends Component {
  @service declare router: RouterService;

  get shouldShowNav(): boolean {
    return this.router.currentRouteName !== 'index';
  }
  <template>
    {{pageTitle 'Eksml Demo'}}
    <div class='page'>
      {{#if this.shouldShowNav}}
        <nav class='nav'>
          <LinkTo @route='index'>
            <img class='nav-logo' src={{logoDark}} alt='eksml' height='28' />
          </LinkTo>
          <div class='nav-links'>
            <LinkTo @route='parse'>Parse</LinkTo>
            <LinkTo @route='write'>Write</LinkTo>
            <LinkTo @route='sax'>SAX Parser</LinkTo>
            <LinkTo @route='stream'>Stream</LinkTo>
            <LinkTo @route='benchmark'>Benchmark</LinkTo>
          </div>
        </nav>
      {{/if}}

      <div class='page-content'>
        {{outlet}}
      </div>
    </div>
  </template>
}
