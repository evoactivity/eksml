/**
 * Option combination snapshot tests.
 *
 * Uses the `combinations` npm package to generate every possible subset of
 * boolean options, then runs `parse`, `lossy`, and `lossless` against a set
 * of representative XML/HTML inputs for each combination. Results are
 * snapshot-tested so any behavioural change is immediately visible.
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — no type declarations for this package
import combinations from 'combinations';
import { parse, type ParseOptions } from '#src/parser.ts';
import { lossy, type LossyOptions } from '#src/converters/lossy.ts';
import { lossless, type LosslessOptions } from '#src/converters/lossless.ts';

// ---------------------------------------------------------------------------
// Option generation
// ---------------------------------------------------------------------------

/** The boolean option names shared by parse, lossy, and lossless. */
const OPTION_NAMES = [
  'html',
  'keepComments',
  'trimWhitespace',
  'strict',
  'entities',
] as const;

type OptionName = (typeof OPTION_NAMES)[number];

/** All subsets of options (including the empty set). */
const allSubsets: OptionName[][] = [
  [], // no options — the baseline
  ...combinations(OPTION_NAMES as unknown as OptionName[]),
];

/** Build an options object from a subset of option names. */
function buildOptions(
  subset: OptionName[],
): ParseOptions & LossyOptions & LosslessOptions {
  const opts: Record<string, boolean> = {};
  for (const name of subset) opts[name] = true;
  return opts;
}

/** Human-readable label for a subset. */
function label(subset: OptionName[]): string {
  return subset.length === 0 ? '(defaults)' : subset.join(', ');
}

// ---------------------------------------------------------------------------
// Test inputs
// ---------------------------------------------------------------------------

/**
 * Each input exercises a different combination of features:
 * - entities, comments, CDATA, whitespace, attributes, nesting, void elements
 */
const inputs: {
  name: string;
  xml: string;
  wellFormed: boolean;
  /** When true, this input is only well-formed with `html: true`. */
  requiresHtml?: boolean;
}[] = [
  {
    name: 'basic elements with entities',
    xml: `<root><name>foo&amp;bar</name><value attr="a&lt;b">text</value></root>`,
    wellFormed: true,
  },
  {
    name: 'comments and whitespace',
    xml: `<root>
  <!-- a comment -->
  <child>  spaced  </child>
  <!-- another -->
</root>`,
    wellFormed: true,
  },
  {
    name: 'mixed content with entities',
    xml: `<p>Hello &lt;world&gt; <b>bold &amp; beautiful</b> end</p>`,
    wellFormed: true,
  },
  {
    name: 'CDATA and entities',
    xml: `<root><![CDATA[raw &amp; content]]> and &amp; decoded</root>`,
    wellFormed: true,
  },
  {
    name: 'attributes with character references',
    xml: `<item id="&#x41;&#66;" label="caf&#xe9;">text</item>`,
    wellFormed: true,
  },
  {
    name: 'HTML void elements and entities',
    xml: `<div><br><img src="a&amp;b"><hr><p>text &copy; 2024</p></div>`,
    wellFormed: true,
    /** Only well-formed when html mode is on (br/img/hr are void elements). */
    requiresHtml: true,
  },
  {
    name: 'nested with multiple features',
    xml: `<doc>
  <!-- header -->
  <header title="a&amp;b">
    <![CDATA[raw]]>
    <meta/>
    text &lt; here
  </header>
</doc>`,
    wellFormed: true,
  },
  {
    name: 'empty and self-closing',
    xml: `<root><empty/><also></also><void/></root>`,
    wellFormed: true,
  },
  {
    name: 'unclosed tag (malformed)',
    xml: `<root><child>text`,
    wellFormed: false,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('option combinations', () => {
  for (const subset of allSubsets) {
    const opts = buildOptions(subset);
    const optLabel = label(subset);
    const isStrict = subset.includes('strict');

    describe(optLabel, () => {
      for (const input of inputs) {
        // Inputs with requiresHtml throw without html mode
        const htmlRequired = input.requiresHtml && !subset.includes('html');
        const shouldThrow = (isStrict && !input.wellFormed) || htmlRequired;

        describe(input.name, () => {
          if (shouldThrow) {
            it('parse throws', () => {
              expect(() => parse(input.xml, opts)).toThrow();
            });

            it('lossy throws', () => {
              expect(() => lossy(input.xml, opts)).toThrow();
            });

            it('lossless throws', () => {
              expect(() => lossless(input.xml, opts)).toThrow();
            });
          } else {
            it('parse', () => {
              expect(parse(input.xml, opts)).toMatchSnapshot();
            });

            it('lossy', () => {
              expect(lossy(input.xml, opts)).toMatchSnapshot();
            });

            it('lossless', () => {
              expect(lossless(input.xml, opts)).toMatchSnapshot();
            });
          }
        });
      }
    });
  }
});
