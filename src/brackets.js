/**
 * Unbalanced () {} [] outside strings and comments.
 * Ported from nvim languages/baan/lint/brackets.lua.
 */

const { scanLintDocument } = require("./lint-scan");

const PAIRS_OPEN = { "(": ")", "{": "}", "[": "]" };
const PAIRS_CLOSE = { ")": "(", "}": "{", "]": "[" };

/**
 * @typedef {{
 *   severity: "error" | "warning",
 *   message: string,
 *   code: string,
 *   line: number,
 *   start: number,
 *   end: number,
 * }} LintIssue
 */

/**
 * @param {string} text
 * @returns {LintIssue[]}
 */
function analyzeBrackets(text) {
  const scanned = scanLintDocument(text);
  /** @type {LintIssue[]} */
  const issues = [];
  /** @type {{ char: string, line: number, col: number }[]} */
  const stack = [];

  for (const info of scanned) {
    for (const c of info.codeChars) {
      const ch = c.char;
      if (PAIRS_OPEN[ch]) {
        stack.push({ char: ch, line: info.lnum - 1, col: c.col });
      } else if (PAIRS_CLOSE[ch]) {
        const want = PAIRS_CLOSE[ch];
        const top = stack[stack.length - 1];
        if (!top || top.char !== want) {
          issues.push({
            severity: "error",
            message: `Unexpected '${ch}'`,
            code: "ln-4gl.bracketMismatch",
            line: info.lnum - 1,
            start: c.col,
            end: c.col + 1,
          });
        } else {
          stack.pop();
        }
      }
    }
  }

  const last = scanned[scanned.length - 1];
  for (const open of stack) {
    issues.push({
      severity: "error",
      message: `Unclosed '${open.char}'`,
      code: "ln-4gl.bracketUnclosed",
      line: open.line,
      start: open.col,
      end: last ? last.text.length : open.col + 1,
    });
  }

  return issues;
}

module.exports = { analyzeBrackets };
