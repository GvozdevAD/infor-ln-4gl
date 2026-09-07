const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildTypeIndex, lookupType } = require("../src/type-index");

describe("buildTypeIndex", () => {
  it("indexes boolean and long function parameters", () => {
    const text = `
function long resolve.import.site(long i.site, boolean i.multilink)
{
	nop
}
`;
    const idx = buildTypeIndex(text);
    assert.equal(lookupType(idx, "i.multilink"), "boolean");
    assert.equal(lookupType(idx, "i.site"), "long");
  });

  it("indexes multiline signatures", () => {
    const text = `
function long foo(
	long i.a,
	boolean i.flag,
	domain tcyesno i.dom
)
{
}
`;
    const idx = buildTypeIndex(text);
    assert.equal(lookupType(idx, "i.flag"), "boolean");
    assert.equal(lookupType(idx, "i.a"), "long");
    assert.equal(lookupType(idx, "i.dom"), "other");
  });

  it("indexes ref boolean params", () => {
    const idx = buildTypeIndex("function void f(ref boolean o.ok)\n{\n}\n");
    assert.equal(lookupType(idx, "o.ok"), "boolean");
  });

  it("indexes local variable declarations", () => {
    const text = `
boolean flag
long ret
domain tcyesno yn
double d
string s
`;
    const idx = buildTypeIndex(text);
    assert.equal(lookupType(idx, "flag"), "boolean");
    assert.equal(lookupType(idx, "ret"), "long");
    assert.equal(lookupType(idx, "yn"), "other");
    assert.equal(lookupType(idx, "d"), "other");
    assert.equal(lookupType(idx, "s"), "other");
  });

  it("indexes storage-prefixed decls", () => {
    const idx = buildTypeIndex("extern boolean e.flag\nconst long c.n\n");
    assert.equal(lookupType(idx, "e.flag"), "boolean");
    assert.equal(lookupType(idx, "c.n"), "long");
  });

  it("later declaration overwrites earlier", () => {
    const text = "long flag\nboolean flag\n";
    const idx = buildTypeIndex(text);
    assert.equal(lookupType(idx, "flag"), "boolean");
  });

  it("lookup is case-insensitive", () => {
    const idx = buildTypeIndex("boolean MyFlag\n");
    assert.equal(lookupType(idx, "myflag"), "boolean");
    assert.equal(lookupType(idx, "MyFlag"), "boolean");
  });
});
