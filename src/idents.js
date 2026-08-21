/**
 * Identifier occurrences and rename guards for LN 4GL (no vscode dependency).
 */

const completions = require("../data/completions.json");
const { scanLine } = require("./text");
const { PAIRS } = require("./keywords");
const { classifySection, SECTION_LINE } = require("./parse");

/** Same idea as language-configuration wordPattern (dots and $ count). */
const WORD_RE = /[A-Za-z_][A-Za-z0-9_.$]*/g;

/** Explicit 4GL child / program event names not always in completions.sections. */
const SECTION_EVENTS = [
  "init.field",
  "before.field",
  "before.input",
  "before.display",
  "selection.filter",
  "before.zoom",
  "before.checks",
  "domain.error",
  "ref.input",
  "ref.display",
  "check.input",
  "on.input",
  "when.field.changes",
  "after.zoom",
  "after.input",
  "after.display",
  "after.field",
  "before.choice",
  "on.choice",
  "after.choice",
  "init.form",
  "before.form",
  "after.form",
  "init.group",
  "before.group",
  "after.group",
  "on.entry",
  "on.exit",
  "before.read",
  "after.read",
  "before.write",
  "after.write",
  "after.skip.write",
  "before.rewrite",
  "after.rewrite",
  "after.skip.rewrite",
  "before.delete",
  "after.delete",
  "after.skip.delete",
  "read.view",
  "declaration",
  "functions",
  "before.program",
  "after.program",
  "on.error",
  "after.update.db.commit",
  "before.display.object",
  "before.new.object",
  "main.table.io",
];

/** @type {Set<string> | null} */
let protectedCache = null;

/**
 * @returns {Set<string>}
 */
function protectedSet() {
  if (protectedCache) {
    return protectedCache;
  }
  /** @type {Set<string>} */
  const set = new Set();
  const add = (s) => {
    if (typeof s === "string" && s) {
      set.add(s.toLowerCase());
    }
  };

  for (const list of [
    completions.keywords,
    completions.sql,
    completions.functions,
    completions.constants,
    completions.dalHooks,
    completions.errors,
  ]) {
    for (const item of list || []) {
      add(item);
    }
  }
  for (const sec of completions.sections || []) {
    add(sec.replace(/:$/, ""));
  }
  for (const ev of SECTION_EVENTS) {
    add(ev);
  }
  for (const spec of PAIRS) {
    for (const w of spec.open) {
      add(w);
    }
    for (const w of spec.close) {
      add(w);
    }
    if (spec.middle) {
      for (const w of spec.middle) {
        add(w);
      }
    }
  }
  protectedCache = set;
  return set;
}

/**
 * @param {string} name
 */
function isProtectedName(name) {
  if (!name) {
    return true;
  }
  const lower = name.toLowerCase();
  if (protectedSet().has(lower)) {
    return true;
  }
  if (classifySection(name)) {
    return true;
  }
  return false;
}

/**
 * @param {string} line
 */
function isSectionHeaderLine(line) {
  return SECTION_LINE.test(line);
}

/**
 * @param {string} line
 * @param {number} character
 * @param {{ inBlock?: boolean }} [opts]
 * @returns {{ word: string, start: number, end: number } | undefined}
 */
function wordAtOnLine(line, character, opts = {}) {
  const { spans } = scanLine(line, { inBlock: opts.inBlock });
  for (const span of spans) {
    if (span.kind !== "code") {
      continue;
    }
    if (character < span.start || character > span.end) {
      continue;
    }
    const slice = line.slice(span.start, span.end);
    WORD_RE.lastIndex = 0;
    let m;
    while ((m = WORD_RE.exec(slice)) !== null) {
      const start = span.start + m.index;
      const end = start + m[0].length;
      if (character >= start && character <= end) {
        return { word: m[0], start, end };
      }
    }
  }
  return undefined;
}

/**
 * @param {string} text
 * @param {number} line
 * @param {number} character
 * @returns {{ word: string, start: number, end: number, line: number } | undefined}
 */
function wordAt(text, line, character) {
  const lines = text.split(/\r?\n/);
  if (line < 0 || line >= lines.length) {
    return undefined;
  }
  let inBlock = false;
  for (let i = 0; i < line; i++) {
    inBlock = scanLine(lines[i], { inBlock }).inBlock;
  }
  const hit = wordAtOnLine(lines[line], character, { inBlock });
  if (!hit) {
    return undefined;
  }
  return { ...hit, line };
}

/**
 * All code-span occurrences of `name` (case-insensitive).
 * @param {string} text
 * @param {string} name
 * @returns {{ line: number, start: number, end: number }[]}
 */
function findOccurrences(text, name) {
  if (!name) {
    return [];
  }
  const target = name.toLowerCase();
  const lines = text.split(/\r?\n/);
  /** @type {{ line: number, start: number, end: number }[]} */
  const out = [];
  let inBlock = false;

  for (let line = 0; line < lines.length; line++) {
    const raw = lines[line];
    const startedInBlock = inBlock;
    const scanned = scanLine(raw, { inBlock: startedInBlock });
    inBlock = scanned.inBlock;

    for (const span of scanned.spans) {
      if (span.kind !== "code") {
        continue;
      }
      const slice = raw.slice(span.start, span.end);
      WORD_RE.lastIndex = 0;
      let m;
      while ((m = WORD_RE.exec(slice)) !== null) {
        if (m[0].toLowerCase() === target) {
          const start = span.start + m.index;
          out.push({ line, start, end: start + m[0].length });
        }
      }
    }
  }
  return out;
}

module.exports = {
  WORD_RE,
  findOccurrences,
  wordAt,
  wordAtOnLine,
  isProtectedName,
  isSectionHeaderLine,
  protectedSet,
};
