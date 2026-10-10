/**
 * Build old/new text buffers from a parsed Differences report or two full scripts.
 *
 * @typedef {import('./parse-ed-diff').RevisionDiffReport} RevisionDiffReport
 * @typedef {{ oldText: string, newText: string, title: string, partial: boolean }} MaterializedRevision
 */

/**
 * @param {RevisionDiffReport} report
 * @param {string} [label]
 * @returns {MaterializedRevision}
 */
function materializeFromEdDiff(report, label) {
  const oldParts = [];
  const newParts = [];

  report.hunks.forEach((hunk, index) => {
    const n = index + 1;
    const banner = `---- hunk ${n} (${hunk.rawHeader}) ----`;
    oldParts.push(banner);
    newParts.push(banner);

    if (hunk.oldLines.length === 0) {
      oldParts.push("");
    } else {
      oldParts.push(...hunk.oldLines);
    }
    if (hunk.newLines.length === 0) {
      newParts.push("");
    } else {
      newParts.push(...hunk.newLines);
    }
    oldParts.push("");
    newParts.push("");
  });

  const name = label && label.trim() ? label.trim() : "Differences";
  return {
    oldText: oldParts.join("\n"),
    newText: newParts.join("\n"),
    title: `${name} (partial · Differences)`,
    partial: true,
  };
}

/**
 * @param {string} oldText
 * @param {string} newText
 * @param {string} [oldLabel]
 * @param {string} [newLabel]
 * @returns {MaterializedRevision}
 */
function materializeFromFullTexts(oldText, newText, oldLabel, newLabel) {
  const left = oldLabel && oldLabel.trim() ? oldLabel.trim() : "old";
  const right = newLabel && newLabel.trim() ? newLabel.trim() : "new";
  return {
    oldText: oldText ?? "",
    newText: newText ?? "",
    title: `${left} ↔ ${right}`,
    partial: false,
  };
}

module.exports = {
  materializeFromEdDiff,
  materializeFromFullTexts,
};
