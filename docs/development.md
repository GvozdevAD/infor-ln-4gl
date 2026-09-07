# Development

Requires Node.js and, for generators, Python 3.

## Debug

Open this folder and run **Launch Extension** (`F5`). A new Extension Development Host window loads `ln-4gl` from the working tree.

A filesystem symlink is an alternative to F5; see [install.md](install.md).

## Scripts

```bash
npm test              # unit tests (node --test)
npm run test:grammar  # TextMate token fixtures
npm run check:grammar # rebuild grammar; fail if committed artifacts drift
npm run check:errors  # errors-catalog.json matches completions + docs
npm run check:catalog # api-catalog.json matches completions + signatures
npm run check:catalog-quality # catalog depth / void returns / syntax sanity
npm run check:predefined # predefined variables snapshot
npm run ci            # full local CI set
npm run package       # produce infor-ln-4gl-*.vsix
```

The VSIX does not include `scripts/`, `test/`, or `docs/` (see `.vscodeignore`). `examples/` is included.

## Regenerating the grammar

Canonical 3GL/SQL reserved words live in `scripts/baan_guide_lexicon.py` (Infor ES Programmers Guide 10.8.0). Vim `baan.vim` dumps in `data/baan-vim-keywords.json` are a secondary source. Pattern layout follows [SublimeBaan](https://github.com/masal/SublimeBaan).

```bash
python3 scripts/build-grammar.py
```

Rewrites `syntaxes/ln-4gl.tmLanguage.json` and updates `data/completions.json`. Merges new 4GL section docs from `data/sections-catalog.json` into `data/docs.json` without overwriting existing keys. Do not edit generated grammar by hand.

## Regenerating error codes

Needs a local Progguide JSON tree (not committed):

```bash
python3 scripts/build-errors.py \
  --progguide /path/to/ln-progguide/dist/data/progguide \
  --merge
python3 scripts/build-grammar.py
```

Writes `data/errors-catalog.json` and updates `completions.errors` + `docs.json`. CI runs `npm run check:errors` against the committed snapshot.

## Regenerating the API catalog

Needs local Progguide function pages (default: sibling `../ln-progguide-rag/data`, or `--progguide` / `LN_PROGGUIDE_PAGES`):

```bash
python3 scripts/build-catalog.py --merge
python3 scripts/build-grammar.py
```

Committed outputs used at runtime:

| File | Role |
|---|---|
| `data/api-catalog.json` | API / hook entries (doc, syntax, returns, …) |
| `data/signatures.json` | Signature help |
| `data/completions.json` | `functions` + `dalHooks` (and related lists) |

DAL hook → UI section mappings: `data/dal-notes.json` (merged at build).

CI: `npm run check:catalog` and `npm run check:catalog-quality`.

## Diagnostics settings

| Setting | Default | Effect |
|---|---|---|
| `ln-4gl.diagnostics.enabled` | `true` | Master switch for block matching, idiom warnings, brackets, and continuation |
| `ln-4gl.diagnostics.strictComments` | `true` | Ignore `\|` line comments when scanning blocks |
| `ln-4gl.diagnostics.duplicateCase` | `true` | Warn on duplicate `CASE expr:` inside `ON CASE` |
| `ln-4gl.diagnostics.deprecatedLongIf` | `true` | Warn on bare `if identifier then` unless the identifier is typed `boolean` in-file |
| `ln-4gl.diagnostics.brackets` | `true` | Mismatched / unclosed `()` `{}` `[]` |
| `ln-4gl.diagnostics.continuation` | `true` | Missing `^` on continued strings / `#define` bodies |

Quick Fix is available for `for … by` → `step`, stray `while … do`, and deprecated long-IF (`<> 0`).

## Semantic highlighting

- Calls to `function` / `function extern` names from open `ln-4gl` tabs (and `ln-4gl.sessionFolder`) get a semantic `function` token when followed by `(`.
- Uses of names introduced by `#define` in the **current file** get a semantic `macro` token (e.g. `START.EFFECTIVE.DATE`).

| Setting | Default | Effect |
|---|---|---|
| `editor.semanticHighlighting.enabled` | `true` for `[ln-4gl]` | Master switch; without it themes ignore semantic tokens |
| `ln-4gl.semanticHighlighting.localFunctionCalls` | `true` | Calls to indexed local/open-tab functions |
| `ln-4gl.semanticHighlighting.defineUsages` | `true` | Usages of `#define` names from the current file |

## Layout

| Path | Role |
|---|---|
| `src/` | Language providers (`main` is `src/extension.js`) |
| `syntaxes/` | Generated TextMate grammar |
| `data/` | Completions, hover, signatures, catalogs |
| `snippets/` | User snippets |
| `scripts/` | Generators and checks (not in VSIX) |
| `test/` | Unit tests and grammar fixtures |
