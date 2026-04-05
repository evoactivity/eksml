import { XmlParseStream } from 'eksml/stream';

// Fetch an RSS feed and stream-parse it, emitting each <item> as it arrives
const response = await fetch('https://feeds.bbci.co.uk/news/rss.xml');

const items = response
  .body!.pipeThrough(new TextDecoderStream())
  .pipeThrough(new XmlParseStream({ select: 'item', output: 'lossy' }));

for await (const item of items) {
  console.log(item);
}
