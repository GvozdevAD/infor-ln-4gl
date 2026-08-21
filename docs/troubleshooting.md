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

If another formatter or “format on save” rewrites the file, turn it off for this language.

## `#include` does not jump

The include file must exist next to the current script or on `ln-4gl.includePath` (absolute path, or relative to the current file). There is no search of the LN server or VRC.

## Remote-SSH still shows the old grammar

Install the `.vsix` (or symlink) **on the remote host**, then reload the remote window. A local-only install does not apply to files opened over SSH.

## Too many block diagnostics / false positives

Turn off block matching:

```json
{
  "ln-4gl.diagnostics.enabled": false
}
```

Or keep diagnostics but treat `|` / `/* */` as code (noisy):

```json
{
  "ln-4gl.diagnostics.strictComments": false
}
```

Preprocessor `#if` / `#endif` and SQL `for update` are ignored by the block checker. Keywords inside strings are ignored.
