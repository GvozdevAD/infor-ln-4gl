/**
 * Merge functionIndex() across multiple texts (open tabs / session folder).
 * No vscode dependency — unit-testable.
 */

const { functionIndex } = require("./parse");

/**
 * @typedef {{
 *   key: string,
 *   uri: string,
 *   name: string,
 *   line: number,
 *   nameStart: number,
 *   nameEnd: number,
 * }} FunctionDefLoc
 */

/**
 * @param {{ uri: string, text: string }[]} sources
 * @returns {Map<string, FunctionDefLoc[]>}
 */
function buildOpenDocsIndex(sources) {
  /** @type {Map<string, FunctionDefLoc[]>} */
  const map = new Map();
  for (const src of sources) {
    if (!src || typeof src.uri !== "string" || typeof src.text !== "string") {
      continue;
    }
    for (const [key, node] of functionIndex(src.text)) {
      const loc = {
        key,
        uri: src.uri,
        name: node.name,
        line: node.line,
        nameStart: node.nameStart,
        nameEnd: node.nameEnd,
      };
      const list = map.get(key);
      if (list) {
        list.push(loc);
      } else {
        map.set(key, [loc]);
      }
    }
  }
  return map;
}

/**
 * Prefer a definition in `preferUri`, else the first entry.
 * @param {Map<string, FunctionDefLoc[]>} index
 * @param {string} name
 * @param {string} [preferUri]
 * @returns {FunctionDefLoc | undefined}
 */
function lookupDefinition(index, name, preferUri) {
  if (!name || !index) {
    return undefined;
  }
  const list = index.get(name.toLowerCase());
  if (!list || list.length === 0) {
    return undefined;
  }
  if (preferUri) {
    const local = list.find((d) => d.uri === preferUri);
    if (local) {
      return local;
    }
  }
  return list[0];
}

/**
 * @param {Map<string, FunctionDefLoc[]>} index
 * @returns {Set<string>}
 */
function knownFunctionNames(index) {
  return new Set(index.keys());
}

module.exports = {
  buildOpenDocsIndex,
  lookupDefinition,
  knownFunctionNames,
};
