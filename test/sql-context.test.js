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

  it("does not count parenthesized subquery as select depth", () => {
    const text = `
select t.*
from t
where (select count(*) from u where u.k=t.k)>0
selectdo
endselect
after
`;
    // line index of "after" (0-based): blank, select, from, where, selectdo, endselect, after
    assert.equal(isInsideEmbeddedSql(text, 6), false);
    assert.ok(isInsideEmbeddedSql(text, 4));
  });
});
