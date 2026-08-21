const vscode = require("vscode");
const { inCommentOrString, codePart } = require("./text");

/** @typedef {{ open: string[], close: string[], middle?: string[] }} PairSpec */

/** @type {PairSpec[]} */
const PAIRS = [
  { open: ["if"], close: ["endif"], middle: ["else"] },
  { open: ["for"], close: ["endfor"] },
  { open: ["while"], close: ["endwhile"] },
  { open: ["repeat"], close: ["until"] },
  { open: ["select"], close: ["endselect"] },
  { open: ["case", "on case"], close: ["endcase"] },
];

/**
 * Collect keyword tokens on a line (outside strings), with column starts.
 * @param {string} line
 * @returns {{ word: string, start: number, end: number }[]}
 */
function tokensOnLine(line) {
  const code = codePart(line);
  /** @type {{ word: string, start: number, end: number }[]} */
  const tokens = [];
  // Multi-word first
  const multi = /\bon\s+case\b/gi;
  let m;
  const occupied = [];
  while ((m = multi.exec(code)) !== null) {
    tokens.push({
      word: "on case",
      start: m.index,
      end: m.index + m[0].length,
    });
    occupied.push([m.index, m.index + m[0].length]);
  }

  const re = /\b[A-Za-z_][\w.]*\b/g;
  while ((m = re.exec(code)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (occupied.some(([a, b]) => start >= a && end <= b)) {
      continue;
    }
    tokens.push({ word: m[0], start, end });
  }
  return tokens.sort((a, b) => a.start - b.start);
}

/**
 * @param {string} word
 * @param {PairSpec} spec
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
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 * @returns {vscode.DocumentHighlight[] | undefined}
 */
function highlightsFor(document, position) {
  if (inCommentOrString(document, position)) {
    return undefined;
  }

  const lineText = document.lineAt(position.line).text;
  const tokens = tokensOnLine(lineText);
  const here = tokens.find(
    (t) => position.character >= t.start && position.character <= t.end,
  );
  if (!here) {
    return undefined;
  }

  const word = here.word.toLowerCase();
  const spec = PAIRS.find((p) => roleInPair(word, p));
  if (!spec) {
    return undefined;
  }

  /** @type {{ line: number, start: number, end: number, role: string }[]} */
  const stack = [];
  /** @type {{ line: number, start: number, end: number, role: string }[]} */
  const all = [];

  for (let line = 0; line < document.lineCount; line++) {
    for (const t of tokensOnLine(document.lineAt(line).text)) {
      const role = roleInPair(t.word, spec);
      if (!role) {
        continue;
      }
      const node = { line, start: t.start, end: t.end, role };
      all.push(node);
      if (role === "open") {
        stack.push(node);
      } else if (role === "close") {
        const open = stack.pop();
        if (open) {
          open._close = node;
          node._open = open;
        }
      } else if (role === "middle" && stack.length) {
        const open = stack[stack.length - 1];
        if (!open._middles) {
          open._middles = [];
        }
        open._middles.push(node);
        node._open = open;
      }
    }
  }

  const cursorNode = all.find(
    (n) =>
      n.line === position.line &&
      position.character >= n.start &&
      position.character <= n.end,
  );
  if (!cursorNode) {
    return undefined;
  }

  let open = cursorNode;
  if (cursorNode.role !== "open") {
    open = cursorNode._open;
  }
  if (!open) {
    return undefined;
  }

  /** @type {vscode.DocumentHighlight[]} */
  const result = [
    new vscode.DocumentHighlight(
      new vscode.Range(open.line, open.start, open.line, open.end),
      vscode.DocumentHighlightKind.Read,
    ),
  ];
  if (open._middles) {
    for (const mid of open._middles) {
      result.push(
        new vscode.DocumentHighlight(
          new vscode.Range(mid.line, mid.start, mid.line, mid.end),
          vscode.DocumentHighlightKind.Read,
        ),
      );
    }
  }
  if (open._close) {
    const c = open._close;
    result.push(
      new vscode.DocumentHighlight(
        new vscode.Range(c.line, c.start, c.line, c.end),
        vscode.DocumentHighlightKind.Read,
      ),
    );
  }
  return result;
}

const documentHighlightProvider = {
  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.Position} position
   */
  provideDocumentHighlights(document, position) {
    return highlightsFor(document, position);
  },
};

module.exports = { documentHighlightProvider };
