const vscode = require("vscode");
const { documentSymbolProvider } = require("./symbols");
const { definitionProvider } = require("./definition");
const { completionProvider } = require("./completion");
const { hoverProvider } = require("./hover");
const { signatureHelpProvider } = require("./signature");
const { documentHighlightProvider } = require("./pairs");
const { documentLinkProvider } = require("./include");

function activate(context) {
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      "ln-4gl",
      documentSymbolProvider,
    ),
    vscode.languages.registerDefinitionProvider("ln-4gl", definitionProvider),
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
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
