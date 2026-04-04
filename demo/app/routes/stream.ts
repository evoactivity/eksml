import Route from '@ember/routing/route';

const DEFAULT_XML = `\
<?xml version="1.0" encoding="UTF-8"?>
<library>
  <section name="Fiction">
    <book isbn="978-0-13-468599-1">
      <title>The Pragmatic Programmer</title>
      <authors>
        <author>David Thomas</author>
        <author>Andrew Hunt</author>
      </authors>
      <year>2019</year>
    </book>
    <book isbn="978-0-596-51774-8">
      <title>JavaScript: The Good Parts</title>
      <authors>
        <author>Douglas Crockford</author>
      </authors>
      <year>2008</year>
    </book>
  </section>
  <section name="Science">
    <book isbn="978-0-553-38016-2">
      <title>A Brief History of Time</title>
      <authors>
        <author>Stephen Hawking</author>
      </authors>
      <year>1988</year>
      <notes><![CDATA[Classic physics & cosmology text]]></notes>
    </book>
  </section>
  <!-- More sections to come -->
</library>`;

export interface StreamModel {
  defaultXml: string;
}

export default class StreamRoute extends Route {
  model(): StreamModel {
    return {
      defaultXml: DEFAULT_XML,
    };
  }
}
