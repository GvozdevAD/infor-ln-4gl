const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildOpenDocsIndex,
  lookupDefinition,
  knownFunctionNames,
} = require("../src/open-docs-index");
const { findFunctionCalls } = require("../src/semantic-tokens");

describe("buildOpenDocsIndex", () => {
  it("merges function declarations from multiple sources", () => {
    const index = buildOpenDocsIndex([
      {
        uri: "file:///a.bc",
        text: "function extern long foo()\n{\n    return(0)\n}\n",
      },
      {
        uri: "file:///b.bc",
        text: "function extern long bar()\n{\n    return(0)\n}\n",
      },
    ]);
    assert.equal(index.size, 2);
    assert.equal(lookupDefinition(index, "foo")?.uri, "file:///a.bc");
    assert.equal(lookupDefinition(index, "bar")?.uri, "file:///b.bc");
  });

  it("prefers definition in preferUri when names collide", () => {
    const index = buildOpenDocsIndex([
      {
        uri: "file:///lib.bc",
        text: "function extern long util()\n{\n    return(1)\n}\n",
      },
      {
        uri: "file:///main.bc",
        text: "function extern long util()\n{\n    return(2)\n}\n",
      },
    ]);
    const local = lookupDefinition(index, "util", "file:///main.bc");
    assert.equal(local?.uri, "file:///main.bc");
    assert.equal(local?.line, 0);
  });

  it("knownFunctionNames exposes lowercase keys", () => {
    const index = buildOpenDocsIndex([
      {
        uri: "file:///a.bc",
        text: "function extern long Import.Thing()\n{\n    return(0)\n}\n",
      },
    ]);
    const names = knownFunctionNames(index);
    assert.ok(names.has("import.thing"));
    assert.equal(names.size, 1);
  });
});

describe("findFunctionCalls with open-docs names", () => {
  it("highlights call when declaration is only in another source set", () => {
    const names = knownFunctionNames(
      buildOpenDocsIndex([
        {
          uri: "file:///lib.bc",
          text: "function extern long remote.fn()\n{\n    return(0)\n}\n",
        },
      ]),
    );
    const hits = findFunctionCalls(
      'long x\nx = remote.fn()\n',
      names,
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0].name, "remote.fn");
  });
});
