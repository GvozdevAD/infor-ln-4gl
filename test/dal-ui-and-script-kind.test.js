const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { analyzeDalUiOverlap } = require("../src/dal-ui-overlap");
const { detectScriptKindFromText, scriptKindLabel } = require("../src/script-context");
const { lookupFieldHookCatalog } = require("../src/catalog");
const { hoverFor } = require("../src/catalog");

describe("analyzeDalUiOverlap", () => {
  it("emits info when before.save.object and before.write coexist", () => {
    const text = [
      "function extern long before.save.object(long mode)",
      "{",
      "\treturn(0)",
      "}",
      "",
      "main.table.io:",
      "before.write:",
      "\tnop",
      "before.rewrite:",
      "\tnop",
      "",
    ].join("\n");
    const issues = analyzeDalUiOverlap(text);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].code, "dal-ui-overlap");
    assert.equal(issues[0].severity, "info");
    assert.match(issues[0].message, /before\.write/);
    assert.match(issues[0].message, /before\.rewrite/);
  });

  it("stays quiet when only the DAL hook is present", () => {
    const text = [
      "function extern long before.save.object(long mode)",
      "{",
      "\treturn(0)",
      "}",
      "",
    ].join("\n");
    assert.deepEqual(analyzeDalUiOverlap(text), []);
  });
});

describe("detectScriptKindFromText", () => {
  it("detects report before dal/ui", () => {
    assert.equal(
      detectScriptKindFromText("header.1:\nbefore.layout:\n\tlattr.print = true\n"),
      "report",
    );
    assert.equal(scriptKindLabel("report"), "LN: Report");
  });
});

describe("lookupFieldHookCatalog", () => {
  it("maps table.field.is.valid to field.is.valid docs", () => {
    const entry = lookupFieldHookCatalog("whinh200.otyp.is.valid");
    assert.ok(entry);
    assert.equal(entry.name, "field.is.valid");
    const md = hoverFor("whinh200.otyp.is.valid", entry);
    assert.match(md, /valid/i);
  });
});
