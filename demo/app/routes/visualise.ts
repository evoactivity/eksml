import Route from '@ember/routing/route';

const DEFAULT_XML = `\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE books SYSTEM "books.dtd">
<bookstore>
  <book category="fiction">
    <title lang="en">The Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
    <year>1925</year>
    <price>10.99</price>
  </book>
  <book category="non-fiction">
    <title lang="en">Sapiens</title>
    <author>Yuval Noah Harari</author>
  </book>
</bookstore>`;

export interface VisualiseModel {
  defaultXml: string;
}

export default class VisualiseRoute extends Route {
  model(): VisualiseModel {
    return {
      defaultXml: DEFAULT_XML,
    };
  }
}
