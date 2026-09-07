/**
 * Continuation caret (^) for unclosed strings and #define bodies.
 * Ported from nvim languages/baan/lint/continuation.lua.
 */

const { scanLintDocument } = require("./lint-scan");

const DEFINE_ENDERS = [
  /^#\s*/,
  /^table\b/,
  /^function\b/,
  /^declaration\s*:/,
  /^dllusage\b/,
  /^enddllusage\b/,
  /^before\./,
  /^after\./,
  /^on\./,
  /^field\./,
  /^choice\./,
  /^main\./,
  /^functions\s*:/,
];

/**
 * @param {string} bare
 */
function isDefineEnder(bare) {
  const lower = bare.toLowerCase();
  return DEFINE_ENDERS.some((pat) => pat.test(lower));
}

/**
 * @param {import("./lint-scan").LintLineInfo[]} scanned
 * @param {number} fromIdx 0-based
 */
function nextContentLine(scanned, fromIdx) {
  for (let j = fromIdx; j < scanned.length; j++) {
    const t = scanned[j];
    const bare = t.text.trim();
    if (bare !== "" && !bare.startsWith("|")) {
      return t;
    }
  }
  return null;
}

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
function analyzeContinuation(text) {
  const scanned = scanLintDocument(text);
  /** @type {LintIssue[]} */
  const issues = [];
  /** @type {Record<number, boolean>} */
  const flagged = {};

  for (let i = 0; i < scanned.length - 1; i++) {
    const prev = scanned[i];

    if (prev.leavesOpenString) {
      const target = nextContentLine(scanned, i + 1);
      if (target && !target.hasCaret && !flagged[target.lnum]) {
        flagged[target.lnum] = true;
        issues.push({
          severity: "error",
          message: "Unclosed string: continuation line must start with '^'",
          code: "ln-4gl.caretString",
          line: target.lnum - 1,
          start: 0,
          end: Math.max(1, target.text.length),
        });
      }
    } else if (
      prev.hasCaret &&
      prev.leavesOpenDefine &&
      !prev.leavesOpenString
    ) {
      const curr = nextContentLine(scanned, i + 1);
      if (curr && !curr.hasCaret && !flagged[curr.lnum]) {
        const bare = curr.text.trim();
        if (!isDefineEnder(bare)) {
          flagged[curr.lnum] = true;
          issues.push({
            severity: "error",
            message: "#define continuation line must start with '^'",
            code: "ln-4gl.caretDefine",
            line: curr.lnum - 1,
            start: 0,
            end: Math.max(1, curr.text.length),
          });
        }
      }
    }
  }

  const last = scanned[scanned.length - 1];
  if (last && last.leavesOpenString) {
    issues.push({
      severity: "error",
      message: "Unclosed string at end of file",
      code: "ln-4gl.caretStringEof",
      line: last.lnum - 1,
      start: Math.max(0, last.text.length - 1),
      end: last.text.length,
    });
  }

  return issues;
}

module.exports = { analyzeContinuation };
