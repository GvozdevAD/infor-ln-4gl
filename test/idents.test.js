const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  findOccurrences,
  wordAt,
  isProtectedName,
  isSectionHeaderLine,
} = require("../src/idents");

const printSession = fs.readFileSync(
  path.join(__dirname, "..", "examples", "print-session.ui.bc"),
  "utf8",
);

describe("isProtectedName", () => {
  it("protects builtins and keywords", () => {
    assert.equal(isProtectedName("message"), true);
    assert.equal(isProtectedName("endif"), true);
    assert.equal(isProtectedName("select"), true);
    assert.equal(isProtectedName("before.input"), true);
    assert.equal(isProtectedName("ELOCKED"), true);
  });

  it("allows local function-style names", () => {
    assert.equal(isProtectedName("read.main.table"), false);
    assert.equal(isProtectedName("my.helper"), false);
  });
});

describe("isSectionHeaderLine", () => {
  it("detects 4GL section headers", () => {
    assert.equal(isSectionHeaderLine("field.suno.f:"), true);
    assert.equal(isSectionHeaderLine("  before.input:"), true);
    assert.equal(isSectionHeaderLine("\tmessage(\"x\")"), false);
  });
});

describe("findOccurrences", () => {
  it("finds definition and call of read.main.table", () => {
    const occs = findOccurrences(printSession, "read.main.table");
    assert.ok(occs.length >= 2);
  });

  it("ignores message inside a string and after |", () => {
    const text = 'message("message")\n| message\nx = message("a")\n';
    const occs = findOccurrences(text, "message");
    assert.equal(occs.length, 2);
    assert.equal(occs[0].start, 0);
    assert.equal(occs[1].line, 2);
  });

  it("is case-insensitive", () => {
    const text = "function Foo()\n{\n\tfoo()\n}\n";
    const occs = findOccurrences(text, "foo");
    assert.equal(occs.length, 2);
  });
});

describe("wordAt", () => {
  it("returns dotted identifier under cursor", () => {
    const text = "\tread.main.table()\n";
    const hit = wordAt(text, 0, 6);
    assert.ok(hit);
    assert.equal(hit.word, "read.main.table");
  });
});
