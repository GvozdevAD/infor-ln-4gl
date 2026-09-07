const vscode = require("vscode");
const { inCommentOrString, codePart } = require("./text");
const { resolveSignature } = require("./local-signature");

/**
 * Find call info: function name and active argument index at position.
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 * @returns {{ name: string, activeParameter: number } | undefined}
 */
function callAt(document, position) {
  if (inCommentOrString(document, position)) {
    return undefined;
  }

  let lineNo = position.line;
  let text = codePart(document.lineAt(lineNo).text).slice(0, position.character);
  let depth = 0;
  let commas = 0;
  let i = text.length - 1;

  while (lineNo >= 0) {
    while (i >= 0) {
      const ch = text[i];
      if (ch === ")") {
        depth++;
      } else if (ch === "(") {
        if (depth === 0) {
          const before = text.slice(0, i);
          const m = before.match(/([A-Za-z_][\w.$]*)\s*$/);
          if (!m) {
            return undefined;
          }
          return { name: m[1], activeParameter: commas };
        }
        depth--;
      } else if (ch === "," && depth === 0) {
        commas++;
      } else if (ch === '"') {
        // skip string backwards
        i--;
        while (i >= 0) {
          if (text[i] === '"' && text[i - 1] !== '"') {
            break;
          }
          if (text[i] === '"' && text[i - 1] === '"') {
            i--;
          }
          i--;
        }
      }
      i--;
    }
    lineNo--;
    if (lineNo < 0) {
      break;
    }
    text = codePart(document.lineAt(lineNo).text);
    i = text.length - 1;
  }
  return undefined;
}

const signatureHelpProvider = {
  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.Position} position
   */
  provideSignatureHelp(document, position) {
    const call = callAt(document, position);
    if (!call) {
      return undefined;
    }

    const sig = resolveSignature(document.getText(), call.name);
    if (!sig) {
      return undefined;
    }

    const info = new vscode.SignatureInformation(sig.label);
    info.parameters = sig.parameters.map(
      (p) => new vscode.ParameterInformation(p),
    );

    const help = new vscode.SignatureHelp();
    help.signatures = [info];
    help.activeSignature = 0;
    help.activeParameter = Math.min(
      call.activeParameter,
      Math.max(0, sig.parameters.length - 1),
    );
    return help;
  },
};

module.exports = { signatureHelpProvider, callAt };
