const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { tryParseEdDiff } = require("../../src/revisions/parse-ed-diff");
const { materializeFromEdDiff } = require("../../src/revisions/materialize");

const fixturePath = path.join(
  __dirname,
  "..",
  "fixtures",
  "revisions",
  "sample-differences.ed.txt",
);

describe("tryParseEdDiff", () => {
  it("returns null for ordinary script text", () => {
    assert.equal(tryParseEdDiff("function long foo()\n{\n  return(0)\n}\n"), null);
  });

  it("returns null for empty input", () => {
    assert.equal(tryParseEdDiff(""), null);
    assert.equal(tryParseEdDiff("   \n"), null);
  });

  it("parses change / add / delete hunks from the sample fixture", () => {
    const text = fs.readFileSync(fixturePath, "utf8");
    const report = tryParseEdDiff(text);
    assert.ok(report);
    assert.equal(report.stats.hunkCount, 5);
    assert.equal(report.hunks[0].op, "c");
    assert.equal(report.hunks[0].oldLines.length, 1);
    assert.equal(report.hunks[0].newLines.length, 3);
    assert.match(report.hunks[0].oldLines[0], /Rev\.No\. 45/);
    assert.match(report.hunks[0].newLines[0], /Rev\.No\. 57/);
    assert.match(report.hunks[0].newLines[0], /vyazovoy/);

    assert.equal(report.hunks[2].op, "a");
    assert.equal(report.hunks[2].oldLines.length, 0);
    assert.equal(report.hunks[2].newLines.length, 3);
    assert.match(report.hunks[2].newLines[0], /import\.multilink/);

    assert.equal(report.hunks[4].op, "d");
    assert.equal(report.hunks[4].oldLines.length, 2);
    assert.equal(report.hunks[4].newLines.length, 0);

    assert.equal(report.stats.removed, 1 + 1 + 0 + 1 + 2);
    assert.equal(report.stats.added, 3 + 2 + 3 + 3 + 0);
  });

  it("strips UTF-8 BOM", () => {
    const text = "\uFEFF1c1\n< old\n---\n> new\n";
    const report = tryParseEdDiff(text);
    assert.ok(report);
    assert.equal(report.stats.hunkCount, 1);
    assert.equal(report.hunks[0].oldLines[0], "old");
    assert.equal(report.hunks[0].newLines[0], "new");
  });

  it("accepts CRLF line endings", () => {
    const text = "1a2,3\r\n> line a\r\n> line b\r\n";
    const report = tryParseEdDiff(text);
    assert.ok(report);
    assert.equal(report.hunks[0].op, "a");
    assert.deepEqual(report.hunks[0].newLines, ["line a", "line b"]);
  });
});

describe("materializeFromEdDiff", () => {
  it("embeds hunk banners on both sides", () => {
    const text = fs.readFileSync(fixturePath, "utf8");
    const report = tryParseEdDiff(text);
    const mat = materializeFromEdDiff(report, "tmp981234.bc");
    assert.equal(mat.partial, true);
    assert.match(mat.title, /partial/);
    assert.match(mat.oldText, /hunk 1 \(19c19,21\)/);
    assert.match(mat.newText, /hunk 1 \(19c19,21\)/);
    assert.match(mat.oldText, /Rev\.No\. 45/);
    assert.match(mat.newText, /Rev\.No\. 57/);
    assert.match(mat.newText, /import\.multilink/);
  });
});
