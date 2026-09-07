const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { analyzeBlocks, analyzeIdioms, analyzeDocument, analyzeOnCaseDuplicates, analyzeDeprecatedLongIf } = require("../src/blocks");

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

  it("flags unclosed dllusage", () => {
    const text = [
      "dllusage",
      "function extern long foo()",
      "{",
      "    return(0)",
      "}",
      "",
    ].join("\n");
    const issues = analyzeBlocks(text);
    assert.ok(
      issues.some(
        (i) => i.code === "ln-4gl.unclosedOpen" && i.message.includes("dllusage"),
      ),
    );
  });

  it("flags unclosed functionusage", () => {
    const text = "functionusage\nfunction extern long bar()\n{\n}\n";
    const issues = analyzeBlocks(text);
    assert.ok(
      issues.some(
        (i) =>
          i.code === "ln-4gl.unclosedOpen" && i.message.includes("functionusage"),
      ),
    );
  });

  it("accepts closed dllusage block", () => {
    const text = [
      "dllusage",
      "function extern long foo()",
      "{",
      "    return(0)",
      "}",
      "enddllusage",
      "",
    ].join("\n");
    assert.equal(analyzeBlocks(text).length, 0);
  });

  it("ignores for/if/while prose inside FunctionUsage", () => {
    const text = `
function extern long foo()
{
	FunctionUsage
	Call this for each row before save.
	If needed, retry.
	While testing, log errors.
	EndFunctionUsage
	return(0)
}
`;
    const issues = analyzeBlocks(text);
    assert.equal(
      issues.filter(
        (i) =>
          i.message.includes("'for'") ||
          i.message.includes("'if'") ||
          i.message.includes("'while'"),
      ).length,
      0,
      JSON.stringify(issues),
    );
  });

  it("ignores for prose inside DllUsage", () => {
    const text = `DllUsage
Helpers for importing units.
EndDllUsage
`;
    const issues = analyzeBlocks(text);
    assert.equal(
      issues.filter((i) => i.message.includes("'for'")).length,
      0,
      JSON.stringify(issues),
    );
  });

  it("still flags real for outside Usage", () => {
    const text = "for i = 1 to 10\n\ti = i + 1\n";
    const issues = analyzeBlocks(text);
    assert.ok(issues.some((i) => i.message.includes("'for'")));
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

describe("analyzeOnCaseDuplicates", () => {
  it("warns on duplicate case expression", () => {
    const text = "on case x\n\tcase 1:\n\t\tnop\n\tcase 1:\n\t\tnop\nendcase\n";
    const issues = analyzeOnCaseDuplicates(text);
    assert.ok(issues.some((i) => i.code === "ln-4gl.duplicateCase"));
  });

  it("allows fall-through with different case values", () => {
    const text = [
      "on case weekday",
      "case 1:",
      "case 2:",
      "case 3:",
      "    beginweek()",
      "    break",
      "endcase",
      "",
    ].join("\n");
    const issues = analyzeOnCaseDuplicates(text);
    assert.equal(issues.length, 0);
  });
});

describe("analyzeDeprecatedLongIf", () => {
  it("warns on bare identifier condition", () => {
    const issues = analyzeDeprecatedLongIf("if retcode then\n\tnop\nendif\n");
    assert.ok(issues.some((i) => i.code === "ln-4gl.deprecatedLongIf"));
  });

  it("warns on dotted identifier condition", () => {
    const issues = analyzeDeprecatedLongIf("if db.retry.hit then\nendif\n");
    assert.ok(issues.some((i) => i.code === "ln-4gl.deprecatedLongIf"));
  });

  it("does not warn on comparison condition", () => {
    const issues = analyzeDeprecatedLongIf("if x > 0 then\nendif\n");
    assert.equal(issues.length, 0);
  });

  it("does not warn on true/false", () => {
    assert.equal(analyzeDeprecatedLongIf("if true then\nendif\n").length, 0);
    assert.equal(analyzeDeprecatedLongIf("if false then\nendif\n").length, 0);
  });

  it("does not warn on boolean parameter (multilink)", () => {
    const text = `
function long resolve.import.site(long i.site, boolean i.multilink)
{
	if i.multilink then
		nop
	endif
}
`;
    assert.equal(analyzeDeprecatedLongIf(text).length, 0);
  });

  it("does not warn on multiline signature boolean param", () => {
    const text = `
function long foo(
	boolean i.flag
)
{
	if i.flag then
		nop
	endif
}
`;
    assert.equal(analyzeDeprecatedLongIf(text).length, 0);
  });

  it("does not warn on local boolean declaration", () => {
    const text = "boolean flag\nif flag then\nendif\n";
    assert.equal(analyzeDeprecatedLongIf(text).length, 0);
  });

  it("warns on known long variable", () => {
    const text = "long ret\nif ret then\nendif\n";
    const issues = analyzeDeprecatedLongIf(text);
    assert.ok(issues.some((i) => i.code === "ln-4gl.deprecatedLongIf"));
  });

  it("warns on unknown identifier (no in-file type)", () => {
    const issues = analyzeDeprecatedLongIf("if retcode then\nendif\n");
    assert.ok(issues.some((i) => i.code === "ln-4gl.deprecatedLongIf"));
  });

  it("warns on domain-typed variable (unknown DD type)", () => {
    const text = "domain tcyesno flag\nif flag then\nendif\n";
    const issues = analyzeDeprecatedLongIf(text);
    assert.ok(issues.some((i) => i.code === "ln-4gl.deprecatedLongIf"));
  });

  it("uses clarified warning message", () => {
    const issues = analyzeDeprecatedLongIf("if retcode then\nendif\n");
    assert.match(issues[0].message, /non-boolean/i);
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
