const vscode = require("vscode");
const { analyzeDocument } = require("./blocks");

/** @type {vscode.DiagnosticCollection | undefined} */
let collection;
/** @type {NodeJS.Timeout | undefined} */
let debounceTimer;

/**
 * @param {vscode.TextDocument} document
 */
function refresh(document) {
  if (!collection) {
    return;
  }
  if (document.languageId !== "ln-4gl") {
    return;
  }

  const cfg = vscode.workspace.getConfiguration("ln-4gl", document.uri);
  if (!cfg.get("diagnostics.enabled", true)) {
    collection.delete(document.uri);
    return;
  }

  const strictComments = cfg.get("diagnostics.strictComments", true);
  const issues = analyzeDocument(document.getText(), { strictComments });
  /** @type {vscode.Diagnostic[]} */
  const diags = issues.map((issue) => {
    const range = new vscode.Range(
      issue.line,
      issue.start,
      issue.line,
      issue.end,
    );
    const severity =
      issue.severity === "warning"
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Error;
    const d = new vscode.Diagnostic(range, issue.message, severity);
    d.source = "Infor LN 4GL";
    d.code = issue.code;
    return d;
  });
  collection.set(document.uri, diags);
}

/**
 * @param {vscode.TextDocument} document
 */
function scheduleRefresh(document) {
  if (document.languageId !== "ln-4gl") {
    return;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    refresh(document);
  }, 300);
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activateDiagnostics(context) {
  collection = vscode.languages.createDiagnosticCollection("ln-4gl");
  context.subscriptions.push(collection);

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => refresh(doc)),
    vscode.workspace.onDidChangeTextDocument((e) => scheduleRefresh(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (collection) {
        collection.delete(doc.uri);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("ln-4gl.diagnostics")) {
        for (const doc of vscode.workspace.textDocuments) {
          refresh(doc);
        }
      }
    }),
  );

  for (const doc of vscode.workspace.textDocuments) {
    refresh(doc);
  }
}

function deactivateDiagnostics() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
  if (collection) {
    collection.dispose();
    collection = undefined;
  }
}

module.exports = { activateDiagnostics, deactivateDiagnostics, refresh };
