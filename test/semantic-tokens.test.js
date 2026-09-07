const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  findLocalFunctionCalls,
  findDefineUsages,
  extractDefineNames,
} = require("../src/semantic-tokens");

/**
 * @param {{ line: number, start: number, end: number, name: string }[]} hits
 * @param {string} name
 */
function namesAtCalls(hits, name) {
  return hits.filter((h) => h.name === name);
}

describe("findLocalFunctionCalls", () => {
  it("highlights DLL wrapper call but not its declaration", () => {
    const text = [
      "function extern long import.assembly.unit(long i.node)",
      "{",
      "    RETIFNOK(import.assembly.unit(i.node))",
      "    return(0)",
      "}",
    ].join("\n");

    const hits = findLocalFunctionCalls(text);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].name, "import.assembly.unit");
    assert.equal(hits[0].line, 2);
  });

  it("returns no tokens when function is not declared in file", () => {
    const text = 'dal.set.error.message("Order number is required")\n';
    const hits = findLocalFunctionCalls(text);
    assert.equal(hits.length, 0);
  });

  it("ignores identifiers inside comments and strings", () => {
    const text = [
      "function extern long foo()",
      "{",
      '    message("foo()")',
      "    | foo() in comment",
      "    return(0)",
      "}",
    ].join("\n");

    const hits = findLocalFunctionCalls(text);
    assert.equal(hits.length, 0);
  });

  it("highlights multiline call opener", () => {
    const text = [
      "function extern long foo(long x)",
      "{",
      "    foo(",
      "        1)",
      "    return(0)",
      "}",
    ].join("\n");

    const hits = findLocalFunctionCalls(text);
    assert.equal(namesAtCalls(hits, "foo").length, 1);
    assert.equal(hits[0].line, 2);
  });

  it("highlights two calls on one line", () => {
    const text = [
      "function extern long a()",
      "{ return(0) }",
      "function extern long b()",
      "{ return(0) }",
      "function extern long main()",
      "{",
      "    a(); b()",
      "    return(0)",
      "}",
    ].join("\n");

    const hits = findLocalFunctionCalls(text);
    assert.equal(hits.length, 2);
    assert.deepEqual(
      hits.map((h) => h.name).sort(),
      ["a", "b"],
    );
    assert.equal(hits[0].line, 6);
    assert.equal(hits[1].line, 6);
  });

  it("returns empty when file has no function declarations", () => {
    assert.equal(findLocalFunctionCalls("if true then\nendif\n").length, 0);
  });
});

describe("findDefineUsages", () => {
  it("highlights uses of #define name but not the define site", () => {
    const text = [
      "#define START.EFFECTIVE.DATE date.to.utc(2020, 01, 01, 12, 00, 00)",
      "l.root.efdt = START.EFFECTIVE.DATE",
      "l.root.efdt = START.EFFECTIVE.DATE",
    ].join("\n");

    const hits = findDefineUsages(text);
    assert.equal(hits.length, 2);
    assert.equal(hits[0].line, 1);
    assert.equal(hits[1].line, 2);
    assert.equal(hits[0].name, "START.EFFECTIVE.DATE");
  });

  it("handles function-like #define FOO(x)", () => {
    const text = [
      "#define RETIFNOK(x) if x <> 0 then return(x) endif",
      "RETIFNOK(foo())",
    ].join("\n");
    const hits = findDefineUsages(text);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].name, "RETIFNOK");
    assert.equal(hits[0].line, 1);
  });

  it("ignores define names inside comments and strings", () => {
    const text = ["#define FLAG 1", "| FLAG", 'message("FLAG")'].join("\n");
    assert.equal(findDefineUsages(text).length, 0);
  });

  it("extractDefineNames collects unique names", () => {
    const map = extractDefineNames(
      "#define A 1\n#define B(x) x\n#define a 2\n",
    );
    assert.equal(map.size, 2);
    assert.ok(map.has("a"));
    assert.ok(map.has("b"));
  });
});
