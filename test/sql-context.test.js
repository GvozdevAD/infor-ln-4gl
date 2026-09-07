const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  sqlDepthAtLine,
  isInsideEmbeddedSql,
} = require("../src/sql-context");

describe("sql-context", () => {
  it("returns zero outside select", () => {
    const text = "if true then\n\tnoop\nendif\n";
    assert.equal(sqlDepthAtLine(text, 1), 0);
    assert.equal(isInsideEmbeddedSql(text, 1), false);
  });

  it("detects depth inside select before endselect", () => {
    const text = "select t.*\nfrom t\nselectdo\n\tnop\nendselect\n";
    assert.ok(isInsideEmbeddedSql(text, 2));
    assert.equal(isInsideEmbeddedSql(text, 4), false);
  });
});
