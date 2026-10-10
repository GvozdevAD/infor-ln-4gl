const vscode = require("vscode");

/**
 * @param {vscode.Uri} leftUri
 * @param {vscode.Uri} rightUri
 * @param {string} title
 * @param {boolean} sideBySide  true = mode 1; false = inline (modes 2 & 3)
 */
async function openRevisionDiff(leftUri, rightUri, title, sideBySide) {
  const config = vscode.workspace.getConfiguration("diffEditor");
  const currentSideBySide = config.get("renderSideBySide", true) === true;

  await vscode.commands.executeCommand(
    "vscode.diff",
    leftUri,
    rightUri,
    title,
  );

  if (currentSideBySide !== sideBySide) {
    try {
      await vscode.commands.executeCommand("toggle.diff.renderSideBySide");
    } catch {
      const hint = sideBySide
        ? "Open the diff editor title menu and enable Side by Side."
        : "Open the diff editor title menu and switch to Inline View.";
      vscode.window.setStatusBarMessage(`Infor LN: ${hint}`, 8000);
    }
  }
}

module.exports = { openRevisionDiff };
