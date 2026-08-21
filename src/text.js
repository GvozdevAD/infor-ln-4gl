/**
 * Shared text helpers for LN 4GL providers.
 * Baan strings: no backslash escapes; embedded quotes are doubled ("").
 * Line comments start at | outside strings. Block comments use slash-star … star-slash.
 */

/**
 * @typedef {"code" | "string" | "lineComment" | "blockComment"} ScanKind
 * @typedef {{ kind: ScanKind, start: number, end: number }} ScanSpan
 */

/**
 * Scan one line left-to-right. Optionally continue an open block comment
 * from a previous line (`inBlock` true).
 * @param {string} line
 * @param {{ inBlock?: boolean }} [opts]
 * @returns {{ spans: ScanSpan[], inBlock: boolean }}
 */
function scanLine(line, opts = {}) {
  /** @type {ScanSpan[]} */
  const spans = [];
  let i = 0;
  let inBlock = Boolean(opts.inBlock);

  const push = (kind, start, end) => {
    if (end > start) {
      spans.push({ kind, start, end });
    }
  };

  while (i < line.length) {
    if (inBlock) {
      const close = line.indexOf("*/", i);
      if (close === -1) {
        push("blockComment", i, line.length);
        return { spans, inBlock: true };
      }
      push("blockComment", i, close + 2);
      i = close + 2;
      inBlock = false;
      continue;
    }

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

    if (ch === "|" ) {
      push("lineComment", i, line.length);
      break;
    }

    if (ch === "/" && line[i + 1] === "*") {
      const start = i;
      i += 2;
      const close = line.indexOf("*/", i);
      if (close === -1) {
        push("blockComment", start, line.length);
        return { spans, inBlock: true };
      }
      push("blockComment", start, close + 2);
      i = close + 2;
      continue;
    }

    const start = i;
    while (i < line.length) {
      const c = line[i];
      if (c === '"' || c === "|") {
        break;
      }
      if (c === "/" && line[i + 1] === "*") {
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
 * outside strings and slash-star block comments. String spans stay included
 * so callers can still see `"a|b"` as code.
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
    if (span.kind === "blockComment") {
      out += " ".repeat(span.end - span.start);
      continue;
    }
    out += line.slice(span.start, span.end);
  }
  return out;
}

/**
 * Strip | and slash-star block comments from full document text (for block analysis).
 * Strings are preserved; comment text is replaced with spaces (same length).
 * @param {string} text
 * @returns {string}
 */
function stripComments(text) {
  const lines = text.split(/\r?\n/);
  /** @type {string[]} */
  const out = [];
  let inBlock = false;
  for (const line of lines) {
    const scanned = scanLine(line, { inBlock });
    inBlock = scanned.inBlock;
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
  const { spans, inBlock } = scanLine(line, opts);
  for (const span of spans) {
    if (character >= span.start && character < span.end) {
      return span.kind;
    }
    // At end of span: treat as that span for caret sitting on last char+1 edge
    if (character === span.end && span.kind !== "code") {
      // fall through; prefer next span if any
    }
  }
  if (inBlock) {
    return "blockComment";
  }
  // Caret at end of line after code
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
 * True if position sits in a | line comment, a slash-star block comment, or a string.
 * @param {import("vscode").TextDocument} document
 * @param {import("vscode").Position} position
 */
function inCommentOrString(document, position) {
  let inBlock = false;
  for (let line = 0; line < position.line; line++) {
    inBlock = scanLine(document.lineAt(line).text, { inBlock }).inBlock;
  }
  const text = document.lineAt(position.line).text;
  const kind = kindAt(text, position.character, { inBlock });
  return kind === "lineComment" || kind === "blockComment" || kind === "string";
}

module.exports = {
  scanLine,
  codePart,
  stripComments,
  kindAt,
  inCommentOrString,
};
