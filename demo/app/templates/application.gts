import { LinkTo } from '@ember/routing';

import pageTitle from 'ember-page-title/helpers/page-title';

<template>
  {{pageTitle 'Eksml Demo'}}
  <div class='page'>
    <nav class='nav'>
      <LinkTo @route='index'>
        <img class='nav-logo' src='/logo-dark.svg' alt='eksml' height='28' />
      </LinkTo>
      <div class='nav-links'>
        <LinkTo @route='parse'>Parse</LinkTo>
        <LinkTo @route='write'>Write</LinkTo>
        <LinkTo @route='sax'>SAX Parser</LinkTo>
        <LinkTo @route='stream'>Stream</LinkTo>
        <LinkTo @route='benchmark'>Benchmark</LinkTo>
      </div>
    </nav>

    <div class='page-content'>
      {{outlet}}
    </div>
  </div>
</template>
