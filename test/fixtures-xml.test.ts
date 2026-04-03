import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parse, filter, toContentString, type TNode } from "../src/parser.js";
import { writer } from "../src/writer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "fixtures", name), "utf-8");

const rssFeed = fixture("rss-feed.xml");
const soapEnvelope = fixture("soap-envelope.xml");
const atomFeed = fixture("atom-feed.xml");
const pomXml = fixture("pom.xml");

// =================================================================
// Complex fixture tests — RSS feed
// =================================================================
describe("fixture: rss-feed.xml", () => {
  it("parses without error", () => {
    const result = parse(rssFeed);
    expect(result.length).toBeGreaterThan(0);
  });

  it("finds the rss root with version attribute", () => {
    const result = parse(rssFeed);
    const rss = result.find(
      (n) => typeof n === "object" && n.tagName === "rss",
    ) as TNode;
    expect(rss).toBeDefined();
    expect(rss.attributes!.version).toBe("2.0");
    expect(rss.attributes!["xmlns:atom"]).toBe("http://www.w3.org/2005/Atom");
    expect(rss.attributes!["xmlns:dc"]).toBe("http://purl.org/dc/elements/1.1/");
  });

  it("extracts all three items", () => {
    const result = parse(rssFeed);
    const items = filter(result, (n) => n.tagName === "item");
    expect(items).toHaveLength(3);
  });

  it("extracts CDATA content in description", () => {
    const result = parse(rssFeed);
    const items = filter(result, (n) => n.tagName === "item");
    const desc = items[0]!.children.find(
      (c) => typeof c === "object" && c.tagName === "description",
    ) as TNode;
    expect(desc).toBeDefined();
    // CDATA content should be extracted as a text child
    const text = desc.children[0] as string;
    expect(text).toContain("<p>");
    expect(text).toContain("<strong>migrated</strong>");
  });

  it("handles ampersand in dc:creator", () => {
    const result = parse(rssFeed);
    const creators = filter(result, (n) => n.tagName === "dc:creator");
    const bobCarol = creators.find((c) =>
      (c.children[0] as string).includes("Bob"),
    );
    expect(bobCarol).toBeDefined();
    // &amp; is raw in XML, parser should preserve it as-is or decode
    expect(bobCarol!.children[0]).toContain("&");
  });

  it("finds multiple category elements per item", () => {
    const result = parse(rssFeed);
    const items = filter(result, (n) => n.tagName === "item");
    const firstItemCategories = items[0]!.children.filter(
      (c) => typeof c === "object" && c.tagName === "category",
    ) as TNode[];
    expect(firstItemCategories).toHaveLength(3);
    expect(firstItemCategories.map((c) => c.children[0])).toEqual([
      "Streams",
      "JavaScript",
      "Performance",
    ]);
  });

  it("roundtrips via writer then re-parse", () => {
    const result = parse(rssFeed, { trimWhitespace: true });
    const xml = writer(result);
    const reparsed = parse(xml, { trimWhitespace: true });
    // Same number of top-level nodes
    expect(reparsed.length).toBe(result.length);
    // Same number of items
    const originalItems = filter(result, (n) => n.tagName === "item");
    const reparsedItems = filter(reparsed, (n) => n.tagName === "item");
    expect(reparsedItems).toHaveLength(originalItems.length);
  });

  it("extracts text content from the entire feed", () => {
    const result = parse(rssFeed);
    const content = toContentString(result);
    expect(content).toContain("Tech Engineering Blog");
    expect(content).toContain("Migrating to Web Streams");
    expect(content).toContain("XML Parsing at Scale");
  });

  it("self-closing atom:link is parsed correctly", () => {
    const result = parse(rssFeed);
    const atomLinks = filter(result, (n) => n.tagName === "atom:link");
    expect(atomLinks.length).toBeGreaterThanOrEqual(1);
    expect(atomLinks[0]!.attributes!.rel).toBe("self");
    expect(atomLinks[0]!.attributes!.type).toBe("application/rss+xml");
  });
});

// =================================================================
// Complex fixture tests — SOAP envelope
// =================================================================
describe("fixture: soap-envelope.xml", () => {
  it("parses without error", () => {
    const result = parse(soapEnvelope);
    expect(result.length).toBeGreaterThan(0);
  });

  it("finds the soap:Envelope root with multiple namespace declarations", () => {
    const result = parse(soapEnvelope);
    const envelope = result.find(
      (n) => typeof n === "object" && n.tagName === "soap:Envelope",
    ) as TNode;
    expect(envelope).toBeDefined();
    expect(envelope.attributes!["xmlns:soap"]).toBe(
      "http://schemas.xmlsoap.org/soap/envelope/",
    );
    expect(envelope.attributes!["xmlns:wsse"]).toContain("wss-wssecurity");
    expect(envelope.attributes!["xmlns:ds"]).toBe(
      "http://www.w3.org/2000/09/xmldsig#",
    );
  });

  it("finds soap:Header and soap:Body", () => {
    const result = parse(soapEnvelope);
    const envelope = result.find(
      (n) => typeof n === "object" && n.tagName === "soap:Envelope",
    ) as TNode;
    const header = envelope.children.find(
      (c) => typeof c === "object" && c.tagName === "soap:Header",
    ) as TNode;
    const body = envelope.children.find(
      (c) => typeof c === "object" && c.tagName === "soap:Body",
    ) as TNode;
    expect(header).toBeDefined();
    expect(body).toBeDefined();
    expect(body.attributes!["wsu:Id"]).toBe("Body-1");
  });

  it("drills into deeply nested WS-Security elements", () => {
    const result = parse(soapEnvelope);
    const security = filter(result, (n) => n.tagName === "wsse:Security");
    expect(security).toHaveLength(1);
    expect(security[0]!.attributes!["soap:mustUnderstand"]).toBe("1");

    const timestamps = filter(result, (n) => n.tagName === "wsu:Timestamp");
    expect(timestamps).toHaveLength(1);
    expect(timestamps[0]!.attributes!["wsu:Id"]).toBe("TS-1");
  });

  it("finds ds:Reference elements with URI attributes", () => {
    const result = parse(soapEnvelope);
    const refs = filter(result, (n) => n.tagName === "ds:Reference");
    expect(refs).toHaveLength(2);
    const uris = refs.map((r) => r.attributes!.URI);
    expect(uris).toContain("#TS-1");
    expect(uris).toContain("#Body-1");
  });

  it("finds self-closing elements with Algorithm attributes", () => {
    const result = parse(soapEnvelope);
    const methods = filter(
      result,
      (n) =>
        n.tagName === "ds:CanonicalizationMethod" ||
        n.tagName === "ds:SignatureMethod" ||
        n.tagName === "ds:DigestMethod" ||
        n.tagName === "ds:Transform",
    );
    expect(methods.length).toBeGreaterThanOrEqual(5);
    for (const m of methods) {
      expect(m.attributes!.Algorithm).toBeDefined();
      expect(m.children).toEqual([]);
    }
  });

  it("finds the request body with nested filter elements", () => {
    const result = parse(soapEnvelope);
    const request = filter(
      result,
      (n) => n.tagName === "GetOrderDetailsRequest",
    );
    expect(request).toHaveLength(1);
    const statuses = filter(
      request[0]!.children,
      (n) => n.tagName === "Status",
    );
    expect(statuses).toHaveLength(3);
    expect(statuses.map((s) => s.children[0])).toEqual([
      "CONFIRMED",
      "SHIPPED",
      "DELIVERED",
    ]);
  });

  it("preserves comments with keepComments", () => {
    const result = parse(soapEnvelope, { keepComments: true });
    const allText = filter(result, () => false); // just to walk the tree
    // Check that the comment is a string child somewhere
    const envelope = result.find(
      (n) => typeof n === "object" && n.tagName === "soap:Envelope",
    ) as TNode;
    const header = envelope.children.find(
      (c) => typeof c === "object" && c.tagName === "soap:Header",
    ) as TNode;
    const commentChild = header.children.find(
      (c) => typeof c === "string" && c.includes("Correlation ID"),
    );
    expect(commentChild).toBeDefined();
  });
});

// =================================================================
// Complex fixture tests — Atom feed
// =================================================================
describe("fixture: atom-feed.xml", () => {
  it("parses without error", () => {
    const result = parse(atomFeed);
    expect(result.length).toBeGreaterThan(0);
  });

  it("finds the feed root with multiple namespace attributes", () => {
    const result = parse(atomFeed);
    const feed = result.find(
      (n) => typeof n === "object" && n.tagName === "feed",
    ) as TNode;
    expect(feed).toBeDefined();
    expect(feed.attributes!.xmlns).toBe("http://www.w3.org/2005/Atom");
    expect(feed.attributes!["xmlns:media"]).toBe(
      "http://search.yahoo.com/mrss/",
    );
    expect(feed.attributes!["xmlns:georss"]).toBe(
      "http://www.georss.org/georss",
    );
    expect(feed.attributes!["xml:lang"]).toBe("en");
  });

  it("extracts all three entries", () => {
    const result = parse(atomFeed);
    const entries = filter(result, (n) => n.tagName === "entry");
    expect(entries).toHaveLength(3);
  });

  it("finds multiple link elements with different rel attributes", () => {
    const result = parse(atomFeed);
    const feed = result.find(
      (n) => typeof n === "object" && n.tagName === "feed",
    ) as TNode;
    const links = feed.children.filter(
      (c) => typeof c === "object" && c.tagName === "link",
    ) as TNode[];
    expect(links.length).toBeGreaterThanOrEqual(4);
    const rels = links.map((l) => l.attributes!.rel);
    expect(rels).toContain("alternate");
    expect(rels).toContain("self");
    expect(rels).toContain("next");
    expect(rels).toContain("hub");
  });

  it("parses XHTML content blocks within entries", () => {
    const result = parse(atomFeed);
    const entries = filter(result, (n) => n.tagName === "entry");
    const tsEntry = entries[0]!;
    const contentEl = tsEntry.children.find(
      (c) => typeof c === "object" && c.tagName === "content",
    ) as TNode;
    expect(contentEl).toBeDefined();
    expect(contentEl.attributes!.type).toBe("xhtml");
    // Should contain a div child with XHTML namespace
    const div = contentEl.children.find(
      (c) => typeof c === "object" && c.tagName === "div",
    ) as TNode;
    expect(div).toBeDefined();
    expect(div.attributes!.xmlns).toBe("http://www.w3.org/1999/xhtml");
  });

  it("finds media:group and georss elements", () => {
    const result = parse(atomFeed);
    const mediaGroups = filter(result, (n) => n.tagName === "media:group");
    expect(mediaGroups).toHaveLength(1);
    const mediaContent = filter(result, (n) => n.tagName === "media:content");
    expect(mediaContent).toHaveLength(1);
    expect(mediaContent[0]!.attributes!.type).toBe("image/png");

    const georssPoints = filter(result, (n) => n.tagName === "georss:point");
    expect(georssPoints.length).toBeGreaterThanOrEqual(1);

    const gmlPoints = filter(result, (n) => n.tagName === "gml:Point");
    expect(gmlPoints).toHaveLength(1);
  });

  it("handles HTML entities in subtitle", () => {
    const result = parse(atomFeed);
    const subtitles = filter(result, (n) => n.tagName === "subtitle");
    expect(subtitles).toHaveLength(1);
    expect(subtitles[0]!.attributes!.type).toBe("html");
  });

  it("parses entry with HTML-encoded content (Node.js 24 entry)", () => {
    const result = parse(atomFeed);
    const entries = filter(result, (n) => n.tagName === "entry");
    const nodeEntry = entries[2]!;
    const contentEl = nodeEntry.children.find(
      (c) => typeof c === "object" && c.tagName === "content",
    ) as TNode;
    expect(contentEl).toBeDefined();
    expect(contentEl.attributes!.type).toBe("html");
    // HTML-encoded content should be a text child
    const text = contentEl.children[0] as string;
    expect(text).toContain("Node.js 24 LTS");
  });
});

// =================================================================
// Complex fixture tests — Maven POM
// =================================================================
describe("fixture: pom.xml", () => {
  it("parses without error", () => {
    const result = parse(pomXml);
    expect(result.length).toBeGreaterThan(0);
  });

  it("finds the project root with Maven namespace", () => {
    const result = parse(pomXml);
    const project = result.find(
      (n) => typeof n === "object" && n.tagName === "project",
    ) as TNode;
    expect(project).toBeDefined();
    expect(project.attributes!.xmlns).toBe("http://maven.apache.org/POM/4.0.0");
    expect(project.attributes!["xmlns:xsi"]).toBe(
      "http://www.w3.org/2001/XMLSchema-instance",
    );
  });

  it("extracts GAV coordinates", () => {
    const result = parse(pomXml);
    const project = result.find(
      (n) => typeof n === "object" && n.tagName === "project",
    ) as TNode;
    const groupId = project.children.find(
      (c) => typeof c === "object" && c.tagName === "groupId",
    ) as TNode;
    const artifactId = project.children.find(
      (c) => typeof c === "object" && c.tagName === "artifactId",
    ) as TNode;
    const version = project.children.find(
      (c) => typeof c === "object" && c.tagName === "version",
    ) as TNode;
    expect(groupId.children[0]).toBe("com.example.services");
    expect(artifactId.children[0]).toBe("order-service");
    expect(version.children[0]).toBe("2.8.0-SNAPSHOT");
  });

  it("finds the parent POM reference", () => {
    const result = parse(pomXml);
    const parents = filter(result, (n) => n.tagName === "parent");
    expect(parents).toHaveLength(1);
    const parentChildren = parents[0]!.children.filter(
      (c) => typeof c === "object",
    ) as TNode[];
    const parentGroupId = parentChildren.find((c) => c.tagName === "groupId")!;
    expect(parentGroupId.children[0]).toBe("com.example");
  });

  it("extracts all dependency elements", () => {
    const result = parse(pomXml);
    const allDeps = filter(result, (n) => n.tagName === "dependency");
    // Should have many dependencies (managed + direct + test)
    expect(allDeps.length).toBeGreaterThanOrEqual(20);
  });

  it("finds dependencies by scope", () => {
    const result = parse(pomXml);
    const allDeps = filter(result, (n) => n.tagName === "dependency");
    const testDeps = allDeps.filter((d) => {
      const scope = d.children.find(
        (c) => typeof c === "object" && c.tagName === "scope",
      ) as TNode | undefined;
      return scope && scope.children[0] === "test";
    });
    expect(testDeps.length).toBeGreaterThanOrEqual(4);
  });

  it("finds exclusions in test dependencies", () => {
    const result = parse(pomXml);
    const exclusions = filter(result, (n) => n.tagName === "exclusion");
    expect(exclusions).toHaveLength(1);
    const excludedArtifact = exclusions[0]!.children.find(
      (c) => typeof c === "object" && c.tagName === "artifactId",
    ) as TNode;
    expect(excludedArtifact.children[0]).toBe("junit-vintage-engine");
  });

  it("extracts property values", () => {
    const result = parse(pomXml);
    const props = filter(result, (n) => n.tagName === "properties");
    expect(props).toHaveLength(1);
    const javaVersion = props[0]!.children.find(
      (c) => typeof c === "object" && c.tagName === "java.version",
    ) as TNode;
    expect(javaVersion.children[0]).toBe("21");
    const springBoot = props[0]!.children.find(
      (c) => typeof c === "object" && c.tagName === "spring-boot.version",
    ) as TNode;
    expect(springBoot.children[0]).toBe("3.3.0");
  });

  it("finds build plugins and their configurations", () => {
    const result = parse(pomXml);
    const plugins = filter(result, (n) => n.tagName === "plugin");
    expect(plugins.length).toBeGreaterThanOrEqual(4);

    // Find the compiler plugin
    const compilerPlugin = plugins.find((p) => {
      const aid = p.children.find(
        (c) => typeof c === "object" && c.tagName === "artifactId",
      ) as TNode | undefined;
      return aid && aid.children[0] === "maven-compiler-plugin";
    });
    expect(compilerPlugin).toBeDefined();

    // Check annotationProcessorPaths
    const processorPaths = filter(
      compilerPlugin!.children,
      (n) => n.tagName === "path",
    );
    expect(processorPaths).toHaveLength(3);
  });

  it("finds profiles", () => {
    const result = parse(pomXml);
    const profiles = filter(result, (n) => n.tagName === "profile");
    expect(profiles).toHaveLength(2);
    const profileIds = profiles.map((p) => {
      const id = p.children.find(
        (c) => typeof c === "object" && c.tagName === "id",
      ) as TNode;
      return id.children[0];
    });
    expect(profileIds).toContain("docker");
    expect(profileIds).toContain("integration-test");
  });

  it("finds developers with roles", () => {
    const result = parse(pomXml);
    const developers = filter(result, (n) => n.tagName === "developer");
    expect(developers).toHaveLength(2);

    const alice = developers.find((d) => {
      const id = d.children.find(
        (c) => typeof c === "object" && c.tagName === "id",
      ) as TNode;
      return id && id.children[0] === "alice";
    });
    expect(alice).toBeDefined();
    const roles = filter(alice!.children, (n) => n.tagName === "role");
    expect(roles).toHaveLength(2);
    expect(roles[0]!.children[0]).toBe("Lead Developer");
  });

  it("preserves comments about dependency sections", () => {
    const result = parse(pomXml, { keepComments: true });
    const allComments: string[] = [];
    function collectComments(nodes: (TNode | string)[]) {
      for (const node of nodes) {
        if (typeof node === "string" && node.startsWith("<!--")) {
          allComments.push(node);
        } else if (typeof node === "object") {
          collectComments(node.children);
        }
      }
    }
    collectComments(result);
    expect(allComments.length).toBeGreaterThanOrEqual(5);
    expect(allComments.some((c) => c.includes("Spring Boot Starters"))).toBe(
      true,
    );
    expect(allComments.some((c) => c.includes("Database"))).toBe(true);
    expect(allComments.some((c) => c.includes("Testing"))).toBe(true);
  });

  it("roundtrips via writer", () => {
    const result = parse(pomXml);
    const xml = writer(result);
    const reparsed = parse(xml);
    // Same number of dependencies
    const origDeps = filter(result, (n) => n.tagName === "dependency");
    const reparsedDeps = filter(reparsed, (n) => n.tagName === "dependency");
    expect(reparsedDeps).toHaveLength(origDeps.length);
  });
});
