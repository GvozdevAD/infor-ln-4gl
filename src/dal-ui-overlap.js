/**
 * In-file info when DAL hooks coexist with UI sections they replace.
 */

const dalNotes = require("../data/dal-notes.json");
const { FUNCTION_LINE, SECTION_LINE } = require("./parse");
const { codePart } = require("./text");

/**
 * @param {string} text
 * @returns {{ line: number, start: number, end: number, message: string, code: string, severity: "info" }[]}
 */
function analyzeDalUiOverlap(text) {
  const lines = text.split(/\r?\n/);
  /** @type {Map<string, { line: number, start: number, end: number }>} */
  const functions = new Map();
  /** @type {Map<string, { line: number, start: number, end: number }>} */
  const sections = new Map();

  for (let i = 0; i < lines.length; i++) {
    const code = codePart(lines[i]);
    const fn = code.match(FUNCTION_LINE);
    if (fn) {
      const name = fn[1];
      const key = name.toLowerCase();
      if (!functions.has(key)) {
        const start = lines[i].indexOf(name);
        functions.set(key, {
          line: i,
          start,
          end: start + name.length,
        });
      }
      continue;
    }
    const sec = code.match(SECTION_LINE);
    if (sec) {
      const name = sec[1];
      const key = name.toLowerCase();
      if (!sections.has(key)) {
        const start = lines[i].indexOf(name);
        sections.set(key, {
          line: i,
          start,
          end: start + name.length,
        });
      }
    }
  }

  /** @type {{ line: number, start: number, end: number, message: string, code: string, severity: "info" }[]} */
  const issues = [];

  for (const [hook, replaces] of Object.entries(dalNotes)) {
    const hookHit = functions.get(String(hook).toLowerCase());
    if (!hookHit) {
      continue;
    }
    const present = (replaces || [])
      .map((s) => String(s).toLowerCase())
      .filter((s) => sections.has(s));
    if (!present.length) {
      continue;
    }
    const labels = present.map((s) => `${s}:`).join(", ");
    issues.push({
      line: hookHit.line,
      start: hookHit.start,
      end: hookHit.end,
      message: `${hook} replaces UI section(s) also present in this file: ${labels}`,
      code: "dal-ui-overlap",
      severity: "info",
    });
  }

  return issues;
}

module.exports = { analyzeDalUiOverlap };
