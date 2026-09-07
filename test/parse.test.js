const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseDocument } = require("../src/parse");
const { buildOutlineTree, outlinePaths } = require("../src/outline-tree");

const examplesDir = path.join(__dirname, "..", "examples");

/**
 * @param {string} name
 */
function readExample(name) {
  return fs.readFileSync(path.join(examplesDir, name), "utf8");
}

describe("parseDocument / outline", () => {
  it("hello.3gl.bc → one function main", () => {
    const nodes = parseDocument(readExample("hello.3gl.bc"));
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].kind, "function");
    assert.equal(nodes[0].name, "main");

    const tree = buildOutlineTree(nodes);
    assert.deepEqual(outlinePaths(tree), ["main"]);
  });

  it("table.dal.bc → four function nodes", () => {
    const nodes = parseDocument(readExample("table.dal.bc"));
    assert.equal(nodes.length, 4);
    assert.deepEqual(
      nodes.map((n) => n.name),
      [
        "before.save.object",
        "after.save.object",
        "tdsls401.orno.is.valid",
        "tdsls401.sflo.filter",
      ],
    );
    for (const n of nodes) {
      assert.equal(n.kind, "function");
    }

    const tree = buildOutlineTree(nodes);
    assert.deepEqual(outlinePaths(tree), [
      "before.save.object",
      "after.save.object",
      "tdsls401.orno.is.valid",
      "tdsls401.sflo.filter",
    ]);
  });

  it("print-session.ui.bc → nested parents/children", () => {
    const nodes = parseDocument(readExample("print-session.ui.bc"));
    const tree = buildOutlineTree(nodes);
    const paths = outlinePaths(tree);

    assert.ok(paths.includes("declaration"));
    assert.ok(paths.includes("group.1"));
    assert.ok(paths.includes("group.1>init.group"));
    assert.ok(paths.includes("choice.cont.process"));
    assert.ok(paths.includes("choice.cont.process>on.choice"));
    assert.ok(paths.includes("choice.print.data"));
    assert.ok(paths.includes("choice.print.data>on.choice"));
    assert.ok(paths.includes("field.suno.f"));
    assert.ok(paths.includes("field.suno.f>before.input"));
    assert.ok(paths.includes("field.suno.f>when.field.changes"));
    assert.ok(paths.includes("functions"));
    assert.ok(paths.includes("functions>read.main.table"));
  });

  it("program sections after.form.read / on.display.total.line / after.new.object", () => {
    const text = [
      "after.form.read:",
      "\tnop",
      "on.display.total.line:",
      "\tnop",
      "after.new.object:",
      "\tnop",
      "",
    ].join("\n");
    const nodes = parseDocument(text);
    assert.deepEqual(
      nodes.map((n) => ({ kind: n.kind, name: n.name })),
      [
        { kind: "parent", name: "after.form.read" },
        { kind: "parent", name: "on.display.total.line" },
        { kind: "parent", name: "after.new.object" },
      ],
    );
  });

  it("report.layout.bc → report parents, layout children, after.receive.data", () => {
    const nodes = parseDocument(readExample("report.layout.bc"));
    const tree = buildOutlineTree(nodes);
    const paths = outlinePaths(tree);

    assert.ok(paths.includes("declaration"));
    assert.ok(paths.includes("before.program"));
    assert.ok(paths.includes("after.receive.data"));
    assert.ok(paths.includes("header.1"));
    assert.ok(paths.includes("header.1>before.layout"));
    assert.ok(paths.includes("header.1>after.layout"));
    assert.ok(paths.includes("detail.1"));
    assert.ok(paths.includes("detail.1>before.layout"));
    assert.ok(paths.includes("footer.1"));
    assert.ok(paths.includes("functions"));
    assert.ok(paths.includes("functions>local.helper"));

    // UI before.field: without number must remain a FIELD_CHILD, not REPORT_PARENT
    const ui = parseDocument("field.x.y:\nbefore.field:\n\tnop\n");
    assert.deepEqual(
      ui.map((n) => ({ kind: n.kind, name: n.name })),
      [
        { kind: "parent", name: "field.x.y" },
        { kind: "child", name: "before.field" },
      ],
    );
    const reportField = parseDocument("before.field.1:\nbefore.layout:\n\tnop\n");
    assert.deepEqual(
      reportField.map((n) => ({ kind: n.kind, name: n.name })),
      [
        { kind: "parent", name: "before.field.1" },
        { kind: "child", name: "before.layout" },
      ],
    );
  });
});
