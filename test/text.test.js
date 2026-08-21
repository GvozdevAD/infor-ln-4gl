const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  scanLine,
  codePart,
  stripComments,
  kindAt,
} = require("../src/text");

describe("scanLine / codePart", () => {
  it("keeps | inside a string as code", () => {
    const line = 'message("a|b")';
    assert.equal(codePart(line), line);
    const { spans } = scanLine(line);
    assert.ok(spans.some((s) => s.kind === "string"));
    assert.ok(!spans.some((s) => s.kind === "lineComment"));
  });

  it("treats | after a string as a line comment", () => {
    const line = 'x = "a|b" | real comment';
    assert.equal(codePart(line), 'x = "a|b" ');
    const { spans } = scanLine(line);
    const comment = spans.find((s) => s.kind === "lineComment");
    assert.ok(comment);
    assert.equal(line.slice(comment.start), "| real comment");
  });

  it("does not treat backslash as an escape", () => {
    const line = 'path = "C:\\temp\\file.txt"';
    assert.equal(codePart(line), line);
    const { spans } = scanLine(line);
    const str = spans.find((s) => s.kind === "string");
    assert.ok(str);
    assert.equal(line.slice(str.start, str.end), '"C:\\temp\\file.txt"');
  });

  it("handles doubled quotes inside strings", () => {
    const line = 'message("a""b")';
    assert.equal(codePart(line), line);
    const { spans } = scanLine(line);
    const str = spans.find((s) => s.kind === "string");
    assert.equal(line.slice(str.start, str.end), '"a""b"');
  });

  it("kindAt reports string vs comment", () => {
    const line = 'x = "a|b" | c';
    assert.equal(kindAt(line, line.indexOf("|", 0)), "string"); // | inside quotes
    assert.equal(kindAt(line, line.lastIndexOf("|")), "lineComment");
  });
});

describe("stripComments", () => {
  it("blanks line and block comments but keeps strings", () => {
    const text = 'a = "x|y" | hide\n/* block */\nb = 1';
    const out = stripComments(text);
    assert.match(out, /a = "x\|y"/);
    assert.doesNotMatch(out, /hide/);
    assert.match(out, /b = 1/);
  });

  it("handles multiline block comments", () => {
    const text = "a = 1\n/* start\nstill\nend */\nb = 2";
    const out = stripComments(text);
    assert.match(out, /a = 1/);
    assert.match(out, /b = 2/);
    assert.doesNotMatch(out, /start/);
  });
});
