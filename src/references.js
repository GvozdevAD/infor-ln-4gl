const vscode = require("vscode");
const { inCommentOrString } = require("./text");
const { wordAt, findOccurrences } = require("./idents");

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
    return findOccurrences(document.getText(), hit.word).map(
      (occ) =>
        new vscode.Location(
          document.uri,
          new vscode.Range(occ.line, occ.start, occ.line, occ.end),
        ),
    );
  },
};

module.exports = { referenceProvider };
