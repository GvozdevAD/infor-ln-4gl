/** @type {WeakMap<object, { version: number, kind: string }>} */
const cache = new WeakMap();

const REPORT_PATTERNS = [
  /^\s*(?:before\.report|after\.report|header|footer|detail|before\.field|after\.field)\.\d+\s*:/i,
  /^\s*(?:before|after)\.layout\s*:/i,
  /^\s*after\.receive\.data\s*:/i,
  /\blattr\./i,
];

const UI_PATTERNS = [
  /^\s*(?:field|choice|group|form|main\.table\.io)\.[\w.]+:/i,
  /^\s*before\.input:/i,
  /^\s*execute\s*\(/i,
  /^\s*display(?:\.|$)/i,
  /^\s*get\.var\s*\(/i,
  /^\s*put\.var\s*\(/i,
];

const DAL_PATTERNS = [
  /^\s*function\s+extern\b/i,
  /\b(?:before|after)\.(?:save|get|new|destroy)\.object\b/i,
  /\bfield\.update\b/i,
  /\bmethod\.is\.allowed\b/i,
  /\bdal\.(?:set\.error\.message|save\.object|new\.object)\b/i,
];

const GL3_PATTERNS = [
  /^\s*function\s+main\s*\(/i,
  /^\s*#include\b/i,
];

const SECTION_HEADER = /^\s*[A-Za-z_][\w.]*:/;

/**
 * @param {string} text
 * @returns {"report" | "ui" | "dal" | "3gl" | "general"}
 */
function detectScriptKindFromText(text) {
  const lines = text.split(/\r?\n/);
  const limit = Math.min(lines.length, 200);
  let reportScore = 0;
  let uiScore = 0;
  let dalScore = 0;
  let gl3Score = 0;
  let hasSectionHeader = false;

  for (let i = 0; i < limit; i++) {
    const line = lines[i].split("|")[0].trim();
    if (!line) {
      continue;
    }
    if (SECTION_HEADER.test(line) && !/^\s*function\b/i.test(line)) {
      hasSectionHeader = true;
    }
    for (const re of REPORT_PATTERNS) {
      if (re.test(line)) {
        reportScore++;
      }
    }
    for (const re of UI_PATTERNS) {
      if (re.test(line)) {
        uiScore++;
      }
    }
    for (const re of DAL_PATTERNS) {
      if (re.test(line)) {
        dalScore++;
      }
    }
    for (const re of GL3_PATTERNS) {
      if (re.test(line)) {
        gl3Score++;
      }
    }
  }

  if (reportScore > 0) {
    return "report";
  }
  if (dalScore > 0 && dalScore >= uiScore) {
    return "dal";
  }
  if (uiScore > 0 || hasSectionHeader) {
    return "ui";
  }
  if (gl3Score > 0 && !hasSectionHeader) {
    return "3gl";
  }
  return "general";
}

/**
 * @param {import("vscode").TextDocument} document
 * @returns {"report" | "ui" | "dal" | "3gl" | "general"}
 */
function detectScriptKind(document) {
  const version = document.version;
  const hit = cache.get(document);
  if (hit && hit.version === version) {
    return /** @type {"report" | "ui" | "dal" | "3gl" | "general"} */ (hit.kind);
  }

  const kind = detectScriptKindFromText(document.getText());
  cache.set(document, { version, kind });
  return kind;
}

/**
 * @param {string} kind
 * @returns {string}
 */
function scriptKindLabel(kind) {
  switch (kind) {
    case "report":
      return "LN: Report";
    case "dal":
      return "LN: DAL";
    case "ui":
      return "LN: UI";
    case "3gl":
      return "LN: 3GL";
    default:
      return "LN: Script";
  }
}

module.exports = { detectScriptKind, detectScriptKindFromText, scriptKindLabel };
