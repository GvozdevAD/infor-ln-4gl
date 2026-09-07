# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-09-07

### Added

- Open Documents Index: Go to Definition, Find References, and semantic highlighting across open `ln-4gl` tabs; optional `ln-4gl.sessionFolder` for a TEMP folder (non-recursive, max 100 scripts). Rename stays in-file.
- Semantic highlighting for `#define` name usages in the current file (`ln-4gl.semanticHighlighting.defineUsages`).
- Local signature help from in-file `function extern` declarations (preferred over catalog signatures).
- Report script Outline / completion / folding / snippets: numbered layouts (`header.N:`, `detail.N:`, …), `before.layout` / `after.layout`, `after.receive.data:`; example `examples/report.layout.bc`.
- Predefined variables catalog (`attr.*` / `lattr.*` / `fattr.*` + key session vars) via `scripts/build-predefined-vars.py` → hover + completion constants; deprecated names marked in docs.
- Hover **See also** from filtered catalog `related` names; in-file DocumentLink from DAL hooks to present `replaces` UI sections.
- Status bar script kind: `LN: Report|DAL|UI|3GL`.
- Info diagnostics when a DAL hook and its replaced UI sections coexist in the same file (`ln-4gl.diagnostics.dalUiOverlap`).
- DAL2 field-hook snippets `dalvalid` / `dalmand` / `dalupd` and suffix-based hover (`table.field.is.valid` → `field.is.valid` docs).
- Guide-aligned lexicon (`scripts/baan_guide_lexicon.py` from Infor ES Programmers Guide 10.8.0): 3GL `call`, SQL gap tokens, FunctionUsage `Input:`/`Output:`/`Return:` labels, program sections `on.display.total.line` / `after.new.object` / `after.form.read`.
- FunctionUsage / DllUsage completion templates; snippets `fu` / `FunctionUsage` / `dllu`.
- Hover parses in-file `FunctionUsage` in Progguide form only.
- Diagnostics for brackets, continuation, duplicate `CASE`, deprecated long-as-boolean IF, unclosed usage blocks.
- API catalog from Progguide (~1875 entries); semantic highlighting for in-file function calls; Format Document (indent-only).

### Changed

- Richer API catalog docs for hover: full Description, normalized Syntax, explicit Returns (`void` / guide text / `n/a`); CI catalog quality gate.
- Catalog hover always shows **Returns**, then Replaces / See also.
- Drop non-callable doc topics from the catalog; `DsC*` entries as UI object stubs.
- `detectScriptKind` priority: report > dal > ui > 3gl > general.
- Catalog build keeps only callable/hook names in `related`.
- Completion no longer truncates to 200 items when the typed prefix is at least 2 characters.
- DAL snippet `dalsave` and `examples/table.dal.bc` use `before.save.object(long mode)` with `DAL_NEW` / `DAL_UPDATE`.

### Fixed

- `dal.set.error.message` / `warning` / `info`: three separate catalog entries (hover + completion).
- Typing `select` offers the keyword and a `select … from … selectdo … endselect` snippet.
- Outline / folding markers recognize `after.form.read`, `on.display.total.line`, and `after.new.object`.
- `deprecatedLongIf` respects in-file `boolean` types; string scanning treats `|` inside quotes as non-comment.

### Removed

- Dead `src/pairs.js` re-export; `data/links.json` excluded from VSIX (generated, not used at runtime).

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
