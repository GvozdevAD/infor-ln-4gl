const vscode = require("vscode");
const docs = require("../data/docs.json");
const { lookupCatalog, lookupFieldHookCatalog, hoverFor } = require("./catalog");
const { inCommentOrString } = require("./text");
const { functionUsageIndex, formatUsageHover } = require("./function-usage");

/** @type {Map<string, string>} */
const DOC_MAP = new Map(
  Object.entries(docs).map(([k, v]) => [k.toLowerCase(), v]),
);

/** @type {WeakMap<vscode.TextDocument, { version: number, index: Map<string, object> }>} */
const USAGE_CACHE = new WeakMap();

/**
 * @param {vscode.TextDocument} document
 */
function usageIndexFor(document) {
  const cached = USAGE_CACHE.get(document);
  if (cached && cached.version === document.version) {
    return cached.index;
  }
  const index = functionUsageIndex(document.getText());
  USAGE_CACHE.set(document, { version: document.version, index });
  return index;
}

const hoverProvider = {
  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.Position} position
   */
  provideHover(document, position) {
    if (inCommentOrString(document, position)) {
      return undefined;
    }

    const range = document.getWordRangeAtPosition(
      position,
      /[A-Za-z_][A-Za-z0-9_.$]*/,
    );
    if (!range) {
      return undefined;
    }

    const word = document.getText(range);
    const key = word.toLowerCase();

    // Prefer in-file FunctionUsage (nvim K / hover behavior).
    const local = usageIndexFor(document).get(key);
    if (local) {
      const text = formatUsageHover(local.doc, local.signatureLine);
      if (text) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${local.name}**\n\n${text}`);
        return new vscode.Hover(md, range);
      }
    }

    let text = DOC_MAP.get(key);
    const catalogEntry =
      lookupCatalog(word) || lookupFieldHookCatalog(word);
    if (catalogEntry) {
      text = hoverFor(word, catalogEntry);
    }
    if (!text) {
      return undefined;
    }

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${word}**\n\n${text}`);
    return new vscode.Hover(md, range);
  },
};

module.exports = { hoverProvider, DOC_MAP, usageIndexFor };
