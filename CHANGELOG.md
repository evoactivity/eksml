# Changelog

## Release (2026-07-23)

* @eksml/xml 0.2.1 (patch)

#### :memo: Documentation
* `@eksml/xml`
  * [#29](https://github.com/evoactivity/eksml/pull/29) bench: update @tuananh/sax-parser to 1.7, refresh tables ([@evoactivity](https://github.com/evoactivity))
  * [#28](https://github.com/evoactivity/eksml/pull/28) bench: state benchmark hardware in the methodology ([@evoactivity](https://github.com/evoactivity))
  * [#24](https://github.com/evoactivity/eksml/pull/24) bench: update @tuananh/sax-parser to 1.6 and txml to 6, refresh numbers ([@evoactivity](https://github.com/evoactivity))

#### :house: Internal
* `@eksml/xml`
  * [#27](https://github.com/evoactivity/eksml/pull/27) bench: per-fixture tables with generator, aligned event surfaces, large-document benchmark ([@evoactivity](https://github.com/evoactivity))

#### Committers: 1
- Liam ([@evoactivity](https://github.com/evoactivity))

## Release (2026-07-20)

* @eksml/xml 0.2.0 (minor)

#### :rocket: Enhancement
* `@eksml/xml`
  * [#23](https://github.com/evoactivity/eksml/pull/23) docs: rewrite README as a getting-started guide, add topic docs ([@evoactivity](https://github.com/evoactivity))
  * [#22](https://github.com/evoactivity/eksml/pull/22) perf(stream): faster XmlParseStream ([@evoactivity](https://github.com/evoactivity))

#### :memo: Documentation
* `@eksml/xml`
  * [#23](https://github.com/evoactivity/eksml/pull/23) docs: rewrite README as a getting-started guide, add topic docs ([@evoactivity](https://github.com/evoactivity))

#### :house: Internal
* [#21](https://github.com/evoactivity/eksml/pull/21) demo: sync parser stepper with the dual-path parser ([@evoactivity](https://github.com/evoactivity))
* [#19](https://github.com/evoactivity/eksml/pull/19) demo: rebuild the workspace lib before build and dev ([@evoactivity](https://github.com/evoactivity))

#### Committers: 1
- Liam ([@evoactivity](https://github.com/evoactivity))

## Release (2026-07-19)

* @eksml/xml 0.1.6 (patch)

#### :bug: Bug Fix
* `@eksml/xml`
  * [#16](https://github.com/evoactivity/eksml/pull/16) perf(sax): intern attribute names in the engine hot path ([@evoactivity](https://github.com/evoactivity))

#### :house: Internal
* `@eksml/xml`
  * [#17](https://github.com/evoactivity/eksml/pull/17) bench: update @tuananh/sax-parser to 1.4 and police arity probing ([@evoactivity](https://github.com/evoactivity))

#### Committers: 1
- Liam ([@evoactivity](https://github.com/evoactivity))

## Release (2026-07-19)

* @eksml/xml 0.1.5 (patch)

#### :bug: Bug Fix
* `@eksml/xml`
  * [#15](https://github.com/evoactivity/eksml/pull/15) perf(parser): specialized fast path for default-option parsing ([@evoactivity](https://github.com/evoactivity))

#### :house: Internal
* [#13](https://github.com/evoactivity/eksml/pull/13) feat: update SSR handling and dependencies in demo app ([@evoactivity](https://github.com/evoactivity))

#### Committers: 1
- Liam ([@evoactivity](https://github.com/evoactivity))

## Release (2026-07-19)

* @eksml/xml 0.1.4 (patch)

#### :bug: Bug Fix
* `@eksml/xml`
  * [#12](https://github.com/evoactivity/eksml/pull/12) perf: use plain records to avoid V8 IC churn from null prototypes ([@evoactivity](https://github.com/evoactivity))

#### Committers: 1
- Liam ([@evoactivity](https://github.com/evoactivity))

## Release (2026-07-18)

* @eksml/xml 0.1.3 (patch)

#### :bug: Bug Fix
* `@eksml/xml`
  * [#7](https://github.com/evoactivity/eksml/pull/7) perf(sax): direct dispatch for single-listener events ([@evoactivity](https://github.com/evoactivity))
  * [#4](https://github.com/evoactivity/eksml/pull/4) perf(writer): faster serialization and a validate option ([@evoactivity](https://github.com/evoactivity))
  * [#3](https://github.com/evoactivity/eksml/pull/3) perf(sax): Improve performance of SAX parser ([@evoactivity](https://github.com/evoactivity))

#### :house: Internal
* Other
  * [#10](https://github.com/evoactivity/eksml/pull/10) chore: exclude changelogs from prettier ([@evoactivity](https://github.com/evoactivity))
  * [#8](https://github.com/evoactivity/eksml/pull/8) demo: stream benchmark handlers consume event data ([@evoactivity](https://github.com/evoactivity))
  * [#6](https://github.com/evoactivity/eksml/pull/6) demo: add easysax to benchmark and GitHub link to homepage ([@evoactivity](https://github.com/evoactivity))
  * [#5](https://github.com/evoactivity/eksml/pull/5) ci: run CI on pull requests targeting any branch ([@evoactivity](https://github.com/evoactivity))
* `@eksml/xml`
  * [#9](https://github.com/evoactivity/eksml/pull/9) bench: measure eksml SAX through the public createSaxParser API ([@evoactivity](https://github.com/evoactivity))
  * [#2](https://github.com/evoactivity/eksml/pull/2) bench: add @tuananh/sax-parser and easysax to sax benchmarks ([@evoactivity](https://github.com/evoactivity))

#### Committers: 1
- Liam ([@evoactivity](https://github.com/evoactivity))

## [0.1.0] - 2026-04-05

Initial release.

[0.1.0]: https://github.com/evoactivity/eksml/releases/tag/v0.1.0
