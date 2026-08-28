# Infor LN 4GL for VS Code

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/GvozdevAD.infor-ln-4gl?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=GvozdevAD.infor-ln-4gl)
[![CI](https://github.com/GvozdevAD/infor-ln-4gl/actions/workflows/ci.yml/badge.svg)](https://github.com/GvozdevAD/infor-ln-4gl/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Syntax highlighting, snippets, completion, Outline, Go to Definition, hover, and signature help for **Infor LN / Baan 3GL and 4GL**.

A notepad for scripts you copy out of LN Tools (`ttadv2530m000`) or edit in an LN Studio workspace over Remote-SSH. It does **not** replace LN Studio: no check-out, no `bic` compile, no forms, no JCA adapter.

## Features

| Feature | Notes |
|---|---|
| Highlighting | 3GL, 4GL sections, SQL, DAL hooks, `table.field`, `table.*`, table ids, `:hostvar`, `attr.*` |
| Completion | Context-aware (SQL / sections / general); frequent APIs (`db.*`, strings, dates) plus error constants (`ELOCKED`, …) |
| Snippets | High-value only: `sel`, `dalnew`, `upd`, `fld`, … Control blocks: `wh` / `forn` / `onc` (not `if` — type the keyword) |
| Outline | 4GL sections (`field.*`, `choice.*`, …) and functions; nested events under parents |
| Go to Definition | Jump to `function` in the same file; `#include` resolves beside the file or via `ln-4gl.includePath` |
| Find References / Rename | Occurrences and F2 rename in the current file; builtins, keywords, error codes, and 4GL section headers are blocked |
| Hover | Short notes for sections, DAL hooks, common functions, error codes, `attr.*` |
| Signature help | Parameter hints for frequent calls (`message`, `db.*`, `stpapi.*`, DAL1, …) |
| Keyword pairs | Highlight matching `if`/`endif`, `select`/`endselect`, `for`/`endfor`, … |
| Document highlights | Pair keywords or all occurrences of the identifier under the cursor |
| Folding | `if`/`select`/`function` blocks, braces, and 4GL sections |
| Format Document | Indent only (`if`/`selectdo`/braces/4GL sections); never trims trailing spaces; format on save off by default |
| Diagnostics | Unmatched `endif` / `endselect` / …; Quick Fix for `for … by` → `step` and stray `while … do` |
| Word pattern | Dots count: `tdsls401.orno` and `before.input` are one word |

Files: `*.bc`, `*.cln`, `*.ln4gl`. For Studio dumps without an extension, run **Change Language Mode** → Infor LN 4GL, or add a file association.

## Workflow

1. Copy a script from LN UI (`ttadv2530m000`) into a `.bc` file, or Remote-SSH to the Windows box and open the LN Studio workspace.
2. Edit here (highlighting + snippets).
3. Paste back into Tools, or in Studio press **Build** so the dirty local file is compiled on the LN server.

Leave `files.trimTrailingWhitespace` **off** for these files; LN is picky about what it stored.

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `ln-4gl.includePath` | `[]` | Extra directories to search for `#include` files (absolute or relative to the current file) |
| `ln-4gl.diagnostics.enabled` | `true` | Block-matching diagnostics and idiom warnings |
| `ln-4gl.diagnostics.strictComments` | `true` | Ignore `|` and `/* */` comments when analyzing blocks |
| `ln-4gl.format.enabled` | `true` | Format Document (indent-only; does not trim trailing spaces) |

## Conflicts

These Marketplace extensions also claim `.bc` (and some claim `.cln`). If another one is enabled, language mode may flip away from **Infor LN 4GL**. Prefer this language mode, or disable the other extension:

- [bc / jeffersyuan.baan](https://marketplace.visualstudio.com/items?itemName=jeffersyuan.baan)
- [Baan C VSCode / AnonymousGCA.baan-c-vscode](https://marketplace.visualstudio.com/items?itemName=AnonymousGCA.baan-c-vscode)

## What this will not do

- Talk to LN Studio, BW, or `JCAAdapter4ERPln.jar`
- Check out / check in VRC components
- Compile or type-check against domains and tables

Those stay on the LN server. For the language itself see **Infor ES Programmers Guide** (Infor Customer Portal KB2924522; cited in [Infor LN documentation](https://docs.infor.com/ln/2026.x/en-us/lnesolh/lndebugworkbenchug/iam1633953930176.html)).

## Docs

- [Install](docs/install.md) — Marketplace, VSIX, symlink
- [3GL vs 4GL](docs/language.md)
- [Development and packaging](docs/development.md)
- [Troubleshooting](docs/troubleshooting.md)

## License

MIT. Keyword inventory derived from the Vim runtime syntax file `baan.vim` (Erik Remmelzwaal, originally Erwin Smit / Her van de Vliert). TextMate layering inspired by [SublimeBaan](https://github.com/masal/SublimeBaan).
