/**
 * Parse Infor Component Revisions "Differences" ed-style reports.
 *
 * Hunk headers look like: 19c19,27  |  52a62,68  |  272,273d426
 * Old lines: "< …"   New lines: "> …"   Separator: "---"
 *
 * @typedef {'a' | 'c' | 'd'} EdOp
 * @typedef {{
 *   op: EdOp,
 *   oldStart: number,
 *   oldEnd: number,
 *   newStart: number,
 *   newEnd: number,
 *   oldLines: string[],
 *   newLines: string[],
 *   rawHeader: string,
 * }} Hunk
 * @typedef {{
 *   hunks: Hunk[],
 *   stats: { removed: number, added: number, hunkCount: number },
 * }} RevisionDiffReport
 */

const HUNK_RE = /^(\d+)(?:,(\d+))?([acd])(\d+)(?:,(\d+))?$/;

/**
 * @param {string} text
 * @returns {RevisionDiffReport | null}
 */
function tryParseEdDiff(text) {
  if (typeof text !== "string" || !text.trim()) {
    return null;
  }

  // Strip UTF-8 BOM
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = body.split(/\r?\n/);
  /** @type {Hunk[]} */
  const hunks = [];

  let i = 0;
  while (i < lines.length) {
    const header = lines[i];
    const m = HUNK_RE.exec(header);
    if (!m) {
      i += 1;
      continue;
    }

    const op = /** @type {EdOp} */ (m[3]);
    const oldStart = Number(m[1]);
    const oldEnd = m[2] !== undefined ? Number(m[2]) : oldStart;
    const newStart = Number(m[4]);
    const newEnd = m[5] !== undefined ? Number(m[5]) : newStart;

    i += 1;
    /** @type {string[]} */
    const oldLines = [];
    /** @type {string[]} */
    const newLines = [];
    let seenSeparator = false;

    while (i < lines.length) {
      const line = lines[i];
      if (HUNK_RE.test(line)) {
        break;
      }
      if (line === "---") {
        seenSeparator = true;
        i += 1;
        continue;
      }
      if (line.startsWith("<")) {
        // "< text" or "<" alone; ed uses "< " prefix when there is content
        oldLines.push(line.length >= 2 && line[1] === " " ? line.slice(2) : line.slice(1));
        i += 1;
        continue;
      }
      if (line.startsWith(">")) {
        newLines.push(line.length >= 2 && line[1] === " " ? line.slice(2) : line.slice(1));
        i += 1;
        continue;
      }
      // Blank or junk between hunks — stop collecting this hunk
      if (line.trim() === "" && (oldLines.length > 0 || newLines.length > 0 || seenSeparator)) {
        i += 1;
        // allow trailing blanks; next non-empty non-hunk ends
        continue;
      }
      if (line.trim() === "") {
        i += 1;
        continue;
      }
      break;
    }

    hunks.push({
      op,
      oldStart,
      oldEnd,
      newStart,
      newEnd,
      oldLines,
      newLines,
      rawHeader: header,
    });
  }

  if (hunks.length === 0) {
    return null;
  }

  let removed = 0;
  let added = 0;
  for (const h of hunks) {
    removed += h.oldLines.length;
    added += h.newLines.length;
  }

  return {
    hunks,
    stats: {
      removed,
      added,
      hunkCount: hunks.length,
    },
  };
}

module.exports = {
  tryParseEdDiff,
  HUNK_RE,
};
