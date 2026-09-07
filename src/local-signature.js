/**
 * Build signature help from an in-file function declaration (no vscode).
 */

const signatures = require("../data/signatures.json");
const { functionIndex, FUNCTION_LINE } = require("./parse");
const { codePart } = require("./text");
const {
  collectSignatureLines,
  parseSignatureParams,
} = require("./function-usage");

/** @type {Map<string, { label: string, parameters: string[] }>} */
const SIG_MAP = new Map(
  Object.entries(signatures).map(([k, v]) => [k.toLowerCase(), v]),
);

/**
 * @param {string} text
 * @param {string} name
 * @returns {{ label: string, parameters: string[] } | undefined}
 */
function localSignatureFor(text, name) {
  if (!name) {
    return undefined;
  }
  const def = functionIndex(text).get(name.toLowerCase());
  if (!def) {
    return undefined;
  }
  const lines = text.split(/\r?\n/);
  const sigLines = collectSignatureLines(lines, def.line).map((l) =>
    codePart(l),
  );
  const label = sigLines.join(" ").replace(/\s+/g, " ").trim();
  if (!FUNCTION_LINE.test(label)) {
    return undefined;
  }
  const params = parseSignatureParams(sigLines);
  /** @type {string[]} */
  const parameters = [];
  const joined = sigLines.join(" ");
  const inner = joined.match(/\((.*)\)/)?.[1];
  if (inner != null && inner.trim()) {
    for (const part of inner.split(",")) {
      const p = part.replace(/\s*\)\s*$/, "").trim();
      if (p) {
        parameters.push(p);
      }
    }
  } else if (params.length) {
    for (const p of params) {
      parameters.push(p.out ? `ref ${p.name}` : p.name);
    }
  }
  return { label, parameters };
}

/**
 * Prefer in-file declaration; fall back to catalog signatures.
 * @param {string} documentText
 * @param {string} name
 * @returns {{ label: string, parameters: string[] } | undefined}
 */
function resolveSignature(documentText, name) {
  const local = localSignatureFor(documentText, name);
  if (local) {
    return local;
  }
  return SIG_MAP.get(name.toLowerCase());
}

module.exports = { localSignatureFor, resolveSignature, SIG_MAP };
