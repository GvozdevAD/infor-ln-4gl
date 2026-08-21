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
npm run ci            # all of the above
npm run package       # produce infor-ln-4gl-*.vsix
```

The VSIX does not include `scripts/`, `test/`, or `docs/` (see `.vscodeignore`). `examples/` is included.

## Regenerating the grammar

Keyword lists were extracted from Vim `runtime/syntax/baan.vim`. Pattern layout follows [SublimeBaan](https://github.com/masal/SublimeBaan).

```bash
python3 scripts/build-grammar.py
```

That rewrites `syntaxes/ln-4gl.tmLanguage.json` and `data/completions.json`. Do not edit those two files by hand; change the generator or `data/baan-vim-keywords.json` and rebuild.

## Layout

| Path | Role |
|---|---|
| `src/` | Language providers (no bundler; `main` is `src/extension.js`) |
| `syntaxes/` | Generated TextMate grammar |
| `data/` | Completions, hover text, signatures |
| `snippets/` | User snippets |
| `scripts/build-grammar.py` | Grammar + completions generator |
| `test/` | Parse tests and grammar fixtures |
