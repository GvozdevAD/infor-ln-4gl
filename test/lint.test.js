const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { analyzeBrackets } = require("../src/brackets");
const { analyzeContinuation } = require("../src/continuation");
const { scanLintDocument } = require("../src/lint-scan");

describe("analyzeBrackets", () => {
  it("flags unclosed parenthesis", () => {
    const text = "function long broken()\n{\n\tcall foo(\n\treturn(0)\n}\n";
    const issues = analyzeBrackets(text);
    assert.ok(issues.some((i) => i.code === "ln-4gl.bracketUnclosed"));
  });

  it("flags unexpected close", () => {
    const text = "x = a)\n";
    const issues = analyzeBrackets(text);
    assert.ok(issues.some((i) => i.code === "ln-4gl.bracketMismatch"));
  });

  it("ignores brackets inside strings and comments", () => {
    const text = 'message("((")\n| )\n{\n}\n';
    const issues = analyzeBrackets(text);
    assert.equal(issues.length, 0);
  });

  it("accepts balanced braces", () => {
    const text = "function long ok()\n{\n\treturn(0)\n}\n";
    assert.equal(analyzeBrackets(text).length, 0);
  });
});

describe("analyzeContinuation", () => {
  it("flags missing ^ after open string", () => {
    const text = 'message("hello\nworld")\n';
    const issues = analyzeContinuation(text);
    assert.ok(issues.some((i) => i.code === "ln-4gl.caretString"));
  });

  it("accepts ^-continued string", () => {
    const text = 'message("hello\n^world")\n';
    const issues = analyzeContinuation(text);
    assert.equal(
      issues.filter((i) => i.code === "ln-4gl.caretString").length,
      0,
    );
  });

  it("flags missing ^ on #define continuation", () => {
    const text =
      "#define MULTILINE for i = 1 to 10\n^    i = i + 1\n    endfor\n";
    const issues = analyzeContinuation(text);
    assert.ok(issues.some((i) => i.code === "ln-4gl.caretDefine"));
  });

  it("flags unclosed string at EOF", () => {
    const text = 'message("oops\n';
    const issues = analyzeContinuation(text);
    assert.ok(
      issues.some(
        (i) =>
          i.code === "ln-4gl.caretString" || i.code === "ln-4gl.caretStringEof",
      ),
    );
  });
});

describe("scanLintDocument", () => {
  it("tracks open string across lines", () => {
    const scanned = scanLintDocument('message("hello\n^world")\n');
    assert.equal(scanned[0].leavesOpenString, true);
    assert.equal(scanned[1].hasCaret, true);
    assert.equal(scanned[1].leavesOpenString, false);
  });
});
