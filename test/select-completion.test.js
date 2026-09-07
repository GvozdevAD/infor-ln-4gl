const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  isSqlKeywordToken,
  looksLikeSqlStarter,
  wantsSqlBlockSnippet,
  sqlSelectDoBlockLines,
} = require("../src/sql-completion");

describe("isSqlKeywordToken", () => {
  it("recognizes select / from / endselect", () => {
    assert.equal(isSqlKeywordToken("select"), true);
    assert.equal(isSqlKeywordToken("SELECT"), true);
    assert.equal(isSqlKeywordToken("from"), true);
    assert.equal(isSqlKeywordToken("endselect"), true);
  });

  it("does not treat section-like names as SQL keywords", () => {
    assert.equal(isSqlKeywordToken("selection.filter"), false);
    assert.equal(isSqlKeywordToken("before.program"), false);
    assert.equal(isSqlKeywordToken("sel"), false);
  });
});

describe("looksLikeSqlStarter", () => {
  it("treats sel/sele/select as SQL starters (not section headers)", () => {
    assert.equal(looksLikeSqlStarter("sel"), true);
    assert.equal(looksLikeSqlStarter("sele"), true);
    assert.equal(looksLikeSqlStarter("select"), true);
  });

  it("does not claim unrelated prefixes", () => {
    assert.equal(looksLikeSqlStarter("mess"), false);
    assert.equal(looksLikeSqlStarter("before"), false);
  });
});

describe("wantsSqlBlockSnippet / sqlSelectDoBlockLines", () => {
  it("triggers on select / sel", () => {
    assert.equal(wantsSqlBlockSnippet("select"), true);
    assert.equal(wantsSqlBlockSnippet("sel"), true);
    assert.equal(wantsSqlBlockSnippet("mess"), false);
    assert.equal(wantsSqlBlockSnippet("s"), false);
  });

  it("block contains select / from / selectdo / endselect", () => {
    const body = sqlSelectDoBlockLines().join("\n");
    assert.match(body, /^select /m);
    assert.match(body, /^from /m);
    assert.match(body, /^selectdo$/m);
    assert.match(body, /^endselect$/m);
  });
});
