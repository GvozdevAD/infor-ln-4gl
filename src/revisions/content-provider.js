const vscode = require("vscode");

const SCHEME = "ln4gl-revision";

/**
 * In-memory text documents for vscode.diff sides.
 */
class RevisionContentProvider {
  constructor() {
    /** @type {Map<string, string>} */
    this._contents = new Map();
    this._onDidChange = new vscode.EventEmitter();
    this.onDidChange = this._onDidChange.event;
  }

  /**
   * @param {vscode.Uri} uri
   * @returns {string}
   */
  provideTextDocumentContent(uri) {
    return this._contents.get(uri.toString()) ?? "";
  }

  /**
   * @param {string} side  'old' | 'new'
   * @param {string} text
   * @param {string} [fileHint]  path ending used for language association
   * @returns {vscode.Uri}
   */
  publish(side, text, fileHint = "revision.bc") {
    const safeHint = fileHint.replace(/[^a-zA-Z0-9._-]/g, "_");
    const stamp = Date.now().toString(36);
    const uri = vscode.Uri.from({
      scheme: SCHEME,
      path: `/${side}/${stamp}/${safeHint}`,
      query: `side=${side}`,
    });
    this._contents.set(uri.toString(), text);
    this._onDidChange.fire(uri);
    return uri;
  }

  dispose() {
    this._contents.clear();
    this._onDidChange.dispose();
  }
}

module.exports = {
  SCHEME,
  RevisionContentProvider,
};
