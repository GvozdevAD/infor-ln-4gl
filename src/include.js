const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const { inCommentOrString } = require("./text");
const { sectionLineIndex, replacesLinksOnLine } = require("./replaces-links");

const INCLUDE_RE =
  /^\s*#\s*include\s+(?:"([^"]+)"|<([^>]+)>)/i;

/**
 * @param {string} line
 * @returns {{ file: string, start: number, end: number } | undefined}
 */
function parseInclude(line) {
  const m = line.match(INCLUDE_RE);
  if (!m) {
    return undefined;
  }
  const file = m[1] || m[2];
  const quote = m[1] != null ? '"' : "<";
  const start = line.indexOf(quote) + 1;
  const end = start + file.length;
  return { file, start, end };
}

/**
 * Resolve include path against document dir and ln-4gl.includePath.
 * @param {vscode.TextDocument} document
 * @param {string} rel
 * @returns {vscode.Uri | undefined}
 */
function resolveInclude(document, rel) {
  const candidates = [];
  const base = path.dirname(document.uri.fsPath);
  candidates.push(path.resolve(base, rel));

  const cfg = vscode.workspace.getConfiguration("ln-4gl", document.uri);
  const extra = cfg.get("includePath") || [];
  for (const dir of extra) {
    if (typeof dir === "string" && dir.trim()) {
      const abs = path.isAbsolute(dir)
        ? dir
        : path.resolve(base, dir);
      candidates.push(path.resolve(abs, rel));
    }
  }

  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return vscode.Uri.file(c);
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}

/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 * @returns {vscode.Location | undefined}
 */
function includeDefinition(document, position) {
  if (inCommentOrString(document, position)) {
    return undefined;
  }
  const line = document.lineAt(position.line).text;
  const inc = parseInclude(line);
  if (!inc) {
    return undefined;
  }
  if (position.character < inc.start || position.character > inc.end) {
    return undefined;
  }
  const uri = resolveInclude(document, inc.file);
  if (!uri) {
    return undefined;
  }
  return new vscode.Location(uri, new vscode.Position(0, 0));
}

const documentLinkProvider = {
  /**
   * @param {vscode.TextDocument} document
   */
  provideDocumentLinks(document) {
    /** @type {vscode.DocumentLink[]} */
    const links = [];
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i).text;
      const inc = parseInclude(line);
      if (!inc) {
        continue;
      }
      const uri = resolveInclude(document, inc.file);
      if (!uri) {
        continue;
      }
      const range = new vscode.Range(i, inc.start, i, inc.end);
      links.push(new vscode.DocumentLink(range, uri));
    }

    const sections = sectionLineIndex(document.getText());
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i).text;
      for (const hit of replacesLinksOnLine(line, sections, i)) {
        const range = new vscode.Range(i, hit.start, i, hit.end);
        const link = new vscode.DocumentLink(
          range,
          document.uri.with({ fragment: `L${hit.targetLine + 1}` }),
        );
        link.tooltip = `Replaces UI section ${hit.section}:`;
        links.push(link);
      }
    }
    return links;
  },
};

module.exports = {
  parseInclude,
  resolveInclude,
  includeDefinition,
  documentLinkProvider,
};
