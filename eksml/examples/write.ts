import { parse } from 'eksml/parser';
import { write } from 'eksml/writer';

const xml =
  '<root><item id="1"><name>First</name></item><item id="2"><name>Second</name></item></root>';

// Parse then re-serialize with pretty printing
const dom = parse(xml);
const pretty = write(dom, { pretty: true });
console.log('Pretty printed:\n' + pretty);

// Write with HTML mode and entity encoding
const html = '<div class="greeting"><p>Hello & welcome</p></div>';
const htmlDom = parse(html, { html: true });
const output = write(htmlDom, { pretty: true, html: true });
console.log('\nHTML output:\n' + output);
