# Infor LN 4GL for VS Code

[![CI](https://github.com/GvozdevAD/infor-ln-4gl/actions/workflows/ci.yml/badge.svg)](https://github.com/GvozdevAD/infor-ln-4gl/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Syntax highlighting, snippets, completion, Outline, Go to Definition, hover, and signature help for **Infor LN / Baan 3GL and 4GL**.

This is a notepad for scripts you copy out of LN Tools (`ttadv2530m000`) or edit in an LN Studio workspace over Remote-SSH. It does **not** replace LN Studio: no check-out, no `bic` compile, no forms, no JCA adapter.

## Install

### From VSIX (recommended)

Build a package, then install it in VS Code or Cursor (on a **Remote-SSH** host, run Install from VSIX in the remote window):

```bash
npm install
npm run package
```

That produces `infor-ln-4gl-0.1.0.vsix`. Command Palette → **Extensions: Install from VSIX…** → pick the file → reload.

Open `examples/print-session.ui.bc`. The status bar should show **Infor LN 4GL**.

### Development symlink

For local editing of this repo without repackaging:

```bash
# VS Code
ln -s /absolute/path/to/this/repo ~/.vscode/extensions/infor-ln-4gl-0.1.0

# Cursor
ln -s /absolute/path/to/this/repo ~/.cursor/extensions/infor-ln-4gl-0.1.0
```

On Windows (the machine you SSH into):

```powershell
cmd /c mklink /J "%USERPROFILE%\.vscode\extensions\infor-ln-4gl-0.1.0" "C:\path\to\this\repo"
```

To debug: open this folder and run **Launch Extension** (`F5`).

## Conflict with jeffersyuan.baan

The Marketplace extension [bc / jeffersyuan.baan](https://marketplace.visualstudio.com/items?itemName=jeffersyuan.baan) also claims `.bc` and `.cln`. If both are enabled, language mode may flip to **Baan**. Prefer **Infor LN 4GL** (Command Palette → **Change Language Mode**), or disable `bc`.

## What you get

| Feature | Notes |
|---|---|
| Highlighting | 3GL, 4GL sections, SQL, DAL hooks, `table.field`, `table.*`, table ids, `:hostvar`, `attr.*` |
| Completion | Context-aware (SQL / sections / general); frequent functions with snippets |
| Snippets | High-value only: `sel`, `dalnew`, `upd`, `fld`, … Control blocks: `wh` / `forn` / `onc` (not `if` — type the keyword) |
| Outline | 4GL sections (`field.*`, `choice.*`, …) and functions; nested events under parents |
| Go to Definition | Jump to `function` in the same file; `#include` resolves beside the file or via `ln-4gl.includePath` |
| Hover | Short notes for sections, DAL hooks, common functions, `attr.*` |
| Signature help | Parameter hints for frequent calls (`message`, `stpapi.*`, DAL1, …) |
| Keyword pairs | Highlight matching `if`/`endif`, `select`/`endselect`, `for`/`endfor`, … |
| Word pattern | dots count: `tdsls401.orno` and `before.input` are one word |

Files: `*.bc`, `*.cln`, `*.ln4gl`. For Studio dumps without an extension, run **Change Language Mode** → Infor LN 4GL, or add a file association.

## Suggested workflow on a Mac

1. Copy a script from LN UI (`ttadv2530m000`) into a `.bc` file, or Remote-SSH to the Windows box and open the LN Studio workspace.
2. Edit here (highlighting + snippets).
3. Paste back into Tools, or in Studio press **Build** so the dirty local file is compiled on the LN server.

Do not turn on `files.trimTrailingWhitespace` for these files; LN is picky about what it stored.

## Language notes

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

## Regenerating the grammar

Keyword lists were extracted from Vim `runtime/syntax/baan.vim`. Pattern layout follows [SublimeBaan](https://github.com/masal/SublimeBaan).

```bash
python3 scripts/build-grammar.py
```

That rewrites `syntaxes/ln-4gl.tmLanguage.json` and `data/completions.json`. The VSIX does not include `scripts/` or `test/` (see `.vscodeignore`).

## Development

```bash
npm test              # parse / outline unit tests (node --test)
npm run test:grammar  # TextMate token fixtures (vscode-tmgrammar-test)
npm run check:grammar # rebuild grammar; fail if committed artifacts drift
npm run ci            # all of the above
```

## What this will not do

- Talk to LN Studio, BW, or `JCAAdapter4ERPln.jar`
- Check out / check in VRC components
- Compile or type-check against domains and tables

Those stay on the LN server. For the language itself see **Infor ES Programmers Guide** (Support Portal KB2924522).

## License

MIT. Keyword inventory derived from the Vim runtime syntax file `baan.vim` (Erik Remmelzwaal, originally Erwin Smit / Her van de Vliert). TextMate layering inspired by SublimeBaan.
