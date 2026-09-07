const vscode = require("vscode");
const { findFunctionCalls, findDefineUsages } = require("./semantic-tokens");
const {
  getKnownNames,
  onDidChangeOpenDocsIndex,
} = require("./open-docs-store");

/** Index 0 = function, 1 = macro (#define usages). */
const TOKEN_TYPES = ["function", "macro"];
const legend = new vscode.SemanticTokensLegend(TOKEN_TYPES, []);

const semanticTokensProvider = {
  /**
   * Refresh when open tabs / sessionFolder index changes.
   * @type {vscode.Event<void> | undefined}
   */
  get onDidChangeSemanticTokens() {
    return onDidChangeOpenDocsIndex();
  },

  /**
   * @param {vscode.TextDocument} document
   */
  provideDocumentSemanticTokens(document) {
    const config = vscode.workspace.getConfiguration("ln-4gl");
    const doFns = config.get("semanticHighlighting.localFunctionCalls", true);
    const doDefs = config.get("semanticHighlighting.defineUsages", true);
    if (!doFns && !doDefs) {
      return new vscode.SemanticTokens(new Uint32Array(0));
    }

    const text = document.getText();
    const builder = new vscode.SemanticTokensBuilder(legend);
    if (doFns) {
      for (const hit of findFunctionCalls(text, getKnownNames())) {
        builder.push(hit.line, hit.start, hit.end - hit.start, 0);
      }
    }
    if (doDefs) {
      for (const hit of findDefineUsages(text)) {
        builder.push(hit.line, hit.start, hit.end - hit.start, 1);
      }
    }
    return builder.build();
  },
};

module.exports = { semanticTokensProvider, legend };
