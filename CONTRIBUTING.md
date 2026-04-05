# Contributing to Eksml

Thanks for your interest in contributing to Eksml. This guide covers everything you need to get started.

## Prerequisites

- **Node.js ~24** (see `.prototools`)
- **pnpm 10.33.0** (corepack or standalone)

## Setup

```sh
pnpm install
```

The repo is a pnpm monorepo with two workspaces:

- `eksml/` — the library
- `demo/` — an Ember app that exercises every public API

## Commands

All day-to-day commands can be run from the repo root:

| Task                      | Command                          |
| ------------------------- | -------------------------------- |
| Run tests                 | `pnpm test`                      |
| Watch tests               | `pnpm --filter eksml test:watch` |
| Run benchmarks            | `pnpm --filter eksml bench`      |
| Type-check the library    | `pnpm --filter eksml typecheck`  |
| Build the library         | `pnpm build`                     |
| Check formatting          | `pnpm prettier --check .`        |
| Fix formatting            | `pnpm format`                    |
| Start the demo dev server | `pnpm demo`                      |
| Build the demo (SSG)      | `pnpm build:demo`                |

There is no top-level `lint` script. Use `pnpm prettier --check .` and `pnpm --filter eksml typecheck` instead.

## Code style

Formatting is handled by Prettier. The config lives in `.prettierrc.js`:

- Single quotes
- Trailing commas
- 2-space indent
- 80-character print width
- `prettier-plugin-ember-template-tag` for `.gts` files

Run `pnpm format` at the repo root before committing, or let your editor do it on save.

TypeScript strict mode is enabled. The library targets ES2023 with Node16 module resolution.

## Project structure

```
eksml/
  src/
    parser.ts          # parse() — XML string → TNode tree
    writer.ts          # write() — TNode tree → XML string
    sax.ts             # createSaxParser() — EventEmitter SAX API
    saxEngine.ts       # internal low-level SAX tokenizer (not exported)
    xmlParseStream.ts  # XmlParseStream — Web Streams TransformStream
    converters/        # lossy, lossless, fromLossy, fromLossless
    utilities/         # DOM-like helpers (filter, getElementById, etc.)
  test/                # Vitest tests
  bench/               # Vitest benchmarks
demo/                  # Ember demo app
```

Internal imports within the library use the `#src/*` subpath import (defined in `package.json` `"imports"`), not `tsconfig.json` paths.

## Tests

Tests use [Vitest](https://vitest.dev/) with `describe`/`it`/`expect`:

```sh
# Run once
pnpm test

# Watch mode (re-runs on save)
pnpm --filter eksml test:watch
```

Test files live in `eksml/test/` and follow the naming convention `*.test.ts`. Fixtures are in `eksml/test/fixtures/` and are excluded from Prettier.

### Writing tests

- Import source via the `#src/` alias: `import { parse } from '#src/parser.ts'`
- Group related tests with `describe` blocks
- Keep assertions specific — prefer `toEqual` for structure, `toBe` for primitives

### Bug fixes: write a failing test first

When fixing a bug, **start by adding a test that reproduces it**. The workflow is:

1. Write a minimal test case that fails because of the bug.
2. Run `pnpm test` — confirm the new test fails.
3. Commit the failing test with a message like `test: add failing case for [bug description]`.
4. Fix the code.
5. Run `pnpm test` — confirm the test (and all others) pass.

This ensures the bug stays fixed and the fix is documented by the test suite.

## Benchmarks

Performance is a core goal of Eksml. Every change to a hot path should be benchmarked before and after.

Benchmarks use [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) (which wraps tinybench) and live in `eksml/bench/`:

| File                | What it measures                                                       |
| ------------------- | ---------------------------------------------------------------------- |
| `tokenize.bench.ts` | Raw SAX tokenization throughput (no-op callbacks)                      |
| `parse.bench.ts`    | DOM/tree parsing vs fast-xml-parser, xml2js, xmldom, htmlparser2, txml |
| `stream.bench.ts`   | SAX streaming and XmlParseStream vs sax, saxes, htmlparser2            |
| `writer.bench.ts`   | XML serialization (tree to string)                                     |
| `convert.bench.ts`  | Object converters (lossy/lossless) vs fast-xml-parser, xml2js, txml    |

Run them:

```sh
pnpm --filter eksml bench
```

### Performance guidelines

- **Do not merge regressions.** If a change makes a benchmark measurably slower, investigate before proceeding. There are real-world XML workloads where a 10% regression in tokenization costs meaningful wall-clock time.
- **Benchmark before and after** any change that touches `saxEngine.ts`, `parser.ts`, `writer.ts`, or `xmlParseStream.ts`.
- **Use the fixtures** already in `test/fixtures/` — they cover a range of document sizes from ~100 B to ~30 KB. This catches regressions that only show up at certain input sizes.
- **Avoid unnecessary allocations** in hot loops. The tokenizer processes input character-by-character; even small allocation changes can have outsized effects.

## Type checking

```sh
pnpm --filter eksml typecheck
```

This runs `tsc --noEmit` with strict mode. All public API types should be explicit — avoid `any` and prefer narrowing over type assertions.

## Building

```sh
pnpm build
```

The library is built with [tsdown](https://github.com/nicolo-ribaudo/tsdown) to ESM with `.d.ts` declaration files. The build config is in `eksml/tsdown.config.ts`.

## Demo app

The demo is an Ember app that provides interactive pages for each public API (parse, write, SAX, stream, benchmark). It uses SSG via `vite-ember-ssr` to prerender all routes.

```sh
# Dev server
pnpm demo

# Production build (prerendered)
pnpm build:demo
```

Demo components use `.gts` template-tag format. Prefer arrow functions over `@action` decorators for bound methods.

## Pull request checklist

Before opening a PR, verify:

- [ ] `pnpm test` passes (all 1,400+ tests)
- [ ] `pnpm --filter eksml typecheck` has no errors
- [ ] `pnpm prettier --check .` is clean
- [ ] Benchmarks show no regression (if touching parser/tokenizer/writer/stream code)
- [ ] New features include tests
- [ ] Bug fixes include a test that would have caught the bug

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
