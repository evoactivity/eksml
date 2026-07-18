import pageTitle from 'ember-page-title/helpers/page-title';

import logoDark from '/logo-dark.svg?url';
import Card from '#components/card.gts';

<template>
  {{pageTitle 'Home'}}
  <div class='landing'>
    <div class='logo-container'>
      <img class='logo' src={{logoDark}} alt='eksml' height='56' />
      <p class='subtitle'>Interactive examples for the eksml XML parser</p>
      <a
        class='github-link'
        href='https://github.com/evoactivity/eksml'
        target='_blank'
        rel='noopener noreferrer'
      >
        <svg
          viewBox='0 0 16 16'
          width='16'
          height='16'
          fill='currentColor'
          aria-hidden='true'
        >
          <path
            d='M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z'
          />
        </svg>
        View on GitHub
      </a>
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

      <Card @route='visualise'>
        <:title>Visualise</:title>
        <:content>
          Step through the XML parser algorithm character by character. Watch
          the element stack grow and shrink as tags open and close.
        </:content>
        <:tag><span class='tag tag-vis'>parser-stepper</span></:tag>
      </Card>

      <Card @route='benchmark'>
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
