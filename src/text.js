/**
 * Shared text helpers for LN 4GL providers.
 */

/**
 * True if position sits in a `|` line comment or inside a double-quoted string.
 * @param {import("vscode").TextDocument} document
 * @param {import("vscode").Position} position
 */
function inCommentOrString(document, position) {
  const line = document.lineAt(position.line).text;
  const pipe = line.indexOf("|");
  if (pipe !== -1 && position.character >= pipe) {
    return true;
  }

  let inString = false;
  for (let i = 0; i < position.character && i < line.length; i++) {
    if (line[i] === '"') {
      if (inString && line[i + 1] === '"') {
        i++;
        continue;
      }
      inString = !inString;
    }
  }
  return inString;
}

/**
 * Strip trailing `|` comment from a line.
 * @param {string} line
 */
function codePart(line) {
  const pipe = line.indexOf("|");
  return pipe === -1 ? line : line.slice(0, pipe);
}

module.exports = { inCommentOrString, codePart };
