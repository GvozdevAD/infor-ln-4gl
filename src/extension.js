const vscode = require("vscode");
const { documentSymbolProvider } = require("./symbols");
const { definitionProvider } = require("./definition");
const { completionProvider } = require("./completion");
const { hoverProvider } = require("./hover");
const { signatureHelpProvider } = require("./signature");
const { documentHighlightProvider } = require("./highlights");
const { documentLinkProvider } = require("./include");
const { activateDiagnostics, deactivateDiagnostics } = require("./diagnostics");
const { codeActionProvider } = require("./codeActions");
const { referenceProvider } = require("./references");
const { renameProvider } = require("./rename");
const { foldingRangeProvider } = require("./foldingProvider");
const { documentFormattingEditProvider } = require("./formatProvider");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  activateDiagnostics(context);

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      "ln-4gl",
      documentSymbolProvider,
    ),
    vscode.languages.registerDefinitionProvider("ln-4gl", definitionProvider),
    vscode.languages.registerReferenceProvider("ln-4gl", referenceProvider),
    vscode.languages.registerRenameProvider("ln-4gl", renameProvider),
    vscode.languages.registerFoldingRangeProvider(
      "ln-4gl",
      foldingRangeProvider,
    ),
    vscode.languages.registerDocumentFormattingEditProvider(
      "ln-4gl",
      documentFormattingEditProvider,
    ),
    vscode.languages.registerCompletionItemProvider(
      "ln-4gl",
      completionProvider,
      ".",
    ),
    vscode.languages.registerHoverProvider("ln-4gl", hoverProvider),
    vscode.languages.registerSignatureHelpProvider(
      "ln-4gl",
      signatureHelpProvider,
      "(",
      ",",
    ),
    vscode.languages.registerDocumentHighlightProvider(
      "ln-4gl",
      documentHighlightProvider,
    ),
    vscode.languages.registerDocumentLinkProvider(
      "ln-4gl",
      documentLinkProvider,
    ),
    vscode.languages.registerCodeActionsProvider("ln-4gl", codeActionProvider, {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }),
  );
}

function deactivate() {
  deactivateDiagnostics();
}

module.exports = { activate, deactivate };
