const vscode = require("vscode");
const docs = require("../data/docs.json");
const { inCommentOrString } = require("./text");

/** @type {Map<string, string>} */
const DOC_MAP = new Map(
  Object.entries(docs).map(([k, v]) => [k.toLowerCase(), v]),
);

const hoverProvider = {
  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.Position} position
   */
  provideHover(document, position) {
    if (inCommentOrString(document, position)) {
      return undefined;
    }

    const range = document.getWordRangeAtPosition(position);
    if (!range) {
      return undefined;
    }

    const word = document.getText(range);
    const text = DOC_MAP.get(word.toLowerCase());
    if (!text) {
      return undefined;
    }

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${word}**\n\n${text}`);
    return new vscode.Hover(md, range);
  },
};

module.exports = { hoverProvider, DOC_MAP };
