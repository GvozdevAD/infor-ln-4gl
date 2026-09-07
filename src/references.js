const vscode = require("vscode");
const { inCommentOrString } = require("./text");
const { wordAt } = require("./idents");
const { findReferences } = require("./open-docs-store");

const referenceProvider = {
  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.Position} position
   * @returns {vscode.Location[]}
   */
  provideReferences(document, position) {
    if (inCommentOrString(document, position)) {
      return [];
    }
    const hit = wordAt(
      document.getText(),
      position.line,
      position.character,
    );
    if (!hit) {
      return [];
    }
    return findReferences(hit.word).map(
      (occ) =>
        new vscode.Location(
          vscode.Uri.parse(occ.uri),
          new vscode.Range(occ.line, occ.start, occ.line, occ.end),
        ),
    );
  },
};

module.exports = { referenceProvider };
