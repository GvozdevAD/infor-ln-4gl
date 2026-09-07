const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { computeFoldRanges } = require("../src/folding");

describe("computeFoldRanges", () => {
  it("folds if/endif", () => {
    const text = "if true then\n\tnop\nendif\n";
    const ranges = computeFoldRanges(text);
    assert.ok(ranges.some((r) => r.start === 0 && r.end === 2));
  });

  it("does not fold unclosed if", () => {
    const text = "if true then\n\tnop\n";
    const ranges = computeFoldRanges(text);
    assert.equal(
      ranges.filter((r) => r.start === 0 && r.kind === "block").length,
      0,
    );
  });

  it("does not treat for update as a fold open", () => {
    const text =
      "select t.*\nfrom t for update\nselectdo\n\tnop\nendselect\n";
    const ranges = computeFoldRanges(text);
    const forFold = ranges.filter(
      (r) => r.start === 1 && r.kind === "block",
    );
    assert.equal(forFold.length, 0);
    assert.ok(ranges.some((r) => r.start === 0 && r.end === 4));
  });

  it("folds 4GL sections via parse endLine", () => {
    const text = fs.readFileSync(
      path.join(__dirname, "..", "examples", "print-session.ui.bc"),
      "utf8",
    );
    const ranges = computeFoldRanges(text);
    assert.ok(ranges.some((r) => r.kind === "region" && r.end > r.start));
  });

  it("folds brace bodies", () => {
    const text = "function main()\n{\n\tmessage(\"x\")\n}\n";
    const ranges = computeFoldRanges(text);
    assert.ok(ranges.some((r) => r.start === 1 && r.end === 3));
  });

  it("folds on case/endcase", () => {
    const text = "on case x\n\tcase 1:\n\t\tbreak\nendcase\n";
    const ranges = computeFoldRanges(text);
    assert.ok(ranges.some((r) => r.start === 0 && r.end === 3));
  });
});
