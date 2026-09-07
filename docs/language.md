# Language notes

**4GL** (UI / report scripts) uses event sections with a colon:

```baan
field.tdsls401.orno:
before.input:
    | UI only
```

**3GL** (DLL, `function main`, most DAL) is procedural. DAL hooks are functions, not sections:

```baan
function extern long before.save.object()
{
    return(0)
}
```

The preprocessor (`#include`, `#ifdef`) exists only for 3GL. `bic` compiles 3GL; 4GL goes through `std_gen` first.

### Editor sources of truth

- **Keywords / SQL / reserved words:** [`scripts/baan_guide_lexicon.py`](../scripts/baan_guide_lexicon.py) (Infor ES Programmers Guide 10.8.0 vocabulary + `sql_reserved_words`), merged into the TextMate grammar by [`scripts/build-grammar.py`](../scripts/build-grammar.py). Stock Vim `baan.vim` dumps in `data/baan-vim-keywords.json` are a secondary input; typos like `ofr` / `exsists` are stripped.
- **API builtins / hover / signatures:** Progguide pages via [`scripts/build-catalog.py`](../scripts/build-catalog.py) → `data/api-catalog.json`.
- **Project-local macros** (e.g. `RETIFNOK`) are **not** part of this extension; keep them in your own snippets or Neovim overlays.

### Strings and continuation

Baan strings have no `\` escapes; embed a quote as `""`. A string or `#define` body continued on the next line must start with `^`. The extension flags missing carets when `ln-4gl.diagnostics.continuation` is on.

For the language itself see **Infor ES Programmers Guide** (Infor Customer Portal KB2924522; cited in [Infor LN documentation](https://docs.infor.com/ln/2026.x/en-us/lnesolh/lndebugworkbenchug/iam1633953930176.html)). The PDF itself is not public — search that KB on the Customer Portal or open it from LN Studio help.
