const vscode = require("vscode");
const { inCommentOrString } = require("./text");
const {
  wordAt,
  findOccurrences,
  isProtectedName,
  isSectionHeaderLine,
} = require("./idents");

/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 * @returns {{ range: vscode.Range, placeholder: string }}
 */
function prepareRename(document, position) {
  if (inCommentOrString(document, position)) {
    throw new Error("Cannot rename inside a comment or string");
  }

  const hit = wordAt(document.getText(), position.line, position.character);
  if (!hit) {
    throw new Error("No identifier here");
  }

  const lineText = document.lineAt(position.line).text;
  if (isSectionHeaderLine(lineText)) {
    throw new Error(`Cannot rename 4GL section '${hit.word}'`);
  }

  if (isProtectedName(hit.word)) {
    throw new Error(`Cannot rename builtin or keyword '${hit.word}'`);
  }

  return {
    range: new vscode.Range(hit.line, hit.start, hit.line, hit.end),
    placeholder: hit.word,
  };
}

/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 * @param {string} newName
 */
function provideRenameEdits(document, position, newName) {
  const prepared = prepareRename(document, position);
  const oldName = document.getText(prepared.range);
  if (!newName || !/^[A-Za-z_][A-Za-z0-9_.$]*$/.test(newName)) {
    throw new Error("Invalid identifier name");
  }
  if (isProtectedName(newName)) {
    throw new Error(`Cannot rename to builtin or keyword '${newName}'`);
  }

  const edit = new vscode.WorkspaceEdit();
  for (const occ of findOccurrences(document.getText(), oldName)) {
    edit.replace(
      document.uri,
      new vscode.Range(occ.line, occ.start, occ.line, occ.end),
      newName,
    );
  }
  return edit;
}

const renameProvider = {
  prepareRename,
  provideRenameEdits,
};

module.exports = { renameProvider };
