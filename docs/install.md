# Install

## Marketplace (recommended)

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=GvozdevAD.infor-ln-4gl), or Command Palette → **Extensions: Install Extensions** → search **Infor LN 4GL**, or:

```text
ext install GvozdevAD.infor-ln-4gl
```

On a **Remote-SSH** host, install in the *remote* window (the Windows box), not only on the local Mac.

Open `examples/print-session.ui.bc`. The status bar should show **Infor LN 4GL**.

## From VSIX

Useful for a specific build, offline install, or before a Marketplace update propagates:

```bash
npm install
npm run package
```

That produces `infor-ln-4gl-0.1.0.vsix`. Command Palette → **Extensions: Install from VSIX…** → pick the file → reload.

## Development symlink

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

To debug: open this folder and run **Launch Extension** (`F5`). Details: [development.md](development.md).

## After install

If language mode is **Baan** or **Baan C** instead of **Infor LN 4GL**, see [troubleshooting](troubleshooting.md).
