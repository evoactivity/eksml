import Route from '@ember/routing/route';

const DEFAULT_XML = `\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE catalog SYSTEM "catalog.dtd">
<catalog>
  <product id="p1" category="electronics">
    <name>Wireless Mouse</name>
    <description><![CDATA[A smooth & responsive <wireless> mouse]]></description>
    <price currency="USD">29.99</price>
    <specs>
      <weight unit="g">85</weight>
      <battery>AA</battery>
      <connectivity>2.4GHz</connectivity>
    </specs>
    <tags>
      <tag>peripheral</tag>
      <tag>wireless</tag>
      <tag>ergonomic</tag>
    </tags>
  </product>
  <product id="p2" category="accessories">
    <name>USB-C Hub</name>
    <description>Multi-port adapter with HDMI &amp; USB 3.0</description>
    <price currency="USD">49.99</price>
    <specs>
      <ports>7</ports>
      <weight unit="g">120</weight>
    </specs>
    <!-- Popular item -->
    <tags>
      <tag>adapter</tag>
      <tag>usb-c</tag>
    </tags>
  </product>
  <product id="p3" category="electronics">
    <name>Mechanical Keyboard</name>
    <description>Cherry MX Blue switches, full RGB</description>
    <price currency="EUR">89.00</price>
    <specs>
      <switches>Cherry MX Blue</switches>
      <layout>TKL</layout>
      <weight unit="g">750</weight>
    </specs>
    <tags>
      <tag>keyboard</tag>
      <tag>mechanical</tag>
      <tag>rgb</tag>
    </tags>
  </product>
</catalog>`;

export interface SaxModel {
  defaultXml: string;
}

export default class SaxRoute extends Route {
  model(): SaxModel {
    return {
      defaultXml: DEFAULT_XML,
    };
  }
}
