const vscode = require("vscode");
const { RevisionContentProvider, SCHEME } = require("./content-provider");
const { registerRevisionCommands } = require("./commands");

/**
 * @param {vscode.ExtensionContext} context
 */
function activateRevisions(context) {
  const provider = new RevisionContentProvider();
  context.subscriptions.push(
    provider,
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider),
  );
  registerRevisionCommands(context, provider);
}

module.exports = { activateRevisions };
