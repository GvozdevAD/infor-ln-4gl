const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { detectScriptKind } = require("../src/script-context");

const root = path.join(__dirname, "..");

function mockDoc(text, fileName = "test.bc") {
  const lines = text.split("\n");
  return {
    fileName,
    lineCount: lines.length,
    version: 1,
    lineAt(i) {
      return { text: lines[i] || "" };
    },
    getText() {
      return text;
    },
  };
}

describe("script-context", () => {
  it("detects UI scripts from section headers", () => {
    const ui = fs.readFileSync(
      path.join(root, "examples", "print-session.ui.bc"),
      "utf8",
    );
    assert.equal(detectScriptKind(mockDoc(ui, "print-session.ui.bc")), "ui");
  });

  it("detects DAL scripts from extern hooks", () => {
    const dal = fs.readFileSync(
      path.join(root, "examples", "table.dal.bc"),
      "utf8",
    );
    assert.equal(detectScriptKind(mockDoc(dal, "table.dal.bc")), "dal");
  });

  it("detects 3GL scripts from function main", () => {
    const gl3 = fs.readFileSync(
      path.join(root, "examples", "hello.3gl.bc"),
      "utf8",
    );
    assert.equal(detectScriptKind(mockDoc(gl3, "hello.3gl.bc")), "3gl");
  });
});
