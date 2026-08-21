/**
 * Fold ranges for LN 4GL (no vscode dependency).
 */

const { scanLine } = require("./text");
const { parseDocument } = require("./parse");
const {
  PAIRS,
  tokensOnLine,
  roleInPair,
  isForUpdate,
  isPreprocessorLine,
} = require("./keywords");

/**
 * @typedef {{ start: number, end: number, kind: "region" | "block" }} FoldRange
 */

/**
 * @param {string} text
 * @returns {FoldRange[]}
 */
function computeFoldRanges(text) {
  /** @type {FoldRange[]} */
  const ranges = [];
  const lines = text.split(/\r?\n/);

  for (const node of parseDocument(text)) {
    if (node.endLine > node.line) {
      ranges.push({
        start: node.line,
        end: node.endLine,
        kind: node.kind === "function" ? "block" : "region",
      });
    }
  }

  for (const spec of PAIRS) {
    /** @type {{ line: number }[]} */
    const stack = [];
    let inBlock = false;
    for (let line = 0; line < lines.length; line++) {
      const raw = lines[line];
      const startedInBlock = inBlock;
      inBlock = scanLine(raw, { inBlock: startedInBlock }).inBlock;
      if (isPreprocessorLine(raw)) {
        continue;
      }
      const tokens = tokensOnLine(raw, { inBlock: startedInBlock });
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
          stack.push({ line });
        } else if (role === "close" && stack.length) {
          const open = stack.pop();
          if (open && line > open.line) {
            ranges.push({ start: open.line, end: line, kind: "block" });
          }
        }
      }
    }
  }

  // Brace folding in code spans
  /** @type {{ line: number }[]} */
  const braceStack = [];
  let inBlock = false;
  for (let line = 0; line < lines.length; line++) {
    const raw = lines[line];
    const startedInBlock = inBlock;
    const scanned = scanLine(raw, { inBlock: startedInBlock });
    inBlock = scanned.inBlock;
    for (const span of scanned.spans) {
      if (span.kind !== "code") {
        continue;
      }
      for (let i = span.start; i < span.end; i++) {
        const ch = raw[i];
        if (ch === "{") {
          braceStack.push({ line });
        } else if (ch === "}" && braceStack.length) {
          const open = braceStack.pop();
          if (open && line > open.line) {
            ranges.push({ start: open.line, end: line, kind: "block" });
          }
        }
      }
    }
  }

  return dedupeRanges(ranges);
}

/**
 * @param {FoldRange[]} ranges
 * @returns {FoldRange[]}
 */
function dedupeRanges(ranges) {
  const seen = new Set();
  /** @type {FoldRange[]} */
  const out = [];
  for (const r of ranges) {
    const key = `${r.start}:${r.end}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(r);
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

module.exports = { computeFoldRanges };
