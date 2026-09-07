const vscode = require("vscode");

const FOR_BY = "ln-4gl.forBy";
const WHILE_DO = "ln-4gl.whileDo";
const DEPRECATED_LONG_IF = "ln-4gl.deprecatedLongIf";

/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Range | vscode.Selection} range
 * @param {vscode.CodeActionContext} context
 * @returns {vscode.CodeAction[]}
 */
function provideCodeActions(document, range, context) {
  if (document.languageId !== "ln-4gl") {
    return [];
  }

  /** @type {vscode.CodeAction[]} */
  const actions = [];

  for (const diag of context.diagnostics) {
    if (diag.source !== "Infor LN 4GL") {
      continue;
    }
    const code = typeof diag.code === "object" ? diag.code.value : diag.code;
    if (code === FOR_BY) {
      const action = new vscode.CodeAction(
        "Replace 'by' with 'step'",
        vscode.CodeActionKind.QuickFix,
      );
      action.diagnostics = [diag];
      action.isPreferred = true;
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(document.uri, diag.range, "step");
      actions.push(action);
    } else if (code === WHILE_DO) {
      const action = new vscode.CodeAction(
        "Remove 'do'",
        vscode.CodeActionKind.QuickFix,
      );
      action.diagnostics = [diag];
      action.isPreferred = true;
      const line = document.lineAt(diag.range.start.line).text;
      let start = diag.range.start.character;
      let end = diag.range.end.character;
      // Drop a single space before or after `do` when present
      if (start > 0 && /\s/.test(line[start - 1])) {
        start -= 1;
      } else if (end < line.length && /\s/.test(line[end])) {
        end += 1;
      }
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(
        document.uri,
        new vscode.Range(diag.range.start.line, start, diag.range.end.line, end),
        "",
      );
      actions.push(action);
    } else if (code === DEPRECATED_LONG_IF) {
      const action = new vscode.CodeAction(
        "Add explicit comparison (<> 0)",
        vscode.CodeActionKind.QuickFix,
      );
      action.diagnostics = [diag];
      action.isPreferred = true;
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(
        document.uri,
        diag.range,
        `${document.getText(diag.range)} <> 0`,
      );
      actions.push(action);
    }
  }

  return actions;
}

const codeActionProvider = {
  provideCodeActions,
};

module.exports = { codeActionProvider, FOR_BY, WHILE_DO, DEPRECATED_LONG_IF };
