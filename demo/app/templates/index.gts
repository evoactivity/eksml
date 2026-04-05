import { htmlSafe } from '@ember/template';

import pageTitle from 'ember-page-title/helpers/page-title';

import logoDark from '/logo-dark.svg?url';
import Card from '#components/card.gts';

<template>
  {{pageTitle 'Home'}}
  <div class='landing'>
    <div class='logo-container'>
      <img class='logo' src={{logoDark}} alt='eksml' height='56' />
      <p class='subtitle'>Interactive examples for the eksml XML parser</p>
    </div>

    <div class='cards'>
      <Card @route='parse'>
        <:title>Parse</:title>
        <:content>
          Enter XML and see it parsed in real time. Switch between DOM
          (TNode[]), lossy, and lossless output modes.
        </:content>
        <:tag><span class='tag tag-parse'>parse / lossy / lossless</span></:tag>
      </Card>

      <Card @route='write'>
        <:title>Write</:title>
        <:content>
          Enter JSON (DOM, lossy, or lossless) and serialize it back to XML.
          Toggle pretty-print, entity encoding, and HTML mode.
        </:content>
        <:tag><span class='tag tag-write'>write / fromLossy / fromLossless</span></:tag>
      </Card>

      <Card @route='sax'>
        <:title>SAX Parser</:title>
        <:content>
          Feed XML to the SAX parser chunk-by-chunk. Watch opentag, closetag,
          text, CDATA, and comment events stream in with configurable throttle
          and chunk size.
        </:content>
        <:tag><span class='tag tag-stream'>createSaxParser</span></:tag>
      </Card>

      <Card @route='stream'>
        <:title>Stream</:title>
        <:content>
          Pipe XML through an XmlParseStream. Complete TNode subtrees are
          emitted as each top-level element closes. Click nodes to expand their
          full JSON.
        </:content>
        <:tag><span class='tag tag-stream'>XmlParseStream</span></:tag>
      </Card>

      <Card @route='benchmark' style='{{htmlSafe "grid-column: 1 / span 2;"}}'>
        <:title>Benchmark</:title>
        <:content>
          Compare synchronous XML parsing performance across multiple libraries.
          Each parser runs in a web worker for a fixed duration.
        </:content>
        <:tag><span class='tag tag-bench'>benchmark</span></:tag>
      </Card>
    </div>
  </div>
</template>
