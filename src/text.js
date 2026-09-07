/**
 * Shared text helpers for LN 4GL providers.
 * Baan strings: no backslash escapes; embedded quotes are doubled ("").
 * Line comments: pipe [|] to end of line (Progguide vocabulary).
 * C-style slash-star comments are not part of the language.
 */

/**
 * @typedef {"code" | "string" | "lineComment"} ScanKind
 * @typedef {{ kind: ScanKind, start: number, end: number }} ScanSpan
 */

/**
 * Scan one line left-to-right.
 * `inBlock` is accepted for call-site compatibility and always returns false
 * (Baan has no slash-star block comments).
 * @param {string} line
 * @param {{ inBlock?: boolean }} [opts]
 * @returns {{ spans: ScanSpan[], inBlock: boolean }}
 */
function scanLine(line, _opts = {}) {
  /** @type {ScanSpan[]} */
  const spans = [];
  let i = 0;

  const push = (kind, start, end) => {
    if (end > start) {
      spans.push({ kind, start, end });
    }
  };

  while (i < line.length) {
    const ch = line[i];

    if (ch === '"') {
      const start = i;
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      push("string", start, i);
      continue;
    }

    if (ch === "|") {
      push("lineComment", i, line.length);
      break;
    }

    const start = i;
    while (i < line.length) {
      const c = line[i];
      if (c === '"' || c === "|") {
        break;
      }
      i++;
    }
    push("code", start, i);
  }

  return { spans, inBlock: false };
}

/**
 * Code portion of a line: everything before a | line comment that is
 * outside strings. String spans stay included so callers can still see
 * `"a|b"` as code.
 * @param {string} line
 * @param {{ inBlock?: boolean }} [opts]
 */
function codePart(line, opts = {}) {
  const { spans } = scanLine(line, opts);
  let out = "";
  for (const span of spans) {
    if (span.kind === "lineComment") {
      break;
    }
    out += line.slice(span.start, span.end);
  }
  return out;
}

/**
 * Strip | line comments from full document text (for block analysis).
 * Strings are preserved; comment text is replaced with spaces (same length).
 * @param {string} text
 * @returns {string}
 */
function stripComments(text) {
  const lines = text.split(/\r?\n/);
  /** @type {string[]} */
  const out = [];
  for (const line of lines) {
    const scanned = scanLine(line);
    let rebuilt = "";
    let pos = 0;
    for (const span of scanned.spans) {
      if (span.start > pos) {
        rebuilt += " ".repeat(span.start - pos);
      }
      if (span.kind === "code" || span.kind === "string") {
        rebuilt += line.slice(span.start, span.end);
      } else {
        rebuilt += " ".repeat(span.end - span.start);
      }
      pos = span.end;
    }
    if (pos < line.length) {
      rebuilt += " ".repeat(line.length - pos);
    }
    out.push(rebuilt);
  }
  return out.join("\n");
}

/**
 * Kind at character offset on a line.
 * @param {string} line
 * @param {number} character
 * @param {{ inBlock?: boolean }} [opts]
 * @returns {ScanKind}
 */
function kindAt(line, character, opts = {}) {
  const { spans } = scanLine(line, opts);
  for (const span of spans) {
    if (character >= span.start && character < span.end) {
      return span.kind;
    }
  }
  if (spans.length) {
    const last = spans[spans.length - 1];
    if (character >= last.end) {
      return last.kind === "lineComment" ? "lineComment" : "code";
    }
  }
  for (const span of spans) {
    if (character >= span.start && character <= span.end) {
      return span.kind;
    }
  }
  return "code";
}

/**
 * True if position sits in a | line comment or a string.
 * @param {import("vscode").TextDocument} document
 * @param {import("vscode").Position} position
 */
function inCommentOrString(document, position) {
  const text = document.lineAt(position.line).text;
  const kind = kindAt(text, position.character);
  return kind === "lineComment" || kind === "string";
}

module.exports = {
  scanLine,
  codePart,
  stripComments,
  kindAt,
  inCommentOrString,
};
