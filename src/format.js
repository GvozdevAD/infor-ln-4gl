/**
 * Indent-only formatting for LN 4GL (no vscode dependency).
 * Changes leading whitespace only; never trims trailing spaces or rewrites code.
 */

const { scanLine, codePart } = require("./text");
const {
  PAIRS,
  tokensOnLine,
  roleInPair,
  isForUpdate,
  isPreprocessorLine,
} = require("./keywords");
const { SECTION_LINE, FUNCTION_LINE } = require("./parse");
const { isInsideUsageDoc, isUsagePairSpec } = require("./usage-context");

const SELECT_BODY_KEYS = new Set([
  "selectdo",
  "selectempty",
  "selecterror",
  "selecteos",
]);

const CONTROL_PAIRS = PAIRS.filter(
  (p) => p.open[0] !== "select" && p.open[0] !== "on case",
);
/** @type {typeof PAIRS[number] | undefined} */
const ON_CASE_SPEC = PAIRS.find((p) => p.open[0] === "on case");

const ON_CASE_LABEL = /^\s*(case\s+.+\s*:|default\s*:)/i;

/**
 * @param {Frame[]} stack
 * @returns {Frame | undefined}
 */
function topOnCaseFrame(stack) {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].kind === "oncase") {
      return stack[i];
    }
  }
  return undefined;
}

/**
 * @typedef {{
 *   kind: "control" | "select" | "brace" | "oncase",
 *   openLevel: number,
 *   inSelectBody?: boolean,
 * }} Frame
 *
 * @typedef {{
 *   line: number,
 *   start: number,
 *   end: number,
 *   newText: string,
 * }} IndentEdit
 */

/**
 * @param {Frame[]} stack
 * @param {number} sectionBase
 */
function contentLevel(stack, sectionBase) {
  if (!stack.length) {
    return sectionBase;
  }
  const top = stack[stack.length - 1];
  if (top.kind === "select") {
    return top.inSelectBody ? top.openLevel + 1 : top.openLevel;
  }
  return top.openLevel + 1;
}

/**
 * Braces in code spans only (not strings/comments).
 * @param {string} line
 * @param {boolean} inBlock
 * @returns {{ ch: "{" | "}", start: number }[]}
 */
function bracesOnLine(line, inBlock) {
  const { spans } = scanLine(line, { inBlock });
  /** @type {{ ch: "{" | "}", start: number }[]} */
  const out = [];
  for (const span of spans) {
    if (span.kind !== "code") {
      continue;
    }
    for (let i = span.start; i < span.end; i++) {
      const ch = line[i];
      if (ch === "{" || ch === "}") {
        out.push({ ch, start: i });
      }
    }
  }
  return out;
}

/**
 * Leading whitespace length (spaces/tabs only).
 * @param {string} line
 */
function leadingWsLength(line) {
  let i = 0;
  while (i < line.length && (line[i] === " " || line[i] === "\t")) {
    i++;
  }
  return i;
}

/**
 * @param {number} level
 * @param {{ tabSize?: number, insertSpaces?: boolean }} options
 */
function indentString(level, options) {
  const tabSize = options.tabSize ?? 4;
  const insertSpaces = options.insertSpaces !== false;
  if (level <= 0) {
    return "";
  }
  if (insertSpaces) {
    return " ".repeat(level * tabSize);
  }
  return "\t".repeat(level);
}

/**
 * Desired indent level per line, or null to leave leading ws unchanged.
 * @param {string} text
 * @returns {(number | null)[]}
 */
function computeIndentLevels(text) {
  const lines = text.split(/\r?\n/);
  /** @type {(number | null)[]} */
  const levels = [];
  /** @type {Frame[]} */
  const stack = [];
  let sectionBase = 0;
  let inBlock = false;

  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const raw = lines[lineNo];
    const startedInBlock = inBlock;
    inBlock = scanLine(raw, { inBlock: startedInBlock }).inBlock;

    if (isPreprocessorLine(raw)) {
      levels.push(null);
      continue;
    }

    const blank = leadingWsLength(raw) === raw.length;
    if (blank) {
      // Keep blank / whitespace-only lines byte-stable (LN Tools).
      levels.push(null);
      continue;
    }

    const code = codePart(raw);
    const isOnCaseLabelLine = ON_CASE_LABEL.test(code);

    const sectionMatch = !isOnCaseLabelLine && raw.match(SECTION_LINE);
    if (sectionMatch) {
      levels.push(0);
      const name = sectionMatch[1];
      sectionBase = /^functions$/i.test(name) ? 0 : 1;
      continue;
    }

    const isFn = FUNCTION_LINE.test(raw);
    const tokens = tokensOnLine(raw, { inBlock: startedInBlock });
    const braces = bracesOnLine(raw, startedInBlock);
    const inUsage = isInsideUsageDoc(text, lineNo);

    /** @type {{ kind: string, index: number }[]} */
    const events = [];
    for (let ti = 0; ti < tokens.length; ti++) {
      const t = tokens[ti];
      const w = t.word.toLowerCase();
      if (inUsage) {
        // Only Usage open/close affect indent; prose keywords do not.
        for (const spec of CONTROL_PAIRS) {
          if (!isUsagePairSpec(spec)) {
            continue;
          }
          const role = roleInPair(t.word, spec);
          if (role) {
            events.push({ kind: role, index: t.start });
            break;
          }
        }
        continue;
      }
      if (SELECT_BODY_KEYS.has(w)) {
        events.push({ kind: "select-middle", index: t.start });
        continue;
      }
      if (w === "select") {
        events.push({ kind: "select-open", index: t.start });
        continue;
      }
      if (w === "endselect") {
        events.push({ kind: "select-close", index: t.start });
        continue;
      }
      if (ON_CASE_SPEC) {
        const onCaseRole = roleInPair(t.word, ON_CASE_SPEC);
        if (onCaseRole === "open") {
          events.push({ kind: "oncase-open", index: t.start });
          continue;
        }
        if (onCaseRole === "close") {
          events.push({ kind: "oncase-close", index: t.start });
          continue;
        }
      }
      for (const spec of CONTROL_PAIRS) {
        const role = roleInPair(t.word, spec);
        if (!role) {
          continue;
        }
        if (role === "open" && isForUpdate(tokens, ti)) {
          continue;
        }
        events.push({ kind: role, index: t.start });
        break;
      }
    }
    for (const b of braces) {
      events.push({
        kind: b.ch === "{" ? "brace-open" : "brace-close",
        index: b.start,
      });
    }
    events.sort((a, b) => a.index - b.index);

    let lineLevel = isFn ? 0 : contentLevel(stack, sectionBase);
    const onCaseFrame = topOnCaseFrame(stack);
    const opensOnCase = events.some((e) => e.kind === "oncase-open");
    const closesOnCase = events.some((e) => e.kind === "oncase-close");

    if (!isFn && onCaseFrame && !opensOnCase) {
      if (closesOnCase) {
        lineLevel = onCaseFrame.openLevel;
      } else if (ON_CASE_LABEL.test(code)) {
        lineLevel = onCaseFrame.openLevel + 1;
      } else {
        lineLevel = onCaseFrame.openLevel + 2;
      }
    } else if (!isFn && events.length) {
      const first = events[0];
      if (
        first.kind === "close" ||
        first.kind === "middle" ||
        first.kind === "select-close" ||
        first.kind === "select-middle" ||
        first.kind === "brace-close"
      ) {
        if (stack.length) {
          lineLevel = stack[stack.length - 1].openLevel;
        } else {
          lineLevel = sectionBase;
        }
      }
    }

    levels.push(lineLevel);

    for (const ev of events) {
      if (ev.kind === "brace-open") {
        stack.push({
          kind: "brace",
          openLevel: lineLevel,
        });
      } else if (ev.kind === "brace-close") {
        if (stack.length && stack[stack.length - 1].kind === "brace") {
          stack.pop();
        } else {
          while (stack.length && stack[stack.length - 1].kind !== "brace") {
            stack.pop();
          }
          if (stack.length) {
            stack.pop();
          }
        }
      } else if (ev.kind === "select-open") {
        stack.push({
          kind: "select",
          openLevel: lineLevel,
          inSelectBody: false,
        });
      } else if (ev.kind === "select-middle") {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].kind === "select") {
            stack[i].inSelectBody = true;
            break;
          }
        }
      } else if (ev.kind === "select-close") {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].kind === "select") {
            stack.splice(i, 1);
            break;
          }
        }
      } else if (ev.kind === "oncase-open") {
        stack.push({
          kind: "oncase",
          openLevel: lineLevel,
        });
      } else if (ev.kind === "oncase-close") {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].kind === "oncase") {
            stack.splice(i, 1);
            break;
          }
        }
      } else if (ev.kind === "open") {
        stack.push({
          kind: "control",
          openLevel: lineLevel,
        });
      } else if (ev.kind === "close") {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].kind === "control") {
            stack.splice(i, 1);
            break;
          }
        }
      }
    }

    if (isFn) {
      sectionBase = 0;
    }
  }

  return levels;
}

/**
 * @param {string} text
 * @param {{ tabSize?: number, insertSpaces?: boolean }} [options]
 * @returns {IndentEdit[]}
 */
function computeIndentEdits(text, options = {}) {
  const lines = text.split(/\r?\n/);
  const levels = computeIndentLevels(text);
  /** @type {IndentEdit[]} */
  const edits = [];

  for (let i = 0; i < lines.length; i++) {
    const level = levels[i];
    if (level === null || level === undefined) {
      continue;
    }
    const raw = lines[i];
    const lead = leadingWsLength(raw);
    const desired = indentString(level, options);
    if (raw.slice(0, lead) === desired) {
      continue;
    }
    edits.push({
      line: i,
      start: 0,
      end: lead,
      newText: desired,
    });
  }

  return edits;
}

/**
 * Apply indent edits; preserve everything else (including trailing spaces).
 * @param {string} text
 * @param {{ tabSize?: number, insertSpaces?: boolean }} [options]
 */
function formatText(text, options = {}) {
  const lines = text.split(/\r?\n/);
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const levels = computeIndentLevels(text);

  const out = lines.map((raw, i) => {
    const level = levels[i];
    if (level === null || level === undefined) {
      return raw;
    }
    const lead = leadingWsLength(raw);
    return indentString(level, options) + raw.slice(lead);
  });

  // split keeps a trailing "" when text ends with EOL; join restores that EOL.
  return out.join(eol);
}

module.exports = {
  computeIndentLevels,
  computeIndentEdits,
  formatText,
  indentString,
  leadingWsLength,
};
