# Troubleshooting

## Language mode is Baan / Baan C, not Infor LN 4GL

Two other extensions also claim `.bc` (and some claim `.cln`):

- [bc / jeffersyuan.baan](https://marketplace.visualstudio.com/items?itemName=jeffersyuan.baan) — language id `baan`
- [Baan C VSCode / AnonymousGCA.baan-c-vscode](https://marketplace.visualstudio.com/items?itemName=AnonymousGCA.baan-c-vscode) — language id `baanc`

**Change Language Mode** → **Infor LN 4GL**, or disable the other extension.

## File has no extension

LN Studio dumps sometimes have no suffix. **Change Language Mode** → Infor LN 4GL, or add a file association, for example in user `settings.json`:

```json
{
  "files.associations": {
    "*.bc": "ln-4gl",
    "*.cln": "ln-4gl"
  }
}
```

## Trailing whitespace disappeared after save

Keep `files.trimTrailingWhitespace` **off** for `ln-4gl`. LN Tools often stores trailing spaces; stripping them makes a noisy diff and can upset what the server stored. This extension sets that default for `[ln-4gl]`.

**Format Document** only rewrites leading indentation. It does not trim trailing spaces. Format on save is **off** by default for this language (`editor.formatOnSave: false`); turn it on only if you want indent fixes on every save. Disable the formatter with `ln-4gl.format.enabled: false` if another tool should own formatting.

## `#include` does not jump

The include file must exist next to the current script or on `ln-4gl.includePath` (absolute path, or relative to the current file). There is no search of the LN server or VRC.

Typical TEMP workflow (several LN sessions, scripts under `%TEMP%` or a session dump folder):

```json
{
  "ln-4gl.includePath": ["C:/Users/you/AppData/Local/Temp/ln-session"],
  "ln-4gl.sessionFolder": "C:/Users/you/AppData/Local/Temp/ln-session"
}
```

`includePath` only resolves `#include` files that exist on disk. `sessionFolder` indexes script files in that folder for Go to Definition / Find References / semantic highlighting even when they are not open; leave it empty if you only want open editor tabs. Neither setting walks the whole disk.

## Remote-SSH still shows the old grammar

Install the `.vsix` (or symlink) **on the remote host**, then reload the remote window. A local-only install does not apply to files opened over SSH.

## Too many block diagnostics / false positives

Turn off block matching:

```json
{
  "ln-4gl.diagnostics.enabled": false
}
```

Or keep diagnostics but treat `|` comments as code (noisy):

```json
{
  "ln-4gl.diagnostics.strictComments": false
}
```

Preprocessor `#if` / `#endif` and SQL `for update` are ignored by the block checker. Keywords inside strings are ignored. Embedded SQL `CASE … ENDCASE` does not trigger `ON CASE` block errors.

Duplicate `CASE` warnings and deprecated long-IF checks can be turned off individually:

```json
{
  "ln-4gl.diagnostics.duplicateCase": false,
  "ln-4gl.diagnostics.deprecatedLongIf": false
}
```

`deprecatedLongIf` skips identifiers known as `boolean` in the current file (function parameters or variable declarations). Domain-typed names (`domain tcyesno flag`) have no Data Dictionary resolve yet, so a bare `if flag then` still warns — use an explicit comparison, or disable the check if that is noisy.

## ON CASE formatting

Format Document indents `ON CASE` with three levels: `on case` / `endcase` at the block base, `case N:` / `default:` one level in, statements two levels in. Fall-through labels (`case 1:` followed by `case 2:` with no body) stay at the label level. Only leading whitespace changes; trailing spaces are preserved.
