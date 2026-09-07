/**
 * Block-matching analysis for LN 4GL (no vscode dependency).
 */

const { scanLine, codePart } = require("./text");
const {
  PAIRS,
  tokensOnLine,
  roleInPair,
  isForUpdate,
  isPreprocessorLine,
} = require("./keywords");
const { isInsideEmbeddedSql } = require("./sql-context");
const { isInsideUsageDoc, isUsagePairSpec } = require("./usage-context");
const { buildTypeIndex, lookupType } = require("./type-index");

/** @type {typeof PAIRS[number] | undefined} */
const IF_PAIR = PAIRS.find((p) => p.open[0] === "if");
/** @type {typeof PAIRS[number] | undefined} */
const ON_CASE_PAIR = PAIRS.find((p) => p.open[0] === "on case");

const LONG_IF_SKIP = new Set(["true", "false"]);
const LONG_IF_COMPARISON = /=|<>|<=|>=|<|>|\band\b|\bor\b|\bnot\b/i;
const ON_CASE_LABEL = /^\s*(case\s+.+\s*:|default\s*:)/i;
const CASE_EXPR = /^\s*case\s+(.+?)\s*:/i;

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
      const inSql = isInsideEmbeddedSql(text, line);
      const inUsage = isInsideUsageDoc(text, line);
      for (let ti = 0; ti < tokens.length; ti++) {
        const t = tokens[ti];
        const role = roleInPair(t.word, spec);
        if (!role) {
          continue;
        }
        // Prose inside DllUsage / FunctionUsage must not open for/if/while/…
        if (inUsage && !isUsagePairSpec(spec)) {
          continue;
        }
        if (
          inSql &&
          spec === IF_PAIR &&
          role === "middle"
        ) {
          continue;
        }
        if (
          inSql &&
          spec === ON_CASE_PAIR &&
          role === "close"
        ) {
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
    if (isInsideUsageDoc(text, line)) {
      return;
    }
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
 * Normalize a CASE label expression for duplicate detection.
 * @param {string} expr
 */
function normalizeCaseExpr(expr) {
  return expr.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Duplicate CASE expressions inside ON CASE blocks.
 * @param {string} text
 * @param {{ strictComments?: boolean }} [opts]
 * @returns {BlockIssue[]}
 */
function analyzeOnCaseDuplicates(text, opts = {}) {
  const includeComments = opts.strictComments === false;
  const lines = text.split(/\r?\n/);
  /** @type {BlockIssue[]} */
  const issues = [];
  /** @type {{ seen: Map<string, { line: number, start: number, end: number }> }[]} */
  const stack = [];
  let inBlock = false;

  for (let line = 0; line < lines.length; line++) {
    const raw = lines[line];
    const startedInBlock = inBlock;
    inBlock = scanLine(raw, { inBlock: startedInBlock }).inBlock;
    if (isPreprocessorLine(raw)) {
      continue;
    }
    if (isInsideEmbeddedSql(text, line)) {
      continue;
    }
    if (isInsideUsageDoc(text, line)) {
      continue;
    }

    const tokens = tokensOnLine(raw, {
      includeComments,
      inBlock: startedInBlock,
    });

    if (stack.length) {
      const code = codePart(raw);
      const match = code.match(CASE_EXPR);
      if (match) {
        const expr = normalizeCaseExpr(match[1]);
        const frame = stack[stack.length - 1];
        const caseTok = tokens.find((t) => t.word.toLowerCase() === "case");
        const colonIdx = raw.indexOf(":", caseTok ? caseTok.start : 0);
        const start = caseTok ? caseTok.start : 0;
        const end = colonIdx >= 0 ? colonIdx + 1 : raw.length;
        if (frame.seen.has(expr)) {
          issues.push({
            severity: "warning",
            message:
              "Duplicate CASE expression in ON CASE (undefined evaluation order)",
            code: "ln-4gl.duplicateCase",
            line,
            start,
            end,
          });
        } else {
          frame.seen.set(expr, { line, start, end });
        }
      }
    }

    for (const t of tokens) {
      if (!ON_CASE_PAIR) {
        break;
      }
      const role = roleInPair(t.word, ON_CASE_PAIR);
      if (role === "open") {
        stack.push({ seen: new Map() });
      } else if (role === "close" && stack.length) {
        stack.pop();
      }
    }
  }

  return issues;
}

/**
 * Deprecated long (non-boolean) as IF condition.
 * Guide: boolean is OK; bare long as boolean is warning → future error.
 * @param {string} text
 * @param {{ strictComments?: boolean }} [opts]
 * @returns {BlockIssue[]}
 */
function analyzeDeprecatedLongIf(text, opts = {}) {
  const includeComments = opts.strictComments === false;
  const types = buildTypeIndex(text);
  /** @type {BlockIssue[]} */
  const issues = [];

  walkLines(text, { includeComments }, (line, tokens) => {
    if (isInsideUsageDoc(text, line) || isInsideEmbeddedSql(text, line)) {
      return;
    }
    const raw = text.split(/\r?\n/)[line];
    const code = codePart(raw);
    if (LONG_IF_COMPARISON.test(code)) {
      return;
    }

    for (let ti = 0; ti < tokens.length; ti++) {
      if (tokens[ti].word.toLowerCase() !== "if") {
        continue;
      }
      const ident = tokens[ti + 1];
      const thenTok = tokens[ti + 2];
      if (!ident || !thenTok || thenTok.word.toLowerCase() !== "then") {
        continue;
      }
      if (!/^[A-Za-z_][\w.$]*$/.test(ident.word)) {
        continue;
      }
      const name = ident.word.toLowerCase();
      if (LONG_IF_SKIP.has(name)) {
        continue;
      }
      if (tokens.length !== 3) {
        continue;
      }
      if (lookupType(types, ident.word) === "boolean") {
        continue;
      }
      issues.push({
        severity: "warning",
        message:
          "Bare long (non-boolean) as IF condition is deprecated; use an explicit comparison (e.g. <> 0)",
        code: "ln-4gl.deprecatedLongIf",
        line,
        start: ident.start,
        end: ident.end,
      });
      break;
    }
  });

  return issues;
}

/**
 * All structural + idiom issues.
 * @param {string} text
 * @param {{ strictComments?: boolean, duplicateCase?: boolean, deprecatedLongIf?: boolean }} [opts]
 * @returns {BlockIssue[]}
 */
function analyzeDocument(text, opts = {}) {
  const issues = [...analyzeBlocks(text, opts), ...analyzeIdioms(text, opts)];
  if (opts.duplicateCase !== false) {
    issues.push(...analyzeOnCaseDuplicates(text, opts));
  }
  if (opts.deprecatedLongIf !== false) {
    issues.push(...analyzeDeprecatedLongIf(text, opts));
  }
  return issues;
}

module.exports = {
  analyzeBlocks,
  analyzeIdioms,
  analyzeOnCaseDuplicates,
  analyzeDeprecatedLongIf,
  analyzeDocument,
};
