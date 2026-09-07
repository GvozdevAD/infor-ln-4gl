/**
 * Line scanner for Baan lint: | comments, "…" strings ("" escape),
 * #define / ^ continuation state. Ported from nvim languages/baan/lint/scan.lua.
 */

/**
 * @typedef {{ inString: boolean, inDefine: boolean }} LintScanState
 * @typedef {{ col: number, char: string }} CodeChar
 * @typedef {{
 *   lnum: number,
 *   text: string,
 *   hasCaret: boolean,
 *   caretCol: number | null,
 *   inStringAtStart: boolean,
 *   inDefineAtStart: boolean,
 *   leavesOpenString: boolean,
 *   leavesOpenDefine: boolean,
 *   isDefineStart: boolean,
 *   codeChars: CodeChar[],
 * }} LintLineInfo
 */

/**
 * @param {string} text
 * @returns {{ hasCaret: boolean, caretCol: number | null, contentStart: number }}
 */
function parseCaret(text) {
  let i = 0;
  while (i < text.length && /\s/.test(text[i])) {
    i++;
  }
  if (text[i] === "^") {
    return { hasCaret: true, caretCol: i, contentStart: i + 1 };
  }
  return { hasCaret: false, caretCol: null, contentStart: 0 };
}

/**
 * @param {string} text
 * @param {number} start
 * @param {boolean} inString
 */
function startsDefine(text, start, inString) {
  if (inString) {
    return false;
  }
  const rest = text.slice(start).replace(/^\s*/, "");
  if (rest.startsWith("|")) {
    return false;
  }
  return /^#\s*define(?:\s|\()/.test(rest);
}

/**
 * @param {number} lnum 1-based
 * @param {string} text
 * @param {LintScanState} [prev]
 * @returns {{ info: LintLineInfo, state: LintScanState }}
 */
function scanLintLine(lnum, text, prev = { inString: false, inDefine: false }) {
  const { hasCaret, caretCol, contentStart } = parseCaret(text);
  let inString = Boolean(prev.inString);
  const inStringAtStart = inString;
  const inDefineAtStart = Boolean(prev.inDefine);

  let inDefine = false;
  if (inStringAtStart) {
    inDefine = inDefineAtStart;
  } else if (hasCaret && inDefineAtStart) {
    inDefine = true;
  }

  const isDefineStart = startsDefine(text, contentStart, inString);
  if (isDefineStart) {
    inDefine = true;
  }

  /** @type {CodeChar[]} */
  const codeChars = [];
  let i = contentStart;
  while (i < text.length) {
    const ch = text[i];
    if (inString) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          i += 2;
        } else {
          inString = false;
          i++;
        }
      } else {
        i++;
      }
    } else if (ch === "|") {
      break;
    } else if (ch === '"') {
      inString = true;
      i++;
    } else {
      codeChars.push({ col: i, char: ch });
      i++;
    }
  }

  const leavesOpenDefine = inDefine;
  /** @type {LintLineInfo} */
  const info = {
    lnum,
    text,
    hasCaret,
    caretCol,
    inStringAtStart,
    inDefineAtStart,
    leavesOpenString: inString,
    leavesOpenDefine,
    isDefineStart,
    codeChars,
  };

  return {
    info,
    state: { inString, inDefine: leavesOpenDefine },
  };
}

/**
 * @param {string} text full document
 * @returns {LintLineInfo[]}
 */
function scanLintDocument(text) {
  const lines = text.split(/\r?\n/);
  /** @type {LintLineInfo[]} */
  const result = [];
  let state = { inString: false, inDefine: false };
  for (let i = 0; i < lines.length; i++) {
    const scanned = scanLintLine(i + 1, lines[i], state);
    result.push(scanned.info);
    state = scanned.state;
  }
  return result;
}

module.exports = {
  parseCaret,
  scanLintLine,
  scanLintDocument,
};
