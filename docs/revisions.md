# Review Revisions

Compare Infor Component Revisions in the VS Code Diff Editor (red / green like git). No BECS or LN API — you open the files Infor already gave you.

## Command

**Infor LN: Review Revisions…**

- Command Palette
- Editor context menu on `ln-4gl` files
- Editor title (diff icon) when a `ln-4gl` file is active

## Sources

1. **Current file as Differences report** — ed-style output from Infor **Differences** (`19c19,27`, `<` / `>` lines). Opens a *partial* compare of changed hunks only.
2. **Two open editors** — pick which tab is old (left) and which is new (right).
3. **Pick two files…** — two full revision copies (e.g. after View Revision → Save As).

## View modes

| Mode | Looks like | Needs |
|---|---|---|
| Side by side | git / WinMerge | Differences report or two files |
| Inline / unified | GitLab-style flow | Differences report or two files |
| Whole file inline | Cursor / git review on full script | **Two full files only** |

Setting `ln-4gl.revisions.defaultMode`: `ask` (default) | `sideBySide` | `inline` | `fullInline`.

## Typical flows

### From Infor Differences

1. In `ttscm1501m000`, select two revisions → **Differences**.
2. Open the report in VS Code / Cursor.
3. Run **Review Revisions…** → current file → Side by side or Inline.

### From two View Revision copies

1. View Revision → Save As `script_rev_old.bc`, close the tab (so BECS can continue).
2. Same for the newer revision.
3. **Review Revisions…** → Pick two files → Whole file inline (or Side by side).

## File icon

`.bc` / `.cln` / `.ln4gl` use a BC language icon in the Explorer. If another **file icon theme** (e.g. Material) maps `.bc` to a generic icon, that theme wins — disable the mapping or use the default/Seti theme to see BC.
