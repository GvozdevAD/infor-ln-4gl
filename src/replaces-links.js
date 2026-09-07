/**
 * In-file DocumentLinks for DAL "replaces" section headers present in the same file.
 * Pure helpers live here so providers stay thin.
 */

const { SECTION_LINE } = require("./parse");
const { codePart } = require("./text");
const { lookupCatalog } = require("./catalog");

/**
 * Collect section header name → first line index.
 * @param {string} text
 * @returns {Map<string, number>}
 */
function sectionLineIndex(text) {
  /** @type {Map<string, number>} */
  const map = new Map();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = codePart(lines[i]).match(SECTION_LINE);
    if (!m) {
      continue;
    }
    const key = m[1].toLowerCase();
    if (!map.has(key)) {
      map.set(key, i);
    }
  }
  return map;
}

/**
 * Find replaces mentions on a line that point at in-file sections.
 * @param {string} line
 * @param {Map<string, number>} sections
 * @param {number} lineNo
 * @returns {{ start: number, end: number, targetLine: number, section: string }[]}
 */
function replacesLinksOnLine(line, sections, lineNo) {
  const code = codePart(line);
  /** @type {{ start: number, end: number, targetLine: number, section: string }[]} */
  const out = [];

  // function … before.save.object( → link each replaces section name if present in file
  const fn = code.match(
    /^\s*function\s+(?:extern\s+)?(?:(?:long|double|void|string|boolean|domain\s+[\w.]+)\s+)?([\w.]+)\s*\(/i,
  );
  if (fn) {
    const entry = lookupCatalog(fn[1]);
    if (entry?.replaces?.length) {
      for (const sec of entry.replaces) {
        const targetLine = sections.get(String(sec).toLowerCase());
        if (targetLine == null) {
          continue;
        }
        // Link the function name itself to first replaces section (narrow, one target).
        const nameStart = line.indexOf(fn[1]);
        if (nameStart >= 0) {
          out.push({
            start: nameStart,
            end: nameStart + fn[1].length,
            targetLine,
            section: String(sec),
          });
          break;
        }
      }
    }
  }
  return out;
}

module.exports = { sectionLineIndex, replacesLinksOnLine };
