const vscode = require("vscode");
const { computeIndentEdits } = require("./format");

const documentFormattingEditProvider = {
  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.FormattingOptions} options
   * @returns {vscode.TextEdit[]}
   */
  provideDocumentFormattingEdits(document, options) {
    const cfg = vscode.workspace.getConfiguration("ln-4gl", document.uri);
    if (cfg.get("format.enabled") === false) {
      return [];
    }

    const edits = computeIndentEdits(document.getText(), {
      tabSize: options.tabSize,
      insertSpaces: options.insertSpaces,
    });

    return edits.map(
      (e) =>
        new vscode.TextEdit(
          new vscode.Range(e.line, e.start, e.line, e.end),
          e.newText,
        ),
    );
  },
};

module.exports = { documentFormattingEditProvider };
