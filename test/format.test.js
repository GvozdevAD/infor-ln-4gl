const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  formatText,
  computeIndentLevels,
  leadingWsLength,
} = require("../src/format");

const opts = { tabSize: 4, insertSpaces: true };

/** @param {string} text */
function stripLeading(text) {
  return text.split(/\r?\n/).map((l) => l.slice(leadingWsLength(l)));
}

describe("formatText indent", () => {
  it("indents if / else / endif", () => {
    const src = [
      "on.choice:",
      "if x then",
      "y = 1",
      "else",
      "y = 2",
      "endif",
      "",
    ].join("\n");
    const out = formatText(src, opts);
    assert.equal(
      out,
      [
        "on.choice:",
        "    if x then",
        "        y = 1",
        "    else",
        "        y = 2",
        "    endif",
        "",
      ].join("\n"),
    );
  });

  it("indents selectdo / selectempty bodies", () => {
    const src = [
      "function f()",
      "{",
      "select t.*",
      "from t",
      "selectdo",
      "rprt_send()",
      "selectempty",
      "message(\"none\")",
      "endselect",
      "}",
      "",
    ].join("\n");
    const out = formatText(src, opts);
    assert.equal(
      out,
      [
        "function f()",
        "{",
        "    select t.*",
        "    from t",
        "    selectdo",
        "        rprt_send()",
        "    selectempty",
        "        message(\"none\")",
        "    endselect",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("preserves trailing spaces byte-for-byte", () => {
    const src = "on.choice:\n    x = 1   \n";
    const out = formatText(src, opts);
    assert.ok(out.includes("x = 1   \n"));
    assert.equal(out, src);
  });

  it("does not treat | inside a string as a comment for indent", () => {
    const src = [
      "on.choice:",
      "if true then",
      "message(\"a|b\")",
      "endif",
      "",
    ].join("\n");
    const levels = computeIndentLevels(src);
    // message line should be inside if (level 2)
    assert.equal(levels[2], 2);
  });

  it("does not indent for update as a FOR loop", () => {
    const src = [
      "function f()",
      "{",
      "select t.* from t for update",
      "selectdo",
      "db.update(t, db.retry)",
      "endselect",
      "}",
      "",
    ].join("\n");
    const out = formatText(src, opts);
    assert.match(out, /^    select t\.\* from t for update$/m);
    assert.match(out, /^        db\.update/m);
  });

  it("indents on case labels and body", () => {
    const src = [
      "on.choice:",
      "on case x",
      "case 1:",
      "y = 1",
      "break",
      "default:",
      "y = 0",
      "endcase",
      "",
    ].join("\n");
    const out = formatText(src, opts);
    assert.equal(
      out,
      [
        "on.choice:",
        "    on case x",
        "        case 1:",
        "            y = 1",
        "            break",
        "        default:",
        "            y = 0",
        "    endcase",
        "",
      ].join("\n"),
    );
  });

  it("indents fall-through case labels at the same level", () => {
    const src = [
      "on case weekday",
      "case 1:",
      "case 2:",
      "case 3:",
      "beginweek()",
      "break",
      "endcase",
      "",
    ].join("\n");
    const out = formatText(src, opts);
    assert.match(out, /^ {4}case 1:$/m);
    assert.match(out, /^ {4}case 2:$/m);
    assert.match(out, /^ {4}case 3:$/m);
    assert.match(out, /^ {8}beginweek\(\)$/m);
  });

  it("indents nested on case inside if", () => {
    const src = [
      "if a then",
      "on case b",
      "case 1:",
      "c = 1",
      "endcase",
      "endif",
      "",
    ].join("\n");
    const out = formatText(src, opts);
    assert.match(out, /^    on case b$/m);
    assert.match(out, /^        case 1:$/m);
    assert.match(out, /^            c = 1$/m);
    assert.match(out, /^    endcase$/m);
  });
});

describe("formatText print-session", () => {
  it("changes only leading whitespace", () => {
    const file = path.join(
      __dirname,
      "..",
      "examples",
      "print-session.ui.bc",
    );
    const src = fs.readFileSync(file, "utf8");
    const out = formatText(src, opts);
    assert.deepEqual(stripLeading(out), stripLeading(src));
  });
});
