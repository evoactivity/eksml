import Route from '@ember/routing/route';

export interface Sample {
  label: string;
  dom: string;
  lossy: string;
  lossless: string;
}

const SAMPLES: Sample[] = [
  {
    label: 'Bookstore',
    dom: JSON.stringify(
      [
        {
          tagName: '?xml',
          attributes: { version: '1.0', encoding: 'UTF-8' },
          children: [],
        },
        {
          tagName: 'bookstore',
          attributes: null,
          children: [
            {
              tagName: 'book',
              attributes: { category: 'fiction' },
              children: [
                {
                  tagName: 'title',
                  attributes: { lang: 'en' },
                  children: ['The Great Gatsby'],
                },
                {
                  tagName: 'author',
                  attributes: null,
                  children: ['F. Scott Fitzgerald'],
                },
                {
                  tagName: 'year',
                  attributes: null,
                  children: ['1925'],
                },
                {
                  tagName: 'price',
                  attributes: null,
                  children: ['10.99'],
                },
              ],
            },
            {
              tagName: 'book',
              attributes: { category: 'non-fiction' },
              children: [
                {
                  tagName: 'title',
                  attributes: { lang: 'en' },
                  children: ['Sapiens'],
                },
                {
                  tagName: 'author',
                  attributes: null,
                  children: ['Yuval Noah Harari'],
                },
                {
                  tagName: 'year',
                  attributes: null,
                  children: ['2011'],
                },
                {
                  tagName: 'price',
                  attributes: null,
                  children: ['14.99'],
                },
              ],
            },
          ],
        },
      ],
      null,
      2,
    ),
    lossy: JSON.stringify(
      {
        '?xml': { $version: '1.0', $encoding: 'UTF-8' },
        bookstore: {
          book: [
            {
              $category: 'fiction',
              title: { $lang: 'en', $$: ['The Great Gatsby'] },
              author: 'F. Scott Fitzgerald',
              year: '1925',
              price: '10.99',
            },
            {
              $category: 'non-fiction',
              title: { $lang: 'en', $$: ['Sapiens'] },
              author: 'Yuval Noah Harari',
              year: '2011',
              price: '14.99',
            },
          ],
        },
      },
      null,
      2,
    ),
    lossless: JSON.stringify(
      [
        {
          '?xml': [{ $attr: { version: '1.0', encoding: 'UTF-8' } }],
        },
        {
          bookstore: [
            {
              book: [
                { $attr: { category: 'fiction' } },
                {
                  title: [
                    { $attr: { lang: 'en' } },
                    { $text: 'The Great Gatsby' },
                  ],
                },
                { author: [{ $text: 'F. Scott Fitzgerald' }] },
                { year: [{ $text: '1925' }] },
                { price: [{ $text: '10.99' }] },
              ],
            },
            {
              book: [
                { $attr: { category: 'non-fiction' } },
                { title: [{ $attr: { lang: 'en' } }, { $text: 'Sapiens' }] },
                { author: [{ $text: 'Yuval Noah Harari' }] },
                { year: [{ $text: '2011' }] },
                { price: [{ $text: '14.99' }] },
              ],
            },
          ],
        },
      ],
      null,
      2,
    ),
  },
  {
    label: 'HTML Fragment',
    dom: JSON.stringify(
      [
        {
          tagName: '!DOCTYPE',
          attributes: { html: null },
          children: [],
        },
        {
          tagName: 'html',
          attributes: { lang: 'en' },
          children: [
            {
              tagName: 'head',
              attributes: null,
              children: [
                {
                  tagName: 'meta',
                  attributes: { charset: 'UTF-8' },
                  children: [],
                },
                {
                  tagName: 'title',
                  attributes: null,
                  children: ['Hello World'],
                },
              ],
            },
            {
              tagName: 'body',
              attributes: null,
              children: [
                {
                  tagName: 'h1',
                  attributes: null,
                  children: ['Hello World'],
                },
                {
                  tagName: 'p',
                  attributes: null,
                  children: [
                    'This is a ',
                    {
                      tagName: 'strong',
                      attributes: null,
                      children: ['simple'],
                    },
                    ' page.',
                  ],
                },
                { tagName: 'br', attributes: null, children: [] },
                {
                  tagName: 'img',
                  attributes: { src: 'photo.jpg', alt: 'A photo' },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
      null,
      2,
    ),
    lossy: JSON.stringify(
      {
        '!DOCTYPE': { $html: null },
        html: {
          $lang: 'en',
          head: {
            meta: { $charset: 'UTF-8' },
            title: 'Hello World',
          },
          body: {
            h1: 'Hello World',
            p: {
              $$: ['This is a ', { strong: 'simple' }, ' page.'],
            },
            br: {},
            img: { $src: 'photo.jpg', $alt: 'A photo' },
          },
        },
      },
      null,
      2,
    ),
    lossless: JSON.stringify(
      [
        {
          '!DOCTYPE': [{ $attr: { html: null } }],
        },
        {
          html: [
            { $attr: { lang: 'en' } },
            {
              head: [
                { meta: [{ $attr: { charset: 'UTF-8' } }] },
                { title: [{ $text: 'Hello World' }] },
              ],
            },
            {
              body: [
                { h1: [{ $text: 'Hello World' }] },
                {
                  p: [
                    { $text: 'This is a ' },
                    { strong: [{ $text: 'simple' }] },
                    { $text: ' page.' },
                  ],
                },
                { br: [] },
                { img: [{ $attr: { src: 'photo.jpg', alt: 'A photo' } }] },
              ],
            },
          ],
        },
      ],
      null,
      2,
    ),
  },
  {
    label: 'Entities',
    dom: JSON.stringify(
      [
        {
          tagName: 'article',
          attributes: { id: 'intro' },
          children: [
            {
              tagName: 'p',
              attributes: null,
              children: ['Tom & Jerry say "hello" — price is < $5 & > $2'],
            },
            {
              tagName: 'code',
              attributes: null,
              children: ['if (a < b && c > d) { return "it\'s done"; }'],
            },
            {
              tagName: 'data',
              attributes: { value: "O'Reilly & Associates" },
              children: ['© 2024 — "All rights reserved"'],
            },
            {
              tagName: 'math',
              attributes: null,
              children: ['x² + y² < z² → a & b | c'],
            },
          ],
        },
      ],
      null,
      2,
    ),
    lossy: JSON.stringify(
      {
        article: {
          $id: 'intro',
          p: 'Tom & Jerry say "hello" — price is < $5 & > $2',
          code: 'if (a < b && c > d) { return "it\'s done"; }',
          data: {
            $value: "O'Reilly & Associates",
            $$: ['© 2024 — "All rights reserved"'],
          },
          math: 'x² + y² < z² → a & b | c',
        },
      },
      null,
      2,
    ),
    lossless: JSON.stringify(
      [
        {
          article: [
            { $attr: { id: 'intro' } },
            {
              p: [
                {
                  $text: 'Tom & Jerry say "hello" — price is < $5 & > $2',
                },
              ],
            },
            {
              code: [
                {
                  $text: 'if (a < b && c > d) { return "it\'s done"; }',
                },
              ],
            },
            {
              data: [
                { $attr: { value: "O'Reilly & Associates" } },
                { $text: '© 2024 — "All rights reserved"' },
              ],
            },
            {
              math: [{ $text: 'x² + y² < z² → a & b | c' }],
            },
          ],
        },
      ],
      null,
      2,
    ),
  },
  {
    label: 'Lossy vs Lossless',
    dom: JSON.stringify(
      [
        {
          tagName: 'order',
          attributes: { id: 'ORD-42' },
          children: [
            {
              tagName: 'add',
              attributes: { sku: 'A1' },
              children: ['Widget'],
            },
            {
              tagName: 'add',
              attributes: { sku: 'B2' },
              children: ['Gadget'],
            },
            {
              tagName: 'remove',
              attributes: { sku: 'A1' },
              children: ['Widget'],
            },
            {
              tagName: 'note',
              attributes: null,
              children: ['Customer changed mind'],
            },
            {
              tagName: 'add',
              attributes: { sku: 'C3' },
              children: ['Doohickey'],
            },
            {
              tagName: 'total',
              attributes: { currency: 'USD' },
              children: ['59.98'],
            },
          ],
        },
      ],
      null,
      2,
    ),
    lossy: JSON.stringify(
      {
        order: {
          $id: 'ORD-42',
          add: [
            { $sku: 'A1', $$: ['Widget'] },
            { $sku: 'B2', $$: ['Gadget'] },
            { $sku: 'C3', $$: ['Doohickey'] },
          ],
          remove: { $sku: 'A1', $$: ['Widget'] },
          note: 'Customer changed mind',
          total: { $currency: 'USD', $$: ['59.98'] },
        },
      },
      null,
      2,
    ),
    lossless: JSON.stringify(
      [
        {
          order: [
            { $attr: { id: 'ORD-42' } },
            { add: [{ $attr: { sku: 'A1' } }, { $text: 'Widget' }] },
            { add: [{ $attr: { sku: 'B2' } }, { $text: 'Gadget' }] },
            { remove: [{ $attr: { sku: 'A1' } }, { $text: 'Widget' }] },
            { note: [{ $text: 'Customer changed mind' }] },
            { add: [{ $attr: { sku: 'C3' } }, { $text: 'Doohickey' }] },
            { total: [{ $attr: { currency: 'USD' } }, { $text: '59.98' }] },
          ],
        },
      ],
      null,
      2,
    ),
  },
];

export interface WriterModel {
  samples: Sample[];
}

export default class WriterRoute extends Route {
  model(): WriterModel {
    return {
      samples: SAMPLES,
    };
  }
}
