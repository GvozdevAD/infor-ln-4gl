const vscode = require("vscode");
const { inCommentOrString } = require("./text");
const { PAIRS, tokensOnLine, roleInPair, isForUpdate } = require("./keywords");

/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 * @returns {vscode.DocumentHighlight[] | undefined}
 */
function highlightsFor(document, position) {
  if (inCommentOrString(document, position)) {
    return undefined;
  }

  const lineText = document.lineAt(position.line).text;
  const tokens = tokensOnLine(lineText);
  const here = tokens.find(
    (t) => position.character >= t.start && position.character <= t.end,
  );
  if (!here) {
    return undefined;
  }

  const word = here.word.toLowerCase();
  const spec = PAIRS.find((p) => roleInPair(word, p));
  if (!spec) {
    return undefined;
  }

  /** @type {{ line: number, start: number, end: number, role: string, _close?: object, _open?: object, _middles?: object[] }[]} */
  const stack = [];
  /** @type {{ line: number, start: number, end: number, role: string, _close?: object, _open?: object, _middles?: object[] }[]} */
  const all = [];

  for (let line = 0; line < document.lineCount; line++) {
    const lineTokens = tokensOnLine(document.lineAt(line).text);
    for (let ti = 0; ti < lineTokens.length; ti++) {
      const t = lineTokens[ti];
      const role = roleInPair(t.word, spec);
      if (!role) {
        continue;
      }
      if (role === "open" && isForUpdate(lineTokens, ti)) {
        continue;
      }
      const node = { line, start: t.start, end: t.end, role };
      all.push(node);
      if (role === "open") {
        stack.push(node);
      } else if (role === "close") {
        const open = stack.pop();
        if (open) {
          open._close = node;
          node._open = open;
        }
      } else if (role === "middle" && stack.length) {
        const open = stack[stack.length - 1];
        if (!open._middles) {
          open._middles = [];
        }
        open._middles.push(node);
        node._open = open;
      }
    }
  }

  const cursorNode = all.find(
    (n) =>
      n.line === position.line &&
      position.character >= n.start &&
      position.character <= n.end,
  );
  if (!cursorNode) {
    return undefined;
  }

  let open = cursorNode;
  if (cursorNode.role !== "open") {
    open = cursorNode._open;
  }
  if (!open) {
    return undefined;
  }

  /** @type {vscode.DocumentHighlight[]} */
  const result = [
    new vscode.DocumentHighlight(
      new vscode.Range(open.line, open.start, open.line, open.end),
      vscode.DocumentHighlightKind.Read,
    ),
  ];
  if (open._middles) {
    for (const mid of open._middles) {
      result.push(
        new vscode.DocumentHighlight(
          new vscode.Range(mid.line, mid.start, mid.line, mid.end),
          vscode.DocumentHighlightKind.Read,
        ),
      );
    }
  }
  if (open._close) {
    const c = open._close;
    result.push(
      new vscode.DocumentHighlight(
        new vscode.Range(c.line, c.start, c.line, c.end),
        vscode.DocumentHighlightKind.Read,
      ),
    );
  }
  return result;
}

const documentHighlightProvider = {
  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.Position} position
   */
  provideDocumentHighlights(document, position) {
    return highlightsFor(document, position);
  },
};

module.exports = { documentHighlightProvider };
