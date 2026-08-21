# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Find All References and Rename Symbol in the current file (builtins, keywords, and 4GL section headers cannot be renamed).
- Document highlights for identifier occurrences (in addition to `if`/`endif` pairs).
- `FoldingRangeProvider` for control blocks, braces, and 4GL sections.
- Block-matching diagnostics for unmatched `if`/`endif`, `select`/`endselect`, and related pairs; idiom warnings with Quick Fix for `for … by` → `step` and stray `while … do`.
- Settings `ln-4gl.diagnostics.enabled` and `ln-4gl.diagnostics.strictComments`.
- Expanded frequency catalog: everyday `db.*` navigation, string/date helpers, and error constants (`ELOCKED`, `EDUPL`, …) in completion; hover docs and more signatures for those APIs.

### Fixed

- String scanning follows Baan rules (no backslash escapes; embedded quotes are `""`): `|` inside `"…"` is not treated as a line comment in providers or the TextMate grammar.

## [0.1.0] - 2026-08-22

### Added

- Syntax highlighting for Infor LN / Baan 3GL and 4GL (sections, SQL, DAL hooks, builtins).
- Identifier highlighting: `table.field`, `table.*`, table ids, `:hostvar`, `attr.*` / session vars.
- Context-aware completion (SQL block, section line, general) and an expanded function catalog.
- Snippets for high-value templates (`sel`, `dalnew`, `upd`, …); control blocks via `wh` / `forn` / `onc` (no `if` snippet — keyword stays clean).
- Language configuration: `[]` brackets, `repeat`/`until` indent, section folding, Enter continues `|` / `|*` comments.
- Chunked TextMate patterns for builtins (avoids one giant regex).
- Outline (document symbols) and Go to Definition within the same file.
- Hover docs, signature help, keyword pair highlights (`if`/`endif`, …), and `#include` navigation (`ln-4gl.includePath`).
- Sample scripts under `examples/`.
- VSIX packaging (`npm run package`); `scripts/` and `test/` excluded from the package.
- Unit tests (`npm test`), TextMate grammar fixtures (`npm run test:grammar`), grammar freshness check, and GitHub Actions CI.

[unreleased]: https://github.com/GvozdevAD/infor-ln-4gl/compare/0.1.0...HEAD
[0.1.0]: https://github.com/GvozdevAD/infor-ln-4gl/releases/tag/0.1.0