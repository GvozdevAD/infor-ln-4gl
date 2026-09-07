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
const { semanticTokensProvider, legend } = require("./semanticTokensProvider");
const { detectScriptKind, scriptKindLabel } = require("./script-context");
const {
  activateOpenDocsStore,
  deactivateOpenDocsStore,
} = require("./open-docs-store");

/** @type {vscode.StatusBarItem | undefined} */
let scriptKindStatus;
/** @type {NodeJS.Timeout | undefined} */
let statusDebounce;

/**
 * @param {vscode.TextEditor | undefined} editor
 */
function refreshScriptKindStatus(editor) {
  if (!scriptKindStatus) {
    return;
  }
  if (!editor || editor.document.languageId !== "ln-4gl") {
    scriptKindStatus.hide();
    return;
  }
  const kind = detectScriptKind(editor.document);
  scriptKindStatus.text = scriptKindLabel(kind);
  scriptKindStatus.tooltip = `Detected Infor LN script kind: ${kind}`;
  scriptKindStatus.show();
}

/**
 * @param {vscode.TextDocument} document
 */
function scheduleStatusRefresh(document) {
  if (document.languageId !== "ln-4gl") {
    return;
  }
  if (statusDebounce) {
    clearTimeout(statusDebounce);
  }
  statusDebounce = setTimeout(() => {
    statusDebounce = undefined;
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document === document) {
      refreshScriptKindStatus(editor);
    }
  }, 200);
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  activateDiagnostics(context);
  activateOpenDocsStore(context);

  scriptKindStatus = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  context.subscriptions.push(scriptKindStatus);
  refreshScriptKindStatus(vscode.window.activeTextEditor);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      refreshScriptKindStatus(editor);
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      scheduleStatusRefresh(e.document);
    }),
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
    vscode.languages.registerDocumentSemanticTokensProvider(
      "ln-4gl",
      semanticTokensProvider,
      legend,
    ),
  );
}

function deactivate() {
  deactivateDiagnostics();
  deactivateOpenDocsStore();
  if (statusDebounce) {
    clearTimeout(statusDebounce);
    statusDebounce = undefined;
  }
  scriptKindStatus = undefined;
}

module.exports = { activate, deactivate };
