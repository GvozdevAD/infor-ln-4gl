const vscode = require("vscode");
const { inCommentOrString } = require("./text");
const { includeDefinition } = require("./include");
const { findDefinition } = require("./open-docs-store");

const definitionProvider = {
  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.Position} position
   * @returns {vscode.Location | undefined}
   */
  provideDefinition(document, position) {
    if (inCommentOrString(document, position)) {
      return undefined;
    }

    const fromInclude = includeDefinition(document, position);
    if (fromInclude) {
      return fromInclude;
    }

    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      return undefined;
    }

    const word = document.getText(wordRange);
    if (!word) {
      return undefined;
    }

    const def = findDefinition(word, document.uri.toString());
    if (!def) {
      return undefined;
    }

    return new vscode.Location(
      vscode.Uri.parse(def.uri),
      new vscode.Range(def.line, def.nameStart, def.line, def.nameEnd),
    );
  },
};

module.exports = { definitionProvider };
