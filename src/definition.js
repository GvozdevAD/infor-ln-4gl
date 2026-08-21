const vscode = require("vscode");
const { functionIndex } = require("./parse");
const { inCommentOrString } = require("./text");
const { includeDefinition } = require("./include");

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

    const def = functionIndex(document.getText()).get(word.toLowerCase());
    if (!def) {
      return undefined;
    }

    return new vscode.Location(
      document.uri,
      new vscode.Range(def.line, def.nameStart, def.line, def.nameEnd),
    );
  },
};

module.exports = { definitionProvider };
