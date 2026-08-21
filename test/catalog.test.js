const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const completions = JSON.parse(
  fs.readFileSync(path.join(root, "data", "completions.json"), "utf8"),
);
const docs = JSON.parse(fs.readFileSync(path.join(root, "data", "docs.json"), "utf8"));

const docsLower = new Map(
  Object.keys(docs).map((k) => [k.toLowerCase(), k]),
);

describe("API catalog", () => {
  it("includes everyday db.* helpers in completions.functions", () => {
    assert.ok(completions.functions.includes("db.eq"));
    assert.ok(completions.functions.includes("db.first"));
    assert.ok(completions.functions.includes("pos"));
    assert.ok(completions.functions.includes("date.num"));
  });

  it("includes common error codes in completions.errors", () => {
    assert.ok(Array.isArray(completions.errors));
    assert.ok(completions.errors.includes("ELOCKED"));
    assert.ok(completions.errors.includes("EDUPL"));
    assert.ok(completions.errors.includes("ENOREC"));
  });

  it("has docs for every error code (case-insensitive)", () => {
    for (const code of completions.errors) {
      assert.ok(
        docsLower.has(code.toLowerCase()),
        `missing docs.json entry for ${code}`,
      );
    }
  });
});
