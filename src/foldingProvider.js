const vscode = require("vscode");
const { computeFoldRanges } = require("./folding");

const foldingRangeProvider = {
  /**
   * @param {vscode.TextDocument} document
   * @returns {vscode.FoldingRange[]}
   */
  provideFoldingRanges(document) {
    return computeFoldRanges(document.getText()).map((r) => {
      const kind =
        r.kind === "region"
          ? vscode.FoldingRangeKind.Region
          : undefined;
      return new vscode.FoldingRange(r.start, r.end, kind);
    });
  },
};

module.exports = { foldingRangeProvider };
