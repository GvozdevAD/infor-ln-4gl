/**
 * Keyword pair specs and line tokenizers for LN 4GL (no vscode dependency).
 */

const { scanLine, codePart } = require("./text");

/** @typedef {{ open: string[], close: string[], middle?: string[] }} PairSpec */

/** @type {PairSpec[]} */
const PAIRS = [
  { open: ["if"], close: ["endif"], middle: ["else", "elif"] },
  { open: ["for"], close: ["endfor"] },
  { open: ["while"], close: ["endwhile"] },
  { open: ["repeat"], close: ["until"] },
  { open: ["select"], close: ["endselect"] },
  // Only `on case` opens the block; inner `case expr:` labels are not openers (Progguide).
  { open: ["on case"], close: ["endcase"] },
  { open: ["dllusage"], close: ["enddllusage"] },
  { open: ["functionusage"], close: ["endfunctionusage"] },
];

/**
 * Collect keyword tokens on a line from code spans only (not strings/comments).
 * @param {string} line
 * @param {{ includeComments?: boolean, inBlock?: boolean }} [opts]
 * @returns {{ word: string, start: number, end: number }[]}
 */
function tokensOnLine(line, opts = {}) {
  const includeComments = Boolean(opts.includeComments);
  const { spans } = scanLine(line, { inBlock: opts.inBlock });
  /** @type {{ word: string, start: number, end: number }[]} */
  const tokens = [];

  for (const span of spans) {
    if (span.kind === "string") {
      continue;
    }
    if (span.kind === "lineComment") {
      if (!includeComments) {
        continue;
      }
    } else if (span.kind !== "code") {
      continue;
    }

    const slice = line.slice(span.start, span.end);
    const multi = /\bon\s+case\b/gi;
    let m;
    /** @type {[number, number][]} */
    const occupied = [];
    while ((m = multi.exec(slice)) !== null) {
      const start = span.start + m.index;
      const end = start + m[0].length;
      tokens.push({ word: "on case", start, end });
      occupied.push([m.index, m.index + m[0].length]);
    }

    const re = /\b[A-Za-z_][\w.]*\b/g;
    while ((m = re.exec(slice)) !== null) {
      const localStart = m.index;
      const localEnd = localStart + m[0].length;
      if (occupied.some(([a, b]) => localStart >= a && localEnd <= b)) {
        continue;
      }
      tokens.push({
        word: m[0],
        start: span.start + localStart,
        end: span.start + localEnd,
      });
    }
  }

  return tokens.sort((a, b) => a.start - b.start);
}

/**
 * @param {string} word
 * @param {PairSpec} spec
 * @returns {"open" | "close" | "middle" | null}
 */
function roleInPair(word, spec) {
  const w = word.toLowerCase();
  if (spec.open.some((o) => o === w)) {
    return "open";
  }
  if (spec.close.some((c) => c === w)) {
    return "close";
  }
  if (spec.middle && spec.middle.some((mid) => mid === w)) {
    return "middle";
  }
  return null;
}

/**
 * True if `for` at token index is the SQL `for update` idiom, not a FOR loop.
 * @param {{ word: string, start: number, end: number }[]} tokens
 * @param {number} index
 */
function isForUpdate(tokens, index) {
  if (tokens[index].word.toLowerCase() !== "for") {
    return false;
  }
  const next = tokens[index + 1];
  return Boolean(next && next.word.toLowerCase() === "update");
}

/**
 * True if the line is a preprocessor directive (`#if`, `#endif`, …).
 * @param {string} line
 */
function isPreprocessorLine(line) {
  return /^\s*#/.test(codePart(line));
}

module.exports = {
  PAIRS,
  tokensOnLine,
  roleInPair,
  isForUpdate,
  isPreprocessorLine,
};
