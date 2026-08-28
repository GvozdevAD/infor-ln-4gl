/** @type {WeakMap<vscode.TextDocument, { version: number, kind: string }>} */
const cache = new WeakMap();

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
 * @param {import("vscode").TextDocument} document
 * @returns {"ui" | "dal" | "3gl" | "general"}
 */
function detectScriptKind(document) {
  const version = document.version;
  const hit = cache.get(document);
  if (hit && hit.version === version) {
    return /** @type {"ui" | "dal" | "3gl" | "general"} */ (hit.kind);
  }

  const limit = Math.min(document.lineCount, 200);
  let uiScore = 0;
  let dalScore = 0;
  let gl3Score = 0;
  let hasSectionHeader = false;

  for (let i = 0; i < limit; i++) {
    const raw = document.lineAt(i).text;
    const line = raw.split("|")[0].trim();
    if (!line) {
      continue;
    }
    if (SECTION_HEADER.test(line) && !/^\s*function\b/i.test(line)) {
      hasSectionHeader = true;
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

  let kind = "general";
  if (dalScore > 0 && dalScore >= uiScore) {
    kind = "dal";
  } else if (uiScore > 0 || hasSectionHeader) {
    kind = "ui";
  } else if (gl3Score > 0 && !hasSectionHeader) {
    kind = "3gl";
  }

  cache.set(document, { version, kind });
  return /** @type {"ui" | "dal" | "3gl" | "general"} */ (kind);
}

module.exports = { detectScriptKind };
