const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  shouldCapCompletions,
  COMPLETION_CAP,
} = require("../src/completion-cap");

describe("shouldCapCompletions", () => {
  it("does not cap when count is at or below COMPLETION_CAP", () => {
    assert.equal(shouldCapCompletions("", COMPLETION_CAP), false);
    assert.equal(shouldCapCompletions("", COMPLETION_CAP - 1), false);
    assert.equal(shouldCapCompletions("db", COMPLETION_CAP), false);
  });

  it("caps empty or single-char prefix when over COMPLETION_CAP", () => {
    assert.equal(shouldCapCompletions("", COMPLETION_CAP + 1), true);
    assert.equal(shouldCapCompletions("d", COMPLETION_CAP + 50), true);
  });

  it("does not cap when prefix length is >= 2", () => {
    assert.equal(shouldCapCompletions("db", COMPLETION_CAP + 1), false);
    assert.equal(shouldCapCompletions("dal", 2000), false);
  });
});
