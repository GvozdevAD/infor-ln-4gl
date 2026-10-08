/**
 * Embedded SQL (select…endselect) depth tracking (no vscode dependency).
 */

const { codePart } = require("./text");

const SQL_TOKEN_RE =
  /\b(endselect|selectdo|selectempty|selecteos|selecterror|select)\b/gi;

/**
 * True if `select` at `selectStart` is a parenthesized SQL subquery `(select …)`,
 * not a 4GL `select`…`endselect` block opener.
 * @param {string} line
 * @param {number} selectStart column of `select`
 */
function isSelectSubquery(line, selectStart) {
  let i = selectStart - 1;
  while (i >= 0 && /\s/.test(line[i])) {
    i--;
  }
  return i >= 0 && line[i] === "(";
}

/**
 * Update select/endselect nesting depth from tokens on one line (right-to-left).
 * @param {string} lineText code portion of the line
 * @param {number} depth depth entering the line
 * @returns {number} depth leaving the line
 */
function sqlDepthAfterLine(lineText, depth) {
  const lower = lineText.toLowerCase();
  /** @type {{ tok: string, index: number }[]} */
  const tokens = [];
  let m;
  SQL_TOKEN_RE.lastIndex = 0;
  while ((m = SQL_TOKEN_RE.exec(lower)) !== null) {
    tokens.push({ tok: m[1].toLowerCase(), index: m.index });
  }
  for (let t = tokens.length - 1; t >= 0; t--) {
    const { tok, index } = tokens[t];
    if (tok === "endselect") {
      depth--;
    } else if (tok === "select") {
      if (isSelectSubquery(lineText, index)) {
        continue;
      }
      depth++;
    }
  }
  return depth;
}

/**
 * select…endselect nesting depth at end of line `lineNo` (0-based).
 * @param {string} text
 * @param {number} lineNo
 * @param {number} [charEnd] truncate last line at this column (exclusive)
 * @returns {number}
 */
function sqlDepthAtLine(text, lineNo, charEnd) {
  const lines = text.split(/\r?\n/);
  let depth = 0;
  for (let i = 0; i <= lineNo && i < lines.length; i++) {
    let part = codePart(lines[i]);
    if (i === lineNo && charEnd !== undefined) {
      part = part.slice(0, charEnd);
    }
    depth = sqlDepthAfterLine(part, depth);
  }
  return depth;
}

/**
 * True when cursor/end of line sits inside an unclosed embedded SQL select.
 * @param {string} text
 * @param {number} lineNo
 * @param {number} [charEnd]
 */
function isInsideEmbeddedSql(text, lineNo, charEnd) {
  return sqlDepthAtLine(text, lineNo, charEnd) > 0;
}

module.exports = {
  isSelectSubquery,
  sqlDepthAfterLine,
  sqlDepthAtLine,
  isInsideEmbeddedSql,
};
