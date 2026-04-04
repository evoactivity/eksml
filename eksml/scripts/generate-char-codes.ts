/**
 * Inlines character code constants into source files.
 *
 * File-local `const` declarations are injected between
 * `// @generated:char-codes:begin` and `// @generated:char-codes:end`
 * markers in each source file that uses them. This avoids cross-module ESM
 * import overhead that prevents V8 from inlining the numeric values as
 * immediates.
 *
 * The script auto-detects which constants each target file uses by scanning
 * the file content outside the generated region.
 *
 * Usage:
 *   npx tsx scripts/generate-char-codes.ts
 *
 * To add a new character code constant:
 *   1. Add an entry to the appropriate section below (or create a new section).
 *   2. Run this script.
 *   3. All inlined regions are updated.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Configuration — add/remove/reorder entries here
// ---------------------------------------------------------------------------

interface CharCodeEntry {
  /** SCREAMING_CASE constant name */
  name: string;
  /** The character whose charCodeAt(0) produces the value */
  character: string;
}

interface CharCodeSection {
  /** Section comment label */
  label: string;
  entries: CharCodeEntry[];
}

const sections: CharCodeSection[] = [
  {
    label: 'Brackets and delimiters',
    entries: [
      { name: 'LT', character: '<' },
      { name: 'GT', character: '>' },
      { name: 'SLASH', character: '/' },
      { name: 'BANG', character: '!' },
      { name: 'QUESTION', character: '?' },
      { name: 'EQ', character: '=' },
      { name: 'LBRACKET', character: '[' },
      { name: 'RBRACKET', character: ']' },
    ],
  },
  {
    label: 'Quotes',
    entries: [
      { name: 'SQUOTE', character: "'" },
      { name: 'DQUOTE', character: '"' },
    ],
  },
  {
    label: 'Whitespace',
    entries: [
      { name: 'TAB', character: '\t' },
      { name: 'LF', character: '\n' },
      { name: 'CR', character: '\r' },
      { name: 'SPACE', character: ' ' },
    ],
  },
  {
    label: 'Punctuation',
    entries: [
      { name: 'DASH', character: '-' },
      { name: 'UNDERSCORE', character: '_' },
      { name: 'COLON', character: ':' },
      { name: 'DOLLAR', character: '$' },
    ],
  },
  {
    label: 'CDATA signature characters: <![CDATA[',
    entries: [
      { name: 'UPPER_C', character: 'C' },
      { name: 'UPPER_D', character: 'D' },
      { name: 'UPPER_A', character: 'A' },
      { name: 'UPPER_T', character: 'T' },
    ],
  },
];

/** Flat list of all entries for convenience. */
const allEntries: CharCodeEntry[] = sections.flatMap(
  (section) => section.entries,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a character as a readable inline comment (e.g. `// <` or `// \t`). */
function formatCharacterComment(character: string): string {
  const escapeMap: Record<string, string> = {
    '\t': '\\t',
    '\n': '\\n',
    '\r': '\\r',
    ' ': '(space)',
  };
  return escapeMap[character] ?? character;
}

const BEGIN_MARKER = '// @generated:char-codes:begin';
const END_MARKER = '// @generated:char-codes:end';

// ---------------------------------------------------------------------------
// Inline constants into source files
// ---------------------------------------------------------------------------

/**
 * Detect which constant names from our flat list are actually used in the
 * given source text (excluding any existing generated region).
 */
function detectUsedConstants(sourceWithoutGenerated: string): CharCodeEntry[] {
  return allEntries.filter((entry) => {
    // Match the constant name as a whole word (not part of another identifier).
    // We look for usage patterns like: `=== LT`, `!== GT`, `SLASH)`, `, BANG`,
    // `case QUESTION:`, etc. A word boundary check via regex is sufficient.
    const pattern = new RegExp(`\\b${entry.name}\\b`);
    return pattern.test(sourceWithoutGenerated);
  });
}

/**
 * Generate the inlined constants block for a source file.
 * These are NOT exported — they are file-local.
 */
function generateInlineBlock(entries: CharCodeEntry[]): string {
  const lines: string[] = [BEGIN_MARKER];
  for (const entry of entries) {
    const code = entry.character.charCodeAt(0);
    const comment = formatCharacterComment(entry.character);
    lines.push(`const ${entry.name} = ${code}; // ${comment}`);
  }
  lines.push(END_MARKER);
  return lines.join('\n');
}

let filesWithMarkers = 0;

/**
 * Process a single source file:
 * - If it has begin/end markers, replace the region between them.
 * - If it has no markers, skip it (we'll add markers manually first).
 *
 * Returns true if the file was modified.
 */
function inlineIntoFile(filePath: string): boolean {
  const original = readFileSync(filePath, 'utf-8');

  const beginIndex = original.indexOf(BEGIN_MARKER);
  const endIndex = original.indexOf(END_MARKER);

  if (beginIndex === -1 || endIndex === -1) {
    // No markers — skip this file
    return false;
  }
  filesWithMarkers++;

  // Extract content before and after the generated region
  const before = original.substring(0, beginIndex);
  const after = original.substring(endIndex + END_MARKER.length);

  // Detect which constants are used in the non-generated parts
  const sourceWithoutGenerated = before + after;
  const usedEntries = detectUsedConstants(sourceWithoutGenerated);

  if (usedEntries.length === 0) {
    // No constants used — leave an empty generated region
    const updated = before + BEGIN_MARKER + '\n' + END_MARKER + after;
    if (updated !== original) {
      writeFileSync(filePath, updated, 'utf-8');
      return true;
    }
    return false;
  }

  const inlineBlock = generateInlineBlock(usedEntries);
  const updated = before + inlineBlock + after;

  if (updated !== original) {
    writeFileSync(filePath, updated, 'utf-8');
    return true;
  }
  return false;
}

/**
 * Recursively collect all .ts files under a directory.
 */
function collectTypeScriptFiles(directory: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = resolve(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...collectTypeScriptFiles(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const sourceDirectory = resolve(projectRoot, 'src');

// Inline into all source files that have markers
const sourceFiles = collectTypeScriptFiles(sourceDirectory);
let inlinedCount = 0;

for (const filePath of sourceFiles) {
  if (inlineIntoFile(filePath)) {
    inlinedCount++;
    console.log(`  Inlined constants into ${relative(projectRoot, filePath)}`);
  }
}

if (inlinedCount === 0) {
  if (filesWithMarkers === 0) {
    console.log(
      'No source files with @generated:char-codes markers found to update.',
    );
  } else {
    console.log(
      `All ${filesWithMarkers} source file(s) with @generated:char-codes markers are already up to date.`,
    );
  }
} else {
  console.log(`Updated ${inlinedCount} source file(s) with inlined constants.`);
}
