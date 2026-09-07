/**
 * Local function call sites and #define name usages for semantic highlighting
 * (no vscode dependency).
 */

const { functionIndex, FUNCTION_LINE } = require("./parse");
const { scanLine } = require("./text");
const { WORD_RE } = require("./idents");

/** `#define NAME` or `#define NAME(` — capture the macro name. */
const DEFINE_LINE = /^\s*#\s*define\s+([A-Za-z_][A-Za-z0-9_.$]*)/;

/**
 * True when `(` is the next non-whitespace code token after the given position,
 * possibly on a following line.
 * @param {string[]} lines
 * @param {number} startLine
 * @param {number} startChar index immediately after the identifier
 * @param {boolean} inBlockAtLineStart
 * @returns {boolean}
 */
function isFollowedByOpenParen(lines, startLine, startChar, inBlockAtLineStart) {
  let inBlock = inBlockAtLineStart;

  for (let ln = startLine; ln < lines.length; ln++) {
    const scanned = scanLine(lines[ln], {
      inBlock: ln === startLine ? inBlockAtLineStart : inBlock,
    });
    inBlock = scanned.inBlock;

    for (const span of scanned.spans) {
      if (span.kind !== "code") {
        continue;
      }
      const sliceStart =
        ln === startLine ? Math.max(span.start, startChar) : span.start;
      if (sliceStart >= span.end) {
        continue;
      }
      const slice = lines[ln].slice(sliceStart, span.end);
      for (let i = 0; i < slice.length; i++) {
        const ch = slice[i];
        if (/\s/.test(ch)) {
          continue;
        }
        return ch === "(";
      }
    }
  }
  return false;
}

/**
 * @param {string} line
 * @param {string} word
 * @param {number} start
 * @param {number} end
 * @returns {boolean}
 */
function isFunctionDeclarationSite(line, word, start, end) {
  const m = line.match(FUNCTION_LINE);
  if (!m) {
    return false;
  }
  const name = m[1];
  if (name.toLowerCase() !== word.toLowerCase()) {
    return false;
  }
  const nameStart = line.indexOf(name);
  return start === nameStart && end === nameStart + name.length;
}

/**
 * Names introduced by `#define` in this text (lowercase keys → original casing).
 * @param {string} text
 * @returns {Map<string, string>}
 */
function extractDefineNames(text) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\|/.test(line)) {
      continue;
    }
    const m = line.match(DEFINE_LINE);
    if (!m) {
      continue;
    }
    const name = m[1];
    const key = name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, name);
    }
  }
  return map;
}

/**
 * True when this occurrence is the macro name on its `#define` line.
 * @param {string} line
 * @param {string} word
 * @param {number} start
 * @param {number} end
 */
function isDefineDeclarationSite(line, word, start, end) {
  const m = line.match(DEFINE_LINE);
  if (!m) {
    return false;
  }
  if (m[1].toLowerCase() !== word.toLowerCase()) {
    return false;
  }
  const nameStart = line.indexOf(m[1], line.indexOf("define"));
  return start === nameStart && end === nameStart + m[1].length;
}

/**
 * Call sites whose name is in `knownNames` (lowercase keys).
 * @param {string} text
 * @param {Set<string> | Map<string, unknown>} knownNames
 * @returns {{ line: number, start: number, end: number, name: string }[]}
 */
function findFunctionCalls(text, knownNames) {
  if (!knownNames || knownNames.size === 0) {
    return [];
  }

  const lines = text.split(/\r?\n/);
  /** @type {{ line: number, start: number, end: number, name: string }[]} */
  const out = [];
  let inBlock = false;

  for (let line = 0; line < lines.length; line++) {
    const raw = lines[line];
    const inBlockAtStart = inBlock;
    const scanned = scanLine(raw, { inBlock: inBlockAtStart });
    inBlock = scanned.inBlock;

    for (const span of scanned.spans) {
      if (span.kind !== "code") {
        continue;
      }
      const slice = raw.slice(span.start, span.end);
      WORD_RE.lastIndex = 0;
      let m;
      while ((m = WORD_RE.exec(slice)) !== null) {
        const word = m[0];
        const start = span.start + m.index;
        const end = start + word.length;
        const key = word.toLowerCase();
        if (!knownNames.has(key)) {
          continue;
        }
        if (isFunctionDeclarationSite(raw, word, start, end)) {
          continue;
        }
        if (!isFollowedByOpenParen(lines, line, end, inBlockAtStart)) {
          continue;
        }
        out.push({ line, start, end, name: word });
      }
    }
  }

  return out;
}

/**
 * Usages of `#define` names in code (not the `#define` name itself).
 * @param {string} text
 * @param {Map<string, string> | Set<string>} [defineNames]
 * @returns {{ line: number, start: number, end: number, name: string }[]}
 */
function findDefineUsages(text, defineNames = extractDefineNames(text)) {
  if (!defineNames || defineNames.size === 0) {
    return [];
  }

  const lines = text.split(/\r?\n/);
  /** @type {{ line: number, start: number, end: number, name: string }[]} */
  const out = [];
  let inBlock = false;

  for (let line = 0; line < lines.length; line++) {
    const raw = lines[line];
    const scanned = scanLine(raw, { inBlock });
    inBlock = scanned.inBlock;

    for (const span of scanned.spans) {
      if (span.kind !== "code") {
        continue;
      }
      const slice = raw.slice(span.start, span.end);
      WORD_RE.lastIndex = 0;
      let m;
      while ((m = WORD_RE.exec(slice)) !== null) {
        const word = m[0];
        const start = span.start + m.index;
        const end = start + word.length;
        if (!defineNames.has(word.toLowerCase())) {
          continue;
        }
        if (isDefineDeclarationSite(raw, word, start, end)) {
          continue;
        }
        out.push({ line, start, end, name: word });
      }
    }
  }

  return out;
}

/**
 * Calls to functions declared in the same file.
 * @param {string} text
 * @returns {{ line: number, start: number, end: number, name: string }[]}
 */
function findLocalFunctionCalls(text) {
  return findFunctionCalls(text, functionIndex(text));
}

module.exports = {
  DEFINE_LINE,
  extractDefineNames,
  findDefineUsages,
  findFunctionCalls,
  findLocalFunctionCalls,
  isDefineDeclarationSite,
  isFollowedByOpenParen,
  isFunctionDeclarationSite,
};
