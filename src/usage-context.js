/**
 * DllUsage / FunctionUsage documentation regions (Object Information Tool).
 * Body text is prose — control keywords like `for` must not drive block analysis.
 */

const { codePart } = require("./text");

/**
 * @param {string} line
 * @returns {"open" | "close" | null}
 */
function usageMarkerOnLine(line) {
  const code = codePart(line).trim().toLowerCase();
  if (/^functionusage\b/.test(code) || /^dllusage\b/.test(code)) {
    return "open";
  }
  if (/^endfunctionusage\b/.test(code) || /^enddllusage\b/.test(code)) {
    return "close";
  }
  return null;
}

/**
 * Usage nesting depth after processing lines `[0 .. lineNo]` inclusive.
 * @param {string} text
 * @param {number} lineNo 0-based
 * @returns {number}
 */
function usageDepthAtLine(text, lineNo) {
  const lines = text.split(/\r?\n/);
  let depth = 0;
  for (let i = 0; i <= lineNo && i < lines.length; i++) {
    const marker = usageMarkerOnLine(lines[i]);
    if (marker === "open") {
      depth++;
    } else if (marker === "close") {
      depth = Math.max(0, depth - 1);
    }
  }
  return depth;
}

/**
 * True when this line sits inside a Usage block body (after open, before/on close).
 * Open marker line itself is false (depth before processing is 0).
 * @param {string} text
 * @param {number} lineNo 0-based
 */
function isInsideUsageDoc(text, lineNo) {
  if (lineNo <= 0) {
    return false;
  }
  return usageDepthAtLine(text, lineNo - 1) > 0;
}

/**
 * True if the pair spec is DllUsage / FunctionUsage itself.
 * @param {{ open: string[] }} spec
 */
function isUsagePairSpec(spec) {
  const open = (spec.open[0] || "").toLowerCase();
  return open === "dllusage" || open === "functionusage";
}

module.exports = {
  usageMarkerOnLine,
  usageDepthAtLine,
  isInsideUsageDoc,
  isUsagePairSpec,
};
