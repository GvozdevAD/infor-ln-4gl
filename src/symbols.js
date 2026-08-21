const vscode = require("vscode");
const { parseDocument } = require("./parse");

/**
 * @param {import("./parse").ParseNode} node
 * @param {vscode.TextDocument} document
 * @param {vscode.SymbolKind} kind
 */
function toSymbol(node, document, kind) {
  const lastCol = document.lineAt(node.endLine).text.length;
  const range = new vscode.Range(node.line, 0, node.endLine, lastCol);
  const selectionRange = new vscode.Range(
    node.line,
    node.nameStart,
    node.line,
    node.nameEnd,
  );
  return new vscode.DocumentSymbol(
    node.name,
    "",
    kind,
    range,
    selectionRange,
  );
}

/**
 * Build nested DocumentSymbols: parent sections own child events;
 * `functions:` owns following function nodes until the next parent.
 * @param {vscode.TextDocument} document
 * @returns {vscode.DocumentSymbol[]}
 */
function buildSymbols(document) {
  const nodes = parseDocument(document.getText());
  /** @type {vscode.DocumentSymbol[]} */
  const roots = [];
  /** @type {{ node: import("./parse").ParseNode, symbol: vscode.DocumentSymbol } | null} */
  let openParent = null;

  for (const node of nodes) {
    if (node.kind === "parent") {
      openParent = null;
      const symbol = toSymbol(node, document, vscode.SymbolKind.Module);
      roots.push(symbol);
      openParent = { node, symbol };
      continue;
    }

    if (node.kind === "child") {
      const symbol = toSymbol(node, document, vscode.SymbolKind.Event);
      if (openParent) {
        openParent.symbol.children.push(symbol);
      } else {
        roots.push(symbol);
      }
      continue;
    }

    // function
    const symbol = toSymbol(node, document, vscode.SymbolKind.Function);
    if (openParent && /^functions$/i.test(openParent.node.name)) {
      openParent.symbol.children.push(symbol);
    } else {
      openParent = null;
      roots.push(symbol);
    }
  }

  return roots;
}

const documentSymbolProvider = {
  /**
   * @param {vscode.TextDocument} document
   * @returns {vscode.DocumentSymbol[]}
   */
  provideDocumentSymbols(document) {
    return buildSymbols(document);
  },
};

module.exports = { documentSymbolProvider, buildSymbols };
