const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { analyzeBlocks, analyzeIdioms, analyzeDocument } = require("../src/blocks");

describe("analyzeBlocks", () => {
  it("flags an extra endif", () => {
    const text = "if true then\n\tendif\nendif\n";
    const issues = analyzeBlocks(text);
    assert.ok(issues.some((i) => i.code === "ln-4gl.unmatchedClose"));
  });

  it("flags an unclosed select", () => {
    const text = "select tdsls401.*\nfrom tdsls401\nselectdo\n\tnoop\n";
    const issues = analyzeBlocks(text);
    assert.ok(
      issues.some(
        (i) => i.code === "ln-4gl.unclosedOpen" && i.message.includes("select"),
      ),
    );
  });

  it("does not treat #endif as endif", () => {
    const text = "#ifdef FOO\n#if BAR\n#endif\n#endif\n";
    const issues = analyzeBlocks(text);
    assert.equal(issues.length, 0);
  });

  it("does not treat for update as a FOR loop", () => {
    const text =
      "select tdsls401.*\nfrom tdsls401 for update\nselectdo\nendselect\n";
    const issues = analyzeBlocks(text);
    assert.equal(
      issues.filter((i) => i.message.toLowerCase().includes("for")).length,
      0,
    );
  });

  it("ignores endif inside a string", () => {
    const text = 'message("endif")\n';
    const issues = analyzeBlocks(text);
    assert.equal(issues.length, 0);
  });

  it("ignores endif in a | comment when strictComments", () => {
    const text = "if true then\nendif\n| endif\n";
    const issues = analyzeBlocks(text, { strictComments: true });
    assert.equal(issues.filter((i) => i.code === "ln-4gl.unmatchedClose").length, 0);
  });

  it("flags else outside if", () => {
    const text = "else\n\tnoop\n";
    const issues = analyzeBlocks(text);
    assert.ok(issues.some((i) => i.code === "ln-4gl.elseOutsideIf"));
  });

  it("accepts on case with case labels and default", () => {
    const text = `on case i.ttid
                        case 2: | Assembly units
                                    l.item = sprintf$("D2301001.0.06.%@999999@", i.elid)
                                    break
                        case 3: | Details
                                    l.item = sprintf$("D2302001.0.06.%@999999@", i.elid)
                                    break
            default:
                        dal.set.error.message("@msg", i.ttid)
                        return(DALHOOKERROR)
            endcase
`;
    const issues = analyzeBlocks(text);
    assert.equal(
      issues.filter((i) => i.message.includes("case")).length,
      0,
    );
  });

  it("flags unclosed on case", () => {
    const text = "on case x\n\tcase 1:\n\t\tbreak\n";
    const issues = analyzeBlocks(text);
    assert.ok(
      issues.some(
        (i) => i.code === "ln-4gl.unclosedOpen" && i.message.includes("on case"),
      ),
    );
  });

  it("ignores else and endcase inside embedded SQL CASE", () => {
    const text =
      "select case when a = 1 then 'x' else 'y' endcase\nfrom t\nselectdo\n\tnop\nendselect\n";
    const issues = analyzeBlocks(text);
    assert.equal(issues.filter((i) => i.code === "ln-4gl.elseOutsideIf").length, 0);
    assert.equal(issues.filter((i) => i.code === "ln-4gl.unmatchedClose").length, 0);
  });

  it("accepts if / elif / else / endif chain", () => {
    const text = "if a then\n\tnop\nelif b then\n\tnop\nelse\n\tnop\nendif\n";
    const issues = analyzeBlocks(text);
    assert.equal(issues.length, 0);
  });

  it("flags elif outside if", () => {
    const text = "elif a then\n\tnop\n";
    const issues = analyzeBlocks(text);
    assert.ok(issues.some((i) => i.code === "ln-4gl.elseOutsideIf"));
  });
});

describe("analyzeIdioms", () => {
  it("warns on for … by", () => {
    const text = "for i = 1 to 10 by 2\n\tnop\nendfor\n";
    const issues = analyzeIdioms(text);
    assert.ok(issues.some((i) => i.code === "ln-4gl.forBy"));
  });

  it("warns on while … do", () => {
    const text = "while i < 10 do\n\ti = i + 1\nendwhile\n";
    const issues = analyzeIdioms(text);
    assert.ok(issues.some((i) => i.code === "ln-4gl.whileDo"));
  });

  it("does not warn on for update", () => {
    const text = "select t.*\nfrom t for update\nselectdo\nendselect\n";
    const issues = analyzeIdioms(text);
    assert.equal(issues.filter((i) => i.code === "ln-4gl.forBy").length, 0);
  });
});

describe("analyzeDocument", () => {
  it("combines block and idiom issues", () => {
    const text = "for i = 1 to 3 by 1\nendfor\nendif\n";
    const issues = analyzeDocument(text);
    assert.ok(issues.some((i) => i.code === "ln-4gl.forBy"));
    assert.ok(issues.some((i) => i.code === "ln-4gl.unmatchedClose"));
  });
});
