/**
 * Block-matching analysis for LN 4GL (no vscode dependency).
 */

const { scanLine } = require("./text");
const {
  PAIRS,
  tokensOnLine,
  roleInPair,
  isForUpdate,
  isPreprocessorLine,
} = require("./keywords");

/**
 * @typedef {{
 *   severity: "error" | "warning",
 *   message: string,
 *   code: string,
 *   line: number,
 *   start: number,
 *   end: number,
 * }} BlockIssue
 */

/**
 * @param {string} text
 * @param {{ includeComments?: boolean }} opts
 * @param {(line: number, tokens: { word: string, start: number, end: number }[]) => void} visit
 */
function walkLines(text, opts, visit) {
  const lines = text.split(/\r?\n/);
  let inBlock = false;
  for (let line = 0; line < lines.length; line++) {
    const raw = lines[line];
    const startedInBlock = inBlock;
    inBlock = scanLine(raw, { inBlock }).inBlock;
    if (isPreprocessorLine(raw)) {
      continue;
    }
    const tokens = tokensOnLine(raw, {
      includeComments: opts.includeComments,
      inBlock: startedInBlock,
    });
    visit(line, tokens);
  }
}

/**
 * Analyze control-structure pairing in source text.
 * @param {string} text
 * @param {{ strictComments?: boolean }} [opts]
 * @returns {BlockIssue[]}
 */
function analyzeBlocks(text, opts = {}) {
  const includeComments = opts.strictComments === false;
  /** @type {BlockIssue[]} */
  const issues = [];

  for (const spec of PAIRS) {
    /** @type {{ line: number, start: number, end: number, word: string }[]} */
    const stack = [];

    walkLines(text, { includeComments }, (line, tokens) => {
      for (let ti = 0; ti < tokens.length; ti++) {
        const t = tokens[ti];
        const role = roleInPair(t.word, spec);
        if (!role) {
          continue;
        }
        if (role === "open" && isForUpdate(tokens, ti)) {
          continue;
        }

        if (role === "open") {
          stack.push({
            line,
            start: t.start,
            end: t.end,
            word: t.word.toLowerCase(),
          });
        } else if (role === "close") {
          if (!stack.length) {
            issues.push({
              severity: "error",
              message: `Unexpected '${t.word.toLowerCase()}' without matching '${spec.open[0]}'`,
              code: "ln-4gl.unmatchedClose",
              line,
              start: t.start,
              end: t.end,
            });
          } else {
            stack.pop();
          }
        } else if (role === "middle") {
          if (!stack.length) {
            issues.push({
              severity: "error",
              message: `'${t.word.toLowerCase()}' outside of '${spec.open[0]}' … '${spec.close[0]}'`,
              code: "ln-4gl.elseOutsideIf",
              line,
              start: t.start,
              end: t.end,
            });
          }
        }
      }
    });

    for (const open of stack) {
      issues.push({
        severity: "error",
        message: `Unclosed '${open.word}' (expected '${spec.close[0]}')`,
        code: "ln-4gl.unclosedOpen",
        line: open.line,
        start: open.start,
        end: open.end,
      });
    }
  }

  return issues;
}

/**
 * Idiom slips: `for … by` and `while … do`.
 * @param {string} text
 * @param {{ strictComments?: boolean }} [opts]
 * @returns {BlockIssue[]}
 */
function analyzeIdioms(text, opts = {}) {
  const includeComments = opts.strictComments === false;
  /** @type {BlockIssue[]} */
  const issues = [];

  walkLines(text, { includeComments }, (line, tokens) => {
    for (let ti = 0; ti < tokens.length; ti++) {
      const t = tokens[ti];
      const w = t.word.toLowerCase();

      if (w === "for" && !isForUpdate(tokens, ti)) {
        for (let j = ti + 1; j < tokens.length; j++) {
          const tw = tokens[j].word.toLowerCase();
          if (tw === "endfor" || tw === "for" || tw === "while" || tw === "if") {
            break;
          }
          if (tw === "by") {
            issues.push({
              severity: "warning",
              message: "Use 'step' instead of 'by' in Baan C FOR loops",
              code: "ln-4gl.forBy",
              line,
              start: tokens[j].start,
              end: tokens[j].end,
            });
            break;
          }
        }
      }

      if (w === "while") {
        for (let j = ti + 1; j < tokens.length; j++) {
          const tw = tokens[j].word.toLowerCase();
          if (tw === "endwhile" || tw === "while" || tw === "for" || tw === "if") {
            break;
          }
          if (tw === "do") {
            issues.push({
              severity: "warning",
              message: "Baan C WHILE has no 'do' keyword",
              code: "ln-4gl.whileDo",
              line,
              start: tokens[j].start,
              end: tokens[j].end,
            });
            break;
          }
        }
      }
    }
  });

  return issues;
}

/**
 * All structural + idiom issues.
 * @param {string} text
 * @param {{ strictComments?: boolean }} [opts]
 * @returns {BlockIssue[]}
 */
function analyzeDocument(text, opts = {}) {
  return [...analyzeBlocks(text, opts), ...analyzeIdioms(text, opts)];
}

module.exports = {
  analyzeBlocks,
  analyzeIdioms,
  analyzeDocument,
};
