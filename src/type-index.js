/**
 * Lightweight in-file type index for LN 4GL diagnostics (no vscode / no DD).
 * Maps identifier → "boolean" | "long" | "other".
 */

const { codePart } = require("./text");
const { FUNCTION_LINE } = require("./parse");

/** @typedef {"boolean" | "long" | "other"} TypeKind */

const STORAGE_PREFIX =
  "(?:(?:extern|static|based|const|fixed|global|dim)\\s+)*";

const VAR_DECL_RE = new RegExp(
  `^${STORAGE_PREFIX}(boolean|long|double|string|bset)\\s+([\\w.]+)`,
  "i",
);

const DOMAIN_DECL_RE = new RegExp(
  `^${STORAGE_PREFIX}domain\\s+[\\w.]+\\s+([\\w.]+)`,
  "i",
);

/**
 * Map a type keyword to TypeKind.
 * @param {string} kw
 * @returns {TypeKind}
 */
function kindFromKeyword(kw) {
  const k = kw.toLowerCase();
  if (k === "boolean") {
    return "boolean";
  }
  if (k === "long") {
    return "long";
  }
  return "other";
}

/**
 * @param {Map<string, TypeKind>} index
 * @param {string} name
 * @param {TypeKind} kind
 */
function setType(index, name, kind) {
  if (!name) {
    return;
  }
  index.set(name.toLowerCase(), kind);
}

/**
 * Parse typed names from a function parameter list text (inside parentheses).
 * @param {string} inner
 * @param {Map<string, TypeKind>} index
 */
function indexParams(inner, index) {
  if (!inner || !inner.trim()) {
    return;
  }
  for (const part of inner.split(",")) {
    const p = part.trim();
    if (!p) {
      continue;
    }
    // ref boolean name / boolean name / domain x.y name
    let m = p.match(
      /^(?:ref\s+)?(boolean|long|double|string|bset)\s+([\w.]+)\s*$/i,
    );
    if (m) {
      setType(index, m[2], kindFromKeyword(m[1]));
      continue;
    }
    m = p.match(/^(?:ref\s+)?domain\s+[\w.]+\s+([\w.]+)\s*$/i);
    if (m) {
      setType(index, m[1], "other");
    }
  }
}

/**
 * Collect signature text from function line through closing `)`.
 * @param {string[]} lines
 * @param {number} startIdx
 * @returns {string | null}
 */
function collectSignatureText(lines, startIdx) {
  /** @type {string[]} */
  const parts = [];
  for (let i = startIdx; i < lines.length; i++) {
    const code = codePart(lines[i]);
    parts.push(code);
    if (code.includes(")")) {
      break;
    }
    // Safety: don't scan forever if `)` missing
    if (i > startIdx + 40) {
      return null;
    }
  }
  const text = parts.join(" ");
  const m = text.match(/\((.*)\)/);
  return m ? m[1] : null;
}

/**
 * Build type index for the whole document.
 * @param {string} text
 * @returns {Map<string, TypeKind>}
 */
function buildTypeIndex(text) {
  /** @type {Map<string, TypeKind>} */
  const index = new Map();
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const code = codePart(lines[i]).trim();
    if (!code || code.startsWith("#")) {
      continue;
    }

    if (FUNCTION_LINE.test(code)) {
      const inner = collectSignatureText(lines, i);
      if (inner != null) {
        indexParams(inner, index);
      }
      continue;
    }

    let m = code.match(VAR_DECL_RE);
    if (m) {
      setType(index, m[2], kindFromKeyword(m[1]));
      continue;
    }
    m = code.match(DOMAIN_DECL_RE);
    if (m) {
      setType(index, m[1], "other");
    }
  }

  return index;
}

/**
 * @param {Map<string, TypeKind>} index
 * @param {string} name
 * @returns {TypeKind | undefined}
 */
function lookupType(index, name) {
  if (!name) {
    return undefined;
  }
  return index.get(name.toLowerCase());
}

module.exports = {
  buildTypeIndex,
  lookupType,
  kindFromKeyword,
};
