# Development

Requires Node.js and, for the grammar generator, Python 3.

## Debug

Open this folder and run **Launch Extension** (`F5`). A new Extension Development Host window loads `ln-4gl` from the working tree.

A filesystem symlink is an alternative to F5; see [install.md](install.md).

## Scripts

```bash
npm test              # parse / outline unit tests (node --test)
npm run test:grammar  # TextMate token fixtures (vscode-tmgrammar-test)
npm run check:grammar # rebuild grammar; fail if committed artifacts drift
npm run check:errors  # verify errors-catalog.json matches completions + docs
npm run check:catalog # verify api-catalog.json matches completions + signatures
npm run ci            # all of the above
npm run package       # produce infor-ln-4gl-*.vsix
```

The VSIX does not include `scripts/`, `test/`, or `docs/` (see `.vscodeignore`). `examples/` is included.

## Regenerating the grammar

Keyword lists were extracted from Vim `runtime/syntax/baan.vim`. Pattern layout follows [SublimeBaan](https://github.com/masal/SublimeBaan).

```bash
python3 scripts/build-grammar.py
```

That rewrites `syntaxes/ln-4gl.tmLanguage.json` and `data/completions.json`. It also merges new 4GL section docs from `data/sections-catalog.json` into `data/docs.json` (without overwriting existing keys). Do not edit generated files by hand; change the generator, catalog JSON, or `data/baan-vim-keywords.json` and rebuild.

## Regenerating error codes

Runtime error codes come from Infor ES Programmers Guide JSON (local path only; not committed):

```bash
python3 scripts/build-errors.py \
  --progguide /path/to/ln-progguide/dist/data/progguide \
  --merge
python3 scripts/build-grammar.py
```

That writes `data/errors-catalog.json` (committed snapshot) and updates `completions.errors` + `docs.json`. CI runs `npm run check:errors` against the snapshot without progguide.

## Regenerating the API catalog

Runtime API functions and DAL hooks come from Infor ES Programmers Guide function pages (local path only; not committed):

```bash
python3 scripts/build-catalog.py \
  --progguide /path/to/ln-progguide/dist/data/progguide \
  --merge
python3 scripts/build-grammar.py
```

That writes committed snapshots:

| File | Role |
|---|---|
| `data/api-catalog.json` | ~1600+ API entries (doc, syntax, context, DAL `replaces`) |
| `data/links.json` | Hook relations for future DocumentLinkProvider |
| `data/signatures.json` | Signature help labels/parameters |
| `data/completions.json` | `functions` + `dalHooks` from catalog |

Manual DAL hook → UI section mappings live in `data/dal-notes.json` and are merged at build time.

CI runs `npm run check:catalog` against the snapshot without progguide.

The VSIX grows by roughly 2–4 MB from the catalog JSON files; providers load them once at activation.

## Layout

| Path | Role |
|---|---|
| `src/` | Language providers (no bundler; `main` is `src/extension.js`) |
| `syntaxes/` | Generated TextMate grammar |
| `data/` | Completions, hover text, signatures, section/error catalogs |
| `snippets/` | User snippets |
| `scripts/build-grammar.py` | Grammar + completions generator |
| `scripts/build-errors.py` | Error codes from Progguide JSON |
| `scripts/build-catalog.py` | API catalog from Progguide function pages |
| `test/` | Parse tests and grammar fixtures |
