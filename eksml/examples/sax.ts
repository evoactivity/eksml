import { createSaxParser } from 'eksml/sax';

const xml = `
<catalog>
  <product id="p1">
    <name>Widget</name>
    <price>9.99</price>
  </product>
  <product id="p2">
    <name>Gadget</name>
    <price>24.99</price>
  </product>
</catalog>
`;

const parser = createSaxParser();

// Subscribe to events
parser.on('openTag', (tagName, attrs) => {
  console.log(`Open: <${tagName}>`, attrs);
});

parser.on('closeTag', (tagName) => {
  console.log(`Close: </${tagName}>`);
});

parser.on('text', (text) => {
  const trimmed = text.trim();
  if (trimmed) console.log(`Text: "${trimmed}"`);
});

// Feed XML to the parser
parser.write(xml);
parser.close();
